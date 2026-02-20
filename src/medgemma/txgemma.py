"""TxGemma client — drug property prediction.

Wraps the Modal-hosted TxGemma-9B-chat model (google/txgemma-9b-chat).
Provides drug-drug interaction prediction, toxicity profiling, and
pharmacological property prediction using natural language drug names.
"""

from typing import Any

import aiohttp
import structlog

from src.config import settings

logger = structlog.get_logger()


class TxGemmaClient:
    """Client for TxGemma drug property prediction."""

    def __init__(self):
        self._modal_url = getattr(settings, "txgemma_modal_url", "") or ""
        if self._modal_url:
            logger.info("TxGemma client configured", modal_url=self._modal_url)
        else:
            logger.warning("TxGemma: no Modal URL configured")

    async def predict_interaction(self, drug_a: str, drug_b: str) -> dict[str, Any]:
        """Predict drug-drug interaction.

        Args:
            drug_a: First drug name
            drug_b: Second drug name

        Returns:
            Interaction prediction with severity, mechanism, recommendation
        """
        if not self._modal_url:
            return self._unavailable("interaction")

        try:
            timeout = aiohttp.ClientTimeout(total=120)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{self._modal_url}/predict-interaction",
                    json={"drug_a": drug_a, "drug_b": drug_b},
                ) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        logger.error(
                            "TxGemma interaction failed", status=resp.status, body=body[:200]
                        )
                        return self._unavailable("interaction")
                    return await resp.json()

        except Exception as e:
            logger.error("TxGemma interaction call failed", error=str(e))
            return self._unavailable("interaction")

    async def predict_toxicity(self, drug: str) -> dict[str, Any]:
        """Predict toxicity profile for a drug.

        Args:
            drug: Drug name

        Returns:
            Toxicity profile with organ-specific risks and monitoring requirements
        """
        if not self._modal_url:
            return self._unavailable("toxicity")

        try:
            timeout = aiohttp.ClientTimeout(total=120)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{self._modal_url}/predict-toxicity",
                    json={"drug": drug},
                ) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        logger.error("TxGemma toxicity failed", status=resp.status, body=body[:200])
                        return self._unavailable("toxicity")
                    return await resp.json()

        except Exception as e:
            logger.error("TxGemma toxicity call failed", error=str(e))
            return self._unavailable("toxicity")

    async def predict_properties(self, drug: str) -> dict[str, Any]:
        """Predict therapeutic properties of a drug.

        Args:
            drug: Drug name

        Returns:
            Pharmacological properties including mechanism, targets, metabolism
        """
        if not self._modal_url:
            return self._unavailable("properties")

        try:
            timeout = aiohttp.ClientTimeout(total=120)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{self._modal_url}/predict-properties",
                    json={"drug": drug},
                ) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        logger.error(
                            "TxGemma properties failed", status=resp.status, body=body[:200]
                        )
                        return self._unavailable("properties")
                    return await resp.json()

        except Exception as e:
            logger.error("TxGemma properties call failed", error=str(e))
            return self._unavailable("properties")

    def _unavailable(self, endpoint: str) -> dict[str, Any]:
        return {
            "error": f"TxGemma not available ({endpoint})",
            "model": "txgemma-9b-chat",
            "available": False,
        }

    @property
    def is_available(self) -> bool:
        return bool(self._modal_url)


# Singleton
_txgemma_client: TxGemmaClient | None = None


def get_txgemma_client() -> TxGemmaClient:
    global _txgemma_client
    if _txgemma_client is None:
        _txgemma_client = TxGemmaClient()
    return _txgemma_client
