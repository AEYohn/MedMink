"""API routes for clinical case analysis."""

import asyncio
import base64
import json
import random
from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import structlog

from src.medgemma.case_analyzer import get_case_analyzer
from src.medgemma.client import get_medgemma_client
from src.medgemma.vision import get_vision_client
from src.medgemma.differential_diagnosis import (
    generate_differential_diagnosis,
    ddx_result_to_dict,
)
from src.medgemma.medication_safety import (
    check_medication_safety,
    safety_result_to_dict,
)
from src.medgemma.discharge_planner import (
    generate_discharge_plan,
    discharge_plan_to_dict,
)
from src.medgemma.referral_generator import (
    generate_referral_note,
    generate_handoff_note,
    referral_note_to_dict,
    handoff_note_to_dict,
)
from src.medgemma.risk_scores import (
    calculate_risk_scores,
    risk_score_report_to_dict,
)
from src.medgemma.cxr_foundation import get_cxr_foundation_client
from src.medgemma.derm_foundation import get_derm_foundation_client
from src.medgemma.path_foundation import get_path_foundation_client
from src.medgemma.txgemma import get_txgemma_client

logger = structlog.get_logger()
router = APIRouter(prefix="/api/case", tags=["case-analysis"])


class CaseAnalysisRequest(BaseModel):
    """Request for clinical case analysis."""
    case_text: str = Field(..., min_length=50, description="Clinical vignette text")


class CaseAnalysisResponse(BaseModel):
    """Response from case analysis."""
    parsed_case: dict[str, Any]
    treatment_options: list[dict[str, Any]]
    top_recommendation: str
    recommendation_rationale: str
    clinical_pearls: list[str]
    papers_reviewed: list[dict[str, Any]]
    search_terms_used: list[str]
    acute_management: dict[str, Any] = {}
    suggested_followups: list[str] = []
    medication_review: dict[str, Any] = {}
    clinical_risk_scores: dict[str, Any] = {}


class CaseFollowUpRequest(BaseModel):
    """Request for follow-up question about a case analysis."""
    case_text: str = Field(..., min_length=10)
    analysis_summary: dict[str, Any]
    question: str = Field(..., min_length=5, max_length=2000)
    conversation_history: list[dict[str, str]] = Field(default_factory=list)


class CaseReassessmentRequest(BaseModel):
    """Request for reassessing a case with new findings."""
    original_case_text: str = Field(..., min_length=50)
    new_findings: list[dict[str, Any]] = Field(..., min_length=1)
    previous_parsed_case: dict[str, Any] = Field(...)
    previous_search_terms: list[str] = Field(default_factory=list)
    previous_papers: list[dict[str, Any]] = Field(default_factory=list)


class CaseFollowUpResponse(BaseModel):
    """Response to a follow-up question."""
    answer: str
    suggested_questions: list[str] = []


async def case_analysis_stream_generator(case_text: str):
    """Generate SSE stream for case analysis.

    Uses an async queue with heartbeat to keep the SSE connection alive
    during long model inference calls.
    """
    analyzer = get_case_analyzer()
    queue: asyncio.Queue = asyncio.Queue()
    done_event = asyncio.Event()

    async def _produce():
        try:
            async for update in analyzer.analyze_case(case_text):
                await queue.put(update)
            await queue.put({"type": "done"})
        except Exception as e:
            logger.error("Case analysis stream failed", error=str(e))
            await queue.put({"type": "error", "message": str(e)})
        finally:
            done_event.set()

    producer = asyncio.create_task(_produce())

    try:
        while not done_event.is_set() or not queue.empty():
            try:
                update = await asyncio.wait_for(queue.get(), timeout=15)
                yield f"data: {json.dumps(update)}\n\n"
                if update.get("type") in ("done", "error"):
                    break
            except asyncio.TimeoutError:
                # Send SSE comment as keepalive to prevent browser timeout
                yield ": heartbeat\n\n"
    finally:
        producer.cancel()


@router.post("/analyze/stream")
async def analyze_case_stream(request: CaseAnalysisRequest):
    """Analyze a clinical case with streaming progress updates.

    Returns Server-Sent Events (SSE) stream with:
    - step: Progress updates (parsing, generating_options, evidence_search, evaluating)
    - result: Final analysis with treatment options
    - error: If analysis fails
    - done: Stream complete
    """
    return StreamingResponse(
        case_analysis_stream_generator(request.case_text),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/analyze", response_model=CaseAnalysisResponse)
async def analyze_case(request: CaseAnalysisRequest):
    """Analyze a clinical case (non-streaming).

    Returns full analysis result when complete.
    """
    analyzer = get_case_analyzer()

    result = None
    async for update in analyzer.analyze_case(request.case_text):
        if update.get("type") == "result":
            result = update.get("data")
        elif update.get("type") == "error":
            raise HTTPException(status_code=500, detail=update.get("message"))

    if result is None:
        raise HTTPException(status_code=500, detail="Analysis failed to produce result")

    return CaseAnalysisResponse(**result)


FOLLOWUP_SYSTEM_PROMPT = """You are a clinical reasoning assistant helping a physician interpret a case analysis.
Reference specific findings from the case. Be thorough on drug interactions.
Never fabricate evidence or citations. Keep answers clinically actionable.
If you don't know something, say so clearly.
Respond in plain text. Be concise but thorough."""


def _generate_followup_suggestions(
    case_category: str,
    top_recommendation: str,
    treatment_options: list[dict],
    question: str,
) -> list[str]:
    """Generate context-aware follow-up suggestions deterministically (no LLM call)."""
    suggestions = []

    # Based on the question topic, suggest related questions
    q_lower = question.lower()

    if "interaction" in q_lower or "combine" in q_lower:
        suggestions.append("What monitoring is needed for these drug combinations?")
    elif "alternative" in q_lower or "can't tolerate" in q_lower or "allergy" in q_lower:
        suggestions.append("What are the second-line options if the patient fails this therapy?")
    elif "dose" in q_lower or "dosing" in q_lower:
        suggestions.append("Does this dose need adjustment for renal or hepatic impairment?")
    elif "side effect" in q_lower or "adverse" in q_lower:
        suggestions.append("How should we monitor for these side effects?")

    # Always useful clinical questions
    if top_recommendation:
        suggestions.append(f"When should we expect clinical improvement with {top_recommendation}?")

    not_rec = [t for t in treatment_options if t.get("verdict") == "not_recommended"]
    if not_rec and f"not recommended" not in q_lower:
        suggestions.append(f"Why was {not_rec[0].get('name', 'that option')} rated not recommended?")

    if "discharge" not in q_lower and "disposition" not in q_lower:
        suggestions.append("What are the discharge criteria and follow-up plan?")

    return suggestions[:3]


@router.post("/followup", response_model=CaseFollowUpResponse)
async def case_followup(request: CaseFollowUpRequest):
    """Answer a follow-up question about a case analysis."""
    medgemma = get_medgemma_client()

    # Build COMPACT context — key issue was prompt too large for 4B model
    case_snippet = request.case_text[:500]
    if len(request.case_text) > 500:
        case_snippet += "..."

    # Compact treatment summary: name (verdict) only
    treatments_compact = ", ".join(
        f"{t.get('name', '?')} ({t.get('verdict', '?')})"
        for t in request.analysis_summary.get("treatment_options", [])
    )

    top_rec = request.analysis_summary.get("top_recommendation", "None")
    rationale = request.analysis_summary.get("recommendation_rationale", "")
    if len(rationale) > 200:
        rationale = rationale[:200] + "..."

    # Compact acute management: disposition + monitoring only
    acute_mgmt = request.analysis_summary.get("acute_management", {})
    acute_bits = []
    if acute_mgmt.get("disposition"):
        acute_bits.append(f"Disposition: {acute_mgmt['disposition']}")
    if acute_mgmt.get("monitoring_plan"):
        acute_bits.append(f"Monitoring: {', '.join(acute_mgmt['monitoring_plan'][:3])}")
    acute_compact = "; ".join(acute_bits)

    # Last 4 messages only
    history_text = ""
    for msg in request.conversation_history[-4:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if len(content) > 300:
            content = content[:300] + "..."
        history_text += f"{role.upper()}: {content}\n"

    prompt = f"""CASE: {case_snippet}

ANALYSIS: Top pick: {top_rec}. Rationale: {rationale}
Treatments: {treatments_compact}
{f'Acute: {acute_compact}' if acute_compact else ''}

{f'HISTORY:{chr(10)}{history_text}' if history_text else ''}
QUESTION: {request.question}"""

    try:
        response = await medgemma.generate(
            prompt=prompt,
            system_prompt=FOLLOWUP_SYSTEM_PROMPT,
            temperature=0.3,
            max_tokens=1024,
        )

        # Clean thinking tokens from response
        response = medgemma._clean_response(response)

        # If model still produced JSON, extract the answer
        if response.strip().startswith("{"):
            try:
                data = json.loads(response)
                answer = data.get("answer", response)
            except json.JSONDecodeError:
                answer = response
        else:
            answer = response

        # Strip empty / unhelpful responses
        if not answer or len(answer.strip()) < 10:
            answer = "I don't have enough context to answer that question specifically. Could you rephrase or ask about a particular treatment option?"

        # Deterministic follow-up suggestions
        suggestions = _generate_followup_suggestions(
            case_category=request.analysis_summary.get("parsed_case", {}).get("case_category", ""),
            top_recommendation=top_rec,
            treatment_options=request.analysis_summary.get("treatment_options", []),
            question=request.question,
        )

        return CaseFollowUpResponse(answer=answer, suggested_questions=suggestions)

    except Exception as e:
        logger.error("Follow-up generation failed", error=str(e))
        # Return graceful error as answer text (HTTP 200), not HTTP 500
        return CaseFollowUpResponse(
            answer=f"I encountered an issue generating a response. Please try rephrasing your question. (Error: {str(e)[:100]})",
            suggested_questions=["Can you explain the top recommendation?", "What are the key drug interactions?"],
        )


async def case_reassessment_stream_generator(request: CaseReassessmentRequest):
    """Generate SSE stream for case reassessment with new findings."""
    analyzer = get_case_analyzer()
    queue: asyncio.Queue = asyncio.Queue()
    done_event = asyncio.Event()

    async def _produce():
        try:
            async for update in analyzer.reassess_case(
                original_case_text=request.original_case_text,
                new_findings=request.new_findings,
                previous_parsed_case=request.previous_parsed_case,
                previous_search_terms=request.previous_search_terms,
                previous_papers=request.previous_papers,
            ):
                await queue.put(update)
            await queue.put({"type": "done"})
        except Exception as e:
            logger.error("Case reassessment stream failed", error=str(e))
            await queue.put({"type": "error", "message": str(e)})
        finally:
            done_event.set()

    producer = asyncio.create_task(_produce())

    try:
        while not done_event.is_set() or not queue.empty():
            try:
                update = await asyncio.wait_for(queue.get(), timeout=15)
                yield f"data: {json.dumps(update)}\n\n"
                if update.get("type") in ("done", "error"):
                    break
            except asyncio.TimeoutError:
                yield ": heartbeat\n\n"
    finally:
        producer.cancel()


@router.post("/reassess/stream")
async def reassess_case_stream(request: CaseReassessmentRequest):
    """Reassess a clinical case with new findings (SSE stream).

    Takes the original case, new findings (labs, imaging, vitals, etc.),
    and previous analysis context. Returns updated treatment options
    and management plan.
    """
    return StreamingResponse(
        case_reassessment_stream_generator(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


class ImageAnalysisResponse(BaseModel):
    """Response from image analysis."""
    modality: str = ""
    findings: list[str] = []
    impression: str = ""
    differential_diagnoses: list[str] = []
    confidence: float = 0.0
    recommendations: list[str] = []
    model: str = ""


@router.post("/image/analyze", response_model=ImageAnalysisResponse)
async def analyze_image(
    image: UploadFile = File(...),
    context: str = Form(default=""),
    modality: str = Form(default=""),
):
    """Analyze a medical image using MedGemma multimodal.

    Accepts multipart form data with an image file and optional clinical context.
    Returns structured analysis with findings, impression, and differential diagnoses.
    """
    vision = get_vision_client()

    # Read and encode image
    image_data = await image.read()
    if len(image_data) > 20 * 1024 * 1024:  # 20MB limit
        raise HTTPException(status_code=413, detail="Image too large (max 20MB)")

    image_b64 = base64.b64encode(image_data).decode("utf-8")

    # Detect content type
    content_type = image.content_type or "image/png"
    image_b64_uri = f"data:{content_type};base64,{image_b64}"

    result = await vision.analyze_image(
        image_b64=image_b64_uri,
        clinical_context=context,
        modality=modality or None,
        filename=image.filename or "",
    )

    return ImageAnalysisResponse(
        modality=result.get("modality", ""),
        findings=result.get("findings", []),
        impression=result.get("impression", ""),
        differential_diagnoses=result.get("differential_diagnoses", []),
        confidence=result.get("confidence", 0.0),
        recommendations=result.get("recommendations", []),
        model=result.get("model", ""),
    )


EXAMPLE_CASES = {
    "musculoskeletal": """A 21-year-old male college student presents with progressive neck stiffness and pain for the past 3 days. He reports difficulty turning his head to the left. No fever, no trauma history. He spends 8+ hours daily on his laptop. Physical exam shows limited cervical range of motion, tenderness over the left trapezius and sternocleidomastoid muscles, no neurological deficits. No meningeal signs.""",

    "cardiology": """A 62-year-old female with history of hypertension and hyperlipidemia presents with substernal chest pressure radiating to her left jaw for the past 45 minutes. She is diaphoretic and nauseated. Vitals: BP 165/95, HR 102, SpO2 96% on room air. ECG shows ST-segment elevation in leads II, III, and aVF. Troponin I is 2.4 ng/mL (normal <0.04).""",

    "infectious_disease": """A 35-year-old female presents with 3 days of dysuria, urinary frequency, and suprapubic pain. She denies fever, flank pain, or vaginal discharge. No history of recurrent UTIs. Urinalysis shows positive leukocyte esterase, positive nitrites, and >50 WBC/hpf. She has no drug allergies.""",

    "neurology": """A 45-year-old male presents with the worst headache of his life, onset 2 hours ago while lifting weights. He reports neck stiffness and photophobia. Vital signs: BP 180/100, HR 90. Neurological exam shows no focal deficits but positive Kernig's and Brudzinski's signs. Non-contrast CT head is negative.""",

    "psychiatry": """A 28-year-old female presents with 4 weeks of persistent low mood, anhedonia, poor sleep with early morning awakening, decreased appetite with 8-pound weight loss, difficulty concentrating at work, and passive suicidal ideation without plan or intent. PHQ-9 score is 18. No prior psychiatric history. No substance use.""",

    "endocrinology": """A 48-year-old male with a 15-year history of HIV, well-controlled on antiretroviral therapy (viral load undetectable, CD4 count 620 cells/mm³), presents with progressive truncal obesity over the past 2 years despite regular exercise and a balanced diet. Physical examination reveals increased abdominal girth with relatively thin extremities. CT imaging confirms a significant increase in visceral adipose tissue. His BMI is 27 kg/m² and fasting glucose is 108 mg/dL. His current antiretroviral regimen was recently switched from an older protease inhibitor-based regimen to an integrase inhibitor-based regimen, but the abdominal fat accumulation has not improved after 12 months.""",

    "pulmonology": """A 55-year-old male with a 30 pack-year smoking history presents with worsening dyspnea on exertion over the past 6 months. He now gets short of breath walking up one flight of stairs. He has a chronic productive cough with white sputum. PFTs show FEV1/FVC ratio of 0.62, FEV1 55% predicted. Chest X-ray shows hyperinflation.""",

    "dermatology": """A 32-year-old female presents with a 2-month history of an expanding erythematous, scaly plaque on her right shin. The lesion is well-demarcated, approximately 5cm in diameter, with central clearing giving an annular appearance. She recently adopted a kitten. KOH preparation of skin scrapings is positive for fungal hyphae.""",
}


@router.get("/example")
async def get_example_case(category: str | None = None):
    """Get an example clinical case for testing."""
    if category and category in EXAMPLE_CASES:
        return {"case_text": EXAMPLE_CASES[category], "category": category}
    # Return random example
    cat = random.choice(list(EXAMPLE_CASES.keys()))
    return {"case_text": EXAMPLE_CASES[cat], "category": cat}


@router.get("/examples")
async def get_all_examples():
    """Get all example cases."""
    return {"examples": {k: v for k, v in EXAMPLE_CASES.items()}}


# --- Differential Diagnosis ---

class DDxRequest(BaseModel):
    """Request for differential diagnosis generation."""
    case_text: str = Field(..., min_length=10)
    parsed_case: dict[str, Any]


@router.post("/ddx")
async def generate_ddx(request: DDxRequest):
    """Generate differential diagnosis for a clinical case."""
    try:
        result = await generate_differential_diagnosis(
            parsed_case=request.parsed_case,
            case_text=request.case_text,
        )
        return ddx_result_to_dict(result)
    except Exception as e:
        logger.error("DDx generation failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# --- Risk Scores ---

class RiskScoreRequest(BaseModel):
    """Request for clinical risk score calculation."""
    case_text: str = Field(..., min_length=10)
    parsed_case: dict[str, Any]


@router.post("/risk-scores")
async def compute_risk_scores(request: RiskScoreRequest):
    """Calculate clinical risk scores for a case."""
    try:
        report = await calculate_risk_scores(
            parsed_case=request.parsed_case,
            case_text=request.case_text,
        )
        return risk_score_report_to_dict(report)
    except Exception as e:
        logger.error("Risk score calculation failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# --- Medication Safety ---

class MedicationSafetyRequest(BaseModel):
    """Request for medication safety check."""
    current_medications: list[str] = Field(default_factory=list)
    new_medications: list[str] = Field(default_factory=list)
    patient_conditions: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    labs: list[str] = Field(default_factory=list)
    age: str = ""
    sex: str = ""


@router.post("/medication-safety")
async def medication_safety_check(request: MedicationSafetyRequest):
    """Check medication safety with hybrid deterministic + AI approach."""
    try:
        result = await check_medication_safety(
            current_medications=request.current_medications,
            new_medications=request.new_medications,
            patient_conditions=request.patient_conditions,
            allergies=request.allergies,
            labs=request.labs,
            age=request.age,
            sex=request.sex,
        )
        return safety_result_to_dict(result)
    except Exception as e:
        logger.error("Medication safety check failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# --- Discharge Planning ---

class DischargePlanRequest(BaseModel):
    """Request for discharge plan generation."""
    parsed_case: dict[str, Any]
    treatment_options: list[dict[str, Any]] = Field(default_factory=list)
    acute_management: dict[str, Any] = Field(default_factory=dict)
    top_recommendation: str = ""


@router.post("/discharge-plan")
async def discharge_plan_endpoint(request: DischargePlanRequest):
    """Generate a comprehensive discharge plan."""
    try:
        result = await generate_discharge_plan(
            parsed_case=request.parsed_case,
            treatment_options=request.treatment_options,
            acute_management=request.acute_management,
            top_recommendation=request.top_recommendation,
        )
        return discharge_plan_to_dict(result)
    except Exception as e:
        logger.error("Discharge plan generation failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# --- Referral Note ---

class ReferralRequest(BaseModel):
    """Request for referral note generation."""
    specialty: str = Field(..., min_length=2)
    parsed_case: dict[str, Any]
    treatment_options: list[dict[str, Any]] = Field(default_factory=list)
    acute_management: dict[str, Any] = Field(default_factory=dict)


@router.post("/referral")
async def referral_endpoint(request: ReferralRequest):
    """Generate a specialty-specific referral note."""
    try:
        result = await generate_referral_note(
            specialty=request.specialty,
            parsed_case=request.parsed_case,
            treatment_options=request.treatment_options,
            acute_management=request.acute_management,
        )
        return referral_note_to_dict(result)
    except Exception as e:
        logger.error("Referral note generation failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# --- Handoff Note ---

class HandoffRequest(BaseModel):
    """Request for handoff note generation."""
    format: str = Field(default="ipass", pattern="^(ipass|sbar)$")
    parsed_case: dict[str, Any]
    treatment_options: list[dict[str, Any]] = Field(default_factory=list)
    acute_management: dict[str, Any] = Field(default_factory=dict)
    pending_tasks: list[str] = Field(default_factory=list)


@router.post("/handoff")
async def handoff_endpoint(request: HandoffRequest):
    """Generate a structured handoff note (I-PASS or SBAR)."""
    try:
        result = await generate_handoff_note(
            format=request.format,
            parsed_case=request.parsed_case,
            treatment_options=request.treatment_options,
            acute_management=request.acute_management,
            pending_tasks=request.pending_tasks,
        )
        return handoff_note_to_dict(result)
    except Exception as e:
        logger.error("Handoff note generation failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# --- CXR Foundation (Chest X-ray Classification) ---

class CXRClassifyRequest(BaseModel):
    """Request for chest X-ray classification."""
    image_b64: str = Field(..., min_length=100)
    conditions: list[str] = Field(default_factory=list)


@router.post("/image/cxr-classify")
async def cxr_classify(request: CXRClassifyRequest):
    """Zero-shot classification of chest X-ray conditions using CXR Foundation."""
    cxr = get_cxr_foundation_client()
    if not cxr.is_available:
        raise HTTPException(status_code=503, detail="CXR Foundation not configured")

    try:
        result = await cxr.classify_zero_shot(
            image_b64=request.image_b64,
            conditions=request.conditions or None,
        )
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("CXR classification failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# --- Derm Foundation (Skin Lesion Classification) ---

class DermClassifyRequest(BaseModel):
    """Request for dermoscopy image classification."""
    image_b64: str = Field(..., min_length=100)


@router.post("/image/derm-classify")
async def derm_classify(request: DermClassifyRequest):
    """Classify skin lesion and provide risk assessment using Derm Foundation."""
    derm = get_derm_foundation_client()
    if not derm.is_available:
        raise HTTPException(status_code=503, detail="Derm Foundation not configured")

    try:
        result = await derm.classify(image_b64=request.image_b64)
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Derm classification failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# --- Path Foundation (Digital Pathology) ---

class PathClassifyRequest(BaseModel):
    """Request for pathology image classification."""
    image_b64: str = Field(..., min_length=100)
    tile_size: int = Field(default=224)


@router.post("/image/pathology-classify")
async def pathology_classify(request: PathClassifyRequest):
    """Classify tissue types in pathology image using Path Foundation."""
    path = get_path_foundation_client()
    if not path.is_available:
        raise HTTPException(status_code=503, detail="Path Foundation not configured")

    try:
        result = await path.classify_tissue(
            image_b64=request.image_b64,
            tile_size=request.tile_size,
        )
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Pathology classification failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# --- TxGemma (Drug Property Prediction) ---

class DrugPropertyRequest(BaseModel):
    """Request for drug property prediction."""
    drug: str = Field(..., min_length=2)


class DrugInteractionRequest(BaseModel):
    """Request for drug-drug interaction prediction."""
    drug_a: str = Field(..., min_length=2)
    drug_b: str = Field(..., min_length=2)


@router.post("/drug-properties")
async def drug_properties(request: DrugPropertyRequest):
    """Predict therapeutic properties of a drug using TxGemma."""
    tx = get_txgemma_client()
    if not tx.is_available:
        raise HTTPException(status_code=503, detail="TxGemma not configured")

    try:
        result = await tx.predict_properties(drug=request.drug)
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Drug property prediction failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/drug-interaction")
async def drug_interaction(request: DrugInteractionRequest):
    """Predict drug-drug interaction using TxGemma."""
    tx = get_txgemma_client()
    if not tx.is_available:
        raise HTTPException(status_code=503, detail="TxGemma not configured")

    try:
        result = await tx.predict_interaction(drug_a=request.drug_a, drug_b=request.drug_b)
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Drug interaction prediction failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/drug-toxicity")
async def drug_toxicity(request: DrugPropertyRequest):
    """Predict toxicity profile for a drug using TxGemma."""
    tx = get_txgemma_client()
    if not tx.is_available:
        raise HTTPException(status_code=503, detail="TxGemma not configured")

    try:
        result = await tx.predict_toxicity(drug=request.drug)
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Drug toxicity prediction failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
