"""Clinical document CRUD API endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db import get_db
from src.db_models import ClinicalDocument

router = APIRouter(prefix="/api/documents", tags=["documents"])


class DocumentCreate(BaseModel):
    doc_type: str
    title: str
    content: dict | str | None = None
    raw_text: str | None = None
    encounter_id: str | None = None
    patient_id: str | None = None
    status: str = "draft"


class DocumentUpdate(BaseModel):
    title: str | None = None
    content: dict | str | None = None
    raw_text: str | None = None
    status: str | None = None


class DocumentResponse(BaseModel):
    id: str
    doc_type: str
    title: str
    content: dict | str | None
    raw_text: str | None
    encounter_id: str | None
    patient_id: str | None
    status: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


def _to_response(d: ClinicalDocument) -> DocumentResponse:
    return DocumentResponse(
        id=str(d.id),
        doc_type=d.doc_type,
        title=d.title or "",
        content=d.content,
        raw_text=d.raw_text,
        encounter_id=str(d.encounter_id) if d.encounter_id else None,
        patient_id=str(d.patient_id) if d.patient_id else None,
        status=d.status or "draft",
        created_at=d.created_at.isoformat(),
        updated_at=d.updated_at.isoformat(),
    )


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    doc_type: str | None = None,
    encounter_id: str | None = None,
    patient_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(ClinicalDocument).order_by(ClinicalDocument.updated_at.desc())
    if doc_type:
        query = query.where(ClinicalDocument.doc_type == doc_type)
    if encounter_id:
        query = query.where(ClinicalDocument.encounter_id == uuid.UUID(encounter_id))
    if patient_id:
        query = query.where(ClinicalDocument.patient_id == uuid.UUID(patient_id))
    result = await db.execute(query)
    return [_to_response(d) for d in result.scalars().all()]


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ClinicalDocument).where(ClinicalDocument.id == uuid.UUID(document_id))
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return _to_response(doc)


@router.post("", response_model=DocumentResponse, status_code=201)
async def create_document(data: DocumentCreate, db: AsyncSession = Depends(get_db)):
    # Handle content: if string, store in raw_text; if dict, store in content
    content_val = data.content if isinstance(data.content, dict) else None
    raw_text_val = data.raw_text or (data.content if isinstance(data.content, str) else None)

    doc = ClinicalDocument(
        doc_type=data.doc_type,
        title=data.title,
        content=content_val,
        raw_text=raw_text_val,
        encounter_id=uuid.UUID(data.encounter_id) if data.encounter_id else None,
        patient_id=uuid.UUID(data.patient_id) if data.patient_id else None,
        status=data.status,
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)
    return _to_response(doc)


@router.patch("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: str, data: DocumentUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ClinicalDocument).where(ClinicalDocument.id == uuid.UUID(document_id))
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    update_data = data.model_dump(exclude_unset=True)
    if "content" in update_data:
        val = update_data.pop("content")
        if isinstance(val, dict):
            doc.content = val
        elif isinstance(val, str):
            doc.raw_text = val

    for field, value in update_data.items():
        setattr(doc, field, value)

    await db.flush()
    await db.refresh(doc)
    return _to_response(doc)
