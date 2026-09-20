from pydantic import BaseModel, Field
from typing import List


class ParameterSpec(BaseModel):
    name: str = Field(description="Variable name, e.g. 'learning_rate' or 'alpha'")
    symbol: str = Field(description="LaTeX symbol, e.g. '\\alpha'")
    min_val: float
    max_val: float
    default_val: float
    step: float
    description: str


class EquationSandboxSpec(BaseModel):
    title: str = Field(description="Name of the equation or mechanism, e.g. 'Focal Loss'")
    latex_formula: str
    concept_explanation: str
    parameters: List[ParameterSpec]
    python_formula_function: str = Field(
        description="A pure NumPy function that accepts parameter inputs and returns x and y arrays for plotting."
    )
    plot_labels: dict = Field(description="{'x_label': '...', 'y_label': '...', 'title': '...'}")


class RunnableAlgorithmSpec(BaseModel):
    algorithm_name: str
    original_pseudocode: str
    standalone_python_code: str = Field(
        description="Self-contained Python code including synthetic data generation, step-by-step execution, and print outputs."
    )
    input_parameters: List[ParameterSpec]


class IdeaTreeNode(BaseModel):
    node_id: str
    stage: str  # "Prior Baseline" | "Bottleneck Identified" | "Core Novelty" | "Impact"
    title: str
    summary: str
    connected_to: List[str]


class IdeaTreeSpec(BaseModel):
    nodes: List[IdeaTreeNode]