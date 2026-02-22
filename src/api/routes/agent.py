"""API routes for the Clinical Reasoning Agent."""

import asyncio
import json
from typing import Any

import structlog
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

logger = structlog.get_logger()
router = APIRouter(prefix="/api/agent", tags=["agent"])


class AgentReasonRequest(BaseModel):
    """Request for agent reasoning."""
    case_text: str = Field(..., min_length=20, description="Clinical case text")
    parsed_case: dict[str, Any] | None = Field(default=None, description="Pre-parsed case data")
    chest_xray_b64: str | None = Field(default=None, description="Base64-encoded chest X-ray")
    skin_image_b64: str | None = Field(default=None, description="Base64-encoded skin lesion image")
    pathology_image_b64: str | None = Field(default=None, description="Base64-encoded pathology image")
    audio_path: str | None = Field(default=None, description="Path to respiratory audio file")


async def agent_stream_generator(request: AgentReasonRequest):
    """Generate SSE stream for agent reasoning."""
    from src.agents.clinical_reasoning_agent import run_reasoning_agent

    queue: asyncio.Queue = asyncio.Queue()
    done_event = asyncio.Event()

    async def _produce():
        try:
            async for event in run_reasoning_agent(
                case_text=request.case_text,
                parsed_case=request.parsed_case,
                chest_xray_b64=request.chest_xray_b64,
                skin_image_b64=request.skin_image_b64,
                pathology_image_b64=request.pathology_image_b64,
                audio_path=request.audio_path,
            ):
                await queue.put(event)
        except Exception as e:
            logger.error("Agent stream failed", error=str(e))
            await queue.put({"type": "error", "message": str(e)})
        finally:
            done_event.set()

    producer = asyncio.create_task(_produce())

    try:
        while not done_event.is_set() or not queue.empty():
            try:
                event = await asyncio.wait_for(queue.get(), timeout=30)
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("type") in ("done", "error"):
                    break
            except TimeoutError:
                yield ": heartbeat\n\n"
    finally:
        producer.cancel()


@router.post("/reason/stream")
async def agent_reason_stream(request: AgentReasonRequest):
    """Run the clinical reasoning agent with SSE streaming.

    Streams step-by-step reasoning events:
    - thinking: Agent's reasoning about what to do next
    - tool_call: Agent invoking a specific tool
    - tool_result: Tool execution result
    - assessment: Final clinical assessment
    - consensus: Cross-modal consensus (if multiple models used)
    - done: Agent completed
    - error: Something went wrong
    """
    return StreamingResponse(
        agent_stream_generator(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/tools")
async def list_agent_tools():
    """List available agent tools and their status."""
    from src.agents.clinical_reasoning_agent import TOOL_DESCRIPTIONS
    from src.medgemma.cxr_foundation import get_cxr_foundation_client
    from src.medgemma.derm_foundation import get_derm_foundation_client
    from src.medgemma.path_foundation import get_path_foundation_client
    from src.medgemma.hear_client import get_hear_client
    from src.medgemma.txgemma import get_txgemma_client

    tool_status = {}
    availability = {
        "analyze_chest_xray": get_cxr_foundation_client().is_available,
        "analyze_skin_lesion": get_derm_foundation_client().is_available,
        "analyze_pathology": get_path_foundation_client().is_available,
        "screen_respiratory": get_hear_client().is_available,
        "predict_drug_toxicity": get_txgemma_client().is_available,
        "check_drug_interactions": True,  # Always available (deterministic fallback)
        "compute_risk_scores": True,  # Always available (deterministic fallback)
        "search_evidence": True,  # PubMed API always available
    }

    for name, desc in TOOL_DESCRIPTIONS.items():
        tool_status[name] = {
            **desc,
            "available": availability.get(name, False),
        }

    return {"tools": tool_status}
