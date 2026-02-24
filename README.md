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
Active development for the MedGemma Impact Challenge (deadline Feb 24, 2026). If you see stale artifacts from the older “MedLit” prototype, prefer the MedMink docs above.
| `/api/patient/appointments/book` | POST | Book an appointment |
| `/api/patient/appointments/available-slots` | POST | Get available slots |
| `/api/patient/health` | GET | Service health check |

### Admin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/appointments` | POST/GET | Create/list appointments |
| `/api/admin/appointments/{id}` | GET/PATCH/DELETE | Manage appointment |
| `/api/admin/schedule/optimize` | POST | Get schedule optimization |
| `/api/admin/schedule/available-slots` | GET | Get available slots |
| `/api/admin/reminders/send` | POST | Send appointment reminders |
| `/api/admin/reminders/bulk` | POST | Send bulk reminders |
| `/api/admin/patients` | GET | List patients |
| `/api/admin/health` | GET | Service health check |

### Consensus Endpoints (Multi-Model Analysis)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/consensus/analyze/stream` | POST | Streaming consensus analysis (SSE) |
| `/api/consensus/analyze` | POST | Non-streaming consensus analysis |
| `/api/consensus/analyze/image/stream` | POST | Image + text consensus (multimodal) |

### Medical/Clinical Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/medical/ask` | POST | Clinical evidence query |
| `/api/medical/assistant` | POST | Multi-model healthcare assistant |
| `/api/medical/route` | POST | Preview routing decision |
| `/api/medical/models` | GET | List available models |
| `/api/medical/ingest/pubmed` | POST | Ingest PubMed papers |
| `/api/medical/ingest/preprints` | POST | Ingest medRxiv papers |
| `/api/medical/health` | GET | Service health check |

### Authentication Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Register new user |
| `/api/auth/login` | POST | Login and get tokens |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/me` | GET | Get current user profile |
| `/api/auth/change-password` | POST | Change password |
| `/api/auth/logout` | POST | Logout user |

## Configuration

Key environment variables (see `.env.example` for full list):

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `JWT_SECRET_KEY` | Secret for JWT tokens (generate secure random) | Yes |
| `MEDGEMMA_MODEL_PATH` | Path to MedGemma GGUF model | For local inference |
| `PUBMED_API_KEY` | NCBI PubMed API key | For paper ingestion |
| `TWILIO_ACCOUNT_SID` | Twilio account for SMS | For reminders |

### Generating Secure JWT Secret

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Development

### Running Tests

```bash
# All tests
pytest tests/ -v

# Healthcare tests only
pytest tests/integration/test_healthcare.py -v

# With coverage
pytest tests/ -v --cov=src --cov-report=html
```

### Code Quality

```bash
# Linting
ruff check src/

# Type checking
mypy src/

# Formatting
black src/ tests/
```

### Manual Setup (without Docker)

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start databases
docker compose up -d postgres neo4j redis

# Download MedGemma model
./scripts/download_model.sh

# Run API
uvicorn src.api.main:app --reload

# Run dashboard (separate terminal)
cd dashboard && npm install && npm run dev
```

## Project Structure

```
research-synthesizer/
├── src/
│   ├── api/              # FastAPI endpoints
│   │   └── routes/       # Route handlers (patient, admin, medical, auth)
│   ├── agents/           # AI agents
│   │   ├── symptom_checker.py
│   │   ├── medication_manager.py
│   │   ├── scheduler.py
│   │   ├── medical_agent.py
│   │   └── healthcare_assistant.py
│   ├── auth/             # Authentication (JWT, password hashing)
│   ├── medgemma/         # MedGemma local inference client
│   ├── integrations/     # External services (Twilio)
│   ├── routing/          # Multi-model routing logic
│   ├── rag/              # RAG with ChromaDB
│   └── dspy_analysis/    # DSPy modules
├── dashboard/            # Next.js 14 frontend
│   └── src/app/
│       ├── patient/      # Patient-facing pages
│       ├── admin/        # Admin dashboard
│       └── ask/          # Clinical query interface
├── scripts/
│   └── download_model.sh # MedGemma download script
├── tests/
│   ├── unit/
│   └── integration/
│       └── test_healthcare.py
├── models/               # Local AI models (gitignored)
├── docker-compose.yml
└── requirements.txt
```

## Tech Stack

- **Backend**: FastAPI (Python 3.12)
- **Frontend**: Next.js 14 + React + TypeScript
- **Local AI**: MedGemma 4B (via llama-cpp-python)
- **Cloud AI**: Google Gemini (Pro, Flash)
- **Vector Store**: ChromaDB (local)
- **Graph Database**: Neo4j
- **Relational DB**: PostgreSQL
- **Cache/Queue**: Redis
- **SMS/Voice**: Twilio

## Privacy & Security

- **Local-first**: MedGemma runs entirely on your device
- **No PHI transmission**: Patient data never leaves local network
- **JWT authentication**: Secure token-based auth
- **Role-based access**: Patient, Provider, Admin roles
- **Bcrypt passwords**: Industry-standard password hashing

## Competition Submission

**MedGemma Impact Challenge** | Deadline: February 24, 2026

### Bonus Categories

| Category | Status | Implementation |
|----------|--------|----------------|
| **Agentic Workflow** ($10K) | ✅ | 6-step pipeline: PICO → Search → Analyze → Review → Consensus → Synthesize |
| **Edge AI** ($5K) | ✅ | MedGemma 1.5 4B runs 100% locally on Apple Silicon (MPS) or CPU |

### Judging Criteria Alignment

| Criterion | Weight | Our Approach |
|-----------|--------|--------------|
| HAI-DEF Model Use | 20% | MedGemma for all clinical reasoning tasks |
| Problem Domain | 15% | Evidence-based medicine - critical for clinical decisions |
| Impact Potential | 15% | Privacy-first design enables hospital deployment |
| Product Feasibility | 20% | Working demo, Docker deployment, clear documentation |
| Execution | 30% | Clean architecture, streaming UI, multi-model consensus |

### What Makes This Unique

1. **Multi-Model Consensus**: Not just one AI opinion - Primary Clinician + Skeptical Reviewer perspectives with agreement scoring
2. **Real-Time Streaming**: Watch the analysis unfold step-by-step (SSE)
3. **Privacy-First**: Zero patient data leaves the device
4. **Evidence-Based**: GRADE methodology, PubMed citations, reproducible

## License

MIT

---

Built for the [MedGemma Impact Challenge](https://kaggle.com/competitions/medgemma-impact-challenge) by [@noam1](https://github.com/noam1)
