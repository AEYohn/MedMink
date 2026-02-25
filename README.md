# MedMink — Clinical Decision Support with 7 Google Health AI Models

> MedGemma Impact Challenge submission • Clinician, Patient, and EMS workflows in one stack

MedMink orchestrates seven Google Health AI (HAI-DEF) models — MedGemma, CXR Foundation, Derm Foundation, Path Foundation, TxGemma, HeAR, and MedASR — into a single emergency-medicine workflow. A ReAct-style agent decides which model to invoke, streams reasoning via SSE, and renders transparent attribution so clinicians stay in control.

## Three Pillars (requested focus)
- **Clinician**: Case analysis + agentic clinical reasoning with 7-step streaming pipeline, quality scorecard, clinician override layer, and model attribution strip.
- **Patient**: 23-language patient portal with mobile-first intake, check-in, health records, messages, and post-visit companion; RTL support for Arabic/Farsi/Urdu/Hebrew.
- **EMS**: AI-guided EMS run-report dictation with deterministic validation and ICD-10/medical-necessity summaries ([src/api/routes/ems.py](src/api/routes/ems.py), [src/medgemma/ems_interviewer.py](src/medgemma/ems_interviewer.py), [dashboard/src/types/ems.ts](dashboard/src/types/ems.ts)).

## Highlights
- **7-model orchestration**: MedGemma + CXR/Derm/Path + TxGemma + HeAR + MedASR, all attributed in UI.
- **Streaming everything**: SSE for case analysis, agent reasoning, consensus, interview, reassessment.
- **Safety-first**: Three-layer medication safety (deterministic + TxGemma + MedGemma) and 14-point client-side quality scorecard.
- **Multilingual access**: 23 languages with locale-aware dates and RTL rendering for patient flows.
- **Clinician control**: Accept/reject/modify every AI recommendation; overrides never mutate AI output.

## Repo Map
- Backend FastAPI: core routes in [src/api](src/api) (case analysis, agent, interview, EMS, charting).
- MedGemma + tools: [src/medgemma](src/medgemma) (case analyzer, consensus, medication safety, EMS, TxGemma client).
- Frontend (Next.js 14, shadcn/tailwind): [dashboard/src/app](dashboard/src/app) and components under [dashboard/src/components](dashboard/src/components).
- Modal deployments: [modal_app.py](modal_app.py), [modal_app_multimodal.py](modal_app_multimodal.py), [modal_cxr.py](modal_cxr.py), [modal_derm.py](modal_derm.py), [modal_path.py](modal_path.py), [modal_txgemma.py](modal_txgemma.py), [modal_hear.py](modal_hear.py), [modal_asr.py](modal_asr.py).
- Docs: feature deep dive in [docs/FEATURE_REVIEW.md](docs/FEATURE_REVIEW.md), competition write-up in [docs/COMPETITION_SUBMISSION.md](docs/COMPETITION_SUBMISSION.md), demo script in [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

## Quick Start
Prereqs: Python 3.11+, Node 20+, pnpm, Modal CLI (for remote models) or local GPU/CPU for MedGemma small. Docker optional.

```bash
git clone https://github.com/<your-org>/research-synthesizer.git
cd research-synthesizer
cp .env.example .env   # fill in keys and Modal endpoints
python -m venv .venv && source .venv/bin/activate
pip install -e .
pnpm install --filter dashboard
```

Run backend (FastAPI):
```bash
uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8001
```

Run frontend (Next.js):
```bash
cd dashboard
pnpm dev --port 3000
```

Modal models (optional, recommended for 27B + vision/audio):
- Set `MEDGEMMA_MODAL_URL`, `TXGEMMA_MODAL_URL`, `CXR_FOUNDATION_MODAL_URL`, `DERM_FOUNDATION_MODAL_URL`, `PATH_FOUNDATION_MODAL_URL`, `HEAR_MODAL_URL`, `MEDASR_MODAL_URL`, `WHISPER_MODAL_URL` in `.env`.
- Scripts `modal_*.py` deploy each endpoint.

Seed/demo data (optional):
```bash
python demo/build_seed_bundle.py
python demo/seed_all.py
```

## Three Pillars — Where to look
- **Clinician**: Case pipeline and agent trace in [src/api/routes/case_analysis.py](src/api/routes/case_analysis.py) and [src/agents/clinical_reasoning_agent.py](src/agents/clinical_reasoning_agent.py); UI in [dashboard/src/app/(clinician)/case/page.tsx](dashboard/src/app/(clinician)/case/page.tsx) with attribution strip, foundation findings, quality scorecard, and override editors.
- **Patient**: Mobile-first care hub and multilingual intake in [dashboard/src/app/patient](dashboard/src/app/patient) and i18n utilities under [dashboard/src/i18n](dashboard/src/i18n); interview dual-agent flow in [src/api/routes/interview.py](src/api/routes/interview.py).
- **EMS**: Run-report dictation and validation in [src/api/routes/ems.py](src/api/routes/ems.py); MedGemma-driven extraction and deterministic checks in [src/medgemma/ems_interviewer.py](src/medgemma/ems_interviewer.py); frontend types at [dashboard/src/types/ems.ts](dashboard/src/types/ems.ts).

## Safety, Privacy, and What Stays Local
- Do **not** commit secrets: `.env` is ignored. Keep `.env.example` only.
- Data and models are ignored by default: `data/`, `models/`, `demo/output/`, `.venv/`, `.next/` are in [.gitignore](.gitignore).
- Patient/EMS text/audio stays within your deployment; Modal endpoints are yours to provision.

## More Details
- Full feature breakdown: [docs/FEATURE_REVIEW.md](docs/FEATURE_REVIEW.md)
- Competition narrative: [docs/COMPETITION_SUBMISSION.md](docs/COMPETITION_SUBMISSION.md)
- Demo walkthrough: [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)

## Status
Active development for the MedGemma Impact Challenge (deadline Feb 24, 2026). Public repo: https://github.com/AEYohn/MedMink. Primary maintainer: @AEYohn.

## License
MIT

Built for the [MedGemma Impact Challenge](https://kaggle.com/competitions/medgemma-impact-challenge) by [@noam1](https://github.com/noam1)
