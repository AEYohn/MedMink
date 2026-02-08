"""Automated scorer for clinical case analysis evaluation.

Runs a test case through the ClinicalCaseAnalyzer and scores the output
against expected elements defined in test_cases.py.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

import structlog

from src.medgemma.case_analyzer import get_case_analyzer

logger = structlog.get_logger()


@dataclass
class CheckResult:
    """Result of a single evaluation check."""
    name: str
    passed: bool
    details: str = ""


@dataclass
class CaseScore:
    """Scored result for a single test case."""
    case_id: str
    case_name: str
    checks: list[CheckResult] = field(default_factory=list)
    raw_result: dict = field(default_factory=dict)

    @property
    def total(self) -> int:
        return len(self.checks)

    @property
    def passed(self) -> int:
        return sum(1 for c in self.checks if c.passed)

    @property
    def failed(self) -> int:
        return self.total - self.passed

    @property
    def score_pct(self) -> float:
        return (self.passed / self.total * 100) if self.total else 0.0

    def summary_line(self) -> str:
        return f"{self.case_name}: {self.passed}/{self.total} ({self.score_pct:.0f}%)"

    def to_dict(self) -> dict:
        return {
            "case_id": self.case_id,
            "case_name": self.case_name,
            "passed": self.passed,
            "total": self.total,
            "score_pct": round(self.score_pct, 1),
            "checks": [
                {"name": c.name, "passed": c.passed, "details": c.details}
                for c in self.checks
            ],
        }


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _text_contains_any(text: str, keywords: list[str]) -> tuple[bool, list[str]]:
    """Check if text contains any of the keywords (case-insensitive).

    Returns (matched, list_of_matched_keywords).
    """
    text_lower = text.lower()
    matched = []
    for kw in keywords:
        if kw.lower() in text_lower:
            matched.append(kw)
    return bool(matched), matched


def _list_contains_any(items: list[str], keywords: list[str]) -> tuple[bool, list[str]]:
    """Check if any item in the list contains any keyword."""
    joined = " ".join(items).lower()
    matched = []
    for kw in keywords:
        if kw.lower() in joined:
            matched.append(kw)
    return bool(matched), matched


def _check_text_keywords(
    score: CaseScore,
    name: str,
    text: str,
    keywords: list[str],
    truncate: int = 80,
) -> None:
    """Add a keyword-presence check against a text field.

    Skips silently if keywords is empty.
    """
    if not keywords:
        return
    found, matched = _text_contains_any(text, keywords)
    display = text[:truncate] if truncate else text
    score.checks.append(CheckResult(
        name=name,
        passed=found,
        details=f"'{display}', expected any of: {keywords}, matched: {matched}",
    ))


def _check_list_keywords(
    score: CaseScore,
    name: str,
    items: list[str],
    keywords: list[str],
) -> None:
    """Add a keyword-presence check against a list of items.

    Skips silently if keywords is empty.
    """
    if not keywords:
        return
    found, matched = _list_contains_any(items, keywords)
    score.checks.append(CheckResult(
        name=name,
        passed=found,
        details=f"{items}, expected any of: {keywords}, matched: {matched}",
    ))


# ---------------------------------------------------------------------------
# Extracted check functions (independently testable)
# ---------------------------------------------------------------------------

def check_must_recommend(
    option_names_joined: str,
    items: list,
    option_names: list[str],
) -> list[CheckResult]:
    """Check that must-recommend items appear in options.

    Items can be strings (single keyword) or lists of strings (OR groups
    where any one match satisfies the check).
    """
    results = []
    for item in items:
        if isinstance(item, list):
            found = any(kw.lower() in option_names_joined for kw in item)
            label = " | ".join(item)
            results.append(CheckResult(
                name=f"Must recommend: {label}",
                passed=found,
                details=f"Options: {option_names}" if not found else "Found",
            ))
        else:
            found = item.lower() in option_names_joined
            results.append(CheckResult(
                name=f"Must recommend: {item}",
                passed=found,
                details=f"Options: {option_names}" if not found else "Found",
            ))
    return results


def check_not_falsely_harmful(
    option_verdicts: dict[str, str],
    items: list,
) -> list[CheckResult]:
    """Check that expected treatments aren't incorrectly flagged as harmful.

    Items can be strings or lists of strings (OR groups).
    """
    results = []
    for item in items:
        keywords = item if isinstance(item, list) else [item]
        flagged_harmful = False
        flagged_name = ""
        for name, verdict in option_verdicts.items():
            if any(kw.lower() in name.lower() for kw in keywords) and verdict == "not_recommended":
                flagged_harmful = True
                flagged_name = name
                break
        label = " | ".join(keywords) if isinstance(item, list) else item
        results.append(CheckResult(
            name=f"Not falsely harmful: {label}",
            passed=not flagged_harmful,
            details=f"'{flagged_name}' incorrectly rated not_recommended" if flagged_harmful else "OK",
        ))
    return results


_SELF_CONTRADICTION_STOPWORDS = frozenset({
    "with", "this", "that", "from", "have", "been",
    "dose", "oral", "daily", "management",
})


def check_self_contradictions(
    treatment_options: list[dict],
    dnd_items: list[str],
) -> CheckResult:
    """Check for treatments recommended AND in do-not-do list."""
    dnd_text = " ".join(dnd_items).lower()
    contradictions = []
    for opt in treatment_options:
        if opt.get("verdict") in ("recommended", "consider"):
            opt_words = re.findall(r'[a-zA-Z]{4,}', opt["name"].lower())
            for w in opt_words:
                if w in dnd_text and w not in _SELF_CONTRADICTION_STOPWORDS:
                    contradictions.append(f"{opt['name']} vs DND")
                    break
    return CheckResult(
        name="No self-contradictions",
        passed=len(contradictions) == 0,
        details=f"Contradictions: {contradictions}" if contradictions else "No contradictions",
    )


_MODIFY_KEYWORDS = frozenset({
    "hold", "discontinue", "stop", "increase", "decrease", "titrate",
    "withhold", "taper", "adjust", "change", "switch", "restart",
    "uptitrate", "escalate", "reduce", "wean", "cease",
})


def check_home_med_contamination(
    treatment_options: list[dict],
    home_meds: list[str],
    exceptions: list[str],
) -> CheckResult | None:
    """Check if treatment options include home meds as new treatments.

    Returns None if home_meds is empty (check not applicable).
    Skips medications listed in exceptions (e.g., when stopping a home med
    IS the treatment, like lithium in lithium toxicity).
    """
    if not home_meds:
        return None

    contaminated = []
    for med_str in home_meds:
        med_name = re.split(r'\s+\d', med_str)[0].strip().lower()
        if len(med_name) < 3:
            continue
        # Skip meds in the exceptions list
        if any(exc.lower() in med_name for exc in exceptions):
            continue
        for opt in treatment_options:
            opt_name_lower = opt["name"].lower()
            if re.search(r'\b' + re.escape(med_name) + r'\b', opt_name_lower):
                # Check if the option explicitly modifies the medication
                opt_text = opt_name_lower + " " + opt.get("rationale", "").lower()
                if not any(kw in opt_text for kw in _MODIFY_KEYWORDS):
                    contaminated.append(f"{opt['name']} (home med: {med_str})")
                break

    return CheckResult(
        name="No home-med contamination",
        passed=len(contaminated) == 0,
        details=f"Home meds in options: {contaminated}" if contaminated else "No home meds listed as new treatments",
    )


def check_acute_management_present(acute_mgmt: dict) -> CheckResult:
    """Check that acute management protocol has required fields."""
    has_risk = bool(acute_mgmt.get("risk_stratification"))
    has_actions = bool(acute_mgmt.get("immediate_actions"))
    return CheckResult(
        name="Acute management present",
        passed=has_risk and has_actions,
        details=(
            f"risk_stratification: {'present' if has_risk else 'MISSING'}, "
            f"immediate_actions: {'present' if has_actions else 'MISSING'}"
        ),
    )


def check_timing_in_rationale(
    treatment_options: list[dict],
    timing_keywords: list[str],
) -> CheckResult | None:
    """Check if treatment rationales mention timing constraints.

    Returns None if timing_keywords is empty (check not applicable).
    """
    if not timing_keywords:
        return None
    all_rationales = " ".join(
        opt.get("rationale", "") for opt in treatment_options
    ).lower()
    found, matched = _text_contains_any(all_rationales, timing_keywords)
    return CheckResult(
        name="Timing constraints in rationale",
        passed=found,
        details=f"Expected any of: {timing_keywords}, matched: {matched}",
    )


# ---------------------------------------------------------------------------
# Main scoring function
# ---------------------------------------------------------------------------

async def score_case(test_case: dict) -> CaseScore:
    """Run a test case through the analyzer and score against expectations.

    Args:
        test_case: A dict from TEST_CASES with id, name, case_text, expected.

    Returns:
        CaseScore with per-check pass/fail results.
    """
    case_id = test_case["id"]
    case_name = test_case["name"]
    case_text = test_case["case_text"]
    expected = test_case["expected"]

    score = CaseScore(case_id=case_id, case_name=case_name)

    # Run analysis
    analyzer = get_case_analyzer()
    result_data = None

    logger.info("Running analysis", case_id=case_id)
    async for event in analyzer.analyze_case(case_text):
        if event.get("type") == "result":
            result_data = event["data"]
        elif event.get("type") == "error":
            score.checks.append(CheckResult(
                name="Analysis completed",
                passed=False,
                details=f"Analysis failed: {event.get('message', 'unknown error')}",
            ))
            return score

    if not result_data:
        score.checks.append(CheckResult(
            name="Analysis completed",
            passed=False,
            details="No result returned from analyzer",
        ))
        return score

    score.raw_result = result_data

    # Extract key sections
    parsed_case = result_data.get("parsed_case", {})
    treatment_options = result_data.get("treatment_options", [])
    acute_mgmt = result_data.get("acute_management", {})
    top_rec = result_data.get("top_recommendation", "")
    category = parsed_case.get("case_category", "")

    option_names = [opt["name"] for opt in treatment_options]
    option_names_joined = " ".join(option_names).lower()
    option_verdicts = {opt["name"]: opt["verdict"] for opt in treatment_options}

    # --- Checks 1-3: Simple text keyword checks (DRY via helper) ---
    _check_text_keywords(score, "Correct category", category,
                         expected.get("category_contains", []))
    _check_text_keywords(score, "Risk stratification",
                         acute_mgmt.get("risk_stratification", ""),
                         expected.get("risk_stratification_contains", []))
    _check_text_keywords(score, "Disposition",
                         acute_mgmt.get("disposition", ""),
                         expected.get("disposition_contains", []))

    # --- Check 4: Must-recommend (supports OR groups) ---
    score.checks.extend(check_must_recommend(
        option_names_joined, expected.get("must_recommend", []), option_names,
    ))

    # --- Check 5: Not falsely harmful (supports OR groups) ---
    score.checks.extend(check_not_falsely_harmful(
        option_verdicts, expected.get("must_not_recommend_as_harmful", []),
    ))

    # --- Check 6: Etiology addressed ---
    etiology_keywords = expected.get("should_address_etiology", [])
    if etiology_keywords:
        all_text = " ".join(
            opt["name"] + " " + opt.get("rationale", "")
            for opt in treatment_options
        ).lower()
        found, matched = _text_contains_any(all_text, etiology_keywords)
        score.checks.append(CheckResult(
            name="Etiology addressed",
            passed=found,
            details=f"Expected any of: {etiology_keywords}, matched: {matched}",
        ))

    # --- Check 7: Lab corrections ---
    lab_keywords = expected.get("should_correct_labs", [])
    if lab_keywords:
        corrections = acute_mgmt.get("metabolic_corrections", [])
        all_text = option_names_joined + " " + " ".join(corrections).lower()
        found, matched = _text_contains_any(all_text, lab_keywords)
        score.checks.append(CheckResult(
            name="Lab corrections",
            passed=found,
            details=f"Expected any of: {lab_keywords}, matched: {matched}",
        ))

    # --- Checks 8-9: List keyword checks (DRY via helper) ---
    _check_list_keywords(score, "Consults",
                         acute_mgmt.get("consults", []),
                         expected.get("expected_consults", []))
    _check_list_keywords(score, "Do-not-do coverage",
                         acute_mgmt.get("do_not_do", []),
                         expected.get("do_not_do_should_include", []))

    # --- Check 10: Self-contradiction ---
    score.checks.append(check_self_contradictions(
        treatment_options, acute_mgmt.get("do_not_do", []),
    ))

    # --- Check 11: Evidence quality ---
    keyword_papers = 0
    total_papers = 0
    for opt in treatment_options:
        for paper in opt.get("papers_used", []):
            total_papers += 1
            if paper.get("match_type") == "keyword":
                keyword_papers += 1
    if total_papers > 0:
        keyword_ratio = keyword_papers / total_papers
        score.checks.append(CheckResult(
            name="Evidence quality",
            passed=keyword_ratio >= 0.3,
            details=f"{keyword_papers}/{total_papers} papers have keyword matches ({keyword_ratio:.0%})",
        ))

    # --- Check 12: Home medication contamination ---
    home_med_result = check_home_med_contamination(
        treatment_options,
        parsed_case.get("management", {}).get("medications", []),
        expected.get("home_med_exceptions", []),
    )
    if home_med_result:
        score.checks.append(home_med_result)

    # --- Check 13: Acute management present ---
    score.checks.append(check_acute_management_present(acute_mgmt))

    # --- Check 14: Timing constraints in rationale ---
    timing_result = check_timing_in_rationale(
        treatment_options, expected.get("timing_keywords_in_rationale", []),
    )
    if timing_result:
        score.checks.append(timing_result)

    logger.info(
        "Case scored",
        case_id=case_id,
        passed=score.passed,
        total=score.total,
        pct=f"{score.score_pct:.0f}%",
    )

    return score
