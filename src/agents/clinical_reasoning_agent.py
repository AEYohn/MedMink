"""Clinical Reasoning Agent — ReAct-style autonomous tool-use loop.

A MedGemma-powered agent that receives a clinical case and autonomously
decides which HAI-DEF foundation model tools to invoke and in what order.
Streams each reasoning step for real-time UI display.
"""

import asyncio
import json
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

import structlog

from src.medgemma.client import get_medgemma_client
from src.medgemma.cxr_foundation import get_cxr_foundation_client
from src.medgemma.derm_foundation import get_derm_foundation_client
from src.medgemma.path_foundation import get_path_foundation_client
from src.medgemma.hear_client import get_hear_client
from src.medgemma.txgemma import get_txgemma_client

logger = structlog.get_logger()

MAX_ITERATIONS = 5


@dataclass
class AgentStep:
    """A single step in the agent's reasoning trace."""
    step_number: int
    step_type: str  # "thinking" | "tool_call" | "tool_result" | "assessment"
    content: str
    tool_name: str | None = None
    tool_input: dict[str, Any] | None = None
    tool_output: dict[str, Any] | None = None


@dataclass
class AgentResult:
    """Final result from the reasoning agent."""
    steps: list[AgentStep] = field(default_factory=list)
    final_assessment: dict[str, Any] = field(default_factory=dict)
    tools_used: list[str] = field(default_factory=list)
    consensus: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# Tool definitions — each wraps an existing HAI-DEF client
# ---------------------------------------------------------------------------

TOOL_DESCRIPTIONS = {
    "analyze_chest_xray": {
        "description": "Analyze a chest X-ray image using CXR Foundation (google/cxr-foundation). Zero-shot classification for 13+ conditions including pneumothorax, pleural effusion, cardiomegaly, consolidation, pneumonia, pulmonary edema.",
        "requires": "chest_xray_b64",
        "model": "CXR Foundation",
    },
    "analyze_skin_lesion": {
        "description": "Analyze a skin lesion image using Derm Foundation (google/derm-foundation). Classifies melanoma vs benign, provides malignancy probability and urgency for dermatology referral.",
        "requires": "skin_image_b64",
        "model": "Derm Foundation",
    },
    "analyze_pathology": {
        "description": "Analyze a pathology/histology slide using Path Foundation (google/path-foundation). Classifies tissue type, tumor grade, and probability.",
        "requires": "pathology_image_b64",
        "model": "Path Foundation",
    },
    "screen_respiratory": {
        "description": "Screen respiratory audio (cough/breathing) using HeAR (google/hear-pytorch). Detects TB, COVID-19, COPD, asthma with >91% accuracy.",
        "requires": "audio_path",
        "model": "HeAR",
    },
    "check_drug_interactions": {
        "description": "Check drug-drug interactions and medication safety using hybrid deterministic + MedGemma approach. Detects major interactions, drug-disease conflicts, dosing concerns.",
        "requires": "medications in case",
        "model": "MedGemma + Deterministic",
    },
    "predict_drug_toxicity": {
        "description": "Predict drug toxicity profile using TxGemma (google/txgemma-9b-chat). Returns organ-specific risks and monitoring requirements for high-risk medications.",
        "requires": "drug name",
        "model": "TxGemma",
    },
    "compute_risk_scores": {
        "description": "Compute clinical risk scores (qSOFA, CURB-65, HEART, Wells, CHADS-VASc, etc.) using hybrid deterministic extraction + MedGemma for subjective variables.",
        "requires": "vitals/labs in case text",
        "model": "MedGemma + Deterministic",
    },
    "search_evidence": {
        "description": "Search PubMed for relevant clinical evidence, guidelines, and systematic reviews. Returns human-clinical studies filtered for relevance.",
        "requires": "clinical question",
        "model": "PubMed API",
    },
}


async def _execute_tool(
    tool_name: str,
    parameters: dict[str, Any],
    case_context: dict[str, Any],
) -> dict[str, Any]:
    """Execute a tool by name and return results."""
    try:
        if tool_name == "analyze_chest_xray":
            image_b64 = case_context.get("chest_xray_b64") or parameters.get("image_b64")
            if not image_b64:
                return {"error": "No chest X-ray image available"}
            client = get_cxr_foundation_client()
            if not client.is_available:
                return {"error": "CXR Foundation not configured", "available": False}
            conditions = parameters.get("conditions")
            return await client.classify_zero_shot(image_b64, conditions)

        elif tool_name == "analyze_skin_lesion":
            image_b64 = case_context.get("skin_image_b64") or parameters.get("image_b64")
            if not image_b64:
                return {"error": "No skin lesion image available"}
            client = get_derm_foundation_client()
            if not client.is_available:
                return {"error": "Derm Foundation not configured", "available": False}
            return await client.classify(image_b64)

        elif tool_name == "analyze_pathology":
            image_b64 = case_context.get("pathology_image_b64") or parameters.get("image_b64")
            if not image_b64:
                return {"error": "No pathology image available"}
            client = get_path_foundation_client()
            if not client.is_available:
                return {"error": "Path Foundation not configured", "available": False}
            return await client.classify_tissue(image_b64)

        elif tool_name == "screen_respiratory":
            audio_path = case_context.get("audio_path") or parameters.get("audio_path")
            if not audio_path:
                return {"error": "No respiratory audio available"}
            client = get_hear_client()
            if not client.is_available:
                return {"error": "HeAR not configured", "available": False}
            return await client.classify_respiratory(audio_path)

        elif tool_name == "check_drug_interactions":
            parsed = case_context.get("parsed_case", {})
            mgmt = parsed.get("management", {})
            patient = parsed.get("patient", {})
            findings = parsed.get("findings", {})
            current_meds = mgmt.get("medications", [])
            new_meds = parameters.get("new_medications", [])
            conditions = patient.get("relevant_history", [])
            allergies = parameters.get("allergies", [])
            labs = findings.get("labs", [])
            age = patient.get("age", "unknown")
            sex = patient.get("sex", "unknown")

            from src.medgemma.medication_safety import check_medication_safety
            result = await check_medication_safety(
                current_medications=current_meds,
                new_medications=new_meds,
                patient_conditions=conditions,
                allergies=allergies,
                labs=labs,
                age=age,
                sex=sex,
            )
            return result.to_dict() if hasattr(result, "to_dict") else {"result": str(result)}

        elif tool_name == "predict_drug_toxicity":
            drug = parameters.get("drug", "")
            if not drug:
                return {"error": "No drug name provided"}
            client = get_txgemma_client()
            if not client.is_available:
                return {"error": "TxGemma not configured", "available": False}
            return await client.predict_toxicity(drug)

        elif tool_name == "compute_risk_scores":
            parsed = case_context.get("parsed_case", {})
            case_text = case_context.get("case_text", "")
            from src.medgemma.risk_scores import calculate_risk_scores, risk_score_report_to_dict
            report = await calculate_risk_scores(parsed, case_text)
            return risk_score_report_to_dict(report)

        elif tool_name == "search_evidence":
            query = parameters.get("query", "")
            if not query:
                return {"error": "No search query provided"}
            from src.agents.ingest_pubmed import search_pubmed_papers
            papers = await search_pubmed_papers(query=query, max_results=5)
            return {
                "papers_found": len(papers),
                "papers": [
                    {
                        "title": p.title,
                        "authors": p.authors[:3] if p.authors else [],
                        "year": p.published_date[:4] if p.published_date else "N/A",
                        "abstract": (p.abstract or "")[:300],
                        "pmid": p.external_id or "",
                    }
                    for p in papers[:5]
                ],
            }

        else:
            return {"error": f"Unknown tool: {tool_name}"}

    except Exception as e:
        logger.error("Tool execution failed", tool=tool_name, error=str(e))
        return {"error": f"Tool execution failed: {str(e)}"}


def _build_available_tools_prompt(case_context: dict[str, Any]) -> str:
    """Build the tools description section based on available data."""
    lines = ["Available tools:"]
    for name, desc in TOOL_DESCRIPTIONS.items():
        available = True
        note = ""
        if name == "analyze_chest_xray" and not case_context.get("chest_xray_b64"):
            note = " [no CXR image provided]"
        elif name == "analyze_skin_lesion" and not case_context.get("skin_image_b64"):
            note = " [no skin image provided]"
        elif name == "analyze_pathology" and not case_context.get("pathology_image_b64"):
            note = " [no pathology image provided]"
        elif name == "screen_respiratory" and not case_context.get("audio_path"):
            note = " [no audio provided]"
        lines.append(f"  - {name}: {desc['description']}{note}")
    return "\n".join(lines)


def _build_system_prompt() -> str:
    return """You are a clinical reasoning agent with access to specialized medical AI tools.

Your task: Given a clinical case, autonomously decide which tools to invoke and in what order to build a comprehensive assessment.

PROCESS:
1. Analyze the case to identify what information is needed
2. Choose the most relevant tool to call next
3. After each tool result, reason about what you've learned and what to do next
4. When you have enough information, produce a final assessment

OUTPUT FORMAT — you MUST output ONLY valid JSON in one of these two formats:

To call a tool:
{"reasoning": "Brief explanation of why this tool is needed", "tool": "tool_name", "parameters": {"key": "value"}}

When done (after gathering enough information):
{"reasoning": "Final synthesis of all findings", "tool": "DONE", "final_assessment": {"primary_diagnosis": "...", "confidence": 0.0-1.0, "key_findings": ["..."], "disposition": "...", "recommended_actions": ["..."]}}

IMPORTANT:
- Output ONLY JSON, no other text
- Call the most impactful tools first
- If a tool requires data not available (no image, no audio), skip it
- Always call compute_risk_scores if vitals/labs are present
- Always call check_drug_interactions if medications are mentioned
- Call search_evidence for unclear or complex diagnostic questions
- After 2-3 tool calls, consider whether you have enough information to conclude"""


async def run_reasoning_agent(
    case_text: str,
    parsed_case: dict[str, Any] | None = None,
    chest_xray_b64: str | None = None,
    skin_image_b64: str | None = None,
    pathology_image_b64: str | None = None,
    audio_path: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Run the clinical reasoning agent and yield step-by-step events.

    Yields dicts with type: "thinking" | "tool_call" | "tool_result" | "assessment" | "consensus" | "done" | "error"
    """
    medgemma = get_medgemma_client()

    case_context = {
        "case_text": case_text,
        "parsed_case": parsed_case or {},
        "chest_xray_b64": chest_xray_b64,
        "skin_image_b64": skin_image_b64,
        "pathology_image_b64": pathology_image_b64,
        "audio_path": audio_path,
    }

    tools_prompt = _build_available_tools_prompt(case_context)
    system_prompt = _build_system_prompt()

    # Build conversation context that grows with each iteration
    conversation = [f"Clinical Case:\n{case_text}\n\n{tools_prompt}"]
    model_results: list[dict[str, Any]] = []
    tools_used: list[str] = []
    steps: list[AgentStep] = []
    step_number = 0

    for iteration in range(MAX_ITERATIONS):
        step_number += 1
        full_prompt = "\n\n".join(conversation)

        # Get MedGemma's decision
        try:
            raw_response = await medgemma.generate(
                prompt=full_prompt,
                system_prompt=system_prompt,
                temperature=0.2,
                max_tokens=1024,
            )
        except Exception as e:
            logger.error("Agent MedGemma call failed", error=str(e), iteration=iteration)
            yield {"type": "error", "message": f"Agent reasoning failed: {str(e)}"}
            return

        # Parse the JSON response
        try:
            decision = medgemma._parse_json_response(raw_response)
            if not decision:
                # Try direct JSON parse
                decision = json.loads(raw_response.strip())
        except (json.JSONDecodeError, Exception):
            # If MedGemma didn't output valid JSON, try to extract it
            try:
                # Find JSON in the response
                start = raw_response.find("{")
                end = raw_response.rfind("}") + 1
                if start >= 0 and end > start:
                    decision = json.loads(raw_response[start:end])
                else:
                    logger.warning("Agent produced non-JSON output", response=raw_response[:200])
                    yield {"type": "error", "message": "Agent reasoning produced invalid output"}
                    return
            except json.JSONDecodeError:
                logger.warning("Agent JSON extraction failed", response=raw_response[:200])
                yield {"type": "error", "message": "Agent reasoning produced invalid output"}
                return

        reasoning = decision.get("reasoning", "")
        tool_name = decision.get("tool", "")

        # Yield thinking step
        thinking_step = AgentStep(
            step_number=step_number,
            step_type="thinking",
            content=reasoning,
        )
        steps.append(thinking_step)
        yield {
            "type": "thinking",
            "step": step_number,
            "reasoning": reasoning,
            "iteration": iteration + 1,
        }

        # Check if agent is done
        if tool_name == "DONE":
            final_assessment = decision.get("final_assessment", {})

            assessment_step = AgentStep(
                step_number=step_number,
                step_type="assessment",
                content=json.dumps(final_assessment),
            )
            steps.append(assessment_step)

            yield {
                "type": "assessment",
                "step": step_number,
                "final_assessment": final_assessment,
                "tools_used": tools_used,
            }

            # Build consensus if multiple models contributed
            if len(model_results) >= 2:
                try:
                    from src.medgemma.multimodal_consensus import build_consensus
                    consensus = await build_consensus(case_text, model_results)
                    yield {
                        "type": "consensus",
                        "step": step_number + 1,
                        "consensus": consensus,
                    }
                except Exception as e:
                    logger.warning("Consensus building failed", error=str(e))

            yield {"type": "done", "total_steps": step_number, "tools_used": tools_used}
            return

        # Execute the tool
        if tool_name not in TOOL_DESCRIPTIONS:
            conversation.append(f"Error: Unknown tool '{tool_name}'. Available tools: {list(TOOL_DESCRIPTIONS.keys())}")
            continue

        parameters = decision.get("parameters", {})

        tool_call_step = AgentStep(
            step_number=step_number,
            step_type="tool_call",
            content=f"Calling {tool_name}",
            tool_name=tool_name,
            tool_input=parameters,
        )
        steps.append(tool_call_step)

        yield {
            "type": "tool_call",
            "step": step_number,
            "tool": tool_name,
            "parameters": parameters,
            "model": TOOL_DESCRIPTIONS[tool_name]["model"],
        }

        # Execute
        tool_output = await _execute_tool(tool_name, parameters, case_context)
        tools_used.append(tool_name)

        # Track results for consensus
        model_results.append({
            "tool": tool_name,
            "model": TOOL_DESCRIPTIONS[tool_name]["model"],
            "output": tool_output,
        })

        tool_result_step = AgentStep(
            step_number=step_number,
            step_type="tool_result",
            content=json.dumps(tool_output),
            tool_name=tool_name,
            tool_output=tool_output,
        )
        steps.append(tool_result_step)

        yield {
            "type": "tool_result",
            "step": step_number,
            "tool": tool_name,
            "result": tool_output,
        }

        # Append to conversation for next iteration
        # Truncate large outputs to keep context manageable
        output_summary = json.dumps(tool_output)
        if len(output_summary) > 1500:
            output_summary = output_summary[:1500] + "..."
        conversation.append(f"Tool: {tool_name}\nResult: {output_summary}\n\nBased on this result, decide what to do next.")

    # Max iterations reached — force conclusion
    yield {
        "type": "thinking",
        "step": step_number + 1,
        "reasoning": "Maximum iterations reached. Synthesizing available findings.",
        "iteration": MAX_ITERATIONS,
    }
    yield {
        "type": "assessment",
        "step": step_number + 1,
        "final_assessment": {
            "primary_diagnosis": "Assessment incomplete — max iterations reached",
            "confidence": 0.5,
            "key_findings": [f"Analyzed using: {', '.join(tools_used)}"],
            "disposition": "Requires clinician review",
            "recommended_actions": ["Complete clinical evaluation"],
        },
        "tools_used": tools_used,
    }

    if len(model_results) >= 2:
        try:
            from src.medgemma.multimodal_consensus import build_consensus
            consensus = await build_consensus(case_text, model_results)
            yield {"type": "consensus", "step": step_number + 2, "consensus": consensus}
        except Exception as e:
            logger.warning("Consensus building failed", error=str(e))

    yield {"type": "done", "total_steps": step_number + 1, "tools_used": tools_used}
