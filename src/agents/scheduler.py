"""Appointment Scheduler Agent for admin appointment management.

AI-optimized appointment scheduling and calendar management
for healthcare practices.
"""

from dataclasses import dataclass
from datetime import datetime, time, timedelta
from typing import Any, Literal
from uuid import uuid4

import dspy
import structlog

from src.agents.base import AgentResult, BaseAgent
from src.models import Task

logger = structlog.get_logger()


AppointmentStatus = Literal[
    "confirmed", "pending", "checked-in", "completed", "no-show", "cancelled"
]
AppointmentType = Literal["in-person", "telehealth", "phone"]


@dataclass
class TimeSlot:
    """A time slot for scheduling."""
    start_time: datetime
    end_time: datetime
    available: bool
    provider: str | None = None


@dataclass
class Appointment:
    """An appointment in the system."""
    id: str
    patient_id: str
    patient_name: str
    patient_phone: str
    patient_email: str
    provider: str
    datetime: datetime
    duration: int  # minutes
    type: AppointmentType
    status: AppointmentStatus
    reason: str
    notes: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "patient_name": self.patient_name,
            "patient_phone": self.patient_phone,
            "patient_email": self.patient_email,
            "provider": self.provider,
            "datetime": self.datetime.isoformat(),
            "duration": self.duration,
            "type": self.type,
            "status": self.status,
            "reason": self.reason,
            "notes": self.notes,
        }


@dataclass
class ScheduleOptimization:
    """Result of schedule optimization."""
    suggested_slots: list[TimeSlot]
    utilization_score: float
    recommendations: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "suggested_slots": [
                {
                    "start_time": s.start_time.isoformat(),
                    "end_time": s.end_time.isoformat(),
                    "available": s.available,
                    "provider": s.provider,
                }
                for s in self.suggested_slots
            ],
            "utilization_score": self.utilization_score,
            "recommendations": self.recommendations,
        }


class AppointmentOptimizeSignature(dspy.Signature):
    """Optimize appointment scheduling for a healthcare practice.

    Analyze the schedule and suggest optimal appointment slots
    based on provider availability, patient preferences, and
    practice efficiency goals.
    """

    existing_appointments: str = dspy.InputField(desc="JSON of existing appointments")
    provider_schedule: str = dspy.InputField(desc="Provider's working hours")
    patient_preferences: str = dspy.InputField(desc="Patient's preferred times")
    appointment_type: str = dspy.InputField(desc="Type of appointment needed")

    suggested_times: str = dspy.OutputField(desc="JSON list of suggested time slots")
    reasoning: str = dspy.OutputField(desc="Explanation of scheduling reasoning")
    utilization_improvement: str = dspy.OutputField(desc="How this improves schedule utilization")


# Default provider schedule (9 AM - 5 PM, 30-min slots)
DEFAULT_WORKING_HOURS = {
    "start": time(9, 0),
    "end": time(17, 0),
    "slot_duration": 30,  # minutes
    "lunch_start": time(12, 0),
    "lunch_end": time(13, 0),
}


class SchedulerAgent(BaseAgent):
    """AI-powered appointment scheduling agent.

    Optimizes appointment scheduling for healthcare practices,
    balancing patient convenience, provider availability, and
    practice efficiency.
    """

    name = "scheduler"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.optimizer = dspy.ChainOfThought(AppointmentOptimizeSignature)
        # In-memory storage (would be database in production)
        self._appointments: dict[str, Appointment] = {}

    async def execute(self, task: Task) -> AgentResult:
        """Execute scheduling task.

        Task parameters:
            - action: "create", "reschedule", "cancel", "optimize", "find_slots"
            - Additional params based on action
        """
        params = task.payload
        action = params.get("action", "find_slots")

        try:
            if action == "create":
                result = await self.create_appointment(params)
            elif action == "reschedule":
                result = await self.reschedule_appointment(params)
            elif action == "cancel":
                result = await self.cancel_appointment(params.get("appointment_id", ""))
            elif action == "optimize":
                result = await self.optimize_schedule(params)
            elif action == "find_slots":
                result = await self.find_available_slots(params)
            else:
                return AgentResult(
                    success=False,
                    error=f"Unknown action: {action}",
                )

            thought = await self.create_thought_signature(
                task=task,
                context_summary=f"Scheduling action: {action}",
                decision_made=f"Completed {action} successfully",
                reasoning="Applied scheduling optimization",
                confidence=0.9,
                expected_outcomes=["Schedule updated", "Patient notified"],
            )

            return AgentResult(
                success=True,
                data=result,
                thought_signature=thought,
            )

        except Exception as e:
            return await self._handle_error(e, task, params)

    async def create_appointment(self, params: dict[str, Any]) -> dict[str, Any]:
        """Create a new appointment.

        Args:
            params: Appointment details

        Returns:
            Created appointment data
        """
        appointment_id = str(uuid4())

        # Parse datetime
        dt = params.get("datetime")
        if isinstance(dt, str):
            dt = datetime.fromisoformat(dt)
        elif not isinstance(dt, datetime):
            dt = datetime.now() + timedelta(days=1, hours=9)

        appointment = Appointment(
            id=appointment_id,
            patient_id=params.get("patient_id", ""),
            patient_name=params.get("patient_name", ""),
            patient_phone=params.get("patient_phone", ""),
            patient_email=params.get("patient_email", ""),
            provider=params.get("provider", ""),
            datetime=dt,
            duration=params.get("duration", 30),
            type=params.get("type", "in-person"),
            status="pending",
            reason=params.get("reason", ""),
            notes=params.get("notes"),
        )

        self._appointments[appointment_id] = appointment

        self.logger.info(
            "Created appointment",
            appointment_id=appointment_id,
            patient=appointment.patient_name,
            datetime=dt.isoformat(),
        )

        return {
            "success": True,
            "appointment": appointment.to_dict(),
            "message": f"Appointment created for {appointment.datetime.strftime('%B %d at %I:%M %p')}",
        }

    async def reschedule_appointment(self, params: dict[str, Any]) -> dict[str, Any]:
        """Reschedule an existing appointment.

        Args:
            params: Reschedule details including appointment_id and new_datetime

        Returns:
            Updated appointment data
        """
        appointment_id = params.get("appointment_id", "")
        new_datetime = params.get("new_datetime")

        if appointment_id not in self._appointments:
            return {
                "success": False,
                "error": "Appointment not found",
            }

        if isinstance(new_datetime, str):
            new_datetime = datetime.fromisoformat(new_datetime)

        appointment = self._appointments[appointment_id]
        old_datetime = appointment.datetime
        appointment.datetime = new_datetime

        self.logger.info(
            "Rescheduled appointment",
            appointment_id=appointment_id,
            old=old_datetime.isoformat(),
            new=new_datetime.isoformat(),
        )

        return {
            "success": True,
            "appointment": appointment.to_dict(),
            "message": f"Appointment rescheduled from {old_datetime.strftime('%B %d')} to {new_datetime.strftime('%B %d at %I:%M %p')}",
        }

    async def cancel_appointment(self, appointment_id: str) -> dict[str, Any]:
        """Cancel an appointment.

        Args:
            appointment_id: ID of appointment to cancel

        Returns:
            Cancellation confirmation
        """
        if appointment_id not in self._appointments:
            return {
                "success": False,
                "error": "Appointment not found",
            }

        appointment = self._appointments[appointment_id]
        appointment.status = "cancelled"

        self.logger.info(
            "Cancelled appointment",
            appointment_id=appointment_id,
            patient=appointment.patient_name,
        )

        return {
            "success": True,
            "appointment": appointment.to_dict(),
            "message": f"Appointment cancelled for {appointment.patient_name}",
        }

    async def find_available_slots(self, params: dict[str, Any]) -> dict[str, Any]:
        """Find available appointment slots.

        Args:
            params: Search parameters including date, provider, duration

        Returns:
            List of available time slots
        """
        provider = params.get("provider", "")
        date = params.get("date")
        duration = params.get("duration", 30)

        if isinstance(date, str):
            date = datetime.fromisoformat(date).date()
        elif not date:
            date = datetime.now().date() + timedelta(days=1)

        # Get working hours
        hours = DEFAULT_WORKING_HOURS

        # Generate all possible slots
        slots = []
        current = datetime.combine(date, hours["start"])
        end = datetime.combine(date, hours["end"])

        while current + timedelta(minutes=duration) <= end:
            # Skip lunch
            if hours["lunch_start"] <= current.time() < hours["lunch_end"]:
                current += timedelta(minutes=hours["slot_duration"])
                continue

            # Check if slot is available
            is_available = self._is_slot_available(current, duration, provider)

            slots.append(TimeSlot(
                start_time=current,
                end_time=current + timedelta(minutes=duration),
                available=is_available,
                provider=provider,
            ))

            current += timedelta(minutes=hours["slot_duration"])

        available_slots = [s for s in slots if s.available]

        return {
            "date": date.isoformat(),
            "provider": provider,
            "total_slots": len(slots),
            "available_slots": len(available_slots),
            "slots": [
                {
                    "start_time": s.start_time.isoformat(),
                    "end_time": s.end_time.isoformat(),
                    "available": s.available,
                }
                for s in slots
            ],
        }

    def _is_slot_available(
        self,
        start: datetime,
        duration: int,
        provider: str,
    ) -> bool:
        """Check if a time slot is available."""
        end = start + timedelta(minutes=duration)

        for apt in self._appointments.values():
            if apt.status == "cancelled":
                continue
            if provider and apt.provider != provider:
                continue

            apt_end = apt.datetime + timedelta(minutes=apt.duration)

            # Check for overlap
            if start < apt_end and end > apt.datetime:
                return False

        return True

    async def optimize_schedule(self, params: dict[str, Any]) -> dict[str, Any]:
        """Optimize the appointment schedule.

        Args:
            params: Optimization parameters

        Returns:
            Optimization recommendations
        """
        date = params.get("date")
        provider = params.get("provider", "")

        if isinstance(date, str):
            date = datetime.fromisoformat(date).date()
        elif not date:
            date = datetime.now().date()

        # Get appointments for the day
        day_appointments = [
            apt for apt in self._appointments.values()
            if apt.datetime.date() == date
            and apt.status not in ["cancelled", "no-show"]
            and (not provider or apt.provider == provider)
        ]

        # Calculate utilization
        hours = DEFAULT_WORKING_HOURS
        total_minutes = (
            datetime.combine(date, hours["end"]) -
            datetime.combine(date, hours["start"])
        ).seconds // 60

        # Subtract lunch
        lunch_minutes = (
            datetime.combine(date, hours["lunch_end"]) -
            datetime.combine(date, hours["lunch_start"])
        ).seconds // 60
        total_minutes -= lunch_minutes

        scheduled_minutes = sum(apt.duration for apt in day_appointments)
        utilization = scheduled_minutes / total_minutes if total_minutes > 0 else 0

        # Generate recommendations
        recommendations = []

        if utilization < 0.5:
            recommendations.append("Schedule utilization is low. Consider marketing or outreach campaigns.")
        elif utilization > 0.9:
            recommendations.append("Schedule is nearly full. Consider adding availability or waitlist management.")

        # Find gaps
        gaps = self._find_schedule_gaps(day_appointments, date)
        if gaps:
            recommendations.append(f"Found {len(gaps)} gaps in the schedule that could be filled.")

        # Check for overbooking risk
        if len(day_appointments) > 20:
            recommendations.append("High appointment volume. Ensure adequate staffing.")

        return {
            "date": date.isoformat(),
            "provider": provider,
            "utilization": round(utilization * 100, 1),
            "total_appointments": len(day_appointments),
            "scheduled_minutes": scheduled_minutes,
            "available_minutes": total_minutes - scheduled_minutes,
            "gaps": [
                {
                    "start": g[0].isoformat(),
                    "end": g[1].isoformat(),
                    "duration_minutes": (g[1] - g[0]).seconds // 60,
                }
                for g in gaps
            ],
            "recommendations": recommendations,
        }

    def _find_schedule_gaps(
        self,
        appointments: list[Appointment],
        date,
    ) -> list[tuple[datetime, datetime]]:
        """Find gaps in the schedule."""
        if not appointments:
            return []

        hours = DEFAULT_WORKING_HOURS
        day_start = datetime.combine(date, hours["start"])
        day_end = datetime.combine(date, hours["end"])
        datetime.combine(date, hours["lunch_start"])
        datetime.combine(date, hours["lunch_end"])

        # Sort appointments by time
        sorted_apts = sorted(appointments, key=lambda a: a.datetime)

        gaps = []
        min_gap_minutes = 30  # Only report gaps of 30+ minutes

        # Check gap at start of day
        if sorted_apts[0].datetime - day_start > timedelta(minutes=min_gap_minutes):
            gaps.append((day_start, sorted_apts[0].datetime))

        # Check gaps between appointments
        for i in range(len(sorted_apts) - 1):
            current_end = sorted_apts[i].datetime + timedelta(minutes=sorted_apts[i].duration)
            next_start = sorted_apts[i + 1].datetime

            # Skip if gap is during lunch
            if current_end.time() >= hours["lunch_start"] and next_start.time() <= hours["lunch_end"]:
                continue

            if next_start - current_end > timedelta(minutes=min_gap_minutes):
                gaps.append((current_end, next_start))

        # Check gap at end of day
        last_end = sorted_apts[-1].datetime + timedelta(minutes=sorted_apts[-1].duration)
        if day_end - last_end > timedelta(minutes=min_gap_minutes):
            gaps.append((last_end, day_end))

        return gaps

    async def get_appointments(
        self,
        date: datetime | None = None,
        provider: str | None = None,
        status: AppointmentStatus | None = None,
    ) -> list[dict[str, Any]]:
        """Get appointments with optional filters.

        Args:
            date: Filter by date
            provider: Filter by provider
            status: Filter by status

        Returns:
            List of matching appointments
        """
        result = []

        for apt in self._appointments.values():
            if date and apt.datetime.date() != date.date():
                continue
            if provider and apt.provider != provider:
                continue
            if status and apt.status != status:
                continue
            result.append(apt.to_dict())

        return sorted(result, key=lambda a: a["datetime"])


# Convenience functions for direct use
async def create_appointment(
    patient_name: str,
    patient_phone: str,
    patient_email: str,
    provider: str,
    datetime_str: str,
    reason: str,
    duration: int = 30,
    appointment_type: AppointmentType = "in-person",
) -> dict[str, Any]:
    """Create a new appointment."""
    agent = SchedulerAgent()
    return await agent.create_appointment({
        "patient_name": patient_name,
        "patient_phone": patient_phone,
        "patient_email": patient_email,
        "provider": provider,
        "datetime": datetime_str,
        "reason": reason,
        "duration": duration,
        "type": appointment_type,
    })


async def find_available_slots(
    date: str,
    provider: str = "",
    duration: int = 30,
) -> dict[str, Any]:
    """Find available appointment slots."""
    agent = SchedulerAgent()
    return await agent.find_available_slots({
        "date": date,
        "provider": provider,
        "duration": duration,
    })
