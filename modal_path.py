"""Modal deployment for Path Foundation (digital pathology).

Google's Path Foundation: ViT-S architecture for pathology slide analysis.
Provides embeddings for tumor grading, tissue classification, and similar-slide retrieval.
Handles tile-based processing for large pathology images (224x224 patches).

Deploy:
    modal deploy modal_path.py

Test locally:
    modal serve modal_path.py
"""

import modal

app = modal.App("path-foundation")

path_image = (
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

TISSUE_TYPES = [
    "tumor",
    "stroma",
    "necrosis",
    "normal epithelium",
    "inflammatory infiltrate",
    "adipose tissue",
    "muscle",
    "glandular",
]


@app.function(
    image=path_image,
    gpu="A10G",
    scaledown_window=300,
    timeout=120,
)
@modal.asgi_app()
def serve():
    """FastAPI app serving Path Foundation model."""
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
    api = FastAPI(title="Path Foundation", version="1.0.0")

    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Load Path Foundation
    model = None
    processor = None
    try:
        from transformers import AutoModel, AutoProcessor

        logger.info("Loading Path Foundation model...")
        processor = AutoProcessor.from_pretrained(
            "google/path-foundation", trust_remote_code=True
        )
        model = AutoModel.from_pretrained(
            "google/path-foundation", trust_remote_code=True
        ).to("cuda")
        model.eval()
        logger.info("Path Foundation loaded successfully")
    except Exception as e:
        logger.error("Failed to load Path Foundation", error=str(e))

    class ClassifyRequest(BaseModel):
        image_b64: str = Field(..., description="Base64-encoded pathology image")
        tile_size: int = Field(default=224, description="Tile size for patch extraction")

    class EmbedRequest(BaseModel):
        image_b64: str = Field(..., description="Base64-encoded pathology image")

    def decode_image(image_b64: str) -> Image.Image:
        if "base64," in image_b64:
            image_b64 = image_b64.split("base64,")[1]
        image_data = base64.b64decode(image_b64)
        return Image.open(io.BytesIO(image_data)).convert("RGB")

    def extract_tiles(image: Image.Image, tile_size: int = 224) -> list[Image.Image]:
        """Extract non-overlapping tiles from a pathology image."""
        w, h = image.size
        tiles = []

        if w <= tile_size and h <= tile_size:
            # Small image — resize to tile_size
            tiles.append(image.resize((tile_size, tile_size)))
        else:
            for y in range(0, h - tile_size + 1, tile_size):
                for x in range(0, w - tile_size + 1, tile_size):
                    tile = image.crop((x, y, x + tile_size, y + tile_size))
                    tiles.append(tile)

        return tiles[:64]  # Cap at 64 tiles

    @api.get("/health")
    async def health():
        return {"status": "ok", "model": "path-foundation", "available": model is not None}

    @api.post("/classify")
    async def classify(request: ClassifyRequest):
        """Classify tissue type in pathology image."""
        if model is None:
            raise HTTPException(status_code=503, detail="Path Foundation model not loaded")

        start = time.time()

        try:
            image = decode_image(request.image_b64)
            tiles = extract_tiles(image, request.tile_size)

            # Process each tile
            tile_results = []
            all_embeddings = []

            for i, tile in enumerate(tiles):
                inputs = processor(
                    images=tile,
                    text=TISSUE_TYPES,
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
                    continue

                probs = torch.softmax(logits, dim=-1).cpu().numpy()
                tile_classification = {
                    TISSUE_TYPES[j]: round(float(probs[j]), 4)
                    for j in range(len(TISSUE_TYPES))
                }
                tile_results.append({
                    "tile_index": i,
                    "classification": tile_classification,
                    "top_tissue": max(tile_classification, key=tile_classification.get),
                })

            # Aggregate across tiles
            aggregated = {t: 0.0 for t in TISSUE_TYPES}
            for tr in tile_results:
                for tissue, prob in tr["classification"].items():
                    aggregated[tissue] += prob

            n_tiles = len(tile_results) or 1
            for tissue in aggregated:
                aggregated[tissue] = round(aggregated[tissue] / n_tiles, 4)

            classifications = [
                {"tissue_type": k, "probability": v}
                for k, v in sorted(aggregated.items(), key=lambda x: x[1], reverse=True)
            ]

            tumor_prob = aggregated.get("tumor", 0)
            grade = "high" if tumor_prob > 0.5 else "moderate" if tumor_prob > 0.2 else "low"

            return {
                "classifications": classifications,
                "tumor_probability": round(tumor_prob, 4),
                "grade": grade,
                "tiles_analyzed": len(tile_results),
                "tile_details": tile_results[:10],  # Return first 10 tile details
                "model": "path-foundation",
                "processing_time": round(time.time() - start, 2),
            }

        except Exception as e:
            logger.error("Path classification failed", error=str(e))
            raise HTTPException(status_code=500, detail=str(e))

    @api.post("/embed")
    async def embed(request: EmbedRequest):
        """Get pathology image embedding (averaged across tiles)."""
        if model is None:
            raise HTTPException(status_code=503, detail="Path Foundation model not loaded")

        start = time.time()

        try:
            image = decode_image(request.image_b64)
            tiles = extract_tiles(image)

            all_embeddings = []
            for tile in tiles:
                inputs = processor(images=tile, return_tensors="pt")
                inputs = {k: v.to("cuda") for k, v in inputs.items()}

                with torch.no_grad():
                    outputs = model.get_image_features(**inputs)
                all_embeddings.append(outputs[0])

            avg_embedding = torch.stack(all_embeddings).mean(dim=0).cpu().numpy().tolist()

            return {
                "embedding": avg_embedding,
                "embedding_dim": len(avg_embedding),
                "tiles_used": len(tiles),
                "model": "path-foundation",
                "processing_time": round(time.time() - start, 2),
            }

        except Exception as e:
            logger.error("Path embedding failed", error=str(e))
            raise HTTPException(status_code=500, detail=str(e))

    return api
