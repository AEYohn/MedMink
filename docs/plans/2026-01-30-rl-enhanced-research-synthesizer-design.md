# RL-Enhanced Research Synthesizer Design

**Date**: 2026-01-30
**Status**: Approved
**Approach**: Hybrid (pretrain in simulation, fine-tune online)

## Overview

This design adds reinforcement learning capabilities to the Research Synthesizer across four targets:
1. Claim extraction quality
2. Prediction accuracy
3. Contradiction detection
4. Pipeline orchestration

Plus four architectural improvements:
- Embedding layer for semantic similarity (FAISS)
- Active learning for human review prioritization
- Multi-model ensemble for extraction
- Citation graph integration via Semantic Scholar

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    RL-ENHANCED RESEARCH SYNTHESIZER                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         SIMULATION ENVIRONMENT                           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │   │
│  │  │ Synthetic    │  │ Paper Graph  │  │ Outcome      │                   │   │
│  │  │ Paper Gen    │  │ Simulator    │  │ Oracle       │                   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                            │
│                                    ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         RL TRAINING LAYER                                │   │
│  │                                                                          │   │
│  │  ┌─────────────────────────┐    ┌─────────────────────────┐             │   │
│  │  │   TRL Policy Models     │    │  Orchestration Agent    │             │   │
│  │  │  ┌─────────────────┐    │    │  (Ray RLlib / CleanRL)  │             │   │
│  │  │  │ Claim Extractor │    │    │                         │             │   │
│  │  │  │ Predictor       │    │    │  Actions: task_select,  │             │   │
│  │  │  │ Contradiction   │    │    │  batch_size, priority,  │             │   │
│  │  │  └─────────────────┘    │    │  escalate, budget_alloc │             │   │
│  │  └─────────────────────────┘    └─────────────────────────┘             │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                            │
│                                    ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                      PRODUCTION PIPELINE (existing)                      │   │
│  │   Ingest → Analyze → Contradictions → Trends → Predictions → Synthesis  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                            │
│                                    ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         FEEDBACK COLLECTION                              │   │
│  │   Human Reviews │ Prediction Outcomes │ Usage Metrics │ Cost Tracking   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                            │
│                                    └──────────► Replay Buffer / Fine-tuning    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## RL Framework Split

- **TRL (GRPO/PPO)** for language-based tasks: claim extraction, prediction generation, contradiction detection
- **Classic RL (CleanRL PPO)** for orchestration: task selection, resource allocation, escalation decisions

## Reward Functions

### Language Tasks (TRL)

#### Claim Extraction
```
R_claim = 0.35 × downstream_utility    # Claim used in contradiction/trend
        + 0.30 × human_approval        # Binary: approved in review
        + 0.20 × confidence_calibration # |predicted_conf - actual_accuracy|
        + 0.15 × novelty_score         # Semantic distance from existing claims
```

#### Prediction Accuracy
```
R_prediction = 0.40 × calibration_reward   # -|confidence - outcome_rate|
             + 0.30 × outcome_binary       # 1.0 correct, 0.5 partial, 0.0 wrong
             + 0.20 × reasoning_quality    # Human rating of reasoning chain
             + 0.10 × timeliness           # Bonus for shorter timeframes
```

#### Contradiction Detection
```
R_contradiction = 0.40 × human_verification  # Confirmed real contradiction
                + 0.30 × resolution_value    # Led to updated claim status
                + 0.20 × precision_penalty   # -0.5 per false positive
                + 0.10 × novelty             # Cross-domain contradictions bonus
```

### Orchestration (Classic RL)
```
R_orchestration = 0.30 × discovery_rate      # Novel findings per cycle
                + 0.25 × cost_efficiency     # Useful outputs / Gemini $ spent
                + 0.20 × calibration_trend   # Δ in prediction accuracy over time
                + 0.15 × throughput          # Papers processed (diminishing returns)
                + 0.10 × human_load_balance  # Penalty for review queue > threshold
```

## Simulation Environment

### Synthetic Paper Generator

Generates fake-but-plausible papers with known ground truth:

```python
class SyntheticPaperGenerator:
    """Generates papers with embedded ground-truth claims/contradictions."""

    archetypes = [
        "incremental_improvement",
        "novel_method",
        "negative_result",
        "survey_synthesis",
        "paradigm_challenge",
    ]

    def generate_batch(self, n: int, contradiction_rate: float = 0.15):
        """Generate n papers, some with intentional contradictions."""
```

Uses Llama 3 8B or Gemma 2 9B to generate abstracts. Ground truth embedded at generation time.

### Outcome Oracle

Simulates future prediction outcomes without waiting months:

```python
class OutcomeOracle:
    """Determines simulated prediction outcomes based on trend trajectories."""

    def resolve_prediction(self, prediction, simulated_future_state):
        return PredictionOutcome, confidence_was_calibrated
```

### Human Review Simulator

```python
class ReviewSimulator:
    """Simulates human approval/rejection based on quality heuristics."""

    def review_claim(self, claim, ground_truth):
        # Factors: matches ground truth, confidence appropriate, noise
```

## TRL Policy Models

### Architecture

Base model: Qwen2.5-7B-Instruct or Llama-3.1-8B
Fine-tuning: TRL with GRPO (Group Relative Policy Optimization)

```python
class ClaimExtractionPolicy(nn.Module):
    """Policy for extracting claims from paper abstracts."""

    def __init__(self, base_model="Qwen/Qwen2.5-7B-Instruct"):
        self.model = AutoModelForCausalLM.from_pretrained(base_model)
        self.tokenizer = AutoTokenizer.from_pretrained(base_model)

class PredictionPolicy(nn.Module):
    """Policy for generating falsifiable predictions."""

class ContradictionPolicy(nn.Module):
    """Policy for scoring claim pairs as contradictions."""
```

### Training Configuration

```python
from trl import GRPOTrainer, GRPOConfig

config = GRPOConfig(
    num_generations=4,
    max_new_tokens=512,
    learning_rate=1e-6,
    kl_coef=0.05,
    reward_model=None,
)
```

## Orchestration Agent

### State Space

```python
@dataclass
class OrchestratorState:
    # Queue status
    pending_papers: int
    pending_analysis: int
    review_queue_depth: int

    # Resource status
    daily_budget_remaining: float
    gemini_calls_today: int

    # Performance signals
    recent_claim_quality: float
    recent_prediction_calibration: float
    contradiction_precision_7d: float

    # Time features
    hour_of_day: int
    day_of_week: int
    days_since_last_synthesis: int
```

### Action Space

```python
class OrchestratorAction(Enum):
    RUN_INGEST = "ingest"
    RUN_ANALYZE = "analyze"
    RUN_CONTRADICTIONS = "detect_contradictions"
    RUN_TRENDS = "identify_trends"
    RUN_PREDICTIONS = "generate_predictions"
    RUN_SYNTHESIS = "synthesize"
    SKIP_CYCLE = "skip"
    ESCALATE_REVIEW = "escalate"
    ADJUST_BATCH_UP = "batch_up"
    ADJUST_BATCH_DOWN = "batch_down"
```

### Agent Implementation

```python
class OrchestrationAgent:
    """PPO agent for pipeline orchestration."""

    def __init__(self, state_dim=12, action_dim=10):
        self.policy = nn.Sequential(
            nn.Linear(state_dim, 128),
            nn.ReLU(),
            nn.Linear(128, 128),
            nn.ReLU(),
            nn.Linear(128, action_dim),
        )
        self.value = nn.Sequential(
            nn.Linear(state_dim, 128),
            nn.ReLU(),
            nn.Linear(128, 1),
        )
```

## Architectural Improvements

### 1. Embedding Layer (FAISS)

Reduces O(n²) contradiction checks:

```python
class ClaimEmbeddingIndex:
    """FAISS index for fast semantic claim retrieval."""

    def __init__(self, model="BAAI/bge-base-en-v1.5"):
        self.encoder = SentenceTransformer(model)
        self.index = faiss.IndexFlatIP(768)
        self.claim_ids: list[str] = []

    def find_contradiction_candidates(self, claim: Claim, k: int = 50) -> list[str]:
        embedding = self.encoder.encode(claim.statement)
        scores, indices = self.index.search(embedding.reshape(1, -1), k)
        return [self.claim_ids[i] for i, s in zip(indices[0], scores[0]) if s > 0.6]
```

Expected: ~80% reduction in Gemini calls for contradiction detection.

### 2. Active Learning for Human Review

```python
class ActiveReviewSelector:
    """Selects items for human review to maximize learning signal."""

    def compute_review_priority(self, item, policy_output) -> float:
        entropy = -sum(p * log(p) for p in policy_output.probs)
        disagreement = self.compute_ensemble_disagreement(item)
        gradient_magnitude = self.estimate_gradient_norm(item)

        return 0.4 * entropy + 0.35 * disagreement + 0.25 * gradient_magnitude
```

### 3. Multi-Model Ensemble

```python
class EnsembleExtractor:
    """Ensemble of extraction models for higher precision."""

    def __init__(self):
        self.models = [
            ClaimExtractionPolicy("Qwen/Qwen2.5-7B-Instruct"),
            ClaimExtractionPolicy("meta-llama/Llama-3.1-8B-Instruct"),
        ]

    def extract_claims(self, paper: Paper) -> list[Claim]:
        all_claims = [m.extract(paper) for m in self.models]
        return self.find_consensus(all_claims, threshold=2)
```

### 4. Citation Graph Integration

```python
class CitationGraphEnricher:
    """Enriches knowledge graph with citation relationships."""

    async def fetch_citations(self, arxiv_id: str) -> list[str]:
        """Get papers this paper cites via Semantic Scholar API."""

    async def enrich_claim_support(self, claim: Claim, paper: Paper):
        """Find if cited papers support or refute this claim."""
```

## Online Fine-Tuning

### Feedback Collection

```python
class FeedbackCollector:
    """Collects real-world signals for online RL updates."""

    def __init__(self, db: AsyncSession, kg: KnowledgeGraph):
        self.replay_buffer = ReplayBuffer(max_size=50_000)

    async def collect_claim_feedback(self):
        """Gather reward signals for claim extraction."""

    async def collect_prediction_feedback(self):
        """Gather reward signals from resolved predictions."""
```

### Update Schedule

- Weekly policy updates from replay buffer
- Minimum 500 new experiences before update
- Safety rails: 15% degradation threshold triggers rollback

## Project Structure

```
src/
├── rl/
│   ├── policies/
│   │   ├── claim_policy.py
│   │   ├── prediction_policy.py
│   │   └── contradiction_policy.py
│   ├── orchestrator/
│   │   ├── agent.py
│   │   ├── state.py
│   │   └── actions.py
│   ├── rewards/
│   │   ├── claim_reward.py
│   │   ├── prediction_reward.py
│   │   ├── contradiction_reward.py
│   │   └── orchestration_reward.py
│   ├── training/
│   │   ├── grpo_trainer.py
│   │   ├── ppo_trainer.py
│   │   ├── replay_buffer.py
│   │   └── online_trainer.py
│   └── config.py
│
├── simulation/
│   ├── paper_generator.py
│   ├── outcome_oracle.py
│   ├── review_simulator.py
│   ├── environment.py
│   └── scenarios/
│
├── improvements/
│   ├── embeddings/
│   ├── active_learning/
│   ├── ensemble/
│   └── citations/
│
└── feedback/
    ├── collector.py
    └── safety.py
```

## Dependencies

```toml
trl = ">=0.9.0"
transformers = ">=4.40.0"
peft = ">=0.11.0"
faiss-cpu = ">=1.8.0"
sentence-transformers = ">=3.0.0"
gymnasium = ">=0.29.0"
cleanrl = ">=1.0.0"
```

## Implementation Roadmap

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 1. Foundation | Week 1-2 | FAISS embedding index, 80% Gemini call reduction |
| 2. Simulation | Week 3-4 | Full sim environment, 1000 days in <10 min |
| 3. TRL Training | Week 5-7 | Trained policies matching Gemini quality |
| 4. Orchestration | Week 8-9 | PPO agent, 15%+ cost efficiency improvement |
| 5. Production | Week 10-11 | Shadow deployment, feedback collection live |
| 6. Improvements | Week 12-14 | All 4 improvements operational |

## Success Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| Contradiction precision | ~70% | 85%+ |
| Prediction calibration error | Unknown | < 0.15 |
| Gemini cost per useful output | $X | 0.5X |
| Claims used downstream | ~30% | 50%+ |
| Human review efficiency | Random | 2x signal/review |
