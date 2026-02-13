"""Derm Foundation client — skin lesion classification and embeddings.

Wraps the Modal-hosted Derm Foundation model (google/derm-foundation).
Provides melanoma vs benign triage, urgency classification for
dermatology referral with 6,144-dim embeddings.
"""

from typing import Any

import aiohttp
import structlog

from src.config import settings

logger = structlog.get_logger()


class DermFoundationClient:
    """Client for Derm Foundation skin lesion analysis."""

    def __init__(self):
        self._modal_url = getattr(settings, "derm_foundation_modal_url", "") or ""
        if self._modal_url:
            logger.info("Derm Foundation client configured", modal_url=self._modal_url)
        else:
            logger.warning("Derm Foundation: no Modal URL configured")

    async def classify(self, image_b64: str) -> dict[str, Any]:
        """Classify skin lesion and provide risk assessment.

        Args:
            image_b64: Base64-encoded dermoscopy image

        Returns:
            Classification results with condition probabilities and risk level
        """
        if not self._modal_url:
            return self._unavailable("classify")

        try:
            timeout = aiohttp.ClientTimeout(total=60)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{self._modal_url}/classify",
                    json={"image_b64": image_b64},
                ) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        logger.error("Derm classify failed", status=resp.status, body=body[:200])
                        return self._unavailable("classify")
                    return await resp.json()

        except Exception as e:
            logger.error("Derm Foundation classify failed", error=str(e))
            return self._unavailable("classify")

    async def get_embedding(self, image_b64: str) -> dict[str, Any]:
        """Get 6,144-dim embedding for similarity search.

        Args:
            image_b64: Base64-encoded dermoscopy image

        Returns:
            Embedding vector and metadata
        """
        if not self._modal_url:
            return self._unavailable("embed")

        try:
            timeout = aiohttp.ClientTimeout(total=60)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{self._modal_url}/embed",
                    json={"image_b64": image_b64},
                ) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        logger.error("Derm embed failed", status=resp.status, body=body[:200])
                        return self._unavailable("embed")
                    return await resp.json()

        except Exception as e:
            logger.error("Derm Foundation embed failed", error=str(e))
            return self._unavailable("embed")

    def _unavailable(self, endpoint: str) -> dict[str, Any]:
        return {
            "error": f"Derm Foundation not available ({endpoint})",
            "model": "derm-foundation",
            "available": False,
        }

    @property
    def is_available(self) -> bool:
        return bool(self._modal_url)


# Singleton
_derm_client: DermFoundationClient | None = None


def get_derm_foundation_client() -> DermFoundationClient:
    global _derm_client
    if _derm_client is None:
        _derm_client = DermFoundationClient()
    return _derm_client
