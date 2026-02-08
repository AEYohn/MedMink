# MedLit Agent: Multi-Model Consensus for Clinical Evidence Synthesis

**MedGemma Impact Challenge Submission**

## Problem Statement

Clinicians face an impossible task: staying current with medical literature. With over 30 million papers in PubMed and thousands more added daily, finding relevant evidence for clinical decisions is overwhelming. Current solutions fall short:

- **Search engines** return thousands of results without synthesis
- **Cloud AI tools** raise privacy concerns with patient data
- **Single-model systems** lack the critical review that prevents overconfident recommendations

The consequences are significant: clinicians either spend hours searching literature or make decisions without the latest evidence.

## Solution: MedLit Agent

MedLit Agent is a **local-first, multi-model clinical evidence synthesis platform** built on MedGemma 1.5 4B. It transforms clinical questions into actionable, evidence-graded recommendations through a novel 6-step agentic pipeline.

### Key Innovation: Multi-Model Consensus

Unlike single-model approaches, MedLit Agent uses **two distinct perspectives** on every clinical query:

| Perspective | Role | Output |
|-------------|------|--------|
| **Primary Clinician** | Evidence-based synthesis | Key findings, evidence grade, recommendation |
| **Skeptical Reviewer** | Critical analysis | Limitations, biases, concerns, caveats |

The system then computes an **agreement score** and identifies **divergence points** where the perspectives disagree. This mimics the peer review process that makes medical literature trustworthy.

### 6-Step Agentic Pipeline

```
1. PICO Parsing      → Extract structured query (Population, Intervention, Comparison, Outcome)
2. Evidence Search   → Query PubMed + medRxiv with generated MeSH terms
3. Primary Analysis  → Synthesize evidence, grade quality (GRADE methodology)
4. Skeptical Review  → Challenge findings, identify limitations
5. Consensus         → Score agreement, highlight divergence
6. Final Synthesis   → Balanced recommendation with confidence calibration
```

Each step streams progress to the UI in real-time via Server-Sent Events (SSE), giving clinicians visibility into the reasoning process.

## Technical Implementation

### MedGemma Integration

MedGemma 1.5 4B runs entirely locally:
- **Device**: Apple Silicon (MPS) or CPU
- **Memory**: ~19GB model loaded in float32
- **Inference**: HuggingFace Transformers with custom prompts
- **Privacy**: Zero patient data leaves the device

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Local Deployment                             │
├─────────────────────────────────────────────────────────────────┤
│  FastAPI Backend          │  Next.js 14 Dashboard               │
│  • Consensus Engine       │  • Real-time streaming UI           │
│  • Medical Agent          │  • Pipeline visualization           │
│  • PubMed/medRxiv APIs    │  • Model perspective comparison     │
├─────────────────────────────────────────────────────────────────┤
│  MedGemma 1.5 4B (Local)  │  ChromaDB (Local Vector Store)      │
│  • PICO extraction        │  • Paper embeddings                 │
│  • Evidence synthesis     │  • Semantic search                  │
│  • JSON-structured output │  • PubMedBERT embeddings            │
└─────────────────────────────────────────────────────────────────┘
```

### Key Technical Decisions

1. **Streaming SSE**: Long-running analyses (3-5 min) show progress, not a spinner
2. **JSON-structured prompts**: Reliable parsing of MedGemma outputs with fallback recovery
3. **PICO normalization**: Field validators handle MedGemma's capitalization variations
4. **Consensus dataclasses**: Type-safe pipeline with `ModelPerspective` and `ConsensusResult`

## Impact Potential

### Clinical Utility

- **Time savings**: 5-minute synthesis vs. hours of manual search
- **Evidence quality**: GRADE methodology ensures standardized quality assessment
- **Critical review**: Skeptical perspective prevents overconfident recommendations
- **Reproducibility**: Cited sources allow verification

### Privacy Advantages

- **Hospital-deployable**: No PHI leaves the network
- **HIPAA-friendly**: Local inference eliminates cloud privacy concerns
- **Offline-capable**: Works without internet after model download

### Scalability

- **Edge deployment**: Runs on a laptop (M1/M2/M3 Mac, Linux with CUDA)
- **Docker-ready**: Single `docker compose up` deployment
- **API-first**: Integrates with existing clinical workflows

## Results

### Demo Query: "Is metformin effective for type 2 diabetes?"

| Metric | Value |
|--------|-------|
| Processing time | ~5 minutes (Apple M2) |
| Evidence grade | High |
| Primary confidence | 95% |
| Agreement score | 95% |
| Divergence points | 2 |
| Papers retrieved | 1 (from PubMed) |

### Sample Output

**Primary Clinician**: "Metformin is a cornerstone therapy for managing type 2 diabetes... evidence grade HIGH based on numerous large-scale clinical trials."

**Skeptical Reviewer**: "The assessment oversimplifies the comparison... fails to adequately address heterogeneity of evidence across diverse patient populations."

**Final Synthesis**: "Metformin is an effective first-line pharmacologic therapy... treatment decisions should be individualized considering comorbidities, patient preferences, and potential side effects."

## Bonus Categories

### Agentic Workflow ($10K)

The 6-step pipeline demonstrates true agentic behavior:
- **Tool use**: PubMed API, medRxiv API, vector search
- **Multi-step reasoning**: Each step builds on previous outputs
- **Self-critique**: Skeptical reviewer challenges primary analysis
- **Structured outputs**: JSON schemas for reliable parsing

### Edge AI ($5K)

- MedGemma 1.5 4B runs 100% locally
- No cloud API calls for inference
- Works offline after initial model download
- Tested on Apple Silicon (MPS backend)

## Conclusion

MedLit Agent demonstrates that local, privacy-preserving AI can deliver clinical-grade evidence synthesis. The multi-model consensus approach—combining a primary clinician with a skeptical reviewer—produces more balanced recommendations than single-model systems.

By running entirely on-device with MedGemma 1.5 4B, MedLit Agent solves the privacy paradox that has limited AI adoption in healthcare: getting AI assistance without exposing patient data to third parties.

---

**Repository**: [github.com/noam1/research-synthesizer](https://github.com/noam1/research-synthesizer)

**Demo**: `./scripts/demo.sh` → http://localhost:3000
