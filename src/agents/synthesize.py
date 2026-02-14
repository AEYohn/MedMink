"""Synthesize agent for generating weekly reports."""

from datetime import date, datetime, timedelta
from uuid import uuid4

import structlog

from src.agents.base import AgentResult, BaseAgent
from src.models import Task, WeeklyReport

logger = structlog.get_logger()


class SynthesizeAgent(BaseAgent):
    """Agent for synthesizing weekly research reports."""

    name = "synthesize"

    async def execute(self, task: Task) -> AgentResult:
        """Generate weekly synthesis report."""
        try:
            payload = task.payload or {}

            # Determine the week to synthesize
            week_end = datetime.utcnow().date()
            week_start = week_end - timedelta(days=7)

            if payload.get("week_start"):
                week_start = date.fromisoformat(payload["week_start"])
                week_end = week_start + timedelta(days=7)

            kg = await self._get_kg()
            gemini = await self._get_gemini()

            self.logger.info(
                "Starting weekly synthesis",
                week_start=week_start.isoformat(),
                week_end=week_end.isoformat(),
            )

            # Gather data from the knowledge graph
            await kg.get_stats()
            weekly_stats = await kg.get_weekly_stats(datetime.combine(week_start, datetime.min.time()))

            # Get relevant data
            claims = await kg.get_all_claims(limit=100)
            trends = await kg.get_trends(limit=20)
            contradictions = await kg.get_contradictions(limit=20)
            predictions = await kg.get_pending_predictions()
            prediction_accuracy = await kg.get_prediction_accuracy()

            # Check for due predictions
            await kg.get_due_predictions()

            # Prepare data for synthesis
            papers_data = []  # Would need to add method to get recent papers

            claims_data = [
                {
                    "statement": c.statement,
                    "category": c.category,
                    "confidence": c.confidence,
                    "status": c.status,
                }
                for c in claims
            ]

            trends_data = [
                {
                    "name": t.name,
                    "description": t.description,
                    "direction": t.direction,
                    "velocity": t.velocity,
                }
                for t in trends
            ]

            contradictions_data = [
                {
                    "claim1": c["claim1"].statement,
                    "claim2": c["claim2"].statement,
                    "strength": c["relation"].get("strength", 0.5),
                    "explanation": c["relation"].get("explanation", ""),
                }
                for c in contradictions
            ]

            predictions_data = [
                {
                    "statement": p.statement,
                    "confidence": p.confidence,
                    "timeframe": p.timeframe,
                    "due_date": p.due_date.isoformat() if p.due_date else None,
                }
                for p in predictions
            ]

            # Generate synthesis using Gemini
            synthesis = await gemini.synthesize_weekly(
                papers=papers_data,
                claims=claims_data,
                trends=trends_data,
                contradictions=contradictions_data,
                predictions=predictions_data,
            )

            # Build the report
            report = WeeklyReport(
                id=str(uuid4()),
                week_start=week_start,
                week_end=week_end,
                executive_summary=synthesis.get("executive_summary", ""),
                key_developments=[
                    d.get("title", "") + ": " + d.get("description", "")
                    for d in synthesis.get("key_developments", [])
                ],
                emerging_trends=[
                    {
                        "theme": t.get("theme", ""),
                        "evidence": t.get("evidence", ""),
                        "implications": t.get("implications", ""),
                    }
                    for t in synthesis.get("emerging_themes", [])
                ],
                notable_contradictions=[
                    {
                        "topic": c.get("topic", ""),
                        "positions": c.get("positions", []),
                        "analysis": c.get("analysis", ""),
                    }
                    for c in synthesis.get("notable_contradictions", [])
                ],
                new_predictions=[
                    {"statement": p["statement"], "confidence": p["confidence"]}
                    for p in predictions_data[:5]
                ],
                prediction_outcomes=[],  # Would include resolved predictions
                papers_analyzed=weekly_stats.get("new_papers", 0),
                claims_extracted=weekly_stats.get("new_claims", 0),
                contradictions_found=weekly_stats.get("new_contradictions", 0),
                predictions_made=weekly_stats.get("new_predictions", 0),
                calibration_score=prediction_accuracy.get("accuracy"),
                created_at=datetime.utcnow(),
            )

            # Create thought signature
            thought = await self.create_thought_signature(
                task=task,
                context_summary=f"Synthesized research from {week_start} to {week_end}",
                decision_made="Generated comprehensive weekly report",
                reasoning=f"Analyzed {len(claims)} claims, {len(trends)} trends, {len(contradictions)} contradictions",
                confidence=0.8,
                assumptions=[
                    "Data in knowledge graph is accurate",
                    "Gemini synthesis captures key insights",
                ],
                expected_outcomes=[
                    "Report provides actionable insights",
                    "Trends and predictions are tracked",
                ],
            )

            self.logger.info(
                "Weekly synthesis complete",
                report_id=report.id,
                claims=len(claims),
                trends=len(trends),
            )

            return AgentResult(
                success=True,
                data={
                    "report": report.model_dump(),
                    "outlook": synthesis.get("outlook", ""),
                },
                thought_signature=thought,
                metrics={
                    "claims_included": len(claims),
                    "trends_included": len(trends),
                    "contradictions_included": len(contradictions),
                    "predictions_tracked": len(predictions),
                },
            )

        except Exception as e:
            return await self._handle_error(e, task, {})

    async def format_report_markdown(self, report: WeeklyReport) -> str:
        """Format the report as markdown."""
        md = f"""# Weekly Research Synthesis Report

**Period:** {report.week_start} to {report.week_end}

---

## Executive Summary

{report.executive_summary}

---

## Key Developments

"""
        for dev in report.key_developments:
            md += f"- {dev}\n"

        md += """
---

## Emerging Trends

"""
        for trend in report.emerging_trends:
            md += f"### {trend.get('theme', 'Unnamed Trend')}\n\n"
            md += f"**Evidence:** {trend.get('evidence', 'N/A')}\n\n"
            if trend.get('implications'):
                md += f"**Implications:** {trend.get('implications')}\n\n"

        if report.notable_contradictions:
            md += """
---

## Notable Contradictions

"""
            for contradiction in report.notable_contradictions:
                md += f"### {contradiction.get('topic', 'Unnamed')}\n\n"
                md += "**Positions:**\n"
                for pos in contradiction.get('positions', []):
                    md += f"- {pos}\n"
                md += f"\n**Analysis:** {contradiction.get('analysis', 'N/A')}\n\n"

        md += """
---

## Statistics

| Metric | Value |
|--------|-------|
"""
        md += f"| Papers Analyzed | {report.papers_analyzed} |\n"
        md += f"| Claims Extracted | {report.claims_extracted} |\n"
        md += f"| Contradictions Found | {report.contradictions_found} |\n"
        md += f"| Predictions Made | {report.predictions_made} |\n"
        if report.calibration_score is not None:
            md += f"| Calibration Score | {report.calibration_score:.2%} |\n"

        md += f"""
---

*Report generated on {report.created_at.strftime('%Y-%m-%d %H:%M UTC')}*
"""

        return md

    async def check_prediction_outcomes(self, task: Task) -> AgentResult:
        """Check and update prediction outcomes."""
        try:
            kg = await self._get_kg()
            await self._get_gemini()

            # Get predictions that are due
            due_predictions = await kg.get_due_predictions()

            if not due_predictions:
                return AgentResult(
                    success=True,
                    data={"message": "No predictions due for review"},
                    metrics={"predictions_reviewed": 0},
                )

            self.logger.info("Reviewing due predictions", count=len(due_predictions))

            # Get recent claims and trends to evaluate predictions
            await kg.get_all_claims(limit=100)
            await kg.get_trends(limit=20)

            reviewed = 0
            outcomes = []

            for prediction in due_predictions:
                # Simple heuristic: check if prediction aligns with current trends/claims
                # In a real system, this would involve more sophisticated analysis

                # For now, mark as "unknown" and flag for human review
                await kg.update_prediction_outcome(
                    prediction_id=prediction.id,
                    outcome="unknown",
                    outcome_details="Requires human review to verify outcome",
                )

                outcomes.append({
                    "prediction": prediction.statement[:100],
                    "outcome": "unknown",
                    "needs_review": True,
                })
                reviewed += 1

            thought = await self.create_thought_signature(
                task=task,
                context_summary=f"Reviewed {reviewed} predictions that were due",
                decision_made="Marked predictions for human review",
                reasoning="Automated verification requires human judgment for accuracy",
                confidence=0.5,
                assumptions=["Predictions require contextual verification"],
                expected_outcomes=["Human reviewers will verify outcomes"],
            )

            return AgentResult(
                success=True,
                data={
                    "predictions_reviewed": reviewed,
                    "outcomes": outcomes,
                },
                thought_signature=thought,
                metrics={"predictions_reviewed": reviewed},
            )

        except Exception as e:
            return await self._handle_error(e, task, {})
