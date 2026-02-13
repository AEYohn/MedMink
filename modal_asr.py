"""Modal deployment for MedASR (medical speech-to-text).

Primary: Google MedASR Conformer (105M params, 4.6% WER on radiology dictation)
Fallback: faster-whisper large-v3 (for non-medical audio or if MedASR fails)

Deploy:
    modal deploy modal_asr.py

Test locally:
    modal serve modal_asr.py
"""

import modal

app = modal.App("medasr")

asr_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg", "libsndfile1")
    .pip_install(
        "fastapi==0.109.2",
        "uvicorn[standard]==0.27.1",
        "python-multipart==0.0.9",
        "faster-whisper==1.1.0",
        "torch>=2.1.0",
        "torchaudio>=2.1.0",
        "transformers>=4.40.0",
        "librosa>=0.10.0",
        "soundfile>=0.12.0",
        "structlog==24.1.0",
        "huggingface-hub>=0.20.0",
    )
)


@app.function(
    image=asr_image,
    gpu="A10G",
    scaledown_window=300,
    timeout=120,
)
@modal.asgi_app()
def transcribe():
    """FastAPI app serving MedASR with Whisper fallback."""
    import os
    import re
    import tempfile
    import time

    import librosa
    import numpy as np
    import soundfile as sf
    import structlog
    import torch
    from fastapi import FastAPI, File, UploadFile
    from fastapi.middleware.cors import CORSMiddleware

    logger = structlog.get_logger()
    api = FastAPI(title="MedASR", version="2.0.0")

    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- Load MedASR Conformer (primary) ---
    medasr_model = None
    medasr_processor = None
    try:
        from transformers import AutoFeatureExtractor, AutoModelForCTC

        logger.info("Loading MedASR Conformer model...")
        medasr_processor = AutoFeatureExtractor.from_pretrained(
            "google/medasr", trust_remote_code=True
        )
        medasr_model = AutoModelForCTC.from_pretrained(
            "google/medasr", trust_remote_code=True
        ).to("cuda")
        medasr_model.eval()
        logger.info("MedASR Conformer loaded successfully (105M params)")
    except Exception as e:
        logger.warning("MedASR Conformer not available, will use Whisper", error=str(e))

    # --- Load Whisper fallback ---
    from faster_whisper import WhisperModel

    whisper_model = WhisperModel("large-v3", device="cuda", compute_type="float16")
    logger.info("Whisper large-v3 loaded as fallback")

    # Reduced corrections — MedASR handles most medical vocab natively
    WHISPER_CORRECTIONS = {
        "HIV": ["h i v", "h.i.v."],
        "COPD": ["c o p d", "c.o.p.d."],
        "CHF": ["c h f", "c.h.f."],
        "MI": ["m i", "m.i."],
        "CVA": ["c v a", "c.v.a."],
        "DVT": ["d v t", "d.v.t."],
        "PE": ["p e", "p.e."],
    }

    def apply_whisper_corrections(text: str) -> str:
        text_lower = text.lower()
        for correct_term, variants in WHISPER_CORRECTIONS.items():
            for variant in variants:
                if variant in text_lower:
                    pattern = re.compile(re.escape(variant), re.IGNORECASE)
                    text = pattern.sub(correct_term, text)
                    text_lower = text.lower()
        return text

    def transcribe_with_medasr(audio_path: str) -> dict:
        """Transcribe using MedASR Conformer."""
        # Load and resample to 16kHz
        audio, sr = librosa.load(audio_path, sr=16000)

        # Process in chunks if audio is very long (>30s)
        chunk_size = 16000 * 30  # 30 seconds
        all_text = []

        for i in range(0, len(audio), chunk_size):
            chunk = audio[i : i + chunk_size]
            inputs = medasr_processor(
                chunk, sampling_rate=16000, return_tensors="pt"
            )
            inputs = {k: v.to("cuda") for k, v in inputs.items()}

            with torch.no_grad():
                logits = medasr_model(**inputs).logits

            # CTC decoding
            predicted_ids = torch.argmax(logits, dim=-1)
            text = medasr_processor.batch_decode(predicted_ids)[0]
            all_text.append(text.strip())

        full_text = " ".join(all_text)
        duration = len(audio) / 16000

        return {
            "text": full_text,
            "duration": round(duration, 2),
            "language": "en",
            "model": "medasr-conformer",
        }

    def transcribe_with_whisper(audio_path: str) -> dict:
        """Fallback transcription using Whisper."""
        segments_list, info = whisper_model.transcribe(
            audio_path,
            language="en",
            beam_size=5,
            word_timestamps=False,
            vad_filter=True,
        )

        segments = []
        full_text_parts = []
        for seg in segments_list:
            segments.append(
                {
                    "start": round(seg.start, 2),
                    "end": round(seg.end, 2),
                    "text": seg.text.strip(),
                }
            )
            full_text_parts.append(seg.text.strip())

        full_text = " ".join(full_text_parts)
        full_text = apply_whisper_corrections(full_text)

        return {
            "text": full_text,
            "segments": segments,
            "duration": round(info.duration, 2),
            "language": info.language,
            "model": "whisper-large-v3",
        }

    @api.get("/health")
    async def health():
        return {
            "status": "ok",
            "primary_model": "medasr-conformer" if medasr_model else "whisper-large-v3",
            "whisper_fallback": True,
            "medasr_available": medasr_model is not None,
        }

    @api.post("/transcribe")
    async def transcribe_audio(audio: UploadFile = File(...)):
        """Transcribe uploaded audio file.

        Uses MedASR Conformer as primary model (5x better WER on medical audio).
        Falls back to Whisper for non-medical audio or if MedASR fails.

        Returns:
            JSON with text, duration, model used, and processing time.
        """
        start = time.time()

        # Save uploaded audio to temp file
        suffix = ".webm" if "webm" in (audio.content_type or "") else ".wav"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            content = await audio.read()
            tmp.write(content)
            tmp_path = tmp.name

        result = None

        # Try MedASR first
        if medasr_model is not None:
            try:
                result = transcribe_with_medasr(tmp_path)
                logger.info(
                    "MedASR transcription complete",
                    text_len=len(result["text"]),
                    duration=result["duration"],
                )
            except Exception as e:
                logger.warning("MedASR failed, falling back to Whisper", error=str(e))

        # Whisper fallback
        if result is None:
            result = transcribe_with_whisper(tmp_path)
            logger.info(
                "Whisper transcription complete",
                text_len=len(result["text"]),
                duration=result["duration"],
            )

        # Clean up
        os.unlink(tmp_path)

        result["processing_time"] = round(time.time() - start, 2)
        return result

    return api
