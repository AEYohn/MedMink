"""Prompts for the EMS Run Report AI Assistant.

Adapts interview_prompts.py patterns for EMS ePCR documentation.
Phases replace clinical interview with ePCR sections.
"""

EMS_SYSTEM_PROMPT = """You are an EMS documentation assistant helping paramedics complete ePCR run reports quickly and accurately.

Rules:
1. Extract ALL structured data from medic dictation — a single utterance may span multiple ePCR sections.
2. Be brief and direct. Use EMS terminology. Do not explain medical concepts.
3. After extracting data, ask ONE focused follow-up for the most critical missing field.
4. Know standard EMS abbreviations: AMS, GCS, LOC, NRB, BVM, IO, SL, ETT, CPAP, STEMI, ROSC, CPR, AED, EPI, NTG, ASA, BGL, SPO2, ETCO2, AVPU, MOI, NOI, NPA, OPA, RSI, LUCAS, TXA.
5. Interpret shorthand: "180 over 95" → BP 180/95, "sat 97" → SpO2 97%, "sugar 45" → BGL 45 mg/dL.
6. Flag any red-flag inconsistencies immediately (GCS 15 + unresponsive, etc.).
7. Output ONLY valid JSON."""

# EMS report phases (replacing interview phases)
EMS_PHASES = [
    "dispatch",
    "scene",
    "patient_info",
    "primary_assessment",
    "vitals",
    "secondary_assessment",
    "interventions",
    "transport",
    "review",
    "complete",
]

EMS_PHASE_CRITERIA = {
    "dispatch": {
        "goal": "Capture call type, dispatch complaint, priority, unit, crew, dispatch time",
        "complete_when": "Call type and dispatch complaint are documented",
        "max_turns": 2,
        "opening_question": "What's the call? Give me dispatch info — call type, complaint, unit number.",
    },
    "scene": {
        "goal": "Document scene assessment — location, safety, hazards, MOI/NOI, patient count",
        "complete_when": "Scene safety, location type, and MOI or NOI are documented",
        "max_turns": 2,
        "opening_question": "What's the scene look like? Location, safety, mechanism or nature of illness?",
    },
    "patient_info": {
        "goal": "Capture patient demographics, chief complaint, PMH, meds, allergies, code status",
        "complete_when": "Age, sex, chief complaint are documented",
        "max_turns": 2,
        "opening_question": "Tell me about the patient — age, sex, chief complaint, medical history?",
    },
    "primary_assessment": {
        "goal": "Document AVPU, ABCs, GCS, skin, bleeding, patient priority",
        "complete_when": "AVPU and at least airway + breathing status are documented",
        "max_turns": 2,
        "opening_question": "What's your primary assessment? AVPU, airway, breathing, circulation?",
    },
    "vitals": {
        "goal": "Record vital signs — BP, HR, RR, SpO2, BGL, pain, GCS, temp, ETCO2",
        "complete_when": "At least BP, HR, RR, and SpO2 are documented",
        "max_turns": 2,
        "opening_question": "Vitals? BP, pulse, resps, sat, anything else?",
    },
    "secondary_assessment": {
        "goal": "Head-to-toe, cardiac rhythm, 12-lead, stroke screen, trauma score as applicable",
        "complete_when": "Relevant secondary assessment documented for chief complaint",
        "max_turns": 2,
        "opening_question": "Any secondary assessment findings? Head-to-toe, rhythm, 12-lead, stroke screen?",
    },
    "interventions": {
        "goal": "Document all procedures and medications with time, dose, route, response",
        "complete_when": "All interventions and medications given are documented",
        "max_turns": 3,
        "opening_question": "What interventions did you perform? Meds given? Procedures?",
    },
    "transport": {
        "goal": "Destination, transport mode, patient position, condition change, handoff",
        "complete_when": "Destination and transport mode are documented",
        "max_turns": 2,
        "opening_question": "Transport info — where are you going, how, and patient condition en route?",
    },
    "review": {
        "goal": "Review completeness and confirm all data",
        "complete_when": "Medic confirms data is correct",
        "max_turns": 1,
        "opening_question": None,  # Generated from data review
    },
}

EMS_EXTRACTION_PROMPT = """Current ePCR state:
- Phase: {phase} — Goal: {phase_goal}
- Complete when: {phase_complete_when}
- Turns in this phase: {turns_in_phase}

Conversation so far:
{conversation_history}

Current extracted data:
{extracted_data}

Medic just said: "{medic_input}"

IMPORTANT: Medic dictation often spans multiple sections. Extract ALL data mentioned, not just data for the current phase. Route each field to its correct section.

Extract data, check if phase is complete, and ask ONE follow-up for the most critical gap.

Output ONLY this JSON:
{{
    "next_question": "your focused follow-up question",
    "phase_complete": true or false,
    "extracted_data": {{
        "dispatch": {{}},
        "scene": {{}},
        "patient_info": {{}},
        "primary_assessment": {{}},
        "vitals": {{}},
        "secondary_assessment": {{}},
        "interventions": [],
        "medications": [],
        "transport": {{}}
    }},
    "validation_flags": []
}}

Only include sections with new data. Omit empty sections."""

EMS_GREETING_PROMPT = """You are starting a new EMS run report. Greet the medic and ask for dispatch information.

Output ONLY this JSON:
{{
    "next_question": "Ready to document. What's the call?",
    "phase_complete": true,
    "extracted_data": {{}},
    "validation_flags": []
}}"""

EMS_NARRATIVE_PROMPT = """Generate a professional ePCR narrative paragraph from this run report data.

REPORT DATA:
{report_json}

Write a standard EMS narrative covering: dispatch → response → scene → patient contact → assessment → interventions → transport → handoff.

Use professional EMS documentation style:
- Past tense, third person ("Unit responded...", "Patient was found...")
- Include all timestamps
- Document pertinent positives AND negatives
- Reference vital signs and assessment findings
- Note medication doses, routes, and patient response
- Keep it concise but thorough

Output ONLY the narrative text, no JSON wrapper."""

EMS_ICD10_PROMPT = """Based on this EMS run report, suggest the most appropriate ICD-10 codes.

REPORT DATA:
{report_json}

Return the top 3-5 most appropriate ICD-10 codes based on:
- Chief complaint
- Assessment findings
- Mechanism of injury (if trauma)
- Interventions performed

Output JSON:
{{
    "codes": [
        {{
            "code": "ICD-10 code",
            "description": "code description",
            "confidence": 0.0 to 1.0,
            "rationale": "why this code applies"
        }}
    ]
}}

Output ONLY the JSON object."""

EMS_MEDICAL_NECESSITY_PROMPT = """Generate a medical necessity statement for ambulance transport based on this run report.

REPORT DATA:
{report_json}

The statement must justify why the patient required ambulance transport and could not be safely transported by other means. Address:
1. Patient's medical condition and acuity
2. Required monitoring or interventions during transport
3. Why other transport modes were insufficient
4. Level of service provided (BLS/ALS)

Write 2-3 sentences in professional medical documentation style.

Output ONLY the medical necessity statement text, no JSON wrapper."""
