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


def build_agent_result() -> dict:
    """Build a static AgentSessionResult for the STEMI demo case."""
    return {
        "assessment": {
            "primary_diagnosis": "Acute Anterior ST-Elevation Myocardial Infarction (STEMI)",
            "confidence": 0.92,
            "key_findings": [
                "ST elevation in leads V1-V4 (anterior distribution)",
                "Troponin I 2.4 ng/mL (significantly elevated)",
                "Substernal chest pressure radiating to jaw",
                "Diaphoresis with hemodynamic stability (SBP 142, HR 88)",
            ],
            "disposition": "Cardiac catheterization lab — emergent PCI",
            "recommended_actions": [
                "Activate cath lab for emergent PCI",
                "Administer dual antiplatelet therapy (aspirin 81mg + ticagrelor 180mg load)",
                "Start heparin drip per ACS protocol (target aPTT 50-70s)",
                "Obtain cardiology consult — door-to-balloon time < 90 min",
            ],
        },
        "consensus": {
            "agreements": [
                {
                    "finding": "Acute anterior STEMI diagnosis based on ECG + troponin + clinical presentation",
                    "models": ["MedGemma 27B", "Risk Score Engine"],
                    "confidence": 0.95,
                },
                {
                    "finding": "Emergent PCI is the indicated reperfusion strategy",
                    "models": ["MedGemma 27B", "Risk Score Engine"],
                    "confidence": 0.93,
                },
            ],
            "disagreements": [
                {
                    "finding": "Timing of beta-blocker initiation",
                    "model_a": {
                        "name": "MedGemma 27B",
                        "position": "Start metoprolol 25mg PO within 24h if hemodynamically stable",
                    },
                    "model_b": {
                        "name": "Risk Score Engine",
                        "position": "Defer beta-blocker until post-PCI hemodynamic reassessment",
                    },
                    "resolution": "Defer initiation until post-catheterization — reassess hemodynamics and LV function first",
                },
            ],
            "integrated_assessment": "High-confidence STEMI diagnosis with concordant risk stratification across models. Emergent PCI indicated with standard dual antiplatelet therapy.",
            "overall_confidence": 0.88,
            "contributing_models": ["MedGemma 27B", "Risk Score Engine"],
            "recommended_next_steps": [
                "Proceed to cath lab within 90 minutes of presentation",
                "Serial troponins q3h post-PCI",
                "Echocardiography within 24h to assess LV function",
            ],
        },
        "toolResults": [
            {
                "tool": "compute_risk_scores",
                "model": "Risk Score Engine",
                "result": {
                    "scores": [
                        {
                            "score_id": "timi_score",
                            "score_name": "TIMI Risk Score for STEMI",
                            "total_score": 5,
                            "max_score": 14,
                            "risk_level": "Intermediate-High",
                            "risk_interpretation": "TIMI score of 5 indicates approximately 12% 30-day mortality risk. Emergent reperfusion is indicated.",
                            "recommendation": "Emergent reperfusion therapy (PCI preferred over fibrinolysis when available within 120 min)",
                            "variables": [
                                {"name": "age_65_74", "value": 2, "source": "deterministic", "points": 2, "label": "Age 65-74", "criteria": "Age between 65-74 years"},
                                {"name": "systolic_bp_lt_100", "value": 0, "source": "deterministic", "points": 0, "label": "SBP >= 100 mmHg", "criteria": "Systolic BP < 100 mmHg"},
                                {"name": "heart_rate_gt_100", "value": 0, "source": "deterministic", "points": 0, "label": "HR <= 100 bpm", "criteria": "Heart rate > 100 bpm"},
                                {"name": "killip_class", "value": 0, "source": "deterministic", "points": 0, "label": "Killip class I", "criteria": "Killip class II-IV"},
                                {"name": "anterior_st_elevation", "value": 1, "source": "deterministic", "points": 1, "label": "Anterior ST elevation", "criteria": "Anterior ST elevation or LBBB"},
                                {"name": "diabetes_hx_angina_htn", "value": 1, "source": "medgemma", "points": 1, "label": "Hypertension history", "criteria": "Diabetes, hx angina, or hypertension"},
                                {"name": "weight_lt_67kg", "value": 0, "source": "missing", "points": 0, "label": "Weight >= 67 kg", "criteria": "Weight < 67 kg"},
                                {"name": "time_to_treatment_gt_4h", "value": 1, "source": "medgemma", "points": 1, "label": "> 4h to treatment", "criteria": "Time to treatment > 4 hours"},
                            ],
                            "missing_variables": ["weight_lt_67kg"],
                            "applicable": True,
                        },
                        {
                            "score_id": "grace_score",
                            "score_name": "GRACE ACS Risk Score",
                            "total_score": 168,
                            "max_score": 372,
                            "risk_level": "High",
                            "risk_interpretation": "GRACE score 168 indicates high risk. In-hospital mortality >3%. Recommend invasive strategy within 24h.",
                            "recommendation": "Early invasive strategy (cardiac catheterization within 24h); continuous monitoring in CCU",
                            "variables": [
                                {"name": "age", "value": 58, "source": "deterministic", "points": 58, "label": "Age 62", "criteria": "Age in years (continuous)"},
                                {"name": "heart_rate", "value": 15, "source": "deterministic", "points": 15, "label": "HR 88 bpm", "criteria": "Heart rate at presentation"},
                                {"name": "systolic_bp", "value": 24, "source": "deterministic", "points": 24, "label": "SBP 142 mmHg", "criteria": "Systolic blood pressure"},
                                {"name": "creatinine", "value": 7, "source": "deterministic", "points": 7, "label": "Creatinine 1.1", "criteria": "Serum creatinine (mg/dL)"},
                                {"name": "killip_class", "value": 0, "source": "deterministic", "points": 0, "label": "Killip class I", "criteria": "Killip classification (I-IV)"},
                                {"name": "cardiac_arrest", "value": 0, "source": "deterministic", "points": 0, "label": "No cardiac arrest", "criteria": "Cardiac arrest at admission"},
                                {"name": "st_deviation", "value": 28, "source": "deterministic", "points": 28, "label": "ST elevation present", "criteria": "ST-segment deviation"},
                                {"name": "elevated_biomarkers", "value": 36, "source": "deterministic", "points": 36, "label": "Troponin elevated", "criteria": "Elevated cardiac biomarkers"},
                            ],
                            "missing_variables": [],
                            "applicable": True,
                        },
                    ],
                    "summary": "Multi-score assessment confirms high-risk STEMI. TIMI 5/14, GRACE 168 all support emergent PCI.",
                },
            },
            {
                "tool": "check_drug_interactions",
                "model": "TxGemma",
                "result": {
                    "interactions": [
                        {
                            "drug_a": "aspirin",
                            "drug_b": "ticagrelor",
                            "severity": "moderate",
                            "description": "Aspirin doses >100mg may reduce ticagrelor effectiveness. Maintain aspirin at 81mg.",
                            "recommendation": "Keep aspirin at 81mg daily — do NOT increase dose",
                        },
                        {
                            "drug_a": "heparin",
                            "drug_b": "aspirin",
                            "severity": "moderate",
                            "description": "Combined anticoagulant and antiplatelet therapy increases bleeding risk.",
                            "recommendation": "Monitor aPTT closely, watch for signs of bleeding",
                        },
                    ],
                    "safe_to_proceed": True,
                    "summary": "No absolute contraindications. Two moderate interactions noted — manageable with dose awareness and monitoring.",
                },
            },
        ],
        "toolsUsed": ["compute_risk_scores", "check_drug_interactions"],
        "completedAt": "2026-02-20T09:20:00Z",
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

        # Add agent result to STEMI case
        if cfg["case_id"] == "stemi":
            agent_result = build_agent_result()
            session["agentResult"] = agent_result

            # Add [Agent] prefixed actions to overrides
            if overrides and agent_result.get("assessment", {}).get("recommended_actions"):
                agent_actions = [
                    {
                        "id": f"agent-demo-{i}",
                        "text": f"[Agent] {action}",
                        "checked": False,
                        "addedAt": "2026-02-20T09:20:00Z",
                    }
                    for i, action in enumerate(agent_result["assessment"]["recommended_actions"])
                ]
                overrides.setdefault("sectionCustomActions", {})
                overrides["sectionCustomActions"]["immediate"] = agent_actions
                session["overrides"] = overrides
            print(f"  ✓ {cfg['case_id']}: agentResult attached")

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
