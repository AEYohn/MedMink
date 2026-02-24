# MedMink — Feature Review

> Comprehensive clinical decision support platform powered by 7 Google Health AI (HAI-DEF) foundation models, built for the MedGemma Impact Challenge.

---

## 1. Case Analysis Pipeline

**What it does:** Accepts a free-text clinical vignette, parses it into structured data, and streams a 7-step analysis covering case extraction, category classification, treatment generation, medication safety, risk stratification, differential diagnosis, and acute management.

**Models/APIs:** MedGemma 27B (core reasoning), PubMed E-utilities API (evidence retrieval).

**Key components and files:**
- `src/medgemma/case_analyzer.py` — `CaseAnalyzer` class with 16-specialty `MEDICAL_CATEGORIES` dictionary; each specialty includes treatment classes, workup, acute interventions, monitoring, and consults
- `src/api/routes/case_analysis.py` — `POST /api/case/analyze/stream` (SSE), `POST /api/case/analyze`, `POST /api/case/reassess/stream`
- `dashboard/src/types/case.ts` — `CaseAnalysisData`, `ParsedCase`, `TreatmentOption`, `AcuteManagement`, `MedicationReview` type definitions
- `dashboard/src/app/(clinician)/case/page.tsx` — two-column case analysis page (60/40 split)

**Technical highlights:**
- Server-Sent Events (SSE) stream 7 analysis steps with real-time progress updates; each step emits `{type, step, status, message, progress, data}`
- PubMed human-study filter (`_is_human_clinical_study`) excludes animal studies, editorials, and retracted publications using MeSH terms, publication types, and title keyword exclusion lists
- Reassessment pipeline (`POST /api/case/reassess/stream`) merges new findings with the original case via `_merge_findings()` and re-runs full analysis, maintaining a timeline of events
- JSON-only output directive with 5000 `max_tokens` to prevent truncation of acute management sections

---

## 2. Agentic Clinical Reasoning

**What it does:** A ReAct-style autonomous agent that receives a clinical case and decides which specialized foundation model tools to invoke, in what order, based on the clinical context. Streams each reasoning step (thinking → tool call → tool result → assessment → consensus) for full transparency.

**Models/APIs:** MedGemma 27B (orchestration), CXR Foundation, Derm Foundation, Path Foundation, TxGemma, HeAR, PubMed API — all 7 HAI-DEF models available as tools.

**Key components and files:**
- `src/agents/clinical_reasoning_agent.py` — `AgentStep` and `AgentResult` dataclasses; `run_reasoning_agent()` async generator
- `src/api/routes/agent.py` — `POST /api/agent/reason/stream` (SSE), `GET /api/agent/tools`
- `dashboard/src/components/case/AgentReasoningTrace.tsx` — real-time trace visualization with tool icons, status badges, expandable results

**7 agent tools:**
| Tool | Model | Purpose |
|------|-------|---------|
| `analyze_chest_xray` | CXR Foundation | Zero-shot classification for 13+ chest conditions |
| `analyze_skin_lesion` | Derm Foundation | Melanoma vs. benign triage with malignancy probability |
| `analyze_pathology` | Path Foundation | Tissue classification and tumor grading |
| `screen_respiratory` | HeAR | Cough/breathing audio screening (TB, COVID-19, COPD, asthma) |
| `check_drug_interactions` | TxGemma + deterministic | Drug interaction detection and severity assessment |
| `predict_drug_toxicity` | TxGemma | Organ-specific toxicity profiling |
| `compute_risk_scores` | MedGemma + deterministic | Clinical risk score calculation (HEART, Wells, CURB-65, etc.) |

**Technical highlights:**
- MedGemma autonomously reasons about which tools are relevant based on case content (e.g., only invokes CXR if imaging is mentioned)
- Each tool call is dispatched asynchronously to its Modal-hosted model endpoint
- Trace UI renders thinking steps (indigo), tool invocations (amber with spinner), results (green/red), and final assessment with confidence score
- Consensus mechanism synthesizes findings from all invoked models into integrated assessment with agreement/disagreement visualization

---

## 3. Model Attribution Strip

**What it does:** A visual horizontal strip showing all 7 HAI-DEF models as interactive badges with three states: available (gray), active (blue, spinning), and used (green, checkmark). Clicking a model reveals its contribution details.

**Models/APIs:** All 7 (MedGemma, CXR Foundation, Derm Foundation, Path Foundation, TxGemma, HeAR, MedASR).

**Key components and files:**
- `dashboard/src/components/case/ModelAttributionStrip.tsx` — `MODELS` array with 7 entries, each with `id`, `label`, `fullName`, `matchTools[]`, and `description`
- State machine: `getModelState()` maps tool activity to visual states; `getContribution()` generates human-readable summaries

**Technical highlights:**
- MedGemma is always marked "used" once analysis starts (core reasoning model)
- TxGemma also activates from the medication review pipeline (not just direct tool calls)
- MedASR activates when dictation is used for case input
- Counter badge shows "N/7 models active/used" with color coding (emerald for 5+, blue otherwise)
- Expandable detail panel shows model full name, status badge, description, and specific contribution text (e.g., "Found 2 drug interaction(s)")

---

## 4. Foundation Model Findings

**What it does:** Renders rich, modality-specific result cards for each foundation model that contributed to the analysis. Each card type has a purpose-built visualization.

**Models/APIs:** CXR Foundation, Derm Foundation, Path Foundation, TxGemma, HeAR.

**Key components and files:**
- `dashboard/src/components/case/FoundationModelFindings.tsx` — `TOOL_META` registry, specialized sub-components: `CXRFindingsCard`, `DrugSafetyCard`, `RespiratoryCard`, `GenericResultCard`

**Card types:**
| Card | Visualization |
|------|--------------|
| CXR Foundation | Horizontal probability bars for each condition (red >60%, amber >30%, green ≤30%) |
| Medication Safety | Drug interaction pairs with severity badges (major/moderate/minor), effect descriptions |
| TxGemma Toxicity | Toxic/safe badge with confidence percentage |
| HeAR Respiratory | Risk level badge (high/moderate/low) with detected condition tags |
| Derm/Path Foundation | Key-value summary of classification results |

**Technical highlights:**
- Filters out errored results (`!('error' in r.result)`)
- Color-coded card borders by modality (blue for CXR, pink for derm, violet for path, amber for drug safety, teal for respiratory)
- Model attribution badge shows which specific model variant produced the result

---

## 5. Quality Scorecard

**What it does:** A 14-point client-side quality evaluation that grades the AI analysis output on clinical completeness, safety, and evidence quality. Produces a letter grade (A through D) with expandable pass/fail breakdown.

**Models/APIs:** Pure client-side logic — no model calls. Evaluates MedGemma output.

**Key components and files:**
- `dashboard/src/components/case/QualityScorecard.tsx` — `runQualityChecks()` pure function, `getGrade()` letter grading

**14 quality checks:**
| # | Check | What it validates |
|---|-------|-------------------|
| 1 | Category Classification | Case classified into a medical specialty |
| 2 | Risk Stratification | Risk level assigned |
| 3 | Disposition | Patient disposition recommendation provided |
| 4 | Treatment Recommendations | At least one treatment recommended |
| 5 | No Self-Contradictions | No recommended treatment conflicts with do-not-do list |
| 6 | Etiology Addressed | Rationale mentions underlying cause/mechanism |
| 7 | Specialist Consults | Consultation recommendations included |
| 8 | Do-Not-Do Coverage | Safety contraindications documented |
| 9 | Evidence Quality | ≥30% of papers are keyword-matched (not title-only) |
| 10 | Acute Management | Immediate actions present |
| 11 | Monitoring Plan | Monitoring parameters specified |
| 12 | Differential Diagnosis | DDx generated with likelihood ranking |
| 13 | Cross-Field Consistency | Risk level coherent with disposition (high-risk ≠ discharge) |
| 14 | Clinical Pearls | Educational pearls generated |

**Grading scale:** A (≥93%), A- (≥85%), B+ (≥78%), B (≥70%), C (≥60%), D (<60%).

**Technical highlights:**
- Compact dot-row visualization when collapsed (green/red dots for each check)
- Score progress bar with color transition (emerald ≥80%, amber ≥60%, red <60%)
- Failed checks shown first with "Needs Attention" heading
- Cross-field consistency check catches logical contradictions (e.g., high-risk patient with discharge disposition)

---

## 6. Cross-Modal Consensus

**What it does:** Synthesizes findings from multiple model perspectives — Primary Clinician, Skeptical Reviewer, and Vision Specialist — into an integrated assessment with agreement scores, disagreement resolutions, and recommended next steps.

**Models/APIs:** MedGemma 27B (multi-perspective synthesis), CXR/Derm/Path Foundation (vision enhancement), PubMed API (evidence search).

**Key components and files:**
- `src/medgemma/consensus.py` — `ConsensusEngine` class, `MedicalLiteratureAgent`
- `src/api/routes/consensus.py` — `POST /consensus/analyze/stream`, `POST /consensus/analyze`, `POST /consensus/analyze/image/stream`
- `dashboard/src/components/case/ConsensusPanel.tsx` — agreement/disagreement visualization
- Agent trace consensus section in `AgentReasoningTrace.tsx`

**Consensus workflow:**
1. PICO extraction from clinical question
2. PubMed evidence search
3. Primary clinician synthesis
4. Skeptical reviewer perspective
5. Vision enhancement (if imaging available)
6. Agreement scoring with confidence percentage
7. Final integrated recommendation

**Technical highlights:**
- Always-on lightweight fallback: when the full agent is not run, consensus still runs as part of the standard analysis pipeline
- Disagreements shown with model name, position, and resolution strategy
- Contributing models listed as badges for attribution
- Overall confidence score displayed as percentage badge
- Supports both text-only and image-based consensus analysis via separate endpoints

---

## 7. Dual-Agent Interview

**What it does:** An AMIE-inspired dual-agent interview system where a Dialogue Agent conducts structured patient intake (demographics → HPI → ROS → PMH → medications → allergies → triage) while a Management Reasoning Agent concurrently builds an incremental management plan in the right panel.

**Models/APIs:** MedGemma 27B (dialogue + management reasoning), MedASR / Whisper (audio transcription), HeAR (respiratory audio classification).

**Key components and files:**
- `src/api/routes/interview.py` — `POST /api/interview/start`, `/respond`, `/respond/audio`, `/respond/stream`, `/{session_id}/complete`, `/{session_id}/handoff`
- `src/medgemma/management_agent.py` — `ManagementReasoningAgent` class with `update_plan()` method
- `dashboard/src/app/(clinician)/interview/page.tsx` — split-view layout (chat left, management plan right)
- `dashboard/src/components/interview/InterviewChat.tsx` — chat bubbles with audio playback and transcription status

**Management plan output:**
- `differential_diagnosis` — diagnoses with likelihood and supporting/refuting findings
- `recommended_investigations` — tests with urgency (stat/routine/if_available)
- `treatment_plan` — immediate and short-term actions with monitoring
- `disposition` — admission/observe/discharge with level of care
- `knowledge_gaps` — missing information still needed
- `plan_confidence` — 0.0–1.0 score, `plan_completeness` — preliminary/partial/comprehensive

**Technical highlights:**
- Session-based with conversation history and phase tracking
- Audio input via `useAudioRecorder` hook with Gemini + Modal Whisper fallback transcription
- Management agent updates incrementally as new clinical data arrives (skips redundant updates)
- Respiratory keyword detection triggers HeAR cough recording prompt
- 23-language support with `LANGUAGES` array for multilingual patient intake
- Visit history tracking via `visit_tracker.py` (JSON file storage at `data/visits/`)

---

## 8. Interview → Case Handoff

**What it does:** One-click transfer of a completed interview into the case analyzer. Converts the structured triage data (chief complaint, HPI, ROS, PMH, medications, allergies, ESI level) into a clinical vignette and auto-submits it for full analysis.

**Models/APIs:** MedGemma 27B (vignette generation from structured data, then full case analysis).

**Key components and files:**
- `src/api/routes/interview.py` — `POST /api/interview/{session_id}/handoff`
- `dashboard/src/app/(clinician)/interview/page.tsx` — "Analyze Case" button
- `dashboard/src/app/(clinician)/case/page.tsx` — receives handoff data, auto-starts streaming analysis

**Technical highlights:**
- Handoff endpoint compiles all extracted interview data into a single narrative vignette
- Case page detects handoff parameters and auto-submits the vignette for analysis
- Triage data (ESI level, red flags, recommended setting) carries over to the case analysis via `TriageDataBanner`
- Patient context (ID, demographics, conditions, medications) persists across the transition

---

## 9. Three-Layer Medication Safety

**What it does:** A hybrid safety pipeline that checks drug interactions, drug-disease conflicts, dosing concerns, and allergy cross-reactivity using three complementary layers in parallel.

**Models/APIs:** Deterministic lookup (100+ known drug pairs), TxGemma 9B (interaction prediction + toxicity profiling), MedGemma 27B (clinical reasoning for nuanced analysis).

**Key components and files:**
- `src/medgemma/medication_safety.py` — `check_medication_safety()` function, 8 drug class static database
- `src/medgemma/txgemma.py` — `TxGemmaClient.predict_interaction()`, `predict_toxicity()`
- `src/api/routes/case_analysis.py` — `POST /api/case/medication-safety`, `POST /api/case/drug-interaction`, `POST /api/case/drug-toxicity`, `POST /api/case/drug-properties`
- `dashboard/src/components/case/SafetyAlertsPanel.tsx` — acknowledeable alerts with notes
- `dashboard/src/components/case/MedicationSafetyTab.tsx` — detailed safety view
- `dashboard/src/components/case/DrugPropertyCard.tsx` — TxGemma property lookup

**Three layers:**
| Layer | Speed | Mechanism |
|-------|-------|-----------|
| 1. Deterministic | <10ms | Static lookup of `KNOWN_MAJOR_INTERACTIONS` dict (100+ drug pairs, 8 drug classes) |
| 2. TxGemma | ~1s | `predict_interaction()` + `predict_toxicity()` via Modal-hosted TxGemma-9B-chat |
| 3. MedGemma | ~3s | Clinical reasoning prompt for nuanced analysis of patient-specific factors |

**Technical highlights:**
- All three layers run in parallel via `asyncio.gather()` for minimal latency
- Results merged with deduplication; severity levels unified across layers
- Drug class taxonomy: SSRI, MAOI, statin, ACE inhibitor, blood thinner, NSAID, opioid, benzodiazepine
- Safety alerts are acknowledeable — clinicians can mark alerts as reviewed with notes
- Unacknowledged alerts sorted first, acknowledged alerts collapsed
- Output: `MedicationSafetyResult` with `overall_safety` ("safe" / "caution" / "unsafe")

---

## 10. Clinician Collaboration Interface

**What it does:** A comprehensive clinician override layer that sits on top of AI-generated data, allowing clinicians to accept, reject, or modify every recommendation without altering the underlying AI output.

**Models/APIs:** Pure client-side. Edits are stored as a separate `ClinicianOverrides` object.

**Key components and files:**
- `dashboard/src/lib/storage.ts` — `ClinicianOverrides` type definition with treatments, acuteActions, customActions, dischargeMeds, dischargeInstructions, safetyAcknowledgments, riskScoreInputs
- `dashboard/src/components/case/TreatmentPlanEditor.tsx` — verdict buttons (accept/reject/modify), status cycling (pending → ordered → administered → held), inline dose editing, notes, HTML5 drag reorder
- `dashboard/src/components/case/AcuteManagementEditor.tsx` — interactive checklist with checkboxes, inline text editing, custom action addition, completion counter
- `dashboard/src/components/case/DischargeEditor.tsx` — editable medication reconciliation table (add/remove/edit rows), discharge instructions textarea
- `dashboard/src/components/case/SafetyAlertsPanel.tsx` — acknowledgeable alerts with clinician notes
- `dashboard/src/hooks/useCaseSession.ts` — `updateOverrides()` and `getOverrides()` for persistence

**Technical highlights:**
- Override layer maintains full undo capability: AI data is never modified, only overlaid
- Treatment verdicts: recommended / consider / not_recommended, with status lifecycle tracking
- Custom treatments and actions can be added by clinicians alongside AI suggestions
- Discharge med reconciliation tracks source (ai vs. clinician) for each medication
- All overrides persisted to localStorage via `CaseSession` with auto-save on every edit (max 20 sessions)

---

## 11. Risk Stratification

**What it does:** Calculates and displays validated clinical risk scores (HEART, Wells, CURB-65, qSOFA, CHA₂DS₂-VASc, etc.) using a hybrid approach where deterministic values are extracted from structured data and missing values are inferred by MedGemma.

**Models/APIs:** MedGemma 27B (variable inference for missing clinical data), deterministic algorithms (score calculation).

**Key components and files:**
- `src/api/routes/case_analysis.py` — `POST /api/case/risk-scores`
- `dashboard/src/components/case/RiskScoresTab.tsx` — score cards with editable variable inputs, source badges (Auto / AI / Missing / Clinician)
- `dashboard/src/types/case.ts` — `ScoreVariable` with `source: 'deterministic' | 'medgemma' | 'missing'`

**Technical highlights:**
- Each variable tracks its source: deterministic (auto-extracted), medgemma (AI-inferred), missing, or clinician (manually entered)
- Clinician-editable input fields for missing or AI-inferred variables — entering a value shows "Clinician" source badge
- Score bar visualization with color coding by risk level (green → amber → red)
- Scores flagged as "inapplicable" when >50% of variables are missing, shown in a separate "Insufficient Data" section
- Agent-sourced scores get an "Agent" badge when computed by the clinical reasoning agent
- Regeneration button allows recalculation with updated inputs

---

## 12. Similar Case Retrieval

**What it does:** Uses embeddings from CXR, Derm, and Path foundation models to find visually and clinically similar cases via cosine similarity search.

**Models/APIs:** CXR Foundation (embeddings), Derm Foundation (6,144-dim embeddings), Path Foundation (embeddings).

**Key components and files:**
- `src/medgemma/embedding_store.py` — `EmbeddingStore` singleton with `add()`, `find_similar()`, JSON file persistence at `data/embeddings/{modality}.json`
- `src/api/routes/case_analysis.py` — `POST /api/case/image/similar`
- `dashboard/src/components/case/SimilarCasesSection.tsx` — similar case cards with similarity scores
- `demo/fixtures/seed_data.json` — 6 seeded case sessions and 4 patients

**Technical highlights:**
- L2-normalized cosine similarity on embedding vectors
- Per-modality stores (CXR, derm, pathology) for domain-appropriate matching
- Seed data provides initial reference cases for similarity comparisons
- Automatic JSON file persistence for embedding storage
- `find_similar(query_embedding, top_k=3, exclude_case_id)` returns top-k matches

---

## 13. 23-Language Patient UI

**What it does:** Provides a fully translated patient-facing interface in 23 languages including 4 RTL languages (Arabic, Hebrew, Urdu, Farsi), with lazy locale loading and persistent language preference.

**Models/APIs:** Claude API (translation generation via `scripts/generate-translations.ts`), with English fallback for untranslated strings.

**Key components and files:**
- `dashboard/src/i18n/LanguageContext.tsx` — `LanguageProvider` React context, `useTranslation()` hook returning `{ t, locale, setLocale, dir, bcp47 }`
- `dashboard/src/i18n/languages.ts` — `LANGUAGES` array (en + 22 others)
- `dashboard/src/i18n/translate.ts` — flat-key lookup with `{var}` interpolation
- `dashboard/src/i18n/locales/*.json` — 23 locale files (~207 keys each)
- `dashboard/src/components/patient/LanguageSelector.tsx` — globe icon dropdown

**Supported languages:** English, Spanish, French, German, Chinese (Simplified), Chinese (Traditional), Japanese, Korean, Hindi, Arabic (RTL), Portuguese, Russian, Italian, Turkish, Vietnamese, Thai, Indonesian, Malay, Bengali, Urdu (RTL), Farsi (RTL), Hebrew (RTL), Swahili.

**Technical highlights:**
- `en.json` bundled; all other locales lazy-loaded via dynamic `import()` with English fallback
- RTL support: `dir={dir}` on wrapper div, Tailwind logical properties (`rounded-ss-md`/`rounded-se-md`, `border-s-*`, `ms-`/`me-`)
- All patient-facing `toLocaleDateString()` calls use `bcp47` from context
- Language preference persisted to `localStorage` key `medmink-patient-language`
- Clinician side remains English-only — i18n is patient-facing only

---

## 14. Patient Care Hub

**What it does:** A mobile-first patient portal with 5 dedicated pages: intake (multilingual interview), check-in, visit summary, health records, and messages. Redesigned from 9 tabs to 5 pages with bottom navigation.

**Models/APIs:** MedGemma 27B (intake interview, AI companion chat), i18n system for multilingual support.

**Key components and files:**
- `dashboard/src/app/patient/intake/` — multilingual intake interview
- `dashboard/src/app/patient/visit/` — visit summary with released notes
- `dashboard/src/app/patient/health/` — health records (allergies, conditions, medications)
- `dashboard/src/app/patient/messages/` — patient-provider messaging
- `dashboard/src/app/patient/postvisit/` — post-visit AI companion
- `dashboard/src/components/care-hub/CareHubIntake.tsx` — phase-progression interview with local fallback greetings
- `dashboard/src/components/care-hub/CareHubHome.tsx` — summary dashboard (active meds, next follow-up, care plan)
- `dashboard/src/components/care-hub/BottomNav.tsx` — mobile-first navigation

**Technical highlights:**
- CareHubIntake uses `useTranslation()` context for multilingual patient intake
- Bottom navigation with 5-page structure replaces tab-heavy design for mobile usability
- Post-visit companion supports vital sign logging, messaging, and AI-drafted follow-up
- Health records page aggregates allergies, conditions, medications, labs, and imaging
- VisitPicker component for navigating between encounters

---

## 15. Clinical Charting

**What it does:** Voice-to-SOAP charting system with dictation input, automatic SOAP note structuring, and compliance scanning.

**Models/APIs:** MedGemma 27B (SOAP note generation), MedASR (medical speech recognition for dictation).

**Key components and files:**
- `dashboard/src/app/(clinician)/chart/page.tsx` — dictation input, transcript display, SOAP editor, compliance panel
- `src/api/routes/charting.py` — charting endpoints
- Compliance scanning via `useComplianceScan` hook with `ComplianceScoreBadge`

**Technical highlights:**
- DictationInput supports both text and audio processing modes
- TranscriptDisplay with inline correction UI for fixing transcription errors
- SOAPEditor for manual editing of subjective, objective, assessment, and plan sections
- Compliance panel scans SOAP notes for required elements and displays compliance score
- Session hydration from case analysis (case-to-chart-soap key in sessionStorage)

---

## 16. Admin & Settings

**What it does:** Administrative tools for schedule management, patient management, system configuration, and workflow settings.

**Models/APIs:** None (admin utilities).

**Key components and files:**
- `dashboard/src/app/(clinician)/admin/` — patient management (CRUD), schedule management
- `dashboard/src/app/(clinician)/settings/page.tsx` — system status, theme toggle, cache management, analysis settings
- `src/api/routes/admin.py` — appointments, schedules, reminders endpoints

**Additional clinician pages:**
- `/cases` — case list view
- `/consensus` — standalone consensus analysis
- `/chat` — general AI chat
- `/ems` — EMS/emergency protocols
- `/documents` — document management
- `/labs` — lab results viewer
- `/imaging` — medical imaging viewer
- `/referrals` — referral management

**Technical highlights:**
- Settings page shows system status (cache stats, analysis settings), allows clearing localStorage
- Theme toggle via next-themes for dark/light mode
- Admin section is clinician-only access

---

## Architecture Summary

### HAI-DEF Model Deployment

All foundation models are deployed on Modal GPU infrastructure:

| Modal Deployment | Model | GPU |
|-----------------|-------|-----|
| `modal_app.py` | MedGemma 27B (text) | A100 |
| `modal_app_multimodal.py` | MedGemma 27B (multimodal) | A100 |
| `modal_cxr.py` | CXR Foundation | T4 |
| `modal_derm.py` | Derm Foundation | T4 |
| `modal_path.py` | Path Foundation | T4 |
| `modal_txgemma.py` | TxGemma 9B | A10G |
| `modal_hear.py` | HeAR | T4 |
| `modal_asr.py` | MedASR / Whisper | T4 |

### Frontend Stack
- **Framework:** Next.js 14 with App Router
- **UI Library:** shadcn/ui (Card, Badge, Collapsible, Button, Tabs, etc.)
- **Styling:** Tailwind CSS with dark mode support
- **State:** React hooks + localStorage persistence (max 20 sessions)
- **Streaming:** SSE (Server-Sent Events) for long-running analysis

### Backend Stack
- **Framework:** FastAPI (Python 3.11+)
- **Modules:** 32 MedGemma client modules, 26 API route files
- **Async:** Full async/await with `asyncio.gather()` for parallel model calls
- **Data:** PubMed E-utilities, structured JSON storage

### Codebase Metrics
| Metric | Count |
|--------|-------|
| HAI-DEF Models Used | 7 |
| Modal GPU Deployments | 9 |
| Case Components | 37 |
| API Route Files | 26 |
| MedGemma Modules | 32 |
| Languages Supported | 23 |
| Quality Checks | 14 |
| Medical Specialties | 16 |
| Test Files | 13 |
| Patient App Pages | 5 |
| Clinician App Pages | 20+ |
