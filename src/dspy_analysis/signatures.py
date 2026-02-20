"""DSPy signatures for research paper analysis.

Signatures define the input/output structure for each analysis task.
They are declarative specifications that DSPy uses to generate and optimize prompts.
"""

from typing import Literal

import dspy
from pydantic import BaseModel, Field

# ============================================================================
# Pydantic models for structured outputs
# ============================================================================


class ExtractedTechnique(BaseModel):
    """A technique extracted from a research paper."""

    name: str = Field(description="Name of the technique (e.g., 'Scaled Dot-Product Attention')")
    technique_type: Literal[
        "algorithm",
        "architecture",
        "loss_function",
        "optimization",
        "regularization",
        "math_formula",
        "training_technique",
        "inference_technique",
        "data_augmentation",
        "other",
    ] = Field(description="Category of the technique")
    description: str = Field(description="How this technique works and is used in the paper")
    formula: str | None = Field(
        default=None,
        description="Mathematical formula in LaTeX notation (e.g., '\\text{Attention}(Q,K,V) = \\text{softmax}(QK^T/\\sqrt{d_k})V')",
    )
    pseudocode: str | None = Field(default=None, description="Step-by-step algorithm pseudocode")
    implementation_notes: str | None = Field(
        default=None,
        description="Practical implementation tips (hyperparameters, libraries, common pitfalls)",
    )
    is_novel: bool = Field(
        default=False, description="Whether this technique is novel to this paper"
    )
    improves_upon: str | None = Field(
        default=None, description="What existing technique this improves upon"
    )


class ExtractedClaim(BaseModel):
    """A claim extracted from a research paper."""

    statement: str = Field(description="The complete claim statement as a sentence")
    category: Literal["performance", "methodology", "theoretical", "empirical", "limitation"] = (
        Field(description="Category of the claim")
    )
    confidence: float = Field(ge=0, le=1, description="Confidence in this claim (0-1)")
    evidence: str | None = Field(default=None, description="Supporting evidence from the paper")


class ExtractedMethod(BaseModel):
    """A method extracted from a research paper."""

    name: str = Field(description="Name of the method")
    description: str = Field(description="Brief description of the method")
    is_novel: bool = Field(default=False, description="Whether this is a novel contribution")


class PaperAnalysisResult(BaseModel):
    """Complete analysis result for a paper."""

    summary: str = Field(description="2-3 sentence summary of the main contribution")
    claims: list[ExtractedClaim] = Field(default_factory=list)
    methods: list[ExtractedMethod] = Field(default_factory=list)
    techniques: list[ExtractedTechnique] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    confidence_overall: float = Field(ge=0, le=1, default=0.8)


class DetectedContradiction(BaseModel):
    """A detected contradiction between two claims."""

    claim1_index: int = Field(description="Index of the first claim")
    claim2_index: int = Field(description="Index of the second claim")
    contradiction_type: Literal["direct", "methodological", "empirical", "interpretive"] = Field(
        description="Type of contradiction"
    )
    strength: float = Field(ge=0, le=1, description="Strength of the contradiction (0-1)")
    explanation: str = Field(description="Why these claims contradict")
    possible_reconciliation: str | None = Field(
        default=None, description="How the contradiction might be reconciled"
    )


# ============================================================================
# DSPy Signatures
# ============================================================================


class TechniqueExtraction(dspy.Signature):
    """Extract techniques, algorithms, and formulas from research paper content.

    Focus on finding:
    - Mathematical formulas and equations (in LaTeX format)
    - Algorithm pseudocode and step-by-step procedures
    - Implementation details (hyperparameters, libraries, tips)
    - Novel contributions vs established techniques

    For formulas, COPY the exact mathematical notation from the paper.
    For pseudocode, convert algorithm descriptions into numbered steps.
    """

    paper_title: str = dspy.InputField(desc="Title of the research paper")
    paper_content: str = dspy.InputField(desc="Paper content (abstract and/or full text sections)")

    techniques: list[ExtractedTechnique] = dspy.OutputField(
        desc="List of extracted techniques with formulas and pseudocode"
    )


class ClaimExtraction(dspy.Signature):
    """Extract key claims from a research paper.

    Claims are verifiable statements about:
    - Performance results (e.g., "achieves 94% accuracy on ImageNet")
    - Methodology contributions (e.g., "our method reduces training time by 3x")
    - Theoretical findings (e.g., "we prove that X converges in O(n) steps")
    - Empirical observations (e.g., "larger models show emergent abilities")
    - Limitations (e.g., "this approach does not scale to sequences >4k tokens")

    Each claim should be a complete, specific sentence with quantitative details where available.
    """

    paper_title: str = dspy.InputField(desc="Title of the research paper")
    paper_content: str = dspy.InputField(desc="Paper content (abstract and/or full text)")

    claims: list[ExtractedClaim] = dspy.OutputField(desc="List of extracted claims with evidence")


class PaperAnalysis(dspy.Signature):
    """Comprehensively analyze a research paper to extract structured information.

    This is the main analysis signature that extracts:
    1. A concise summary of the paper's contribution
    2. Key claims with evidence and confidence scores
    3. Methods used or introduced
    4. Techniques with formulas, pseudocode, and implementation notes
    5. Keywords for categorization

    For the best extraction:
    - Look for equations in Methods/Algorithm sections
    - Extract VERBATIM formulas in LaTeX notation
    - Convert algorithm descriptions to structured pseudocode
    - Note specific hyperparameters and implementation guidance
    """

    paper_title: str = dspy.InputField(desc="Title of the research paper")
    paper_abstract: str = dspy.InputField(desc="Paper abstract")
    paper_full_text: str = dspy.InputField(
        desc="Full paper text from key sections (Methods, Algorithm, etc.) or empty if not available"
    )

    analysis: PaperAnalysisResult = dspy.OutputField(
        desc="Complete structured analysis of the paper"
    )


class ContradictionDetection(dspy.Signature):
    """Detect contradictions between research claims.

    Identify pairs of claims that:
    1. Directly contradict each other (opposite conclusions)
    2. Use incompatible methodologies reaching different conclusions
    3. Present conflicting empirical findings on the same topic
    4. Offer mutually exclusive interpretations

    Only flag genuine contradictions, not mere differences in scope or focus.
    Provide strength scores and possible reconciliations.
    """

    claims_text: str = dspy.InputField(desc="Numbered list of claims to analyze for contradictions")

    contradictions: list[DetectedContradiction] = dspy.OutputField(
        desc="List of detected contradictions between claims"
    )
    analysis_confidence: float = dspy.OutputField(
        desc="Overall confidence in the contradiction analysis (0-1)"
    )


class TrendIdentification(dspy.Signature):
    """Identify research trends from a collection of papers and claims.

    Look for:
    - Emerging trends (new topics gaining traction)
    - Accelerating trends (established topics growing faster)
    - Declining trends (topics losing momentum)

    Provide evidence from the papers for each trend.
    """

    papers_summary: str = dspy.InputField(desc="Summary of recent papers with claims and methods")
    historical_trends: str = dspy.InputField(desc="Previously identified trends for context")

    trends: str = dspy.OutputField(
        desc="JSON array of identified trends with name, description, direction, velocity, and evidence"
    )
    meta_observations: str = dspy.OutputField(
        desc="Higher-level observations about the research landscape"
    )


class FormulaExtraction(dspy.Signature):
    """Extract mathematical formulas from paper text and convert to LaTeX.

    Find all mathematical expressions, equations, and formulas.
    Convert each to proper LaTeX notation that renders correctly.
    Include the name/label of the formula if mentioned.
    """

    text_section: str = dspy.InputField(desc="Text section that may contain formulas")

    formulas: str = dspy.OutputField(
        desc="JSON array of {name: string, latex: string, context: string} objects"
    )


class PseudocodeGeneration(dspy.Signature):
    """Generate structured pseudocode from algorithm descriptions.

    Convert natural language algorithm descriptions into clear, numbered pseudocode.
    Include:
    - Input parameters with types
    - Output specification
    - Numbered steps with proper indentation for nested logic
    - Mathematical operations in LaTeX within steps
    """

    algorithm_description: str = dspy.InputField(
        desc="Natural language description of an algorithm"
    )
    algorithm_name: str = dspy.InputField(desc="Name of the algorithm")

    pseudocode: str = dspy.OutputField(
        desc="Structured pseudocode with Algorithm name, Input, Output, and numbered Steps"
    )
