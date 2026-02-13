"""Longitudinal Visit Tracker — multi-visit patient care management.

Stores vital trends, medication changes, symptom evolution across visits.
JSON file-based storage per patient ID. Provides comparison utilities
to highlight changes between visits.
"""

import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any

import structlog

logger = structlog.get_logger()

# Default storage directory
VISITS_DIR = Path("data/visits")


@dataclass
class Visit:
    """A single patient visit record."""
    visit_id: str
    patient_id: str
    session_id: str
    timestamp: str
    phase_reached: str = "complete"
    extracted_data: dict[str, Any] = field(default_factory=dict)
    triage_result: dict[str, Any] | None = None
    red_flags: list[str] = field(default_factory=list)
    vitals: dict[str, Any] = field(default_factory=dict)
    medications: list[str] = field(default_factory=list)
    diagnoses: list[str] = field(default_factory=list)
    management_plan: dict[str, Any] | None = None


class VisitTracker:
    """Tracks patient visits for longitudinal care management.

    Stores visits as JSON files organized by patient ID.
    Provides utilities for comparing visits and tracking trends.
    """

    def __init__(self, storage_dir: Path | None = None):
        self._storage_dir = storage_dir or VISITS_DIR
        self._storage_dir.mkdir(parents=True, exist_ok=True)

    def _patient_file(self, patient_id: str) -> Path:
        """Get the JSON file path for a patient."""
        safe_id = patient_id.replace("/", "_").replace("\\", "_")
        return self._storage_dir / f"{safe_id}.json"

    def get_visit_history(self, patient_id: str) -> list[dict[str, Any]]:
        """Get all visits for a patient, sorted by timestamp."""
        filepath = self._patient_file(patient_id)
        if not filepath.exists():
            return []

        try:
            data = json.loads(filepath.read_text())
            visits = data.get("visits", [])
            visits.sort(key=lambda v: v.get("timestamp", ""), reverse=True)
            return visits
        except Exception as e:
            logger.error("Failed to read visit history", patient_id=patient_id, error=str(e))
            return []

    def save_visit(self, patient_id: str, session) -> dict[str, Any]:
        """Save a visit from an interview session.

        Args:
            patient_id: Patient identifier for cross-visit linking
            session: InterviewSession with data to save

        Returns:
            The saved visit dict
        """
        import uuid

        visit = Visit(
            visit_id=str(uuid.uuid4()),
            patient_id=patient_id,
            session_id=session.session_id,
            timestamp=datetime.utcnow().isoformat(),
            phase_reached=session.phase,
            extracted_data=session.extracted_data,
            triage_result=session.triage_result,
            red_flags=session.red_flags,
            vitals=self._extract_vitals(session.extracted_data),
            medications=self._extract_medications(session.extracted_data),
            diagnoses=self._extract_diagnoses(session),
        )

        # Try to get management plan
        try:
            from src.medgemma.management_agent import get_management_agent
            agent = get_management_agent()
            plan = agent._plans.get(session.session_id)
            if plan:
                visit.management_plan = {
                    "differential_diagnosis": plan.differential_diagnosis,
                    "treatment_plan": plan.treatment_plan,
                    "disposition": asdict(plan).get("disposition", {}),
                }
        except (ImportError, Exception):
            pass

        visit_dict = asdict(visit)

        # Load existing visits or create new file
        filepath = self._patient_file(patient_id)
        if filepath.exists():
            data = json.loads(filepath.read_text())
        else:
            data = {"patient_id": patient_id, "visits": []}

        data["visits"].append(visit_dict)
        data["last_visit"] = visit.timestamp

        filepath.write_text(json.dumps(data, indent=2))

        logger.info(
            "Visit saved",
            patient_id=patient_id,
            visit_id=visit.visit_id,
            total_visits=len(data["visits"]),
        )

        return visit_dict

    def compare_visits(
        self, patient_id: str, visit_id_a: str, visit_id_b: str
    ) -> dict[str, Any]:
        """Compare two visits and highlight changes.

        Args:
            patient_id: Patient identifier
            visit_id_a: Earlier visit ID
            visit_id_b: Later visit ID

        Returns:
            Comparison dict with changes in vitals, medications, symptoms
        """
        visits = self.get_visit_history(patient_id)
        visit_a = next((v for v in visits if v["visit_id"] == visit_id_a), None)
        visit_b = next((v for v in visits if v["visit_id"] == visit_id_b), None)

        if not visit_a or not visit_b:
            return {"error": "Visit not found"}

        # Compare vitals
        vitals_changes = {}
        for key in set(list(visit_a.get("vitals", {}).keys()) + list(visit_b.get("vitals", {}).keys())):
            val_a = visit_a.get("vitals", {}).get(key)
            val_b = visit_b.get("vitals", {}).get(key)
            if val_a != val_b:
                vitals_changes[key] = {"previous": val_a, "current": val_b}

        # Compare medications
        meds_a = set(visit_a.get("medications", []))
        meds_b = set(visit_b.get("medications", []))
        medication_changes = {
            "added": list(meds_b - meds_a),
            "removed": list(meds_a - meds_b),
            "continued": list(meds_a & meds_b),
        }

        # Compare red flags
        flags_a = set(visit_a.get("red_flags", []))
        flags_b = set(visit_b.get("red_flags", []))

        return {
            "visit_a": {"id": visit_id_a, "timestamp": visit_a.get("timestamp")},
            "visit_b": {"id": visit_id_b, "timestamp": visit_b.get("timestamp")},
            "vitals_changes": vitals_changes,
            "medication_changes": medication_changes,
            "new_red_flags": list(flags_b - flags_a),
            "resolved_red_flags": list(flags_a - flags_b),
        }

    def get_vital_trends(self, patient_id: str) -> dict[str, list]:
        """Get vital sign trends across all visits."""
        visits = self.get_visit_history(patient_id)
        trends: dict[str, list] = {}

        for visit in reversed(visits):  # Chronological order
            vitals = visit.get("vitals", {})
            timestamp = visit.get("timestamp", "")

            for key, value in vitals.items():
                if key not in trends:
                    trends[key] = []
                trends[key].append({"timestamp": timestamp, "value": value})

        return trends

    def _extract_vitals(self, extracted_data: dict[str, Any]) -> dict[str, Any]:
        """Extract vital signs from interview extracted data."""
        vitals = {}
        # Look for vitals in various phases
        for phase_data in extracted_data.values():
            if isinstance(phase_data, dict):
                for key in ("blood_pressure", "heart_rate", "temperature", "respiratory_rate",
                            "oxygen_saturation", "weight", "height", "bmi", "bp", "hr", "temp",
                            "rr", "spo2"):
                    if key in phase_data:
                        vitals[key] = phase_data[key]
        return vitals

    def _extract_medications(self, extracted_data: dict[str, Any]) -> list[str]:
        """Extract medication list from interview extracted data."""
        meds_data = extracted_data.get("medications", {})
        if isinstance(meds_data, dict):
            return meds_data.get("current_medications", [])
        if isinstance(meds_data, list):
            return meds_data
        return []

    def _extract_diagnoses(self, session) -> list[str]:
        """Extract diagnoses from triage result or extracted data."""
        if session.triage_result:
            return session.triage_result.get("differential_diagnoses", [])
        return []


# Singleton
_visit_tracker: VisitTracker | None = None


def get_visit_tracker() -> VisitTracker:
    global _visit_tracker
    if _visit_tracker is None:
        _visit_tracker = VisitTracker()
    return _visit_tracker
