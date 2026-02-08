"""Task management API routes."""

from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from src.api.deps import get_task_queue, get_thought_store, get_kg
from src.config import settings
from src.kg import KnowledgeGraph
from src.models import Task, TaskType, TaskStatus
from src.orchestrator.state import TaskQueue, ThoughtSignatureStore
from src.orchestrator.scheduler import TaskScheduler
from src.orchestrator.state import OrchestratorState

router = APIRouter(prefix="/tasks", tags=["Tasks"])


class CreateTaskRequest(BaseModel):
    type: str
    payload: dict[str, Any] = {}
    priority: int = 5


class TaskResponse(BaseModel):
    id: str
    type: str
    status: str
    priority: int
    created_at: str | None


class IngestRequest(BaseModel):
    topic: str = "machine learning"
    categories: list[str] | None = None
    max_results: int = 50
    days_back: int = 7


class IngestPWCRequest(BaseModel):
    topic: str = "machine learning"
    max_results: int = 50
    days_back: int = 30
    with_code_only: bool = True


class IngestHFRequest(BaseModel):
    max_results: int = 50
    days_back: int = 7
    min_upvotes: int = 0


class AnalyzeRequest(BaseModel):
    paper_id: str | None = None
    batch_size: int = 10


class SynthesizeRequest(BaseModel):
    week_start: str | None = None


@router.get("/stats")
async def get_task_stats(queue: TaskQueue = Depends(get_task_queue)):
    """Get task queue statistics."""
    return await queue.get_stats()


@router.post("/create", response_model=TaskResponse)
async def create_task(
    request: CreateTaskRequest,
    queue: TaskQueue = Depends(get_task_queue),
):
    """Create a new task."""
    try:
        task_type = TaskType(request.type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid task type: {request.type}. Valid types: {[t.value for t in TaskType]}",
        )

    task = Task(
        id=str(uuid4()),
        type=task_type,
        status=TaskStatus.PENDING,
        priority=request.priority,
        payload=request.payload,
    )

    await queue.add(task)

    return TaskResponse(
        id=task.id,
        type=task.type.value,
        status=task.status.value,
        priority=task.priority,
        created_at=task.created_at.isoformat() if task.created_at else None,
    )


@router.post("/ingest", response_model=TaskResponse)
async def trigger_ingest(
    request: IngestRequest,
    queue: TaskQueue = Depends(get_task_queue),
):
    """Trigger paper ingestion."""
    task = Task(
        id=str(uuid4()),
        type=TaskType.INGEST,
        status=TaskStatus.PENDING,
        priority=6,
        payload={
            "topic": request.topic,
            "categories": request.categories or settings.arxiv_categories,
            "max_results": request.max_results,
            "days_back": request.days_back,
        },
    )

    await queue.add(task)

    return TaskResponse(
        id=task.id,
        type=task.type.value,
        status=task.status.value,
        priority=task.priority,
        created_at=task.created_at.isoformat() if task.created_at else None,
    )


@router.post("/ingest/paperswithcode", response_model=TaskResponse)
async def trigger_pwc_ingest(
    request: IngestPWCRequest,
    queue: TaskQueue = Depends(get_task_queue),
):
    """Trigger paper ingestion from PapersWithCode.

    PapersWithCode provides papers with associated code implementations,
    making them more actionable for understanding techniques.
    """
    task = Task(
        id=str(uuid4()),
        type=TaskType.INGEST,
        status=TaskStatus.PENDING,
        priority=6,
        payload={
            "source": "paperswithcode",
            "topic": request.topic,
            "max_results": request.max_results,
            "days_back": request.days_back,
            "with_code_only": request.with_code_only,
        },
    )

    await queue.add(task)

    return TaskResponse(
        id=task.id,
        type=task.type.value,
        status=task.status.value,
        priority=task.priority,
        created_at=task.created_at.isoformat() if task.created_at else None,
    )


@router.post("/ingest/huggingface", response_model=TaskResponse)
async def trigger_hf_ingest(
    request: IngestHFRequest = IngestHFRequest(),
    queue: TaskQueue = Depends(get_task_queue),
):
    """Trigger paper ingestion from HuggingFace Daily Papers.

    HuggingFace Daily Papers provides community-curated papers with
    engagement metrics (upvotes, discussions).
    """
    task = Task(
        id=str(uuid4()),
        type=TaskType.INGEST,
        status=TaskStatus.PENDING,
        priority=6,
        payload={
            "source": "huggingface",
            "max_results": request.max_results,
            "days_back": request.days_back,
            "min_upvotes": request.min_upvotes,
        },
    )

    await queue.add(task)

    return TaskResponse(
        id=task.id,
        type=task.type.value,
        status=task.status.value,
        priority=task.priority,
        created_at=task.created_at.isoformat() if task.created_at else None,
    )


@router.post("/analyze", response_model=TaskResponse)
async def trigger_analyze(
    request: AnalyzeRequest,
    queue: TaskQueue = Depends(get_task_queue),
):
    """Trigger paper analysis."""
    task = Task(
        id=str(uuid4()),
        type=TaskType.ANALYZE,
        status=TaskStatus.PENDING,
        priority=5,
        payload={
            "paper_id": request.paper_id,
            "batch_size": request.batch_size,
        },
    )

    await queue.add(task)

    return TaskResponse(
        id=task.id,
        type=task.type.value,
        status=task.status.value,
        priority=task.priority,
        created_at=task.created_at.isoformat() if task.created_at else None,
    )


@router.post("/synthesize", response_model=TaskResponse)
async def trigger_synthesize(
    request: SynthesizeRequest = SynthesizeRequest(),
    queue: TaskQueue = Depends(get_task_queue),
):
    """Trigger weekly synthesis."""
    task = Task(
        id=str(uuid4()),
        type=TaskType.SYNTHESIZE,
        status=TaskStatus.PENDING,
        priority=6,
        payload={
            "week_start": request.week_start,
        },
    )

    await queue.add(task)

    return TaskResponse(
        id=task.id,
        type=task.type.value,
        status=task.status.value,
        priority=task.priority,
        created_at=task.created_at.isoformat() if task.created_at else None,
    )


@router.post("/detect-contradictions", response_model=TaskResponse)
async def trigger_contradiction_detection(
    limit: int = Query(default=50, le=200),
    queue: TaskQueue = Depends(get_task_queue),
):
    """Trigger contradiction detection."""
    task = Task(
        id=str(uuid4()),
        type=TaskType.DETECT_CONTRADICTIONS,
        status=TaskStatus.PENDING,
        priority=4,
        payload={"limit": limit},
    )

    await queue.add(task)

    return TaskResponse(
        id=task.id,
        type=task.type.value,
        status=task.status.value,
        priority=task.priority,
        created_at=task.created_at.isoformat() if task.created_at else None,
    )


@router.post("/identify-trends", response_model=TaskResponse)
async def trigger_trend_identification(
    queue: TaskQueue = Depends(get_task_queue),
):
    """Trigger trend identification."""
    task = Task(
        id=str(uuid4()),
        type=TaskType.IDENTIFY_TRENDS,
        status=TaskStatus.PENDING,
        priority=4,
        payload={},
    )

    await queue.add(task)

    return TaskResponse(
        id=task.id,
        type=task.type.value,
        status=task.status.value,
        priority=task.priority,
        created_at=task.created_at.isoformat() if task.created_at else None,
    )


@router.post("/generate-predictions", response_model=TaskResponse)
async def trigger_prediction_generation(
    queue: TaskQueue = Depends(get_task_queue),
):
    """Trigger prediction generation."""
    task = Task(
        id=str(uuid4()),
        type=TaskType.GENERATE_PREDICTIONS,
        status=TaskStatus.PENDING,
        priority=4,
        payload={},
    )

    await queue.add(task)

    return TaskResponse(
        id=task.id,
        type=task.type.value,
        status=task.status.value,
        priority=task.priority,
        created_at=task.created_at.isoformat() if task.created_at else None,
    )


@router.get("/thoughts")
async def get_recent_thoughts(
    agent_name: str | None = None,
    limit: int = Query(default=50, le=200),
    store: ThoughtSignatureStore = Depends(get_thought_store),
):
    """Get recent thought signatures."""
    thoughts = await store.get_recent(agent_name=agent_name, limit=limit)

    return [
        {
            "id": t.id,
            "agent_name": t.agent_name,
            "task_id": t.task_id,
            "context_summary": t.context_summary,
            "decision_made": t.decision_made,
            "confidence": t.confidence,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in thoughts
    ]


@router.get("/thoughts/{thought_id}")
async def get_thought(
    thought_id: str,
    store: ThoughtSignatureStore = Depends(get_thought_store),
):
    """Get a specific thought signature."""
    thoughts = await store.get_recent(limit=1000)  # Would add get_by_id method
    thought = next((t for t in thoughts if t.id == thought_id), None)

    if not thought:
        raise HTTPException(status_code=404, detail="Thought signature not found")

    return {
        "id": thought.id,
        "agent_name": thought.agent_name,
        "task_id": thought.task_id,
        "context_summary": thought.context_summary,
        "decision_made": thought.decision_made,
        "reasoning": thought.reasoning,
        "confidence": thought.confidence,
        "assumptions": thought.assumptions,
        "expected_outcomes": thought.expected_outcomes,
        "actual_outcomes": thought.actual_outcomes,
        "created_at": thought.created_at.isoformat() if thought.created_at else None,
    }


# ============================================================================
# DSPy Analysis Endpoints
# ============================================================================


class DSPyOptimizeRequest(BaseModel):
    """Request to optimize DSPy modules."""
    training_data_path: str | None = None  # Load custom training data
    use_seed_examples: bool = True  # Use built-in seed examples
    max_bootstrapped_demos: int = 3
    save_path: str = "models/dspy_optimized.json"


class DSPyStatusResponse(BaseModel):
    """DSPy module status response."""
    enabled: bool
    optimized: bool
    training_examples: int
    model: str


@router.get("/dspy/status", response_model=DSPyStatusResponse)
async def get_dspy_status():
    """Get DSPy analysis module status."""
    from src.config import settings

    if not settings.use_dspy:
        return DSPyStatusResponse(
            enabled=False,
            optimized=False,
            training_examples=0,
            model=settings.gemini_model,
        )

    try:
        from src.dspy_analysis import get_dspy_client
        client = get_dspy_client()

        return DSPyStatusResponse(
            enabled=True,
            optimized=client._optimized,
            training_examples=len(client._training_examples),
            model=client.model_name,
        )
    except Exception as e:
        return DSPyStatusResponse(
            enabled=False,
            optimized=False,
            training_examples=0,
            model=settings.gemini_model,
        )


@router.post("/dspy/optimize")
async def optimize_dspy_modules(request: DSPyOptimizeRequest):
    """Optimize DSPy modules using training data.

    This uses DSPy's BootstrapFewShot optimizer to improve extraction quality
    based on provided examples.
    """
    from src.config import settings

    if not settings.use_dspy:
        raise HTTPException(status_code=400, detail="DSPy is not enabled. Set USE_DSPY=true in environment.")

    try:
        from src.dspy_analysis import get_dspy_client
        from src.dspy_analysis.training import (
            create_training_examples,
            load_training_data,
            extraction_quality_metric,
        )

        client = get_dspy_client()

        # Load training examples
        examples = []

        if request.use_seed_examples:
            examples.extend(create_training_examples())

        if request.training_data_path:
            custom_examples = load_training_data(request.training_data_path)
            examples.extend(custom_examples)

        if not examples:
            raise HTTPException(
                status_code=400,
                detail="No training examples available. Enable seed examples or provide training data path."
            )

        # Add examples to client
        for ex in examples:
            client._training_examples.append(ex)

        # Run optimization
        client.optimize(
            metric=extraction_quality_metric,
            max_bootstrapped_demos=request.max_bootstrapped_demos,
        )

        # Save optimized modules
        client.save_optimized(request.save_path)

        return {
            "success": True,
            "message": f"DSPy modules optimized with {len(examples)} examples",
            "saved_to": request.save_path,
            "training_examples": len(examples),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")


@router.post("/dspy/load")
async def load_optimized_dspy(model_path: str = "models/dspy_optimized.json"):
    """Load previously optimized DSPy modules."""
    from src.config import settings

    if not settings.use_dspy:
        raise HTTPException(status_code=400, detail="DSPy is not enabled")

    try:
        from src.dspy_analysis import get_dspy_client
        from pathlib import Path

        if not Path(model_path).exists():
            raise HTTPException(status_code=404, detail=f"Model file not found: {model_path}")

        client = get_dspy_client()
        client.load_optimized(model_path)

        return {
            "success": True,
            "message": f"Loaded optimized DSPy modules from {model_path}",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load: {str(e)}")
