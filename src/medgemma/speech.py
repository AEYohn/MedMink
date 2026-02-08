"""MedASR - Medical Speech Recognition for HAI-DEF.

Provides speech-to-text transcription optimized for medical terminology,
drug names, anatomical terms, and clinical abbreviations.

Features:
- Medical vocabulary optimization
- Support for clinical dictation
- Integration with MedGemma for post-processing
"""

import asyncio
from pathlib import Path
from typing import Any

import structlog

from src.medgemma.model_registry import get_model_registry, ModelType

logger = structlog.get_logger()


# Medical terminology corrections for common misheard words
MEDICAL_CORRECTIONS = {
    # Drug names
    "metformin": ["met form in", "met for min", "metform in"],
    "atorvastatin": ["a tour vast a tin", "ator vast atin"],
    "lisinopril": ["lice in oh pril", "lysin o pril"],
    "omeprazole": ["oh mep ra zole", "omep razole"],
    "amlodipine": ["am low dip een", "amlod ipine"],
    "tesamorelin": ["tessa more lin", "tesa morelin"],
    "methotrexate": ["metho trex ate", "meth o trex ate"],

    # Conditions
    "hypertension": ["high per tension", "hyper ten sion"],
    "hyperlipidemia": ["hyper lip id emia", "hyper lipid emia"],
    "atherosclerosis": ["athero scler osis", "athero sclerosis"],
    "cardiomyopathy": ["cardio my op athy", "cardio myo pathy"],
    "lipodystrophy": ["lipo dys trophy", "lipody strophy"],

    # Anatomical
    "myocardium": ["myo card ium", "my o cardium"],
    "pericardium": ["peri card ium", "peri cardium"],
    "endocardium": ["endo card ium", "endo cardium"],

    # Abbreviations spoken aloud
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

    Uses MedASR (when available) or falls back to Whisper
    with medical vocabulary optimization.
    """

    def __init__(self):
        self._model = None
        self._processor = None
        self._initialized = False
        self._using_whisper_fallback = False

    def _ensure_initialized(self):
        """Lazily initialize the ASR model."""
        if self._initialized:
            return

        try:
            # Try to load MedASR from registry
            registry = get_model_registry()
            model_info = registry.get_model_info(ModelType.ASR)

            if model_info["can_load"]:
                # Try MedASR first
                try:
                    asyncio.get_event_loop().run_until_complete(
                        registry.load_model(ModelType.ASR)
                    )
                    result = registry.get_model(ModelType.ASR)
                    if result:
                        self._model, self._processor = result
                        logger.info("MedASR loaded successfully")
                        self._initialized = True
                        return
                except Exception as e:
                    logger.warning("MedASR not available, trying Whisper", error=str(e))

            # Fallback to Whisper
            self._load_whisper_fallback()

        except Exception as e:
            logger.error("Failed to initialize speech recognition", error=str(e))
            self._initialized = True

    def _load_whisper_fallback(self):
        """Load OpenAI Whisper as fallback."""
        try:
            import torch
            from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor

            logger.info("Loading Whisper for speech recognition")

            # Determine device
            if torch.cuda.is_available():
                device = "cuda"
                dtype = torch.float16
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                device = "mps"
                dtype = torch.float32
            else:
                device = "cpu"
                dtype = torch.float32

            # Load Whisper large-v3 for best medical transcription
            model_id = "openai/whisper-large-v3"

            self._processor = AutoProcessor.from_pretrained(model_id)
            self._model = AutoModelForSpeechSeq2Seq.from_pretrained(
                model_id,
                torch_dtype=dtype,
                low_cpu_mem_usage=True,
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
        apply_medical_corrections: bool = True,
    ) -> dict[str, Any]:
        """Transcribe audio to text with medical terminology optimization.

        Args:
            audio_path: Path to audio file (wav, mp3, m4a, etc.)
            language: Language code (default: English)
            apply_medical_corrections: Apply medical vocabulary corrections

        Returns:
            Transcription result with text, confidence, and segments
        """
        result = await asyncio.to_thread(
            self._transcribe_sync,
            audio_path=audio_path,
            language=language,
            apply_medical_corrections=apply_medical_corrections,
        )
        return result

    def _transcribe_sync(
        self,
        audio_path: str,
        language: str,
        apply_medical_corrections: bool,
    ) -> dict[str, Any]:
        """Synchronous transcription."""
        self._ensure_initialized()

        if self._model is None:
            return {
                "text": "",
                "error": "Speech recognition not available",
                "confidence": 0.0,
            }

        try:
            import torch
            import librosa

            # Load audio
            audio_file = Path(audio_path)
            if not audio_file.exists():
                return {
                    "text": "",
                    "error": f"Audio file not found: {audio_path}",
                    "confidence": 0.0,
                }

            # Load and resample to 16kHz
            audio, sr = librosa.load(audio_path, sr=16000)

            # Process with model
            inputs = self._processor(
                audio,
                sampling_rate=16000,
                return_tensors="pt",
            )

            # Move to device
            device = next(self._model.parameters()).device
            inputs = {k: v.to(device) for k, v in inputs.items()}

            # Generate transcription
            with torch.no_grad():
                generated_ids = self._model.generate(
                    **inputs,
                    max_new_tokens=448,
                    language=language,
                    task="transcribe",
                )

            # Decode
            transcription = self._processor.batch_decode(
                generated_ids,
                skip_special_tokens=True,
            )[0]

            # Apply medical corrections if requested
            if apply_medical_corrections:
                transcription = self._apply_medical_corrections(transcription)

            return {
                "text": transcription.strip(),
                "language": language,
                "audio_duration_seconds": len(audio) / 16000,
                "model": "medasr" if not self._using_whisper_fallback else "whisper-large-v3",
                "confidence": 0.9,  # Placeholder - real models return confidence
            }

        except ImportError as e:
            logger.error("Missing audio dependencies", error=str(e))
            return {
                "text": "",
                "error": "Install: pip install librosa soundfile",
                "confidence": 0.0,
            }
        except Exception as e:
            logger.error("Transcription failed", error=str(e))
            return {
                "text": "",
                "error": str(e),
                "confidence": 0.0,
            }

    def _apply_medical_corrections(self, text: str) -> str:
        """Apply medical terminology corrections.

        Fixes common misheard drug names, conditions, and abbreviations.
        """
        text_lower = text.lower()

        for correct_term, misheard_variants in MEDICAL_CORRECTIONS.items():
            for variant in misheard_variants:
                if variant in text_lower:
                    # Case-preserving replacement
                    import re
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
