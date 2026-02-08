"""Gemini API client module."""

from src.gemini.client import GeminiClient, get_gemini_client
from src.gemini.schemas import (
    PaperAnalysisSchema,
    ClaimExtractionSchema,
    ContradictionAnalysisSchema,
    TrendAnalysisSchema,
    PredictionSchema,
    SynthesisSchema,
)

__all__ = [
    "GeminiClient",
    "get_gemini_client",
    "PaperAnalysisSchema",
    "ClaimExtractionSchema",
    "ContradictionAnalysisSchema",
    "TrendAnalysisSchema",
    "PredictionSchema",
    "SynthesisSchema",
]
