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

# Allow the React frontend (running on a different port) to call this API.
# Tighten allow_origins to your actual frontend URL before deploying anywhere public.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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

    # pymupdf4llm needs a real file path, so we write the upload to a temp file first.
    try:
        contents = await file.read()

        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large. Max size is 20MB.")

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        markdown_content = pymupdf4llm.to_markdown(tmp_path)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse PDF: {str(e)}")

    finally:
        # Clean up the temp file regardless of success or failure.
        if os.path.exists(tmp_path):
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


@app.post("/evaluate-formula")
async def evaluate_formula(request: EvaluateFormulaRequest):
    """
    Executes the LLM-generated Python formula function with the given
    parameter values and returns fresh x/y arrays for plotting. This lets
    the frontend re-plot the curve live whenever a slider moves, without
    needing to run Python in the browser.

    Safety: the execution namespace only exposes numpy and a small
    whitelist of safe read-only builtins (range, len, enumerate, min, max,
    abs, round, sum) -- not the full builtins set, and never anything that
    touches the filesystem, network, or process (no open, no import, no
    eval/exec, no __import__).
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

    # Normalize line endings. Windows-style \r\n (or stray \r) sneaking into
    # the generated code string can cause "unexpected character after line
    # continuation character" errors in exec(), so we strip them here.
    normalized_code = request.python_formula_function.replace("\r\n", "\n").replace("\r", "\n")

    # Safety net: strip any stray import lines. The prompt instructs the LLM
    # never to include imports (np is already provided), but LLMs don't
    # always follow instructions perfectly, and imports would fail anyway
    # since __builtins__ is locked down for safety.
    code_lines = [
        line for line in normalized_code.split("\n")
        if not line.strip().startswith(("import ", "from "))
    ]
    normalized_code = "\n".join(code_lines)

    try:
        exec(normalized_code, safe_namespace)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Formula code failed to define: {str(e)}")

    # Find the function the LLM defined (it's the only callable added to the namespace).
    func = None
    for value in safe_namespace.values():
        if callable(value):
            func = value
            break

    if func is None:
        raise HTTPException(status_code=400, detail="No function found in the generated code.")

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
    Executes Python code in an isolated subprocess and captures its
    stdout/stderr. Using a subprocess (rather than in-process exec) gives
    real process isolation and a hard timeout, so runaway or malicious
    generated code can't hang or crash the main server.
    """
    normalized_code = code.replace("\r\n", "\n").replace("\r", "\n")

    # Prepend a numpy import in the subprocess itself (this runs as a real,
    # separate Python process, so imports here are fine and expected --
    # this is different from the in-process /evaluate-formula exec(), which
    # has no import capability at all).
    full_code = "import numpy as np\n" + normalized_code

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as tmp:
        tmp.write(full_code)
        tmp_path = tmp.name

    # Force UTF-8 for the subprocess's own stdout/stderr streams. Without
    # this, Windows defaults the child process's print() encoding to
    # cp1252, which crashes on non-ASCII characters (e.g. Greek letters
    # like alpha/gamma that LLM-generated code commonly includes).
    subprocess_env = os.environ.copy()
    subprocess_env["PYTHONIOENCODING"] = "utf-8"

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
        if os.path.exists(tmp_path):
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