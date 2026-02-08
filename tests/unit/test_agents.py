"""Tests for agent implementations."""

import pytest
from unittest.mock import AsyncMock, patch

from src.agents import IngestAgent, AnalyzeAgent, SynthesizeAgent, CorrectionAgent
from src.models import Task, TaskType, TaskStatus


class TestIngestAgent:
    @pytest.mark.asyncio
    async def test_execute_with_no_papers(self, mock_gemini_client, mock_knowledge_graph, sample_task):
        agent = IngestAgent(
            gemini_client=mock_gemini_client,
            knowledge_graph=mock_knowledge_graph,
        )

        # Mock the HTTP client to return no papers
        with patch.object(agent, '_fetch_papers', new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = []

            result = await agent.execute(sample_task)

            assert result.success is True
            assert result.data.get("papers_ingested") == 0
            assert result.data.get("message") == "No new papers found"

    @pytest.mark.asyncio
    async def test_execute_creates_thought_signature_with_papers(self, mock_gemini_client, mock_knowledge_graph, sample_task, sample_paper):
        agent = IngestAgent(
            gemini_client=mock_gemini_client,
            knowledge_graph=mock_knowledge_graph,
        )

        # Mock the HTTP client to return papers
        with patch.object(agent, '_fetch_papers', new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = [sample_paper]

            result = await agent.execute(sample_task)

            assert result.success is True
            assert result.thought_signature is not None
            assert result.thought_signature.agent_name == "ingest"
            assert result.data.get("papers_ingested") == 1

    @pytest.mark.asyncio
    async def test_execute_handles_error(self, mock_gemini_client, mock_knowledge_graph, sample_task):
        agent = IngestAgent(
            gemini_client=mock_gemini_client,
            knowledge_graph=mock_knowledge_graph,
        )

        # Mock to raise an error
        with patch.object(agent, '_fetch_papers', new_callable=AsyncMock) as mock_fetch:
            mock_fetch.side_effect = Exception("Test error")

            result = await agent.execute(sample_task)

            assert result.success is False
            assert result.error is not None
            assert "Test error" in result.error


class TestAnalyzeAgent:
    @pytest.mark.asyncio
    async def test_execute_with_no_papers(self, mock_gemini_client, mock_knowledge_graph):
        agent = AnalyzeAgent(
            gemini_client=mock_gemini_client,
            knowledge_graph=mock_knowledge_graph,
        )

        task = Task(
            type=TaskType.ANALYZE,
            payload={"batch_size": 10},
        )

        result = await agent.execute(task)

        assert result.success is True
        assert result.data.get("message") == "No papers to analyze"

    @pytest.mark.asyncio
    async def test_execute_analyzes_papers(self, mock_gemini_client, mock_knowledge_graph, sample_paper):
        agent = AnalyzeAgent(
            gemini_client=mock_gemini_client,
            knowledge_graph=mock_knowledge_graph,
        )

        # Set up mock to return sample paper
        mock_knowledge_graph.get_unanalyzed_papers.return_value = [sample_paper]

        task = Task(
            type=TaskType.ANALYZE,
            payload={"batch_size": 10},
        )

        result = await agent.execute(task)

        assert result.success is True
        assert result.data.get("papers_analyzed") == 1
        mock_knowledge_graph.add_claim.assert_called()
        mock_knowledge_graph.mark_paper_analyzed.assert_called_once()


class TestSynthesizeAgent:
    @pytest.mark.asyncio
    async def test_execute_generates_report(self, mock_gemini_client, mock_knowledge_graph):
        agent = SynthesizeAgent(
            gemini_client=mock_gemini_client,
            knowledge_graph=mock_knowledge_graph,
        )

        task = Task(
            type=TaskType.SYNTHESIZE,
            payload={},
        )

        result = await agent.execute(task)

        assert result.success is True
        assert "report" in result.data
        mock_gemini_client.synthesize_weekly.assert_called_once()

    @pytest.mark.asyncio
    async def test_format_report_markdown(self, mock_gemini_client, mock_knowledge_graph):
        agent = SynthesizeAgent(
            gemini_client=mock_gemini_client,
            knowledge_graph=mock_knowledge_graph,
        )

        from src.models import WeeklyReport
        from datetime import date

        report = WeeklyReport(
            week_start=date(2024, 1, 1),
            week_end=date(2024, 1, 7),
            executive_summary="Test summary",
            key_developments=["Development 1"],
            emerging_trends=[{"theme": "Test", "evidence": "Evidence"}],
            papers_analyzed=10,
            claims_extracted=50,
        )

        markdown = await agent.format_report_markdown(report)

        assert "# Weekly Research Synthesis Report" in markdown
        assert "Test summary" in markdown
        assert "Development 1" in markdown


class TestCorrectionAgent:
    @pytest.mark.asyncio
    async def test_execute_analyzes_error(self, mock_gemini_client, mock_knowledge_graph):
        agent = CorrectionAgent(
            gemini_client=mock_gemini_client,
            knowledge_graph=mock_knowledge_graph,
        )

        task = Task(
            type=TaskType.CORRECT,
            payload={
                "error": "Test error message",
                "failed_task_id": "task-123",
                "failed_task_type": "ingest",
                "context": {},
            },
        )

        result = await agent.execute(task)

        assert result.success is True
        assert "error_type" in result.data
        assert "action" in result.data
        mock_gemini_client.analyze_error.assert_called_once()

    @pytest.mark.asyncio
    async def test_apply_modifications(self, mock_gemini_client, mock_knowledge_graph):
        agent = CorrectionAgent(
            gemini_client=mock_gemini_client,
            knowledge_graph=mock_knowledge_graph,
        )

        context = {"batch_size": 10, "timeout": 30}
        modifications = ["reduce batch size", "increase timeout"]

        result = agent._apply_modifications(context, modifications)

        assert result["batch_size"] == 5  # Reduced
        assert result["timeout"] == 60  # Increased
