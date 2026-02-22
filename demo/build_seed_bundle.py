#!/usr/bin/env python3
"""Build enriched seed_data.json from collected fixtures.

Reads all JSON fixtures from demo/fixtures/ subdirectories and assembles a
comprehensive seed_data.json with:
- Case sessions populated with real analysis results
- Clinician overrides for visual richness
- Follow-up messages
- Released visit summaries
- Patient records

Usage:
    python demo/build_seed_bundle.py
"""

import json
from datetime import datetime, timedelta
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent / "fixtures"
OUTPUT = FIXTURES_DIR / "seed_data.json"


def load_fixture(subdir: str, filename: str) -> dict | None:
    """Load a fixture JSON file, return None if missing."""
    path = FIXTURES_DIR / subdir / filename
    if not path.exists():
        print(f"  ⊘ Missing: {subdir}/{filename}")
        return None
    return json.loads(path.read_text())


def build_patients() -> list[dict]:
    """Build patient records."""
    return [
        {
            "id": "patient-demo-001",
            "firstName": "Maria",
            "lastName": "Santos",
            "dateOfBirth": "1994-03-15",
            "sex": "female",
            "mrn": "MRN-2024-0142",
            "phone": "555-0142",
            "email": "maria.santos@example.com",
            "allergies": ["Penicillin", "Sulfa drugs"],
            "conditions": ["Gestational hypertension", "G2P1 at 34 weeks"],
            "medications": ["Labetalol 200mg BID", "Prenatal vitamins"],
            "status": "active",
            "createdAt": "2026-02-18T08:00:00.000Z",
            "updatedAt": "2026-02-18T08:00:00.000Z",
        },
        {
            "id": "patient-demo-002",
            "firstName": "James",
            "lastName": "Chen",
            "dateOfBirth": "1963-08-15",
            "sex": "male",
            "mrn": "MRN-2024-0287",
            "phone": "555-0287",
            "email": "james.chen@example.com",
            "allergies": [],
            "conditions": ["Hypertension", "Hyperlipidemia"],
            "medications": ["Lisinopril 20mg daily", "Atorvastatin 40mg daily", "Aspirin 81mg daily"],
            "status": "active",
            "createdAt": "2026-02-17T10:30:00.000Z",
            "updatedAt": "2026-02-17T10:30:00.000Z",
        },
        {
            "id": "patient-demo-003",
            "firstName": "Aisha",
            "lastName": "Patel",
            "dateOfBirth": "1985-07-08",
            "sex": "female",
            "mrn": "MRN-2024-0391",
            "phone": "555-0391",
            "allergies": [],
            "conditions": ["Migraine with aura"],
            "medications": ["Sumatriptan 50mg PRN"],
            "status": "active",
            "createdAt": "2026-02-16T14:15:00.000Z",
            "updatedAt": "2026-02-16T14:15:00.000Z",
        },
        {
            "id": "patient-demo-004",
            "firstName": "Robert",
            "lastName": "Williams",
            "dateOfBirth": "1951-11-20",
            "sex": "male",
            "mrn": "MRN-2024-0456",
            "phone": "555-0456",
            "allergies": ["penicillin"],
            "conditions": ["atrial fibrillation", "type 2 diabetes", "CKD stage 3"],
            "medications": ["warfarin 5mg daily", "amiodarone 200mg daily", "lisinopril 20mg daily", "metformin 1000mg BID"],
            "status": "active",
            "createdAt": "2026-02-15T09:00:00.000Z",
            "updatedAt": "2026-02-15T09:00:00.000Z",
        },
    ]


def build_case_session(
    case_id: str,
    title: str,
    patient_id: str,
    case_text: str,
    result: dict,
    overrides: dict | None = None,
    followups: list | None = None,
    events: list | None = None,
    created_offset_hours: int = 0,
) -> dict:
    """Build a CaseSession from fixture data."""
    base_time = datetime(2026, 2, 20, 9, 0, 0)
    created = base_time - timedelta(hours=created_offset_hours)

    session = {
        "id": f"session-demo-{case_id}",
        "title": title,
        "patientId": patient_id,
        "createdAt": created.isoformat() + "Z",
        "updatedAt": (created + timedelta(minutes=15)).isoformat() + "Z",
        "originalCaseText": case_text,
        "currentCaseText": case_text,
        "currentResult": result,
        "events": events or [
            {
                "id": f"event-{case_id}-001",
                "timestamp": created.isoformat() + "Z",
                "type": "initial_analysis",
                "changeSummary": "Initial case analysis completed",
            }
        ],
        "followUpMessages": followups or [],
        "overrides": overrides or {
            "treatments": {},
            "acuteActions": {},
            "customActions": [],
            "sectionCustomActions": {},
            "customTreatments": [],
            "dischargeMeds": [],
            "dischargeInstructions": "",
            "safetyAcknowledgments": {},
            "riskScoreInputs": {},
            "lastModified": (created + timedelta(minutes=15)).isoformat() + "Z",
        },
        "activeTab": "assessment",
    }
    return session


def build_rich_overrides(result: dict) -> dict:
    """Build clinician overrides for visual demo richness."""
    treatments = result.get("treatment_options", [])
    treatment_overrides = {}

    # Accept first 3 treatments, reject 1, modify 1
    for i, t in enumerate(treatments[:5]):
        name = t.get("name", f"treatment-{i}")
        if i < 3:
            treatment_overrides[name] = {
                "verdict": "accepted",
                "status": "ordered" if i < 2 else "administered",
                "notes": "",
            }
        elif i == 3:
            treatment_overrides[name] = {
                "verdict": "rejected",
                "notes": "Patient reports prior adverse reaction",
            }
        elif i == 4:
            treatment_overrides[name] = {
                "verdict": "modified",
                "modifiedDose": "Reduced dose — renal adjustment",
                "status": "ordered",
                "notes": "Dose adjusted for CKD stage 3",
            }

    # Check 5 of 8 acute management actions
    acute_overrides = {}
    actions = result.get("acute_management", {}).get("immediate_actions", [])
    for i, action in enumerate(actions[:8]):
        key = action.replace(" ", "_").lower()[:40]
        acute_overrides[key] = {"checked": i < 5}

    # Acknowledge 1 safety alert
    safety_acks = {}
    interactions = result.get("medication_review", {}).get("interactions", [])
    if interactions:
        safety_acks["interaction-0"] = {
            "acknowledged": True,
            "by": "Dr. Rivera",
            "note": "Aware — monitoring INR closely, aspirin dose reduced to 81mg",
        }

    return {
        "treatments": treatment_overrides,
        "acuteActions": acute_overrides,
        "customActions": [
            {"text": "Notify family of admission to CCU", "checked": True, "addedAt": "2026-02-20T09:10:00Z"},
            {"text": "Contact pharmacy for ticagrelor 90mg BID supply", "checked": False, "addedAt": "2026-02-20T09:12:00Z"},
        ],
        "sectionCustomActions": {},
        "customTreatments": [],
        "dischargeMeds": [
            {"name": "Aspirin", "dose": "81mg", "frequency": "Once daily", "source": "ai", "action": "continue"},
            {"name": "Ticagrelor", "dose": "90mg", "frequency": "Twice daily", "source": "ai", "action": "new"},
            {"name": "Metoprolol Succinate", "dose": "25mg", "frequency": "Once daily", "source": "clinician", "action": "new"},
            {"name": "Atorvastatin", "dose": "80mg", "frequency": "Once daily at bedtime", "source": "ai", "action": "continue"},
            {"name": "Lisinopril", "dose": "20mg", "frequency": "Once daily", "source": "ai", "action": "continue"},
        ],
        "dischargeInstructions": "Take ALL medications as prescribed. Never stop ticagrelor without calling your cardiologist. Report any chest pain, shortness of breath, or unusual bleeding immediately.",
        "safetyAcknowledgments": safety_acks,
        "riskScoreInputs": {
            "heart_score": {"troponin": 2},
        },
        "lastModified": "2026-02-20T09:15:00Z",
    }


def build_followup_messages(followup_data: dict | None) -> list[dict]:
    """Build follow-up message list from fixture."""
    if not followup_data:
        return []
    messages = []
    for i, fu in enumerate(followup_data.get("followups", [])):
        messages.append({
            "id": f"fu-{i*2+1:03d}",
            "role": "user",
            "content": fu.get("question", ""),
        })
        messages.append({
            "id": f"fu-{i*2+2:03d}",
            "role": "assistant",
            "content": fu.get("answer", ""),
        })
    return messages


def _convert_restrictions(restrictions) -> list[str]:
    """Convert restriction objects to plain strings (matching mapRestrictions in visit-summary-builder.ts)."""
    if isinstance(restrictions, str):
        return [restrictions] if restrictions else []
    result = []
    for r in restrictions:
        if isinstance(r, str):
            result.append(r)
        elif isinstance(r, dict):
            text = r.get("restriction", "")
            duration = r.get("duration", "")
            if duration:
                text = f"{text} ({duration})"
            result.append(text)
    return result


def build_visit_summary(session_id: str, patient_id: str, discharge_data: dict | None) -> dict | None:
    """Build released visit summary from discharge plan data."""
    if not discharge_data:
        return None

    meds = []
    for m in discharge_data.get("medications", []):
        meds.append({
            "name": m.get("name", ""),
            "dose": m.get("dose", ""),
            "frequency": m.get("frequency", ""),
            "action": m.get("action", "continue"),
            "plainLanguageInstructions": m.get("instructions", m.get("plainLanguageInstructions", "")),
        })

    return {
        "id": f"summary-{session_id}",
        "caseSessionId": session_id,
        "patientId": patient_id,
        "diagnosis": discharge_data.get("diagnosis", ""),
        "diagnosisExplanation": discharge_data.get("patient_explanation", discharge_data.get("diagnosisExplanation", "")),
        "medications": meds,
        "dischargeInstructions": discharge_data.get("patient_instructions", discharge_data.get("dischargeInstructions", "")),
        "followUps": discharge_data.get("follow_up_appointments", discharge_data.get("followUps", [])),
        "redFlags": discharge_data.get("red_flags", discharge_data.get("redFlags", [])),
        "restrictions": _convert_restrictions(
            discharge_data.get("activity_restrictions", discharge_data.get("restrictions", []))
        ),
        "releasedAt": "2026-02-20T12:00:00.000Z",
        "releasedBy": "Dr. Michael Rivera, Interventional Cardiology",
        "visitDate": "2026-02-20",
        "status": "released",
    }


# Case text lookups (same as seed_all.py)
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from demo.seed_all import STEMI_CASE, ECLAMPSIA_CASE, EVAL_CASES


CASE_CONFIGS = [
    {
        "case_id": "stemi",
        "fixture_name": "stemi_anterior.json",
        "title": "Anterior STEMI — 62yo Male",
        "patient_id": "patient-demo-002",
        "case_text": STEMI_CASE,
        "rich_overrides": True,
        "offset_hours": 0,
    },
    {
        "case_id": "stemi-inferior",
        "fixture_name": "stemi_inferior.json",
        "title": "Inferior STEMI — 62yo Female",
        "patient_id": "",
        "case_text": EVAL_CASES.get("stemi_inferior", ""),
        "offset_hours": 2,
    },
    {
        "case_id": "stroke",
        "fixture_name": "stroke_mca_m1.json",
        "title": "MCA Stroke — 62yo Female",
        "patient_id": "",
        "case_text": EVAL_CASES.get("stroke_mca_m1", ""),
        "offset_hours": 4,
    },
    {
        "case_id": "eclampsia",
        "fixture_name": "eclampsia.json",
        "title": "Eclampsia — 32yo G2P1",
        "patient_id": "patient-demo-001",
        "case_text": ECLAMPSIA_CASE,
        "offset_hours": 6,
    },
    {
        "case_id": "lithium",
        "fixture_name": "lithium_toxicity.json",
        "title": "Lithium Toxicity — 45yo Female",
        "patient_id": "",
        "case_text": EVAL_CASES.get("lithium_toxicity", ""),
        "offset_hours": 8,
    },
    {
        "case_id": "sepsis",
        "fixture_name": "sepsis_urosource.json",
        "title": "Urosepsis — 75yo Female",
        "patient_id": "",
        "case_text": EVAL_CASES.get("sepsis_urosource", ""),
        "offset_hours": 10,
    },
]


def main():
    print("Building enriched seed_data.json...")

    patients = build_patients()
    case_sessions = []
    released_summaries = []

    # Load follow-up data
    followup_data = load_fixture("case_analysis", "stemi_followup.json")
    discharge_data = load_fixture("case_analysis", "stemi_discharge.json")

    for cfg in CASE_CONFIGS:
        result = load_fixture("case_analysis", cfg["fixture_name"])
        if not result:
            print(f"  Skipping {cfg['case_id']} — no fixture")
            continue

        overrides = build_rich_overrides(result) if cfg.get("rich_overrides") else None

        # Add follow-ups to STEMI case
        followups = build_followup_messages(followup_data) if cfg["case_id"] == "stemi" else []

        # Build events — add reassessment event for STEMI
        events = [
            {
                "id": f"event-{cfg['case_id']}-001",
                "timestamp": "2026-02-20T09:00:00Z",
                "type": "initial_analysis",
                "changeSummary": "Initial case analysis completed",
            }
        ]

        if cfg["case_id"] == "stemi":
            reassess = load_fixture("case_analysis", "stemi_reassessment.json")
            if reassess:
                events.append({
                    "id": f"event-{cfg['case_id']}-002",
                    "timestamp": "2026-02-20T09:30:00Z",
                    "type": "new_findings",
                    "findings": {
                        "category": "labs",
                        "text": "Repeat troponin I now 4.2 ng/mL (up from 0.82). ECG shows new Q waves in V2-V4.",
                    },
                })
                events.append({
                    "id": f"event-{cfg['case_id']}-003",
                    "timestamp": "2026-02-20T09:32:00Z",
                    "type": "reassessment_complete",
                    "changeSummary": "Case reassessed with new lab findings — troponin trending up, new Q waves",
                })

        session = build_case_session(
            case_id=cfg["case_id"],
            title=cfg["title"],
            patient_id=cfg["patient_id"],
            case_text=cfg["case_text"],
            result=result,
            overrides=overrides,
            followups=followups,
            events=events,
            created_offset_hours=cfg.get("offset_hours", 0),
        )
        case_sessions.append(session)
        print(f"  ✓ {cfg['case_id']}: {len(result.get('treatment_options', []))} treatments")

    # Build visit summary for STEMI
    if discharge_data:
        vs = build_visit_summary("session-demo-stemi", "patient-demo-002", discharge_data)
        if vs:
            released_summaries.append(vs)
            print("  ✓ Visit summary for STEMI")

    # Assemble seed data
    seed_data = {
        "patients": patients,
        "caseSessions": case_sessions,
        "releasedSummaries": released_summaries,
    }

    OUTPUT.write_text(json.dumps(seed_data, indent=2))
    n_sessions = len(case_sessions)
    print(f"\n✓ Wrote {OUTPUT} ({n_sessions} case sessions, {len(patients)} patients)")


if __name__ == "__main__":
    main()
