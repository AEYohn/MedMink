# Clinical Decision Support Platform

**Multi-model clinical intelligence powered by MedGemma + 6 Google Health AI foundation models**

---

A comprehensive clinical decision support system that transforms unstructured patient data into structured, evidence-backed treatment plans. Built on MedGemma for clinical reasoning, augmented by six specialized Google Health AI foundation models (CXR Foundation, Derm Foundation, Path Foundation, TxGemma, HeAR, MedASR), and validated by a 19-check automated evaluation framework across 13 clinical test cases spanning 16 medical specialties, with 93 deterministic unit tests.

---

## Current Features

### A. Clinical Case Analysis Engine

Natural language clinical vignettes are parsed into structured analyses via SSE streaming. The system auto-categorizes cases into one of **16 medical specialties** — musculoskeletal, infectious disease, cardiology, neurology, pulmonology, gastroenterology, endocrinology, nephrology, psychiatry, dermatology, hematology/oncology, obstetrics/gynecology, ophthalmology, urology, rheumatology, and ENT — each with dynamic context injection of specialty-specific treatment classes, workup protocols, acute interventions, monitoring parameters, and consult/disposition guidelines.

**Treatment generation** produces 5–8 ranked options with verdicts (`recommended`, `consider`, `not_recommended`), each with dosing, rationale, and contraindications. **Acute management** includes risk stratification, immediate actions, do-not-do lists, monitoring plans, disposition recommendations, specialty consults, and metabolic corrections.

**Evidence synthesis** integrates PubMed search with a deterministic human-clinical-study filter (excludes animal studies, in-vitro, letters, and editorials) and GRADE-methodology evaluation. Evidence snippets are extracted directly from abstracts to prevent hallucinated quotes.

Additional capabilities:
- **Reassessment** — new findings merge into existing case data and trigger re-analysis
- **Follow-up Q&A** — compressed-context chat for ongoing clinical questions
- **8 example cases** spanning cardiology, neurology, psychiatry, pulmonology, gastroenterology, nephrology, hematology, and rheumatology

### B. AI Nurse Interview (AMIE Dual-Agent)

A structured 8-phase clinical interview: **greeting → chief complaint → HPI → review of systems → PMH/PSH/FH/SH → medications → allergies → review & triage**. Each phase uses focused MedGemma prompts to gather the right clinical information at the right time.

A **parallel management reasoning agent** runs alongside the interview, building an incremental differential diagnosis and management plan after each patient response. This produces a running DDx list and preliminary care plan that evolves with each new piece of information.

At completion, the system calculates an **ESI triage level** (1–5) with care setting recommendation:
- ESI 1: Immediate life-threatening — requires immediate intervention
- ESI 2: Emergent — high risk, altered mental status, severe pain
- ESI 3: Urgent — stable vitals, needs 2+ resources
- ESI 4: Less urgent — needs 1 resource
- ESI 5: Non-urgent — simple evaluation, 0 resources

Additional features:
- **Audio input** via MedASR (4.6% WER on medical dictation)
- **Respiratory symptom detection** triggers HeAR cough analysis prompt
- **EHR pre-population** — medications, allergies, conditions loaded from patient chart
- **Longitudinal visit linking** via `patient_id` for continuity of care

### C. Google Health AI Foundation Model Integrations

Seven specialized models, each deployed on Modal GPUs with singleton client patterns:

| Model | Capability | Details |
|-------|-----------|---------|
| **MedGemma 4B/27B** | Text reasoning, multimodal image analysis, evidence synthesis | Core reasoning engine; JSON-only output strategy |
| **CXR Foundation** | Zero-shot chest X-ray classification | 13+ conditions including pneumothorax, cardiomegaly, pleural effusion |
| **Derm Foundation** | Skin lesion classification | ABCDE criteria assessment, urgency scoring |
| **Path Foundation** | Digital pathology tissue classification | Tumor grading, tissue type identification |
| **TxGemma** | Drug interactions, toxicity, pharmacological properties | Severity scoring, mechanism explanation |
| **HeAR** | Respiratory sound analysis | TB, COVID, COPD, asthma detection from cough audio |
| **MedASR** | Medical speech recognition | Conformer 105M, abbreviation correction, 4.6% WER |

### D. Medication Safety Pipeline

A 3-layer hybrid architecture runs **deterministic database lookup**, **TxGemma**, and **MedGemma** in parallel (`asyncio.gather`), merging results by severity:

1. **Deterministic layer** — known drug-drug interactions from curated database, renal dosing adjustments for 8 common medications (eGFR-based)
2. **TxGemma layer** — AI-powered interaction severity scoring, mechanism analysis, clinical recommendations
3. **MedGemma layer** — contextual reasoning about the specific patient's medication profile

Additional checks:
- Duplicate therapy detection
- Home-medication contamination detection with allowlist (for cases where stopping the med IS the treatment, e.g., lithium toxicity)
- Black box warning surfacing

### E. Clinical Risk Scores

A **hybrid deterministic + MedGemma approach** ensures zero hallucination on mathematical formulas. MedGemma extracts clinical variables from the case; deterministic functions compute the scores.

Supported scores: QSOFA, APACHE II, CURB-65, CHA₂DS₂-VASc, NEWS2, SOFA, Wells PE, Wells DVT, MELD, Glasgow-Blatchford, HEART, and more.

Each score shows:
- Variable breakdown with source attribution (AI-extracted vs. clinician-input)
- Score interpretation and risk category
- Clinical decision thresholds

### F. Collaborative Clinician Interface

A **two-column priority layout** (60/40 split) places acute management and treatment decisions on the left, with decision support tools on the right:

**Left column (action):**
- **TreatmentPlanEditor** — accept/reject/modify verdicts, status cycling (pending → ordered → administered → held), inline dose editing, clinical notes, HTML5 drag-and-drop reorder
- **AcuteManagementEditor** — interactive checklist with checkboxes, inline text editing, custom action addition, completion counter
- **DischargeEditor** — medication reconciliation table (add/remove/edit rows), editable patient instructions, readmission risk
- Referral notes, medical imaging, media attachments

**Right column (decision support):**
- **SafetyAlertsPanel** — acknowledgeable alerts with notes, unacknowledged-first sorting, collapsed acknowledged section
- **RiskScoresTab** — clinician variable input fields, "Clinician" source badge
- Differential diagnosis, clinical pearls, follow-up chat

All clinician overrides are stored as a **separate data layer** on top of AI output, preserving the original analysis while tracking clinical decisions.

### G. Referral & Handoff System

- Specialty-specific **referral note generation** with urgency flags and clinical questions
- **I-PASS and SBAR** handoff format generation
- **Shareable token-based links** (time-expiring) for external specialists
- **Specialist inbox** with status tracking: sent → viewed → responded → completed
- **Real-time notification polling** (30-second intervals)

### H. Charting & Documentation

- **Voice dictation → SOAP note** structuring via SSE streaming (MedASR + MedGemma)
- **Lab report extraction** from PDF/images with multi-page support
- **Case report PDF export** with full analysis, treatment plan, and evidence
- **Patient visit summary** with doctor review and release flow
- **Patient-facing portal** — diagnosis, medications, follow-ups, and red flags written at a 6th-grade reading level

### I. Patient & Encounter Management

- Full CRUD patient records (demographics, medications, allergies, conditions)
- Encounter system supporting `case_analysis`, `interview`, and `charting` types
- Event timeline within encounters
- Longitudinal visit tracking with vital trends and medication changes
- Session persistence (localStorage + debounced API sync, max 20 sessions)

### J. Medical Image Analysis

Automatic **modality detection** routes images to the appropriate foundation model:

| Modality | Model | Analysis |
|----------|-------|----------|
| X-ray | CXR Foundation | 13+ condition classification |
| Dermoscopy | Derm Foundation | Lesion classification, ABCDE criteria |
| Pathology | Path Foundation | Tissue classification, tumor grading |
| CT, MRI, Ultrasound, Fundus, OCT | MedGemma | Modality-specific prompted analysis |

A **consumer photo safety layer** prevents hallucinating pathology on non-medical images.

---

## Architecture & Technical Highlights

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js Frontend (shadcn/ui)                               │
│  Two-column layout · SSE streaming · Clinician overrides    │
├─────────────────────────────────────────────────────────────┤
│  FastAPI Backend (port 8001)                                │
│  SSE endpoints · Singleton clients · JSON repair pipeline   │
├────────────┬──────────────┬─────────────────────────────────┤
│  MedGemma  │  Foundation  │  Deterministic                  │
│  4B / 27B  │  Models (6)  │  Checks                        │
│            │  CXR · Derm  │  Risk scores · Drug DB          │
│  Reasoning │  Path · Tx   │  PubMed filter · Scorer         │
│  Evidence  │  HeAR · ASR  │  Renal dosing · Interactions    │
├────────────┴──────────────┴─────────────────────────────────┤
│  Modal GPU Deployments (7 models)                           │
│  Singleton pattern · Auto-scaling · GPU isolation           │
└─────────────────────────────────────────────────────────────┘
```

**Key technical decisions:**
- **JSON-only output** — MedGemma wastes token budget on reasoning unless explicitly instructed to output only JSON; `<unused94>thought` tokens are handled by a robust JSON repair pipeline
- **Hybrid AI** — deterministic checks where precision matters (risk scores, drug databases), foundation models for domain-specific analysis (imaging, audio), MedGemma for clinical reasoning
- **SSE streaming** — long-running analyses stream incremental results to the frontend
- **Parallel execution** — medication safety runs all 3 layers concurrently via `asyncio.gather`
- **Context compression** — follow-up chat and reassessment compress prior analysis to fit model context windows
- **max_tokens 5000** — prevents truncation of acute_management JSON in treatment generation

---

## Evaluation Framework & Metrics

### The 19-Check Scorer

Every generated analysis is validated against 19 automated checks:

| # | Check | Description |
|---|-------|-------------|
| 1 | **Correct category** | Case categorized into the right medical specialty |
| 2 | **Risk stratification** | Appropriate risk level identified in acute management |
| 3 | **Disposition** | Correct care setting recommendation (ICU, floor, discharge) |
| 4 | **Must recommend** | Required treatments present (supports OR-groups, e.g., `["alteplase", "tPA", "tenecteplase"]`) |
| 5 | **Not falsely harmful** | Expected treatments not incorrectly flagged as harmful |
| 6 | **Etiology addressed** | Root cause identified and addressed in treatment plan |
| 7 | **Lab corrections** | Appropriate metabolic/lab correction interventions included |
| 8 | **Consults** | Expected specialty consults recommended |
| 9 | **Do-not-do coverage** | Appropriate contraindicated actions listed |
| 10 | **No self-contradictions** | Treatments not simultaneously recommended and contraindicated |
| 11 | **Evidence quality** | ≥30% of cited papers have keyword matches (not just semantic) |
| 12 | **No home-med contamination** | Home medications not listed as new treatments (with allowlist for stopping-as-treatment) |
| 13 | **Acute management present** | Both risk_stratification and immediate_actions fields populated |
| 14 | **Timing constraints** | Time-sensitive keywords present in treatment rationales (e.g., "4.5h", "90min", "before") |
| 15 | **Cross-field consistency** | Risk level and disposition coherent (high risk ≠ discharge, low risk ≠ ICU) |
| 16 | **DDx includes primary** | Differential diagnosis contains expected primary diagnosis |
| 17 | **Dosing plausibility** | Medication doses within plausible ranges (2x tolerance bands) |
| 18 | **TxGemma safety alignment** | Molecular-level toxicity predictions consistent with clinical verdicts |
| 19 | **Compliance grade** | SOAP conversion scores ≥80 (B grade) via 10-rule compliance engine |

### 13 Clinical Test Cases

| Case | Specialty | Key Checks |
|------|-----------|------------|
| **HTG-induced Pancreatitis** | Gastroenterology | Insulin/heparin infusion, triglyceride-specific treatment |
| **Inferior STEMI** | Cardiology | PCI timing (<90min), dual antiplatelet, right-sided ECG |
| **Submassive PE** | Pulmonology | Anticoagulation, thrombolysis criteria, RV strain monitoring |
| **Mono with Splenomegaly** | Infectious Disease | Activity restriction, spleen rupture precautions |
| **Osteoarthritis in CKD** | Musculoskeletal/Nephrology | NSAID avoidance, renal-safe alternatives |
| **Lithium Toxicity** | Psychiatry | Lithium cessation (home-med allowlist), hydration, dialysis criteria |
| **MCA M1 Stroke** | Neurology | tPA/tenecteplase OR-group, thrombectomy, 4.5h window |
| **New-Onset DKA** | Endocrinology | Insulin drip, IV fluids, potassium replacement, gap closure |
| **Urosepsis** | Infectious Disease / Critical Care | Antibiotics within 1h, fluid resuscitation, blood cultures |
| **SAH with AComA Aneurysm** | Neurosurgery | Nimodipine, aneurysm securing (clip/coil), neuro-ICU |
| **AFib with RVR** | Cardiology | Rate control, anticoagulation, CHA₂DS₂-VASc scoring |
| **Eclampsia** | OB/GYN | Magnesium sulfate, antihypertensives, emergent delivery |
| **Sickle Cell Acute Chest** | Hematology | Exchange transfusion, antibiotics, oxygen, fluid balance |

### Testing Infrastructure

- **93 unit tests** for scorer functions (`tests/unit/test_scorer.py`)
- Pure function extraction for all 19 scorer checks — deterministic, no model dependency
- Test cases use `home_med_exceptions`, `timing_keywords_in_rationale`, and `expected_primary_ddx` fields for case-specific validation
- Run with `pytest -p no:recording` to avoid VCR/urllib3 conflicts

---

## SOAP Compliance Engine

A hybrid deterministic + AI validation engine scores every clinical note against **10 deterministic rules** for claim-denial risk and malpractice liability:

| Rule | Domain | Severity | Description |
|------|--------|----------|-------------|
| MISSING_MED_NECESSITY | Claim denial | Error | Clinical impression too brief for medical necessity |
| ICD10_UNSPECIFIED | Claim denial | Warning | Unspecified diagnosis when laterality/type available |
| MED_INCOMPLETE | Claim denial | Error | Medication missing drug, dose, or frequency |
| NO_ALLERGIES_DOC | Claim denial | Error | No allergy documentation (auto-fixable: "NKDA") |
| VITALS_INCOMPLETE | Claim denial | Warning | Fewer than 3 of 5 vital signs documented |
| NO_DIFF_DX | Malpractice | Error | Primary diagnosis without differential |
| NO_PERTINENT_NEG | Malpractice | Warning | High-acuity CC without negative findings in ROS |
| ASSESSMENT_PLAN_GAP | Malpractice | Error | Diagnosis keywords not addressed in plan |
| NO_FOLLOWUP | Malpractice | Warning | Empty follow-up instructions |
| NO_RED_FLAGS | Malpractice | Error | High-acuity diagnosis without return precautions |

**Scoring**: Starts at 100, deductions by severity/domain (error/claim: -15, error/malpractice: -12, warning/claim: -7, warning/malpractice: -5, info: -2). Grades: A (≥90), B (≥80), C (≥70), D (≥60), F (<60).

**Two-tier scanning**: Instant client-side rules (TypeScript mirror) + debounced AI validation via MedGemma for clinical reasoning gaps, copy-forward detection, and time-critical documentation.

**Evaluation integration**: Check 19 converts case analysis output to SOAP via `compliance_bridge.py`, runs compliance scan, and passes if grade ≥ B.

---

## EMS Run Report Assistant

AI-powered ePCR (electronic patient care report) documentation for EMS providers:

- **Conversational interface** — structured phases gather dispatch info, scene assessment, patient assessment, interventions, transport, and handoff
- **Quick entry panels** — vitals grid, medication entry, intervention logging (tabs for fast data capture)
- **Voice dictation** support via MedASR
- **Validation engine** — flags incomplete fields, protocol deviations, and documentation gaps
- **ePCR narrative generation** — auto-generates narrative from structured data on completion
- **Run timer** — elapsed time tracking from session start

---

## Future Directions

- **Guideline-grounded evaluation** — compare against AHA, IDSA, ACEP clinical practice guideline algorithms
- **Pharmacogenomics** — CYP450, HLA typing for personalized drug safety
- **Closed-loop monitoring** — auto-generate lab monitoring orders tied to prescribed treatments
- **Fine-tuning pipeline** — use 19-check scorer as reward signal for MedGemma LoRA tuning
- **Real-time drug databases** — RxNorm, OpenFDA, DailyMed integration
