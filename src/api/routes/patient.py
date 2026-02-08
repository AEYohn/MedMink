"""Patient-facing API endpoints.

Provides endpoints for:
- Symptom checking
- Medication interaction checking
- Appointment booking (patient-side)
"""

from typing import Any

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.agents.symptom_checker import analyze_symptoms
from src.agents.medication_manager import check_drug_interactions

logger = structlog.get_logger()
router = APIRouter(prefix="/patient", tags=["patient"])


# ============================================================================
# Request/Response Models
# ============================================================================


class SymptomCheckRequest(BaseModel):
    """Request for symptom analysis."""

    symptoms: str = Field(
        ...,
        min_length=5,
        max_length=2000,
        description="Patient's symptom description",
    )
    conversation_history: list[dict[str, str]] | None = Field(
        default=None,
        description="Previous messages in the conversation",
    )


class PossibleConditionResponse(BaseModel):
    """A possible condition from symptom analysis."""

    name: str
    probability: str
    description: str


class SymptomCheckResponse(BaseModel):
    """Response from symptom analysis."""

    response: str
    urgency: str
    possible_conditions: list[PossibleConditionResponse]
    recommendations: list[str]
    seek_care: bool
    care_timeframe: str | None
    follow_up_questions: list[str]
    confidence: float


class MedicationCheckRequest(BaseModel):
    """Request for medication interaction check."""

    medications: list[str] = Field(
        ...,
        min_length=2,
        max_length=20,
        description="List of medication names",
    )


class DrugInteractionResponse(BaseModel):
    """A drug interaction found."""

    drug1: str
    drug2: str
    severity: str
    description: str
    recommendation: str
    evidence_level: str


class MedicationCheckResponse(BaseModel):
    """Response from medication interaction check."""

    safe: bool
    interactions: list[DrugInteractionResponse]
    recommendations: list[str]
    confidence: float


class AppointmentRequest(BaseModel):
    """Request for booking an appointment."""

    provider_id: str = Field(..., description="Provider/doctor ID")
    preferred_date: str = Field(..., description="Preferred date (YYYY-MM-DD)")
    preferred_time: str | None = Field(default=None, description="Preferred time (HH:MM)")
    appointment_type: str = Field(default="in-person", description="in-person, telehealth, or phone")
    reason: str = Field(..., max_length=500, description="Reason for visit")
    duration: int = Field(default=30, ge=15, le=120, description="Duration in minutes")


class AvailableSlotsRequest(BaseModel):
    """Request for available appointment slots."""

    provider_id: str | None = Field(default=None, description="Provider ID (optional)")
    date: str = Field(..., description="Date to check (YYYY-MM-DD)")
    duration: int = Field(default=30, ge=15, le=120, description="Appointment duration")


# ============================================================================
# Endpoints
# ============================================================================


@router.post("/symptoms", response_model=SymptomCheckResponse)
async def check_symptoms(request: SymptomCheckRequest):
    """Analyze patient symptoms and provide triage guidance.

    Uses AI to analyze the described symptoms and provide:
    - Urgency level (emergency, urgent, routine, self-care)
    - Possible conditions to consider
    - Recommendations for care
    - Whether to seek professional medical attention

    IMPORTANT: This is not a diagnosis. Always recommend professional
    medical consultation for any concerning symptoms.
    """
    try:
        result = await analyze_symptoms(
            symptoms=request.symptoms,
            conversation_history=request.conversation_history,
        )

        return SymptomCheckResponse(
            response=result["response"],
            urgency=result["urgency"],
            possible_conditions=[
                PossibleConditionResponse(**c) for c in result["possible_conditions"]
            ],
            recommendations=result["recommendations"],
            seek_care=result["seek_care"],
            care_timeframe=result["care_timeframe"],
            follow_up_questions=result["follow_up_questions"],
            confidence=result["confidence"],
        )

    except Exception as e:
        logger.error("Symptom analysis failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/medications/check", response_model=MedicationCheckResponse)
async def check_medication_interactions(request: MedicationCheckRequest):
    """Check for potential drug-drug interactions.

    Analyzes a list of medications to identify potential interactions
    between them. Returns severity levels and recommendations.

    IMPORTANT: This is for informational purposes only. Always consult
    with a pharmacist or healthcare provider about medication interactions.
    """
    try:
        result = await check_drug_interactions(request.medications)

        return MedicationCheckResponse(
            safe=result["safe"],
            interactions=[
                DrugInteractionResponse(**i) for i in result["interactions"]
            ],
            recommendations=result["recommendations"],
            confidence=result["confidence"],
        )

    except Exception as e:
        logger.error("Medication interaction check failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/appointments/book")
async def book_appointment(request: AppointmentRequest):
    """Book a new appointment.

    Creates an appointment request that will be confirmed by the practice.
    Returns the appointment details and confirmation status.
    """
    from src.agents.scheduler import create_appointment

    try:
        # This would typically involve authentication to get patient info
        result = await create_appointment(
            patient_name="Patient",  # Would come from auth
            patient_phone="",
            patient_email="",
            provider=request.provider_id,
            datetime_str=f"{request.preferred_date}T{request.preferred_time or '09:00'}:00",
            reason=request.reason,
            duration=request.duration,
            appointment_type=request.appointment_type,
        )

        return result

    except Exception as e:
        logger.error("Appointment booking failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/appointments/available-slots")
async def get_available_slots(request: AvailableSlotsRequest):
    """Get available appointment slots for a date.

    Returns a list of available time slots for the specified date
    and provider. Useful for showing booking options to patients.
    """
    from src.agents.scheduler import find_available_slots

    try:
        result = await find_available_slots(
            date=request.date,
            provider=request.provider_id or "",
            duration=request.duration,
        )

        # Filter to only return available slots
        available = [
            slot for slot in result["slots"]
            if slot["available"]
        ]

        return {
            "date": result["date"],
            "provider": result["provider"],
            "available_count": len(available),
            "slots": available,
        }

    except Exception as e:
        logger.error("Failed to get available slots", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def patient_health_check():
    """Check health of patient services."""
    return {
        "status": "healthy",
        "services": {
            "symptom_checker": "available",
            "medication_checker": "available",
            "appointment_booking": "available",
        },
    }
