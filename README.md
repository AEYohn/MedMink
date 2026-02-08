# MedLit Agent - Medical Literature Synthesis Platform

> **MedGemma Impact Challenge Submission** | Privacy-First Clinical Evidence Synthesis

A **local-first medical literature synthesis agent** that helps clinicians find, understand, and apply evidence from medical research papers. Built for the [MedGemma Impact Challenge](https://kaggle.com/competitions/medgemma-impact-challenge) with a focus on privacy-preserving, edge-deployable AI.

## Demo

https://github.com/user-attachments/assets/demo-video-placeholder

**Try it yourself:**
```bash
# Start the demo (requires ~20GB for MedGemma model)
./scripts/demo.sh

# Open http://localhost:3000 and ask a clinical question
```

## Key Features

- **Multi-Model Consensus**: Primary clinician + skeptical reviewer perspectives with agreement scoring
- **Clinical Evidence Synthesis**: Query medical literature with PICO framework parsing
- **GRADE Evidence Grading**: Automated quality assessment of medical evidence
- **Real-Time Streaming**: Watch the 6-step analysis pipeline progress live
- **Drug Interaction Checking**: Identify potential medication interactions
- **Patient Symptom Triage**: AI-assisted symptom analysis with urgency levels
- **Local-First Privacy**: MedGemma 1.5 4B runs entirely on-device, no PHI leaves your machine

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     MedLit Agent (100% Local)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Clinical Question                                                  │
│         │                                                            │
│         ▼                                                            │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐   │
│   │ PICO Parser │────►│  PubMed &   │────►│   MedGemma 1.5 4B   │   │
│   │  (Extract)  │     │  medRxiv    │     │   (Local on MPS)    │   │
│   └─────────────┘     └─────────────┘     └─────────────────────┘   │
│                                                    │                 │
│                              ┌─────────────────────┼────────────┐   │
│                              │    CONSENSUS ENGINE │            │   │
│                              │         ▼           ▼            │   │
│                              │  ┌──────────┐ ┌──────────────┐   │   │
│                              │  │ Primary  │ │  Skeptical   │   │   │
│                              │  │ Clinician│ │  Reviewer    │   │   │
│                              │  └────┬─────┘ └──────┬───────┘   │   │
│                              │       │              │           │   │
│                              │       ▼              ▼           │   │
│                              │  ┌───────────────────────────┐   │   │
│                              │  │  Agreement Score (0-100%) │   │   │
│                              │  │  Divergence Points        │   │   │
│                              │  │  Final Synthesis          │   │   │
│                              │  └───────────────────────────┘   │   │
│                              └──────────────────────────────────┘   │
│                                           │                          │
│                                           ▼                          │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │              Real-Time Streaming Dashboard                   │   │
│   │  • 6-step pipeline visualization    • GRADE evidence cards  │   │
│   │  • Model agreement meter            • Cited sources         │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 6-Step Analysis Pipeline

| Step | Description | Output |
|------|-------------|--------|
| 1. PICO Parsing | Extract Population, Intervention, Comparison, Outcome | Structured query |
| 2. Evidence Search | Query PubMed + medRxiv | Relevant papers |
| 3. Primary Analysis | Clinician perspective synthesis | Evidence grade, key points |
| 4. Skeptical Review | Critical review, identify limitations | Concerns, caveats |
| 5. Consensus | Compare perspectives, score agreement | Agreement %, divergence |
| 6. Final Synthesis | Balanced recommendation | Actionable guidance |

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Python 3.12+
- Node.js 20+
- ~3GB disk space for MedGemma model

### Setup

1. Clone and configure:
```bash
git clone <repository>
cd research-synthesizer
cp .env.example .env
# Edit .env and add your API keys (see Configuration section)
```

2. Download the MedGemma model:
```bash
./scripts/download_model.sh
```

3. Start all services:
```bash
make dev
```

4. Access the dashboard at http://localhost:3000

### Quick Test

```bash
# Multi-model consensus analysis (streaming)
curl -N -X POST http://localhost:8000/api/consensus/analyze/stream \
  -H "Content-Type: application/json" \
  -d '{"question": "Is metformin effective for type 2 diabetes?", "max_papers": 5}'

# Non-streaming consensus analysis
curl -X POST http://localhost:8000/api/consensus/analyze \
  -H "Content-Type: application/json" \
  -d '{"question": "Does aspirin prevent heart attacks?", "max_papers": 3}'

# Test symptom checker (emergency detection)
curl -X POST http://localhost:8000/api/patient/symptoms \
  -H "Content-Type: application/json" \
  -d '{"symptoms": "I have had a headache for two days"}'

# Test drug interaction checker
curl -X POST http://localhost:8000/api/patient/medications/check \
  -H "Content-Type: application/json" \
  -d '{"medications": ["warfarin", "aspirin", "ibuprofen"]}'
```

### Example Response (Consensus Analysis)

```json
{
  "question": "Is metformin effective for type 2 diabetes?",
  "pico": {
    "population": "Adults with type 2 diabetes mellitus",
    "intervention": "Metformin",
    "comparison": "Placebo or standard care",
    "outcome": "Glycemic control"
  },
  "primary_grade": "high",
  "primary_confidence": 0.95,
  "skeptical_concerns": [
    "Study heterogeneity across populations",
    "Limited long-term outcome data"
  ],
  "agreement_score": 0.92,
  "final_recommendation": "Metformin is a first-line therapy for T2DM...",
  "papers": [{"pmid": "...", "title": "..."}]
}
```

## Medical Features

### Clinical Evidence Synthesis

The `/api/medical/ask` endpoint uses PICO framework to parse clinical questions:

- **P**opulation: Who are the patients?
- **I**ntervention: What treatment/exposure?
- **C**omparison: What is the alternative?
- **O**utcome: What is the desired effect?

Example query:
```json
{
  "question": "In patients with heart failure, does SGLT2 inhibitor therapy reduce mortality compared to standard care?",
  "include_preprints": true,
  "max_papers": 20
}
```

Response includes:
- PICO breakdown
- Evidence synthesis
- GRADE evidence level (high/moderate/low/very low)
- Key findings with citations
- Identified contradictions
- Clinical recommendation

### GRADE Evidence Methodology

Evidence is graded using the GRADE (Grading of Recommendations, Assessment, Development and Evaluations) methodology:

| Grade | Description |
|-------|-------------|
| **High** | Further research unlikely to change confidence |
| **Moderate** | Further research likely to have important impact |
| **Low** | Further research very likely to change estimate |
| **Very Low** | Estimate is very uncertain |

Factors considered:
- Study design (RCT vs observational)
- Risk of bias
- Inconsistency across studies
- Indirectness of evidence
- Imprecision
- Publication bias

### Multi-Model Routing

The healthcare assistant intelligently routes queries to optimal models:

| Query Type | Model | Reasoning |
|------------|-------|-----------|
| Literature search | MedGemma (local) | Medical domain expertise, privacy |
| Complex reasoning | Gemini Pro | Multi-step analysis capability |
| Patient education | Gemini Flash | Fast, cost-effective |
| Drug interactions | MedGemma (local) | Safety-critical, low latency |

### Drug Interaction Database

Built-in knowledge of major drug interactions:
- Blood thinners + NSAIDs
- SSRIs + MAOIs
- Opioids + Benzodiazepines
- ACE inhibitors + Potassium
- Statins + Grapefruit

### Symptom Triage

Urgency levels with safety-first design:
- **Emergency**: Immediate medical attention (chest pain, breathing difficulty)
- **Urgent**: Same-day care recommended
- **Routine**: Schedule appointment within days
- **Self-Care**: Home treatment appropriate

## API Reference

### Patient Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/patient/symptoms` | POST | Analyze symptoms, get triage guidance |
| `/api/patient/medications/check` | POST | Check drug interactions |
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
