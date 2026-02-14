"""DSPy modules for research paper analysis.

These modules use ChainOfThought reasoning to improve extraction quality.
They can be optimized using DSPy's optimizers with training data.
"""

import json
from typing import Any

import dspy
import structlog

from src.dspy_analysis.signatures import (
    ClaimExtraction,
    ContradictionDetection,
    DetectedContradiction,
    ExtractedClaim,
    ExtractedTechnique,
    FormulaExtraction,
    PaperAnalysis,
    PaperAnalysisResult,
    PseudocodeGeneration,
    TechniqueExtraction,
)

logger = structlog.get_logger()


class TechniqueExtractor(dspy.Module):
    """Extract techniques with formulas and pseudocode using chain-of-thought.

    This module first reasons about what techniques are present, then
    extracts each one with detailed information.
    """

    def __init__(self):
        super().__init__()
        # Use ChainOfThought for better reasoning about technique extraction
        self.extract = dspy.ChainOfThought(TechniqueExtraction)
        # Separate modules for formula and pseudocode enhancement
        self.formula_extractor = dspy.ChainOfThought(FormulaExtraction)
        self.pseudocode_generator = dspy.ChainOfThought(PseudocodeGeneration)

    def forward(
        self,
        paper_title: str,
        paper_content: str,
        enhance_formulas: bool = True,
    ) -> dspy.Prediction:
        """Extract techniques from paper content.

        Args:
            paper_title: Title of the paper
            paper_content: Full or partial paper content
            enhance_formulas: Whether to run additional formula extraction

        Returns:
            Prediction with techniques list
        """
        # First pass: extract techniques with chain-of-thought
        result = self.extract(
            paper_title=paper_title,
            paper_content=paper_content[:20000],  # Limit content size
        )

        techniques = result.techniques

        # Enhance formula extraction if we have full text
        if enhance_formulas and len(paper_content) > 2000:
            try:
                formula_result = self.formula_extractor(
                    text_section=paper_content[:15000]
                )
                # Parse and merge any additional formulas found
                additional_formulas = self._parse_formulas(formula_result.formulas)
                techniques = self._merge_formulas(techniques, additional_formulas)
            except Exception as e:
                logger.debug("Formula enhancement failed", error=str(e))

        return dspy.Prediction(
            techniques=techniques,
            rationale=getattr(result, 'rationale', None),
        )

    def _parse_formulas(self, formulas_json: str) -> list[dict]:
        """Parse formulas JSON output."""
        try:
            if isinstance(formulas_json, str):
                return json.loads(formulas_json)
            return formulas_json
        except json.JSONDecodeError:
            return []

    def _merge_formulas(
        self,
        techniques: list[ExtractedTechnique],
        formulas: list[dict],
    ) -> list[ExtractedTechnique]:
        """Merge additional formulas into techniques."""
        formula_map = {f.get("name", "").lower(): f.get("latex", "") for f in formulas}

        for technique in techniques:
            if not technique.formula:
                # Try to find a matching formula
                name_lower = technique.name.lower()
                for formula_name, latex in formula_map.items():
                    if formula_name in name_lower or name_lower in formula_name:
                        technique.formula = latex
                        break

        return techniques


class ClaimExtractor(dspy.Module):
    """Extract claims from research papers using chain-of-thought."""

    def __init__(self):
        super().__init__()
        self.extract = dspy.ChainOfThought(ClaimExtraction)

    def forward(self, paper_title: str, paper_content: str) -> dspy.Prediction:
        """Extract claims from paper content.

        Args:
            paper_title: Title of the paper
            paper_content: Paper abstract and/or full text

        Returns:
            Prediction with claims list
        """
        result = self.extract(
            paper_title=paper_title,
            paper_content=paper_content[:15000],
        )

        return dspy.Prediction(
            claims=result.claims,
            rationale=getattr(result, 'rationale', None),
        )


class PaperAnalyzer(dspy.Module):
    """Comprehensive paper analysis combining multiple extraction steps.

    This is the main analysis module that orchestrates:
    1. Summary generation
    2. Claim extraction
    3. Method identification
    4. Technique extraction with formulas

    Uses chain-of-thought reasoning for each component.
    """

    def __init__(self):
        super().__init__()
        # Main analysis module
        self.analyze = dspy.ChainOfThought(PaperAnalysis)
        # Specialized extractors for enhancement
        self.technique_extractor = TechniqueExtractor()
        self.claim_extractor = ClaimExtractor()

    def forward(
        self,
        paper_title: str,
        paper_abstract: str,
        paper_full_text: str = "",
        deep_analysis: bool = False,
    ) -> dspy.Prediction:
        """Analyze a research paper comprehensively.

        Args:
            paper_title: Title of the paper
            paper_abstract: Paper abstract
            paper_full_text: Full paper text (optional, from PDF extraction)
            deep_analysis: Whether to run additional extraction passes

        Returns:
            Prediction with complete PaperAnalysisResult
        """
        # Main analysis pass
        result = self.analyze(
            paper_title=paper_title,
            paper_abstract=paper_abstract,
            paper_full_text=paper_full_text[:25000] if paper_full_text else "",
        )

        analysis = result.analysis

        # If we have full text and deep analysis is enabled, enhance extraction
        if deep_analysis and paper_full_text:
            # Run specialized technique extraction
            try:
                tech_result = self.technique_extractor(
                    paper_title=paper_title,
                    paper_content=paper_full_text,
                    enhance_formulas=True,
                )
                # Merge techniques, preferring ones with formulas
                analysis.techniques = self._merge_techniques(
                    analysis.techniques,
                    tech_result.techniques,
                )
            except Exception as e:
                logger.debug("Deep technique extraction failed", error=str(e))

            # Run specialized claim extraction
            try:
                claim_result = self.claim_extractor(
                    paper_title=paper_title,
                    paper_content=paper_abstract + "\n\n" + paper_full_text[:10000],
                )
                # Merge claims, avoiding duplicates
                analysis.claims = self._merge_claims(
                    analysis.claims,
                    claim_result.claims,
                )
            except Exception as e:
                logger.debug("Deep claim extraction failed", error=str(e))

        return dspy.Prediction(
            analysis=analysis,
            rationale=getattr(result, 'rationale', None),
        )

    def _merge_techniques(
        self,
        original: list[ExtractedTechnique],
        enhanced: list[ExtractedTechnique],
    ) -> list[ExtractedTechnique]:
        """Merge technique lists, preferring versions with formulas."""
        # Build map by name
        by_name = {t.name.lower(): t for t in original}

        for technique in enhanced:
            name_lower = technique.name.lower()
            if name_lower in by_name:
                existing = by_name[name_lower]
                # Prefer the one with more information
                if technique.formula and not existing.formula:
                    by_name[name_lower] = technique
                elif technique.pseudocode and not existing.pseudocode:
                    existing.pseudocode = technique.pseudocode
                elif technique.implementation_notes and not existing.implementation_notes:
                    existing.implementation_notes = technique.implementation_notes
            else:
                by_name[name_lower] = technique

        return list(by_name.values())

    def _merge_claims(
        self,
        original: list[ExtractedClaim],
        enhanced: list[ExtractedClaim],
    ) -> list[ExtractedClaim]:
        """Merge claim lists, avoiding duplicates."""
        # Simple deduplication by statement similarity
        existing_statements = {c.statement.lower()[:100] for c in original}
        merged = list(original)

        for claim in enhanced:
            statement_prefix = claim.statement.lower()[:100]
            if statement_prefix not in existing_statements:
                merged.append(claim)
                existing_statements.add(statement_prefix)

        return merged

    def to_dict(self, analysis: PaperAnalysisResult) -> dict[str, Any]:
        """Convert analysis result to dictionary for storage."""
        return {
            "summary": analysis.summary,
            "claims": [
                {
                    "statement": c.statement,
                    "category": c.category,
                    "confidence": c.confidence,
                    "evidence": c.evidence,
                }
                for c in analysis.claims
            ],
            "methods": [
                {
                    "name": m.name,
                    "description": m.description,
                    "is_novel": m.is_novel,
                }
                for m in analysis.methods
            ],
            "techniques": [
                {
                    "name": t.name,
                    "type": t.technique_type,
                    "description": t.description,
                    "formula": t.formula,
                    "pseudocode": t.pseudocode,
                    "implementation_notes": t.implementation_notes,
                    "is_novel": t.is_novel,
                    "improves_upon": t.improves_upon,
                }
                for t in analysis.techniques
            ],
            "keywords": analysis.keywords,
            "confidence_overall": analysis.confidence_overall,
        }


class ContradictionDetector(dspy.Module):
    """Detect contradictions between claims using chain-of-thought."""

    def __init__(self):
        super().__init__()
        self.detect = dspy.ChainOfThought(ContradictionDetection)

    def forward(self, claims: list[dict[str, Any]]) -> dspy.Prediction:
        """Detect contradictions between a list of claims.

        Args:
            claims: List of claim dictionaries with 'statement' and 'category'

        Returns:
            Prediction with contradictions list and confidence
        """
        # Format claims as numbered text
        claims_text = "\n".join(
            f"{i}. [{c.get('category', 'unknown')}] {c.get('statement', '')}"
            for i, c in enumerate(claims)
        )

        result = self.detect(claims_text=claims_text)

        return dspy.Prediction(
            contradictions=result.contradictions,
            analysis_confidence=result.analysis_confidence,
            rationale=getattr(result, 'rationale', None),
        )

    def to_dict(self, contradictions: list[DetectedContradiction]) -> dict[str, Any]:
        """Convert contradictions to dictionary format."""
        return {
            "contradictions": [
                {
                    "claim1_index": c.claim1_index,
                    "claim2_index": c.claim2_index,
                    "contradiction_type": c.contradiction_type,
                    "strength": c.strength,
                    "explanation": c.explanation,
                    "possible_reconciliation": c.possible_reconciliation,
                }
                for c in contradictions
            ]
        }


class BatchPaperAnalyzer(dspy.Module):
    """Analyze multiple papers efficiently.

    For batch analysis, this module processes papers in parallel
    while maintaining quality through chain-of-thought reasoning.
    """

    def __init__(self):
        super().__init__()
        self.analyzer = PaperAnalyzer()

    def forward(
        self,
        papers: list[dict[str, str]],
        deep_analysis: bool = False,
    ) -> list[dspy.Prediction]:
        """Analyze multiple papers.

        Args:
            papers: List of paper dicts with 'title', 'abstract', and optionally 'full_text'

        Returns:
            List of analysis predictions
        """
        results = []

        for paper in papers:
            try:
                result = self.analyzer(
                    paper_title=paper.get("title", ""),
                    paper_abstract=paper.get("abstract", ""),
                    paper_full_text=paper.get("full_text", ""),
                    deep_analysis=deep_analysis,
                )
                results.append(result)
            except Exception as e:
                logger.warning("Paper analysis failed", title=paper.get("title", "")[:50], error=str(e))
                # Return empty analysis for failed papers
                results.append(dspy.Prediction(
                    analysis=PaperAnalysisResult(
                        summary="Analysis failed",
                        claims=[],
                        methods=[],
                        techniques=[],
                        keywords=[],
                        confidence_overall=0.0,
                    )
                ))

        return results
