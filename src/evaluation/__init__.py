"""Evaluation modules — anchored research assessment + clinical case scoring."""

from src.evaluation.anchors import AnchorStore, AnchorPaper, get_anchor_store
from src.evaluation.evaluator import AnchoredEvaluator, EvaluationResult, get_anchored_evaluator
from src.evaluation.test_cases import TEST_CASES, get_test_case, get_all_test_case_ids
from src.evaluation.scorer import score_case, CaseScore

__all__ = [
    "AnchorStore",
    "AnchorPaper",
    "get_anchor_store",
    "AnchoredEvaluator",
    "EvaluationResult",
    "get_anchored_evaluator",
    "TEST_CASES",
    "get_test_case",
    "get_all_test_case_ids",
    "score_case",
    "CaseScore",
]
