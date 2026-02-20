"""HeAR client — respiratory sound screening.

Wraps the Modal-hosted HeAR model (google/hear-pytorch).
Detects TB, COVID-19, COPD, asthma from cough/breathing recordings (>91% accuracy).
Trained on 300M+ audio clips.
"""

from pathlib import Path
from typing import Any

import aiohttp
import structlog

from src.config import settings

logger = structlog.get_logger()


class HeARClient:
    """Client for HeAR respiratory sound analysis."""

    def __init__(self):
        self._modal_url = getattr(settings, "hear_modal_url", "") or ""
        if self._modal_url:
            logger.info("HeAR client configured", modal_url=self._modal_url)
        else:
            logger.warning("HeAR: no Modal URL configured")

    async def classify_respiratory(self, audio_path: str) -> dict[str, Any]:
        """Classify respiratory audio for conditions.

        Args:
            audio_path: Path to audio file (cough/breathing recording)

        Returns:
            Classification results with condition probabilities and risk level
        """
        if not self._modal_url:
            return self._unavailable("classify")

        audio_file = Path(audio_path)
        if not audio_file.exists():
            return {"error": f"Audio file not found: {audio_path}", "available": False}

        try:
            timeout = aiohttp.ClientTimeout(total=60)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                form = aiohttp.FormData()
                form.add_field(
                    "audio",
                    open(audio_path, "rb"),
                    filename=audio_file.name,
                    content_type="audio/wav",
                )

                async with session.post(f"{self._modal_url}/classify", data=form) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        logger.error("HeAR classify failed", status=resp.status, body=body[:200])
                        return self._unavailable("classify")
                    return await resp.json()

        except Exception as e:
            logger.error("HeAR classify call failed", error=str(e))
            return self._unavailable("classify")

    async def get_embedding(self, audio_path: str) -> dict[str, Any]:
        """Get audio embedding for similarity search.

        Args:
            audio_path: Path to audio file

        Returns:
            Embedding vector and metadata
        """
        if not self._modal_url:
            return self._unavailable("embed")

        audio_file = Path(audio_path)
        if not audio_file.exists():
            return {"error": f"Audio file not found: {audio_path}", "available": False}

        try:
            timeout = aiohttp.ClientTimeout(total=60)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                form = aiohttp.FormData()
                form.add_field(
                    "audio",
                    open(audio_path, "rb"),
                    filename=audio_file.name,
                    content_type="audio/wav",
                )

                async with session.post(f"{self._modal_url}/embed", data=form) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        logger.error("HeAR embed failed", status=resp.status, body=body[:200])
                        return self._unavailable("embed")
                    return await resp.json()

        except Exception as e:
            logger.error("HeAR embed call failed", error=str(e))
            return self._unavailable("embed")

    def _unavailable(self, endpoint: str) -> dict[str, Any]:
        return {
            "error": f"HeAR not available ({endpoint})",
            "model": "hear-pytorch",
            "available": False,
        }

    @property
    def is_available(self) -> bool:
        return bool(self._modal_url)


# Singleton
_hear_client: HeARClient | None = None


def get_hear_client() -> HeARClient:
    global _hear_client
    if _hear_client is None:
        _hear_client = HeARClient()
    return _hear_client
