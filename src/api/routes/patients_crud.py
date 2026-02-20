"""Patient CRUD API endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db import get_db
from src.db_models import Patient

router = APIRouter(prefix="/api/patients", tags=["patients"])


class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: str
    sex: str
    mrn: str | None = None
    phone: str | None = None
    email: str | None = None
    allergies: list[str] = []
    conditions: list[str] = []
    medications: list[str] = []


class PatientUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    date_of_birth: str | None = None
    sex: str | None = None
    mrn: str | None = None
    phone: str | None = None
    email: str | None = None
    allergies: list[str] | None = None
    conditions: list[str] | None = None
    medications: list[str] | None = None
    status: str | None = None


class PatientResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    date_of_birth: str
    sex: str
    mrn: str | None
    phone: str | None
    email: str | None
    allergies: list[str]
    conditions: list[str]
    medications: list[str]
    status: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


def _to_response(p: Patient) -> PatientResponse:
    return PatientResponse(
        id=str(p.id),
        first_name=p.first_name,
        last_name=p.last_name,
        date_of_birth=p.date_of_birth,
        sex=p.sex,
        mrn=p.mrn,
        phone=p.phone,
        email=p.email,
        allergies=p.allergies or [],
        conditions=p.conditions or [],
        medications=p.medications or [],
        status=p.status,
        created_at=p.created_at.isoformat(),
        updated_at=p.updated_at.isoformat(),
    )


@router.get("", response_model=list[PatientResponse])
async def list_patients(
    status: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Patient).order_by(Patient.updated_at.desc())
    if status:
        query = query.where(Patient.status == status)
    if search:
        like = f"%{search}%"
        query = query.where(
            Patient.first_name.ilike(like) | Patient.last_name.ilike(like) | Patient.mrn.ilike(like)
        )
    result = await db.execute(query)
    return [_to_response(p) for p in result.scalars().all()]


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(patient_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Patient).where(Patient.id == uuid.UUID(patient_id)))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return _to_response(patient)


@router.post("", response_model=PatientResponse, status_code=201)
async def create_patient(data: PatientCreate, db: AsyncSession = Depends(get_db)):
    patient = Patient(
        first_name=data.first_name,
        last_name=data.last_name,
        date_of_birth=data.date_of_birth,
        sex=data.sex,
        mrn=data.mrn,
        phone=data.phone,
        email=data.email,
        allergies=data.allergies,
        conditions=data.conditions,
        medications=data.medications,
    )
    db.add(patient)
    await db.flush()
    await db.refresh(patient)
    return _to_response(patient)


@router.patch("/{patient_id}", response_model=PatientResponse)
async def update_patient(patient_id: str, data: PatientUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Patient).where(Patient.id == uuid.UUID(patient_id)))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(patient, field, value)

    await db.flush()
    await db.refresh(patient)
    return _to_response(patient)


@router.delete("/{patient_id}", status_code=204)
async def delete_patient(patient_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Patient).where(Patient.id == uuid.UUID(patient_id)))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    await db.delete(patient)
