"""DSPy Analysis Client - integrates DSPy modules with the research synthesizer.

This client provides the same interface as GeminiClient but uses DSPy
modules for better extraction quality and optimizability.
"""

import asyncio
from collections.abc import Callable
from typing import Any

import dspy
import structlog

from src.config import settings
from src.dspy_analysis.modules import (
    BatchPaperAnalyzer,
    ClaimExtractor,
    ContradictionDetector,
    PaperAnalyzer,
    TechniqueExtractor,
)
from src.dspy_analysis.signatures import PaperAnalysisResult

logger = structlog.get_logger()


class DSPyAnalysisClient:
    """Client for paper analysis using DSPy modules.

    This provides the same interface as GeminiClient.analyze_paper() but uses
    DSPy's declarative modules which can be optimized with training data.
    """

    def __init__(
        self,
        model: str | None = None,
        api_key: str | None = None,
    ):
        """Initialize the DSPy analysis client.

        Args:
            model: Model to use (defaults to settings.gemini_model)
            api_key: API key (defaults to settings.gemini_api_key)
        """
        self.model_name = model or settings.gemini_model
        self.api_key = api_key or settings.gemini_api_key

        # Configure DSPy with the LM
        self._configure_lm()

        # Initialize modules
        self.paper_analyzer = PaperAnalyzer()
        self.technique_extractor = TechniqueExtractor()
        self.claim_extractor = ClaimExtractor()
        self.contradiction_detector = ContradictionDetector()
        self.batch_analyzer = BatchPaperAnalyzer()

        # Optimization state
        self._optimized = False
        self._training_examples: list[dspy.Example] = []

        logger.info(
            "DSPy analysis client initialized",
            model=self.model_name,
        )

    def _configure_lm(self):
        """Configure DSPy with the language model."""
        # DSPy supports multiple LM backends
        # For Gemini, we use the Google backend
        if "gemini" in self.model_name.lower():
            lm = dspy.Google(
                model=f"models/{self.model_name}",
                api_key=self.api_key,
            )
        elif "claude" in self.model_name.lower():
            lm = dspy.Claude(
                model=self.model_name,
                api_key=self.api_key,
            )
        elif "gpt" in self.model_name.lower():
            lm = dspy.OpenAI(
                model=self.model_name,
                api_key=self.api_key,
            )
        elif "medgemma" in self.model_name.lower() or "llama" in self.model_name.lower():
            # Local MedGemma - use via HuggingFace transformers in MedGemmaClient
            # For DSPy, fallback to Gemini as DSPy doesn't have native HF support
            logger.info(
                "MedGemma specified for DSPy, using Gemini for DSPy modules",
                note="Use MedGemmaClient directly for local MedGemma inference",
            )
            lm = dspy.Google(
                model=f"models/{settings.gemini_model}",
                api_key=settings.gemini_api_key,
            )
        else:
            # Default to Google/Gemini
            lm = dspy.Google(
                model=f"models/{self.model_name}",
                api_key=self.api_key,
            )

        dspy.settings.configure(lm=lm)

    async def analyze_paper(
        self,
        title: str,
        abstract: str,
        full_text: str | None = None,
        mode: str | None = None,
        skip_cache: bool = False,
    ) -> dict[str, Any]:
        """Analyze a paper and extract structured information.

        This method provides the same interface as GeminiClient.analyze_paper()
        but uses DSPy modules for extraction.

        Args:
            title: Paper title
            abstract: Paper abstract
            full_text: Optional full paper text from PDF extraction
            mode: Analysis mode (quick/standard/deep)
            skip_cache: Ignored (DSPy handles caching internally)

        Returns:
            Structured analysis with claims, methods, techniques.
        """
        analysis_mode = mode or settings.analysis_mode
        deep_analysis = analysis_mode == "deep" or bool(full_text)

        try:
            # Run analysis in a thread pool to avoid blocking
            result = await asyncio.to_thread(
                self._analyze_paper_sync,
                title=title,
                abstract=abstract,
                full_text=full_text or "",
                deep_analysis=deep_analysis,
            )
            return result
        except Exception as e:
            logger.error("DSPy paper analysis failed", title=title[:50], error=str(e))
            # Return empty result on failure
            return {
                "summary": "",
                "claims": [],
                "methods": [],
                "techniques": [],
                "keywords": [],
                "confidence_overall": 0.0,
            }

    def _analyze_paper_sync(
        self,
        title: str,
        abstract: str,
        full_text: str,
        deep_analysis: bool,
    ) -> dict[str, Any]:
        """Synchronous paper analysis (runs in thread pool)."""
        prediction = self.paper_analyzer(
            paper_title=title,
            paper_abstract=abstract,
            paper_full_text=full_text,
            deep_analysis=deep_analysis,
        )

        analysis = prediction.analysis
        return self.paper_analyzer.to_dict(analysis)

    async def analyze_papers_batch(
        self,
        papers: list[dict[str, str]],
        mode: str | None = None,
    ) -> list[dict[str, Any]]:
        """Analyze multiple papers.

        Args:
            papers: List of dicts with 'title' and 'abstract' keys
            mode: Analysis mode

        Returns:
            List of analysis results in same order as input papers
        """
        analysis_mode = mode or settings.analysis_mode
        deep_analysis = analysis_mode == "deep"

        try:
            results = await asyncio.to_thread(
                self._analyze_batch_sync,
                papers=papers,
                deep_analysis=deep_analysis,
            )
            return results
        except Exception as e:
            logger.error("DSPy batch analysis failed", count=len(papers), error=str(e))
            return [{"summary": "", "claims": [], "methods": [], "techniques": []} for _ in papers]

    def _analyze_batch_sync(
        self,
        papers: list[dict[str, str]],
        deep_analysis: bool,
    ) -> list[dict[str, Any]]:
        """Synchronous batch analysis."""
        predictions = self.batch_analyzer(
            papers=papers,
            deep_analysis=deep_analysis,
        )

        results = []
        for pred in predictions:
            if hasattr(pred, "analysis"):
                results.append(self.paper_analyzer.to_dict(pred.analysis))
            else:
                results.append({"summary": "", "claims": [], "methods": [], "techniques": []})

        return results

    async def extract_techniques(
        self,
        title: str,
        content: str,
    ) -> list[dict[str, Any]]:
        """Extract techniques from paper content.

        Specialized method for technique extraction with formula enhancement.

        Args:
            title: Paper title
            content: Paper content (full text preferred)

        Returns:
            List of technique dictionaries
        """
        try:
            result = await asyncio.to_thread(
                self._extract_techniques_sync,
                title=title,
                content=content,
            )
            return result
        except Exception as e:
            logger.error("Technique extraction failed", error=str(e))
            return []

    def _extract_techniques_sync(
        self,
        title: str,
        content: str,
    ) -> list[dict[str, Any]]:
        """Synchronous technique extraction."""
        prediction = self.technique_extractor(
            paper_title=title,
            paper_content=content,
            enhance_formulas=True,
        )

        return [
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
            for t in prediction.techniques
        ]

    async def detect_contradictions(
        self,
        claims: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Detect contradictions between claims.

        Args:
            claims: List of claim dictionaries

        Returns:
            Dictionary with contradictions and analysis confidence
        """
        try:
            result = await asyncio.to_thread(
                self._detect_contradictions_sync,
                claims=claims,
            )
            return result
        except Exception as e:
            logger.error("Contradiction detection failed", error=str(e))
            return {"contradictions": [], "analysis_confidence": 0.0}

    def _detect_contradictions_sync(
        self,
        claims: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Synchronous contradiction detection."""
        prediction = self.contradiction_detector(claims=claims)

        result = self.contradiction_detector.to_dict(prediction.contradictions)
        result["analysis_confidence"] = prediction.analysis_confidence
        return result

    # =========================================================================
    # Optimization methods
    # =========================================================================

    def add_training_example(
        self,
        paper_title: str,
        paper_abstract: str,
        paper_full_text: str,
        expected_analysis: dict[str, Any],
    ):
        """Add a training example for optimization.

        Args:
            paper_title: Paper title
            paper_abstract: Paper abstract
            paper_full_text: Full paper text
            expected_analysis: Expected analysis output
        """
        example = dspy.Example(
            paper_title=paper_title,
            paper_abstract=paper_abstract,
            paper_full_text=paper_full_text,
            analysis=PaperAnalysisResult(**expected_analysis),
        ).with_inputs("paper_title", "paper_abstract", "paper_full_text")

        self._training_examples.append(example)
        logger.info("Added training example", total=len(self._training_examples))

    def optimize(
        self,
        metric: Callable | None = None,
        max_bootstrapped_demos: int = 3,
    ):
        """Optimize the modules using collected training examples.

        Args:
            metric: Evaluation metric function (example, pred, trace -> bool/float)
            max_bootstrapped_demos: Max examples to bootstrap
        """
        if not self._training_examples:
            logger.warning("No training examples available for optimization")
            return

        from dspy.teleprompt import BootstrapFewShot

        # Default metric: check if techniques have formulas
        def default_metric(example, pred, trace=None):
            analysis = pred.analysis
            # Score based on formula and pseudocode extraction
            techniques_with_formula = sum(1 for t in analysis.techniques if t.formula)
            techniques_with_pseudocode = sum(1 for t in analysis.techniques if t.pseudocode)
            total_techniques = len(analysis.techniques) or 1

            formula_ratio = techniques_with_formula / total_techniques
            pseudocode_ratio = techniques_with_pseudocode / total_techniques

            return (formula_ratio + pseudocode_ratio) / 2

        metric_fn = metric or default_metric

        optimizer = BootstrapFewShot(
            metric=metric_fn,
            max_bootstrapped_demos=max_bootstrapped_demos,
        )

        logger.info("Starting DSPy optimization", examples=len(self._training_examples))

        # Optimize the paper analyzer
        self.paper_analyzer = optimizer.compile(
            self.paper_analyzer,
            trainset=self._training_examples,
        )

        self._optimized = True
        logger.info("DSPy optimization complete")

    def save_optimized(self, path: str):
        """Save optimized modules to a file.

        Args:
            path: Path to save the optimized state
        """
        if not self._optimized:
            logger.warning("Modules not optimized, saving unoptimized state")

        self.paper_analyzer.save(path)
        logger.info("Saved optimized modules", path=path)

    def load_optimized(self, path: str):
        """Load optimized modules from a file.

        Args:
            path: Path to load from
        """
        self.paper_analyzer.load(path)
        self._optimized = True
        logger.info("Loaded optimized modules", path=path)


# Singleton instance
_dspy_client: DSPyAnalysisClient | None = None


def get_dspy_client() -> DSPyAnalysisClient:
    """Get or create DSPy client singleton."""
    global _dspy_client
    if _dspy_client is None:
        _dspy_client = DSPyAnalysisClient()
    return _dspy_client
