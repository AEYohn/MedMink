# MedMink — MedGemma Impact Challenge Submission

## Executive Summary

MedMink is a full-stack clinical decision support platform that orchestrates 7 Google Health AI (HAI-DEF) foundation models into a unified emergency medicine workflow. A ReAct-style autonomous agent analyzes clinical cases by selectively invoking CXR Foundation, Derm Foundation, Path Foundation, TxGemma, HeAR, MedASR, and MedGemma based on clinical context — then synthesizes their findings through a cross-modal consensus mechanism. The platform bridges the gap between AI model capabilities and clinical workflow realities: clinicians can override any AI recommendation, acknowledge safety alerts, and edit treatment plans while the system tracks attribution for every model that contributed. A 23-language patient portal ensures equitable access. The result is not a model demo but a working clinical tool where 7 specialized models collaborate under clinician supervision.

---

## HAI-DEF Model Utilization (20%)

MedMink uses all 7 HAI-DEF models in production-integrated roles, not as isolated demos. Each model is deployed on Modal GPU infrastructure and accessed through typed Python clients.

| Model | Integration | Depth |
|-------|-------------|-------|
| **MedGemma 27B** | Core reasoning engine for case analysis, differential diagnosis, treatment evaluation, risk score variable inference, interview dialogue, management planning, consensus synthesis, SOAP note generation | Primary model — involved in every analysis. 16-specialty prompt system with category-specific treatment classes, workup protocols, and acute interventions. JSON-only output directive with 5000 max_tokens. |
| **CXR Foundation** | Chest X-ray zero-shot classification via agent tool `analyze_chest_xray` | Classifies 13+ conditions (pneumothorax, pleural effusion, cardiomegaly, consolidation, atelectasis, pneumonia, etc.). Probability bars rendered in `FoundationModelFindings`. Embeddings stored for similar case retrieval. |
| **Derm Foundation** | Skin lesion analysis via agent tool `analyze_skin_lesion` | Melanoma vs. benign triage with malignancy probability and urgency classification. 6,144-dim embeddings for similarity search. |
| **Path Foundation** | Tissue classification via agent tool `analyze_pathology` | Tile-based processing for large pathology images. Tumor grading with tissue type probabilities. Embeddings for similar case retrieval. |
| **TxGemma 9B** | Drug interaction prediction + toxicity profiling as middle layer of 3-layer medication safety pipeline | `predict_interaction(drug_a, drug_b)` returns severity/mechanism/recommendation. `predict_toxicity(drug)` returns organ-specific risk profiles. Runs in parallel with deterministic and MedGemma layers via `asyncio.gather()`. |
| **HeAR** | Respiratory audio screening via agent tool `screen_respiratory` | Detects TB, COVID-19, COPD, asthma from cough/breathing recordings. Integrated into interview: respiratory keyword detection triggers cough recording prompt. CoughRecorder component for audio capture. |
| **MedASR** | Medical speech recognition for clinical dictation and interview audio transcription | Transcribes voice input in interview (with Gemini + Whisper fallback chain). Powers dictation-to-SOAP charting workflow. |

### Integration architecture

Models are not called in isolation. The clinical reasoning agent uses MedGemma to decide which specialist models to invoke based on case content, creating a dynamic model orchestration graph:

```
Clinical Vignette → MedGemma (reasoning) → Tool Selection
                                             ├→ CXR Foundation (if imaging mentioned)
                                             ├→ Derm Foundation (if skin findings)
                                             ├→ Path Foundation (if tissue/biopsy)
                                             ├→ TxGemma (if medications present)
                                             ├→ HeAR (if respiratory symptoms)
                                             └→ Risk Scores (if acute presentation)
                                          → Consensus Synthesis → Integrated Assessment
```

The 3-layer medication safety pipeline demonstrates deep model integration: deterministic lookup (<10ms) → TxGemma prediction (~1s) → MedGemma clinical reasoning (~3s), all running in parallel with results merged and deduplicated.

---

## Problem Domain (15%)

### The problem: Diagnostic error in emergency medicine

Emergency physicians make high-stakes decisions under time pressure with incomplete information. Studies show:
- Diagnostic errors affect 5.08% of US adults annually (12 million people)
- Emergency departments account for a disproportionate share of diagnostic errors
- Medication errors affect 7 million patients annually in the US alone
- Non-English-speaking patients face 2-3x higher rates of adverse events

### Why this matters

MedMink addresses four interconnected gaps:

1. **Cognitive support gap:** Emergency clinicians must synthesize imaging, labs, medications, and clinical history simultaneously. MedMink's 7-model agent does this automatically, surfacing findings that might be missed under cognitive load.

2. **Medication safety gap:** Drug interactions are checked against static databases that miss novel combinations. MedMink's 3-layer pipeline (deterministic + TxGemma + MedGemma) catches interactions that single-layer approaches miss.

3. **Language access gap:** 25 million US residents have limited English proficiency. MedMink's 23-language patient portal with RTL support ensures these patients can provide accurate intake information.

4. **Quality assurance gap:** There is no standardized way to evaluate AI clinical output quality. MedMink's 14-point quality scorecard provides a real-time validity check on every analysis.

### Evidence-based approach

- Treatment recommendations are evaluated against PubMed literature with a human-study filter that excludes animal studies, editorials, and retracted publications
- Risk scores use validated clinical instruments (HEART, Wells, CURB-65, qSOFA, CHA₂DS₂-VASc)
- Differential diagnoses include supporting and refuting findings with diagnostic pathways
- Every recommendation is traceable to the model(s) that produced it via the Model Attribution Strip

---

## Impact Potential (15%)

### Quantifiable impact vectors

**Medication error prevention:**
- The 3-layer safety pipeline checks every prescribed medication against patient-specific factors (renal function, existing medications, allergies, disease states)
- Catches interactions missed by single-layer approaches by combining deterministic rules (100+ known major pairs), TxGemma AI prediction, and MedGemma clinical reasoning
- Drug-disease conflicts, dosing concerns, and allergy cross-reactivity checked in parallel

**Diagnostic accuracy improvement:**
- Cross-modal consensus synthesizes findings from imaging (CXR/Derm/Path), pharmacological (TxGemma), and clinical (MedGemma) perspectives
- 14-point quality scorecard catches self-contradictions, missing safety information, and logical inconsistencies before they reach patients
- Differential diagnosis with "must rule out" flags ensures dangerous diagnoses are not missed

**Language access and equity:**
- 23-language patient interface with 4 RTL languages (Arabic, Hebrew, Urdu, Farsi)
- Multilingual intake interview ensures patients can describe symptoms in their preferred language
- All date formatting respects locale conventions via BCP-47 tags

**Clinician workflow efficiency:**
- Streaming SSE analysis provides results as they are generated (not batch)
- Split-view interview shows management plan building in real-time alongside patient conversation
- One-click interview → case handoff eliminates manual data re-entry
- Clinician override layer allows accept/reject/modify workflow without re-running analysis
- Session persistence (max 20) enables returning to previous cases

### Scalability

- Modal GPU deployment enables on-demand scaling without infrastructure management
- Foundation model endpoints are stateless — horizontal scaling is straightforward
- Client-side quality scorecard and clinician overrides require no additional server resources
- Patient UI is lightweight and works on mobile devices

---

## Product Feasibility (20%)

### Production architecture

```
Patient (Mobile/Desktop)                  Clinician (Desktop)
    │                                         │
    ├── Next.js Patient App ──────┐           ├── Next.js Clinician App ──┐
    │   (23 languages, RTL)       │           │   (shadcn/ui, Tailwind)   │
    │   5 pages + bottom nav      │           │   20+ pages, 37 components│
    └─────────────────────────────┤           └──────────────────────────┤
                                  │                                      │
                                  ▼                                      ▼
                            FastAPI Backend (async, 26 route files)
                            ├── SSE streaming for long-running analysis
                            ├── Session management (interview, case)
                            └── asyncio.gather() for parallel model calls
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
              Modal GPU     PubMed API    localStorage
              (9 deployments)              (client-side persistence)
              ├── MedGemma 27B (A100)
              ├── MedGemma Multimodal (A100)
              ├── TxGemma 9B (A10G)
              ├── CXR Foundation (T4)
              ├── Derm Foundation (T4)
              ├── Path Foundation (T4)
              ├── HeAR (T4)
              ├── MedASR (T4)
              └── Backend Router
```

### Why this is production-ready

1. **Typed end-to-end:** TypeScript interfaces (`case.ts`) mirror Python dataclasses; 229 lines of shared type definitions ensure frontend-backend contract alignment
2. **Graceful degradation:** If a foundation model is unavailable, the agent skips it and proceeds with remaining models. MedASR falls back to Whisper. Consensus works without vision if no images present
3. **Clinician-in-the-loop:** AI never acts autonomously. Every recommendation passes through the clinician override layer before reaching patients. Safety alerts must be explicitly acknowledged
4. **Validation at every layer:** 14-point quality scorecard (client-side), PubMed human-study filter (server-side), cross-field consistency checks (risk level vs. disposition), and 61 unit tests for the evaluation scorer
5. **Session persistence:** localStorage-backed case sessions with auto-save, max 20 entries, supporting undo via immutable AI data + mutable overlay

### Offline capabilities

- Patient UI: form validation, language selection, and health record viewing work without network
- Clinician overrides: all edits are localStorage-persisted and survive page reloads
- Locale files: lazy-loaded once, then cached; English bundled as default fallback

---

## Execution Quality (30%)

### Codebase metrics

| Metric | Count |
|--------|-------|
| HAI-DEF Models Integrated | 7 of 7 |
| Modal GPU Deployments | 9 |
| Frontend Components (case) | 37 |
| API Route Files | 26 |
| Backend Modules (medgemma/) | 32 |
| Languages Supported | 23 (incl. 4 RTL) |
| Quality Checks | 14 |
| Medical Specialties | 16 |
| Test Files | 13 |
| Shared Type Definitions | 229 lines |
| Patient App Pages | 5 |
| Clinician App Pages | 20+ |

### Code quality indicators

- **Type safety:** Shared TypeScript interfaces (`case.ts`) with 12 exported types; Python dataclasses with typed fields
- **Separation of concerns:** AI data layer never modified by clinician edits (overlay pattern); foundation model clients are independent singletons
- **Testing:** 13 test files including 61 unit tests for the evaluation scorer; scorer checks extracted as pure functions for testability
- **Streaming architecture:** SSE throughout — case analysis, agent reasoning, consensus, interview, reassessment all stream results in real-time
- **Error handling:** Graceful degradation for unavailable models; AbortController for cancellable SSE streams; fallback chains for transcription (Gemini → Whisper → MedASR)

### Full-stack implementation depth

This is not a notebook or API wrapper. It is a complete clinical workflow tool:

- **Interview → Analysis → Treatment → Discharge:** End-to-end patient flow from AI-guided intake through case analysis, treatment planning with clinician overrides, to discharge planning with medication reconciliation
- **Dual persona:** Separate clinician (English, desktop) and patient (23 languages, mobile-first) interfaces sharing the same backend
- **Persistent state:** Case sessions, interview sessions, clinician overrides, visit history, and embedding stores all persist across page reloads
- **Real-time collaboration cues:** Model Attribution Strip shows which models contributed at a glance; agent reasoning trace provides full transparency into AI decision-making

---

## Agentic Workflow Bonus

### Architecture

A ReAct-style autonomous clinical reasoning agent (`src/agents/clinical_reasoning_agent.py`) powered by MedGemma 27B that:

1. **Receives** a clinical case with optional imaging and audio
2. **Reasons** about which foundation model tools are needed based on clinical content
3. **Invokes** tools autonomously — each tool call dispatched to a Modal-hosted model
4. **Observes** results and decides whether additional tools are needed
5. **Synthesizes** all findings into a final assessment with confidence score
6. **Builds consensus** across all contributing models with agreement/disagreement resolution

### 7 available tools

The agent has access to 7 specialized tools, each backed by a HAI-DEF foundation model:

- `analyze_chest_xray` → CXR Foundation (13+ conditions)
- `analyze_skin_lesion` → Derm Foundation (melanoma triage)
- `analyze_pathology` → Path Foundation (tissue classification)
- `screen_respiratory` → HeAR (cough/breathing screening)
- `check_drug_interactions` → TxGemma (interaction severity)
- `predict_drug_toxicity` → TxGemma (organ-specific risk)
- `compute_risk_scores` → MedGemma + deterministic (clinical scores)

### Real-time transparency

Every agent step is streamed via SSE and rendered in the `AgentReasoningTrace` component:
- **Thinking steps** — agent's natural language reasoning about what to do next
- **Tool invocations** — which model is being called, with parameters and model badge
- **Tool results** — expandable JSON results from each foundation model
- **Final assessment** — primary diagnosis, confidence, key findings, recommended actions
- **Consensus** — agreement/disagreement analysis across all contributing models

### Dual-agent interview

A second agentic pattern: the interview system runs two agents concurrently:
- **Dialogue Agent** conducts structured patient intake with phase progression
- **Management Reasoning Agent** (AMIE-style) builds an incremental differential diagnosis and treatment plan as clinical data arrives

### Why this qualifies

This is genuine agentic behavior — the agent decides what tools to use based on clinical context. It does not follow a fixed script. A case mentioning chest pain triggers CXR and risk scores; a case with skin findings triggers Derm; a case with medications triggers TxGemma. The tool selection is driven by MedGemma's clinical reasoning, not hardcoded rules.

---

## Edge AI Bonus

### Patient-facing lightweight design

The patient UI (`/patient/*`) is designed for mobile devices with limited connectivity:

1. **5-page mobile-first layout** with bottom navigation — replaces 9-tab desktop design
2. **Lazy locale loading** — only the selected language's 207 translation keys are downloaded; English bundled as default
3. **Offline form validation** — intake forms validate locally before submission
4. **localStorage persistence** — language preference, health records viewing, and form state survive network interruptions
5. **Lightweight rendering** — patient pages use minimal JavaScript; no heavy charting or editor components

### RTL support

Full right-to-left rendering for Arabic, Hebrew, Urdu, and Farsi:
- `dir={dir}` attribute on wrapper elements
- Tailwind logical properties (`rounded-ss-md`/`rounded-se-md`, `border-s-*`, `ms-`/`me-`) instead of physical `left`/`right`
- All date formatting respects locale-specific conventions via BCP-47 tags from `useTranslation()` context

### Client-side intelligence

Several features run entirely client-side without server round-trips:
- **14-point quality scorecard** — all checks are pure TypeScript functions operating on the analysis result object
- **Clinician override layer** — all edits stored in localStorage overlay; AI data immutable
- **Risk score recalculation** — clinician-entered variable values update scores locally
- **Session management** — up to 20 case sessions persisted and navigable without server calls

---

## Technical Video Companion

A 3-minute video walkthrough is available showing:
1. AI-guided patient interview with concurrent management planning
2. One-click handoff from interview to case analysis
3. 7-model agent reasoning with real-time tool invocation
4. Foundation model findings with CXR probability bars and drug safety cards
5. Clinician treatment plan editing with verdict cycling
6. Quality scorecard validation
7. Model Attribution Strip showing 7/7 models engaged
8. 23-language patient portal with Arabic RTL rendering

---

*Built for the MedGemma Impact Challenge. Deadline: February 24, 2026.*
