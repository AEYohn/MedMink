"""Referral Tracker — specialist referral workflow management.

Creates, tracks, and manages specialist referrals with shareable links.
JSON file-based storage at data/referrals/. Follows visit_tracker.py pattern.
"""

import json
import secrets
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import structlog

logger = structlog.get_logger()

REFERRALS_DIR = Path("data/referrals")

ReferralStatus = str  # draft | sent | viewed | responded | completed


@dataclass
class Referral:
    """A specialist referral record."""

    # Identity
    referral_id: str
    token: str
    case_session_id: str
    patient_id: str

    # Referral note content
    specialty: str
    urgency: str  # emergent | urgent | routine
    clinical_question: str
    relevant_history: str
    pertinent_findings: list[str]
    current_management: str
    specific_asks: list[str]
    reason_for_urgency: str

    # Case snapshot
    parsed_case: dict[str, Any] = field(default_factory=dict)
    treatment_options: list[dict[str, Any]] = field(default_factory=list)
    acute_management: dict[str, Any] = field(default_factory=dict)
    clinical_pearls: list[str] = field(default_factory=list)
    differential_diagnosis: dict[str, Any] | None = None
    risk_scores: dict[str, Any] | None = None

    # Status lifecycle
    status: ReferralStatus = "sent"
    created_at: str = ""
    sent_at: str = ""
    viewed_at: str = ""
    responded_at: str = ""
    completed_at: str = ""

    # Specialist response
    specialist_name: str = ""
    specialist_response: str = ""
    recommendations: list[str] = field(default_factory=list)
    follow_up_needed: bool = False

    # Access control
    link_expires_at: str = ""
    view_count: int = 0


class ReferralTracker:
    """Manages specialist referrals with JSON file storage."""

    def __init__(self, storage_dir: Path | None = None):
        self._storage_dir = storage_dir or REFERRALS_DIR
        self._storage_dir.mkdir(parents=True, exist_ok=True)
        self._index_file = self._storage_dir / "_index.json"
        self._ensure_index()

    def _ensure_index(self) -> None:
        if not self._index_file.exists():
            self._index_file.write_text(json.dumps({"referrals": []}, indent=2))

    def _read_index(self) -> dict[str, Any]:
        try:
            return json.loads(self._index_file.read_text())
        except Exception:
            return {"referrals": []}

    def _write_index(self, index: dict[str, Any]) -> None:
        self._index_file.write_text(json.dumps(index, indent=2))

    def _referral_file(self, referral_id: str) -> Path:
        return self._storage_dir / f"{referral_id}.json"

    def create_referral(
        self,
        case_session_id: str,
        patient_id: str,
        referral_note: dict[str, Any],
        case_snapshot: dict[str, Any],
        expires_in_hours: int | None = None,
    ) -> Referral:
        """Create and save a new referral."""
        now = datetime.utcnow().isoformat()
        referral = Referral(
            referral_id=str(uuid.uuid4()),
            token=secrets.token_urlsafe(32),
            case_session_id=case_session_id,
            patient_id=patient_id,
            # Referral note fields
            specialty=referral_note.get("specialty", ""),
            urgency=referral_note.get("urgency", "routine"),
            clinical_question=referral_note.get("clinical_question", ""),
            relevant_history=referral_note.get("relevant_history", ""),
            pertinent_findings=referral_note.get("pertinent_findings", []),
            current_management=referral_note.get("current_management", ""),
            specific_asks=referral_note.get("specific_asks", []),
            reason_for_urgency=referral_note.get("reason_for_urgency", ""),
            # Case snapshot
            parsed_case=case_snapshot.get("parsed_case", {}),
            treatment_options=case_snapshot.get("treatment_options", []),
            acute_management=case_snapshot.get("acute_management", {}),
            clinical_pearls=case_snapshot.get("clinical_pearls", []),
            differential_diagnosis=case_snapshot.get("differential_diagnosis"),
            risk_scores=case_snapshot.get("risk_scores"),
            # Status
            status="sent",
            created_at=now,
            sent_at=now,
        )

        if expires_in_hours is not None:
            referral.link_expires_at = (
                datetime.utcnow() + timedelta(hours=expires_in_hours)
            ).isoformat()

        # Save individual file
        self._referral_file(referral.referral_id).write_text(json.dumps(asdict(referral), indent=2))

        # Update index
        index = self._read_index()
        index["referrals"].append(
            {
                "referral_id": referral.referral_id,
                "token": referral.token,
                "case_session_id": case_session_id,
                "patient_id": patient_id,
                "specialty": referral.specialty,
                "urgency": referral.urgency,
                "clinical_question": referral.clinical_question,
                "status": referral.status,
                "created_at": now,
            }
        )
        self._write_index(index)

        logger.info(
            "Referral created",
            referral_id=referral.referral_id,
            specialty=referral.specialty,
        )
        return referral

    def get_referral(self, referral_id: str) -> Referral | None:
        """Get referral by ID."""
        filepath = self._referral_file(referral_id)
        if not filepath.exists():
            return None
        try:
            data = json.loads(filepath.read_text())
            return Referral(**data)
        except Exception as e:
            logger.error("Failed to read referral", referral_id=referral_id, error=str(e))
            return None

    def get_by_token(self, token: str) -> Referral | None:
        """Get referral by shareable token, incrementing view count."""
        index = self._read_index()
        entry = next((r for r in index["referrals"] if r.get("token") == token), None)
        if not entry:
            return None

        referral = self.get_referral(entry["referral_id"])
        if not referral:
            return None

        # Check expiry
        if referral.link_expires_at:
            try:
                expires = datetime.fromisoformat(referral.link_expires_at)
                if datetime.utcnow() > expires:
                    return None
            except ValueError:
                pass

        # Increment view count and update status
        referral.view_count += 1
        if referral.status == "sent":
            referral.status = "viewed"
            referral.viewed_at = datetime.utcnow().isoformat()
            self._update_index_status(referral.referral_id, "viewed")

        self._save_referral(referral)
        return referral

    def list_inbox(
        self, specialty: str | None = None, status: str | None = None
    ) -> list[dict[str, Any]]:
        """List referrals for specialist inbox, sorted by urgency then recency."""
        index = self._read_index()
        results = index["referrals"]

        if specialty:
            results = [r for r in results if r.get("specialty", "").lower() == specialty.lower()]
        if status:
            results = [r for r in results if r.get("status") == status]

        urgency_order = {"emergent": 0, "urgent": 1, "routine": 2}
        results.sort(
            key=lambda r: (
                urgency_order.get(r.get("urgency", "routine"), 2),
                r.get("created_at", ""),
            )
        )
        # Most recent first within same urgency
        results.sort(
            key=lambda r: (
                urgency_order.get(r.get("urgency", "routine"), 2),
                -(datetime.fromisoformat(r.get("created_at", "2000-01-01")).timestamp()),
            )
        )

        return results

    def list_sent(self) -> list[dict[str, Any]]:
        """List all sent referrals for the referring clinician."""
        index = self._read_index()
        results = list(index["referrals"])
        results.sort(key=lambda r: r.get("created_at", ""), reverse=True)
        return results

    def add_response(
        self,
        referral_id: str,
        specialist_name: str,
        response: str,
        recommendations: list[str],
        follow_up_needed: bool,
    ) -> Referral | None:
        """Add specialist response to a referral."""
        referral = self.get_referral(referral_id)
        if not referral:
            return None

        referral.specialist_name = specialist_name
        referral.specialist_response = response
        referral.recommendations = recommendations
        referral.follow_up_needed = follow_up_needed
        referral.status = "responded"
        referral.responded_at = datetime.utcnow().isoformat()

        self._save_referral(referral)
        self._update_index_status(referral_id, "responded")

        logger.info(
            "Referral response added",
            referral_id=referral_id,
            specialist=specialist_name,
        )
        return referral

    def update_status(self, referral_id: str, new_status: str) -> Referral | None:
        """Update referral status (lifecycle transitions)."""
        referral = self.get_referral(referral_id)
        if not referral:
            return None

        referral.status = new_status
        timestamp = datetime.utcnow().isoformat()
        if new_status == "viewed":
            referral.viewed_at = timestamp
        elif new_status == "responded":
            referral.responded_at = timestamp
        elif new_status == "completed":
            referral.completed_at = timestamp

        self._save_referral(referral)
        self._update_index_status(referral_id, new_status)
        return referral

    def _save_referral(self, referral: Referral) -> None:
        self._referral_file(referral.referral_id).write_text(json.dumps(asdict(referral), indent=2))

    def _update_index_status(self, referral_id: str, new_status: str) -> None:
        index = self._read_index()
        for entry in index["referrals"]:
            if entry.get("referral_id") == referral_id:
                entry["status"] = new_status
                break
        self._write_index(index)


# Singleton
_referral_tracker: ReferralTracker | None = None


def get_referral_tracker() -> ReferralTracker:
    global _referral_tracker
    if _referral_tracker is None:
        _referral_tracker = ReferralTracker()
    return _referral_tracker
