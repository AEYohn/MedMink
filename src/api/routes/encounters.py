"""Encounter CRUD API endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db import get_db
from src.db_models import Encounter, EncounterEvent

router = APIRouter(prefix="/api/encounters", tags=["encounters"])


class EncounterCreate(BaseModel):
    patient_id: str | None = None
    encounter_type: str = "case_analysis"
    title: str | None = None
    original_case_text: str | None = None
    current_case_text: str | None = None
    analysis_result: dict | None = None
    clinician_overrides: dict | None = None


class EncounterUpdate(BaseModel):
    title: str | None = None
    current_case_text: str | None = None
    analysis_result: dict | None = None
    clinician_overrides: dict | None = None
    triage_result: dict | None = None
    status: str | None = None


class EventCreate(BaseModel):
    event_type: str
    role: str | None = None
    message_content: str | None = None
    metadata: dict | None = None


class EncounterResponse(BaseModel):
    id: str
    patient_id: str | None
    encounter_type: str
    title: str | None
    original_case_text: str | None
    current_case_text: str | None
    analysis_result: dict | None
    clinician_overrides: dict | None
    status: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class EventResponse(BaseModel):
    id: str
    encounter_id: str
    event_type: str
    sequence_num: int
    role: str | None
    message_content: str | None
    metadata: dict | None
    created_at: str

    model_config = {"from_attributes": True}


def _enc_to_response(e: Encounter) -> EncounterResponse:
    return EncounterResponse(
        id=str(e.id),
        patient_id=str(e.patient_id) if e.patient_id else None,
        encounter_type=e.encounter_type or "case_analysis",
        title=e.title,
        original_case_text=e.original_case_text,
        current_case_text=e.current_case_text,
        analysis_result=e.analysis_result,
        clinician_overrides=e.clinician_overrides,
        status=e.status or "active",
        created_at=e.created_at.isoformat(),
        updated_at=e.updated_at.isoformat(),
    )


def _event_to_response(ev: EncounterEvent) -> EventResponse:
    return EventResponse(
        id=str(ev.id),
        encounter_id=str(ev.encounter_id),
        event_type=ev.event_type,
        sequence_num=ev.sequence_num or 0,
        role=ev.role,
        message_content=ev.message_content,
        metadata=ev.metadata_,
        created_at=ev.created_at.isoformat(),
    )


@router.get("", response_model=list[EncounterResponse])
async def list_encounters(
    patient_id: str | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Encounter).order_by(Encounter.updated_at.desc())
    if patient_id:
        query = query.where(Encounter.patient_id == uuid.UUID(patient_id))
    if status:
        query = query.where(Encounter.status == status)
    result = await db.execute(query)
    return [_enc_to_response(e) for e in result.scalars().all()]


@router.get("/{encounter_id}", response_model=EncounterResponse)
async def get_encounter(encounter_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Encounter).where(Encounter.id == uuid.UUID(encounter_id)))
    enc = result.scalar_one_or_none()
    if not enc:
        raise HTTPException(status_code=404, detail="Encounter not found")
    return _enc_to_response(enc)


@router.post("", response_model=EncounterResponse, status_code=201)
async def create_encounter(data: EncounterCreate, db: AsyncSession = Depends(get_db)):
    enc = Encounter(
        patient_id=uuid.UUID(data.patient_id) if data.patient_id else None,
        encounter_type=data.encounter_type,
        title=data.title,
        original_case_text=data.original_case_text,
        current_case_text=data.current_case_text,
        analysis_result=data.analysis_result,
        clinician_overrides=data.clinician_overrides,
    )
    db.add(enc)
    await db.flush()
    await db.refresh(enc)
    return _enc_to_response(enc)


@router.patch("/{encounter_id}", response_model=EncounterResponse)
async def update_encounter(
    encounter_id: str, data: EncounterUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Encounter).where(Encounter.id == uuid.UUID(encounter_id)))
    enc = result.scalar_one_or_none()
    if not enc:
        raise HTTPException(status_code=404, detail="Encounter not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(enc, field, value)

    await db.flush()
    await db.refresh(enc)
    return _enc_to_response(enc)


@router.delete("/{encounter_id}", status_code=204)
async def delete_encounter(encounter_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Encounter).where(Encounter.id == uuid.UUID(encounter_id)))
    enc = result.scalar_one_or_none()
    if not enc:
        raise HTTPException(status_code=404, detail="Encounter not found")
    await db.delete(enc)


# --- Events ---


@router.get("/{encounter_id}/events", response_model=list[EventResponse])
async def list_events(encounter_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EncounterEvent)
        .where(EncounterEvent.encounter_id == uuid.UUID(encounter_id))
        .order_by(EncounterEvent.sequence_num)
    )
    return [_event_to_response(ev) for ev in result.scalars().all()]


@router.post("/{encounter_id}/events", response_model=EventResponse, status_code=201)
async def create_event(encounter_id: str, data: EventCreate, db: AsyncSession = Depends(get_db)):
    # Get next sequence number
    result = await db.execute(
        select(EncounterEvent)
        .where(EncounterEvent.encounter_id == uuid.UUID(encounter_id))
        .order_by(EncounterEvent.sequence_num.desc())
        .limit(1)
    )
    last = result.scalar_one_or_none()
    next_seq = (last.sequence_num + 1) if last else 0

    event = EncounterEvent(
        encounter_id=uuid.UUID(encounter_id),
        event_type=data.event_type,
        sequence_num=next_seq,
        role=data.role,
        message_content=data.message_content,
        metadata_=data.metadata or {},
    )
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return _event_to_response(event)
