"""Human review API routes."""

from datetime import datetime
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db_session, get_kg
from src.kg import KnowledgeGraph

router = APIRouter(prefix="/review", tags=["Human Review"])


class ReviewItemResponse(BaseModel):
    id: str
    item_type: str
    item_id: str
    reason: str
    priority: int
    status: str
    reviewer_notes: str | None
    created_at: str | None


class ReviewDecisionRequest(BaseModel):
    status: str  # approved, rejected, modified
    notes: str | None = None


class CreateReviewItemRequest(BaseModel):
    item_type: str
    item_id: str
    reason: str
    priority: int = 5


@router.get("/items", response_model=list[ReviewItemResponse])
async def get_review_items(
    status: str = Query(default="pending"),
    item_type: str | None = None,
    limit: int = Query(default=50, le=200),
    session: AsyncSession = Depends(get_db_session),
):
    """Get items in the review queue."""
    query = """
        SELECT id, item_type, item_id, reason, priority, status, reviewer_notes, created_at
        FROM review_items
        WHERE status = :status
    """
    params: dict[str, Any] = {"status": status}

    if item_type:
        query += " AND item_type = :item_type"
        params["item_type"] = item_type

    query += " ORDER BY priority DESC, created_at ASC LIMIT :limit"
    params["limit"] = limit

    result = await session.execute(text(query), params)
    rows = result.fetchall()

    return [
        ReviewItemResponse(
            id=row[0],
            item_type=row[1],
            item_id=row[2],
            reason=row[3],
            priority=row[4],
            status=row[5],
            reviewer_notes=row[6],
            created_at=row[7].isoformat() if row[7] else None,
        )
        for row in rows
    ]


@router.get("/items/{item_id}")
async def get_review_item(
    item_id: str,
    session: AsyncSession = Depends(get_db_session),
    kg: KnowledgeGraph = Depends(get_kg),
):
    """Get a review item with full details."""
    result = await session.execute(
        text(
            """
            SELECT id, item_type, item_id, reason, priority, status, reviewer_notes, created_at
            FROM review_items
            WHERE id = :id
        """
        ),
        {"id": item_id},
    )
    row = result.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Review item not found")

    # Get the actual item based on type
    item_details = None
    if row[1] == "contradiction":
        contradictions = await kg.get_contradictions(limit=100)
        for c in contradictions:
            if c["claim1"].id == row[2] or c["claim2"].id == row[2]:
                item_details = {
                    "claim1": {
                        "id": c["claim1"].id,
                        "statement": c["claim1"].statement,
                        "category": c["claim1"].category,
                    },
                    "claim2": {
                        "id": c["claim2"].id,
                        "statement": c["claim2"].statement,
                        "category": c["claim2"].category,
                    },
                    "strength": c["relation"].get("strength"),
                    "explanation": c["relation"].get("explanation"),
                }
                break

    elif row[1] == "prediction":
        predictions = await kg.get_pending_predictions()
        for p in predictions:
            if p.id == row[2]:
                item_details = {
                    "id": p.id,
                    "statement": p.statement,
                    "confidence": p.confidence,
                    "timeframe": p.timeframe,
                    "due_date": p.due_date.isoformat() if p.due_date else None,
                }
                break

    elif row[1] == "claim":
        claims = await kg.get_all_claims(limit=500)
        for c in claims:
            if c.id == row[2]:
                item_details = {
                    "id": c.id,
                    "statement": c.statement,
                    "category": c.category,
                    "confidence": c.confidence,
                    "status": c.status,
                }
                break

    return {
        "review_item": ReviewItemResponse(
            id=row[0],
            item_type=row[1],
            item_id=row[2],
            reason=row[3],
            priority=row[4],
            status=row[5],
            reviewer_notes=row[6],
            created_at=row[7].isoformat() if row[7] else None,
        ),
        "item_details": item_details,
    }


@router.post("/items/{item_id}/decision")
async def submit_review_decision(
    item_id: str,
    decision: ReviewDecisionRequest,
    session: AsyncSession = Depends(get_db_session),
    kg: KnowledgeGraph = Depends(get_kg),
):
    """Submit a review decision."""
    # Validate status
    valid_statuses = ["approved", "rejected", "modified"]
    if decision.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {valid_statuses}",
        )

    # Get the review item
    result = await session.execute(
        text("SELECT item_type, item_id FROM review_items WHERE id = :id"),
        {"id": item_id},
    )
    row = result.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Review item not found")

    item_type, referenced_id = row

    # Update the review item
    await session.execute(
        text(
            """
            UPDATE review_items
            SET status = :status, reviewer_notes = :notes, reviewed_at = NOW()
            WHERE id = :id
        """
        ),
        {"id": item_id, "status": decision.status, "notes": decision.notes},
    )

    # Apply the decision to the actual item
    if decision.status == "approved":
        # Keep as is
        pass
    elif decision.status == "rejected":
        # For contradictions, remove the relationship
        # For predictions, mark as incorrect
        if item_type == "prediction":
            await kg.update_prediction_outcome(
                prediction_id=referenced_id,
                outcome="incorrect",
                outcome_details=f"Rejected by reviewer: {decision.notes}",
            )
        elif item_type == "claim":
            await kg.update_claim_status(referenced_id, "refuted")

    await session.commit()

    return {"message": "Review decision recorded", "item_id": item_id, "status": decision.status}


@router.post("/items", response_model=ReviewItemResponse)
async def create_review_item(
    request: CreateReviewItemRequest,
    session: AsyncSession = Depends(get_db_session),
):
    """Create a new review item."""
    item_id = str(uuid4())

    await session.execute(
        text(
            """
            INSERT INTO review_items (id, item_type, item_id, reason, priority, status, created_at)
            VALUES (:id, :item_type, :item_id, :reason, :priority, 'pending', NOW())
        """
        ),
        {
            "id": item_id,
            "item_type": request.item_type,
            "item_id": request.item_id,
            "reason": request.reason,
            "priority": request.priority,
        },
    )
    await session.commit()

    return ReviewItemResponse(
        id=item_id,
        item_type=request.item_type,
        item_id=request.item_id,
        reason=request.reason,
        priority=request.priority,
        status="pending",
        reviewer_notes=None,
        created_at=datetime.utcnow().isoformat(),
    )


@router.get("/stats")
async def get_review_stats(session: AsyncSession = Depends(get_db_session)):
    """Get review queue statistics."""
    result = await session.execute(
        text(
            """
            SELECT
                status,
                item_type,
                COUNT(*) as count
            FROM review_items
            GROUP BY status, item_type
        """
        )
    )
    rows = result.fetchall()

    stats = {
        "by_status": {},
        "by_type": {},
        "total_pending": 0,
    }

    for row in rows:
        status, item_type, count = row

        if status not in stats["by_status"]:
            stats["by_status"][status] = 0
        stats["by_status"][status] += count

        if item_type not in stats["by_type"]:
            stats["by_type"][item_type] = 0
        stats["by_type"][item_type] += count

        if status == "pending":
            stats["total_pending"] += count

    return stats
