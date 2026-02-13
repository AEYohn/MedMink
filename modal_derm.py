"""Modal deployment for Derm Foundation (skin lesion classification).

Google's Derm Foundation: BiT-ResNet-101x3 trained on dermatology images.
Provides 6,144-dim embeddings and classification for skin lesion triage.

Deploy:
    modal deploy modal_derm.py

Test locally:
    modal serve modal_derm.py
"""

import modal

app = modal.App("derm-foundation")

derm_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "fastapi==0.109.2",
        "uvicorn[standard]==0.27.1",
        "torch>=2.1.0",
        "torchvision>=0.16.0",
        "transformers>=4.40.0",
        "Pillow>=10.0.0",
        "numpy>=1.24.0",
        "structlog==24.1.0",
        "huggingface-hub>=0.20.0",
    )
)


@app.function(
    image=derm_image,
    gpu="A10G",
    scaledown_window=300,
    timeout=120,
)
@modal.asgi_app()
def serve():
    """FastAPI app serving Derm Foundation model."""
    import base64
    import io
    import time

    import numpy as np
    import structlog
    import torch
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from PIL import Image
    from pydantic import BaseModel, Field

    logger = structlog.get_logger()
    api = FastAPI(title="Derm Foundation", version="1.0.0")

    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Load Derm Foundation
    model = None
    processor = None
    try:
        from transformers import AutoModel, AutoProcessor

        logger.info("Loading Derm Foundation model...")
        processor = AutoProcessor.from_pretrained(
            "google/derm-foundation", trust_remote_code=True
        )
        model = AutoModel.from_pretrained(
            "google/derm-foundation", trust_remote_code=True
        ).to("cuda")
        model.eval()
        logger.info("Derm Foundation loaded successfully")
    except Exception as e:
        logger.error("Failed to load Derm Foundation", error=str(e))

    # Dermatology classification categories
    DERM_CONDITIONS = [
        "melanoma",
        "basal cell carcinoma",
        "squamous cell carcinoma",
        "actinic keratosis",
        "benign nevus",
        "seborrheic keratosis",
        "dermatofibroma",
        "vascular lesion",
        "atypical nevus",
    ]

    RISK_LEVELS = {
        "melanoma": "high",
        "basal cell carcinoma": "moderate",
        "squamous cell carcinoma": "moderate",
        "actinic keratosis": "low",
        "atypical nevus": "moderate",
        "benign nevus": "low",
        "seborrheic keratosis": "low",
        "dermatofibroma": "low",
        "vascular lesion": "low",
    }

    class ClassifyRequest(BaseModel):
        image_b64: str = Field(..., description="Base64-encoded dermoscopy image")

    class EmbedRequest(BaseModel):
        image_b64: str = Field(..., description="Base64-encoded dermoscopy image")

    def decode_image(image_b64: str) -> Image.Image:
        if "base64," in image_b64:
            image_b64 = image_b64.split("base64,")[1]
        image_data = base64.b64decode(image_b64)
        return Image.open(io.BytesIO(image_data)).convert("RGB")

    @api.get("/health")
    async def health():
        return {"status": "ok", "model": "derm-foundation", "available": model is not None}

    @api.post("/classify")
    async def classify(request: ClassifyRequest):
        """Classify skin lesion and provide risk assessment."""
        if model is None:
            raise HTTPException(status_code=503, detail="Derm Foundation model not loaded")

        start = time.time()

        try:
            image = decode_image(request.image_b64)

            # Process image
            inputs = processor(
                images=image,
                text=DERM_CONDITIONS,
                return_tensors="pt",
                padding=True,
            )
            inputs = {k: v.to("cuda") for k, v in inputs.items()}

            with torch.no_grad():
                outputs = model(**inputs)

            if hasattr(outputs, "logits_per_image"):
                logits = outputs.logits_per_image[0]
            elif hasattr(outputs, "image_embeds") and hasattr(outputs, "text_embeds"):
                image_embeds = outputs.image_embeds / outputs.image_embeds.norm(dim=-1, keepdim=True)
                text_embeds = outputs.text_embeds / outputs.text_embeds.norm(dim=-1, keepdim=True)
                logits = (image_embeds @ text_embeds.T)[0] * 100
            else:
                raise ValueError("Unexpected model output format")

            probs = torch.softmax(logits, dim=-1).cpu().numpy()

            classifications = []
            for condition, prob in zip(DERM_CONDITIONS, probs):
                classifications.append({
                    "condition": condition,
                    "probability": round(float(prob), 4),
                    "risk_level": RISK_LEVELS.get(condition, "unknown"),
                })

            classifications.sort(key=lambda x: x["probability"], reverse=True)

            # Determine overall risk
            top_condition = classifications[0]["condition"]
            overall_risk = RISK_LEVELS.get(top_condition, "unknown")
            malignant_prob = sum(
                c["probability"]
                for c in classifications
                if c["condition"] in ("melanoma", "basal cell carcinoma", "squamous cell carcinoma")
            )

            return {
                "classifications": classifications,
                "top_diagnosis": top_condition,
                "overall_risk": overall_risk,
                "malignancy_probability": round(malignant_prob, 4),
                "model": "derm-foundation",
                "processing_time": round(time.time() - start, 2),
            }

        except Exception as e:
            logger.error("Derm classification failed", error=str(e))
            raise HTTPException(status_code=500, detail=str(e))

    @api.post("/embed")
    async def embed(request: EmbedRequest):
        """Get 6,144-dim embedding for similarity search."""
        if model is None:
            raise HTTPException(status_code=503, detail="Derm Foundation model not loaded")

        start = time.time()

        try:
            image = decode_image(request.image_b64)
            inputs = processor(images=image, return_tensors="pt")
            inputs = {k: v.to("cuda") for k, v in inputs.items()}

            with torch.no_grad():
                outputs = model.get_image_features(**inputs)

            embedding = outputs[0].cpu().numpy().tolist()

            return {
                "embedding": embedding,
                "embedding_dim": len(embedding),
                "model": "derm-foundation",
                "processing_time": round(time.time() - start, 2),
            }

        except Exception as e:
            logger.error("Derm embedding failed", error=str(e))
            raise HTTPException(status_code=500, detail=str(e))

    return api
