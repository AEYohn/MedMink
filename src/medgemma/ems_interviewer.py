"""EMS Run Report AI Assistant.

Adapts PatientInterviewer from interview.py for EMS ePCR documentation.
Key differences:
- Medic dictation can span multiple sections (auto-routed)
- Phases map to ePCR sections instead of clinical interview
- Completion generates narrative + ICD-10 + medical necessity
"""

import json
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any

import structlog

from src.medgemma.client import get_medgemma_client
from src.medgemma.ems_models import (
    EMSRunReport,
    Intervention,
    MedicationGiven,
    VitalSet,
    compute_section_completeness,
)
from src.medgemma.ems_prompts import (
    EMS_EXTRACTION_PROMPT,
    EMS_GREETING_PROMPT,
    EMS_ICD10_PROMPT,
    EMS_MEDICAL_NECESSITY_PROMPT,
    EMS_NARRATIVE_PROMPT,
    EMS_PHASE_CRITERIA,
    EMS_PHASES,
    EMS_SYSTEM_PROMPT,
)
from src.medgemma.ems_storage import get_ems_storage
from src.medgemma.ems_validation import run_deterministic_validation

logger = structlog.get_logger()


MAX_TURNS_PER_PHASE: dict[str, int] = {
    "dispatch": 2,
    "scene": 2,
    "patient_info": 2,
    "primary_assessment": 2,
    "vitals": 2,
    "secondary_assessment": 2,
    "interventions": 3,
    "transport": 2,
    "review": 1,
}


@dataclass
class EMSReportSession:
    """State for a single EMS report documentation session."""
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    run_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    phase: str = "dispatch"
    conversation_history: list[dict[str, str]] = field(default_factory=list)
    extracted_data: dict[str, Any] = field(default_factory=dict)
    validation_flags: list[dict[str, Any]] = field(default_factory=list)
    phase_turn_counts: dict[str, int] = field(default_factory=dict)
    started_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    elapsed_timer_start: str = field(default_factory=lambda: datetime.utcnow().isoformat())


# In-memory session storage
_sessions: dict[str, EMSReportSession] = {}


def get_ems_session(session_id: str) -> EMSReportSession | None:
    return _sessions.get(session_id)


def create_ems_session(dispatch_info: dict[str, Any] | None = None) -> EMSReportSession:
    session = EMSReportSession()
    if dispatch_info:
        session.extracted_data["dispatch"] = dispatch_info
    _sessions[session.session_id] = session
    return session


def restore_ems_session(
    session_id: str,
    conversation_history: list[dict[str, str]],
    phase: str | None = None,
    extracted_data: dict[str, Any] | None = None,
) -> EMSReportSession:
    """Reconstruct a lost session from frontend state."""
    resolved_phase = phase or EMS_PHASES[min(len(conversation_history) // 2, len(EMS_PHASES) - 2)]
    session = EMSReportSession(
        session_id=session_id,
        phase=resolved_phase,
        conversation_history=list(conversation_history),
        extracted_data=extracted_data or {},
    )
    _sessions[session_id] = session
    logger.info("EMS session restored", session_id=session_id, phase=resolved_phase)
    return session


class EMSReportAssistant:
    """Orchestrates EMS ePCR documentation via AI-guided dictation."""

    def __init__(self):
        self._client = get_medgemma_client()

    async def start_session(
        self,
        session: EMSReportSession,
        dispatch_info: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Start a new EMS report session."""
        if dispatch_info:
            session.extracted_data["dispatch"] = dispatch_info

        response_text = await self._client.generate(
            prompt=EMS_GREETING_PROMPT,
            system_prompt=EMS_SYSTEM_PROMPT,
            temperature=0.3,
            max_tokens=256,
        )

        data = self._parse_response(response_text)
        question = data.get("next_question", "Ready to document. What's the call?")

        session.conversation_history.append({
            "role": "assistant",
            "content": question,
        })

        return {
            "session_id": session.session_id,
            "run_id": session.run_id,
            "question": question,
            "phase": session.phase,
            "extracted_data": session.extracted_data,
            "validation_flags": [],
        }

    async def process_dictation(
        self,
        session: EMSReportSession,
        text: str,
    ) -> dict[str, Any]:
        """Process free-form medic dictation — extract data, validate, follow up."""
        session.conversation_history.append({"role": "user", "content": text})

        turns_in_phase = session.phase_turn_counts.get(session.phase, 0) + 1
        session.phase_turn_counts[session.phase] = turns_in_phase

        criteria = EMS_PHASE_CRITERIA.get(session.phase, {})
        conv_text = self._format_conversation(session.conversation_history[-12:])

        prompt = EMS_EXTRACTION_PROMPT.format(
            phase=session.phase,
            phase_goal=criteria.get("goal", "Continue documentation"),
            phase_complete_when=criteria.get("complete_when", "Sufficient data collected"),
            turns_in_phase=turns_in_phase,
            conversation_history=conv_text,
            extracted_data=json.dumps(session.extracted_data, indent=2),
            medic_input=text,
        )

        response_text = await self._client.generate(
            prompt=prompt,
            system_prompt=EMS_SYSTEM_PROMPT,
            temperature=0.3,
            max_tokens=1024,
        )

        data = self._parse_response(response_text)

        # Merge extracted data — key difference: data can span multiple sections
        new_data = data.get("extracted_data", {})
        if isinstance(new_data, dict):
            for section, section_data in new_data.items():
                if not section_data:
                    continue
                if section in ("interventions", "medications") and isinstance(section_data, list):
                    existing = session.extracted_data.get(section, [])
                    if isinstance(existing, list):
                        existing.extend(section_data)
                        session.extracted_data[section] = existing
                    else:
                        session.extracted_data[section] = section_data
                elif isinstance(section_data, dict):
                    if section not in session.extracted_data:
                        session.extracted_data[section] = {}
                    if isinstance(session.extracted_data[section], dict):
                        session.extracted_data[section].update(section_data)
                    else:
                        session.extracted_data[section] = section_data

        # Run deterministic validation on current data
        report = self._build_report(session)
        flags = run_deterministic_validation(report)
        session.validation_flags = [asdict(f) for f in flags]

        # Phase advancement
        phase_complete = data.get("phase_complete", False)
        max_turns = MAX_TURNS_PER_PHASE.get(session.phase, 2)
        if not phase_complete and turns_in_phase >= max_turns:
            phase_complete = True

        if phase_complete:
            session.phase = self._next_phase(session)

        # Use deterministic opening question on phase transition
        question = data.get("next_question", "What else?")
        if phase_complete:
            new_criteria = EMS_PHASE_CRITERIA.get(session.phase, {})
            opening = new_criteria.get("opening_question")
            if opening:
                question = opening

        session.conversation_history.append({"role": "assistant", "content": question})

        # Auto-save to storage
        self._auto_save(session)

        completeness = compute_section_completeness(report)

        return {
            "session_id": session.session_id,
            "run_id": session.run_id,
            "question": question,
            "phase": session.phase,
            "phase_complete": phase_complete,
            "extracted_data": session.extracted_data,
            "validation_flags": session.validation_flags,
            "section_completeness": completeness,
        }

    async def generate_narrative(self, session: EMSReportSession) -> str:
        """Generate a professional ePCR narrative from structured data."""
        report = self._build_report(session)
        report_dict = asdict(report)
        # Remove bulky fields
        for key in ("validation_flags", "section_completeness", "narrative",
                     "icd10_codes", "medical_necessity"):
            report_dict.pop(key, None)

        prompt = EMS_NARRATIVE_PROMPT.format(
            report_json=json.dumps(report_dict, indent=2, default=str),
        )

        narrative = await self._client.generate(
            prompt=prompt,
            system_prompt="You are an EMS documentation specialist. Write clear, professional ePCR narratives.",
            temperature=0.3,
            max_tokens=2000,
        )

        # Strip any JSON wrapping if the model adds it
        if narrative.startswith("{") or narrative.startswith("["):
            try:
                parsed = json.loads(narrative)
                narrative = parsed.get("narrative", narrative)
            except (json.JSONDecodeError, AttributeError):
                pass

        return narrative.strip()

    async def suggest_icd10(self, session: EMSReportSession) -> list[dict[str, Any]]:
        """Suggest ICD-10 codes from documented findings."""
        report = self._build_report(session)
        report_dict = asdict(report)

        prompt = EMS_ICD10_PROMPT.format(
            report_json=json.dumps(report_dict, indent=2, default=str),
        )

        response = await self._client.generate(
            prompt=prompt,
            system_prompt="You are a medical coding specialist. Output ONLY valid JSON.",
            temperature=0.2,
            max_tokens=1000,
        )

        data = self._parse_response(response)
        return data.get("codes", [])

    async def generate_medical_necessity(self, session: EMSReportSession) -> str:
        """Generate the insurance-required medical necessity statement."""
        report = self._build_report(session)
        report_dict = asdict(report)

        prompt = EMS_MEDICAL_NECESSITY_PROMPT.format(
            report_json=json.dumps(report_dict, indent=2, default=str),
        )

        statement = await self._client.generate(
            prompt=prompt,
            system_prompt="You are an EMS billing specialist. Write clear medical necessity statements.",
            temperature=0.2,
            max_tokens=500,
        )

        # Strip any JSON wrapping
        if statement.startswith("{"):
            try:
                parsed = json.loads(statement)
                statement = parsed.get("statement", statement)
            except (json.JSONDecodeError, AttributeError):
                pass

        return statement.strip()

    def _build_report(self, session: EMSReportSession) -> EMSRunReport:
        """Build an EMSRunReport from session extracted data."""
        from src.medgemma.ems_models import (
            DispatchInfo,
            MedicationGiven,
            PatientInfo,
            PrimaryAssessment,
            SceneAssessment,
            SecondaryAssessment,
            TransportInfo,
            VitalSet,
        )

        ed = session.extracted_data
        report = EMSRunReport(
            run_id=session.run_id,
            session_id=session.session_id,
            status="in_progress",
        )

        # Map extracted data to typed dataclasses
        if "dispatch" in ed and isinstance(ed["dispatch"], dict):
            for k, v in ed["dispatch"].items():
                if hasattr(report.dispatch, k):
                    setattr(report.dispatch, k, v)

        if "scene" in ed and isinstance(ed["scene"], dict):
            for k, v in ed["scene"].items():
                if hasattr(report.scene, k):
                    setattr(report.scene, k, v)

        if "patient_info" in ed and isinstance(ed["patient_info"], dict):
            for k, v in ed["patient_info"].items():
                if hasattr(report.patient, k):
                    setattr(report.patient, k, v)

        if "primary_assessment" in ed and isinstance(ed["primary_assessment"], dict):
            for k, v in ed["primary_assessment"].items():
                if hasattr(report.primary_assessment, k):
                    setattr(report.primary_assessment, k, v)

        if "vitals" in ed and isinstance(ed["vitals"], dict):
            # Single vital set from extracted data
            vs = VitalSet()
            for k, v in ed["vitals"].items():
                if hasattr(vs, k):
                    setattr(vs, k, v)
            report.secondary_assessment.vitals.append(vs)

        if "secondary_assessment" in ed and isinstance(ed["secondary_assessment"], dict):
            for k, v in ed["secondary_assessment"].items():
                if k == "vitals":
                    continue  # Handled separately
                if hasattr(report.secondary_assessment, k):
                    setattr(report.secondary_assessment, k, v)

        if "interventions" in ed and isinstance(ed["interventions"], list):
            for item in ed["interventions"]:
                if isinstance(item, dict):
                    report.interventions.append(Intervention(**{
                        k: v for k, v in item.items() if hasattr(Intervention, k)
                    }))

        if "medications" in ed and isinstance(ed["medications"], list):
            for item in ed["medications"]:
                if isinstance(item, dict):
                    report.medications.append(MedicationGiven(**{
                        k: v for k, v in item.items() if hasattr(MedicationGiven, k)
                    }))

        if "transport" in ed and isinstance(ed["transport"], dict):
            for k, v in ed["transport"].items():
                if hasattr(report.transport, k):
                    setattr(report.transport, k, v)

        return report

    def _next_phase(self, session: EMSReportSession) -> str:
        """Advance to the next phase, skipping phases with sufficient data."""
        try:
            idx = EMS_PHASES.index(session.phase)
            for i in range(idx + 1, len(EMS_PHASES)):
                return EMS_PHASES[i]
        except ValueError:
            pass
        return session.phase

    def _format_conversation(self, history: list[dict[str, str]]) -> str:
        lines = []
        for msg in history:
            role = "AI" if msg["role"] == "assistant" else "Medic"
            lines.append(f"{role}: {msg['content']}")
        return "\n".join(lines)

    def _parse_response(self, text: str) -> dict[str, Any]:
        """Parse JSON response from MedGemma."""
        try:
            return self._client._parse_json_response(text)
        except Exception:
            pass

        import re
        try:
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                return json.loads(match.group())
        except (json.JSONDecodeError, Exception):
            pass

        logger.warning("Failed to parse EMS response", text=text[:200])
        return {
            "next_question": "Could you repeat that?",
            "phase_complete": False,
            "extracted_data": {},
            "validation_flags": [],
        }

    def _auto_save(self, session: EMSReportSession) -> None:
        """Auto-save report to storage (non-blocking)."""
        try:
            storage = get_ems_storage()
            report = self._build_report(session)
            storage.save_run(report)
        except Exception as e:
            logger.warning("Auto-save failed", error=str(e))


# Singleton
_assistant: EMSReportAssistant | None = None


def get_ems_assistant() -> EMSReportAssistant:
    global _assistant
    if _assistant is None:
        _assistant = EMSReportAssistant()
    return _assistant
