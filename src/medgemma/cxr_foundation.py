"""CXR Foundation client — chest X-ray classification and embeddings.

Wraps the Modal-hosted CXR Foundation model (google/cxr-foundation).
Provides zero-shot classification for 13+ chest X-ray conditions and
image embeddings for similarity search.
"""

from typing import Any

import aiohttp
import structlog

from src.config import settings

logger = structlog.get_logger()

DEFAULT_CONDITIONS = [
    "pneumothorax",
    "pleural effusion",
    "cardiomegaly",
    "consolidation",
    "atelectasis",
    "pneumonia",
    "pulmonary edema",
    "lung opacity",
    "rib fracture",
    "enlarged cardiac silhouette",
    "mediastinal widening",
    "nodule",
    "mass",
]


class CXRFoundationClient:
    """Client for CXR Foundation chest X-ray analysis."""

    def __init__(self):
        self._modal_url = getattr(settings, "cxr_foundation_modal_url", "") or ""
        if self._modal_url:
            logger.info("CXR Foundation client configured", modal_url=self._modal_url)
        else:
            logger.warning("CXR Foundation: no Modal URL configured")

    async def classify_zero_shot(
        self,
        image_b64: str,
        conditions: list[str] | None = None,
    ) -> dict[str, Any]:
        """Zero-shot classification of chest X-ray conditions.

        Args:
            image_b64: Base64-encoded chest X-ray image
            conditions: List of conditions to classify (defaults to 13 standard CXR findings)

        Returns:
            Dict with classifications list, each having condition + probability
        """
        if not self._modal_url:
            return self._unavailable_response("classify")

        try:
            timeout = aiohttp.ClientTimeout(total=60)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{self._modal_url}/classify",
                    json={
                        "image_b64": image_b64,
                        "conditions": conditions or DEFAULT_CONDITIONS,
                    },
                ) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        logger.error("CXR classify failed", status=resp.status, body=body[:200])
                        return self._unavailable_response("classify")

                    return await resp.json()

        except Exception as e:
            logger.error("CXR Foundation classify call failed", error=str(e))
            return self._unavailable_response("classify")

    async def get_embedding(self, image_b64: str) -> dict[str, Any]:
        """Get image embedding for similarity search.

        Args:
            image_b64: Base64-encoded chest X-ray image

        Returns:
            Dict with embedding vector and metadata
        """
        if not self._modal_url:
            return self._unavailable_response("embed")

        try:
            timeout = aiohttp.ClientTimeout(total=60)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{self._modal_url}/embed",
                    json={"image_b64": image_b64},
                ) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        logger.error("CXR embed failed", status=resp.status, body=body[:200])
                        return self._unavailable_response("embed")

                    return await resp.json()

        except Exception as e:
            logger.error("CXR Foundation embed call failed", error=str(e))
            return self._unavailable_response("embed")

    def _unavailable_response(self, endpoint: str) -> dict[str, Any]:
        return {
            "error": f"CXR Foundation not available ({endpoint})",
            "model": "cxr-foundation",
            "available": False,
        }

    @property
    def is_available(self) -> bool:
        return bool(self._modal_url)


# Singleton
_cxr_client: CXRFoundationClient | None = None


def get_cxr_foundation_client() -> CXRFoundationClient:
    global _cxr_client
    if _cxr_client is None:
        _cxr_client = CXRFoundationClient()
    return _cxr_client
