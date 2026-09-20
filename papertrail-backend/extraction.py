import os
import json
from groq import Groq
from dotenv import load_dotenv
from schemas import EquationSandboxSpec, IdeaTreeSpec, RunnableAlgorithmSpec

load_dotenv()

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

MODEL = "openai/gpt-oss-20b"


def _call_groq_with_retry(messages, temperature=0.2, json_mode=True, max_attempts=2):
    """
    Calls the Groq API with automatic retries. Occasionally the model's
    output fails Groq's own JSON schema validation (a generation issue on
    Groq's side, not necessarily a bug in our prompt) and comes back with
    an empty failed_generation, giving us nothing to debug directly.

    Strategy: try with strict JSON mode up to max_attempts times. If those
    all fail, fall back to a final attempt WITHOUT strict JSON mode --
    the model is instructed in the prompt to return only JSON anyway, and
    plain text mode sometimes succeeds where the stricter validated mode
    gets rejected on certain inputs. The caller's json.loads() step still
    validates the actual structure either way.
    """
    last_error = None

    for attempt in range(max_attempts):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=messages,
                temperature=temperature,
                response_format={"type": "json_object"} if json_mode else None,
            )
            return response.choices[0].message.content
        except Exception as e:
            last_error = e
            continue

    if json_mode:
        # Final fallback: same prompt, no strict JSON mode enforcement.
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=messages,
                temperature=temperature,
            )
            return response.choices[0].message.content
        except Exception as e:
            last_error = e

    raise ValueError(f"Groq API call failed after {max_attempts + 1} attempts: {last_error}")


def _parse_json_response(raw_content: str) -> dict:
    """
    Parses the model's JSON response, stripping markdown code fences if
    present. The fallback (non-strict-JSON-mode) path in
    _call_groq_with_retry can sometimes wrap the JSON in ```json ... ```
    even when told not to, so we handle that defensively here.
    """
    if not raw_content or not raw_content.strip():
        raise ValueError(
            "LLM returned an empty response. This usually means a rate limit "
            "was hit (check console.groq.com for usage limits) or a transient "
            "API issue -- wait a moment and try again."
        )

    cleaned = raw_content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM did not return valid JSON: {e}\nRaw output: {raw_content}")

EXTRACTION_SYSTEM_PROMPT = """You are an expert at reading academic research papers and extracting a mathematical equation into an interactive, slider-friendly format.

Your goal is to find an equation that a user can EXPLORE by dragging sliders and watching a graph change in real time. This means the equation MUST depend on 1-4 tunable SCALAR hyperparameters (like a learning rate, a temperature, a decay factor, a weighting coefficient, a focusing parameter) — NOT on raw data vectors, matrices, or datasets as its primary inputs.

Selection priority, in order:
1. First choice: a loss function, regularization term, learning rate schedule, attention scaling factor, or similar equation that has genuine tunable scalar hyperparameters explicitly discussed in the paper (e.g. Focal Loss's gamma, a temperature parameter, a decay rate). These make the best interactive sliders.
2. Second choice: if the paper's main equation only operates on data vectors/matrices (e.g. cosine similarity between two feature vectors, a distance metric between embeddings), look for a SECONDARY equation elsewhere in the paper that does have scalar hyperparameters instead (e.g. a similarity threshold, a temperature-scaled softmax, a margin value used alongside it).
3. Last resort: if truly no equation in the paper has tunable scalar hyperparameters, synthesize a simple illustrative toy equation that captures the paper's core mathematical idea using 1-2 meaningful scalar parameters (e.g. turn a fixed similarity computation into a "similarity vs. a decision threshold" curve). Clearly state in the concept_explanation that this is a simplified illustrative version, and why.

Do NOT pick an equation whose only "parameter" is a numerical stability constant like epsilon — epsilon is never an acceptable sole parameter, since it's not something a user meaningfully wants to explore.

Once you've selected the equation, produce:

1. A short title for the equation/mechanism.
2. The equation written in LaTeX.
3. A 2-3 sentence plain-English explanation of what it does and why it matters. If this is a synthesized/simplified version (selection priority 2 or 3 above), say so explicitly here.
4. A list of its scalar parameters/variables (1-4 of them), each with:
   - name (a valid Python variable name, e.g. "learning_rate")
   - symbol (the LaTeX symbol, e.g. "\\alpha")
   - a reasonable min_val, max_val, default_val, and step for a slider — use realistic values from the paper if it states them, otherwise sensible defaults for that kind of parameter
   - a short description of what it controls
5. A pure NumPy Python function named exactly as described below that computes the equation and returns x and y arrays suitable for plotting. The function must:
   - Accept ONLY the scalar parameter names as keyword arguments (never raw arrays/vectors as required inputs)
   - Internally generate its own x-axis range (e.g. via np.linspace or np.arange) appropriate to what's being plotted
   - Use ONLY numpy, referenced as `np`. Do NOT include an `import numpy` line or ANY import statement of any kind — `np` is already provided in the execution environment, and the environment has no import capability at all. Including any import statement will cause the code to fail.
   - Do NOT use Python's built-in `range()`, `len()`, `enumerate()`, or any `for`/`while` loop. The execution environment only provides `np` and has no other builtins available, so any loop or built-in function call will fail. Express everything as VECTORIZED numpy operations instead — e.g. to compute a quantity "over iterations" or "over timesteps", build a numpy array of the timestep values with `np.arange(1, n+1)` and compute the formula on the whole array at once (numpy broadcasting), never with a Python for-loop.
   - Guard against division by zero or log of zero using a small epsilon (1e-7) internally — epsilon is an implementation safety detail, never a user-facing slider parameter
   - Assign the results to variables named exactly `x` and `y`
6. plot_labels: an object with x_label, y_label, and title for the chart.

Respond with ONLY valid JSON matching this exact structure, no other text, no markdown code fences:

{
  "title": "string",
  "latex_formula": "string",
  "concept_explanation": "string",
  "parameters": [
    {
      "name": "string",
      "symbol": "string",
      "min_val": 0.0,
      "max_val": 1.0,
      "default_val": 0.5,
      "step": 0.01,
      "description": "string"
    }
  ],
  "python_formula_function": "string containing the full python code",
  "plot_labels": {"x_label": "string", "y_label": "string", "title": "string"}
}
"""


def extract_math_schema(markdown_text: str) -> EquationSandboxSpec:
    """
    Sends the paper's markdown to Groq/Llama and parses the response into
    an EquationSandboxSpec. Truncates very long papers to stay within
    context limits, since we only need the equation-relevant sections.
    """
    # Keep the request reasonably sized. 15k characters is plenty for
    # a model to find the core equation without hitting token limits.
    truncated_text = markdown_text[:15000]

    raw_content = _call_groq_with_retry(
        messages=[
            {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
            {"role": "user", "content": f"Here is the paper text:\n\n{truncated_text}"},
        ],
    )

    parsed_json = _parse_json_response(raw_content)

    # This validates the shape matches our schema. If the LLM produced
    # something malformed, this raises a clear Pydantic validation error
    # instead of failing silently later in the pipeline.
    spec = EquationSandboxSpec(**parsed_json)
    return spec


IDEA_TREE_SYSTEM_PROMPT = """You are an expert at reading academic research papers and extracting their narrative arc into a 4-stage "idea tree" — a story of how the research came to be.

Read the paper's introduction, related work, and conclusion sections. Extract exactly 4 nodes representing this evolutionary story:

1. "Prior Baseline" — What was the prevailing state-of-the-art approach or standard method before this paper? Keep it concrete (name the actual prior method/approach if the paper names one).
2. "Bottleneck Identified" — What specific flaw, limitation, or scaling problem did that prior approach have? This is the "problem" that motivated this paper.
3. "Core Novelty" — What specific idea, mechanism, or architectural change did this paper introduce to address that bottleneck?
4. "Impact" — What measurable result or improvement did this change achieve? Use real numbers from the paper if they are stated (e.g. "+4.2% accuracy", "3x faster").

Each node needs:
- node_id: "1", "2", "3", "4" in order
- stage: exactly one of "Prior Baseline", "Bottleneck Identified", "Core Novelty", "Impact"
- title: a short (3-6 word) label for this node
- summary: 2-3 plain-English sentences explaining this stage, grounded in what the paper actually says
- connected_to: a list containing the node_id of the NEXT node in the sequence (e.g. node "1"'s connected_to is ["2"]; node "4"'s connected_to is [] since it's the last stage)

Respond with ONLY valid JSON matching this exact structure, no other text, no markdown code fences:

{
  "nodes": [
    {
      "node_id": "1",
      "stage": "Prior Baseline",
      "title": "string",
      "summary": "string",
      "connected_to": ["2"]
    },
    {
      "node_id": "2",
      "stage": "Bottleneck Identified",
      "title": "string",
      "summary": "string",
      "connected_to": ["3"]
    },
    {
      "node_id": "3",
      "stage": "Core Novelty",
      "title": "string",
      "summary": "string",
      "connected_to": ["4"]
    },
    {
      "node_id": "4",
      "stage": "Impact",
      "title": "string",
      "summary": "string",
      "connected_to": []
    }
  ]
}

If the paper doesn't explicitly discuss one of these stages, make a reasonable inference from context and note the uncertainty briefly in that node's summary, rather than leaving it blank.
"""


def extract_idea_tree_schema(markdown_text: str) -> IdeaTreeSpec:
    """
    Sends the paper's markdown to Groq/Llama and parses the response into
    an IdeaTreeSpec — the 4-stage narrative arc used to render the
    Idea Tree tab's Mermaid.js flowchart.
    """
    truncated_text = markdown_text[:15000]

    raw_content = _call_groq_with_retry(
        messages=[
            {"role": "system", "content": IDEA_TREE_SYSTEM_PROMPT},
            {"role": "user", "content": f"Here is the paper text:\n\n{truncated_text}"},
        ],
    )

    parsed_json = _parse_json_response(raw_content)

    spec = IdeaTreeSpec(**parsed_json)
    return spec


ALGORITHM_SYSTEM_PROMPT = """You are an expert at reading academic research papers and converting their described algorithm or pseudocode into standalone, runnable Python code.

Read the paper and find its main algorithm (explicit pseudocode like "Algorithm 1", or a clearly described step-by-step procedure in prose). Then produce a self-contained Python implementation that:

1. Generates its own small synthetic/mock dataset internally (e.g. random NumPy arrays, a tiny mock embedding matrix, a small list of numbers) — never requires an external dataset or file.
2. Implements the algorithm's actual logic on that synthetic data, staying faithful to the paper's described steps.
3. Prints clear, labeled output at each meaningful step (e.g. print("Initial state:", ...), print("After step 2:", ...)) so a user watching the output can follow what's happening.
4. Uses ONLY Python's built-in features and numpy (referenced as `np`, already available — do NOT write an import statement of any kind, since the execution environment has no import capability and will fail on any import).
5. Is short enough to run in under a second (small synthetic data, no real training loops, no external I/O, no network calls, no file access).
6. Ends by printing a final result/summary line.

Also produce:
- algorithm_name: a short name for the algorithm.
- original_pseudocode: the algorithm's steps as the paper describes them, in plain text (not code) — this is shown to the user alongside the runnable version for comparison.
- input_parameters: 0-3 scalar parameters the synthetic run uses (e.g. "num_samples", "num_iterations"), following the same shape as the math parameters (name, symbol, min_val, max_val, default_val, step, description). If the algorithm has no meaningful tunable parameters, return an empty list.

Respond with ONLY valid JSON matching this exact structure, no other text, no markdown code fences:

{
  "algorithm_name": "string",
  "original_pseudocode": "string",
  "standalone_python_code": "string containing the full runnable python code, using \\n for newlines",
  "input_parameters": [
    {
      "name": "string",
      "symbol": "string",
      "min_val": 0.0,
      "max_val": 1.0,
      "default_val": 0.5,
      "step": 0.01,
      "description": "string"
    }
  ]
}
"""


def extract_algorithm_schema(markdown_text: str) -> RunnableAlgorithmSpec:
    """
    Sends the paper's markdown to Groq/Llama and parses the response into
    a RunnableAlgorithmSpec — a synthetic, runnable Python version of the
    paper's algorithm, used by the Code Sandbox tab.
    """
    truncated_text = markdown_text[:15000]

    raw_content = _call_groq_with_retry(
        messages=[
            {"role": "system", "content": ALGORITHM_SYSTEM_PROMPT},
            {"role": "user", "content": f"Here is the paper text:\n\n{truncated_text}"},
        ],
    )

    parsed_json = _parse_json_response(raw_content)

    spec = RunnableAlgorithmSpec(**parsed_json)
    return spec


FIX_CODE_SYSTEM_PROMPT = """You are an expert Python debugger. You will be given a piece of Python code that failed with an error, along with the error message. Fix the code so it runs successfully.

Rules:
- Use ONLY Python's built-in features and numpy (referenced as `np`, already available). Do NOT include any import statement — none are allowed, and the environment has no import capability.
- Keep the code's original purpose and structure as close to the original as possible; only change what's needed to fix the error.
- The code must remain self-contained (its own synthetic data, no external files or network access) and run in under a second.
- Keep the print statements that show step-by-step output.

Respond with ONLY the corrected Python code as a plain string. No JSON, no markdown code fences, no explanation — just the raw corrected code.
"""


def fix_broken_code(broken_code: str, error_message: str) -> str:
    """
    Given code that failed to execute and its error message, asks the LLM
    to produce a corrected version. Used for the Code Sandbox's one-retry
    self-healing loop.
    """
    raw_content = _call_groq_with_retry(
        messages=[
            {"role": "system", "content": FIX_CODE_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"This code failed:\n\n{broken_code}\n\nError:\n{error_message}\n\nProvide the corrected code.",
            },
        ],
        json_mode=False,
    )

    return raw_content.strip()