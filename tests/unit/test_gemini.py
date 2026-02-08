"""Tests for Gemini client."""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from src.gemini.rate_limiter import RateLimiter
from src.gemini.client import CostTracker, GeminiClient


class TestRateLimiter:
    @pytest.mark.asyncio
    async def test_acquire_under_limit(self):
        limiter = RateLimiter(requests_per_minute=60, tokens_per_minute=1000000)

        wait_time = await limiter.acquire(1000)

        assert wait_time == 0
        assert limiter._current_request_count() == 1

    @pytest.mark.asyncio
    async def test_get_stats(self):
        limiter = RateLimiter(requests_per_minute=60, tokens_per_minute=1000000)
        await limiter.acquire(5000)

        stats = limiter.get_stats()

        assert stats["requests_used"] == 1
        assert stats["requests_limit"] == 60
        assert stats["tokens_used"] == 5000


class TestCostTracker:
    @pytest.mark.asyncio
    async def test_record_usage(self):
        tracker = CostTracker(daily_budget=10.0, monthly_budget=200.0)

        usage = await tracker.record_usage(
            input_tokens=1000,
            output_tokens=500,
            operation="test",
        )

        assert usage["input_tokens"] == 1000
        assert usage["output_tokens"] == 500
        assert usage["cost_usd"] > 0

    @pytest.mark.asyncio
    async def test_check_budget_within_limits(self):
        tracker = CostTracker(daily_budget=10.0, monthly_budget=200.0)

        within_budget, error = tracker.check_budget()

        assert within_budget is True
        assert error is None

    def test_get_stats(self):
        tracker = CostTracker(daily_budget=10.0, monthly_budget=200.0)

        stats = tracker.get_stats()

        assert stats["daily_budget"] == 10.0
        assert stats["monthly_budget"] == 200.0


class TestGeminiClient:
    def test_estimate_tokens(self):
        with patch('google.generativeai.configure'):
            with patch('google.generativeai.GenerativeModel'):
                client = GeminiClient(api_key="test-key")

        # Test token estimation (roughly 4 chars per token)
        text = "Hello, this is a test string for token estimation."
        estimated = client._estimate_tokens(text)

        assert estimated > 0
        assert estimated == len(text) // 4

    def test_get_stats(self):
        with patch('google.generativeai.configure'):
            with patch('google.generativeai.GenerativeModel'):
                client = GeminiClient(api_key="test-key")

        stats = client.get_stats()

        assert "rate_limiter" in stats
        assert "cost_tracker" in stats
        assert "model" in stats
