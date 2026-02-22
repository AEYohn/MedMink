# MedGemma Hackathon Video Script — 3:30 Screen Recording + Voiceover

## Context
Hackathon demo video showcasing the Clinical Decision Support Platform. Format: screen recording of the live app with voiceover narration. Priorities: clinical impact story, evaluation metrics, and multi-model validation. The narrative follows a single patient case (eclampsia) through the entire system to create a cohesive story.

---

## ACT 1: THE HOOK (0:00–0:25)

**Screen:** Dashboard home page — stat cards, quick actions grid

**Voiceover:**
> "A 32-year-old pregnant woman seizes in front of her family. She arrives in the ED — BP 185 over 110, platelets crashing, liver enzymes climbing. The clock is ticking. Can an AI system built on 7 Google Health AI models help the team make the right call — and catch what they might miss?"

**Action:** Click "New Case Analysis" quick action button

---

## ACT 2: THE CASE — LIVE DEMO (0:25–1:45)

### Scene 2A: Input (0:25–0:35)
**Screen:** Case analysis input page

**Action:** Paste the eclampsia case text (from `demo/eclampsia_case.txt`) into the textarea. Show it's a real clinical vignette — BP 185/110, seizure, proteinuria 4+, platelets 88k, schistocytes.

**Voiceover:**
> "We paste in the clinical scenario — an unstructured ED note, exactly how data arrives in real life."

**Action:** Click "Analyze"

### Scene 2B: Streaming Pipeline (0:35–1:00)
**Screen:** 6-step progress pipeline animating in real-time

**Voiceover (as steps animate):**
> "MedGemma parses the vignette, categorizes it as OB/GYN emergency, generates treatment options, then evaluates each one against PubMed evidence — all streaming in real-time. Watch as treatment cards appear one by one with verdicts: magnesium sulfate — recommended. IV labetalol — recommended. Emergent delivery — recommended."

**Action:** Let the pipeline complete naturally. Pause briefly on a treatment card arriving with a green "recommended" badge.

### Scene 2C: Results Walkthrough (1:00–1:45)
**Screen:** Results view — Assessment tab

**Voiceover + Actions:**

1. **(1:00)** Point to **Case Summary Card** — "Instantly structured: 32F, 34 weeks, OB/GYN, eclampsia with HELLP features"

2. **(1:08)** Show **Acute Management** section — "Risk stratification: severe. Immediate actions prioritized. Do-not-do list flags ACE inhibitors and NSAIDs — both contraindicated in pregnancy."

3. **(1:18)** Switch to **Safety tab** — "The safety panel catches a drug interaction and flags it for clinician acknowledgment."

4. **(1:25)** Switch to **Treatment tab** — "Clinicians can accept, reject, or modify any recommendation. Click 'ordered' on magnesium — the status updates in real-time. Drag to reprioritize. Add a clinical note."

5. **(1:35)** Show **DDx tab briefly** — "Differential diagnosis includes eclampsia, HELLP syndrome, and TTP — exactly what the textbooks list."

---

## ACT 3: THE METRICS — WHY THIS IS TRUSTWORTHY (1:45–2:45)

### Scene 3A: The Evaluation Framework (1:45–2:15)
**Screen:** Terminal running `python -m src.evaluation.run_eval` — show the scorecard printing

**Voiceover:**
> "But how do you trust an AI with clinical decisions? We built a 19-check automated evaluation framework. Every analysis is scored against must-recommend treatments, contraindication coverage, dosing plausibility, timing constraints, cross-field consistency, and more."

**Action:** Let the scorecard table render showing all 13 cases

**Voiceover (as table appears):**
> "13 clinical test cases spanning 10 specialties — from DKA to stroke to sickle cell crisis. Each case validated against 15 to 19 checks. 93 unit tests, all deterministic, no LLM calls required."

**Pause on the TOTAL line showing overall pass rate.**

> "The system also cross-validates at the molecular level — Check 18 compares TxGemma's toxicity predictions against clinical recommendations. Check 19 runs every output through a SOAP compliance engine, scoring against CMS billing standards and malpractice risk."

### Scene 3B: Multi-Model Architecture (2:15–2:45)
**Screen:** Show the architecture diagram from the writeup (or a clean slide overlay)

**Voiceover:**
> "This isn't one model — it's seven. MedGemma handles clinical reasoning. CXR Foundation classifies chest X-rays across 13 conditions. Derm Foundation and Path Foundation handle skin and tissue analysis. TxGemma predicts drug toxicity at the molecular level. HeAR analyzes respiratory sounds. MedASR transcribes medical dictation at 4.6% word error rate."

**Action:** Brief flash of the imaging page showing a CXR classification card, then the interview page showing the cough recorder

> "All deployed on Modal GPUs, all feeding back into a single clinical decision. The medication safety pipeline runs three layers in parallel — deterministic drug database, TxGemma, and MedGemma — merging results by severity."

---

## ACT 4: BEYOND THE CASE (2:45–3:15)

### Scene 4A: Interview + Triage (2:45–3:00)
**Screen:** Interview page — show a few messages already in the chat

**Voiceover:**
> "The system also conducts structured clinical interviews — an 8-phase intake that builds a differential diagnosis in real-time as the patient answers questions, then assigns an ESI triage level."

**Action:** Show the management plan panel on the right side updating

### Scene 4B: Charting + Compliance (3:00–3:15)
**Screen:** Charting page — show SOAP editor with compliance score badge

**Voiceover:**
> "Voice dictation converts to structured SOAP notes. A compliance engine scores every note against 10 deterministic rules for claim-denial risk and malpractice liability — catching gaps before they reach the chart."

**Action:** Show the compliance score badge (green, score ≥90) and a brief view of the compliance panel

---

## ACT 5: THE CLOSE (3:15–3:30)

**Screen:** Return to the eclampsia case results — treatment plan with "ordered" badges, safety alerts acknowledged

**Voiceover:**
> "One patient. Seven models. Nineteen automated checks. Every recommendation evidence-graded, every dose validated, every contraindication flagged. Not replacing the clinician — amplifying them."

**Screen:** Dashboard with the tagline or project name visible

> "Built on MedGemma and 6 Google Health AI foundation models. Clinical intelligence, validated."

---

## KEY NUMBERS TO DISPLAY ON SCREEN (text overlays at key moments)

| Moment | Overlay Text |
|--------|-------------|
| Act 2B (pipeline) | `7 AI models working in parallel` |
| Act 3A (scorecard) | `19 checks · 13 cases · 93 unit tests` |
| Act 3A (compliance) | `16 medical specialties` |
| Act 3B (architecture) | `3-layer medication safety pipeline` |
| Act 5 (close) | `MedGemma + CXR + Derm + Path + TxGemma + HeAR + MedASR` |

---

## PRODUCTION NOTES

- **Pacing:** 3:30 total. Trim silence. Let the streaming pipeline play at 1x speed (it's visually compelling).
- **Audio:** Record voiceover separately for clean audio. Add subtle background music (low, instrumental).
- **Text overlays:** Use large, readable font. White text on semi-transparent dark background. Show for 3-4 seconds each.
- **Transitions:** Simple cuts between screens. No fancy transitions — let the product speak.
- **Fallback:** If the live eval run takes too long, pre-record the terminal output and play it back.
