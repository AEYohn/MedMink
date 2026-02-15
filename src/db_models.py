"""SQLAlchemy ORM models for clinical data persistence."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from src.db import Base

DEFAULT_TENANT = uuid.UUID("00000000-0000-0000-0000-000000000000")


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id = Column(Uuid, default=DEFAULT_TENANT, nullable=False, index=True)
    mrn = Column(String(50), index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(String(10), nullable=False)  # YYYY-MM-DD
    sex = Column(SAEnum("male", "female", "other", name="sex_enum"), nullable=False)
    phone = Column(String(20))
    email = Column(String(200))
    allergies = Column(JSONB, default=list)
    conditions = Column(JSONB, default=list)
    medications = Column(JSONB, default=list)
    status = Column(SAEnum("active", "inactive", name="patient_status_enum"), default="active", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    encounters = relationship("Encounter", back_populates="patient", lazy="selectin")
    documents = relationship("ClinicalDocument", back_populates="patient", lazy="selectin")


class Encounter(Base):
    __tablename__ = "encounters"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id = Column(Uuid, default=DEFAULT_TENANT, nullable=False, index=True)
    patient_id = Column(Uuid, ForeignKey("patients.id"), index=True)
    encounter_type = Column(String(50), default="case_analysis")
    title = Column(String(500))
    original_case_text = Column(Text)
    current_case_text = Column(Text)
    analysis_result = Column(JSONB)
    clinician_overrides = Column(JSONB)
    triage_result = Column(JSONB)
    status = Column(SAEnum("active", "completed", "archived", name="encounter_status_enum"), default="active")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    patient = relationship("Patient", back_populates="encounters")
    events = relationship("EncounterEvent", back_populates="encounter", lazy="selectin", order_by="EncounterEvent.sequence_num")
    documents = relationship("ClinicalDocument", back_populates="encounter", lazy="selectin")
    images = relationship("MedicalImage", back_populates="encounter", lazy="selectin")
    labs = relationship("LabResult", back_populates="encounter", lazy="selectin")


class EncounterEvent(Base):
    __tablename__ = "encounter_events"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    encounter_id = Column(Uuid, ForeignKey("encounters.id"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)  # initial_analysis, new_findings, reassessment, chat_message, note
    sequence_num = Column(Integer, default=0)
    role = Column(String(20))  # user, assistant, system
    message_content = Column(Text)
    metadata_ = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    encounter = relationship("Encounter", back_populates="events")


class ClinicalDocument(Base):
    __tablename__ = "clinical_documents"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id = Column(Uuid, default=DEFAULT_TENANT, nullable=False, index=True)
    encounter_id = Column(Uuid, ForeignKey("encounters.id"), index=True)
    patient_id = Column(Uuid, ForeignKey("patients.id"), index=True)
    doc_type = Column(String(50), nullable=False)  # discharge_summary, soap_note, referral, imaging_report, lab_report
    title = Column(String(500))
    content = Column(JSONB)
    raw_text = Column(Text)
    status = Column(SAEnum("draft", "final", "amended", name="doc_status_enum"), default="draft")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    encounter = relationship("Encounter", back_populates="documents")
    patient = relationship("Patient", back_populates="documents")


class MedicalImage(Base):
    __tablename__ = "medical_images"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id = Column(Uuid, default=DEFAULT_TENANT, nullable=False, index=True)
    encounter_id = Column(Uuid, ForeignKey("encounters.id"), index=True)
    modality = Column(String(50))  # xray, ct, dermoscopy, pathology
    storage_path = Column(String(1000))
    analysis_result = Column(JSONB)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    encounter = relationship("Encounter", back_populates="images")


class LabResult(Base):
    __tablename__ = "lab_results"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id = Column(Uuid, default=DEFAULT_TENANT, nullable=False, index=True)
    encounter_id = Column(Uuid, ForeignKey("encounters.id"), index=True)
    collection_date = Column(DateTime)
    values = Column(JSONB)  # Extracted lab values
    raw_text = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    encounter = relationship("Encounter", back_populates="labs")
