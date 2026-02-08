"""MedGemma local inference module for medical literature analysis.

This module provides local inference capabilities using MedGemma 1.5 4B
quantized models for privacy-preserving clinical evidence synthesis.
"""

from src.medgemma.client import MedGemmaClient, get_medgemma_client
from src.medgemma.prompts import (
    CLINICAL_REASONING_SYSTEM,
    EVIDENCE_GRADING_PROMPT,
    PICO_EXTRACTION_PROMPT,
)

__all__ = [
    "MedGemmaClient",
    "get_medgemma_client",
    "CLINICAL_REASONING_SYSTEM",
    "EVIDENCE_GRADING_PROMPT",
    "PICO_EXTRACTION_PROMPT",
]
