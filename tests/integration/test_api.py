"""Integration tests for the API endpoints."""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock

from fastapi.testclient import TestClient


@pytest.fixture
def mock_task_queue():
    """Create a mock task queue."""
    queue = MagicMock()
    queue.add = AsyncMock()
    queue.get_stats = AsyncMock(return_value={
        "pending": 5,
        "in_progress": 2,
        "completed": 100,
        "failed": 3,
    })
    return queue


@pytest.fixture
def client(mock_knowledge_graph, mock_task_queue):
    """Create a test client with mocked dependencies."""
    # Mock database connections
    with patch('src.api.main.init_databases', new_callable=AsyncMock):
        with patch('src.api.main.close_databases', new_callable=AsyncMock):
            with patch('src.api.main.get_knowledge_graph', new_callable=AsyncMock):
                from src.api.main import app
                from src.api import deps

                # Override dependencies
                app.dependency_overrides[deps.get_kg] = lambda: mock_knowledge_graph
                app.dependency_overrides[deps.get_task_queue] = lambda: mock_task_queue

                yield TestClient(app)

                # Clean up overrides
                app.dependency_overrides.clear()


class TestHealthEndpoints:
    def test_root_endpoint(self, client):
        response = client.get("/")

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Research Synthesizer API"

    def test_health_endpoint(self, client):
        with patch('src.api.main.health_check', new_callable=AsyncMock) as mock_health:
            mock_health.return_value = {
                "healthy": True,
                "postgres": True,
                "neo4j": True,
                "redis": True,
            }

            response = client.get("/health")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"


class TestGraphEndpoints:
    def test_get_stats(self, client):
        response = client.get("/api/graph/stats")

        assert response.status_code == 200
        data = response.json()
        assert "papers" in data
        assert "claims" in data

    def test_get_papers(self, client):
        response = client.get("/api/graph/papers?limit=10")

        assert response.status_code == 200

    def test_get_trends(self, client):
        response = client.get("/api/graph/trends?limit=10")

        assert response.status_code == 200

    def test_get_predictions(self, client):
        response = client.get("/api/graph/predictions")

        assert response.status_code == 200


class TestTaskEndpoints:
    def test_trigger_ingest(self, client):
        response = client.post(
            "/api/tasks/ingest",
            json={"topic": "machine learning", "max_results": 10},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "ingest"

    def test_trigger_analyze(self, client):
        response = client.post(
            "/api/tasks/analyze",
            json={"batch_size": 5},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "analyze"

    def test_trigger_synthesize(self, client):
        response = client.post("/api/tasks/synthesize")

        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "synthesize"
