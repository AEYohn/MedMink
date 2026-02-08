"""DSPy-based analysis module for research paper extraction.

This module provides declarative, optimizable AI components for:
- Extracting techniques with formulas and pseudocode
- Extracting claims from papers
- Detecting contradictions between claims
- Identifying research trends

Using DSPy instead of manual prompts provides:
- Automatic prompt optimization using training data
- Modular, reusable components
- Better structured outputs
- Chain-of-thought reasoning for complex extractions
"""

from src.dspy_analysis.client import DSPyAnalysisClient, get_dspy_client
from src.dspy_analysis.modules import (
    PaperAnalyzer,
    TechniqueExtractor,
    ClaimExtractor,
    ContradictionDetector,
)
from src.dspy_analysis.signatures import (
    TechniqueExtraction,
    ClaimExtraction,
    PaperAnalysis,
    ContradictionDetection,
)

__all__ = [
    # Client
    "DSPyAnalysisClient",
    "get_dspy_client",
    # Modules
    "PaperAnalyzer",
    "TechniqueExtractor",
    "ClaimExtractor",
    "ContradictionDetector",
    # Signatures
    "TechniqueExtraction",
    "ClaimExtraction",
    "PaperAnalysis",
    "ContradictionDetection",
]
