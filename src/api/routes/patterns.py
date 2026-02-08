"""Pattern management API routes."""

from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from src.api.deps import get_task_queue, get_kg
from src.kg import KnowledgeGraph
from src.models import Task, TaskType, TaskStatus
from src.orchestrator.state import TaskQueue

router = APIRouter(prefix="/patterns", tags=["Patterns"])


class ExtractPatternsRequest(BaseModel):
    limit: int = 50


class MatchPatternsRequest(BaseModel):
    title: str
    abstract: str
    techniques: list[dict[str, Any]] | None = None


class PatternResponse(BaseModel):
    id: str
    name: str
    pattern_type: str
    template: str
    description: str
    key_components: list[str]
    common_techniques: list[str]
    domains: list[str]
    frequency: int
    novelty_score: float | None
    effectiveness_score: float | None


@router.get("")
async def get_patterns(
    limit: int = Query(default=50, le=200),
    pattern_type: str | None = None,
    domain: str | None = None,
    kg: KnowledgeGraph = Depends(get_kg),
):
    """Get all patterns from the knowledge graph."""
    patterns = await kg.get_patterns(limit=limit)

    # Filter by type if specified
    if pattern_type:
        patterns = [p for p in patterns if p.pattern_type == pattern_type]

    # Filter by domain if specified
    if domain:
        patterns = [p for p in patterns if domain in p.domains]

    return [
        {
            "id": p.id,
            "name": p.name,
            "pattern_type": p.pattern_type,
            "template": p.template,
            "description": p.description,
            "key_components": p.key_components,
            "common_techniques": p.common_techniques,
            "example_applications": p.example_applications,
            "domains": p.domains,
            "frequency": p.frequency,
            "novelty_score": p.novelty_score,
            "effectiveness_score": p.effectiveness_score,
        }
        for p in patterns
    ]


@router.get("/{pattern_id}")
async def get_pattern(
    pattern_id: str,
    kg: KnowledgeGraph = Depends(get_kg),
):
    """Get a specific pattern by ID."""
    pattern = await kg.get_pattern(pattern_id)

    if not pattern:
        raise HTTPException(status_code=404, detail="Pattern not found")

    # Get papers that follow this pattern
    papers = await kg.get_papers_by_pattern(pattern_id, limit=20)

    return {
        "id": pattern.id,
        "name": pattern.name,
        "pattern_type": pattern.pattern_type,
        "template": pattern.template,
        "description": pattern.description,
        "key_components": pattern.key_components,
        "common_techniques": pattern.common_techniques,
        "example_applications": pattern.example_applications,
        "domains": pattern.domains,
        "frequency": pattern.frequency,
        "novelty_score": pattern.novelty_score,
        "effectiveness_score": pattern.effectiveness_score,
        "papers": [
            {"id": p.id, "title": p.title}
            for p in papers
        ],
    }


@router.post("/extract")
async def trigger_pattern_extraction(
    request: ExtractPatternsRequest = ExtractPatternsRequest(),
    queue: TaskQueue = Depends(get_task_queue),
):
    """Trigger pattern extraction from existing papers and techniques."""
    task = Task(
        id=str(uuid4()),
        type=TaskType.CUSTOM,
        status=TaskStatus.PENDING,
        priority=4,
        payload={
            "agent": "patterns",
            "action": "extract",
            "limit": request.limit,
        },
    )

    await queue.add(task)

    return {
        "task_id": task.id,
        "status": "queued",
        "message": f"Pattern extraction queued for up to {request.limit} items",
    }


@router.post("/match")
async def match_paper_to_patterns(
    request: MatchPatternsRequest,
    kg: KnowledgeGraph = Depends(get_kg),
):
    """Match a paper to existing patterns.

    Returns patterns that the paper likely follows, with adherence scores.
    """
    from src.agents.patterns import PatternAgent

    agent = PatternAgent()
    matches = await agent.match_paper_to_patterns(
        title=request.title,
        abstract=request.abstract,
        techniques=request.techniques,
    )

    return {
        "paper_title": request.title,
        "matched_patterns": matches,
        "match_count": len(matches),
    }


@router.post("/cluster")
async def trigger_pattern_clustering(
    queue: TaskQueue = Depends(get_task_queue),
):
    """Trigger pattern clustering to identify related patterns."""
    task = Task(
        id=str(uuid4()),
        type=TaskType.CUSTOM,
        status=TaskStatus.PENDING,
        priority=3,
        payload={
            "agent": "patterns",
            "action": "cluster",
        },
    )

    await queue.add(task)

    return {
        "task_id": task.id,
        "status": "queued",
        "message": "Pattern clustering queued",
    }


@router.get("/types")
async def get_pattern_types():
    """Get available pattern types."""
    return {
        "types": [
            {"value": "methodology", "label": "Methodology", "description": "Research methodology patterns"},
            {"value": "architecture", "label": "Architecture", "description": "Model architecture patterns"},
            {"value": "training", "label": "Training", "description": "Training strategy patterns"},
            {"value": "data", "label": "Data", "description": "Data processing patterns"},
            {"value": "evaluation", "label": "Evaluation", "description": "Evaluation methodology patterns"},
        ]
    }
