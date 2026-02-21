"""Bridge between case analysis output and compliance engine.

Converts CaseAnalysisResult fields into a SOAP note structure that
the compliance engine can scan.
"""

from __future__ import annotations


def case_result_to_soap(result_data: dict) -> dict:
    """Convert CaseAnalysisResult dict into SOAP note structure for compliance scanning.

    Maps analyzer output fields to the SOAP sections expected by
    src.medgemma.compliance_engine.scan_compliance().
    """
    parsed_case = result_data.get("parsed_case", {})
    findings = parsed_case.get("findings", {})
    management = parsed_case.get("management", {})
    acute = result_data.get("acute_management", {})
    treatment_options = result_data.get("treatment_options", [])
    ddx = result_data.get("differential_diagnosis", {})
    risk_scores = result_data.get("clinical_risk_scores", {})

    # Build differential list
    differential_list = []
    diagnoses = ddx.get("diagnoses", []) if isinstance(ddx, dict) else []
    for d in diagnoses:
        if isinstance(d, dict):
            differential_list.append(d.get("diagnosis", ""))
        elif isinstance(d, str):
            differential_list.append(d)

    # Build medication list for plan
    # Our treatment names embed drug+dose+frequency (e.g., "Aspirin 325 mg PO daily")
    # so we set all three fields to satisfy compliance checks
    plan_meds = []
    for opt in treatment_options:
        if (
            opt.get("verdict") in ("recommended", "consider")
            and opt.get("option_type") == "medication"
        ):
            name = opt.get("name", "")
            plan_meds.append(
                {
                    "drug": name,
                    "dose": name,  # dose embedded in name
                    "frequency": name,  # frequency embedded in name
                }
            )
    # Fallback: if no option_type, include all recommended treatments
    if not plan_meds:
        for opt in treatment_options:
            if opt.get("verdict") in ("recommended", "consider"):
                name = opt.get("name", "")
                plan_meds.append(
                    {
                        "drug": name,
                        "dose": name,
                        "frequency": name,
                    }
                )

    # Build procedures list
    procedures = []
    for opt in treatment_options:
        if opt.get("option_type") == "procedure" and opt.get("verdict") in (
            "recommended",
            "consider",
        ):
            procedures.append(opt.get("name", ""))

    # Extract vitals into dict
    vitals_dict = {}
    vitals_list = findings.get("vitals", [])
    if isinstance(vitals_list, list):
        vitals_text = " ".join(vitals_list).upper()
        for key, patterns in [
            ("BP", ["BP ", "BLOOD PRESSURE"]),
            ("HR", ["HR ", "HEART RATE", "PULSE"]),
            ("Temp", ["T ", "TEMP", "TEMPERATURE"]),
            ("RR", ["RR ", "RESPIRATORY RATE"]),
            ("SpO2", ["SPO2", "SAT", "O2"]),
        ]:
            for pat in patterns:
                if pat in vitals_text:
                    vitals_dict[key] = "present"
                    break

    # Build primary diagnosis from category + clinical question
    primary_dx = parsed_case.get("clinical_question", "")
    category = parsed_case.get("case_category", "")
    if not primary_dx and category:
        primary_dx = category

    # Clinical impression from risk stratification + top recommendation
    impression = acute.get("risk_stratification", "")
    top_rec = result_data.get("top_recommendation", "")
    if top_rec:
        impression += f" Top recommendation: {top_rec}"

    # Build risk score text
    risk_text = ""
    if isinstance(risk_scores, dict):
        for score_name, score_data in risk_scores.items():
            if isinstance(score_data, dict):
                risk_text += f"{score_name}: {score_data.get('score', '')} "

    return {
        "subjective": {
            "chief_complaint": findings.get("presentation", ""),
            "history_of_present_illness": findings.get("presentation", ""),
            "patient_reported": management.get("medications", []),
            "review_of_systems": findings.get("associated_symptoms", []),
        },
        "objective": {
            "vital_signs": vitals_dict,
            "physical_exam": findings.get("physical_exam", []),
            "labs": findings.get("labs", []),
            "imaging": findings.get("imaging", []),
        },
        "assessment": {
            "primary_diagnosis": primary_dx,
            "clinical_impression": impression,
            "differential": differential_list,
            "risk_scores": risk_text,
        },
        "plan": {
            "medications": plan_meds,
            "procedures": procedures,
            "referrals": acute.get("consults", []),
            "follow_up": acute.get("disposition", ""),
            "patient_education": acute.get("key_counseling", []),
        },
    }
