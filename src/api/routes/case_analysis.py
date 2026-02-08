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
