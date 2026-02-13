"""MedASR - Medical Speech Recognition for HAI-DEF.

Primary: Google MedASR Conformer (105M params, 4.6% WER on radiology dictation)
Fallback: OpenAI Whisper large-v3

The Modal deployment (modal_asr.py) handles GPU inference. This client
can also load models locally for development.
"""

import asyncio
from pathlib import Path
from typing import Any

import structlog

from src.config import settings

logger = structlog.get_logger()


# Abbreviated corrections — MedASR handles most medical vocab natively.
# Only abbreviation expansions needed (spoken letters → acronym).
ABBREVIATION_CORRECTIONS = {
    "HIV": ["h i v", "h.i.v."],
    "AIDS": ["a i d s"],
    "COPD": ["c o p d", "c.o.p.d."],
    "CHF": ["c h f", "c.h.f."],
    "MI": ["m i", "m.i."],
    "CVA": ["c v a", "c.v.a."],
    "DVT": ["d v t", "d.v.t."],
    "PE": ["p e", "p.e."],
}


class MedASRClient:
    """Medical speech recognition client.

    Routes to Modal-hosted MedASR Conformer when configured.
    Falls back to local Whisper if Modal URL not set.
    """

    def __init__(self):
        self._model = None
        self._processor = None
        self._initialized = False
        self._using_whisper_fallback = False
        self._modal_url = getattr(settings, "medasr_modal_url", "") or ""

        # Fall back to the legacy Whisper Modal URL
        if not self._modal_url:
            self._modal_url = getattr(settings, "whisper_modal_url", "") or ""
            if self._modal_url:
                self._using_whisper_fallback = True
                logger.info("MedASR client using Whisper Modal endpoint (MedASR URL not configured)")

        if self._modal_url:
            logger.info("MedASR client configured (Modal remote)", modal_url=self._modal_url)

    def _ensure_initialized(self):
        """Lazily initialize a local model (only if no Modal URL)."""
        if self._initialized or self._modal_url:
            return

        try:
            import torch
            from transformers import AutoFeatureExtractor, AutoModelForCTC

            logger.info("Loading MedASR Conformer locally...")
            model_id = getattr(settings, "medasr_model", "google/medasr")

            self._processor = AutoFeatureExtractor.from_pretrained(
                model_id, trust_remote_code=True
            )
            self._model = AutoModelForCTC.from_pretrained(
                model_id, trust_remote_code=True
            )

            # Device selection
            if torch.cuda.is_available():
                self._model = self._model.to("cuda")
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                self._model = self._model.to("mps")

            self._model.eval()
            logger.info("MedASR Conformer loaded locally")
            self._initialized = True

        except Exception as e:
            logger.warning("MedASR not available locally, trying Whisper", error=str(e))
            self._load_whisper_fallback()

    def _load_whisper_fallback(self):
        """Load OpenAI Whisper as fallback."""
        try:
            import torch
            from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor

            logger.info("Loading Whisper for speech recognition")

            if torch.cuda.is_available():
                device = "cuda"
                dtype = torch.float16
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                device = "mps"
                dtype = torch.float32
            else:
                device = "cpu"
                dtype = torch.float32

            model_id = "openai/whisper-large-v3"
            self._processor = AutoProcessor.from_pretrained(model_id)
            self._model = AutoModelForSpeechSeq2Seq.from_pretrained(
                model_id, torch_dtype=dtype, low_cpu_mem_usage=True
            ).to(device)

            self._using_whisper_fallback = True
            logger.info("Whisper loaded as fallback", model=model_id)
            self._initialized = True

        except Exception as e:
            logger.error("Failed to load Whisper fallback", error=str(e))
            self._initialized = True

    async def transcribe(
        self,
        audio_path: str,
        language: str = "en",
        apply_corrections: bool = True,
    ) -> dict[str, Any]:
        """Transcribe audio to text with medical terminology optimization.

        Routes to Modal MedASR endpoint if configured, otherwise uses local model.

        Args:
            audio_path: Path to audio file (wav, mp3, m4a, etc.)
            language: Language code (default: English)
            apply_corrections: Apply abbreviation corrections

        Returns:
            Transcription result with text, confidence, and segments
        """
        if self._modal_url:
            return await self._transcribe_via_modal(audio_path)

        result = await asyncio.to_thread(
            self._transcribe_sync,
            audio_path=audio_path,
            language=language,
            apply_corrections=apply_corrections,
        )
        return result

    async def _transcribe_via_modal(self, audio_path: str) -> dict[str, Any]:
        """Transcribe via Modal-hosted MedASR endpoint."""
        import aiohttp

        audio_file = Path(audio_path)
        if not audio_file.exists():
            return {"text": "", "error": f"Audio file not found: {audio_path}", "confidence": 0.0}

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
                async with session.post(f"{self._modal_url}/transcribe", data=form) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        logger.error("Modal ASR failed", status=resp.status, body=body[:200])
                        return {"text": "", "error": f"Modal ASR failed: {resp.status}", "confidence": 0.0}

                    result = await resp.json()
                    return {
                        "text": result.get("text", ""),
                        "language": result.get("language", "en"),
                        "audio_duration_seconds": result.get("duration", 0),
                        "model": result.get("model", "medasr-conformer"),
                        "confidence": 0.95 if result.get("model") == "medasr-conformer" else 0.85,
                    }
        except Exception as e:
            logger.error("Modal ASR call failed", error=str(e))
            return {"text": "", "error": str(e), "confidence": 0.0}

    def _transcribe_sync(
        self,
        audio_path: str,
        language: str,
        apply_corrections: bool,
    ) -> dict[str, Any]:
        """Synchronous local transcription."""
        self._ensure_initialized()

        if self._model is None:
            return {"text": "", "error": "Speech recognition not available", "confidence": 0.0}

        try:
            import torch
            import librosa

            audio_file = Path(audio_path)
            if not audio_file.exists():
                return {"text": "", "error": f"Audio file not found: {audio_path}", "confidence": 0.0}

            audio, sr = librosa.load(audio_path, sr=16000)

            if self._using_whisper_fallback:
                # Whisper-style generation
                inputs = self._processor(audio, sampling_rate=16000, return_tensors="pt")
                device = next(self._model.parameters()).device
                inputs = {k: v.to(device) for k, v in inputs.items()}

                with torch.no_grad():
                    generated_ids = self._model.generate(
                        **inputs, max_new_tokens=448, language=language, task="transcribe"
                    )

                transcription = self._processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
            else:
                # MedASR CTC-style decoding
                inputs = self._processor(audio, sampling_rate=16000, return_tensors="pt")
                device = next(self._model.parameters()).device
                inputs = {k: v.to(device) for k, v in inputs.items()}

                with torch.no_grad():
                    logits = self._model(**inputs).logits

                predicted_ids = torch.argmax(logits, dim=-1)
                transcription = self._processor.batch_decode(predicted_ids)[0]

            if apply_corrections:
                transcription = self._apply_corrections(transcription)

            return {
                "text": transcription.strip(),
                "language": language,
                "audio_duration_seconds": len(audio) / 16000,
                "model": "medasr-conformer" if not self._using_whisper_fallback else "whisper-large-v3",
                "confidence": 0.95 if not self._using_whisper_fallback else 0.85,
            }

        except ImportError as e:
            logger.error("Missing audio dependencies", error=str(e))
            return {"text": "", "error": "Install: pip install librosa soundfile", "confidence": 0.0}
        except Exception as e:
            logger.error("Transcription failed", error=str(e))
            return {"text": "", "error": str(e), "confidence": 0.0}

    def _apply_corrections(self, text: str) -> str:
        """Apply abbreviation corrections (MedASR handles drug/condition vocab natively)."""
        import re

        text_lower = text.lower()
        for correct_term, variants in ABBREVIATION_CORRECTIONS.items():
            for variant in variants:
                if variant in text_lower:
                    pattern = re.compile(re.escape(variant), re.IGNORECASE)
                    text = pattern.sub(correct_term, text)
                    text_lower = text.lower()
        return text

    async def transcribe_stream(
        self,
        audio_stream,
        chunk_duration_seconds: float = 5.0,
    ):
        """Stream transcription for real-time dictation.

        Args:
            audio_stream: Async iterator of audio chunks
            chunk_duration_seconds: Process audio in chunks of this duration

        Yields:
            Partial transcription results
        """
        self._ensure_initialized()

        if self._model is None:
            yield {
                "text": "",
                "error": "Speech recognition not available",
                "is_final": True,
            }
            return

        # Accumulate audio chunks
        accumulated_audio = []
        sample_rate = 16000
        chunk_samples = int(chunk_duration_seconds * sample_rate)

        try:
            import torch
            import numpy as np

            async for chunk in audio_stream:
                accumulated_audio.append(chunk)
                total_samples = sum(len(c) for c in accumulated_audio)

                # Process when we have enough audio
                if total_samples >= chunk_samples:
                    audio = np.concatenate(accumulated_audio)

                    # Process chunk
                    inputs = self._processor(
                        audio,
                        sampling_rate=sample_rate,
                        return_tensors="pt",
                    )

                    device = next(self._model.parameters()).device
                    inputs = {k: v.to(device) for k, v in inputs.items()}

                    with torch.no_grad():
                        generated_ids = self._model.generate(
                            **inputs,
                            max_new_tokens=128,
                            task="transcribe",
                        )

                    partial_text = self._processor.batch_decode(
                        generated_ids,
                        skip_special_tokens=True,
                    )[0]

                    partial_text = self._apply_medical_corrections(partial_text)

                    yield {
                        "text": partial_text.strip(),
                        "is_final": False,
                        "duration_processed": total_samples / sample_rate,
                    }

                    # Keep last 0.5s for context overlap
                    overlap_samples = int(0.5 * sample_rate)
                    accumulated_audio = [audio[-overlap_samples:]]

            # Process remaining audio
            if accumulated_audio:
                audio = np.concatenate(accumulated_audio)
                if len(audio) > sample_rate * 0.5:  # At least 0.5s
                    inputs = self._processor(
                        audio,
                        sampling_rate=sample_rate,
                        return_tensors="pt",
                    )

                    device = next(self._model.parameters()).device
                    inputs = {k: v.to(device) for k, v in inputs.items()}

                    with torch.no_grad():
                        generated_ids = self._model.generate(
                            **inputs,
                            max_new_tokens=128,
                            task="transcribe",
                        )

                    final_text = self._processor.batch_decode(
                        generated_ids,
                        skip_special_tokens=True,
                    )[0]

                    final_text = self._apply_medical_corrections(final_text)

                    yield {
                        "text": final_text.strip(),
                        "is_final": True,
                    }

        except Exception as e:
            logger.error("Stream transcription failed", error=str(e))
            yield {
                "text": "",
                "error": str(e),
                "is_final": True,
            }

    @property
    def is_available(self) -> bool:
        """Check if speech recognition is available."""
        self._ensure_initialized()
        return self._model is not None


# Singleton instance
_medasr_client: MedASRClient | None = None


def get_medasr_client() -> MedASRClient:
    """Get or create MedASR client singleton."""
    global _medasr_client
    if _medasr_client is None:
        _medasr_client = MedASRClient()
    return _medasr_client
