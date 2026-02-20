"""Project analysis API routes."""

from typing import Any
from uuid import uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from src.api.deps import get_kg, get_task_queue
from src.kg import KnowledgeGraph
from src.models import Task, TaskStatus, TaskType
from src.orchestrator.state import TaskQueue

logger = structlog.get_logger()

router = APIRouter(prefix="/projects", tags=["Projects"])


# Request/Response models


class AnalyzeProjectRequest(BaseModel):
    url: str
    name: str | None = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    url: str
    source: str
    description: str
    status: str
    created_at: str | None


class ProblemResponse(BaseModel):
    id: str
    statement: str
    category: str
    details: str
    priority: int


class ApproachResponse(BaseModel):
    id: str
    name: str
    description: str
    priority: int
    confidence: float
    reasoning: str | None
    challenges: list[str]
    mitigations: list[str]


class ProjectDetailResponse(BaseModel):
    project: ProjectResponse
    problems: list[ProblemResponse]
    approaches: list[ApproachResponse]
    papers: list[dict[str, Any]]
    synthesis: dict[str, Any] | None


class ProjectGraphResponse(BaseModel):
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]


class TaskResponse(BaseModel):
    id: str
    type: str
    status: str
    project_id: str


# Endpoints


@router.post("/analyze", response_model=TaskResponse)
async def analyze_project(
    request: AnalyzeProjectRequest,
    queue: TaskQueue = Depends(get_task_queue),
    kg: KnowledgeGraph = Depends(get_kg),
):
    """
    Submit a project URL for analysis.

    This creates a task that will:
    1. Fetch and parse the project page
    2. Extract problem components
    3. Search for relevant papers
    4. Build a knowledge graph
    5. Synthesize solution approaches
    """
    from datetime import datetime

    from src.kg.models import ProjectNode

    # Detect source from URL
    source = "custom"
    url_lower = request.url.lower()
    if "kaggle.com" in url_lower:
        source = "kaggle"
    elif "github.com" in url_lower:
        source = "github"

    # Extract name from URL if not provided
    name = request.name
    if not name:
        from urllib.parse import urlparse

        parsed = urlparse(request.url)
        path_parts = [p for p in parsed.path.split("/") if p]
        if path_parts:
            name = path_parts[-1].replace("-", " ").replace("_", " ").title()
        else:
            name = "Unnamed Project"

    # Create project node first (in pending state)
    project = ProjectNode(
        id=str(uuid4()),
        name=name,
        url=request.url,
        source=source,
        status="pending",
        created_at=datetime.utcnow(),
    )

    try:
        await kg.add_project(project)
    except Exception as e:
        logger.error("Failed to create project", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}") from e

    # Create analysis task
    task = Task(
        id=str(uuid4()),
        type=TaskType.PROJECT_ANALYZE,
        status=TaskStatus.PENDING,
        priority=6,
        payload={
            "project_id": project.id,
            "url": request.url,
            "name": name,
        },
    )

    await queue.add(task)

    logger.info("Project analysis task created", project_id=project.id, task_id=task.id)

    return TaskResponse(
        id=task.id,
        type=task.type.value,
        status=task.status.value,
        project_id=project.id,
    )


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    limit: int = Query(default=50, le=200),
    status: str | None = Query(default=None),
    kg: KnowledgeGraph = Depends(get_kg),
):
    """Get all analyzed projects."""
    try:
        projects = await kg.get_projects(limit=limit, status=status)

        return [
            ProjectResponse(
                id=p.id,
                name=p.name,
                url=p.url,
                source=p.source,
                description=p.description,
                status=p.status,
                created_at=p.created_at.isoformat() if p.created_at else None,
            )
            for p in projects
        ]
    except Exception as e:
        logger.error("Failed to get projects", error=str(e))
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project_id: str,
    kg: KnowledgeGraph = Depends(get_kg),
):
    """Get detailed information about a project including problems, papers, and synthesis."""
    project = await kg.get_project(project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get problems
    problems = await kg.get_problems_for_project(project_id)

    # Get approaches
    driver = await kg._get_driver()
    async with driver.session() as session:
        result = await session.run(
            """
            MATCH (p:Project {id: $project_id})-[:HAS_APPROACH]->(a:Approach)
            RETURN a
            ORDER BY a.priority DESC
            """,
            project_id=project_id,
        )
        records = await result.data()
        approaches = [kg._record_to_approach(r["a"]) for r in records]

    # Get linked papers with relevance
    papers = []
    async with driver.session() as session:
        result = await session.run(
            """
            MATCH (p:Project {id: $project_id})-[:HAS_PROBLEM]->(prob:Problem)
            MATCH (prob)-[r:ADDRESSED_BY]->(paper:Paper)
            RETURN paper, r.relevance as relevance, r.explanation as explanation
            ORDER BY r.relevance DESC
            """,
            project_id=project_id,
        )
        records = await result.data()
        seen_papers = set()
        for r in records:
            paper = r["paper"]
            if paper["id"] not in seen_papers:
                papers.append(
                    {
                        "id": paper["id"],
                        "title": paper.get("title", ""),
                        "abstract": paper.get("abstract", "")[:500],
                        "arxiv_id": paper.get("arxiv_id", ""),
                        "relevance": r["relevance"],
                        "explanation": r["explanation"],
                    }
                )
                seen_papers.add(paper["id"])

    # Build synthesis summary
    synthesis = None
    if approaches:
        synthesis = {
            "recommended_approach": approaches[0].name if approaches else None,
            "approach_count": len(approaches),
            "paper_count": len(papers),
            "key_techniques": [],
        }

        # Get techniques from approaches
        for approach in approaches[:3]:
            async with driver.session() as session:
                result = await session.run(
                    """
                    MATCH (a:Approach {id: $approach_id})-[:USES_TECHNIQUE]->(m:Method)
                    RETURN m.name as name
                    """,
                    approach_id=approach.id,
                )
                records = await result.data()
                for r in records:
                    if r["name"] not in synthesis["key_techniques"]:
                        synthesis["key_techniques"].append(r["name"])

    return ProjectDetailResponse(
        project=ProjectResponse(
            id=project.id,
            name=project.name,
            url=project.url,
            source=project.source,
            description=project.description,
            status=project.status,
            created_at=project.created_at.isoformat() if project.created_at else None,
        ),
        problems=[
            ProblemResponse(
                id=p.id,
                statement=p.statement,
                category=p.category,
                details=p.details,
                priority=p.priority,
            )
            for p in problems
        ],
        approaches=[
            ApproachResponse(
                id=a.id,
                name=a.name,
                description=a.description,
                priority=a.priority,
                confidence=a.confidence,
                reasoning=a.reasoning,
                challenges=a.challenges,
                mitigations=a.mitigations,
            )
            for a in approaches
        ],
        papers=papers,
        synthesis=synthesis,
    )


@router.get("/{project_id}/graph", response_model=ProjectGraphResponse)
async def get_project_graph(
    project_id: str,
    kg: KnowledgeGraph = Depends(get_kg),
):
    """Get the knowledge graph data for a project, suitable for visualization."""
    project = await kg.get_project(project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    graph_data = await kg.get_project_graph(project_id)

    return ProjectGraphResponse(
        nodes=graph_data.get("nodes", []),
        edges=graph_data.get("edges", []),
    )


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    kg: KnowledgeGraph = Depends(get_kg),
):
    """Delete a project and all its related data."""
    project = await kg.get_project(project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    driver = await kg._get_driver()
    async with driver.session() as session:
        # Delete all related nodes and the project
        await session.run(
            """
            MATCH (p:Project {id: $project_id})
            OPTIONAL MATCH (p)-[:HAS_PROBLEM]->(prob:Problem)
            OPTIONAL MATCH (p)-[:HAS_APPROACH]->(app:Approach)
            DETACH DELETE prob, app, p
            """,
            project_id=project_id,
        )

    logger.info("Project deleted", project_id=project_id)

    return {"status": "deleted", "project_id": project_id}


@router.post("/{project_id}/reanalyze", response_model=TaskResponse)
async def reanalyze_project(
    project_id: str,
    queue: TaskQueue = Depends(get_task_queue),
    kg: KnowledgeGraph = Depends(get_kg),
):
    """Re-run analysis on an existing project."""
    project = await kg.get_project(project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Reset project status
    await kg.update_project_status(project_id, "pending")

    # Create new analysis task
    task = Task(
        id=str(uuid4()),
        type=TaskType.PROJECT_ANALYZE,
        status=TaskStatus.PENDING,
        priority=6,
        payload={
            "project_id": project_id,
            "url": project.url,
            "name": project.name,
        },
    )

    await queue.add(task)

    logger.info("Project reanalysis task created", project_id=project_id, task_id=task.id)

    return TaskResponse(
        id=task.id,
        type=task.type.value,
        status=task.status.value,
        project_id=project_id,
    )
