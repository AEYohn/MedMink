"""Training utilities for optimizing DSPy analysis modules.

This module provides utilities to:
- Generate training examples from existing analyses
- Create synthetic training data from papers
- Evaluate and score extraction quality
"""

import json
from pathlib import Path

import dspy
import structlog

from src.dspy_analysis.signatures import (
    ExtractedClaim,
    ExtractedMethod,
    ExtractedTechnique,
    PaperAnalysisResult,
)

logger = structlog.get_logger()


# Example high-quality analyses for bootstrapping
SEED_EXAMPLES = [
    {
        "paper_title": "Attention Is All You Need",
        "paper_abstract": "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.",
        "paper_full_text": """
        === METHODS SECTION ===
        The Transformer uses multi-head attention which allows the model to jointly attend to information from different representation subspaces at different positions.

        MultiHead(Q, K, V) = Concat(head_1, ..., head_h)W^O
        where head_i = Attention(QW_i^Q, KW_i^K, VW_i^V)

        Scaled Dot-Product Attention:
        Attention(Q, K, V) = softmax(QK^T / sqrt(d_k))V

        We employ residual connections around each of the two sub-layers, followed by layer normalization.
        """,
        "expected_analysis": {
            "summary": "Introduces the Transformer architecture that relies entirely on self-attention mechanisms, eliminating recurrence and convolutions while achieving state-of-the-art results on translation tasks.",
            "claims": [
                {
                    "statement": "The Transformer achieves 28.4 BLEU on English-to-German translation, surpassing existing models including ensembles",
                    "category": "performance",
                    "confidence": 0.95,
                    "evidence": "BLEU scores reported in Table 2",
                },
                {
                    "statement": "The Transformer requires significantly less time to train than architectures based on recurrent or convolutional layers",
                    "category": "performance",
                    "confidence": 0.9,
                    "evidence": "Training time comparison in Section 6",
                },
            ],
            "methods": [
                {
                    "name": "Transformer",
                    "description": "Neural network architecture based entirely on attention mechanisms without recurrence",
                    "is_novel": True,
                }
            ],
            "techniques": [
                {
                    "name": "Scaled Dot-Product Attention",
                    "technique_type": "architecture",
                    "description": "Computes attention weights by scaling dot products of queries and keys, then applying softmax and multiplying with values",
                    "formula": "\\text{Attention}(Q,K,V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V",
                    "pseudocode": "Algorithm: Scaled Dot-Product Attention\nInput: Q (queries), K (keys), V (values), d_k (key dimension)\n1. Compute attention scores: scores = Q @ K.T\n2. Scale by sqrt(d_k): scores = scores / sqrt(d_k)\n3. Apply softmax: weights = softmax(scores, dim=-1)\n4. Apply attention: output = weights @ V\n5. return output",
                    "implementation_notes": "Use torch.nn.functional.scaled_dot_product_attention for FlashAttention optimization. d_k is typically 64 when using 512 hidden dim with 8 heads.",
                    "is_novel": True,
                    "improves_upon": "Additive attention (Bahdanau)",
                },
                {
                    "name": "Multi-Head Attention",
                    "technique_type": "architecture",
                    "description": "Runs multiple attention heads in parallel, then concatenates and projects the results",
                    "formula": "\\text{MultiHead}(Q,K,V) = \\text{Concat}(\\text{head}_1, ..., \\text{head}_h)W^O \\text{ where } \\text{head}_i = \\text{Attention}(QW_i^Q, KW_i^K, VW_i^V)",
                    "pseudocode": "Algorithm: Multi-Head Attention\nInput: Q, K, V, num_heads h, model dim d_model\n1. d_k = d_model / h\n2. For i in 1..h:\n   a. Q_i = Q @ W_i^Q  # Project queries\n   b. K_i = K @ W_i^K  # Project keys\n   c. V_i = V @ W_i^V  # Project values\n   d. head_i = Attention(Q_i, K_i, V_i)\n3. Concat all heads: multi = Concat(head_1, ..., head_h)\n4. Final projection: output = multi @ W^O\n5. return output",
                    "implementation_notes": "Use 8 heads with d_model=512. Initialize projection weights with Xavier uniform. Apply dropout=0.1 after attention weights.",
                    "is_novel": True,
                    "improves_upon": "Single-head attention",
                },
            ],
            "keywords": [
                "transformer",
                "attention",
                "self-attention",
                "neural machine translation",
            ],
            "confidence_overall": 0.95,
        },
    },
    {
        "paper_title": "BERT: Pre-training of Deep Bidirectional Transformers",
        "paper_abstract": "We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers.",
        "paper_full_text": """
        === METHODS SECTION ===
        Pre-training BERT:
        We pre-train BERT using two unsupervised tasks:

        Task #1: Masked LM (MLM)
        We randomly mask 15% of all WordPiece tokens in each sequence, and then predict only those masked tokens.

        L_MLM = -sum(log P(x_masked | context))

        Task #2: Next Sentence Prediction (NSP)
        Given two sentences A and B, predict whether B is the actual next sentence that follows A.
        """,
        "expected_analysis": {
            "summary": "BERT introduces bidirectional pre-training for language models using masked language modeling and next sentence prediction, achieving state-of-the-art results on 11 NLP tasks.",
            "claims": [
                {
                    "statement": "BERT obtains 80.5% accuracy on GLUE benchmark, a 7.7% absolute improvement over previous state-of-the-art",
                    "category": "performance",
                    "confidence": 0.95,
                    "evidence": "Results in Table 1",
                }
            ],
            "methods": [
                {
                    "name": "BERT",
                    "description": "Bidirectional transformer encoder pre-trained on masked language modeling and next sentence prediction",
                    "is_novel": True,
                }
            ],
            "techniques": [
                {
                    "name": "Masked Language Modeling (MLM)",
                    "technique_type": "training_technique",
                    "description": "Pre-training objective that randomly masks tokens and trains the model to predict them",
                    "formula": "\\mathcal{L}_{\\text{MLM}} = -\\sum_{i \\in \\text{masked}} \\log P(x_i | x_{\\backslash i})",
                    "pseudocode": "Algorithm: Masked Language Modeling\nInput: sequence x, mask_ratio=0.15\n1. Select 15% of tokens randomly as mask_positions\n2. For each position in mask_positions:\n   a. 80% chance: replace with [MASK]\n   b. 10% chance: replace with random token\n   c. 10% chance: keep original\n3. Forward pass through BERT encoder\n4. Compute cross-entropy loss only at masked positions\n5. return loss",
                    "implementation_notes": "Mask 15% of tokens. Of masked tokens: 80% [MASK], 10% random, 10% unchanged. Use WordPiece tokenization.",
                    "is_novel": True,
                    "improves_upon": "Left-to-right language modeling",
                }
            ],
            "keywords": ["BERT", "pre-training", "masked language model", "NLP"],
            "confidence_overall": 0.9,
        },
    },
]


def create_training_examples() -> list[dspy.Example]:
    """Create DSPy training examples from seed data.

    Returns:
        List of DSPy Example objects ready for optimization
    """
    examples = []

    for data in SEED_EXAMPLES:
        # Convert expected analysis to PaperAnalysisResult
        expected = data["expected_analysis"]

        techniques = [
            ExtractedTechnique(
                name=t["name"],
                technique_type=t["technique_type"],
                description=t["description"],
                formula=t.get("formula"),
                pseudocode=t.get("pseudocode"),
                implementation_notes=t.get("implementation_notes"),
                is_novel=t.get("is_novel", False),
                improves_upon=t.get("improves_upon"),
            )
            for t in expected.get("techniques", [])
        ]

        claims = [
            ExtractedClaim(
                statement=c["statement"],
                category=c["category"],
                confidence=c["confidence"],
                evidence=c.get("evidence"),
            )
            for c in expected.get("claims", [])
        ]

        methods = [
            ExtractedMethod(
                name=m["name"],
                description=m["description"],
                is_novel=m.get("is_novel", False),
            )
            for m in expected.get("methods", [])
        ]

        analysis = PaperAnalysisResult(
            summary=expected["summary"],
            claims=claims,
            methods=methods,
            techniques=techniques,
            keywords=expected.get("keywords", []),
            confidence_overall=expected.get("confidence_overall", 0.8),
        )

        example = dspy.Example(
            paper_title=data["paper_title"],
            paper_abstract=data["paper_abstract"],
            paper_full_text=data.get("paper_full_text", ""),
            analysis=analysis,
        ).with_inputs("paper_title", "paper_abstract", "paper_full_text")

        examples.append(example)

    logger.info("Created training examples", count=len(examples))
    return examples


def extraction_quality_metric(example: dspy.Example, pred: dspy.Prediction, trace=None) -> float:
    """Evaluate the quality of extraction.

    Scores based on:
    - Presence of formulas in techniques (0.3)
    - Presence of pseudocode (0.2)
    - Presence of implementation notes (0.2)
    - Number of techniques extracted (0.15)
    - Number of claims extracted (0.15)

    Returns:
        Score between 0 and 1
    """
    analysis = pred.analysis
    score = 0.0

    # Formula extraction (most important for actionability)
    techniques_with_formula = sum(1 for t in analysis.techniques if t.formula)
    total_techniques = len(analysis.techniques) or 1
    formula_score = min(techniques_with_formula / total_techniques, 1.0)
    score += formula_score * 0.3

    # Pseudocode extraction
    techniques_with_pseudocode = sum(1 for t in analysis.techniques if t.pseudocode)
    pseudocode_score = min(techniques_with_pseudocode / total_techniques, 1.0)
    score += pseudocode_score * 0.2

    # Implementation notes
    techniques_with_notes = sum(1 for t in analysis.techniques if t.implementation_notes)
    notes_score = min(techniques_with_notes / total_techniques, 1.0)
    score += notes_score * 0.2

    # Number of techniques (diminishing returns after 3)
    technique_count_score = min(len(analysis.techniques) / 3, 1.0)
    score += technique_count_score * 0.15

    # Number of claims (diminishing returns after 5)
    claim_count_score = min(len(analysis.claims) / 5, 1.0)
    score += claim_count_score * 0.15

    return score


def save_training_data(examples: list[dspy.Example], path: str):
    """Save training examples to a JSON file.

    Args:
        examples: List of DSPy examples
        path: Path to save to
    """
    data = []
    for ex in examples:
        data.append(
            {
                "paper_title": ex.paper_title,
                "paper_abstract": ex.paper_abstract,
                "paper_full_text": ex.paper_full_text,
                "analysis": (
                    ex.analysis.model_dump()
                    if hasattr(ex.analysis, "model_dump")
                    else dict(ex.analysis)
                ),
            }
        )

    Path(path).write_text(json.dumps(data, indent=2))
    logger.info("Saved training data", path=path, count=len(data))


def load_training_data(path: str) -> list[dspy.Example]:
    """Load training examples from a JSON file.

    Args:
        path: Path to load from

    Returns:
        List of DSPy examples
    """
    data = json.loads(Path(path).read_text())
    examples = []

    for item in data:
        expected = item["analysis"]

        techniques = [ExtractedTechnique(**t) for t in expected.get("techniques", [])]
        claims = [ExtractedClaim(**c) for c in expected.get("claims", [])]
        methods = [ExtractedMethod(**m) for m in expected.get("methods", [])]

        analysis = PaperAnalysisResult(
            summary=expected["summary"],
            claims=claims,
            methods=methods,
            techniques=techniques,
            keywords=expected.get("keywords", []),
            confidence_overall=expected.get("confidence_overall", 0.8),
        )

        example = dspy.Example(
            paper_title=item["paper_title"],
            paper_abstract=item["paper_abstract"],
            paper_full_text=item.get("paper_full_text", ""),
            analysis=analysis,
        ).with_inputs("paper_title", "paper_abstract", "paper_full_text")

        examples.append(example)

    logger.info("Loaded training data", path=path, count=len(examples))
    return examples


async def generate_training_example_from_analysis(
    paper_id: str,
    kg,
    expected_techniques: list[dict],
) -> dspy.Example | None:
    """Generate a training example from an existing paper analysis.

    This allows you to curate high-quality examples from your existing
    knowledge graph to improve extraction.

    Args:
        paper_id: ID of the paper in the knowledge graph
        kg: Knowledge graph instance
        expected_techniques: List of technique dicts with formulas/pseudocode

    Returns:
        DSPy Example if successful, None otherwise
    """
    try:
        paper = await kg.get_paper(paper_id)
        if not paper:
            return None

        claims = await kg.get_claims_for_paper(paper_id)
        methods = await kg.get_methods_for_paper(paper_id)

        # Build the expected analysis
        techniques = [
            ExtractedTechnique(
                name=t["name"],
                technique_type=t.get("type", "other"),
                description=t.get("description", ""),
                formula=t.get("formula"),
                pseudocode=t.get("pseudocode"),
                implementation_notes=t.get("implementation_notes"),
                is_novel=t.get("is_novel", False),
                improves_upon=t.get("improves_upon"),
            )
            for t in expected_techniques
        ]

        claim_objs = [
            ExtractedClaim(
                statement=c.statement,
                category=c.category,
                confidence=c.confidence,
                evidence=c.evidence,
            )
            for c in claims[:5]  # Limit to 5 claims
        ]

        method_objs = [
            ExtractedMethod(
                name=m.name,
                description=m.description,
                is_novel=m.is_novel,
            )
            for m in methods[:3]  # Limit to 3 methods
        ]

        analysis = PaperAnalysisResult(
            summary=f"Analysis of {paper.title}",
            claims=claim_objs,
            methods=method_objs,
            techniques=techniques,
            keywords=paper.categories,
            confidence_overall=0.85,
        )

        example = dspy.Example(
            paper_title=paper.title,
            paper_abstract=paper.abstract or "",
            paper_full_text="",  # Would need PDF extraction
            analysis=analysis,
        ).with_inputs("paper_title", "paper_abstract", "paper_full_text")

        return example

    except Exception as e:
        logger.error("Failed to generate training example", paper_id=paper_id, error=str(e))
        return None
