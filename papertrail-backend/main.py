import tempfile
import os
import subprocess
import sys

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pymupdf4llm

from extraction import (
    extract_math_schema,
    extract_idea_tree_schema,
    extract_algorithm_schema,
    fix_broken_code,
)

app = FastAPI(title="PaperTrail Backend")

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB limit on uploaded PDFs

# Allow frontend origins to call this API safely.
ALLOWED_ORIGINS = [orig.strip() for orig in os.environ.get("ALLOWED_ORIGINS", "*").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False if "*" in ALLOWED_ORIGINS else True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    return {"status": "ok", "message": "PaperTrail backend is running"}


@app.post("/parse-pdf")
async def parse_pdf(file: UploadFile = File(...)):
    """
    Accepts a PDF upload, converts it to clean Markdown using pymupdf4llm,
    and returns the Markdown text. This is the foundation step every other
    extraction step (Math, Algorithm, Idea Tree) will read from.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    tmp_path = None
    try:
        contents = await file.read()

        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large. Max size is 20MB.")

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        markdown_content = pymupdf4llm.to_markdown(tmp_path)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse PDF: {str(e)}")

    finally:
        # Clean up the temp file safely
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

    return {
        "filename": file.filename,
        "markdown": markdown_content,
        "char_count": len(markdown_content),
    }


class ExtractMathRequest(BaseModel):
    markdown: str


@app.post("/extract-math")
async def extract_math(request: ExtractMathRequest):
    """
    Takes the paper's markdown (from /parse-pdf) and asks the LLM to
    extract the core equation into a structured EquationSandboxSpec,
    which the frontend uses to render sliders and a live graph.
    """
    if not request.markdown or len(request.markdown.strip()) < 50:
        raise HTTPException(status_code=400, detail="Markdown text is too short or empty.")

    try:
        spec = extract_math_schema(request.markdown)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"Extraction failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error during extraction: {str(e)}")

    return spec.model_dump()


class EvaluateFormulaRequest(BaseModel):
    python_formula_function: str
    parameters: dict


def _validate_safe_formula_ast(code_str: str):
    """
    Validates that the generated formula code contains only safe mathematical
    operations and prevents sandbox escapes or dunder traversal.
    """
    import ast

    forbidden_attrs = {
        "__class__",
        "__bases__",
        "__subclasses__",
        "__globals__",
        "__builtins__",
        "__import__",
        "__code__",
        "__reduce__",
    }
    forbidden_calls = {"eval", "exec", "open", "compile", "breakpoint", "__import__", "input"}

    try:
        tree = ast.parse(code_str)
    except SyntaxError as e:
        raise HTTPException(status_code=400, detail=f"Syntax error in formula: {e}")

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name not in {"numpy", "math"}:
                    raise HTTPException(status_code=400, detail=f"Import of module '{alias.name}' is not permitted.")
        elif isinstance(node, ast.ImportFrom):
            if node.module not in {"numpy", "math"}:
                raise HTTPException(status_code=400, detail=f"Import from module '{node.module}' is not permitted.")
        elif isinstance(node, ast.Attribute) and (node.attr.startswith("__") or node.attr in forbidden_attrs):
            raise HTTPException(status_code=400, detail=f"Access to attribute '{node.attr}' is prohibited.")
        elif isinstance(node, ast.Name) and node.id in forbidden_calls:
            raise HTTPException(status_code=400, detail=f"Calling '{node.id}' is prohibited.")


@app.post("/evaluate-formula")
async def evaluate_formula(request: EvaluateFormulaRequest):
    """
    Executes the LLM-generated Python formula function with the given
    parameter values and returns fresh x/y arrays for plotting.
    Protected with strict AST validation and restricted builtins.
    """
    import numpy as np

    safe_builtins = {
        "range": range,
        "len": len,
        "enumerate": enumerate,
        "min": min,
        "max": max,
        "abs": abs,
        "round": round,
        "sum": sum,
        "zip": zip,
    }

    safe_namespace = {"np": np, "__builtins__": safe_builtins}

    # Normalize line endings
    normalized_code = request.python_formula_function.replace("\r\n", "\n").replace("\r", "\n")

    # Strip any stray import lines
    code_lines = [
        line for line in normalized_code.split("\n")
        if not line.strip().startswith(("import ", "from "))
    ]
    normalized_code = "\n".join(code_lines)

    # Perform AST safety check
    _validate_safe_formula_ast(normalized_code)

    try:
        exec(normalized_code, safe_namespace)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Formula code failed to define: {str(e)}")

    # Find the function the LLM defined
    func = None
    for value in safe_namespace.values():
        if callable(value) and value not in safe_builtins.values():
            func = value
            break

    if func is None:
        raise HTTPException(status_code=400, detail="No callable function found in the generated code.")

    try:
        x, y = func(**request.parameters)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Formula execution failed: {str(e)}")

    return {
        "x": np.asarray(x).tolist(),
        "y": np.asarray(y).tolist(),
    }


class ExtractIdeaTreeRequest(BaseModel):
    markdown: str


@app.post("/extract-idea-tree")
async def extract_idea_tree(request: ExtractIdeaTreeRequest):
    """
    Takes the paper's markdown (from /parse-pdf) and asks the LLM to
    extract its 4-stage narrative arc (Prior Baseline -> Bottleneck ->
    Core Novelty -> Impact) into an IdeaTreeSpec, which the frontend
    renders as a Mermaid.js flowchart.
    """
    if not request.markdown or len(request.markdown.strip()) < 50:
        raise HTTPException(status_code=400, detail="Markdown text is too short or empty.")

    try:
        spec = extract_idea_tree_schema(request.markdown)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"Extraction failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error during extraction: {str(e)}")

    return spec.model_dump()


class ExtractAlgorithmRequest(BaseModel):
    markdown: str


@app.post("/extract-algorithm")
async def extract_algorithm(request: ExtractAlgorithmRequest):
    """
    Takes the paper's markdown (from /parse-pdf) and asks the LLM to
    convert its algorithm/pseudocode into standalone runnable Python code
    with synthetic sample data, for the Code Sandbox tab.
    """
    if not request.markdown or len(request.markdown.strip()) < 50:
        raise HTTPException(status_code=400, detail="Markdown text is too short or empty.")

    try:
        spec = extract_algorithm_schema(request.markdown)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"Extraction failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error during extraction: {str(e)}")

    return spec.model_dump()


def _run_code_in_subprocess(code: str, timeout_seconds: int = 5) -> dict:
    """
    Executes Python code in an isolated subprocess with strict environment
    sanitization (stripping API keys and host secrets) and a hard timeout.
    """
    # Block dangerous system / network modules before spawning
    blocked_modules = ["socket", "requests", "urllib", "http", "ftplib", "subprocess", "multiprocessing", "shutil", "winreg", "ctypes"]
    for mod in blocked_modules:
        if f"import {mod}" in code or f"from {mod}" in code:
            return {
                "success": False,
                "stdout": "",
                "stderr": f"Security restriction: Importing '{mod}' is not permitted in sandbox.",
            }

    normalized_code = code.replace("\r\n", "\n").replace("\r", "\n")
    full_code = "import numpy as np\n" + normalized_code

    tmp_path = None
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as tmp:
        tmp.write(full_code)
        tmp_path = tmp.name

    # Sanitize environment: DO NOT leak GROQ_API_KEY or server secrets to subprocess
    subprocess_env = {
        "PYTHONIOENCODING": "utf-8",
        "PATH": os.environ.get("PATH", ""),
        "SYSTEMROOT": os.environ.get("SYSTEMROOT", "C:\\Windows"),
        "TEMP": tempfile.gettempdir(),
        "TMP": tempfile.gettempdir(),
    }

    try:
        result = subprocess.run(
            [sys.executable, tmp_path],
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            encoding="utf-8",
            env=subprocess_env,
        )
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "stdout": "",
            "stderr": f"Code timed out after {timeout_seconds} seconds.",
        }
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


class RunAlgorithmRequest(BaseModel):
    standalone_python_code: str


@app.post("/run-algorithm")
async def run_algorithm(request: RunAlgorithmRequest):
    """
    Runs the LLM-generated algorithm code in an isolated subprocess and
    returns its printed output. If it fails, asks the LLM to fix the code
    once (self-healing, 1 retry) and tries again before giving up.
    """
    try:
        result = _run_code_in_subprocess(request.standalone_python_code)

        if result["success"]:
            return {
                "output": result["stdout"],
                "fixed": False,
                "final_code": request.standalone_python_code,
            }

        # First attempt failed -- ask the LLM to fix it, once.
        try:
            fixed_code = fix_broken_code(request.standalone_python_code, result["stderr"])
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f"Code failed and the fix attempt itself errored: {str(e)}. Original error: {result['stderr']}",
            )

        retry_result = _run_code_in_subprocess(fixed_code)

        if retry_result["success"]:
            return {
                "output": retry_result["stdout"],
                "fixed": True,
                "final_code": fixed_code,
            }

        # Both the original and the one retry failed -- surface both errors
        # honestly rather than pretending it worked.
        raise HTTPException(
            status_code=400,
            detail=(
                f"Code failed after 1 retry.\n"
                f"Original error: {result['stderr']}\n"
                f"After fix attempt, error: {retry_result['stderr']}"
            ),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error running algorithm: {str(e)}")