"""Multi-model consensus engine for MedGemma.

Runs clinical queries through multiple model perspectives to provide
consensus scoring and identify areas of disagreement.
"""

from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

import structlog

from src.medgemma.client import get_medgemma_client
from src.medgemma.prompts import CLINICAL_REASONING_SYSTEM

logger = structlog.get_logger()


class ConsensusStep(StrEnum):
    """Steps in the consensus pipeline."""
    PARSING = "parsing"
    PRIMARY_ANALYSIS = "primary_analysis"
    SKEPTICAL_REVIEW = "skeptical_review"
    EVIDENCE_SEARCH = "evidence_search"
    SYNTHESIS = "synthesis"
    CONSENSUS = "consensus"
    COMPLETE = "complete"


@dataclass
class StepUpdate:
    """Real-time update for a pipeline step."""
    step: ConsensusStep
    status: str  # "started", "progress", "completed", "error"
    message: str
    data: dict[str, Any] = field(default_factory=dict)
    progress: float = 0.0  # 0-1


@dataclass
class ModelPerspective:
    """A single model's perspective on a clinical question."""
    role: str  # "primary", "skeptical", "vision"
    synthesis: str
    evidence_grade: str
    recommendation: str
    confidence: float
    key_points: list[str]
    concerns: list[str]


@dataclass
class ConsensusResult:
    """Final consensus result from multiple model perspectives."""
    question: str
    pico: dict[str, str]

    # Individual perspectives
    primary: ModelPerspective
    skeptical: ModelPerspective
    vision: ModelPerspective | None = None

    # Consensus metrics
    agreement_score: float = 0.0  # 0-1, how much models agree
    consensus_grade: str = "moderate"
    divergence_points: list[str] = field(default_factory=list)

    # Final synthesis
    final_synthesis: str = ""
    final_recommendation: str = ""
    final_grade: str = "moderate"
    confidence: float = 0.5

    # Source data
    papers: list[dict] = field(default_factory=list)
    search_terms: list[str] = field(default_factory=list)


# Specialized prompts for different perspectives
PRIMARY_CLINICIAN_SYSTEM = """You are an experienced clinician providing evidence-based medical guidance.
Analyze the clinical question thoroughly, considering:
- Current best evidence from literature
- Clinical guidelines and standards of care
- Patient-centered outcomes
- Risk-benefit analysis

Be thorough but balanced. Acknowledge uncertainty where it exists."""

SKEPTICAL_REVIEWER_SYSTEM = """You are a critical medical reviewer playing devil's advocate.
Your role is to:
- Challenge assumptions in the clinical question
- Identify potential biases in the evidence
- Highlight contradictory findings
- Question the generalizability of results
- Point out limitations and caveats

Be constructively critical. Your skepticism improves the final recommendation."""

CONSENSUS_SYNTHESIS_PROMPT = """You have two medical perspectives on a clinical question:

**PRIMARY CLINICIAN VIEW:**
{primary_synthesis}
Evidence Grade: {primary_grade}
Recommendation: {primary_recommendation}
Key Points: {primary_points}

**SKEPTICAL REVIEWER VIEW:**
{skeptical_synthesis}
Evidence Grade: {skeptical_grade}
Concerns: {skeptical_concerns}

**CLINICAL QUESTION:** {question}

Synthesize these perspectives into a final, balanced recommendation that:
1. Acknowledges areas of agreement
2. Addresses the reviewer's concerns
3. Provides clear, actionable guidance
4. Calibrates confidence appropriately

Return JSON:
{{
    "agreement_score": 0.0-1.0,
    "divergence_points": ["point1", "point2"],
    "final_synthesis": "balanced synthesis...",
    "final_recommendation": "actionable recommendation...",
    "final_grade": "high|moderate|low|very_low",
    "confidence": 0.0-1.0
}}"""


class ConsensusEngine:
    """Multi-model consensus engine for clinical evidence synthesis."""

    def __init__(self):
        self.medgemma = get_medgemma_client()
        self._current_step = ConsensusStep.PARSING

    async def analyze_with_consensus(
        self,
        question: str,
        papers: list[dict],
        pico: dict[str, str],
        image_path: str | None = None,
    ) -> AsyncIterator[StepUpdate | ConsensusResult]:
        """Run consensus analysis with streaming updates.

        Yields StepUpdate objects during processing, then final ConsensusResult.
        """
        try:
            # Step 1: Primary analysis
            yield StepUpdate(
                step=ConsensusStep.PRIMARY_ANALYSIS,
                status="started",
                message="Primary clinician analyzing evidence...",
                progress=0.2
            )

            primary = await self._get_primary_perspective(question, papers, pico)

            yield StepUpdate(
                step=ConsensusStep.PRIMARY_ANALYSIS,
                status="completed",
                message=f"Primary analysis complete: {primary.evidence_grade} evidence",
                data={"grade": primary.evidence_grade, "confidence": primary.confidence},
                progress=0.4
            )

            # Step 2: Skeptical review
            yield StepUpdate(
                step=ConsensusStep.SKEPTICAL_REVIEW,
                status="started",
                message="Skeptical reviewer challenging findings...",
                progress=0.5
            )

            skeptical = await self._get_skeptical_perspective(question, papers, pico, primary)

            yield StepUpdate(
                step=ConsensusStep.SKEPTICAL_REVIEW,
                status="completed",
                message=f"Review complete: {len(skeptical.concerns)} concerns raised",
                data={"concerns": skeptical.concerns[:3]},
                progress=0.7
            )

            # Step 3: Vision analysis (if image provided)
            vision = None
            if image_path:
                yield StepUpdate(
                    step=ConsensusStep.SYNTHESIS,
                    status="started",
                    message="Analyzing medical image...",
                    progress=0.75
                )
                vision = await self._get_vision_perspective(image_path, question)
                yield StepUpdate(
                    step=ConsensusStep.SYNTHESIS,
                    status="completed",
                    message="Image analysis complete",
                    data={"findings": vision.key_points[:2] if vision else []},
                    progress=0.8
                )

            # Step 4: Consensus synthesis
            yield StepUpdate(
                step=ConsensusStep.CONSENSUS,
                status="started",
                message="Synthesizing consensus from all perspectives...",
                progress=0.85
            )

            result = await self._synthesize_consensus(
                question=question,
                pico=pico,
                primary=primary,
                skeptical=skeptical,
                vision=vision,
                papers=papers,
            )

            yield StepUpdate(
                step=ConsensusStep.CONSENSUS,
                status="completed",
                message=f"Consensus reached: {result.agreement_score:.0%} agreement",
                data={"agreement": result.agreement_score},
                progress=0.95
            )

            # Final result
            yield StepUpdate(
                step=ConsensusStep.COMPLETE,
                status="completed",
                message="Analysis complete",
                progress=1.0
            )

            yield result

        except Exception as e:
            logger.error("Consensus analysis failed", error=str(e))
            yield StepUpdate(
                step=self._current_step,
                status="error",
                message=f"Analysis failed: {str(e)}",
                progress=0.0
            )
            raise

    async def _get_primary_perspective(
        self,
        question: str,
        papers: list[dict],
        pico: dict[str, str],
    ) -> ModelPerspective:
        """Get primary clinician's perspective."""
        papers_text = self._format_papers(papers[:5])

        prompt = f"""Analyze this clinical question with the available evidence:

**Question:** {question}

**PICO Elements:**
- Population: {pico.get('population', 'Not specified')}
- Intervention: {pico.get('intervention', 'Not specified')}
- Comparison: {pico.get('comparison', 'Standard care')}
- Outcome: {pico.get('outcome', 'Not specified')}

**Available Evidence:**
{papers_text}

Provide your clinical assessment as JSON:
{{
    "synthesis": "your evidence synthesis...",
    "evidence_grade": "high|moderate|low|very_low",
    "recommendation": "clinical recommendation...",
    "confidence": 0.0-1.0,
    "key_points": ["point1", "point2", "point3"]
}}"""

        response = await self.medgemma.generate(
            prompt=prompt,
            system_prompt=PRIMARY_CLINICIAN_SYSTEM,
            temperature=0.3,
            max_tokens=1500,
        )

        try:
            data = self.medgemma._parse_json_response(response)
            return ModelPerspective(
                role="primary",
                synthesis=data.get("synthesis", ""),
                evidence_grade=data.get("evidence_grade", "moderate"),
                recommendation=data.get("recommendation", ""),
                confidence=float(data.get("confidence", 0.5)),
                key_points=data.get("key_points", []),
                concerns=[],
            )
        except Exception as e:
            logger.warning("Failed to parse primary response", error=str(e))
            return ModelPerspective(
                role="primary",
                synthesis=response[:500],
                evidence_grade="moderate",
                recommendation="Review primary literature",
                confidence=0.4,
                key_points=[],
                concerns=[],
            )

    async def _get_skeptical_perspective(
        self,
        question: str,
        papers: list[dict],
        pico: dict[str, str],
        primary: ModelPerspective,
    ) -> ModelPerspective:
        """Get skeptical reviewer's perspective."""
        prompt = f"""Review this clinical assessment critically:

**Clinical Question:** {question}

**Primary Assessment:**
- Synthesis: {primary.synthesis}
- Evidence Grade: {primary.evidence_grade}
- Recommendation: {primary.recommendation}
- Key Points: {', '.join(primary.key_points)}

**Your Task:** Challenge this assessment. Identify:
1. Potential biases in interpretation
2. Limitations of the evidence
3. Alternative explanations
4. What could go wrong with this recommendation

Return JSON:
{{
    "synthesis": "your critical review...",
    "evidence_grade": "your grade assessment",
    "recommendation": "modified recommendation if needed...",
    "confidence": 0.0-1.0,
    "concerns": ["concern1", "concern2", "concern3"]
}}"""

        response = await self.medgemma.generate(
            prompt=prompt,
            system_prompt=SKEPTICAL_REVIEWER_SYSTEM,
            temperature=0.4,
            max_tokens=1500,
        )

        try:
            data = self.medgemma._parse_json_response(response)
            return ModelPerspective(
                role="skeptical",
                synthesis=data.get("synthesis", ""),
                evidence_grade=data.get("evidence_grade", primary.evidence_grade),
                recommendation=data.get("recommendation", ""),
                confidence=float(data.get("confidence", 0.4)),
                key_points=[],
                concerns=data.get("concerns", []),
            )
        except Exception as e:
            logger.warning("Failed to parse skeptical response", error=str(e))
            return ModelPerspective(
                role="skeptical",
                synthesis="Unable to complete critical review",
                evidence_grade=primary.evidence_grade,
                recommendation=primary.recommendation,
                confidence=0.3,
                key_points=[],
                concerns=["Review parsing failed - manual review recommended"],
            )

    async def _get_vision_perspective(
        self,
        image_path: str,
        question: str,
    ) -> ModelPerspective | None:
        """Get vision model's perspective on medical image."""
        try:
            logger.info("Analyzing medical image", image=image_path)

            # Use MedGemma's image analysis
            analysis = await self.medgemma.analyze_medical_image(
                image_path=image_path,
                clinical_context=question,
            )

            if analysis.get("error"):
                logger.warning("Image analysis returned error", error=analysis["error"])
                return None

            # Convert image analysis to ModelPerspective format
            findings = analysis.get("findings", [])
            abnormalities = analysis.get("abnormalities", [])
            impression = analysis.get("impression", "")
            confidence = float(analysis.get("confidence", 0.5))

            key_points = findings + abnormalities
            if impression:
                key_points.insert(0, impression)

            return ModelPerspective(
                role="vision",
                synthesis=f"Image Analysis ({analysis.get('modality', 'Unknown')}): {impression}",
                evidence_grade="moderate" if confidence > 0.5 else "low",
                recommendation="; ".join(analysis.get("recommendations", [])),
                confidence=confidence,
                key_points=key_points[:5],  # Limit to 5 key points
                concerns=analysis.get("differential_diagnoses", []),
            )

        except Exception as e:
            logger.error("Vision analysis failed", error=str(e))
            return None

    async def _synthesize_consensus(
        self,
        question: str,
        pico: dict[str, str],
        primary: ModelPerspective,
        skeptical: ModelPerspective,
        vision: ModelPerspective | None,
        papers: list[dict],
    ) -> ConsensusResult:
        """Synthesize final consensus from all perspectives."""
        prompt = CONSENSUS_SYNTHESIS_PROMPT.format(
            question=question,
            primary_synthesis=primary.synthesis,
            primary_grade=primary.evidence_grade,
            primary_recommendation=primary.recommendation,
            primary_points=", ".join(primary.key_points),
            skeptical_synthesis=skeptical.synthesis,
            skeptical_grade=skeptical.evidence_grade,
            skeptical_concerns=", ".join(skeptical.concerns),
        )

        response = await self.medgemma.generate(
            prompt=prompt,
            system_prompt=CLINICAL_REASONING_SYSTEM,
            temperature=0.2,
            max_tokens=1500,
        )

        try:
            data = self.medgemma._parse_json_response(response)

            return ConsensusResult(
                question=question,
                pico=pico,
                primary=primary,
                skeptical=skeptical,
                vision=vision,
                agreement_score=float(data.get("agreement_score", 0.7)),
                consensus_grade=self._determine_consensus_grade(primary, skeptical),
                divergence_points=data.get("divergence_points", []),
                final_synthesis=data.get("final_synthesis", primary.synthesis),
                final_recommendation=data.get("final_recommendation", primary.recommendation),
                final_grade=data.get("final_grade", primary.evidence_grade),
                confidence=float(data.get("confidence", 0.5)),
                papers=papers,
                search_terms=list(pico.values()),
            )
        except Exception as e:
            logger.warning("Failed to parse consensus", error=str(e))
            # Fallback: use primary with adjustments
            return ConsensusResult(
                question=question,
                pico=pico,
                primary=primary,
                skeptical=skeptical,
                vision=vision,
                agreement_score=0.6,
                consensus_grade=primary.evidence_grade,
                divergence_points=skeptical.concerns[:3],
                final_synthesis=primary.synthesis,
                final_recommendation=primary.recommendation,
                final_grade=primary.evidence_grade,
                confidence=min(primary.confidence, skeptical.confidence),
                papers=papers,
                search_terms=list(pico.values()),
            )

    def _determine_consensus_grade(
        self,
        primary: ModelPerspective,
        skeptical: ModelPerspective,
    ) -> str:
        """Determine consensus grade based on agreement."""
        grades = {"high": 4, "moderate": 3, "low": 2, "very_low": 1}

        p_score = grades.get(primary.evidence_grade, 2)
        s_score = grades.get(skeptical.evidence_grade, 2)

        # Take the more conservative grade
        avg = (p_score + s_score) / 2

        if avg >= 3.5:
            return "high"
        elif avg >= 2.5:
            return "moderate"
        elif avg >= 1.5:
            return "low"
        return "very_low"

    def _format_papers(self, papers: list[dict]) -> str:
        """Format papers for prompt."""
        if not papers:
            return "No papers available"

        formatted = []
        for i, p in enumerate(papers, 1):
            title = p.get("title", "Unknown")[:100]
            abstract = p.get("abstract", "")[:400]
            year = p.get("year", "")
            formatted.append(f"[{i}] {title} ({year})\n{abstract}...")

        return "\n\n".join(formatted)


# Singleton
_consensus_engine: ConsensusEngine | None = None


def get_consensus_engine() -> ConsensusEngine:
    """Get or create consensus engine singleton."""
    global _consensus_engine
    if _consensus_engine is None:
        _consensus_engine = ConsensusEngine()
    return _consensus_engine
