"""CLI runner for the clinical case evaluation framework.

Usage:
    python -m src.evaluation.run_eval                          # Run all test cases
    python -m src.evaluation.run_eval --case pancreatitis_htg  # Run one case
    python -m src.evaluation.run_eval --compare results/prev.json  # Diff against previous
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

from src.evaluation.test_cases import TEST_CASES, get_test_case, get_all_test_case_ids
from src.evaluation.scorer import score_case, CaseScore


RESULTS_DIR = Path("results")


def print_scorecard(scores: list[CaseScore]) -> None:
    """Print a formatted scorecard table."""
    # Header
    max_name = max(len(s.case_name) for s in scores) if scores else 20
    col_w = max(max_name + 2, 22)

    print()
    print("=" * (col_w + 30))
    print(f"{'Case':<{col_w}} {'Pass':>6} {'Total':>6} {'Score':>8}")
    print("-" * (col_w + 30))

    total_pass = 0
    total_checks = 0

    for s in scores:
        total_pass += s.passed
        total_checks += s.total
        status = "PASS" if s.score_pct >= 70 else "FAIL"
        marker = "+" if s.score_pct >= 70 else "-"
        print(f"  {marker} {s.case_name:<{col_w - 2}} {s.passed:>6} {s.total:>6} {s.score_pct:>7.0f}%  {status}")

    print("-" * (col_w + 30))
    overall_pct = (total_pass / total_checks * 100) if total_checks else 0
    print(f"  {'TOTAL':<{col_w - 2}} {total_pass:>6} {total_checks:>6} {overall_pct:>7.0f}%")
    print("=" * (col_w + 30))
    print()


def print_failures(scores: list[CaseScore]) -> None:
    """Print details of failed checks."""
    any_failures = False
    for s in scores:
        failures = [c for c in s.checks if not c.passed]
        if failures:
            if not any_failures:
                print("FAILURES:")
                print("-" * 60)
                any_failures = True
            print(f"\n  {s.case_name} ({s.case_id}):")
            for f in failures:
                print(f"    X {f.name}")
                if f.details:
                    # Truncate long details
                    detail = f.details if len(f.details) < 120 else f.details[:117] + "..."
                    print(f"      {detail}")

    if not any_failures:
        print("All checks passed!")
    print()


def save_results(scores: list[CaseScore], path: Path) -> None:
    """Save results to JSON."""
    data = {
        "timestamp": datetime.now().isoformat(),
        "cases": [s.to_dict() for s in scores],
        "summary": {
            "total_cases": len(scores),
            "total_checks": sum(s.total for s in scores),
            "total_passed": sum(s.passed for s in scores),
            "overall_pct": round(
                sum(s.passed for s in scores) / max(sum(s.total for s in scores), 1) * 100, 1
            ),
        },
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))
    print(f"Results saved to {path}")


def compare_results(current: list[CaseScore], prev_path: Path) -> None:
    """Compare current results against a previous run."""
    prev_data = json.loads(prev_path.read_text())
    prev_cases = {c["case_id"]: c for c in prev_data.get("cases", [])}

    print()
    print("COMPARISON vs", prev_path.name)
    print("=" * 60)

    for s in current:
        prev = prev_cases.get(s.case_id)
        if prev:
            delta = s.score_pct - prev["score_pct"]
            arrow = "^" if delta > 0 else ("v" if delta < 0 else "=")
            print(
                f"  {s.case_name:<35} "
                f"{prev['score_pct']:>5.0f}% -> {s.score_pct:>5.0f}%  "
                f"({arrow}{abs(delta):+.0f})"
            )
        else:
            print(f"  {s.case_name:<35}   NEW  -> {s.score_pct:>5.0f}%")

    prev_overall = prev_data.get("summary", {}).get("overall_pct", 0)
    curr_overall = (
        sum(s.passed for s in current) / max(sum(s.total for s in current), 1) * 100
    )
    delta = curr_overall - prev_overall
    print("-" * 60)
    print(f"  {'OVERALL':<35} {prev_overall:>5.0f}% -> {curr_overall:>5.0f}%  ({delta:+.0f})")
    print()


async def run_evaluation(case_ids: list[str]) -> list[CaseScore]:
    """Run evaluation for the given case IDs."""
    scores: list[CaseScore] = []

    for case_id in case_ids:
        tc = get_test_case(case_id)
        if tc is None:
            print(f"WARNING: Unknown test case '{case_id}', skipping")
            continue

        print(f"Running: {tc['name']} ({case_id})...")
        try:
            score = await score_case(tc)
            scores.append(score)
            print(f"  -> {score.passed}/{score.total} ({score.score_pct:.0f}%)")
        except Exception as e:
            print(f"  -> ERROR: {e}")
            scores.append(CaseScore(
                case_id=case_id,
                case_name=tc["name"],
            ))

    return scores


def main() -> None:
    parser = argparse.ArgumentParser(description="Clinical case evaluation runner")
    parser.add_argument(
        "--case",
        type=str,
        default=None,
        help="Run a specific test case by ID (default: all)",
    )
    parser.add_argument(
        "--compare",
        type=str,
        default=None,
        help="Path to previous results JSON for comparison",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output path for results JSON (default: results/eval_<timestamp>.json)",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List available test case IDs and exit",
    )
    args = parser.parse_args()

    if args.list:
        print("Available test cases:")
        for tc in TEST_CASES:
            print(f"  {tc['id']:<25} {tc['name']}")
        return

    # Determine which cases to run
    if args.case:
        case_ids = [args.case]
    else:
        case_ids = get_all_test_case_ids()

    # Run evaluation
    scores = asyncio.run(run_evaluation(case_ids))

    if not scores:
        print("No cases were evaluated.")
        sys.exit(1)

    # Print results
    print_scorecard(scores)
    print_failures(scores)

    # Save results
    if args.output:
        out_path = Path(args.output)
    else:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_path = RESULTS_DIR / f"eval_{ts}.json"
    save_results(scores, out_path)

    # Compare if requested
    if args.compare:
        compare_path = Path(args.compare)
        if compare_path.exists():
            compare_results(scores, compare_path)
        else:
            print(f"WARNING: Comparison file not found: {args.compare}")


if __name__ == "__main__":
    main()
