"""Patient interview orchestrator.

Manages adaptive patient intake interviews using MedGemma as the clinical brain.
Follows standard medical interview methodology (CC → HPI → ROS → PMH → meds → allergies)
and produces ESI triage + care setting recommendation.
"""

import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import structlog

from src.medgemma.client import get_medgemma_client
from src.medgemma.interview_prompts import (
    GREETING_PROMPT,
    INTERVIEW_SYSTEM_PROMPT,
    INTERVIEW_TURN_PROMPT,
    PHASE_GUIDANCE,
    TRIAGE_PROMPT,
)

logger = structlog.get_logger()

# Interview phase order
PHASES = [
    "greeting",
    "chief_complaint",
    "hpi",
    "review_of_systems",
    "pmh_psh_fh_sh",
    "medications",
    "allergies",
    "review_and_triage",
    "complete",
]


@dataclass
class InterviewSession:
    """State for a single patient interview."""
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    phase: str = "greeting"
    conversation_history: list[dict[str, str]] = field(default_factory=list)
    extracted_data: dict[str, Any] = field(default_factory=dict)
    started_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    triage_result: dict[str, Any] | None = None
    red_flags: list[str] = field(default_factory=list)
    patient_id: str | None = None  # For cross-visit longitudinal linking
    respiratory_cough_prompt: bool = False  # Flag to prompt cough recording


# In-memory session storage for v1
_sessions: dict[str, InterviewSession] = {}


def get_session(session_id: str) -> InterviewSession | None:
    return _sessions.get(session_id)


def create_session() -> InterviewSession:
    session = InterviewSession()
    _sessions[session.session_id] = session
    return session


class PatientInterviewer:
    """Orchestrates the patient interview flow using MedGemma."""

    def __init__(self):
        self._client = get_medgemma_client()

    async def start_interview(self, session: InterviewSession) -> dict[str, Any]:
        """Start a new interview — generate the greeting/first question."""
        response_text = await self._client.generate(
            prompt=GREETING_PROMPT,
            system_prompt=INTERVIEW_SYSTEM_PROMPT,
            temperature=0.4,
            max_tokens=512,
        )

        data = self._parse_response(response_text)
        question = data.get("next_question", "Hello! What brought you in today?")

        session.conversation_history.append({
            "role": "assistant",
            "content": question,
        })
        session.phase = "chief_complaint"

        return {
            "session_id": session.session_id,
            "question": question,
            "phase": session.phase,
            "extracted_data": session.extracted_data,
        }

    async def process_response(
        self,
        session: InterviewSession,
        patient_input: str,
    ) -> dict[str, Any]:
        """Process a patient response and generate the next question."""
        # Record patient input
        session.conversation_history.append({
            "role": "user",
            "content": patient_input,
        })

        # Format conversation history for prompt
        conv_text = self._format_conversation(session.conversation_history[-10:])

        # Build phase-aware prompt
        phase_hint = PHASE_GUIDANCE.get(session.phase, "")
        prompt = INTERVIEW_TURN_PROMPT.format(
            phase=session.phase,
            conversation_history=conv_text,
            extracted_data=json.dumps(session.extracted_data, indent=2),
            patient_input=patient_input,
        )

        if phase_hint:
            prompt += f"\n\nPhase guidance: {phase_hint}"

        response_text = await self._client.generate(
            prompt=prompt,
            system_prompt=INTERVIEW_SYSTEM_PROMPT,
            temperature=0.4,
            max_tokens=768,
        )

        data = self._parse_response(response_text)

        # Extract data from response
        new_data = data.get("extracted_data", {})
        if new_data and isinstance(new_data, dict):
            # Merge into session, grouping by phase
            phase_key = session.phase
            if phase_key not in session.extracted_data:
                session.extracted_data[phase_key] = {}
            if isinstance(session.extracted_data[phase_key], dict):
                session.extracted_data[phase_key].update(new_data)
            else:
                session.extracted_data[phase_key] = new_data

        # Check for red flags
        red_flags = data.get("red_flags", [])
        if red_flags:
            session.red_flags.extend(red_flags)

        # Advance phase if complete
        phase_complete = data.get("phase_complete", False)
        if phase_complete:
            session.phase = self._next_phase(session.phase)

        # Generate question
        question = data.get("next_question", "Could you tell me more?")

        session.conversation_history.append({
            "role": "assistant",
            "content": question,
        })

        # Feed data to Management Reasoning Agent (async, non-blocking)
        try:
            import asyncio

            from src.medgemma.management_agent import get_management_agent

            agent = get_management_agent()
            # Fire-and-forget — don't block the interview response
            asyncio.create_task(agent.update_plan(session))
        except (ImportError, Exception):
            pass

        # Detect respiratory symptoms during ROS to prompt cough recording
        prompt_cough = False
        if session.phase == "review_of_systems":
            respiratory_keywords = ["cough", "breathing", "wheeze", "dyspnea", "shortness of breath",
                                    "chest tightness", "sputum", "hemoptysis"]
            input_lower = patient_input.lower()
            if any(kw in input_lower for kw in respiratory_keywords):
                session.respiratory_cough_prompt = True
                prompt_cough = True

        return {
            "session_id": session.session_id,
            "question": question,
            "phase": session.phase,
            "phase_complete": phase_complete,
            "extracted_data": session.extracted_data,
            "red_flags": session.red_flags,
            "prompt_cough_recording": prompt_cough,
        }

    async def generate_triage(self, session: InterviewSession) -> dict[str, Any]:
        """Generate final triage assessment from the complete interview."""
        conv_text = self._format_conversation(session.conversation_history)

        prompt = TRIAGE_PROMPT.format(
            interview_data=json.dumps(session.extracted_data, indent=2),
            conversation_history=conv_text,
        )

        response_text = await self._client.generate(
            prompt=prompt,
            system_prompt=INTERVIEW_SYSTEM_PROMPT,
            temperature=0.2,
            max_tokens=2048,
        )

        triage = self._parse_response(response_text)

        # Merge any session-level red flags
        triage_flags = triage.get("red_flags", [])
        all_flags = list(set(session.red_flags + triage_flags))
        triage["red_flags"] = all_flags

        session.triage_result = triage
        session.phase = "complete"

        return triage

    async def get_management_plan(self, session: InterviewSession) -> dict[str, Any]:
        """Get the current management plan for a session."""
        try:
            from src.medgemma.management_agent import get_management_agent

            agent = get_management_agent()
            return await agent.get_management_plan(session)
        except (ImportError, Exception) as e:
            logger.warning("Management plan not available", error=str(e))
            return {"error": "Management agent not available"}

    def _next_phase(self, current_phase: str) -> str:
        """Get the next phase in the interview sequence."""
        try:
            idx = PHASES.index(current_phase)
            if idx + 1 < len(PHASES):
                return PHASES[idx + 1]
        except ValueError:
            pass
        return current_phase

    def _format_conversation(self, history: list[dict[str, str]]) -> str:
        """Format conversation history for prompt inclusion."""
        lines = []
        for msg in history:
            role = "Nurse" if msg["role"] == "assistant" else "Patient"
            lines.append(f"{role}: {msg['content']}")
        return "\n".join(lines)

    def _parse_response(self, text: str) -> dict[str, Any]:
        """Parse JSON response from MedGemma, with fallback."""
        # Use the client's parser if available
        try:
            return self._client._parse_json_response(text)
        except Exception:
            pass

        # Manual fallback
        import re
        try:
            # Try to find JSON in the response
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                return json.loads(match.group())
        except (json.JSONDecodeError, Exception):
            pass

        logger.warning("Failed to parse interview response", text=text[:200])
        return {
            "next_question": "I'm sorry, could you repeat that?",
            "phase_complete": False,
            "extracted_data": {},
            "red_flags": [],
        }


# Singleton interviewer
_interviewer: PatientInterviewer | None = None


def get_interviewer() -> PatientInterviewer:
    global _interviewer
    if _interviewer is None:
        _interviewer = PatientInterviewer()
    return _interviewer
