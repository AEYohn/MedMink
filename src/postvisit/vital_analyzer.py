"""AI-powered vital trend analysis and alerting.

Analyzes patient vital readings using Claude to detect concerning
trends, considering medications, diagnosis, and patient context.
"""

import json
import os
from typing import Any

import httpx
import structlog

logger = structlog.get_logger()

VITAL_ANALYSIS_SYSTEM_PROMPT = """You are a clinical decision support system analyzing patient vital sign data.
You have access to the patient's recent diagnosis, medications, and medical history.

Your job is to:
1. Identify concerning trends in vital signs
2. Consider medication effects (e.g., beta-blocker → expected HR decrease)
3. Flag values that are outside expected ranges for this patient
4. Provide clear, actionable alerts with severity levels
5. Write a brief narrative summary of the vital trends

Respond with JSON only:
{
  "alerts": [
    {
      "severity": "info|warning|critical",
      "vital_type": "heart_rate|blood_pressure_systolic|...",
      "message": "Clear description of what was detected",
      "trigger_value": 48,
      "recommendation": "What the patient should do"
    }
  ],
  "summary": "Brief narrative of vital trends in plain language",
  "trends": {
    "heart_rate": "Description of heart rate trend",
    "blood_pressure_systolic": "Description of BP trend"
  }
}"""


def _compute_stats(readings: list[dict]) -> dict[str, Any]:
    """Compute basic statistics for a set of readings."""
    if not readings:
        return {"min": 0, "max": 0, "mean": 0, "trend": "stable", "count": 0}

    values = [r["value"] for r in readings if r.get("value") is not None]
    if not values:
        return {"min": 0, "max": 0, "mean": 0, "trend": "stable", "count": 0}

    # Determine trend using simple linear slope
    trend = "stable"
    if len(values) >= 3:
        first_half = values[: len(values) // 2]
        second_half = values[len(values) // 2 :]
        first_avg = sum(first_half) / len(first_half)
        second_avg = sum(second_half) / len(second_half)
        diff_pct = (second_avg - first_avg) / first_avg * 100 if first_avg != 0 else 0
        if diff_pct > 5:
            trend = "increasing"
        elif diff_pct < -5:
            trend = "decreasing"

    return {
        "min": min(values),
        "max": max(values),
        "mean": round(sum(values) / len(values), 1),
        "trend": trend,
        "count": len(values),
    }


def group_readings_by_type(readings: list[dict]) -> dict[str, list[dict]]:
    """Group vital readings by type."""
    by_type: dict[str, list[dict]] = {}
    for r in readings:
        vtype = r.get("vital_type", "unknown")
        by_type.setdefault(vtype, []).append(r)
    # Sort each group by timestamp
    for vtype in by_type:
        by_type[vtype].sort(key=lambda x: x.get("recorded_at", ""))
    return by_type


async def analyze_vitals(
    patient_context: str,
    readings: list[dict[str, Any]],
) -> dict[str, Any]:
    """Analyze vital readings using Claude AI.

    Args:
        patient_context: Formatted patient context string (diagnosis, meds, etc.)
        readings: List of vital reading dicts with vital_type, value, unit, recorded_at

    Returns:
        Dict with alerts, summary, and trend descriptions
    """
    if not readings:
        return {"alerts": [], "summary": "No vital readings to analyze.", "trends": {}}

    grouped = group_readings_by_type(readings)

    # Build vitals summary for the prompt
    vitals_text = []
    for vtype, type_readings in grouped.items():
        stats = _compute_stats(type_readings)
        values_str = ", ".join(
            f"{r['value']}{r.get('unit', '')} ({r.get('recorded_at', '?')})"
            for r in type_readings[-10:]  # Last 10 readings per type
        )
        vitals_text.append(
            f"{vtype}: {values_str}\n"
            f"  Stats: min={stats['min']}, max={stats['max']}, mean={stats['mean']}, "
            f"trend={stats['trend']}, n={stats['count']}"
        )

    prompt = (
        f"Patient context:\n{patient_context}\n\n"
        f"Recent vital readings:\n" + "\n".join(vitals_text) + "\n\n"
        "Analyze these vitals considering the patient's diagnosis and medications. "
        "Output ONLY the JSON response."
    )

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        logger.warning("No ANTHROPIC_API_KEY set, returning statistical analysis only")
        return _fallback_analysis(grouped)

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 2048,
                    "system": VITAL_ANALYSIS_SYSTEM_PROMPT,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            text = data["content"][0]["text"]

            # Parse JSON from response
            try:
                result = json.loads(text)
            except json.JSONDecodeError:
                # Try to extract JSON from markdown code block
                if "```json" in text:
                    json_str = text.split("```json")[1].split("```")[0].strip()
                    result = json.loads(json_str)
                elif "```" in text:
                    json_str = text.split("```")[1].split("```")[0].strip()
                    result = json.loads(json_str)
                else:
                    raise

            return {
                "alerts": result.get("alerts", []),
                "summary": result.get("summary", ""),
                "trends": result.get("trends", {}),
            }
    except Exception as e:
        logger.error("Vital analysis failed, using fallback", error=str(e))
        return _fallback_analysis(grouped)


def _fallback_analysis(grouped: dict[str, list[dict]]) -> dict[str, Any]:
    """Statistical-only fallback when AI is unavailable."""
    # Reference ranges
    ranges = {
        "heart_rate": (60, 100),
        "blood_pressure_systolic": (90, 140),
        "blood_pressure_diastolic": (60, 90),
        "temperature": (36.1, 37.2),
        "spo2": (95, 100),
        "blood_glucose": (70, 140),
    }

    alerts = []
    trends = {}

    for vtype, type_readings in grouped.items():
        stats = _compute_stats(type_readings)
        trends[vtype] = f"Trend: {stats['trend']}, range: {stats['min']}-{stats['max']}, mean: {stats['mean']}"

        if vtype in ranges:
            low, high = ranges[vtype]
            latest = type_readings[-1]["value"] if type_readings else None
            if latest is not None:
                if latest < low:
                    alerts.append({
                        "severity": "warning",
                        "vital_type": vtype,
                        "message": f"{vtype.replace('_', ' ').title()} is below normal range ({latest} < {low})",
                        "trigger_value": latest,
                        "recommendation": "Monitor closely and contact your healthcare provider if symptoms develop.",
                    })
                elif latest > high:
                    alerts.append({
                        "severity": "warning",
                        "vital_type": vtype,
                        "message": f"{vtype.replace('_', ' ').title()} is above normal range ({latest} > {high})",
                        "trigger_value": latest,
                        "recommendation": "Monitor closely and contact your healthcare provider if symptoms develop.",
                    })

    summary_parts = [f"{vtype}: {desc}" for vtype, desc in trends.items()]
    return {
        "alerts": alerts,
        "summary": "Statistical analysis (AI unavailable): " + "; ".join(summary_parts) if summary_parts else "No data.",
        "trends": trends,
    }
