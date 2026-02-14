"""Anchored evaluator for calibrated research assessment.

This module implements an evaluation system inspired by Idea2Paper's anchored
multi-agent review. Instead of arbitrary scoring, we compare target research
against anchor papers with known scores to produce calibrated ratings.
"""

from dataclasses import dataclass, field
from enum import Enum

import structlog

from src.evaluation.anchors import AnchorPaper, AnchorStore, get_anchor_store
from src.gemini.client import get_gemini_client

logger = structlog.get_logger()


class ComparisonResult(str, Enum):
    """Result of comparing target to anchor."""

    BETTER = "better"
    SIMILAR = "similar"
    WORSE = "worse"


@dataclass
class AnchorComparison:
    """Comparison result against a single anchor."""

    anchor_id: str
    anchor_title: str
    anchor_score: float
    comparison: ComparisonResult
    reasoning: str
    confidence: float = 0.7


@dataclass
class EvaluationResult:
    """Result of anchored evaluation."""

    # Calibrated scores (1-10 scale)
    overall_score: float
    novelty_score: float
    methodology_score: float
    clarity_score: float
    significance_score: float

    # Comparison details
    anchor_comparisons: list[AnchorComparison] = field(default_factory=list)

    # Explanation
    summary: str = ""
    strengths: list[str] = field(default_factory=list)
    weaknesses: list[str] = field(default_factory=list)

    # Confidence
    confidence: float = 0.7


class AnchoredEvaluator:
    """Evaluates research by comparing against anchor papers.

    This produces calibrated, auditable scores by grounding evaluations
    in real papers with known quality rather than arbitrary LLM judgments.
    """

    def __init__(
        self,
        anchor_store: AnchorStore | None = None,
    ):
        self.anchor_store = anchor_store or get_anchor_store()
        self.gemini = get_gemini_client()

    async def evaluate_paper(
        self,
        title: str,
        abstract: str,
        full_text: str | None = None,
        num_anchors: int = 3,
    ) -> EvaluationResult:
        """Evaluate a paper using anchored comparison.

        Args:
            title: Paper title
            abstract: Paper abstract
            full_text: Optional full paper text for deeper analysis
            num_anchors: Number of anchor papers to compare against

        Returns:
            EvaluationResult with calibrated scores
        """
        # Initialize anchor store
        await self.anchor_store.initialize()

        # Find most similar anchors for fair comparison
        similar_anchors = await self.anchor_store.find_similar_anchors(
            title=title,
            abstract=abstract,
            limit=num_anchors,
        )

        if not similar_anchors:
            logger.warning("No anchor papers found for comparison")
            return EvaluationResult(
                overall_score=5.0,
                novelty_score=5.0,
                methodology_score=5.0,
                clarity_score=5.0,
                significance_score=5.0,
                summary="Could not find suitable anchor papers for comparison",
                confidence=0.3,
            )

        # Compare against each anchor using LLM
        comparisons = []
        for anchor, _similarity in similar_anchors:
            comparison = await self._compare_to_anchor(
                target_title=title,
                target_abstract=abstract,
                target_text=full_text,
                anchor=anchor,
            )
            comparisons.append(comparison)

        # Calibrate scores based on comparisons
        result = self._calibrate_scores(comparisons)

        logger.info(
            "Paper evaluation complete",
            title=title[:50],
            overall_score=result.overall_score,
            num_anchors=len(comparisons),
        )

        return result

    async def _compare_to_anchor(
        self,
        target_title: str,
        target_abstract: str,
        target_text: str | None,
        anchor: AnchorPaper,
    ) -> AnchorComparison:
        """Compare target paper against a single anchor."""

        target_content = f"Title: {target_title}\n\nAbstract: {target_abstract}"
        if target_text:
            target_content += f"\n\nContent: {target_text[:3000]}"

        prompt = f"""Compare this TARGET paper against the ANCHOR paper.

TARGET PAPER:
{target_content}

ANCHOR PAPER (Known Score: {anchor.overall_score}/10):
Title: {anchor.title}
Abstract: {anchor.abstract}
Venue: {anchor.venue}

For each dimension, indicate if the TARGET is BETTER, SIMILAR, or WORSE than the ANCHOR:

1. NOVELTY: How original is the contribution?
2. METHODOLOGY: How rigorous and sound is the approach?
3. CLARITY: How well-written and understandable?
4. SIGNIFICANCE: How important is the contribution to the field?

Respond with JSON:
{{
  "overall_comparison": "better|similar|worse",
  "novelty_comparison": "better|similar|worse",
  "methodology_comparison": "better|similar|worse",
  "clarity_comparison": "better|similar|worse",
  "significance_comparison": "better|similar|worse",
  "reasoning": "Brief explanation of the comparison",
  "confidence": 0.8
}}

Be calibrated - the anchor paper ({anchor.title[:50]}...) scored {anchor.overall_score}/10.
Most papers are NOT better than landmark papers like Transformers or BERT."""

        result = await self.gemini.generate(
            prompt=prompt,
            schema={"type": "object"},
            operation="anchor_comparison",
            max_output_tokens=1024,
        )

        content = result.get("content", {})
        if isinstance(content, str):
            content = {}

        overall = content.get("overall_comparison", "similar")
        try:
            comparison = ComparisonResult(overall.lower())
        except ValueError:
            comparison = ComparisonResult.SIMILAR

        return AnchorComparison(
            anchor_id=anchor.id,
            anchor_title=anchor.title,
            anchor_score=anchor.overall_score,
            comparison=comparison,
            reasoning=content.get("reasoning", ""),
            confidence=content.get("confidence", 0.7),
        )

    def _calibrate_scores(
        self,
        comparisons: list[AnchorComparison],
    ) -> EvaluationResult:
        """Calibrate final scores based on anchor comparisons.

        Uses the anchor scores as reference points:
        - BETTER than anchor -> score above anchor's score
        - SIMILAR to anchor -> score near anchor's score
        - WORSE than anchor -> score below anchor's score
        """
        if not comparisons:
            return EvaluationResult(
                overall_score=5.0,
                novelty_score=5.0,
                methodology_score=5.0,
                clarity_score=5.0,
                significance_score=5.0,
                confidence=0.3,
            )

        # Calculate weighted score based on comparisons
        total_weight = 0
        weighted_score = 0
        strengths = []
        weaknesses = []

        for comp in comparisons:
            weight = comp.confidence

            # Adjust score based on comparison
            if comp.comparison == ComparisonResult.BETTER:
                # Score is above anchor (but capped at 10)
                adjustment = min(1.5, 10 - comp.anchor_score)
                score = min(10.0, comp.anchor_score + adjustment)
                strengths.append(f"Better than {comp.anchor_title[:40]}...")
            elif comp.comparison == ComparisonResult.SIMILAR:
                # Score is near anchor
                score = comp.anchor_score
            else:  # WORSE
                # Score is below anchor (but floored at 1)
                adjustment = min(1.5, comp.anchor_score - 1)
                score = max(1.0, comp.anchor_score - adjustment)
                weaknesses.append(f"Below {comp.anchor_title[:40]}...")

            weighted_score += score * weight
            total_weight += weight

        if total_weight == 0:
            final_score = 5.0
        else:
            final_score = weighted_score / total_weight

        # Generate summary
        avg_anchor_score = sum(c.anchor_score for c in comparisons) / len(comparisons)
        if final_score >= avg_anchor_score + 0.5:
            summary = "Paper demonstrates strong contributions compared to reference works"
        elif final_score >= avg_anchor_score - 0.5:
            summary = "Paper is comparable in quality to reference works"
        else:
            summary = "Paper shows room for improvement compared to reference works"

        # For now, use overall score for all dimensions
        # In a full implementation, we'd track per-dimension comparisons
        return EvaluationResult(
            overall_score=round(final_score, 1),
            novelty_score=round(final_score, 1),
            methodology_score=round(final_score, 1),
            clarity_score=round(final_score, 1),
            significance_score=round(final_score, 1),
            anchor_comparisons=comparisons,
            summary=summary,
            strengths=strengths,
            weaknesses=weaknesses,
            confidence=sum(c.confidence for c in comparisons) / len(comparisons),
        )

    async def evaluate_technique(
        self,
        name: str,
        description: str,
        formula: str | None = None,
        pseudocode: str | None = None,
    ) -> EvaluationResult:
        """Evaluate a technique using anchored comparison.

        Compares against well-known techniques from anchor papers.
        """
        await self.anchor_store.initialize()

        # Build technique description
        tech_desc = f"{name}: {description}"
        if formula:
            tech_desc += f"\nFormula: {formula}"
        if pseudocode:
            tech_desc += f"\nPseudocode: {pseudocode}"

        # Get anchors for comparison
        anchors = self.anchor_store.get_all_anchors()[:3]

        if not anchors:
            return EvaluationResult(
                overall_score=5.0,
                novelty_score=5.0,
                methodology_score=5.0,
                clarity_score=5.0,
                significance_score=5.0,
                summary="No anchor techniques available for comparison",
                confidence=0.3,
            )

        prompt = f"""Evaluate this TECHNIQUE by comparing it to well-known techniques from landmark papers.

TECHNIQUE TO EVALUATE:
{tech_desc}

REFERENCE TECHNIQUES (from landmark papers):
1. Transformer Attention (score 10/10): Self-attention mechanism that computes weighted relationships between all positions
2. Residual Connections (score 9.5/10): Skip connections that enable training very deep networks
3. Layer Normalization (score 8/10): Normalizes activations across features for stable training

Rate the technique on a 1-10 scale for each dimension, calibrated against these references:
- Most techniques are NOT as impactful as self-attention (10/10)
- A solid incremental improvement might score 5-6/10
- A novel but not groundbreaking technique might score 7-8/10

Respond with JSON:
{{
  "overall_score": 6.5,
  "novelty_score": 7.0,
  "methodology_score": 6.0,
  "clarity_score": 7.0,
  "significance_score": 5.5,
  "summary": "Brief assessment",
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1"],
  "confidence": 0.8
}}"""

        result = await self.gemini.generate(
            prompt=prompt,
            schema={"type": "object"},
            operation="technique_evaluation",
            max_output_tokens=1024,
        )

        content = result.get("content", {})
        if isinstance(content, str):
            content = {}

        return EvaluationResult(
            overall_score=content.get("overall_score", 5.0),
            novelty_score=content.get("novelty_score", 5.0),
            methodology_score=content.get("methodology_score", 5.0),
            clarity_score=content.get("clarity_score", 5.0),
            significance_score=content.get("significance_score", 5.0),
            summary=content.get("summary", ""),
            strengths=content.get("strengths", []),
            weaknesses=content.get("weaknesses", []),
            confidence=content.get("confidence", 0.7),
        )

    async def evaluate_claim(
        self,
        statement: str,
        evidence: str | None = None,
        category: str | None = None,
    ) -> EvaluationResult:
        """Evaluate a claim using anchored comparison.

        Compares claim significance and support against claims from landmark papers.
        """
        prompt = f"""Evaluate this research CLAIM by comparing it to well-known claims from landmark papers.

CLAIM TO EVALUATE:
{statement}
{f"Evidence: {evidence}" if evidence else ""}
{f"Category: {category}" if category else ""}

REFERENCE CLAIMS (from landmark papers):
1. "Attention mechanism alone, without recurrence, achieves state-of-the-art translation" (Transformers, score 10/10)
2. "Pre-training on large corpus improves downstream task performance" (BERT, score 9/10)
3. "Residual connections enable training 100+ layer networks" (ResNet, score 9.5/10)
4. "Our method improves accuracy by 2% on benchmark X" (typical paper, score 5/10)

Rate the claim on a 1-10 scale:
- Groundbreaking claims that change the field: 9-10
- Novel claims with strong evidence: 7-8
- Solid incremental claims: 5-6
- Weak or unsupported claims: 1-4

Respond with JSON:
{{
  "overall_score": 6.0,
  "novelty_score": 6.5,
  "methodology_score": 6.0,
  "clarity_score": 7.0,
  "significance_score": 5.5,
  "summary": "Brief assessment of claim strength",
  "strengths": ["well-supported", "clear metric"],
  "weaknesses": ["limited scope"],
  "confidence": 0.75
}}"""

        result = await self.gemini.generate(
            prompt=prompt,
            schema={"type": "object"},
            operation="claim_evaluation",
            max_output_tokens=1024,
        )

        content = result.get("content", {})
        if isinstance(content, str):
            content = {}

        return EvaluationResult(
            overall_score=content.get("overall_score", 5.0),
            novelty_score=content.get("novelty_score", 5.0),
            methodology_score=content.get("methodology_score", 5.0),
            clarity_score=content.get("clarity_score", 5.0),
            significance_score=content.get("significance_score", 5.0),
            summary=content.get("summary", ""),
            strengths=content.get("strengths", []),
            weaknesses=content.get("weaknesses", []),
            confidence=content.get("confidence", 0.7),
        )


# Singleton instance
_evaluator: AnchoredEvaluator | None = None


def get_anchored_evaluator() -> AnchoredEvaluator:
    """Get or create the anchored evaluator singleton."""
    global _evaluator
    if _evaluator is None:
        _evaluator = AnchoredEvaluator()
    return _evaluator
