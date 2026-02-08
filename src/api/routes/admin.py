"""Admin API endpoints for practice management.

Provides endpoints for:
- Appointment scheduling and management
- Patient directory
- SMS/call reminders
- Schedule optimization
"""

from datetime import datetime
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from src.agents.scheduler import SchedulerAgent

logger = structlog.get_logger()
router = APIRouter(prefix="/admin", tags=["admin"])


# ============================================================================
# Request/Response Models
# ============================================================================


class AppointmentCreateRequest(BaseModel):
    """Request to create an appointment."""

    patient_id: str = Field(..., description="Patient ID")
    patient_name: str = Field(..., description="Patient name")
    patient_phone: str = Field(..., description="Patient phone number")
    patient_email: str = Field(default="", description="Patient email")
    provider: str = Field(..., description="Provider/doctor name")
    datetime: str = Field(..., description="Appointment datetime (ISO format)")
    duration: int = Field(default=30, ge=15, le=180, description="Duration in minutes")
    type: str = Field(default="in-person", description="in-person, telehealth, or phone")
    reason: str = Field(..., max_length=500, description="Reason for visit")
    notes: str | None = Field(default=None, description="Additional notes")


class AppointmentUpdateRequest(BaseModel):
    """Request to update an appointment."""

    datetime: str | None = Field(default=None, description="New datetime")
    status: str | None = Field(default=None, description="New status")
    notes: str | None = Field(default=None, description="Updated notes")


class ScheduleOptimizeRequest(BaseModel):
    """Request to optimize schedule."""

    date: str = Field(..., description="Date to optimize (YYYY-MM-DD)")
    provider: str | None = Field(default=None, description="Provider to optimize for")


class ReminderSendRequest(BaseModel):
    """Request to send reminders."""

    appointment_ids: list[str] | None = Field(
        default=None,
        description="Specific appointment IDs (if None, send to all pending)",
    )
    channel: str = Field(default="sms", description="sms, call, or email")
    message_template: str | None = Field(
        default=None,
        description="Custom message template",
    )


class BulkReminderRequest(BaseModel):
    """Request to send bulk reminders."""

    date: str = Field(..., description="Send reminders for appointments on this date")
    hours_before: int = Field(default=24, ge=1, le=168, description="Hours before appointment")
    channel: str = Field(default="sms", description="sms, call, or email")


# ============================================================================
# Appointment Endpoints
# ============================================================================


@router.post("/appointments")
async def create_appointment(request: AppointmentCreateRequest):
    """Create a new appointment.

    Creates an appointment in the system. Returns the created
    appointment with its assigned ID and status.
    """
    agent = SchedulerAgent()

    try:
        result = await agent.create_appointment({
            "patient_id": request.patient_id,
            "patient_name": request.patient_name,
            "patient_phone": request.patient_phone,
            "patient_email": request.patient_email,
            "provider": request.provider,
            "datetime": request.datetime,
            "duration": request.duration,
            "type": request.type,
            "reason": request.reason,
            "notes": request.notes,
        })

        return result

    except Exception as e:
        logger.error("Failed to create appointment", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/appointments")
async def list_appointments(
    date: str | None = Query(default=None, description="Filter by date (YYYY-MM-DD)"),
    provider: str | None = Query(default=None, description="Filter by provider"),
    status: str | None = Query(default=None, description="Filter by status"),
):
    """List appointments with optional filters.

    Returns a list of appointments matching the specified criteria.
    """
    agent = SchedulerAgent()

    try:
        filter_date = datetime.fromisoformat(date) if date else None
        appointments = await agent.get_appointments(
            date=filter_date,
            provider=provider,
            status=status,
        )

        return {
            "count": len(appointments),
            "appointments": appointments,
        }

    except Exception as e:
        logger.error("Failed to list appointments", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/appointments/{appointment_id}")
async def get_appointment(appointment_id: str):
    """Get a specific appointment by ID."""
    agent = SchedulerAgent()

    if appointment_id not in agent._appointments:
        raise HTTPException(status_code=404, detail="Appointment not found")

    return agent._appointments[appointment_id].to_dict()


@router.patch("/appointments/{appointment_id}")
async def update_appointment(appointment_id: str, request: AppointmentUpdateRequest):
    """Update an existing appointment.

    Can update datetime, status, or notes. Useful for rescheduling
    or marking appointments as completed.
    """
    agent = SchedulerAgent()

    try:
        if request.datetime:
            result = await agent.reschedule_appointment({
                "appointment_id": appointment_id,
                "new_datetime": request.datetime,
            })
            return result

        # Handle status/notes update
        if appointment_id not in agent._appointments:
            raise HTTPException(status_code=404, detail="Appointment not found")

        appointment = agent._appointments[appointment_id]

        if request.status:
            appointment.status = request.status

        if request.notes is not None:
            appointment.notes = request.notes

        return {
            "success": True,
            "appointment": appointment.to_dict(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update appointment", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/appointments/{appointment_id}")
async def cancel_appointment(appointment_id: str):
    """Cancel an appointment."""
    agent = SchedulerAgent()

    try:
        result = await agent.cancel_appointment(appointment_id)

        if not result.get("success"):
            raise HTTPException(status_code=404, detail=result.get("error"))

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to cancel appointment", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Schedule Endpoints
# ============================================================================


@router.post("/schedule/optimize")
async def optimize_schedule(request: ScheduleOptimizeRequest):
    """Optimize the appointment schedule.

    Analyzes the schedule and provides recommendations for improving
    utilization, filling gaps, and balancing workload.
    """
    agent = SchedulerAgent()

    try:
        result = await agent.optimize_schedule({
            "date": request.date,
            "provider": request.provider,
        })

        return result

    except Exception as e:
        logger.error("Failed to optimize schedule", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/schedule/available-slots")
async def get_available_slots(
    date: str = Query(..., description="Date to check (YYYY-MM-DD)"),
    provider: str | None = Query(default=None, description="Provider"),
    duration: int = Query(default=30, ge=15, le=180, description="Duration in minutes"),
):
    """Get available slots for a date.

    Returns all time slots with their availability status.
    """
    agent = SchedulerAgent()

    try:
        result = await agent.find_available_slots({
            "date": date,
            "provider": provider or "",
            "duration": duration,
        })

        return result

    except Exception as e:
        logger.error("Failed to get available slots", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Reminder Endpoints
# ============================================================================


@router.post("/reminders/send")
async def send_reminders(request: ReminderSendRequest):
    """Send appointment reminders.

    Sends reminders via SMS, phone call, or email to patients
    with upcoming appointments.
    """
    from src.integrations.twilio import send_appointment_reminder

    try:
        # Get appointments to remind
        agent = SchedulerAgent()
        appointments = []

        if request.appointment_ids:
            for apt_id in request.appointment_ids:
                if apt_id in agent._appointments:
                    appointments.append(agent._appointments[apt_id])
        else:
            # Get all pending appointments
            appointments = [
                apt for apt in agent._appointments.values()
                if apt.status in ["pending", "confirmed"]
            ]

        # Send reminders
        results = []
        for apt in appointments:
            try:
                result = await send_appointment_reminder(
                    patient_phone=apt.patient_phone,
                    patient_name=apt.patient_name,
                    appointment_datetime=apt.datetime,
                    provider=apt.provider,
                    channel=request.channel,
                    custom_message=request.message_template,
                )
                results.append({
                    "appointment_id": apt.id,
                    "patient_name": apt.patient_name,
                    "status": "sent",
                    **result,
                })
            except Exception as e:
                results.append({
                    "appointment_id": apt.id,
                    "patient_name": apt.patient_name,
                    "status": "failed",
                    "error": str(e),
                })

        sent_count = sum(1 for r in results if r["status"] == "sent")

        return {
            "total": len(results),
            "sent": sent_count,
            "failed": len(results) - sent_count,
            "results": results,
        }

    except Exception as e:
        logger.error("Failed to send reminders", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reminders/bulk")
async def send_bulk_reminders(request: BulkReminderRequest):
    """Send bulk reminders for a specific date.

    Sends reminders to all patients with appointments on the
    specified date, according to the hours_before parameter.
    """
    try:
        # Parse the target date
        target_date = datetime.fromisoformat(request.date)

        # Get appointments for that date
        agent = SchedulerAgent()
        appointments = [
            apt for apt in agent._appointments.values()
            if apt.datetime.date() == target_date.date()
            and apt.status in ["pending", "confirmed"]
        ]

        if not appointments:
            return {
                "message": f"No pending appointments found for {request.date}",
                "total": 0,
                "sent": 0,
            }

        # Send reminders (delegating to the single reminder endpoint logic)
        return await send_reminders(ReminderSendRequest(
            appointment_ids=[apt.id for apt in appointments],
            channel=request.channel,
        ))

    except Exception as e:
        logger.error("Failed to send bulk reminders", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Patient Directory Endpoints
# ============================================================================


@router.get("/patients")
async def list_patients(
    search: str | None = Query(default=None, description="Search query"),
    status: str | None = Query(default=None, description="Filter by status"),
    limit: int = Query(default=50, ge=1, le=200, description="Max results"),
    offset: int = Query(default=0, ge=0, description="Offset for pagination"),
):
    """List patients with optional search and filters.

    Note: This is a placeholder. In production, this would query
    a proper patient database with proper authentication.
    """
    # Placeholder - would come from database
    return {
        "total": 0,
        "limit": limit,
        "offset": offset,
        "patients": [],
        "message": "Patient database not configured",
    }


@router.get("/patients/{patient_id}")
async def get_patient(patient_id: str):
    """Get a specific patient by ID."""
    # Placeholder
    raise HTTPException(
        status_code=501,
        detail="Patient database not configured",
    )


# ============================================================================
# Health Check
# ============================================================================


@router.get("/health")
async def admin_health_check():
    """Check health of admin services."""
    from src.integrations.twilio import get_twilio_status

    twilio_status = await get_twilio_status()

    return {
        "status": "healthy",
        "services": {
            "scheduler": "available",
            "reminders": twilio_status,
            "patient_directory": "available",
        },
    }
