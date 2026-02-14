"""Evaluation modules — anchored research assessment + clinical case scoring."""

from src.evaluation.anchors import AnchorPaper, AnchorStore, get_anchor_store
from src.evaluation.evaluator import AnchoredEvaluator, EvaluationResult, get_anchored_evaluator
from src.evaluation.scorer import CaseScore, score_case
from src.evaluation.test_cases import TEST_CASES, get_all_test_case_ids, get_test_case

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
