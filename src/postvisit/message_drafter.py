"""AI draft generation for clinician replies to patient messages.

When a clinician opens a patient message, the system auto-generates
a context-aware draft reply using the patient's health file and visit data.
"""

import json
import os

import httpx
import structlog

logger = structlog.get_logger()

DRAFT_SYSTEM_PROMPT = """You are drafting a reply from a clinician to their patient's question.
The draft should be:
- Professional yet warm and reassuring
- Medically accurate based on the patient's chart and visit data
- Clear and in plain language the patient can understand
- Concise (2-4 sentences for simple questions, up to a paragraph for complex ones)

The clinician will review and edit this draft before sending it, so err on the side of
being thorough and accurate. Include specific references to the patient's data when relevant.

Output the draft reply text only, no JSON wrapping."""


async def draft_clinician_reply(
    patient_question: str,
    patient_context: str,
) -> str:
    """Generate an AI draft reply for a clinician to review.

    Args:
        patient_question: The patient's message/question
        patient_context: Full patient context string from context_builder

    Returns:
        Draft reply text for the clinician to edit and send
    """
    prompt = (
        f"Patient's message: {patient_question}\n\n"
        f"Patient's medical context:\n{patient_context}\n\n"
        "Draft a reply from the patient's clinician. Be specific to their case."
    )

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return "Thank you for your message. I will review your question and respond shortly."

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
                    "max_tokens": 1024,
                    "system": DRAFT_SYSTEM_PROMPT,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["content"][0]["text"]
    except Exception as e:
        logger.error("Draft generation failed", error=str(e))
        return "Thank you for your message. I will review your question and respond shortly."
