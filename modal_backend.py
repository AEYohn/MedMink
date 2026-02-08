"""Modal deployment for the FastAPI backend.

Serves ONLY the case analysis API on Modal serverless infrastructure.
Uses the existing Modal-hosted MedGemma 27B for inference (no local model needed).
No databases required — this is a stateless inference API.

Deploy:
    modal deploy modal_backend.py

Test locally:
    modal serve modal_backend.py
"""

import modal

app = modal.App("research-synthesizer-backend")

# Slim image — only what case_analysis routes actually need at runtime
backend_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        # Web framework
        "fastapi==0.109.2",
        "uvicorn[standard]==0.27.1",
        "python-multipart==0.0.9",
        # HTTP client (for Modal 27B calls + PubMed)
        "httpx==0.26.0",
        "aiohttp==3.9.3",
        # Data models
        "pydantic==2.6.1",
        "pydantic-settings==2.1.0",
        # PubMed
        "biopython>=1.83",
        "feedparser==6.0.11",
        "beautifulsoup4==4.12.3",
        # Logging
        "structlog==24.1.0",
        # Utilities
        "python-dotenv==1.0.1",
        "python-dateutil==2.8.2",
    )
    .add_local_dir("src", remote_path="/app/src")
)


@app.function(
    image=backend_image,
    cpu=1,
    memory=512,
    scaledown_window=300,
    timeout=600,
    secrets=[modal.Secret.from_dict({
        "MEDGEMMA_MODAL_URL": "https://saeyohn122--medgemma-27b-serve.modal.run",
        "MEDGEMMA_MODAL_MODEL": "google/medgemma-27b-it",
        "USE_LOCAL_MEDGEMMA": "false",
        "MEDGEMMA_MODEL": "remote-only",
        "ENVIRONMENT": "production",
    })],
)
@modal.asgi_app()
def serve():
    """Create a minimal FastAPI app with only case analysis routes."""
    import sys
    sys.path.insert(0, "/app")

    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from src.api.routes.case_analysis import router as case_router

    api = FastAPI(
        title="Research Synthesizer API",
        description="Clinical case analysis powered by MedGemma 27B",
        version="1.0.0",
    )

    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    api.include_router(case_router)

    @api.get("/health")
    async def health():
        return {"status": "ok", "environment": "modal"}

    return api
