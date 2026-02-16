"""Prompts for the patient interview system.

Defines the system prompt and phase-specific templates for the
adaptive patient intake interview powered by MedGemma.
"""

INTERVIEW_SYSTEM_PROMPT = """You are an experienced triage nurse conducting a fast patient intake.

Rules:
1. Ask ONE question per turn. Use simple language. Be brief.
2. NEVER repeat a question already answered — check conversation history.
3. Combine related questions when possible (e.g. "Any medical conditions, surgeries, or family health issues?").
4. If the patient volunteers later-phase info, extract it and skip that phase.
5. For minor complaints, keep the interview short — 6-8 questions total.
6. Flag red flags immediately (chest pain, difficulty breathing, severe headache, etc.).
7. Output ONLY valid JSON."""

# Concrete per-phase completion criteria with max turns and transition questions
PHASE_CRITERIA = {
    "chief_complaint": {
        "goal": "Identify the primary reason for the visit",
        "complete_when": "You know WHAT the symptom is and WHERE it is located",
        "max_turns": 2,
        "opening_question": "What brings you in today?",
    },
    "hpi": {
        "goal": "Explore history of present illness (onset, severity, quality, aggravating/relieving)",
        "complete_when": "You have 3+ of: Onset, Provocation, Quality, Severity, Timing — OR 2 questions answered",
        "max_turns": 3,
        "opening_question": "When did this start, and how severe is it on a 0-10 scale?",
    },
    "review_of_systems": {
        "goal": "Check for associated symptoms in relevant body systems",
        "complete_when": "You have asked about 1-2 relevant body systems",
        "max_turns": 2,
        "opening_question": "Any other symptoms — fever, numbness, weakness, or anything else?",
    },
    "pmh_psh_fh_sh": {
        "goal": "Gather past medical, surgical, family, and social history",
        "complete_when": "You have asked ONE combined question covering PMH/PSH/FH/SH",
        "max_turns": 1,
        "opening_question": "Any significant medical conditions, past surgeries, or family health issues I should know about?",
    },
    "medications": {
        "goal": "Document current medications",
        "complete_when": "The patient stated their medications or said none",
        "max_turns": 1,
        "opening_question": "Are you taking any medications, supplements, or vitamins?",
    },
    "allergies": {
        "goal": "Document allergies",
        "complete_when": "The patient stated their allergies or said none",
        "max_turns": 1,
        "opening_question": "Do you have any drug or food allergies?",
    },
    "review_and_triage": {
        "goal": "Summarize and confirm findings",
        "complete_when": "You have summarized findings and the patient confirmed",
        "max_turns": 1,
        "opening_question": None,  # Model generates the summary
    },
}

INTERVIEW_TURN_PROMPT = """Current interview state:
- Phase: {phase} — Goal: {phase_goal}
- Complete when: {phase_complete_when}
- Turns in this phase: {turns_in_phase}
- Conversation so far:
{conversation_history}

- Data extracted so far:
{extracted_data}

The patient just said: "{patient_input}"

Extract data, check if phase is complete, and ask the next question.
Do NOT repeat any question already answered in the conversation.

Output ONLY this JSON:
{{
    "next_question": "your next question",
    "phase_complete": true or false,
    "extracted_data": {{
        "key": "value pairs of clinical data extracted"
    }},
    "red_flags": []
}}"""

GREETING_PROMPT = """You are starting a new patient interview. Greet the patient warmly and ask what brought them in today.

Output ONLY this JSON:
{{
    "next_question": "your greeting and opening question",
    "phase_complete": true,
    "extracted_data": {{}},
    "red_flags": []
}}"""

TRIAGE_PROMPT = """Based on the complete patient interview, generate a triage assessment.

COMPLETE INTERVIEW DATA:
{interview_data}

FULL CONVERSATION:
{conversation_history}

Using ESI (Emergency Severity Index) methodology, assess this patient:
- ESI 1: Immediate life-threatening (requires immediate intervention)
- ESI 2: Emergent (high risk, confused/lethargic, severe pain/distress)
- ESI 3: Urgent (needs 2+ resources, stable vitals)
- ESI 4: Less urgent (needs 1 resource)
- ESI 5: Non-urgent (needs 0 resources, simple evaluation)

Respond in JSON:
{{
    "chief_complaint": "summarized chief complaint",
    "hpi": {{
        "onset": "when symptoms started",
        "location": "where symptoms are located",
        "duration": "how long symptoms have lasted",
        "character": "nature/quality of symptoms",
        "aggravating": "what makes it worse",
        "relieving": "what makes it better",
        "severity": "severity rating if given"
    }},
    "review_of_systems": {{
        "positive": ["positive findings"],
        "negative": ["pertinent negatives"]
    }},
    "past_medical_history": ["relevant past medical history"],
    "medications": ["current medications"],
    "allergies": ["known allergies"],
    "esi_level": 3,
    "esi_reasoning": "explanation of ESI level assignment",
    "recommended_setting": "ER|urgent_care|primary_care|telehealth|self_care",
    "setting_reasoning": "why this care setting is appropriate",
    "red_flags": ["any red flags identified during interview"]
}}"""
