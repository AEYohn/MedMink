"""Cross-Modal Diagnostic Consensus — synthesizes findings from multiple AI models.

When a patient has multiple data modalities (CXR + cough audio + labs + meds),
models run independently. This module feeds all outputs into MedGemma to identify
areas of agreement, disagreement, and produce an integrated assessment.
"""

import json
from typing import Any

import structlog

from src.medgemma.client import get_medgemma_client

logger = structlog.get_logger()

CONSENSUS_SYSTEM_PROMPT = """You are a senior clinical AI synthesizer. You receive independent assessments from multiple specialized medical AI models analyzing the same patient case.

Your task: Identify areas of agreement, disagreement, and synthesize a unified clinical assessment.

Output ONLY valid JSON in this exact format:
{
  "agreements": [
    {"finding": "description of agreed finding", "models": ["Model1", "Model2"], "confidence": 0.0-1.0}
  ],
  "disagreements": [
    {"finding": "description of disagreement", "model_a": {"name": "Model1", "position": "..."}, "model_b": {"name": "Model2", "position": "..."}, "resolution": "clinical reasoning to resolve"}
  ],
  "integrated_assessment": "2-3 sentence unified clinical synthesis",
  "overall_confidence": 0.0-1.0,
  "contributing_models": ["Model1", "Model2"],
  "recommended_next_steps": ["step 1", "step 2"]
}"""


async def build_consensus(
    case_text: str,
    model_results: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build a cross-modal diagnostic consensus from multiple model outputs.

    Args:
        case_text: Original clinical case text
        model_results: List of dicts with keys: tool, model, output

    Returns:
        ConsensusReport dict with agreements, disagreements, integrated assessment
    """
    if len(model_results) < 2:
        return {
            "agreements": [],
            "disagreements": [],
            "integrated_assessment": "Insufficient data for cross-modal consensus (need 2+ models).",
            "overall_confidence": 0.0,
            "contributing_models": [r["model"] for r in model_results],
            "recommended_next_steps": [],
        }

    # Build prompt with each model's output
    model_sections = []
    for i, result in enumerate(model_results, 1):
        output_str = json.dumps(result["output"])
        # Truncate very large outputs
        if len(output_str) > 2000:
            output_str = output_str[:2000] + "..."
        model_sections.append(
            f"Model {i}: {result['model']} (tool: {result['tool']})\n"
            f"Output: {output_str}"
        )

    prompt = (
        f"Clinical Case:\n{case_text[:1500]}\n\n"
        f"Independent Model Assessments:\n\n"
        + "\n\n".join(model_sections)
        + "\n\nSynthesize these findings into a unified consensus assessment."
    )

    medgemma = get_medgemma_client()
    try:
        response = await medgemma.generate(
            prompt=prompt,
            system_prompt=CONSENSUS_SYSTEM_PROMPT,
            temperature=0.2,
            max_tokens=2000,
        )

        consensus = medgemma._parse_json_response(response)
        if not consensus:
            try:
                start = response.find("{")
                end = response.rfind("}") + 1
                if start >= 0 and end > start:
                    consensus = json.loads(response[start:end])
            except json.JSONDecodeError:
                pass

        if not consensus:
            logger.warning("Consensus generation produced non-JSON", response=response[:200])
            return _fallback_consensus(model_results)

        # Ensure required fields
        consensus.setdefault("agreements", [])
        consensus.setdefault("disagreements", [])
        consensus.setdefault("integrated_assessment", "")
        consensus.setdefault("overall_confidence", 0.5)
        consensus.setdefault("contributing_models", [r["model"] for r in model_results])
        consensus.setdefault("recommended_next_steps", [])

        return consensus

    except Exception as e:
        logger.error("Consensus generation failed", error=str(e))
        return _fallback_consensus(model_results)


def _fallback_consensus(model_results: list[dict[str, Any]]) -> dict[str, Any]:
    """Produce a minimal consensus when MedGemma synthesis fails."""
    models = [r["model"] for r in model_results]
    return {
        "agreements": [],
        "disagreements": [],
        "integrated_assessment": f"Cross-modal synthesis unavailable. Individual assessments from {', '.join(models)} should be reviewed independently.",
        "overall_confidence": 0.0,
        "contributing_models": models,
        "recommended_next_steps": ["Review individual model outputs manually"],
    }
