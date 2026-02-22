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
        # PDF parsing (labs route)
        "pymupdf==1.24.2",
        # Retry logic (used by embeddings, gemini client)
        "tenacity==8.2.3",
        # Graph DB driver (imported transitively by agents.base → kg)
        "neo4j==5.17.0",
        # Redis (imported transitively by src.db)
        "redis>=5.0.0",
        # SQLAlchemy (imported transitively by src.models/db)
        "sqlalchemy>=2.0.0",
        # Async Postgres driver (imported transitively by src.db)
        "asyncpg>=0.29.0",
    )
    .add_local_dir("src", remote_path="/app/src")
)


@app.function(
    image=backend_image,
    cpu=1,
    memory=512,
    scaledown_window=300,
    timeout=900,
    secrets=[modal.Secret.from_dict({
        "MEDGEMMA_MODAL_URL": "https://saeyohn122--medgemma-27b-serve.modal.run",
        "MEDGEMMA_MODAL_MODEL": "google/medgemma-27b-it",
        "MEDGEMMA_MULTIMODAL_MODAL_URL": "",
        "MEDGEMMA_MULTIMODAL_MODAL_MODEL": "google/medgemma-27b-multimodal",
        "USE_LOCAL_MEDGEMMA": "false",
        "MEDGEMMA_MODEL": "remote-only",
        "ENVIRONMENT": "production",
        "WHISPER_MODAL_URL": "",
        "MEDASR_MODAL_URL": "https://saeyohn122--medasr-transcribe.modal.run",
        "CXR_FOUNDATION_MODAL_URL": "https://saeyohn122--cxr-foundation-serve.modal.run",
        "TXGEMMA_MODAL_URL": "https://saeyohn122--txgemma-serve.modal.run",
        "DERM_FOUNDATION_MODAL_URL": "https://saeyohn122--derm-foundation-serve.modal.run",
        "HEAR_MODAL_URL": "https://saeyohn122--hear-respiratory-serve.modal.run",
        "PATH_FOUNDATION_MODAL_URL": "https://saeyohn122--path-foundation-serve.modal.run",
    })],
)
@modal.concurrent(max_inputs=50)
@modal.asgi_app()
def serve():
    """Create a minimal FastAPI app with only case analysis routes."""
    import sys
    sys.path.insert(0, "/app")

    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from src.api.routes.case_analysis import router as case_router
    from src.api.routes.interview import router as interview_router
    from src.api.routes.labs import router as labs_router
    from src.api.routes.charting import router as charting_router
    from src.api.routes.consensus_lite import router as consensus_router
    _ems_import_error = None
    try:
        from src.api.routes.ems import router as ems_router
    except Exception as exc:
        import traceback
        _ems_import_error = f"{exc}\n{traceback.format_exc()}"
        ems_router = None

    _compliance_import_error = None
    try:
        from src.api.routes.compliance import router as compliance_router
    except Exception as exc:
        import traceback
        _compliance_import_error = f"{exc}\n{traceback.format_exc()}"
        compliance_router = None

    _agent_import_error = None
    try:
        from src.api.routes.agent import router as agent_router
    except Exception as exc:
        import traceback
        _agent_import_error = f"{exc}\n{traceback.format_exc()}"
        agent_router = None

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
    api.include_router(interview_router)
    api.include_router(labs_router)
    api.include_router(charting_router)
    api.include_router(consensus_router)
    if ems_router:
        api.include_router(ems_router)
    if compliance_router:
        api.include_router(compliance_router)
    if agent_router:
        api.include_router(agent_router)

    @api.get("/health")
    async def health():
        return {"status": "ok", "environment": "modal", "version": "2.2", "ems_loaded": ems_router is not None, "ems_error": _ems_import_error, "agent_loaded": agent_router is not None, "agent_error": _agent_import_error}

    return api
