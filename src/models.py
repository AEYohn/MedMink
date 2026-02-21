"""Pydantic models for the research synthesizer platform."""

from datetime import date, datetime

try:
    from enum import StrEnum
except ImportError:
    import enum

    class StrEnum(str, enum.Enum):
        pass


from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class TaskType(StrEnum):
    """Types of tasks the orchestrator can execute."""

    INGEST = "ingest"
    ANALYZE = "analyze"
    SYNTHESIZE = "synthesize"
    CORRECT = "correct"
    PROJECT_ANALYZE = "project_analyze"


class TaskStatus(StrEnum):
    """Status of a task."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class ClaimStatus(StrEnum):
    """Status of a claim."""

    UNVERIFIED = "unverified"
    VERIFIED = "verified"
    DISPUTED = "disputed"
    RETRACTED = "retracted"


class TrendDirection(StrEnum):
    """Direction of a trend."""

    RISING = "rising"
    FALLING = "falling"
    STABLE = "stable"


class PredictionOutcome(StrEnum):
    """Outcome of a prediction."""

    PENDING = "pending"
    CORRECT = "correct"
    INCORRECT = "incorrect"
    PARTIALLY_CORRECT = "partially_correct"


class ProjectSource(StrEnum):
    """Source of a project."""

    KAGGLE = "kaggle"
    GITHUB = "github"
    CUSTOM = "custom"


class ProjectStatus(StrEnum):
    """Status of a project."""

    PENDING = "pending"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    FAILED = "failed"


class Task(BaseModel):
    """A task to be executed by the orchestrator."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    type: TaskType
    status: TaskStatus = TaskStatus.PENDING
    priority: int = 5
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    retry_count: int = 0


class Paper(BaseModel):
    """A research paper."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    arxiv_id: str = ""
    title: str
    abstract: str
    authors: list[str] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)
    published_date: datetime
    updated_date: datetime | None = None
    pdf_url: str | None = None
    source_url: str | None = None
    citation_count: int = 0
    analyzed: bool = False


class Claim(BaseModel):
    """A claim extracted from a paper."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    paper_id: str
    statement: str
    category: str = ""
    confidence: float = 0.5
    status: ClaimStatus = ClaimStatus.UNVERIFIED
    evidence: list[str] = Field(default_factory=list)


class Method(BaseModel):
    """A method or technique described in a paper."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    paper_id: str = ""
    name: str
    description: str = ""
    category: str = ""


class Trend(BaseModel):
    """A research trend."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    description: str = ""
    direction: TrendDirection = TrendDirection.STABLE
    velocity: float = 0.0
    confidence: float = 0.5
    related_papers: list[str] = Field(default_factory=list)


class Prediction(BaseModel):
    """A prediction about future research directions."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    statement: str
    category: str = ""
    confidence: float = 0.5
    outcome: PredictionOutcome = PredictionOutcome.PENDING
    due_date: date | None = None
    evidence: list[str] = Field(default_factory=list)


class ThoughtSignature(BaseModel):
    """A thought signature for agent continuity and accountability."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    agent_name: str
    task_id: str = ""
    context_summary: str
    decision_made: str
    reasoning: str
    confidence: float
    assumptions: list[str] = Field(default_factory=list)
    expected_outcomes: list[str] = Field(default_factory=list)
    actual_outcomes: list[str] | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    def was_correct(self) -> bool | None:
        """Check if the expected outcomes match actual outcomes."""
        if self.actual_outcomes is None:
            return None
        if not self.expected_outcomes or not self.actual_outcomes:
            return None
        # Simple check: see if actual outcomes mention expected ones
        matches = 0
        for expected in self.expected_outcomes:
            for actual in self.actual_outcomes:
                if expected.lower() in actual.lower() or actual.lower() in expected.lower():
                    matches += 1
                    break
        return matches >= len(self.expected_outcomes) * 0.5


class WeeklyReport(BaseModel):
    """A weekly synthesis report."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    week_start: date
    week_end: date
    executive_summary: str = ""
    key_developments: list[str] = Field(default_factory=list)
    emerging_trends: list[dict[str, Any]] = Field(default_factory=list)
    notable_contradictions: list[dict[str, Any]] = Field(default_factory=list)
    papers_analyzed: int = 0
    claims_extracted: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
