"""Tests for Pydantic models."""

from datetime import datetime

import pytest

from src.models import (
    Paper,
    Claim,
    Method,
    Trend,
    Prediction,
    ThoughtSignature,
    Task,
    TaskStatus,
    TaskType,
    ClaimStatus,
    TrendDirection,
    PredictionOutcome,
    ProjectSource,
    ProjectStatus,
)


class TestPaperModel:
    def test_paper_creation(self):
        paper = Paper(
            arxiv_id="2401.00001",
            title="Test Paper",
            abstract="Test abstract",
            authors=["Author One"],
            categories=["cs.AI"],
            published_date=datetime.utcnow(),
        )

        assert paper.arxiv_id == "2401.00001"
        assert paper.title == "Test Paper"
        assert paper.analyzed is False
        assert paper.id is not None

    def test_paper_with_all_fields(self):
        paper = Paper(
            arxiv_id="2401.00001",
            title="Test Paper",
            abstract="Test abstract",
            authors=["Author One", "Author Two"],
            categories=["cs.AI", "cs.LG"],
            published_date=datetime.utcnow(),
            updated_date=datetime.utcnow(),
            pdf_url="https://arxiv.org/pdf/2401.00001",
            source_url="https://arxiv.org/abs/2401.00001",
            citation_count=10,
            analyzed=True,
        )

        assert len(paper.authors) == 2
        assert paper.citation_count == 10
        assert paper.analyzed is True


class TestClaimModel:
    def test_claim_creation(self):
        claim = Claim(
            paper_id="paper-123",
            statement="This is a test claim",
            category="performance",
            confidence=0.8,
        )

        assert claim.paper_id == "paper-123"
        assert claim.status == ClaimStatus.UNVERIFIED
        assert claim.confidence == 0.8

    def test_claim_confidence_bounds(self):
        # Test lower bound
        claim_low = Claim(
            paper_id="paper-123",
            statement="Test",
            confidence=0.0,
        )
        assert claim_low.confidence == 0.0

        # Test upper bound
        claim_high = Claim(
            paper_id="paper-123",
            statement="Test",
            confidence=1.0,
        )
        assert claim_high.confidence == 1.0


class TestTrendModel:
    def test_trend_creation(self):
        trend = Trend(
            name="Test Trend",
            description="A test trend",
            direction=TrendDirection.RISING,
            velocity=7.5,
            confidence=0.8,
        )

        assert trend.name == "Test Trend"
        assert trend.direction == TrendDirection.RISING
        assert trend.velocity == 7.5


class TestPredictionModel:
    def test_prediction_creation(self):
        prediction = Prediction(
            statement="Test prediction",
            category="method_adoption",
            confidence=0.6,
        )

        assert prediction.statement == "Test prediction"
        assert prediction.outcome == PredictionOutcome.PENDING
        assert prediction.due_date is None


class TestThoughtSignatureModel:
    def test_thought_signature_creation(self):
        thought = ThoughtSignature(
            agent_name="test_agent",
            context_summary="Test context",
            decision_made="Test decision",
            reasoning="Test reasoning",
            confidence=0.8,
            assumptions=["Assumption 1"],
            expected_outcomes=["Outcome 1"],
        )

        assert thought.agent_name == "test_agent"
        assert thought.confidence == 0.8
        assert len(thought.assumptions) == 1

    def test_was_correct_with_matching_outcomes(self):
        thought = ThoughtSignature(
            agent_name="test_agent",
            context_summary="Test",
            decision_made="Test",
            reasoning="Test",
            confidence=0.8,
            expected_outcomes=["Result A", "Result B"],
            actual_outcomes=["Result A occurred", "Result B happened"],
        )

        assert thought.was_correct() is True

    def test_was_correct_with_no_actual_outcomes(self):
        thought = ThoughtSignature(
            agent_name="test_agent",
            context_summary="Test",
            decision_made="Test",
            reasoning="Test",
            confidence=0.8,
            expected_outcomes=["Result A"],
        )

        assert thought.was_correct() is None


class TestTaskModel:
    def test_task_creation(self):
        task = Task(
            type=TaskType.INGEST,
            payload={"topic": "machine learning"},
        )

        assert task.type == TaskType.INGEST
        assert task.status == TaskStatus.PENDING
        assert task.priority == 5
        assert task.payload["topic"] == "machine learning"

    def test_task_with_high_priority(self):
        task = Task(
            type=TaskType.CORRECT,
            priority=8,
        )

        assert task.priority == 8

    def test_task_project_analyze_type(self):
        task = Task(
            type=TaskType.PROJECT_ANALYZE,
            payload={"url": "https://kaggle.com/competitions/test"},
        )

        assert task.type == TaskType.PROJECT_ANALYZE
        assert task.payload["url"] == "https://kaggle.com/competitions/test"


class TestProjectEnums:
    def test_project_source_values(self):
        assert ProjectSource.KAGGLE.value == "kaggle"
        assert ProjectSource.GITHUB.value == "github"
        assert ProjectSource.CUSTOM.value == "custom"

    def test_project_status_values(self):
        assert ProjectStatus.PENDING.value == "pending"
        assert ProjectStatus.ANALYZING.value == "analyzing"
        assert ProjectStatus.COMPLETED.value == "completed"
        assert ProjectStatus.FAILED.value == "failed"
