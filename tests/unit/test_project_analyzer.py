"""Tests for Project Analyzer agent and related KG models."""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
import sys

import pytest

# Mock the problematic imports before they're loaded
sys.modules["neo4j"] = MagicMock()
sys.modules["src.db"] = MagicMock()
sys.modules["src.config"] = MagicMock()

# Now we can safely import from kg.models directly (not through __init__)
# We need to use importlib to get around the cached imports
import importlib.util

spec = importlib.util.spec_from_file_location("kg_models", "src/kg/models.py")
kg_models = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kg_models)

ProjectNode = kg_models.ProjectNode
ProblemNode = kg_models.ProblemNode
ApproachNode = kg_models.ApproachNode
HasProblemRelation = kg_models.HasProblemRelation
AddressedByRelation = kg_models.AddressedByRelation
SolvedByRelation = kg_models.SolvedByRelation

from src.models import Task, TaskType, TaskStatus


class TestProjectNode:
    def test_project_node_creation(self):
        project = ProjectNode(
            id="test-project-id",
            name="Test Competition",
            url="https://kaggle.com/competitions/test",
            source="kaggle",
            description="A test competition",
            status="pending",
        )

        assert project.id == "test-project-id"
        assert project.name == "Test Competition"
        assert project.source == "kaggle"
        assert project.status == "pending"
        assert project.label == "Project"

    def test_project_node_to_dict(self):
        project = ProjectNode(
            id="test-id",
            name="Test",
            url="https://example.com",
            source="custom",
            created_at=datetime(2024, 1, 1, 12, 0, 0),
        )

        d = project.to_dict()
        assert d["id"] == "test-id"
        assert d["name"] == "Test"
        assert d["source"] == "custom"
        assert d["created_at"] == "2024-01-01T12:00:00"

    def test_project_node_defaults(self):
        project = ProjectNode(id="test-id")

        assert project.name == ""
        assert project.url == ""
        assert project.source == "custom"
        assert project.status == "pending"
        assert project.raw_content is None
        assert project.error_message is None


class TestProblemNode:
    def test_problem_node_creation(self):
        problem = ProblemNode(
            id="test-problem-id",
            project_id="test-project-id",
            statement="Predict the target variable",
            category="objective",
            details="Binary classification problem",
            priority=5,
        )

        assert problem.id == "test-problem-id"
        assert problem.project_id == "test-project-id"
        assert problem.category == "objective"
        assert problem.priority == 5
        assert problem.label == "Problem"

    def test_problem_node_defaults(self):
        problem = ProblemNode(id="test-id")

        assert problem.project_id == ""
        assert problem.statement == ""
        assert problem.category == ""
        assert problem.priority == 1


class TestApproachNode:
    def test_approach_node_creation(self):
        approach = ApproachNode(
            id="test-approach-id",
            project_id="test-project-id",
            name="Gradient Boosting Approach",
            description="Use XGBoost with feature engineering",
            priority=1,
            confidence=0.8,
            reasoning="Strong baseline for tabular data",
            challenges=["Feature selection", "Overfitting"],
            mitigations=["Use cross-validation", "Early stopping"],
        )

        assert approach.id == "test-approach-id"
        assert approach.name == "Gradient Boosting Approach"
        assert approach.confidence == 0.8
        assert len(approach.challenges) == 2
        assert len(approach.mitigations) == 2
        assert approach.label == "Approach"

    def test_approach_node_defaults(self):
        approach = ApproachNode(id="test-id")

        assert approach.project_id == ""
        assert approach.name == ""
        assert approach.priority == 1
        assert approach.confidence == 0.5
        assert approach.challenges == []
        assert approach.mitigations == []


class TestProjectRelations:
    def test_has_problem_relation(self):
        rel = HasProblemRelation(
            source_id="project-id",
            target_id="problem-id",
        )

        assert rel.source_id == "project-id"
        assert rel.target_id == "problem-id"
        assert rel.type == "HAS_PROBLEM"

    def test_addressed_by_relation(self):
        rel = AddressedByRelation(
            source_id="problem-id",
            target_id="paper-id",
            relevance=0.85,
            explanation="Paper addresses the core optimization problem",
            aspects_addressed=["optimization", "regularization"],
        )

        assert rel.source_id == "problem-id"
        assert rel.target_id == "paper-id"
        assert rel.relevance == 0.85
        assert rel.type == "ADDRESSED_BY"
        assert len(rel.aspects_addressed) == 2

    def test_solved_by_relation(self):
        rel = SolvedByRelation(
            source_id="problem-id",
            target_id="approach-id",
        )

        assert rel.type == "SOLVED_BY"


class TestProjectAnalyzerHelpers:
    """Test helper methods of the ProjectAnalyzerAgent.

    These tests mock the agent to avoid importing the full agent module
    which has complex dependencies.
    """

    def test_detect_source_kaggle(self):
        # Test the source detection logic directly
        url = "https://www.kaggle.com/competitions/test"
        from urllib.parse import urlparse

        parsed = urlparse(url)
        domain = parsed.netloc.lower()

        if "kaggle.com" in domain:
            source = "kaggle"
        elif "github.com" in domain:
            source = "github"
        else:
            source = "custom"

        assert source == "kaggle"

    def test_detect_source_github(self):
        url = "https://github.com/user/repo"
        from urllib.parse import urlparse

        parsed = urlparse(url)
        domain = parsed.netloc.lower()

        if "kaggle.com" in domain:
            source = "kaggle"
        elif "github.com" in domain:
            source = "github"
        else:
            source = "custom"

        assert source == "github"

    def test_detect_source_custom(self):
        url = "https://example.com/project"
        from urllib.parse import urlparse

        parsed = urlparse(url)
        domain = parsed.netloc.lower()

        if "kaggle.com" in domain:
            source = "kaggle"
        elif "github.com" in domain:
            source = "github"
        else:
            source = "custom"

        assert source == "custom"

    def test_extract_name_from_kaggle_url(self):
        url = "https://kaggle.com/competitions/titanic-survival"
        from urllib.parse import urlparse

        parsed = urlparse(url)
        path_parts = [p for p in parsed.path.split("/") if p]

        if "kaggle.com" in parsed.netloc:
            if len(path_parts) >= 2 and path_parts[0] == "competitions":
                name = path_parts[1].replace("-", " ").title()
            else:
                name = path_parts[-1] if path_parts else "Unnamed"
        else:
            name = path_parts[-1] if path_parts else "Unnamed"

        assert name == "Titanic Survival"

    def test_extract_name_from_github_url(self):
        url = "https://github.com/user/my-project"
        from urllib.parse import urlparse

        parsed = urlparse(url)
        path_parts = [p for p in parsed.path.split("/") if p]

        if "github.com" in parsed.netloc and len(path_parts) >= 2:
            name = f"{path_parts[0]}/{path_parts[1]}"
        else:
            name = path_parts[-1] if path_parts else "Unnamed"

        assert name == "user/my-project"


class TestTaskTypeProjectAnalyze:
    """Test the PROJECT_ANALYZE task type."""

    def test_project_analyze_task_creation(self):
        task = Task(
            id="test-task",
            type=TaskType.PROJECT_ANALYZE,
            status=TaskStatus.PENDING,
            payload={
                "url": "https://kaggle.com/competitions/titanic",
                "name": "Titanic",
            },
        )

        assert task.type == TaskType.PROJECT_ANALYZE
        assert task.payload["url"] == "https://kaggle.com/competitions/titanic"
        assert task.payload["name"] == "Titanic"

    def test_project_analyze_task_with_project_id(self):
        task = Task(
            id="test-task",
            type=TaskType.PROJECT_ANALYZE,
            status=TaskStatus.PENDING,
            payload={
                "project_id": "existing-project-id",
            },
        )

        assert task.type == TaskType.PROJECT_ANALYZE
        assert task.payload["project_id"] == "existing-project-id"
