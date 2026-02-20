"""Knowledge Graph node and relationship models."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class BaseNode:
    """Base class for graph nodes."""

    id: str
    created_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for Neo4j."""
        result = {}
        for key, value in self.__dict__.items():
            if isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, list):
                result[key] = value
            else:
                result[key] = value
        return result


@dataclass
class PaperNode(BaseNode):
    """Represents a research paper in the knowledge graph."""

    arxiv_id: str = ""
    title: str = ""
    abstract: str = ""
    authors: list[str] = field(default_factory=list)
    categories: list[str] = field(default_factory=list)
    published_date: datetime | None = None
    updated_date: datetime | None = None
    pdf_url: str | None = None
    source_url: str | None = None
    citation_count: int = 0
    analyzed: bool = False

    @property
    def label(self) -> str:
        return "Paper"


@dataclass
class ClaimNode(BaseNode):
    """Represents a claim extracted from a paper."""

    paper_id: str = ""
    statement: str = ""
    category: str = ""  # performance, methodology, theoretical, empirical, limitation
    status: str = "unverified"  # unverified, supported, contested, refuted
    confidence: float = 0.5
    evidence: str | None = None
    context: str | None = None
    quantitative: bool = False
    # Novelty detection fields
    novelty_score: float | None = None  # 0-1 score (0=already known, 1=highly novel)
    similar_claims: list[str] = field(default_factory=list)  # IDs of similar claims
    novelty_explanation: str | None = None  # Why it's novel or not

    @property
    def label(self) -> str:
        return "Claim"


@dataclass
class MethodNode(BaseNode):
    """Represents a method or technique."""

    name: str = ""
    description: str = ""
    category: str | None = None
    first_paper_id: str | None = None
    paper_count: int = 1
    is_novel: bool = False

    @property
    def label(self) -> str:
        return "Method"


@dataclass
class TechniqueNode(BaseNode):
    """Represents a specific technique, algorithm, or mathematical formulation."""

    name: str = ""
    technique_type: str = (
        ""  # algorithm, architecture, loss_function, optimization, regularization, math_formula, training_technique, inference_technique, data_augmentation, other
    )
    description: str = ""
    formula: str | None = None  # LaTeX formula if applicable
    pseudocode: str | None = None  # Step-by-step algorithm pseudocode
    implementation_notes: str | None = None  # How to implement this technique
    is_novel: bool = False
    improves_upon: str | None = None
    paper_id: str | None = None
    paper_count: int = 1
    # Novelty detection fields
    novelty_score: float | None = None  # 0-1 score (0=derivative, 1=highly novel)
    similar_techniques: list[str] = field(default_factory=list)  # IDs of similar techniques
    novelty_explanation: str | None = None  # Why it's novel or not

    @property
    def label(self) -> str:
        return "Technique"


@dataclass
class TrendNode(BaseNode):
    """Represents a research trend."""

    name: str = ""
    description: str = ""
    direction: str = "rising"  # rising, stable, declining
    velocity: float = 0.0
    confidence: float = 0.5
    first_seen: datetime = field(default_factory=datetime.utcnow)
    last_updated: datetime = field(default_factory=datetime.utcnow)

    @property
    def label(self) -> str:
        return "Trend"


@dataclass
class PatternNode(BaseNode):
    """Represents a recurring research pattern.

    Patterns are reusable research templates that appear across multiple papers,
    e.g., "contrastive learning for X", "transformer-based Y", "self-supervised Z".
    """

    name: str = ""  # Pattern name, e.g., "Contrastive Learning for Vision"
    pattern_type: str = ""  # methodology, architecture, training, data, evaluation
    template: str = ""  # Abstract template, e.g., "Apply {technique} to {domain} for {task}"
    description: str = ""  # Detailed description of the pattern
    key_components: list[str] = field(default_factory=list)  # Core elements of this pattern
    common_techniques: list[str] = field(default_factory=list)  # Techniques often used
    example_applications: list[str] = field(default_factory=list)  # Example uses
    domains: list[str] = field(default_factory=list)  # Applicable domains
    frequency: int = 1  # How many papers use this pattern
    novelty_score: float = 0.5  # How novel/unique this pattern is (0=common, 1=novel)
    effectiveness_score: float = 0.5  # How effective based on paper results
    first_seen_paper_id: str | None = None  # Paper that introduced this pattern

    @property
    def label(self) -> str:
        return "Pattern"


@dataclass
class AnchorPaperNode(BaseNode):
    """Represents a reference paper with known quality scores for anchored evaluation.

    Anchor papers are well-established papers with known impact/quality that serve
    as reference points for evaluating new research.
    """

    paper_id: str = ""  # Reference to the PaperNode
    title: str = ""
    venue: str = ""  # e.g., "NeurIPS 2023", "ICLR 2024"
    venue_tier: str = "A"  # A, B, C tier conferences
    citation_count: int = 0
    impact_score: float = 5.0  # 1-10 calibrated score
    methodology_score: float = 5.0  # 1-10 score for methodology quality
    novelty_score: float = 5.0  # 1-10 score for novelty
    clarity_score: float = 5.0  # 1-10 score for clarity
    reproducibility_score: float = 5.0  # 1-10 score for reproducibility
    domain: str = ""  # Research domain for matching
    keywords: list[str] = field(default_factory=list)

    @property
    def label(self) -> str:
        return "AnchorPaper"


@dataclass
class PredictionNode(BaseNode):
    """Represents a prediction made by the system."""

    statement: str = ""
    category: str = ""  # method_adoption, performance_improvement, new_capability, etc.
    confidence: float = 0.5
    timeframe: str = "3_months"  # 1_month, 3_months, 6_months, 1_year
    reasoning: str | None = None
    made_at: datetime = field(default_factory=datetime.utcnow)
    due_date: datetime | None = None
    outcome: str = "pending"  # pending, correct, incorrect, partial
    outcome_details: str | None = None
    resolved_at: datetime | None = None

    @property
    def label(self) -> str:
        return "Prediction"


# Relationship models


@dataclass
class BaseRelation:
    """Base class for relationships."""

    source_id: str
    target_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for Neo4j."""
        result = {}
        for key, value in self.__dict__.items():
            if key in ("source_id", "target_id"):
                continue
            if isinstance(value, datetime):
                result[key] = value.isoformat()
            else:
                result[key] = value
        return result


@dataclass
class ContainsRelation(BaseRelation):
    """Paper contains a claim."""

    @property
    def type(self) -> str:
        return "CONTAINS"


@dataclass
class SupportsRelation(BaseRelation):
    """One claim supports another."""

    strength: float = 0.5
    explanation: str | None = None

    @property
    def type(self) -> str:
        return "SUPPORTS"


@dataclass
class ContradictsRelation(BaseRelation):
    """One claim contradicts another."""

    strength: float = 0.5
    contradiction_type: str = "direct"  # direct, methodological, empirical, interpretive
    explanation: str | None = None
    possible_reconciliation: str | None = None

    @property
    def type(self) -> str:
        return "CONTRADICTS"


@dataclass
class UsesMethodRelation(BaseRelation):
    """Paper uses a method."""

    is_primary: bool = False

    @property
    def type(self) -> str:
        return "USES_METHOD"


@dataclass
class IntroducesMethodRelation(BaseRelation):
    """Paper introduces a method."""

    @property
    def type(self) -> str:
        return "INTRODUCES"


@dataclass
class InvolvesTrendRelation(BaseRelation):
    """Claim or method is involved in a trend."""

    contribution: float = 0.5  # How much this contributes to the trend

    @property
    def type(self) -> str:
        return "INVOLVES"


@dataclass
class BasedOnTrendRelation(BaseRelation):
    """Prediction is based on a trend."""

    weight: float = 0.5  # How much this trend influenced the prediction

    @property
    def type(self) -> str:
        return "BASED_ON"


@dataclass
class CitesRelation(BaseRelation):
    """One paper cites another."""

    context: str | None = None

    @property
    def type(self) -> str:
        return "CITES"


# Project Analysis models


@dataclass
class ProjectNode(BaseNode):
    """Represents a project/competition being analyzed."""

    name: str = ""
    url: str = ""
    source: str = "custom"  # kaggle, github, custom
    description: str = ""
    status: str = "pending"  # pending, analyzing, completed, failed
    raw_content: str | None = None
    error_message: str | None = None

    @property
    def label(self) -> str:
        return "Project"


@dataclass
class ProblemNode(BaseNode):
    """Represents a problem component extracted from a project."""

    project_id: str = ""
    statement: str = ""
    category: str = ""  # input, output, constraint, metric, objective, domain
    details: str = ""
    priority: int = 1  # Higher means more important

    @property
    def label(self) -> str:
        return "Problem"


@dataclass
class ApproachNode(BaseNode):
    """Represents a solution approach for a project."""

    project_id: str = ""
    name: str = ""
    description: str = ""
    priority: int = 1  # Implementation priority order
    confidence: float = 0.5
    reasoning: str | None = None
    challenges: list[str] = field(default_factory=list)
    mitigations: list[str] = field(default_factory=list)

    @property
    def label(self) -> str:
        return "Approach"


# Project relationships


@dataclass
class HasProblemRelation(BaseRelation):
    """Project has a problem component."""

    @property
    def type(self) -> str:
        return "HAS_PROBLEM"


@dataclass
class AddressedByRelation(BaseRelation):
    """Problem is addressed by a paper."""

    relevance: float = 0.5
    explanation: str | None = None
    aspects_addressed: list[str] = field(default_factory=list)

    @property
    def type(self) -> str:
        return "ADDRESSED_BY"


@dataclass
class SolvedByRelation(BaseRelation):
    """Problem is solved by an approach."""

    @property
    def type(self) -> str:
        return "SOLVED_BY"


@dataclass
class UsesTechniqueRelation(BaseRelation):
    """Approach uses a technique/method."""

    importance: float = 0.5

    @property
    def type(self) -> str:
        return "USES_TECHNIQUE"


@dataclass
class BasedOnClaimRelation(BaseRelation):
    """Approach is based on a claim from research."""

    @property
    def type(self) -> str:
        return "BASED_ON_CLAIM"


# Pattern relationships


@dataclass
class FollowsPatternRelation(BaseRelation):
    """Paper follows a research pattern."""

    adherence_score: float = 0.5  # How closely the paper follows the pattern

    @property
    def type(self) -> str:
        return "FOLLOWS_PATTERN"


@dataclass
class ImplementsPatternRelation(BaseRelation):
    """Technique implements a pattern."""

    @property
    def type(self) -> str:
        return "IMPLEMENTS_PATTERN"


@dataclass
class ExtendsPatternRelation(BaseRelation):
    """Pattern extends another pattern."""

    extension_type: str = "refinement"  # refinement, combination, adaptation

    @property
    def type(self) -> str:
        return "EXTENDS_PATTERN"


@dataclass
class SimilarToRelation(BaseRelation):
    """Two items are similar (for novelty detection)."""

    similarity_score: float = 0.5
    similarity_type: str = "semantic"  # semantic, structural, functional

    @property
    def type(self) -> str:
        return "SIMILAR_TO"
