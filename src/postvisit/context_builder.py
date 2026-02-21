"""Builds full patient context for the PostVisit AI companion.

Aggregates data from the released visit summary, patient record,
encounter history, lab results, visit tracker, and recent vitals
into a structured context string for the LLM.
"""

import json
from typing import Any

import structlog

from src.db import AsyncSessionLocal
from src.db_models import Encounter, LabResult, Patient
from src.medgemma.visit_tracker import get_visit_tracker

logger = structlog.get_logger()


async def _load_patient(patient_id: str) -> dict[str, Any] | None:
    """Load patient demographics from DB."""
    from sqlalchemy import select
    from sqlalchemy.dialects.postgresql import UUID

    try:
        async with AsyncSessionLocal() as session:
            stmt = select(Patient).where(Patient.id == patient_id)
            result = await session.execute(stmt)
            patient = result.scalar_one_or_none()
            if not patient:
                return None
            return {
                "name": f"{patient.first_name} {patient.last_name}",
                "date_of_birth": patient.date_of_birth,
                "sex": patient.sex,
                "allergies": patient.allergies or [],
                "conditions": patient.conditions or [],
                "medications": patient.medications or [],
            }
    except Exception as e:
        logger.warning("Failed to load patient from DB", error=str(e))
        return None


async def _load_recent_encounters(patient_id: str, limit: int = 5) -> list[dict[str, Any]]:
    """Load recent encounters for the patient."""
    from sqlalchemy import select

    try:
        async with AsyncSessionLocal() as session:
            stmt = (
                select(Encounter)
                .where(Encounter.patient_id == patient_id)
                .order_by(Encounter.created_at.desc())
                .limit(limit)
            )
            result = await session.execute(stmt)
            encounters = result.scalars().all()
            return [
                {
                    "title": e.title,
                    "type": e.encounter_type,
                    "status": e.status,
                    "created_at": e.created_at.isoformat() if e.created_at else None,
                    "triage_result": e.triage_result,
                }
                for e in encounters
            ]
    except Exception as e:
        logger.warning("Failed to load encounters", error=str(e))
        return []


async def _load_lab_results(patient_id: str, limit: int = 10) -> list[dict[str, Any]]:
    """Load recent lab results via encounters."""
    from sqlalchemy import select

    try:
        async with AsyncSessionLocal() as session:
            stmt = (
                select(LabResult)
                .join(Encounter, LabResult.encounter_id == Encounter.id)
                .where(Encounter.patient_id == patient_id)
                .order_by(LabResult.created_at.desc())
                .limit(limit)
            )
            result = await session.execute(stmt)
            labs = result.scalars().all()
            return [
                {
                    "collection_date": l.collection_date.isoformat() if l.collection_date else None,
                    "values": l.values,
                }
                for l in labs
            ]
    except Exception as e:
        logger.warning("Failed to load lab results", error=str(e))
        return []


def _load_visit_history(patient_id: str) -> dict[str, Any]:
    """Load visit history and vital trends from visit tracker."""
    try:
        tracker = get_visit_tracker()
        visits = tracker.get_visit_history(patient_id)
        vital_trends = tracker.get_vital_trends(patient_id)
        return {
            "visits": visits[-5:] if visits else [],  # Last 5 visits
            "vital_trends": vital_trends,
        }
    except Exception as e:
        logger.warning("Failed to load visit history", error=str(e))
        return {"visits": [], "vital_trends": {}}


async def build_postvisit_context(
    patient_id: str,
    summary: dict[str, Any],
    vital_readings: list[dict[str, Any]] | None = None,
) -> str:
    """Build the full context window for the PostVisit AI companion.

    Args:
        patient_id: Patient UUID string
        summary: The released visit summary data
        vital_readings: Recent vital readings from the postvisit vitals table

    Returns:
        Formatted context string for the LLM (typically 10-50K tokens)
    """
    # Load data sources in parallel where possible
    patient = await _load_patient(patient_id)
    encounters = await _load_recent_encounters(patient_id)
    labs = await _load_lab_results(patient_id)
    visit_history = _load_visit_history(patient_id)

    sections = []

    # 1. Visit Summary (always present)
    sections.append("=== CURRENT VISIT SUMMARY ===")
    sections.append(f"Diagnosis: {summary.get('diagnosis', 'N/A')}")
    sections.append(f"Explanation: {summary.get('diagnosisExplanation', 'N/A')}")

    meds = summary.get("medications", [])
    if meds:
        sections.append("\nMedications:")
        for m in meds:
            action = m.get("action", "")
            sections.append(f"  - {m.get('name', '?')} {m.get('dose', '')} {m.get('frequency', '')} ({action})")
            if m.get("plainLanguageInstructions"):
                sections.append(f"    Instructions: {m['plainLanguageInstructions']}")

    instructions = summary.get("dischargeInstructions", "")
    if instructions:
        sections.append(f"\nDischarge Instructions: {instructions}")

    followups = summary.get("followUps", [])
    if followups:
        sections.append("\nFollow-up Appointments:")
        for f in followups:
            sections.append(f"  - {f.get('provider', '?')} in {f.get('timeframe', '?')}: {f.get('reason', '')}")

    red_flags = summary.get("redFlags", [])
    if red_flags:
        sections.append("\nWarning Signs to Watch For:")
        for rf in red_flags:
            sections.append(f"  - {rf}")

    restrictions = summary.get("restrictions", [])
    if restrictions:
        sections.append("\nRestrictions:")
        for r in restrictions:
            sections.append(f"  - {r}")

    # 2. Patient Demographics
    if patient:
        sections.append("\n=== PATIENT INFORMATION ===")
        sections.append(f"Name: {patient['name']}")
        sections.append(f"Date of Birth: {patient['date_of_birth']}")
        sections.append(f"Sex: {patient['sex']}")
        if patient["allergies"]:
            sections.append(f"Allergies: {', '.join(str(a) for a in patient['allergies'])}")
        if patient["conditions"]:
            sections.append(f"Conditions: {', '.join(str(c) for c in patient['conditions'])}")
        if patient["medications"]:
            sections.append(f"Current Medications: {json.dumps(patient['medications'], default=str)}")

    # 3. Recent Lab Results
    if labs:
        sections.append("\n=== RECENT LAB RESULTS ===")
        for lab in labs[:5]:
            if lab.get("collection_date"):
                sections.append(f"Date: {lab['collection_date']}")
            if lab.get("values"):
                for k, v in lab["values"].items():
                    sections.append(f"  {k}: {v}")

    # 4. Visit History & Vital Trends
    if visit_history.get("vital_trends"):
        sections.append("\n=== VITAL SIGN TRENDS (from visit history) ===")
        for vital_name, readings in visit_history["vital_trends"].items():
            if readings:
                latest = readings[-1] if readings else {}
                sections.append(f"{vital_name}: latest={latest.get('value', '?')} (n={len(readings)} readings)")

    # 5. Recent Vital Readings (from PostVisit tracker)
    if vital_readings:
        sections.append("\n=== RECENT PATIENT-LOGGED VITALS ===")
        # Group by type
        by_type: dict[str, list] = {}
        for vr in vital_readings:
            vtype = vr.get("vital_type", "unknown")
            by_type.setdefault(vtype, []).append(vr)
        for vtype, readings in by_type.items():
            readings_sorted = sorted(readings, key=lambda x: x.get("recorded_at", ""))
            latest = readings_sorted[-1]
            sections.append(
                f"{vtype}: latest={latest.get('value', '?')} {latest.get('unit', '')} "
                f"at {latest.get('recorded_at', '?')} (n={len(readings)} total)"
            )

    # 6. Encounter History Summary
    if encounters:
        sections.append("\n=== RECENT ENCOUNTER HISTORY ===")
        for enc in encounters[:3]:
            sections.append(f"- {enc.get('title', 'Untitled')} ({enc.get('type', '?')}) on {enc.get('created_at', '?')}")

    return "\n".join(sections)
