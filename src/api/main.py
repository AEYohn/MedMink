"""FastAPI application main module."""

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any

import structlog
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.api.routes import (
    admin,
    case_analysis,
    charting,
    chat,
    consensus,
    evaluation,
    graph,
    interview,
    labs,
    medical,
    novelty,
    patient,
    patterns,
    projects,
    review,
    search,
    tasks,
)
from src.auth.routes import router as auth_router
from src.cache import get_analysis_cache
from src.config import settings
from src.db import close_databases, health_check, init_databases
from src.kg import get_knowledge_graph
from src.medgemma import get_medgemma_client

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("Starting Research Synthesizer API")

    # Initialize databases in background - don't block startup
    async def init_in_background():
        try:
            await init_databases()
            await get_knowledge_graph()
            logger.info("Database connections initialized")
        except Exception as e:
            logger.error("Failed to initialize databases", error=str(e))

    # Pre-warm MedGemma model in background (takes ~60s on first load)
    async def prewarm_medgemma():
        try:
            logger.info("Pre-warming MedGemma model...")
            medgemma = get_medgemma_client()
            # Trigger lazy initialization by checking availability
            _ = medgemma.is_available
            logger.info("MedGemma model pre-warmed successfully")
        except Exception as e:
            logger.warning("MedGemma pre-warming failed (will load on first request)", error=str(e))

    asyncio.create_task(init_in_background())
    asyncio.create_task(prewarm_medgemma())
    logger.info("API startup complete (databases and MedGemma initializing in background)")

    yield

    # Shutdown
    logger.info("Shutting down Research Synthesizer API")
    await close_databases()
    logger.info("API shutdown complete")


app = FastAPI(
    title="Research Synthesizer API",
    description="AI-powered research paper analysis and synthesis",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "https://dashboard-nine-black-67.vercel.app",
        "https://dashboard-aeyohns-projects.vercel.app",
    ],
    allow_origin_regex=r"https://dashboard.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(graph.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(review.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(patterns.router, prefix="/api")
app.include_router(novelty.router, prefix="/api")
app.include_router(evaluation.router, prefix="/api")
app.include_router(medical.router, prefix="/api")
app.include_router(consensus.router, prefix="/api")
app.include_router(patient.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(case_analysis.router)
app.include_router(charting.router)
app.include_router(labs.router)
app.include_router(interview.router)


# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict[str, Any]):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Research Synthesizer API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    db_health = await health_check()
    return {
        "status": "healthy" if db_health["healthy"] else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "services": db_health,
    }


@app.get("/api/status")
async def get_status():
    """Get system status."""
    try:
        kg = await get_knowledge_graph()
        stats = await kg.get_stats()

        from src.gemini import get_gemini_client
        gemini = get_gemini_client()
        gemini_stats = gemini.get_stats()

        return {
            "status": "operational",
            "timestamp": datetime.utcnow().isoformat(),
            "knowledge_graph": stats,
            "gemini": {
                "model": gemini_stats["model"],
                "rate_limiter": gemini_stats["rate_limiter"],
                "cost_tracker": gemini_stats["cost_tracker"],
            },
        }
    except Exception as e:
        logger.error("Failed to get status", error=str(e))
        return JSONResponse(
            status_code=500,
            content={"status": "error", "error": str(e)},
        )


@app.get("/api/cost")
async def get_cost_tracking():
    """Get cost tracking information."""
    from src.gemini import get_gemini_client
    gemini = get_gemini_client()
    return gemini.cost_tracker.get_stats()


@app.get("/api/cache/stats")
async def get_cache_stats():
    """Get analysis cache statistics."""
    cache = get_analysis_cache()
    return cache.get_stats()


@app.delete("/api/cache/clear")
async def clear_cache():
    """Clear the analysis cache."""
    cache = get_analysis_cache()
    cleared = await cache.clear()
    return {"cleared": cleared, "message": f"Cleared {cleared} cache entries"}


@app.get("/api/settings/analysis")
async def get_analysis_settings():
    """Get analysis configuration settings."""
    return {
        "analysis_mode": settings.analysis_mode,
        "token_budgets": {
            "quick": settings.quick_analysis_max_tokens,
            "standard": settings.standard_analysis_max_tokens,
            "deep": settings.deep_analysis_max_tokens,
        },
        "caching": {
            "enabled": settings.enable_analysis_cache,
            "similarity_threshold": settings.cache_similarity_threshold,
            "ttl_hours": settings.cache_ttl_hours,
        },
        "batch_analysis": {
            "enabled": settings.enable_batch_analysis,
            "batch_size": settings.batch_size,
            "max_batch_tokens": settings.max_batch_tokens,
        },
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates."""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()

            # Echo or handle commands
            if data == "ping":
                await websocket.send_json({"type": "pong", "timestamp": datetime.utcnow().isoformat()})
            elif data == "status":
                kg = await get_knowledge_graph()
                stats = await kg.get_stats()
                await websocket.send_json({"type": "status", "data": stats})

    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.websocket("/ws/activity")
async def activity_feed(websocket: WebSocket):
    """WebSocket endpoint for activity feed."""
    await manager.connect(websocket)
    try:
        while True:
            # Send periodic updates
            await asyncio.sleep(5)

            kg = await get_knowledge_graph()
            stats = await kg.get_weekly_stats()

            await websocket.send_json({
                "type": "activity",
                "timestamp": datetime.utcnow().isoformat(),
                "data": stats,
            })

    except WebSocketDisconnect:
        manager.disconnect(websocket)


# Broadcast helper for agents to use
async def broadcast_event(event_type: str, data: dict[str, Any]):
    """Broadcast an event to all connected clients."""
    await manager.broadcast({
        "type": event_type,
        "timestamp": datetime.utcnow().isoformat(),
        "data": data,
    })


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.api.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.environment == "development",
    )
