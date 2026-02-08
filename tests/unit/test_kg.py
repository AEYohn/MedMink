"""Tests for Knowledge Graph models and operations."""

import pytest
from datetime import datetime

from src.kg.models import (
    PaperNode,
    ClaimNode,
    MethodNode,
    TrendNode,
    PredictionNode,
    ContainsRelation,
    ContradictsRelation,
)


class TestPaperNode:
    def test_creation(self):
        paper = PaperNode(
            id="paper-123",
            arxiv_id="2401.00001",
            title="Test Paper",
            abstract="Test abstract",
        )

        assert paper.id == "paper-123"
        assert paper.label == "Paper"
        assert paper.analyzed is False

    def test_to_dict(self):
        paper = PaperNode(
            id="paper-123",
            arxiv_id="2401.00001",
            title="Test Paper",
            abstract="Test abstract",
            authors=["Author One"],
        )

        data = paper.to_dict()

        assert data["id"] == "paper-123"
        assert data["arxiv_id"] == "2401.00001"
        assert isinstance(data["created_at"], str)


class TestClaimNode:
    def test_creation(self):
        claim = ClaimNode(
            id="claim-123",
            paper_id="paper-123",
            statement="Test claim",
            category="performance",
            confidence=0.8,
        )

        assert claim.id == "claim-123"
        assert claim.label == "Claim"
        assert claim.status == "unverified"

    def test_to_dict(self):
        claim = ClaimNode(
            id="claim-123",
            paper_id="paper-123",
            statement="Test claim",
            category="performance",
            confidence=0.8,
        )

        data = claim.to_dict()

        assert data["statement"] == "Test claim"
        assert data["confidence"] == 0.8


class TestMethodNode:
    def test_creation(self):
        method = MethodNode(
            id="method-123",
            name="Test Method",
            description="A test method",
        )

        assert method.name == "Test Method"
        assert method.label == "Method"
        assert method.paper_count == 1


class TestTrendNode:
    def test_creation(self):
        trend = TrendNode(
            id="trend-123",
            name="Test Trend",
            description="A test trend",
            direction="rising",
            velocity=7.5,
        )

        assert trend.name == "Test Trend"
        assert trend.label == "Trend"
        assert trend.direction == "rising"
        assert trend.velocity == 7.5


class TestPredictionNode:
    def test_creation(self):
        prediction = PredictionNode(
            id="pred-123",
            statement="Test prediction",
            category="method_adoption",
            confidence=0.6,
        )

        assert prediction.statement == "Test prediction"
        assert prediction.label == "Prediction"
        assert prediction.outcome == "pending"


class TestContradictsRelation:
    def test_creation(self):
        relation = ContradictsRelation(
            source_id="claim-1",
            target_id="claim-2",
            strength=0.8,
            explanation="These claims contradict",
        )

        assert relation.type == "CONTRADICTS"
        assert relation.strength == 0.8

    def test_to_dict(self):
        relation = ContradictsRelation(
            source_id="claim-1",
            target_id="claim-2",
            strength=0.8,
            explanation="These claims contradict",
            contradiction_type="direct",
        )

        data = relation.to_dict()

        assert data["strength"] == 0.8
        assert data["explanation"] == "These claims contradict"
        assert "source_id" not in data
        assert "target_id" not in data
