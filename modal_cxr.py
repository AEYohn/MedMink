"""Modal deployment for CXR Foundation (chest X-ray classification).

Google's CXR Foundation: EfficientNet-L2 + BERT dual encoder trained on 820K+ X-rays.
Provides zero-shot classification for 13+ conditions and image embeddings.

Deploy:
    modal deploy modal_cxr.py

Test locally:
    modal serve modal_cxr.py
"""

import modal

app = modal.App("cxr-foundation")

cxr_image = (
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

# Default CXR conditions for zero-shot classification
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


@app.function(
    image=cxr_image,
    gpu="A10G",
    scaledown_window=300,
    timeout=120,
)
@modal.asgi_app()
def serve():
    """FastAPI app serving CXR Foundation model."""
    import base64
    import io
    import time
    from typing import Optional

    import numpy as np
    import structlog
    import torch
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from PIL import Image
    from pydantic import BaseModel, Field

    logger = structlog.get_logger()
    api = FastAPI(title="CXR Foundation", version="1.0.0")

    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Load CXR Foundation model
    model = None
    processor = None
    try:
        from transformers import AutoModel, AutoProcessor

        logger.info("Loading CXR Foundation model...")
        processor = AutoProcessor.from_pretrained(
            "google/cxr-foundation", trust_remote_code=True
        )
        model = AutoModel.from_pretrained(
            "google/cxr-foundation", trust_remote_code=True
        ).to("cuda")
        model.eval()
        logger.info("CXR Foundation loaded successfully")
    except Exception as e:
        logger.error("Failed to load CXR Foundation", error=str(e))

    class ClassifyRequest(BaseModel):
        image_b64: str = Field(..., description="Base64-encoded chest X-ray image")
        conditions: list[str] = Field(
            default=DEFAULT_CONDITIONS,
            description="Conditions to classify (zero-shot)",
        )

    class EmbedRequest(BaseModel):
        image_b64: str = Field(..., description="Base64-encoded chest X-ray image")

    def decode_image(image_b64: str) -> Image.Image:
        """Decode base64 image, stripping data URI prefix if present."""
        if "base64," in image_b64:
            image_b64 = image_b64.split("base64,")[1]
        image_data = base64.b64decode(image_b64)
        return Image.open(io.BytesIO(image_data)).convert("RGB")

    @api.get("/health")
    async def health():
        return {"status": "ok", "model": "cxr-foundation", "available": model is not None}

    @api.post("/classify")
    async def classify(request: ClassifyRequest):
        """Zero-shot classification of chest X-ray conditions.

        Returns probability scores for each specified condition.
        """
        if model is None:
            raise HTTPException(status_code=503, detail="CXR Foundation model not loaded")

        start = time.time()

        try:
            image = decode_image(request.image_b64)

            # Process image
            inputs = processor(
                images=image,
                text=request.conditions,
                return_tensors="pt",
                padding=True,
            )
            inputs = {k: v.to("cuda") for k, v in inputs.items()}

            with torch.no_grad():
                outputs = model(**inputs)

            # Get similarity scores between image and text conditions
            if hasattr(outputs, "logits_per_image"):
                logits = outputs.logits_per_image[0]
            elif hasattr(outputs, "image_embeds") and hasattr(outputs, "text_embeds"):
                image_embeds = outputs.image_embeds / outputs.image_embeds.norm(dim=-1, keepdim=True)
                text_embeds = outputs.text_embeds / outputs.text_embeds.norm(dim=-1, keepdim=True)
                logits = (image_embeds @ text_embeds.T)[0] * 100
            else:
                raise ValueError("Unexpected model output format")

            probs = torch.softmax(logits, dim=-1).cpu().numpy()

            results = []
            for condition, prob in zip(request.conditions, probs):
                results.append({
                    "condition": condition,
                    "probability": round(float(prob), 4),
                })

            # Sort by probability descending
            results.sort(key=lambda x: x["probability"], reverse=True)

            return {
                "classifications": results,
                "model": "cxr-foundation",
                "processing_time": round(time.time() - start, 2),
            }

        except Exception as e:
            logger.error("CXR classification failed", error=str(e))
            raise HTTPException(status_code=500, detail=str(e))

    @api.post("/embed")
    async def embed(request: EmbedRequest):
        """Get image embedding for similarity search."""
        if model is None:
            raise HTTPException(status_code=503, detail="CXR Foundation model not loaded")

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
                "model": "cxr-foundation",
                "processing_time": round(time.time() - start, 2),
            }

        except Exception as e:
            logger.error("CXR embedding failed", error=str(e))
            raise HTTPException(status_code=500, detail=str(e))

    return api
