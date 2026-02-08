"""Rate limiter for Gemini API calls."""

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any

import structlog

logger = structlog.get_logger()


@dataclass
class RateLimiterState:
    """State for rate limiting."""

    requests: list[float] = field(default_factory=list)
    tokens: list[tuple[float, int]] = field(default_factory=list)


class RateLimiter:
    """Token bucket rate limiter for API calls."""

    def __init__(
        self,
        requests_per_minute: int = 60,
        tokens_per_minute: int = 1_000_000,
    ):
        self.requests_per_minute = requests_per_minute
        self.tokens_per_minute = tokens_per_minute
        self.state = RateLimiterState()
        self._lock = asyncio.Lock()

    def _cleanup_old_entries(self, current_time: float) -> None:
        """Remove entries older than 1 minute."""
        cutoff = current_time - 60

        # Cleanup requests
        self.state.requests = [t for t in self.state.requests if t > cutoff]

        # Cleanup tokens
        self.state.tokens = [(t, n) for t, n in self.state.tokens if t > cutoff]

    def _current_request_count(self) -> int:
        """Get current request count in the window."""
        return len(self.state.requests)

    def _current_token_count(self) -> int:
        """Get current token count in the window."""
        return sum(n for _, n in self.state.tokens)

    async def acquire(self, estimated_tokens: int = 1000) -> float:
        """
        Acquire permission to make an API call.

        Args:
            estimated_tokens: Estimated tokens for this request.

        Returns:
            Wait time in seconds before the request can proceed.
        """
        async with self._lock:
            current_time = time.time()
            self._cleanup_old_entries(current_time)

            wait_time = 0.0

            # Check request limit
            if self._current_request_count() >= self.requests_per_minute:
                # Find when the oldest request expires
                oldest = min(self.state.requests)
                wait_time = max(wait_time, oldest + 60 - current_time)

            # Check token limit
            if self._current_token_count() + estimated_tokens > self.tokens_per_minute:
                # Find when enough tokens will be available
                tokens_needed = (
                    self._current_token_count()
                    + estimated_tokens
                    - self.tokens_per_minute
                )
                tokens_freed = 0
                for timestamp, count in sorted(self.state.tokens):
                    tokens_freed += count
                    if tokens_freed >= tokens_needed:
                        wait_time = max(wait_time, timestamp + 60 - current_time)
                        break

            if wait_time > 0:
                logger.info(
                    "Rate limit reached, waiting",
                    wait_time=wait_time,
                    requests=self._current_request_count(),
                    tokens=self._current_token_count(),
                )
                await asyncio.sleep(wait_time)
                current_time = time.time()
                self._cleanup_old_entries(current_time)

            # Record this request
            self.state.requests.append(current_time)
            self.state.tokens.append((current_time, estimated_tokens))

            return wait_time

    async def record_actual_tokens(self, estimated: int, actual: int) -> None:
        """Update token count with actual usage."""
        async with self._lock:
            current_time = time.time()
            # Find and update the most recent entry with matching estimate
            for i in range(len(self.state.tokens) - 1, -1, -1):
                timestamp, count = self.state.tokens[i]
                if count == estimated:
                    self.state.tokens[i] = (timestamp, actual)
                    break

    def get_stats(self) -> dict[str, Any]:
        """Get current rate limiter statistics."""
        current_time = time.time()
        self._cleanup_old_entries(current_time)
        return {
            "requests_used": self._current_request_count(),
            "requests_limit": self.requests_per_minute,
            "tokens_used": self._current_token_count(),
            "tokens_limit": self.tokens_per_minute,
            "requests_available": self.requests_per_minute - self._current_request_count(),
            "tokens_available": self.tokens_per_minute - self._current_token_count(),
        }
