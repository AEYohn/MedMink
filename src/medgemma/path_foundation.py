"""Path Foundation client — digital pathology classification and embeddings.

Wraps the Modal-hosted Path Foundation model.
Provides tissue classification, tumor grading, and similar-slide retrieval
via tile-based processing for large pathology images.
"""

from typing import Any

import aiohttp
import structlog

from src.config import settings

logger = structlog.get_logger()


class PathFoundationClient:
    """Client for Path Foundation digital pathology analysis."""

    def __init__(self):
        self._modal_url = getattr(settings, "path_foundation_modal_url", "") or ""
        if self._modal_url:
            logger.info("Path Foundation client configured", modal_url=self._modal_url)
        else:
            logger.warning("Path Foundation: no Modal URL configured")

    async def classify_tissue(self, image_b64: str, tile_size: int = 224) -> dict[str, Any]:
        """Classify tissue types in a pathology image.

        Processes the image as 224x224 tiles and aggregates classifications.

        Args:
            image_b64: Base64-encoded pathology image
            tile_size: Size of tiles for patch extraction

        Returns:
            Classification results with tissue type probabilities and tumor grade
        """
        if not self._modal_url:
            return self._unavailable("classify")

        try:
            timeout = aiohttp.ClientTimeout(total=120)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{self._modal_url}/classify",
                    json={"image_b64": image_b64, "tile_size": tile_size},
                ) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        logger.error("Path classify failed", status=resp.status, body=body[:200])
                        return self._unavailable("classify")
                    return await resp.json()

        except Exception as e:
            logger.error("Path Foundation classify failed", error=str(e))
            return self._unavailable("classify")

    async def get_embedding(self, image_b64: str) -> dict[str, Any]:
        """Get pathology image embedding (averaged across tiles).

        Args:
            image_b64: Base64-encoded pathology image

        Returns:
            Embedding vector and metadata
        """
        if not self._modal_url:
            return self._unavailable("embed")

        try:
            timeout = aiohttp.ClientTimeout(total=120)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{self._modal_url}/embed",
                    json={"image_b64": image_b64},
                ) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        logger.error("Path embed failed", status=resp.status, body=body[:200])
                        return self._unavailable("embed")
                    return await resp.json()

        except Exception as e:
            logger.error("Path Foundation embed failed", error=str(e))
            return self._unavailable("embed")

    async def find_similar(self, embedding: list[float]) -> dict[str, Any]:
        """Find similar pathology images by embedding. Placeholder for future vector DB integration."""
        return {
            "similar_images": [],
            "note": "Similarity search requires vector database integration",
            "model": "path-foundation",
        }

    def _unavailable(self, endpoint: str) -> dict[str, Any]:
        return {
            "error": f"Path Foundation not available ({endpoint})",
            "model": "path-foundation",
            "available": False,
        }

    @property
    def is_available(self) -> bool:
        return bool(self._modal_url)


# Singleton
_path_client: PathFoundationClient | None = None


def get_path_foundation_client() -> PathFoundationClient:
    global _path_client
    if _path_client is None:
        _path_client = PathFoundationClient()
    return _path_client
