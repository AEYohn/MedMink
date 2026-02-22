#!/usr/bin/env python3
"""Master seed script: calls every backend endpoint and saves responses to demo/fixtures/.

Usage:
    # Start backend first:
    cd /Users/noam1/research-synthesizer && source .venv/bin/activate
    python -m uvicorn src.api.main:app --port 8001

    # Run seed collection:
    python demo/seed_all.py [--feature N] [--base-url URL]
"""

import argparse
import asyncio
import base64
import json
import sys
import time
from pathlib import Path

import httpx

BASE_URL = "http://localhost:8001"
FIXTURES_DIR = Path(__file__).parent / "fixtures"
SAMPLE_IMAGES = Path(__file__).parent / "sample_images"
TIMEOUT = 120.0  # 2 minutes for non-streaming endpoints
STREAM_TIMEOUT = 600.0  # 10 minutes for SSE streaming (MedGemma analysis)


# ─── Test case vignettes ──────────────────────────────────────────────────────

STEMI_CASE = (Path(__file__).parent / "stemi_case.txt").read_text().strip()
ECLAMPSIA_CASE = (Path(__file__).parent / "eclampsia_case.txt").read_text().strip()

# From test_cases.py — select 5 visually distinct cases
EVAL_CASES = {
    "stemi_inferior": (
        "A 62-year-old female with history of hypertension and hyperlipidemia presents "
        "with substernal chest pressure radiating to her left jaw for the past 45 minutes. "
        "She is diaphoretic and nauseated. Vitals: BP 165/95, HR 102, SpO2 96% on room air. "
        "ECG shows ST-segment elevation in leads II, III, and aVF. "
        "Troponin I is 2.4 ng/mL (normal <0.04)."
    ),
    "stroke_mca_m1": (
        "A 62-year-old right-handed female is brought to the emergency department by EMS "
        "at 2:15 PM after her husband witnessed sudden onset of left-sided weakness and "
        "slurred speech beginning at 1:30 PM while she was gardening. She has a history of "
        "atrial fibrillation (not on anticoagulation due to prior patient refusal), "
        "hypertension on lisinopril 10 mg daily, type 2 diabetes on metformin 500 mg twice "
        "daily, and hyperlipidemia on atorvastatin 20 mg daily.\n\n"
        "En route, EMS documented: GCS 13 (E4V4M5), right gaze preference, left facial "
        "droop, left arm 1/5 strength, left leg 2/5 strength. Blood glucose by EMS: "
        "142 mg/dL.\n\n"
        "On ED arrival at 2:15 PM: BP 186/102 mmHg, HR 92 bpm irregularly irregular, "
        "RR 16/min, SpO2 96% on room air, Temp 37.0°C. Patient is awake but dysarthric. "
        "NIHSS score: 16. Right gaze deviation, left homonymous hemianopia, left facial "
        "droop (upper and lower), left arm plegic (0/5), left leg severely weak (1/5), "
        "left-sided neglect, dysarthria. No hemorrhagic signs on examination.\n\n"
        "Labs (drawn at 2:20 PM): Glucose 148 mg/dL, INR 1.0, PT 12.2 sec, PTT 28 sec, "
        "Platelets 210,000/μL, Creatinine 0.9 mg/dL. CT head without contrast (completed "
        "at 2:28 PM): No hemorrhage, no early ischemic changes, no mass effect. "
        "CT angiography: Complete occlusion of the right middle cerebral artery "
        "(M1 segment)."
    ),
    "eclampsia": ECLAMPSIA_CASE,
    "lithium_toxicity": (
        "A 45-year-old female with bipolar disorder on lithium 900 mg BID and "
        "hydrochlorothiazide 25 mg daily presents with 3 days of progressive confusion, "
        "coarse tremor, nausea, and diarrhea. She started the thiazide 2 weeks ago for "
        "hypertension. Vitals: BP 140/88, HR 68, T 37.1°C. "
        "Exam: coarse bilateral hand tremor, hyperreflexia, ataxic gait, disoriented "
        "to time and place. Labs: lithium level 3.2 mEq/L (therapeutic 0.6-1.2), "
        "Na 131, K 3.1, Cr 2.1 (baseline 0.9), BUN 38, glucose 95."
    ),
    "sepsis_urosource": (
        "A 75-year-old female with diabetes mellitus, recurrent UTIs, and an indwelling "
        "Foley catheter removed 3 days ago presents with fever, rigors, and confusion "
        "for 12 hours. She was found by her daughter, disoriented and unable to stand. "
        "Vitals: BP 82/50, HR 118, RR 24, T 39.8°C, SpO2 93% on RA. "
        "Exam: lethargic but arousable, suprapubic tenderness, CVAT on the right. "
        "Labs: WBC 22,400 with 15% bands, lactate 4.8 mmol/L, Cr 2.3 (baseline 1.0), "
        "BUN 42, glucose 210, procalcitonin 12.5 ng/mL. "
        "UA: positive nitrites, large leukocyte esterase, >100 WBC/hpf, bacteria 3+. "
        "Blood cultures drawn x2. CT abdomen/pelvis: right-sided hydronephrosis with "
        "perinephric stranding."
    ),
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def save_json(subdir: str, filename: str, data: dict | list) -> Path:
    """Save JSON to fixtures subdirectory."""
    path = FIXTURES_DIR / subdir / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str))
    return path


def load_image_b64(name: str) -> str:
    """Load an image from sample_images and return base64."""
    path = SAMPLE_IMAGES / name
    if not path.exists():
        raise FileNotFoundError(f"Sample image not found: {path}")
    return base64.b64encode(path.read_bytes()).decode("utf-8")


async def parse_sse_stream(response: httpx.Response) -> dict | None:
    """Parse SSE stream and return the final result data."""
    result = None
    buffer = ""
    async for chunk in response.aiter_text():
        buffer += chunk
        while "\n\n" in buffer:
            event_str, buffer = buffer.split("\n\n", 1)
            for line in event_str.split("\n"):
                if line.startswith("data: "):
                    try:
                        event = json.loads(line[6:])
                        if event.get("type") == "result":
                            result = event.get("data", event)
                        elif event.get("type") == "step":
                            step = event.get("step", "")
                            msg = event.get("message", "")
                            print(f"    SSE step: {step} — {msg}")
                        elif event.get("type") == "error":
                            print(f"    SSE ERROR: {event.get('message', 'unknown')}")
                            return {"error": event.get("message", "unknown")}
                    except json.JSONDecodeError:
                        pass
    return result


def timer():
    """Simple context timer."""
    class Timer:
        def __init__(self):
            self.elapsed = 0
        def __enter__(self):
            self._start = time.time()
            return self
        def __exit__(self, *args):
            self.elapsed = time.time() - self._start
    return Timer()


# ─── Feature collectors ───────────────────────────────────────────────────────

async def feature_1_case_analysis(client: httpx.AsyncClient):
    """Feature 1: Clinical Case Analysis (streaming) — 5 eval cases + STEMI."""
    print("\n═══ Feature 1: Clinical Case Analysis (Streaming) ═══")
    cases = {"stemi_anterior": STEMI_CASE, **EVAL_CASES}

    for case_id, case_text in cases.items():
        print(f"\n  Analyzing: {case_id}...")
        with timer() as t:
            async with client.stream(
                "POST", f"{BASE_URL}/api/case/analyze/stream",
                json={"case_text": case_text},
                timeout=STREAM_TIMEOUT,
            ) as resp:
                result = await parse_sse_stream(resp)

        if result:
            save_json("case_analysis", f"{case_id}.json", result)
            n_treatments = len(result.get("treatment_options", []))
            print(f"    ✓ Saved ({n_treatments} treatments, {t.elapsed:.1f}s)")
        else:
            print(f"    ✗ No result for {case_id}")


async def feature_2_reassessment(client: httpx.AsyncClient):
    """Feature 2: Case Reassessment with New Findings."""
    print("\n═══ Feature 2: Case Reassessment ═══")

    # Load STEMI result for context
    stemi_path = FIXTURES_DIR / "case_analysis" / "stemi_anterior.json"
    if not stemi_path.exists():
        print("  ✗ Skipping: run feature 1 first")
        return
    stemi_data = json.loads(stemi_path.read_text())

    payload = {
        "original_case_text": STEMI_CASE,
        "new_findings": [
            {"category": "labs", "text": "Repeat troponin I now 4.2 ng/mL (up from 0.82). ECG shows new Q waves in V2-V4."}
        ],
        "previous_parsed_case": stemi_data.get("parsed_case", {}),
        "previous_search_terms": stemi_data.get("search_terms_used", []),
        "previous_papers": stemi_data.get("papers_reviewed", []),
    }

    with timer() as t:
        async with client.stream(
            "POST", f"{BASE_URL}/api/case/reassess/stream",
            json=payload, timeout=STREAM_TIMEOUT,
        ) as resp:
            result = await parse_sse_stream(resp)

    if result:
        save_json("case_analysis", "stemi_reassessment.json", result)
        print(f"  ✓ Saved reassessment ({t.elapsed:.1f}s)")
    else:
        print("  ✗ No result")


async def feature_3_followup(client: httpx.AsyncClient):
    """Feature 3: Follow-Up Chat."""
    print("\n═══ Feature 3: Follow-Up Chat ═══")

    stemi_path = FIXTURES_DIR / "case_analysis" / "stemi_anterior.json"
    if not stemi_path.exists():
        print("  ✗ Skipping: run feature 1 first")
        return
    stemi_data = json.loads(stemi_path.read_text())

    questions = [
        "Should we consider fibrinolytics if cath lab delay exceeds 120 minutes?",
        "What is the target door-to-balloon time and what are the consequences of delay?",
        "Are there any contraindications to dual antiplatelet therapy in this patient?",
    ]

    followups = []
    history = []
    for q in questions:
        print(f"  Q: {q[:60]}...")
        with timer() as t:
            resp = await client.post(
                f"{BASE_URL}/api/case/followup",
                json={
                    "case_text": STEMI_CASE,
                    "analysis_summary": stemi_data,
                    "question": q,
                    "conversation_history": history,
                    "session_id": "demo-stemi-followup",
                },
                timeout=TIMEOUT,
            )
        data = resp.json()
        followups.append({"question": q, "answer": data.get("answer", ""), "suggestions": data.get("suggested_questions", [])})
        history.append({"role": "user", "content": q})
        history.append({"role": "assistant", "content": data.get("answer", "")})
        print(f"    ✓ {len(data.get('answer', ''))} chars ({t.elapsed:.1f}s)")

    save_json("case_analysis", "stemi_followup.json", {"followups": followups, "history": history})


async def feature_4_ddx(client: httpx.AsyncClient):
    """Feature 4: Differential Diagnosis."""
    print("\n═══ Feature 4: Differential Diagnosis ═══")

    eclampsia_path = FIXTURES_DIR / "case_analysis" / "eclampsia.json"
    if not eclampsia_path.exists():
        print("  ✗ Skipping: run feature 1 first")
        return
    eclampsia_data = json.loads(eclampsia_path.read_text())

    with timer() as t:
        resp = await client.post(
            f"{BASE_URL}/api/case/ddx",
            json={
                "case_text": ECLAMPSIA_CASE,
                "parsed_case": eclampsia_data.get("parsed_case", {}),
            },
            timeout=STREAM_TIMEOUT,
        )
    data = resp.json()
    save_json("case_analysis", "eclampsia_ddx.json", data)
    n = len(data.get("differentials", []))
    print(f"  ✓ Saved DDx ({n} differentials, {t.elapsed:.1f}s)")


async def feature_5_risk_scores(client: httpx.AsyncClient):
    """Feature 5: Clinical Risk Scores."""
    print("\n═══ Feature 5: Clinical Risk Scores ═══")

    sepsis_path = FIXTURES_DIR / "case_analysis" / "sepsis_urosource.json"
    if not sepsis_path.exists():
        print("  ✗ Skipping: run feature 1 first")
        return
    sepsis_data = json.loads(sepsis_path.read_text())

    with timer() as t:
        resp = await client.post(
            f"{BASE_URL}/api/case/risk-scores",
            json={
                "case_text": EVAL_CASES["sepsis_urosource"],
                "parsed_case": sepsis_data.get("parsed_case", {}),
            },
            timeout=TIMEOUT,
        )
    data = resp.json()
    save_json("case_analysis", "sepsis_risk_scores.json", data)
    print(f"  ✓ Saved risk scores ({t.elapsed:.1f}s)")


async def feature_6_medication_safety(client: httpx.AsyncClient):
    """Feature 6: Medication Safety Check."""
    print("\n═══ Feature 6: Medication Safety ═══")

    with timer() as t:
        resp = await client.post(
            f"{BASE_URL}/api/case/medication-safety",
            json={
                "current_medications": [
                    "warfarin 5mg daily",
                    "amiodarone 200mg daily",
                    "lisinopril 20mg daily",
                    "metformin 1000mg BID",
                ],
                "new_medications": ["aspirin 81mg daily", "clopidogrel 75mg daily"],
                "patient_conditions": ["atrial fibrillation", "type 2 diabetes", "CKD stage 3"],
                "allergies": ["penicillin"],
                "labs": ["INR 2.8", "creatinine 1.9", "eGFR 38", "potassium 5.1"],
                "age": "72",
                "sex": "male",
            },
            timeout=STREAM_TIMEOUT,
        )
    data = resp.json()
    save_json("medication", "safety_check.json", data)
    n = len(data.get("interactions", data.get("flags", [])))
    print(f"  ✓ Saved medication safety ({n} findings, {t.elapsed:.1f}s)")


async def feature_7_drug_properties(client: httpx.AsyncClient):
    """Feature 7: TxGemma Drug Properties."""
    print("\n═══ Feature 7: Drug Properties ═══")

    for drug in ["amiodarone", "metformin", "warfarin"]:
        print(f"  Looking up: {drug}")
        with timer() as t:
            resp = await client.post(
                f"{BASE_URL}/api/case/drug-properties",
                json={"drug": drug},
                timeout=TIMEOUT,
            )
        data = resp.json()
        save_json("medication", f"drug_properties_{drug}.json", data)
        print(f"    ✓ Saved ({t.elapsed:.1f}s)")


async def feature_8_drug_interaction(client: httpx.AsyncClient):
    """Feature 8: TxGemma Drug-Drug Interaction."""
    print("\n═══ Feature 8: Drug Interactions ═══")

    pairs = [
        ("warfarin", "amiodarone"),
        ("metformin", "lisinopril"),
    ]
    for drug_a, drug_b in pairs:
        print(f"  Checking: {drug_a} + {drug_b}")
        with timer() as t:
            resp = await client.post(
                f"{BASE_URL}/api/case/drug-interaction",
                json={"drug_a": drug_a, "drug_b": drug_b},
                timeout=TIMEOUT,
            )
        data = resp.json()
        save_json("medication", f"interaction_{drug_a}_{drug_b}.json", data)
        print(f"    ✓ Saved ({t.elapsed:.1f}s)")


async def feature_9_drug_toxicity(client: httpx.AsyncClient):
    """Feature 9: TxGemma Drug Toxicity."""
    print("\n═══ Feature 9: Drug Toxicity ═══")

    for drug in ["amiodarone", "lithium"]:
        print(f"  Checking toxicity: {drug}")
        with timer() as t:
            resp = await client.post(
                f"{BASE_URL}/api/case/drug-toxicity",
                json={"drug": drug},
                timeout=TIMEOUT,
            )
        data = resp.json()
        save_json("medication", f"toxicity_{drug}.json", data)
        print(f"    ✓ Saved ({t.elapsed:.1f}s)")


async def feature_10_cxr(client: httpx.AsyncClient):
    """Feature 10: CXR Foundation Classification."""
    print("\n═══ Feature 10: CXR Foundation ═══")

    images = {
        "cxr_pneumonia": "chest_xray_pneumonia_lobar.jpg",
        "cxr_normal": "chest_xray_normal_pa.png",
        "cxr_effusion": "chest_xray_pleural_effusion.jpg",
    }
    for label, filename in images.items():
        print(f"  Classifying: {filename}")
        try:
            image_b64 = load_image_b64(filename)
        except FileNotFoundError as e:
            print(f"    ✗ {e}")
            continue
        with timer() as t:
            resp = await client.post(
                f"{BASE_URL}/api/case/image/cxr-classify",
                json={"image_b64": image_b64},
                timeout=TIMEOUT,
            )
        data = resp.json()
        save_json("imaging", f"{label}.json", data)
        print(f"    ✓ Saved ({t.elapsed:.1f}s)")


async def feature_11_derm(client: httpx.AsyncClient):
    """Feature 11: Derm Foundation Classification."""
    print("\n═══ Feature 11: Derm Foundation ═══")

    images = {
        "derm_melanoma": "dermoscopy_melanoma_ISIC_0024310.jpg",
        "derm_benign": "dermoscopy_benign_nevus_ISIC_0024306.jpg",
    }
    for label, filename in images.items():
        print(f"  Classifying: {filename}")
        try:
            image_b64 = load_image_b64(filename)
        except FileNotFoundError as e:
            print(f"    ✗ {e}")
            continue
        with timer() as t:
            resp = await client.post(
                f"{BASE_URL}/api/case/image/derm-classify",
                json={"image_b64": image_b64},
                timeout=TIMEOUT,
            )
        data = resp.json()
        save_json("imaging", f"{label}.json", data)
        print(f"    ✓ Saved ({t.elapsed:.1f}s)")


async def feature_12_pathology(client: httpx.AsyncClient):
    """Feature 12: Path Foundation Classification."""
    print("\n═══ Feature 12: Path Foundation ═══")

    print("  Classifying: pathology_breast_carcinoma_HE.jpg")
    try:
        image_b64 = load_image_b64("pathology_breast_carcinoma_HE.jpg")
    except FileNotFoundError as e:
        print(f"    ✗ {e}")
        return
    with timer() as t:
        resp = await client.post(
            f"{BASE_URL}/api/case/image/pathology-classify",
            json={"image_b64": image_b64},
            timeout=TIMEOUT,
        )
    data = resp.json()
    save_json("imaging", "path_breast_carcinoma.json", data)
    print(f"  ✓ Saved ({t.elapsed:.1f}s)")


async def feature_13_vision(client: httpx.AsyncClient):
    """Feature 13: MedGemma Vision Analysis."""
    print("\n═══ Feature 13: Medical Image Analysis (Vision) ═══")

    analyses = [
        {
            "label": "vision_cxr_analysis",
            "filename": "chest_xray_pneumonia_lobar.jpg",
            "context": "67-year-old male with fever, productive cough, and right-sided pleuritic chest pain for 3 days",
            "modality": "xray",
        },
        {
            "label": "vision_derm_analysis",
            "filename": "dermoscopy_melanoma_ISIC_0024310.jpg",
            "context": "52-year-old female, irregular pigmented lesion on left forearm, changing over 6 months",
            "modality": "dermoscopy",
        },
    ]

    for item in analyses:
        print(f"  Analyzing: {item['filename']}")
        img_path = SAMPLE_IMAGES / item["filename"]
        if not img_path.exists():
            print(f"    ✗ File not found: {img_path}")
            continue

        with timer() as t:
            # Use multipart form upload
            with open(img_path, "rb") as f:
                resp = await client.post(
                    f"{BASE_URL}/api/case/image/analyze",
                    files={"image": (item["filename"], f, "image/jpeg")},
                    data={"context": item["context"], "modality": item["modality"]},
                    timeout=TIMEOUT,
                )
        data = resp.json()
        save_json("imaging", f"{item['label']}.json", data)
        print(f"    ✓ Saved ({t.elapsed:.1f}s)")


async def feature_14_interview(client: httpx.AsyncClient):
    """Feature 14: Patient Interview (Full Flow)."""
    print("\n═══ Feature 14: Patient Interview ═══")

    patient_responses = [
        "I've been having chest pain since this morning, it's a pressure feeling in the center of my chest",
        "It started about 3 hours ago. The pain is about 7 out of 10. It gets worse when I walk. I also feel sweaty and nauseous",
        "No, I haven't had any fever, headache, or leg swelling",
        "I have high blood pressure and high cholesterol. My father had a heart attack at 55. I used to smoke but quit 2 years ago",
        "I take lisinopril and atorvastatin",
        "No known allergies",
        "Yes that sounds right",
    ]

    # Start interview
    print("  Starting interview...")
    with timer() as t:
        resp = await client.post(
            f"{BASE_URL}/api/interview/start",
            json={"language": "en"},
            timeout=TIMEOUT,
        )
    start_data = resp.json()
    session_id = start_data.get("session_id", "")
    print(f"    Session: {session_id}, Phase: {start_data.get('phase')}")
    print(f"    Q: {start_data.get('question', '')[:80]}...")

    conversation = [{"role": "assistant", "content": start_data.get("question", "")}]
    turns = [start_data]

    # Send patient responses
    for i, response_text in enumerate(patient_responses):
        print(f"  Turn {i+1}: {response_text[:60]}...")
        with timer() as t:
            resp = await client.post(
                f"{BASE_URL}/api/interview/respond",
                json={
                    "session_id": session_id,
                    "text": response_text,
                    "conversation_history": conversation,
                    "language": "en",
                },
                timeout=TIMEOUT,
            )
        turn_data = resp.json()
        conversation.append({"role": "user", "content": response_text})
        conversation.append({"role": "assistant", "content": turn_data.get("question", "")})
        turns.append(turn_data)
        print(f"    Phase: {turn_data.get('phase')}, Q: {turn_data.get('question', '')[:60]}... ({t.elapsed:.1f}s)")

    # Complete interview
    print("  Completing interview...")
    with timer() as t:
        resp = await client.post(
            f"{BASE_URL}/api/interview/{session_id}/complete",
            json={
                "conversation_history": conversation,
            },
            timeout=STREAM_TIMEOUT,
        )
    if resp.status_code != 200:
        print(f"    ✗ Complete failed: {resp.status_code} {resp.text[:200]}")
        triage = {}
    else:
        triage = resp.json()
        print(f"    ESI Level: {triage.get('esi_level')}, Setting: {triage.get('recommended_setting')}")

    # Get management plan
    print("  Fetching management plan...")
    mgmt_resp = await client.get(
        f"{BASE_URL}/api/interview/management-plan/{session_id}",
        timeout=STREAM_TIMEOUT,
    )
    if mgmt_resp.status_code != 200:
        print(f"    ✗ Mgmt plan failed: {mgmt_resp.status_code}")
        mgmt_data = {}
    else:
        mgmt_data = mgmt_resp.json()

    save_json("interview", "chest_pain_full.json", {
        "session_id": session_id,
        "conversation": conversation,
        "turns": turns,
        "triage": triage,
        "management_plan": mgmt_data,
    })
    print("  ✓ Saved full interview")


async def feature_15_cough(client: httpx.AsyncClient):
    """Feature 15: HeAR Cough/Respiratory Analysis — skip if no audio file."""
    print("\n═══ Feature 15: HeAR Cough Analysis ═══")
    print("  ⊘ Skipping — requires live audio recording (demo interactively via CoughRecorder)")


async def feature_16_ems(client: httpx.AsyncClient):
    """Feature 16: EMS Run Report (Full Flow)."""
    print("\n═══ Feature 16: EMS Run Report ═══")

    # Start
    print("  Starting EMS session...")
    with timer() as t:
        resp = await client.post(
            f"{BASE_URL}/api/ems/start",
            json={"dispatch_info": {"reason": "chest pain", "age": 62, "sex": "male"}},
            timeout=TIMEOUT,
        )
    start_data = resp.json()
    session_id = start_data.get("session_id", "")
    print(f"    Session: {session_id}")

    conversation = [{"role": "assistant", "content": start_data.get("question", start_data.get("message", ""))}]
    turns = [start_data]

    # Dictation turns
    dictation_turns = [
        "Arrived on scene at a single-family home. Scene is safe. Patient found sitting upright in living room, clutching chest, diaphoretic.",
        "Patient is a 62-year-old male, approximately 90 kg. Chief complaint chest pain. History of HTN and hyperlipidemia. Takes lisinopril and atorvastatin. No allergies.",
        "Patient is alert and oriented times 4. Airway patent, breathing labored at 22. Bilateral lung sounds clear. Skin pale, cool, diaphoretic. GCS 15.",
        "Transporting emergent to General Hospital. 12-lead shows ST elevation V2 through V5. STEMI alert activated.",
    ]

    for i, text in enumerate(dictation_turns):
        print(f"  Dictation {i+1}: {text[:60]}...")
        with timer() as t:
            resp = await client.post(
                f"{BASE_URL}/api/ems/dictate",
                json={
                    "session_id": session_id,
                    "text": text,
                    "conversation_history": conversation,
                },
                timeout=TIMEOUT,
            )
        data = resp.json()
        conversation.append({"role": "user", "content": text})
        conversation.append({"role": "assistant", "content": data.get("question", data.get("message", ""))})
        turns.append(data)
        print(f"    Phase: {data.get('phase')} ({t.elapsed:.1f}s)")

    # Vitals
    print("  Recording vitals...")
    vitals_resp = await client.post(
        f"{BASE_URL}/api/ems/vitals",
        json={
            "session_id": session_id,
            "bp_systolic": 158, "bp_diastolic": 92,
            "heart_rate": 104, "respiratory_rate": 22,
            "spo2": 94, "pain_scale": 8,
        },
        timeout=TIMEOUT,
    )
    vitals_data = vitals_resp.json()
    print(f"    ✓ Vitals recorded")

    # Medication
    print("  Recording medication...")
    med_resp = await client.post(
        f"{BASE_URL}/api/ems/medication",
        json={
            "session_id": session_id,
            "medication": "Aspirin",
            "dose": "324mg",
            "route": "PO",
            "response": "Tolerated",
        },
        timeout=TIMEOUT,
    )
    med_data = med_resp.json()
    print(f"    ✓ Medication recorded")

    # Intervention
    print("  Recording intervention...")
    interv_resp = await client.post(
        f"{BASE_URL}/api/ems/intervention",
        json={
            "session_id": session_id,
            "procedure": "12-Lead ECG",
            "details": "ST elevation V2-V5",
            "success": True,
        },
        timeout=TIMEOUT,
    )
    interv_data = interv_resp.json()
    print(f"    ✓ Intervention recorded")

    # Validate
    print("  Validating...")
    val_resp = await client.get(
        f"{BASE_URL}/api/ems/{session_id}/validate",
        timeout=STREAM_TIMEOUT,
    )
    if val_resp.status_code != 200:
        print(f"    ✗ Validate failed: {val_resp.status_code} {val_resp.text[:200]}")
        val_data = {}
    else:
        val_data = val_resp.json()
        print(f"    Validation flags: {len(val_data.get('flags', val_data.get('warnings', [])))}")

    # Complete
    print("  Completing report...")
    with timer() as t:
        comp_resp = await client.post(
            f"{BASE_URL}/api/ems/{session_id}/complete",
            json={"conversation_history": conversation},
            timeout=STREAM_TIMEOUT,
        )
    if comp_resp.status_code != 200:
        print(f"    ✗ Complete failed: {comp_resp.status_code} {comp_resp.text[:200]}")
        comp_data = {}
    else:
        comp_data = comp_resp.json()
        print(f"    ✓ Completed ({t.elapsed:.1f}s)")

    save_json("ems", "stemi_transport.json", {
        "session_id": session_id,
        "start": start_data,
        "turns": turns,
        "vitals": vitals_data,
        "medication": med_data,
        "intervention": interv_data,
        "validation": val_data,
        "completion": comp_data,
        "conversation": conversation,
    })
    print("  ✓ Saved full EMS report")


async def feature_17_charting(client: httpx.AsyncClient):
    """Feature 17: Clinical Charting (SOAP)."""
    print("\n═══ Feature 17: Clinical Charting (SOAP) ═══")

    dictation = (
        "62 year old male presents to the ED with acute onset substernal chest pressure "
        "radiating to left arm for 3 hours. Associated diaphoresis and nausea. History of "
        "HTN and hyperlipidemia. On exam, BP 158/92, HR 104, RR 22, SpO2 94% on RA. "
        "Lungs clear. Heart regular rate, no murmurs. ECG shows ST elevation V2-V5. "
        "Troponin I 0.82. Assessment is anterior STEMI. Plan is emergent PCI, aspirin 325, "
        "heparin bolus, ticagrelor 180 loading dose. Cath lab activated."
    )

    with timer() as t:
        async with client.stream(
            "POST", f"{BASE_URL}/api/chart/enhance",
            json={"dictation_text": dictation},
            timeout=STREAM_TIMEOUT,
        ) as resp:
            result = await parse_sse_stream(resp)

    if result:
        save_json("charting", "stemi_soap.json", result)
        print(f"  ✓ Saved SOAP note ({t.elapsed:.1f}s)")
    else:
        print("  ✗ No result")


async def feature_18_discharge(client: httpx.AsyncClient):
    """Feature 18: Discharge Planning."""
    print("\n═══ Feature 18: Discharge Planning ═══")

    stemi_path = FIXTURES_DIR / "case_analysis" / "stemi_anterior.json"
    if not stemi_path.exists():
        print("  ✗ Skipping: run feature 1 first")
        return
    stemi_data = json.loads(stemi_path.read_text())

    with timer() as t:
        resp = await client.post(
            f"{BASE_URL}/api/case/discharge-plan",
            json={
                "parsed_case": stemi_data.get("parsed_case", {}),
                "treatment_options": stemi_data.get("treatment_options", []),
                "acute_management": stemi_data.get("acute_management", {}),
                "top_recommendation": stemi_data.get("top_recommendation", ""),
            },
            timeout=TIMEOUT,
        )
    data = resp.json()
    save_json("case_analysis", "stemi_discharge.json", data)
    print(f"  ✓ Saved discharge plan ({t.elapsed:.1f}s)")


async def feature_19_referral(client: httpx.AsyncClient):
    """Feature 19: Referral Generation."""
    print("\n═══ Feature 19: Referral Generation ═══")

    stroke_path = FIXTURES_DIR / "case_analysis" / "stroke_mca_m1.json"
    if not stroke_path.exists():
        print("  ✗ Skipping: run feature 1 first")
        return
    stroke_data = json.loads(stroke_path.read_text())

    with timer() as t:
        resp = await client.post(
            f"{BASE_URL}/api/case/referral",
            json={
                "specialty": "neurology",
                "parsed_case": stroke_data.get("parsed_case", {}),
                "treatment_options": stroke_data.get("treatment_options", []),
                "acute_management": stroke_data.get("acute_management", {}),
            },
            timeout=TIMEOUT,
        )
    data = resp.json()
    save_json("case_analysis", "stroke_referral.json", data)
    print(f"  ✓ Saved referral ({t.elapsed:.1f}s)")


async def feature_20_compliance(client: httpx.AsyncClient):
    """Feature 20: Compliance Scan."""
    print("\n═══ Feature 20: Compliance Scan ═══")

    soap_path = FIXTURES_DIR / "charting" / "stemi_soap.json"
    if not soap_path.exists():
        print("  ✗ Skipping: run feature 17 first")
        return
    soap_data = json.loads(soap_path.read_text())

    soap = soap_data.get("soap", soap_data)
    with timer() as t:
        resp = await client.post(
            f"{BASE_URL}/api/compliance/scan",
            json={
                "soap": soap,
                "patient_context": "62-year-old male with anterior STEMI, post-emergent PCI",
            },
            timeout=TIMEOUT,
        )
    data = resp.json()
    save_json("compliance", "scan_result.json", data)
    print(f"  ✓ Saved compliance scan (grade={data.get('grade', '?')}, {t.elapsed:.1f}s)")


async def feature_21_medical_query(client: httpx.AsyncClient):
    """Feature 21: Medical Query (PubMed + Evidence Synthesis)."""
    print("\n═══ Feature 21: Medical Query ═══")

    with timer() as t:
        resp = await client.post(
            f"{BASE_URL}/medical/ask",
            json={"question": "What is the optimal door-to-balloon time for STEMI and how does delay affect mortality?"},
            timeout=TIMEOUT,
        )
    data = resp.json()
    save_json("medical", "stemi_evidence.json", data)
    n_papers = len(data.get("papers", []))
    print(f"  ✓ Saved evidence synthesis ({n_papers} papers, {t.elapsed:.1f}s)")


async def feature_22_interview_spanish(client: httpx.AsyncClient):
    """Feature 22: Multilingual Interview (Spanish)."""
    print("\n═══ Feature 22: Multilingual Interview (Spanish) ═══")

    patient_responses = [
        "Tengo un dolor fuerte en el pecho desde esta mañana, como una presión",
        "Empezó hace unas 3 horas. El dolor es como 7 de 10. Me siento sudoroso y con náuseas",
        "No, no tengo fiebre ni dolor de cabeza",
        "Tengo presión alta y colesterol alto. Mi padre tuvo un infarto a los 55",
        "Tomo lisinopril y atorvastatina",
        "No tengo alergias",
    ]

    # Start
    print("  Starting Spanish interview...")
    resp = await client.post(
        f"{BASE_URL}/api/interview/start",
        json={"language": "es"},
        timeout=TIMEOUT,
    )
    start_data = resp.json()
    session_id = start_data.get("session_id", "")
    conversation = [{"role": "assistant", "content": start_data.get("question", "")}]
    turns = [start_data]

    for i, text in enumerate(patient_responses):
        print(f"  Turno {i+1}: {text[:50]}...")
        with timer() as t:
            resp = await client.post(
                f"{BASE_URL}/api/interview/respond",
                json={
                    "session_id": session_id,
                    "text": text,
                    "conversation_history": conversation,
                    "language": "es",
                },
                timeout=TIMEOUT,
            )
        data = resp.json()
        conversation.append({"role": "user", "content": text})
        conversation.append({"role": "assistant", "content": data.get("question", "")})
        turns.append(data)
        print(f"    Phase: {data.get('phase')} ({t.elapsed:.1f}s)")

    # Complete
    resp = await client.post(
        f"{BASE_URL}/api/interview/{session_id}/complete",
        json={"conversation_history": conversation},
        timeout=STREAM_TIMEOUT,
    )
    triage = resp.json() if resp.status_code == 200 else {}

    save_json("interview", "chest_pain_spanish.json", {
        "session_id": session_id,
        "language": "es",
        "conversation": conversation,
        "turns": turns,
        "triage": triage,
    })
    print(f"  ✓ Saved Spanish interview (ESI {triage.get('esi_level')})")


async def feature_23_interview_mandarin(client: httpx.AsyncClient):
    """Feature 23: Multilingual Interview (Mandarin)."""
    print("\n═══ Feature 23: Multilingual Interview (Mandarin) ═══")

    patient_responses = [
        "我从今天早上开始胸口疼，感觉像有东西压着",
        "大约3个小时前开始的。疼痛大概7分（满分10分）。我感觉出汗，还有点恶心",
        "没有，没有发烧也没有头疼",
        "我有高血压和高胆固醇。我父亲55岁时心脏病发作",
        "我吃赖诺普利和阿托伐他汀",
        "没有过敏",
    ]

    print("  Starting Mandarin interview...")
    resp = await client.post(
        f"{BASE_URL}/api/interview/start",
        json={"language": "zh"},
        timeout=TIMEOUT,
    )
    start_data = resp.json()
    session_id = start_data.get("session_id", "")
    conversation = [{"role": "assistant", "content": start_data.get("question", "")}]
    turns = [start_data]

    for i, text in enumerate(patient_responses):
        print(f"  Turn {i+1}: {text[:30]}...")
        with timer() as t:
            resp = await client.post(
                f"{BASE_URL}/api/interview/respond",
                json={
                    "session_id": session_id,
                    "text": text,
                    "conversation_history": conversation,
                    "language": "zh",
                },
                timeout=TIMEOUT,
            )
        data = resp.json()
        conversation.append({"role": "user", "content": text})
        conversation.append({"role": "assistant", "content": data.get("question", "")})
        turns.append(data)
        print(f"    Phase: {data.get('phase')} ({t.elapsed:.1f}s)")

    # Complete
    resp = await client.post(
        f"{BASE_URL}/api/interview/{session_id}/complete",
        json={"conversation_history": conversation},
        timeout=STREAM_TIMEOUT,
    )
    triage = resp.json() if resp.status_code == 200 else {}

    save_json("interview", "chest_pain_mandarin.json", {
        "session_id": session_id,
        "language": "zh",
        "conversation": conversation,
        "turns": turns,
        "triage": triage,
    })
    print(f"  ✓ Saved Mandarin interview (ESI {triage.get('esi_level')})")


# ─── Orchestrator ─────────────────────────────────────────────────────────────

ALL_FEATURES = {
    1: feature_1_case_analysis,
    2: feature_2_reassessment,
    3: feature_3_followup,
    4: feature_4_ddx,
    5: feature_5_risk_scores,
    6: feature_6_medication_safety,
    7: feature_7_drug_properties,
    8: feature_8_drug_interaction,
    9: feature_9_drug_toxicity,
    10: feature_10_cxr,
    11: feature_11_derm,
    12: feature_12_pathology,
    13: feature_13_vision,
    14: feature_14_interview,
    15: feature_15_cough,
    16: feature_16_ems,
    17: feature_17_charting,
    18: feature_18_discharge,
    19: feature_19_referral,
    20: feature_20_compliance,
    21: feature_21_medical_query,
    22: feature_22_interview_spanish,
    23: feature_23_interview_mandarin,
}


async def check_backend_health(client: httpx.AsyncClient) -> bool:
    """Check if backend is running."""
    try:
        resp = await client.get(f"{BASE_URL}/health", timeout=5)
        return resp.status_code == 200
    except Exception:
        return False


async def main():
    global BASE_URL

    parser = argparse.ArgumentParser(description="Seed demo data from backend")
    parser.add_argument("--feature", "-f", type=int, nargs="*", help="Run specific features (e.g., -f 1 2 3)")
    parser.add_argument("--base-url", default=BASE_URL, help="Backend base URL")
    parser.add_argument("--skip", type=int, nargs="*", default=[], help="Skip specific features")
    args = parser.parse_args()

    BASE_URL = args.base_url

    async with httpx.AsyncClient() as client:
        # Health check
        if not await check_backend_health(client):
            print(f"✗ Backend not reachable at {BASE_URL}")
            print("  Start it with: python -m uvicorn src.api.main:app --port 8001")
            sys.exit(1)
        print(f"✓ Backend healthy at {BASE_URL}")

        features_to_run = args.feature if args.feature else sorted(ALL_FEATURES.keys())
        features_to_run = [f for f in features_to_run if f not in args.skip]

        total_start = time.time()
        errors = []

        for feat_num in features_to_run:
            fn = ALL_FEATURES.get(feat_num)
            if not fn:
                print(f"✗ Unknown feature: {feat_num}")
                continue
            try:
                await fn(client)
            except Exception as e:
                print(f"  ✗ Feature {feat_num} failed: {type(e).__name__}: {e}")
                import traceback
                traceback.print_exc()
                errors.append((feat_num, f"{type(e).__name__}: {e}"))

        total_time = time.time() - total_start
        print(f"\n{'═' * 60}")
        print(f"Done! {len(features_to_run) - len(errors)}/{len(features_to_run)} features succeeded in {total_time:.0f}s")
        if errors:
            print(f"Errors:")
            for num, err in errors:
                print(f"  Feature {num}: {err[:100]}")

        # Summary of saved files
        print(f"\nFixtures saved to: {FIXTURES_DIR}")
        for subdir in sorted(FIXTURES_DIR.iterdir()):
            if subdir.is_dir():
                files = list(subdir.glob("*.json"))
                if files:
                    print(f"  {subdir.name}/: {len(files)} files")


if __name__ == "__main__":
    asyncio.run(main())
