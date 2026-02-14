"""Analysis caching to avoid redundant API calls.

Research-backed optimization from "Trajectory Recycling" technique:
"Reusing trajectories from previous trials to avoid redundant computation"
"""

import hashlib
from datetime import datetime, timedelta
from typing import Any

import structlog

from src.config import settings

logger = structlog.get_logger()


class AnalysisCache:
    """Cache for paper analysis results to reduce API calls.

    Uses a simple in-memory cache with optional Redis backing.
    Implements similarity-based cache lookup to reuse results for similar papers.
    """

    def __init__(self):
        self._cache: dict[str, dict[str, Any]] = {}
        self._embeddings_cache: dict[str, list[float]] = {}
        self._enabled = settings.enable_analysis_cache
        self._similarity_threshold = settings.cache_similarity_threshold
        self._ttl_hours = settings.cache_ttl_hours

    def _compute_content_hash(self, title: str, abstract: str) -> str:
        """Compute a hash for paper content."""
        content = f"{title.lower().strip()}|{abstract.lower().strip()}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def _compute_similarity_key(self, title: str, abstract: str) -> str:
        """Compute a simplified key for similarity matching.

        Uses first 100 chars of abstract + title words for quick matching.
        """
        title_words = set(title.lower().split()[:10])
        abstract_start = abstract.lower()[:200] if abstract else ""
        return f"{sorted(title_words)}|{abstract_start}"

    def _is_expired(self, cached_at: str) -> bool:
        """Check if cache entry is expired."""
        cached_time = datetime.fromisoformat(cached_at)
        return datetime.utcnow() - cached_time > timedelta(hours=self._ttl_hours)

    async def get(self, title: str, abstract: str) -> dict[str, Any] | None:
        """Get cached analysis result if available.

        Returns None if not cached or cache is disabled.
        """
        if not self._enabled:
            return None

        content_hash = self._compute_content_hash(title, abstract)

        # Exact match
        if content_hash in self._cache:
            entry = self._cache[content_hash]
            if not self._is_expired(entry["cached_at"]):
                logger.debug(
                    "Cache hit (exact)",
                    hash=content_hash,
                    title=title[:50],
                )
                return entry["analysis"]
            else:
                # Remove expired entry
                del self._cache[content_hash]

        return None

    async def get_similar(
        self, title: str, abstract: str
    ) -> tuple[dict[str, Any] | None, float]:
        """Get cached analysis for a similar paper.

        Returns (analysis, similarity_score) or (None, 0.0) if not found.
        Uses simplified text similarity for speed.
        """
        if not self._enabled or not self._cache:
            return None, 0.0

        # Simple word overlap similarity
        query_words = set(title.lower().split()) | set(abstract.lower().split()[:50])

        best_match = None
        best_score = 0.0

        for _content_hash, entry in self._cache.items():
            if self._is_expired(entry["cached_at"]):
                continue

            cached_words = entry.get("content_words", set())
            if not cached_words:
                continue

            # Jaccard similarity
            intersection = len(query_words & cached_words)
            union = len(query_words | cached_words)
            similarity = intersection / union if union > 0 else 0.0

            if similarity > best_score and similarity >= self._similarity_threshold:
                best_score = similarity
                best_match = entry["analysis"]

        if best_match:
            logger.debug(
                "Cache hit (similar)",
                similarity=f"{best_score:.2%}",
                title=title[:50],
            )

        return best_match, best_score

    async def set(
        self,
        title: str,
        abstract: str,
        analysis: dict[str, Any],
    ) -> None:
        """Cache analysis result."""
        if not self._enabled:
            return

        content_hash = self._compute_content_hash(title, abstract)
        content_words = set(title.lower().split()) | set(abstract.lower().split()[:50])

        self._cache[content_hash] = {
            "analysis": analysis,
            "cached_at": datetime.utcnow().isoformat(),
            "content_words": content_words,
            "title_preview": title[:100],
        }

        logger.debug(
            "Analysis cached",
            hash=content_hash,
            title=title[:50],
            cache_size=len(self._cache),
        )

        # Cleanup old entries if cache is getting large
        if len(self._cache) > 1000:
            await self._cleanup()

    async def _cleanup(self) -> None:
        """Remove expired entries from cache."""
        expired = [
            k for k, v in self._cache.items()
            if self._is_expired(v["cached_at"])
        ]
        for k in expired:
            del self._cache[k]

        logger.info("Cache cleanup", removed=len(expired), remaining=len(self._cache))

    def get_stats(self) -> dict[str, Any]:
        """Get cache statistics."""
        valid_entries = sum(
            1 for v in self._cache.values()
            if not self._is_expired(v["cached_at"])
        )
        return {
            "enabled": self._enabled,
            "total_entries": len(self._cache),
            "valid_entries": valid_entries,
            "similarity_threshold": self._similarity_threshold,
            "ttl_hours": self._ttl_hours,
        }

    async def clear(self) -> int:
        """Clear all cache entries. Returns count of cleared entries."""
        count = len(self._cache)
        self._cache.clear()
        self._embeddings_cache.clear()
        logger.info("Cache cleared", entries_cleared=count)
        return count


# Singleton instance
_cache: AnalysisCache | None = None


def get_analysis_cache() -> AnalysisCache:
    """Get or create the analysis cache singleton."""
    global _cache
    if _cache is None:
        _cache = AnalysisCache()
    return _cache
