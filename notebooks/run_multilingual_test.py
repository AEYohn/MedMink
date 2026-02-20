"""Run multilingual interview test scenarios as a script.

Usage: .venv/bin/python notebooks/run_multilingual_test.py
"""
import asyncio
import json
import os
import sys
from pathlib import Path

# Setup
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / ".env")

from langdetect import detect, LangDetectException

from src.medgemma.client import get_medgemma_client
from src.medgemma.interview import PatientInterviewer, create_session
from src.medgemma.interview_prompts import SUPPORTED_LANGUAGES, get_system_prompt

# ── Scenarios ──────────────────────────────────────────────

SCENARIOS = [
    {
        "id": "zh_chest_pain", "language": "zh", "language_name": "Mandarin Chinese",
        "demographics": "45M", "chief_complaint_en": "chest pain",
        "responses": [
            "我胸口很痛，从今天早上开始的。",
            "疼痛是压迫感，大概7分。走路的时候会更严重。",
            "没有发烧，但是有点出汗和恶心。",
            "我有高血压和糖尿病。",
            "我吃降压药和二甲双胍。",
            "我对青霉素过敏。",
            "是的，没错。",
        ],
        "ground_truth": {
            "chief_complaint": ["chest pain", "chest", "pain"],
            "medications": ["metformin", "antihypertensive"],
            "allergies": ["penicillin"],
            "red_flags": ["chest pain", "diaphoresis", "nausea"],
            "esi_range": [1, 2],
        },
    },
    {
        "id": "ms_abdominal", "language": "ms", "language_name": "Malay",
        "demographics": "60M", "chief_complaint_en": "abdominal pain",
        "responses": [
            "Perut saya sakit di bahagian kanan bawah.",
            "Mula semalam. Sakit semakin teruk, 8 daripada 10.",
            "Ada demam sikit dan rasa loya.",
            "Saya ada kencing manis dan darah tinggi.",
            "Saya makan ubat gula dan ubat darah tinggi.",
            "Tidak ada alahan ubat.",
            "Ya, betul.",
        ],
        "ground_truth": {
            "chief_complaint": ["abdominal pain", "abdomen", "RLQ"],
            "medications": ["diabetes", "hypertension", "antihypertensive", "metformin", "oral hypoglycemic"],
            "allergies": ["none", "no known", "nkda"],
            "red_flags": ["fever", "RLQ", "appendicitis"],
            "esi_range": [2, 3],
        },
    },
    {
        "id": "ta_headache", "language": "ta", "language_name": "Tamil",
        "demographics": "35F pregnant", "chief_complaint_en": "severe headache",
        "responses": [
            "எனக்கு கடுமையான தலைவலி இருக்கிறது.",
            "இரண்டு நாட்களாக இருக்கிறது. வலி 9/10. ஒளி தொந்தரவாக இருக்கிறது.",
            "நான் 28 வாரம் கர்ப்பமாக இருக்கிறேன். கால்கள் வீங்கியிருக்கின்றன.",
            "முன்பு எந்த நோயும் இல்லை.",
            "கர்ப்ப வைட்டமின்கள் மட்டும்.",
            "சல்ஃபா மருந்துகளுக்கு ஒவ்வாமை.",
            "ஆம், சரி.",
        ],
        "ground_truth": {
            "chief_complaint": ["headache", "head"],
            "medications": ["prenatal", "vitamin"],
            "allergies": ["sulfa"],
            "red_flags": ["headache", "pregnant", "preeclampsia", "edema", "swelling", "photophobia"],
            "esi_range": [1, 2],
        },
    },
    {
        "id": "es_sob_chf", "language": "es", "language_name": "Spanish",
        "demographics": "55F", "chief_complaint_en": "shortness of breath with CHF history",
        "responses": [
            "No puedo respirar bien. Me falta el aire desde ayer.",
            "Empeoró anoche. No puedo dormir acostada, tengo que sentarme. Diría un 7.",
            "Tengo los tobillos hinchados y he subido de peso esta semana.",
            "Tengo insuficiencia cardíaca y presión alta.",
            "Tomo furosemida, lisinopril y metoprolol.",
            "Soy alérgica a la aspirina.",
            "Sí, todo correcto.",
        ],
        "ground_truth": {
            "chief_complaint": ["shortness of breath", "dyspnea", "breathing"],
            "medications": ["furosemide", "lisinopril", "metoprolol"],
            "allergies": ["aspirin"],
            "red_flags": ["dyspnea", "orthopnea", "edema", "CHF", "heart failure"],
            "esi_range": [2, 3],
        },
    },
    {
        "id": "vi_dizziness", "language": "vi", "language_name": "Vietnamese",
        "demographics": "70F", "chief_complaint_en": "dizziness and falls",
        "responses": [
            "Tôi bị chóng mặt và té ngã sáng nay.",
            "Bắt đầu từ hai ngày trước. Khi đứng dậy thì chóng mặt hơn. Khoảng 6 điểm.",
            "Không sốt. Có buồn nôn nhẹ.",
            "Tôi bị tiểu đường và cao huyết áp. Năm ngoái bị gãy xương hông.",
            "Tôi uống metformin, amlodipine, và vitamin D.",
            "Tôi dị ứng với codeine.",
            "Đúng rồi.",
        ],
        "ground_truth": {
            "chief_complaint": ["dizziness", "dizzy", "fall"],
            "medications": ["metformin", "amlodipine", "vitamin D"],
            "allergies": ["codeine"],
            "red_flags": ["fall", "dizziness", "elderly", "syncope", "orthostatic"],
            "esi_range": [2, 3],
        },
    },
    {
        "id": "ar_flank_pain", "language": "ar", "language_name": "Arabic",
        "demographics": "40F", "chief_complaint_en": "flank pain with hematuria",
        "responses": [
            "عندي ألم شديد في الجانب الأيمن ودم في البول.",
            "بدأ من ست ساعات. الألم يأتي ويروح. شدته 9 من 10.",
            "عندي غثيان وتقيأت مرتين. لا حرارة.",
            "عندي حصى كلى سابقة ونقرس.",
            "آخذ الوبيورينول وإيبوبروفين عند الحاجة.",
            "عندي حساسية من الصبغة المستخدمة في الأشعة.",
            "نعم، صحيح.",
        ],
        "ground_truth": {
            "chief_complaint": ["flank pain", "kidney", "renal", "hematuria"],
            "medications": ["allopurinol", "ibuprofen"],
            "allergies": ["contrast", "dye"],
            "red_flags": ["hematuria", "severe pain", "renal colic"],
            "esi_range": [2, 3],
        },
    },
]

# ── Scoring ──────────────────────────────────────────────

def score_language_compliance(conversation, target_lang):
    bot_msgs = [m["content"] for m in conversation if m["role"] == "assistant"]
    if not bot_msgs:
        return 0.0
    correct = 0
    for msg in bot_msgs:
        try:
            detected = detect(msg).split("-")[0]
            if detected == target_lang:
                correct += 1
        except LangDetectException:
            pass
    return correct / len(bot_msgs)

def score_extracted_data_english(extracted_data):
    values = []
    def collect(obj):
        if isinstance(obj, dict):
            for v in obj.values(): collect(v)
        elif isinstance(obj, list):
            for i in obj: collect(i)
        elif isinstance(obj, str) and len(obj) > 3:
            values.append(obj)
    collect(extracted_data)
    if not values:
        return 0.5
    en = sum(1 for v in values if _is_english(v))
    return en / len(values)

def _is_english(text):
    try:
        return detect(text) == "en"
    except LangDetectException:
        return True

def score_chief_complaint(triage, gt):
    cc = (triage.get("chief_complaint", "") or "").lower()
    return 1.0 if any(k.lower() in cc for k in gt["chief_complaint"]) else 0.0

def score_medications(triage, gt):
    found = " ".join(str(m).lower() for m in (triage.get("medications", []) or []))
    gt_meds = gt["medications"]
    if not gt_meds: return 1.0
    return min(sum(1 for m in gt_meds if m.lower() in found) / len(gt_meds), 1.0)

def score_allergies(triage, gt):
    found = " ".join(str(a).lower() for a in (triage.get("allergies", []) or []))
    return 1.0 if any(a.lower() in found for a in gt["allergies"]) else 0.0

def score_red_flags(triage, red_flags, gt):
    all_f = " ".join(str(f).lower() for f in (triage.get("red_flags", []) or []) + red_flags)
    gt_f = gt["red_flags"]
    if not gt_f: return 1.0
    return min(sum(1 for f in gt_f if f.lower() in all_f) / len(gt_f), 1.0)

def score_esi(triage, gt):
    esi = triage.get("esi_level")
    return 1.0 if esi in gt["esi_range"] else 0.0

WEIGHTS = {
    "language_compliance": 0.25, "extracted_data_english": 0.15,
    "chief_complaint": 0.15, "medications": 0.10, "allergies": 0.10,
    "red_flags": 0.10, "esi_level": 0.15,
}

def score_scenario(result):
    gt = result["scenario"]["ground_truth"]
    lang = result["scenario"]["language"]
    s = {
        "language_compliance": score_language_compliance(result["conversation"], lang),
        "extracted_data_english": score_extracted_data_english(result["extracted_data"]),
        "chief_complaint": score_chief_complaint(result["triage"], gt),
        "medications": score_medications(result["triage"], gt),
        "allergies": score_allergies(result["triage"], gt),
        "red_flags": score_red_flags(result["triage"], result["red_flags"], gt),
        "esi_level": score_esi(result["triage"], gt),
    }
    s["composite"] = sum(s[k] * WEIGHTS[k] for k in WEIGHTS)
    s["composite_pct"] = round(s["composite"] * 100, 1)
    return s

# ── Runner ──────────────────────────────────────────────

async def run_scenario(scenario):
    lang = scenario["language"]
    print(f"\n{'='*60}")
    print(f"Running: {scenario['id']} ({scenario['language_name']})")
    print(f"{'='*60}")

    session = create_session(language=lang)
    interviewer = PatientInterviewer()

    start = await interviewer.start_interview(session)
    print(f"  Nurse: {start['question'][:100]}")

    for response in scenario["responses"]:
        if session.phase in ("review_and_triage", "complete"):
            break
        result = await interviewer.process_response(session, response)
        print(f"  Patient: {response[:60]}")
        print(f"  Nurse [{result['phase']}]: {result['question'][:100]}")

    triage = await interviewer.generate_triage(session)
    print(f"  Triage: ESI {triage.get('esi_level', '?')} — {triage.get('chief_complaint', '?')[:60]}")

    return {
        "scenario": scenario,
        "conversation": session.conversation_history,
        "extracted_data": session.extracted_data,
        "red_flags": session.red_flags,
        "triage": triage,
        "session_id": session.session_id,
    }

async def main():
    client = get_medgemma_client()
    print(f"MedGemma Modal URL: {'configured' if client._modal_url else 'NOT SET!'}")
    print(f"Running {len(SCENARIOS)} scenarios...\n")

    all_results = []
    all_scores = []

    for scenario in SCENARIOS:
        try:
            result = await run_scenario(scenario)
            scores = score_scenario(result)
            all_results.append(result)
            all_scores.append({"id": scenario["id"], "language": scenario["language_name"], **scores})
            print(f"  => Score: {scores['composite_pct']}%")
        except Exception as e:
            print(f"  => ERROR: {e}")
            import traceback; traceback.print_exc()
            all_scores.append({"id": scenario["id"], "language": scenario["language_name"], "composite_pct": 0})

    # Report
    print(f"\n{'='*60}")
    print(f"RESULTS")
    print(f"{'='*60}")
    passing = sum(1 for s in all_scores if s.get("composite_pct", 0) >= 60)
    avg = sum(s.get("composite_pct", 0) for s in all_scores) / max(len(all_scores), 1)

    header = f"{'ID':<20} {'Language':<20} {'Lang%':>6} {'Data%':>6} {'CC':>4} {'Meds':>5} {'Alrg':>5} {'Flags':>6} {'ESI':>4} {'TOTAL':>6}"
    print(header)
    print("-" * len(header))
    for s in all_scores:
        print(
            f"{s.get('id','?'):<20} {s.get('language','?'):<20} "
            f"{s.get('language_compliance',0):>5.0%} {s.get('extracted_data_english',0):>5.0%} "
            f"{s.get('chief_complaint',0):>4.0%} {s.get('medications',0):>4.0%} "
            f"{s.get('allergies',0):>5.0%} {s.get('red_flags',0):>5.0%} "
            f"{s.get('esi_level',0):>4.0%} {s.get('composite_pct',0):>5.1f}%"
        )
    print(f"\nPassing (>=60%): {passing}/6 | Average: {avg:.1f}%")
    gate = "PASS — proceed to Phase B" if passing >= 4 else "FAIL — review prompts"
    print(f"Decision gate: {gate}")

    # Save logs
    LOG_DIR = PROJECT_ROOT / "data" / "multilingual_interview_logs"
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    for result, scores in zip(all_results, all_scores):
        sc = result["scenario"]
        log = {
            "scenario_id": sc["id"], "language": sc["language"],
            "language_name": sc["language_name"], "demographics": sc["demographics"],
            "conversation": result["conversation"],
            "extracted_data": result["extracted_data"],
            "triage": result["triage"], "red_flags": result["red_flags"],
            "scores": {k: v for k, v in scores.items() if k not in ("id", "language")},
        }
        fname = f"{sc['language']}_{sc['id'].split('_', 1)[1]}.json"
        with open(LOG_DIR / fname, "w", encoding="utf-8") as f:
            json.dump(log, f, indent=2, ensure_ascii=False)
    print(f"\nLogs saved to {LOG_DIR}")

if __name__ == "__main__":
    asyncio.run(main())
