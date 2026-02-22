"""Clinical case analyzer for complex vignette parsing and treatment recommendations.

Parses clinical vignettes, extracts structured findings, generates treatment options,
and evaluates each option against medical literature evidence.
"""

import asyncio
import json
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

import structlog

from src.medgemma.client import get_medgemma_client

logger = structlog.get_logger()

# --- PubMed Human-Study Filter ---
# Deterministic filter to exclude non-human, non-clinical publications

_NON_HUMAN_PUB_TYPES = frozenset(
    {
        "Letter",
        "Comment",
        "Editorial",
        "Retracted Publication",
        "Published Erratum",
        "News",
    }
)
_NON_HUMAN_MESH = frozenset(
    {
        "Animals",
        "Mice",
        "Rats",
        "Dogs",
        "Cats",
        "Rabbits",
        "Drosophila",
        "Zebrafish",
        "Cell Line",
        "In Vitro Techniques",
    }
)
_NON_HUMAN_TITLE_KEYWORDS = frozenset(
    {
        "mice",
        "mouse",
        "rat",
        "rats",
        "murine",
        "canine",
        "feline",
        "porcine",
        "bovine",
        "ovine",
        "zebrafish",
        "drosophila",
        "in vitro",
        "cell line",
        "cell culture",
    }
)


def _is_human_clinical_study(paper_dict: dict) -> bool:
    """Return True if paper appears to be a human clinical study.

    Checks publication_types, mesh_terms, and title keywords against
    exclusion lists. Papers with "Humans" in MeSH are always kept.
    """
    pub_types = set(paper_dict.get("publication_types") or [])
    mesh_terms = set(paper_dict.get("mesh_terms") or [])
    title = (paper_dict.get("title") or "").lower()

    # If explicitly tagged as human study, always keep
    if "Humans" in mesh_terms:
        return True

    # Exclude by publication type
    if pub_types & _NON_HUMAN_PUB_TYPES:
        return False

    # Exclude by MeSH terms (animal/in-vitro)
    if mesh_terms & _NON_HUMAN_MESH:
        return False

    # Exclude by title keywords
    for keyword in _NON_HUMAN_TITLE_KEYWORDS:
        if keyword in title:
            return False

    return True


MEDICAL_CATEGORIES = {
    "musculoskeletal": {
        "treatment_classes": [
            "NSAIDs",
            "muscle relaxants",
            "physical therapy",
            "corticosteroid injections",
            "DMARDs",
            "surgical consultation",
        ],
        "workup": [
            "X-ray",
            "MRI",
            "inflammatory markers (ESR, CRP)",
            "joint aspiration",
            "bone density scan",
        ],
        "acute_interventions": [
            "IV ketorolac for acute pain",
            "joint reduction for dislocations",
            "splinting/immobilization",
            "IV antibiotics for septic arthritis",
            "surgical washout for open fractures",
            "compartment pressure measurement",
            "emergent fasciotomy for compartment syndrome",
        ],
        "monitoring": [
            "serial neurovascular checks",
            "compartment pressure monitoring",
            "pain reassessment q2-4h",
            "post-reduction imaging",
            "wound checks for surgical patients",
        ],
        "consults_and_disposition": [
            "orthopedic surgery for fractures/dislocations",
            "rheumatology for inflammatory arthritis",
            "admission for septic arthritis or compartment syndrome",
            "outpatient PT referral for soft tissue injuries",
            "discharge with follow-up for stable sprains/strains",
        ],
    },
    "infectious_disease": {
        "treatment_classes": [
            "antibiotics",
            "antivirals",
            "antifungals",
            "supportive care",
            "isolation precautions",
        ],
        "workup": [
            "cultures (blood, urine, CSF)",
            "inflammatory markers",
            "PCR testing",
            "serology",
            "imaging",
        ],
        "acute_interventions": [
            "IV broad-spectrum antibiotics within 1 hour for sepsis",
            "IV fluid resuscitation (30 mL/kg crystalloid)",
            "blood cultures before antibiotics",
            "source control (drainage of abscess)",
            "IV acyclovir for HSV encephalitis",
            "airborne/contact isolation as indicated",
        ],
        "monitoring": [
            "serial lactate levels",
            "hourly urine output for sepsis",
            "continuous vitals monitoring",
            "daily procalcitonin trending",
            "culture sensitivities for antibiotic de-escalation",
        ],
        "consults_and_disposition": [
            "infectious disease for complex infections",
            "surgery for source control (abscess, necrotizing fasciitis)",
            "ICU admission for sepsis/septic shock",
            "isolation precautions per pathogen",
            "outpatient parenteral antibiotic therapy (OPAT) if stable",
        ],
    },
    "cardiology": {
        "treatment_classes": [
            "antihypertensives",
            "anticoagulants",
            "antiplatelets",
            "statins",
            "diuretics",
            "beta-blockers",
            "cardiac catheterization",
        ],
        "workup": [
            "ECG/EKG",
            "echocardiogram",
            "cardiac enzymes (troponin)",
            "BNP",
            "stress test",
            "cardiac MRI",
        ],
        "acute_interventions": [
            "IV heparin",
            "dual antiplatelet loading",
            "IV nitroglycerin",
            "IV beta-blocker (esmolol/labetalol)",
            "emergent PCI",
            "code STEMI activation",
            "defibrillation/cardioversion",
            "temporary pacing",
            "IV amiodarone",
        ],
        "monitoring": [
            "continuous telemetry",
            "serial troponins q3-6h",
            "continuous pulse oximetry",
            "arterial line for hemodynamic instability",
            "strict I&O",
            "daily weights for CHF",
        ],
        "consults_and_disposition": [
            "interventional cardiology for ACS",
            "cardiac surgery for CABG candidates",
            "ICU admission for STEMI/cardiogenic shock",
            "step-down unit for stable ACS",
            "cardiac rehab referral on discharge",
        ],
    },
    "neurology": {
        "treatment_classes": [
            "anticonvulsants",
            "triptans",
            "muscle relaxants",
            "neuropathic pain agents",
            "thrombolytics",
            "surgical decompression",
        ],
        "workup": [
            "CT head",
            "MRI brain/spine",
            "lumbar puncture",
            "EEG",
            "nerve conduction studies",
            "neurology consult",
        ],
        "acute_interventions": [
            "IV tPA for acute ischemic stroke (within window)",
            "IV levetiracetam/fosphenytoin for status epilepticus",
            "IV lorazepam for active seizure",
            "emergent mechanical thrombectomy",
            "external ventricular drain for hydrocephalus",
            "IV mannitol/hypertonic saline for elevated ICP",
            "IV nimodipine for SAH vasospasm",
        ],
        "monitoring": [
            "neuro checks q1-2h (GCS, pupil reactivity, motor exam)",
            "continuous EEG for seizure monitoring",
            "ICP monitoring if indicated",
            "serial CT head for hemorrhage expansion",
            "NIH Stroke Scale serial assessments",
        ],
        "consults_and_disposition": [
            "neurosurgery for hemorrhage/hydrocephalus",
            "interventional neuroradiology for thrombectomy",
            "neuro ICU for stroke/SAH/status epilepticus",
            "stroke unit for stable ischemic stroke",
            "outpatient neurology follow-up for seizure/headache",
        ],
    },
    "pulmonology": {
        "treatment_classes": [
            "bronchodilators",
            "inhaled corticosteroids",
            "antibiotics",
            "oxygen therapy",
            "anticoagulation for PE",
        ],
        "workup": [
            "chest X-ray",
            "CT chest",
            "pulmonary function tests",
            "ABG",
            "D-dimer",
            "CT angiography",
        ],
        "acute_interventions": [
            "high-flow oxygen/NIV (BiPAP/CPAP)",
            "emergent intubation if needed",
            "IV systemic corticosteroids for severe exacerbation",
            "continuous nebulized bronchodilators",
            "IV heparin for PE",
            "systemic thrombolytics for massive PE",
            "needle decompression for tension pneumothorax",
            "chest tube for pneumothorax/effusion",
        ],
        "monitoring": [
            "continuous pulse oximetry",
            "serial ABGs",
            "peak flow measurements for asthma",
            "ventilator parameters if intubated",
            "chest X-ray post-procedure",
        ],
        "consults_and_disposition": [
            "pulmonology for complex cases",
            "thoracic surgery for chest tube/empyema",
            "ICU for respiratory failure/massive PE",
            "step-down for stable COPD exacerbation on NIV",
            "discharge with pulmonary rehab referral",
        ],
    },
    "gastroenterology": {
        "treatment_classes": [
            "PPIs",
            "H2 blockers",
            "antiemetics",
            "laxatives",
            "antidiarrheals",
            "immunomodulators",
            "endoscopy",
        ],
        "workup": [
            "abdominal CT",
            "ultrasound",
            "endoscopy",
            "colonoscopy",
            "liver function tests",
            "stool studies",
        ],
        "acute_interventions": [
            "IV PPI drip for GI bleed",
            "emergent endoscopy for active bleeding",
            "IV octreotide for variceal bleed",
            "IV fluid resuscitation",
            "packed RBC transfusion for hemorrhage",
            "NG tube placement",
            "NPO and IV antibiotics for acute pancreatitis with infection",
        ],
        "monitoring": [
            "serial hemoglobin/hematocrit q6-8h for GI bleed",
            "strict I&O",
            "abdominal exam reassessment",
            "serial lipase for pancreatitis",
            "stool output tracking",
        ],
        "consults_and_disposition": [
            "GI for endoscopy/colonoscopy",
            "surgery for acute abdomen/perforation",
            "ICU for massive GI bleed or hemodynamic instability",
            "observation for mild pancreatitis",
            "discharge with GI follow-up for stable conditions",
        ],
    },
    "endocrinology": {
        "treatment_classes": [
            "insulin",
            "metformin",
            "GLP-1 agonists",
            "thyroid hormone",
            "antithyroid drugs",
            "bisphosphonates",
        ],
        "workup": [
            "HbA1c",
            "TSH/T4",
            "cortisol",
            "DEXA scan",
            "glucose tolerance test",
            "hormonal panels",
        ],
        "acute_interventions": [
            "IV insulin drip for DKA/HHS",
            "IV normal saline bolus for DKA",
            "IV dextrose for severe hypoglycemia",
            "potassium replacement in DKA",
            "IV hydrocortisone for adrenal crisis",
            "IV propylthiouracil + beta-blocker for thyroid storm",
        ],
        "monitoring": [
            "hourly blood glucose for DKA/HHS",
            "serial BMP q2-4h (potassium, bicarb, AG)",
            "continuous telemetry for electrolyte abnormalities",
            "strict I&O",
            "mental status checks for HHS",
        ],
        "consults_and_disposition": [
            "endocrinology for complex diabetes/thyroid",
            "ICU for DKA/HHS/thyroid storm/adrenal crisis",
            "step-down when anion gap closes in DKA",
            "diabetes education before discharge",
            "outpatient endocrine follow-up",
        ],
    },
    "nephrology": {
        "treatment_classes": [
            "ACE inhibitors",
            "ARBs",
            "diuretics",
            "phosphate binders",
            "ESAs",
            "dialysis",
        ],
        "workup": [
            "BMP/CMP",
            "urinalysis",
            "renal ultrasound",
            "GFR",
            "urine protein",
            "renal biopsy",
        ],
        "acute_interventions": [
            "emergent hemodialysis for severe hyperkalemia/uremia/fluid overload",
            "IV calcium gluconate for hyperkalemia with ECG changes",
            "IV insulin + dextrose for potassium lowering",
            "IV sodium bicarbonate for severe metabolic acidosis",
            "IV loop diuretics for fluid overload",
            "Foley catheter for obstruction",
        ],
        "monitoring": [
            "serial BMP q6-12h (creatinine, potassium, bicarb)",
            "strict I&O with daily weights",
            "continuous telemetry for hyperkalemia",
            "urine output monitoring q1h",
            "fluid balance assessment",
        ],
        "consults_and_disposition": [
            "nephrology for AKI/dialysis needs",
            "urology for obstructive causes",
            "ICU for severe electrolyte derangements or need for emergent dialysis",
            "observation for mild AKI with trending labs",
            "outpatient nephrology for CKD management",
        ],
    },
    "psychiatry": {
        "treatment_classes": [
            "SSRIs",
            "SNRIs",
            "antipsychotics",
            "mood stabilizers",
            "benzodiazepines",
            "psychotherapy",
            "CBT",
        ],
        "workup": [
            "psychiatric evaluation",
            "PHQ-9",
            "GAD-7",
            "toxicology screen",
            "thyroid panel",
            "safety assessment",
        ],
        "acute_interventions": [
            "1:1 sitter for active suicidal ideation",
            "IM haloperidol/lorazepam for acute agitation",
            "IV benzodiazepines for alcohol withdrawal (CIWA protocol)",
            "naloxone for opioid overdose",
            "activated charcoal for acute ingestion",
            "involuntary hold if danger to self/others",
        ],
        "monitoring": [
            "suicide risk reassessment",
            "CIWA scoring q1-2h for alcohol withdrawal",
            "COWS scoring for opioid withdrawal",
            "continuous observation for high-risk patients",
            "vital signs q4h",
            "medication side effect monitoring",
        ],
        "consults_and_disposition": [
            "psychiatry for acute psychosis/suicidality",
            "toxicology for overdose/ingestion",
            "inpatient psychiatric admission for safety concerns",
            "partial hospitalization program for step-down",
            "outpatient therapy and medication management",
        ],
    },
    "dermatology": {
        "treatment_classes": [
            "topical corticosteroids",
            "retinoids",
            "antifungals",
            "antibiotics",
            "immunomodulators",
            "phototherapy",
        ],
        "workup": [
            "skin biopsy",
            "KOH preparation",
            "patch testing",
            "dermoscopy",
            "wound culture",
        ],
        "acute_interventions": [
            "IV epinephrine for anaphylaxis with skin involvement",
            "IV corticosteroids for Stevens-Johnson syndrome/TEN",
            "wound debridement for necrotizing skin infections",
            "IV antibiotics for severe cellulitis",
            "immediate offending drug discontinuation for drug eruptions",
        ],
        "monitoring": [
            "body surface area assessment for burns/TEN",
            "wound measurements and photography",
            "serial temperature checks for cellulitis",
            "fluid balance for extensive skin loss",
        ],
        "consults_and_disposition": [
            "dermatology for biopsy/complex rashes",
            "burn center transfer for TEN >30% BSA",
            "ICU for TEN/severe drug reactions",
            "outpatient dermatology for chronic conditions",
            "discharge with wound care instructions",
        ],
    },
    "hematology_oncology": {
        "treatment_classes": [
            "chemotherapy",
            "immunotherapy",
            "targeted therapy",
            "transfusions",
            "anticoagulants",
            "growth factors",
        ],
        "workup": [
            "CBC with differential",
            "peripheral smear",
            "bone marrow biopsy",
            "flow cytometry",
            "tumor markers",
            "PET/CT",
        ],
        "acute_interventions": [
            "emergent transfusion for severe anemia/hemorrhage",
            "IV heparin for acute thromboembolism",
            "platelet transfusion for active bleeding",
            "IV rasburicase for tumor lysis syndrome",
            "emergent leukapheresis for hyperleukocytosis",
            "IV dexamethasone for spinal cord compression",
        ],
        "monitoring": [
            "serial CBC q6-12h for active bleeding",
            "coagulation panel trending",
            "tumor lysis labs (K, phos, uric acid, Ca, creatinine) q6h",
            "transfusion reaction monitoring",
            "neutropenic fever surveillance",
        ],
        "consults_and_disposition": [
            "hematology/oncology for new diagnoses or complications",
            "radiation oncology for cord compression",
            "ICU for tumor lysis or severe hemorrhage",
            "observation for stable cytopenias",
            "outpatient oncology for treatment planning",
        ],
    },
    "obstetrics_gynecology": {
        "treatment_classes": [
            "hormonal therapy",
            "antibiotics",
            "analgesics",
            "tocolytics",
            "oxytocin",
            "surgical management",
        ],
        "workup": [
            "pelvic ultrasound",
            "Pap smear",
            "STI screening",
            "pregnancy test",
            "hormonal panels",
        ],
        "acute_interventions": [
            "IV magnesium sulfate for eclampsia/preterm labor",
            "IV oxytocin for postpartum hemorrhage",
            "emergent cesarean section",
            "uterine tamponade for hemorrhage",
            "IV antibiotics for chorioamnionitis",
            "Rh immunoglobulin for Rh-negative mothers",
        ],
        "monitoring": [
            "continuous fetal heart rate monitoring",
            "serial blood pressures for preeclampsia",
            "uterine contraction monitoring",
            "strict I&O for magnesium therapy",
            "serial hemoglobin for hemorrhage",
        ],
        "consults_and_disposition": [
            "maternal-fetal medicine for high-risk pregnancies",
            "NICU notification for preterm delivery",
            "L&D admission for active labor/preeclampsia",
            "observation for threatened preterm labor",
            "outpatient OB follow-up for stable conditions",
        ],
    },
    "ophthalmology": {
        "treatment_classes": [
            "topical antibiotics",
            "corticosteroid drops",
            "anti-VEGF injections",
            "glaucoma drops",
            "lubricants",
        ],
        "workup": [
            "visual acuity",
            "slit-lamp exam",
            "tonometry",
            "fundoscopy",
            "OCT",
            "fluorescein angiography",
        ],
        "acute_interventions": [
            "emergent eye irrigation for chemical burns (30+ min)",
            "IV acetazolamide + topical timolol for acute angle-closure glaucoma",
            "emergent ophthalmology eval for retinal detachment",
            "lateral canthotomy for orbital compartment syndrome",
            "topical antibiotics for corneal ulcer",
        ],
        "monitoring": [
            "serial visual acuity checks",
            "intraocular pressure monitoring",
            "pupil reactivity assessment",
            "slit-lamp re-examination",
        ],
        "consults_and_disposition": [
            "ophthalmology emergent for acute vision loss/retinal detachment",
            "ophthalmology urgent for corneal ulcer/acute glaucoma",
            "discharge with 24h ophthalmology follow-up for most conditions",
            "admission for orbital cellulitis or post-surgical monitoring",
        ],
    },
    "urology": {
        "treatment_classes": [
            "alpha-blockers",
            "5-alpha reductase inhibitors",
            "antibiotics",
            "anticholinergics",
            "surgical intervention",
        ],
        "workup": [
            "urinalysis",
            "PSA",
            "renal ultrasound",
            "cystoscopy",
            "urodynamics",
            "CT urogram",
        ],
        "acute_interventions": [
            "Foley catheter for acute urinary retention",
            "IV antibiotics for pyelonephritis/urosepsis",
            "IV fluid resuscitation for urosepsis",
            "ureteral stent or nephrostomy for obstructing stone",
            "emergent surgical exploration for testicular torsion",
        ],
        "monitoring": [
            "urine output monitoring q1h",
            "serial renal function (creatinine, BUN)",
            "pain reassessment",
            "temperature trending for infection",
            "post-void residual measurement",
        ],
        "consults_and_disposition": [
            "urology emergent for testicular torsion/priapism",
            "urology urgent for obstructing stones with infection",
            "ICU for urosepsis with hemodynamic instability",
            "observation for renal colic with IV hydration",
            "discharge with urology follow-up for stable conditions",
        ],
    },
    "rheumatology": {
        "treatment_classes": [
            "NSAIDs",
            "DMARDs",
            "biologics",
            "corticosteroids",
            "colchicine",
            "urate-lowering therapy",
        ],
        "workup": [
            "ANA",
            "RF",
            "anti-CCP",
            "ESR/CRP",
            "uric acid",
            "joint X-rays",
            "synovial fluid analysis",
        ],
        "acute_interventions": [
            "IV methylprednisolone pulse for lupus flare/vasculitis",
            "joint aspiration to rule out septic arthritis",
            "IV colchicine or corticosteroids for acute gout flare",
            "emergent plasmapheresis for pulmonary-renal syndrome",
            "IV cyclophosphamide for severe lupus nephritis",
        ],
        "monitoring": [
            "serial inflammatory markers (ESR, CRP)",
            "serial renal function for lupus nephritis",
            "joint exam reassessment",
            "serial complement levels (C3, C4)",
            "CBC monitoring for immunosuppressive therapy",
        ],
        "consults_and_disposition": [
            "rheumatology for new autoimmune diagnosis or flare",
            "nephrology for lupus nephritis",
            "ICU for pulmonary hemorrhage or severe vasculitis",
            "admission for IV pulse steroids or cyclophosphamide",
            "outpatient rheumatology for chronic management",
        ],
    },
    "ent": {
        "treatment_classes": [
            "antibiotics",
            "nasal corticosteroids",
            "antihistamines",
            "decongestants",
            "surgical intervention",
        ],
        "workup": ["audiometry", "tympanometry", "CT sinuses", "laryngoscopy", "allergy testing"],
        "acute_interventions": [
            "anterior nasal packing for epistaxis",
            "emergent cricothyrotomy/tracheostomy for airway obstruction",
            "IV dexamethasone for airway edema (croup, epiglottitis)",
            "IV antibiotics for peritonsillar/retropharyngeal abscess",
            "incision and drainage of peritonsillar abscess",
            "foreign body removal",
        ],
        "monitoring": [
            "airway reassessment",
            "oxygen saturation monitoring",
            "serial nasal exam for recurrent epistaxis",
            "voice and swallowing assessment post-procedure",
        ],
        "consults_and_disposition": [
            "ENT emergent for airway compromise",
            "ENT urgent for peritonsillar abscess",
            "admission for epiglottitis or deep space neck infection",
            "observation post-epistaxis packing",
            "outpatient ENT for chronic sinusitis/hearing loss",
        ],
    },
}


def get_category_context(category: str) -> str:
    """Generate dynamic context for the detected case category."""
    if not category:
        return ""

    # Normalize category name
    cat_key = category.lower().replace(" ", "_").replace("-", "_")

    # Try exact match first, then partial match
    cat_info = MEDICAL_CATEGORIES.get(cat_key)
    if not cat_info:
        for key, info in MEDICAL_CATEGORIES.items():
            if key in cat_key or cat_key in key:
                cat_info = info
                break

    if not cat_info:
        return f"Category: {category}. Select treatments appropriate for the presenting symptoms and clinical findings."

    parts = [
        f"Category: {category}",
        f"Treatment classes to consider (select only those relevant to the specific condition): {', '.join(cat_info['treatment_classes'])}",
    ]
    if "acute_interventions" in cat_info:
        parts.append(
            f"Possible acute interventions (ONLY for moderate/high-acuity presentations — omit for low-risk): {', '.join(cat_info['acute_interventions'][:4])}"
        )
    return "\n".join(parts)


# --- Pearl Lab-Value Validator ---
# Deterministic check: remove pearls that contradict actual lab values

_LAB_CONTRADICTION_PATTERNS: list[tuple[str, str, str, float, str]] = [
    # (pearl_keyword, lab_prefix_regex, direction, threshold, contradiction_label)
    # "hyperkalemia" but K+ < 5.0
    ("hyperkalemia", r"K\+?\s*([\d.]+)", "below", 5.0, "K+ is normal/low"),
    ("hypokalemia", r"K\+?\s*([\d.]+)", "above", 3.5, "K+ is normal/high"),
    # "hyponatremia" but Na+ > 135
    ("hyponatremia", r"Na\+?\s*([\d.]+)", "above", 135.0, "Na+ is normal/high"),
    ("hypernatremia", r"Na\+?\s*([\d.]+)", "below", 145.0, "Na+ is normal/low"),
    # "normal renal function" but eGFR < 60
    ("normal renal function", r"(?:eGFR|GFR)\s*([\d.]+)", "below", 60.0, "eGFR is reduced"),
    # "renal impairment" / "renal insufficiency" but eGFR >= 60
    ("renal impairment", r"(?:eGFR|GFR)\s*([\d.]+)", "above", 59.0, "eGFR is normal"),
    ("renal insufficiency", r"(?:eGFR|GFR)\s*([\d.]+)", "above", 59.0, "eGFR is normal"),
    # "elevated creatinine" but Cr < 1.2
    ("elevated creatinine", r"(?:Cr|creatinine)\s*([\d.]+)", "below", 1.2, "creatinine is normal"),
]


def _validate_pearls_against_labs(pearls: list[str], labs: list[str]) -> list[str]:
    """Remove clinical pearls that contradict actual lab values.

    Args:
        pearls: List of clinical pearl strings
        labs: List of lab value strings from parsed case (e.g. ["K+ 3.2 mEq/L", "Na+ 138 mEq/L"])

    Returns:
        Filtered list of pearls with contradictions removed
    """
    if not pearls or not labs:
        return pearls

    # Extract numeric lab values from the labs list
    lab_text = " ".join(labs)
    validated = []

    for pearl in pearls:
        pearl_lower = pearl.lower()
        contradicted = False

        for keyword, lab_regex, direction, threshold, label in _LAB_CONTRADICTION_PATTERNS:
            if keyword.lower() not in pearl_lower:
                continue

            # Find the lab value
            match = re.search(lab_regex, lab_text, re.IGNORECASE)
            if not match:
                continue

            try:
                value = float(match.group(1))
            except (ValueError, IndexError):
                continue

            if direction == "below" and value < threshold:
                logger.warning(
                    "Pearl contradicts lab value — removing",
                    pearl=pearl[:80],
                    keyword=keyword,
                    actual_value=value,
                    threshold=threshold,
                    reason=label,
                )
                contradicted = True
                break
            elif direction == "above" and value > threshold:
                logger.warning(
                    "Pearl contradicts lab value — removing",
                    pearl=pearl[:80],
                    keyword=keyword,
                    actual_value=value,
                    threshold=threshold,
                    reason=label,
                )
                contradicted = True
                break

        if not contradicted:
            validated.append(pearl)

    return validated


# --- Diagnostic Evaluation Boost ---
# MedGemma 4B systematically downgrades diagnostics to not_recommended

_DIAGNOSTIC_KEYWORDS = frozenset(
    {
        "ct",
        "mri",
        "x-ray",
        "xray",
        "ecg",
        "ekg",
        "electrocardiogram",
        "labs",
        "lab work",
        "blood work",
        "cbc",
        "bmp",
        "cmp",
        "urinalysis",
        "ultrasound",
        "echo",
        "echocardiogram",
        "chest x-ray",
        "cxr",
        "troponin",
        "d-dimer",
        "bnp",
        "tsh",
        "a1c",
        "hba1c",
        "lumbar puncture",
        "ct angiography",
        "cta",
        "mra",
        "eeg",
        "emg",
        "pft",
        "spirometry",
        "abg",
        "blood gas",
    }
)

_CONTRAINDICATION_KEYWORDS = frozenset(
    {
        "contraindicated",
        "harmful",
        "dangerous",
        "risk of",
        "adverse",
        "allergic",
        "anaphylaxis",
        "avoid",
    }
)


def _maybe_boost_diagnostic(option: "TreatmentOption") -> None:
    """Override not_recommended to consider for diagnostics without contraindication rationale."""
    if option.verdict != "not_recommended":
        return

    name_lower = option.name.lower()
    is_diagnostic = any(kw in name_lower for kw in _DIAGNOSTIC_KEYWORDS)
    if not is_diagnostic:
        return

    rationale_lower = (option.rationale or "").lower()
    has_contraindication = any(kw in rationale_lower for kw in _CONTRAINDICATION_KEYWORDS)
    if has_contraindication:
        return

    logger.warning(
        "Diagnostic boost: overriding not_recommended → consider",
        treatment=option.name,
        original_verdict=option.verdict,
    )
    option.verdict = "consider"
    option.confidence = max(option.confidence, 0.5)


def get_relevant_snippet(abstract: str, treatment_name: str, max_chars: int = 300) -> str:
    """Extract relevant snippet from abstract mentioning the treatment.

    Instead of relying on MedGemma to quote from papers (which leads to hallucinations),
    this extracts ACTUAL text from the abstract that mentions the treatment.

    Args:
        abstract: Full abstract text from the paper
        treatment_name: Name of the treatment to find mentions of
        max_chars: Maximum characters for the snippet

    Returns:
        Relevant sentence(s) from the abstract, or first sentences if no mention found
    """
    if not abstract:
        return "Abstract not available"

    # Split into sentences (handle common abbreviations)
    sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z])", abstract)

    # Get treatment words for matching (first 2 significant words)
    treatment_words = [
        w.lower()
        for w in treatment_name.split()
        if len(w) > 3 and w.lower() not in {"with", "dose", "daily", "weekly", "monthly"}
    ][:2]

    if not treatment_words:
        treatment_words = [treatment_name.lower().split()[0]] if treatment_name else []

    # Find sentences mentioning the treatment
    relevant_sentences = []
    for sentence in sentences:
        if any(_word_matches(word, sentence) for word in treatment_words):
            relevant_sentences.append(sentence.strip())

    if relevant_sentences:
        # Return the first relevant sentence, truncated if needed
        result = relevant_sentences[0]
        if len(result) > max_chars:
            return result[:max_chars].rsplit(" ", 1)[0] + "..."
        return result

    # Fallback: first 2 sentences (usually background + objective)
    fallback = ". ".join(sentences[:2])
    if len(fallback) > max_chars:
        return fallback[:max_chars].rsplit(" ", 1)[0] + "..."
    return fallback if fallback.endswith(".") else fallback + "..."


def sanitize_pmid(pmid_value: Any) -> str:
    """Extract clean PMID from potentially malformed value.

    MedGemma might return PMIDs as:
    - "23717274"
    - "PMID: 23717274"
    - "23717274 (2015)"
    - "PMC1234567"

    This extracts just the numeric portion.
    """
    if pmid_value is None:
        return ""

    pmid_str = str(pmid_value).strip()

    # Check for PMC ID (different format)
    pmc_match = re.search(r"PMC(\d+)", pmid_str, re.IGNORECASE)
    if pmc_match:
        return f"PMC{pmc_match.group(1)}"

    # Extract numeric PMID
    pmid_match = re.search(r"(\d{7,9})", pmid_str)
    if pmid_match:
        return pmid_match.group(1)

    # Return as-is if no pattern matched (better than nothing)
    return pmid_str


def _word_matches(word: str, text: str) -> bool:
    """Check if a word appears in text with appropriate matching.

    Short words (<6 chars) use word-boundary regex to avoid false positives
    (e.g., "mono" matching "mono-ADP-ribosylation").
    Longer words use substring matching since false positives are rare.
    """
    if len(word) < 6:
        return bool(re.search(r"\b" + re.escape(word) + r"\b", text, re.IGNORECASE))
    return word.lower() in text.lower()


# --- Renal Dosing Adjustments ---
# Deterministic checks for common renally-dosed medications

RENAL_DOSE_ADJUSTMENTS: dict[str, list[dict]] = {
    "metformin": [
        {
            "parameter": "eGFR",
            "range": (30, 45),
            "severity": "warning",
            "action": "Reduce to 500mg BID or 1000mg daily; monitor renal function q3 months",
        },
        {
            "parameter": "eGFR",
            "range": (0, 30),
            "severity": "critical",
            "action": "Contraindicated — discontinue metformin (risk of lactic acidosis)",
        },
    ],
    "apixaban": [
        {
            "parameter": "creatinine",
            "range": (1.5, 999),
            "severity": "warning",
            "action": "Check dose reduction criteria: reduce to 2.5mg BID if ≥2 of: age≥80, weight≤60kg, Cr≥1.5mg/dL",
        },
    ],
    "gabapentin": [
        {
            "parameter": "eGFR",
            "range": (30, 60),
            "severity": "warning",
            "action": "Reduce dose: max 300mg TID (eGFR 30-60)",
        },
        {
            "parameter": "eGFR",
            "range": (15, 30),
            "severity": "warning",
            "action": "Reduce dose: max 300mg BID (eGFR 15-30)",
        },
        {
            "parameter": "eGFR",
            "range": (0, 15),
            "severity": "critical",
            "action": "Reduce dose: max 300mg daily (eGFR <15)",
        },
    ],
    "lisinopril": [
        {
            "parameter": "eGFR",
            "range": (0, 30),
            "severity": "warning",
            "action": "Start low dose (2.5-5mg); monitor K+ and Cr closely after initiation",
        },
    ],
    "vancomycin": [
        {
            "parameter": "eGFR",
            "range": (0, 50),
            "severity": "warning",
            "action": "Extend interval; use AUC-guided dosing with therapeutic drug monitoring",
        },
    ],
    "enoxaparin": [
        {
            "parameter": "eGFR",
            "range": (0, 30),
            "severity": "critical",
            "action": "Reduce to once daily dosing (1mg/kg q24h); consider unfractionated heparin instead",
        },
    ],
    "rivaroxaban": [
        {
            "parameter": "eGFR",
            "range": (15, 50),
            "severity": "warning",
            "action": "Reduce dose per indication (e.g., 15mg daily for AF); monitor for bleeding",
        },
        {
            "parameter": "eGFR",
            "range": (0, 15),
            "severity": "critical",
            "action": "Avoid use — insufficient data for eGFR <15",
        },
    ],
}


def _extract_renal_function(labs: list[str]) -> dict[str, float | None]:
    """Extract eGFR and creatinine values from lab strings.

    Returns dict with 'egfr' and 'creatinine' keys (None if not found).
    """
    result: dict[str, float | None] = {"egfr": None, "creatinine": None}

    for lab in labs:
        lab_lower = lab.lower()

        # eGFR patterns: "eGFR 38", "GFR: 38 mL/min", "eGFR = 38"
        egfr_match = re.search(r"(?:e?gfr|glomerular\s+filtration)[:\s=]*(\d+\.?\d*)", lab_lower)
        if egfr_match:
            result["egfr"] = float(egfr_match.group(1))

        # Creatinine patterns: "Cr 1.8", "creatinine: 1.8 mg/dL", "SCr 1.8"
        cr_match = re.search(r"(?:s?cr(?:eatinine)?)[:\s=]*(\d+\.?\d*)", lab_lower)
        if cr_match:
            result["creatinine"] = float(cr_match.group(1))

    return result


def _check_renal_dosing(
    medications: list[str],
    renal: dict[str, float | None],
) -> list[dict]:
    """Check medications against renal dosing thresholds.

    Returns list of renal flag dicts with: drug, severity, action, parameter, value.
    """
    flags: list[dict] = []

    if renal["egfr"] is None and renal["creatinine"] is None:
        return flags

    for med_str in medications:
        med_lower = med_str.lower()
        for drug, rules in RENAL_DOSE_ADJUSTMENTS.items():
            if drug not in med_lower:
                continue
            for rule in rules:
                param = rule["parameter"]
                lo, hi = rule["range"]
                value = renal.get("egfr") if param == "eGFR" else renal.get("creatinine")
                if value is not None and lo <= value < hi:
                    flags.append(
                        {
                            "drug": drug,
                            "severity": rule["severity"],
                            "action": rule["action"],
                            "parameter": param,
                            "value": value,
                        }
                    )
    return flags


@dataclass
class PatientProfile:
    """Extracted patient demographics and history."""

    age: str = ""
    sex: str = ""
    relevant_history: list[str] = field(default_factory=list)


@dataclass
class ClinicalFindings:
    """Structured clinical findings from the case."""

    presentation: str = ""
    timeline: str = ""
    physical_exam: list[str] = field(default_factory=list)
    labs: list[str] = field(default_factory=list)
    imaging: list[str] = field(default_factory=list)
    vitals: list[str] = field(default_factory=list)
    precipitating_factors: str = ""
    context_of_onset: str = ""
    associated_symptoms: list[str] = field(default_factory=list)


@dataclass
class CurrentManagement:
    """Current treatments and recent changes."""

    medications: list[str] = field(default_factory=list)
    recent_changes: str = ""
    response_to_treatment: str = ""


@dataclass
class ParsedCase:
    """Fully parsed clinical case."""

    patient: PatientProfile
    findings: ClinicalFindings
    management: CurrentManagement
    clinical_question: str = ""
    case_category: str = ""  # e.g., "musculoskeletal", "cardiology", "neurology"


@dataclass
class TreatmentOption:
    """A treatment option with evidence evaluation."""

    name: str
    mechanism: str = ""
    verdict: str = "consider"  # recommended, consider, not_recommended
    confidence: float = 0.5
    fda_approved: bool = False
    fda_indication: str = ""
    evidence_grade: str = "moderate"
    pros: list[str] = field(default_factory=list)
    cons: list[str] = field(default_factory=list)
    key_evidence: list[dict] = field(default_factory=list)  # [{finding, pmid, year}]
    rationale: str = ""
    papers_used: list[dict] = field(
        default_factory=list
    )  # [{pmid, title, match_type, matched_words}]
    reasoning: dict = field(default_factory=dict)  # structured reasoning for transparency
    option_type: str = "medication"  # medication|procedure|diagnostic|supportive_care


@dataclass
class CaseAnalysisResult:
    """Complete case analysis result."""

    parsed_case: ParsedCase
    treatment_options: list[TreatmentOption]
    top_recommendation: str = ""
    recommendation_rationale: str = ""
    clinical_pearls: list[str] = field(default_factory=list)
    papers_reviewed: list[dict] = field(default_factory=list)
    search_terms_used: list[str] = field(default_factory=list)
    acute_management: dict = field(default_factory=dict)
    suggested_followups: list[str] = field(default_factory=list)
    medication_review: dict = field(default_factory=dict)
    differential_diagnosis: dict = field(default_factory=dict)
    clinical_risk_scores: dict = field(default_factory=dict)


CASE_PARSING_PROMPT = """Parse this clinical vignette and extract structured information.

CLINICAL CASE:
{case_text}

Extract the following in JSON format:
{{
    "patient": {{
        "age": "age with unit (e.g., '48 years')",
        "sex": "male/female",
        "relevant_history": ["list of relevant medical history items"]
    }},
    "findings": {{
        "presentation": "chief complaint or reason for evaluation",
        "timeline": "duration and progression of symptoms",
        "physical_exam": ["list of physical exam findings"],
        "labs": ["list of laboratory values with results"],
        "imaging": ["list of imaging findings"],
        "vitals": ["list of vital signs if mentioned"],
        "precipitating_factors": "what triggered or preceded symptoms (e.g., 'after gym pull day', 'post alcohol binge', 'lifting weights')",
        "context_of_onset": "circumstances at onset (e.g., 'during exercise', 'at rest', 'after eating')",
        "associated_symptoms": ["symptoms occurring alongside the chief complaint"]
    }},
    "management": {{
        "medications": ["current medications"],
        "recent_changes": "any recent treatment changes",
        "response_to_treatment": "response to current/past treatments"
    }},
    "clinical_question": "the key clinical decision to be made",
    "case_category": "medical specialty category (e.g., 'musculoskeletal', 'infectious_disease', 'cardiology', 'neurology', 'pulmonology', 'gastroenterology', 'endocrinology', 'psychiatry', 'dermatology', 'hematology_oncology', 'nephrology', 'rheumatology', 'urology', 'ophthalmology', 'ent', 'obstetrics_gynecology')"
}}

Be precise and extract only what's explicitly stated in the case.
Output ONLY the JSON object. No preamble, no explanation. Start your response with {{ and end with }}."""


TREATMENT_GENERATION_PROMPT = """Based on this clinical case, suggest 5-8 evidence-based treatment options.

CLINICAL CASE SUMMARY:
- Patient: {age} {sex} with {history}
- Presentation: {presentation}
- Precipitating Factors: {precipitating_factors}
- Context of Onset: {context_of_onset}
- Timeline: {timeline}
- Physical Exam: {physical_exam}
- Vitals: {vitals}
- Key Findings: {findings}
- Current Management: {management}
- Recent Changes: {recent_changes}
- Response to Treatment: {response_to_treatment}
- Clinical Question: {clinical_question}
- {category_context}

INSTRUCTIONS:
1. Treatments MUST directly address the presenting diagnosis/condition, NOT the general category.
2. Only include treatments that are INDICATED for THIS specific patient — do NOT list every treatment in the category.
3. Include a mix of types:
   a. DRUGS/MEDICATIONS (e.g., "Aspirin 325 mg PO", "IV heparin bolus + drip")
   b. PROCEDURES/INTERVENTIONS if indicated (e.g., "Emergent PCI", "Mechanical thrombectomy")
   c. KEY DIAGNOSTIC tests if not yet done (do NOT recommend tests already completed in the case)
   d. SUPPORTIVE CARE (e.g., "Supplemental O2", "IV fluid resuscitation")
4. Include modern guideline-recommended therapies (e.g., DOACs for VTE transition, tenecteplase for stroke).
5. Do NOT include treatments for conditions the patient does NOT have (e.g., do not recommend chest tube unless pneumothorax is present).
6. You MUST include corrections as BOTH treatment options AND in the metabolic_corrections array. Every abnormal lab requires a metabolic_corrections entry:
   - Hypocalcemia → IV calcium gluconate
   - Hyperkalemia/hypokalemia → appropriate K+ management
   - Hyperglycemia → insulin protocol
   - Metabolic acidosis (pH <7.3) → aggressive resuscitation, serial ABG monitoring
   - Hypertriglyceridemia (>1000 mg/dL) → insulin drip, consider plasmapheresis
7. Include the SPECIFIC CAUSE in treatment names or rationales (e.g., "Insulin drip for hypertriglyceridemia-induced pancreatitis", NOT just "Insulin drip"):
   - If a trigger is identifiable (alcohol, gallstones, drug reaction, infection), include etiology-specific treatment
   - If a metabolic derangement is likely CAUSING the condition, treat the cause and NAME the cause
8. TEMPORAL SEQUENCING: note if treatments must be ordered (e.g., "BP <185/110 BEFORE tPA"), delayed (e.g., "aspirin 24h AFTER tPA"), or time-windowed (e.g., "tPA within 4.5h onset"). State constraints in the rationale. For time-critical conditions, ALWAYS include specific time windows in rationales: stroke tPA within 4.5h, STEMI PCI door-to-balloon <90min, sepsis antibiotics within 1h.
9. Do NOT list HOME MEDICATIONS the patient is already taking unless there is a dose change or the medication should be HELD/DISCONTINUED.
10. Limit to 5-8 focused, non-redundant options. No duplicates.
11. ALWAYS include at least 2 specialty consults in acute_management.consults with urgency (emergent/urgent/routine). Include the PRIMARY specialty plus secondary consults for comorbidities.
12. ALWAYS include at least 3 entries in do_not_do. Include: medications contraindicated for this condition, premature oral intake if NPO-appropriate, and activity/procedure restrictions.

Generate in JSON format:
{{
    "options": [
        {{
            "name": "drug name+dose, procedure, or intervention",
            "mechanism": "brief mechanism (under 15 words)",
            "rationale": "why appropriate for THIS patient (under 20 words)",
            "fda_approved_for_indication": true/false/null,
            "option_type": "medication|procedure|diagnostic|supportive_care"
        }}
    ],
    "acute_management": {{
        "risk_stratification": "severity level with brief justification (e.g., 'HIGH — inferior STEMI with hemodynamic compromise, door-to-balloon target <90 min')",
        "immediate_actions": ["time-critical actions to perform RIGHT NOW, in order of priority"],
        "do_not_do": ["contraindicated actions with brief reason why"],
        "monitoring_plan": ["what to monitor and how frequently"],
        "disposition": "ICU / step-down / observation / floor / discharge with rationale",
        "consults": ["specialty and urgency level (emergent/urgent/routine)"],
        "activity_restrictions": "specific activity limitations with rationale (e.g., 'No contact sports for 4-8 weeks — splenic rupture risk') or 'None' if not applicable",
        "key_counseling": ["critical patient education points — return precautions, medication adherence, lifestyle modifications"],
        "metabolic_corrections": ["specific corrections needed for abnormal labs — calcium, potassium, glucose, pH — with target values"]
    }},
    "search_terms": ["MeSH terms relevant to the ACTUAL condition"]
}}

IMPORTANT:
- Diagnostic tests (CT, labs, LP, etc.) and supportive care (O2, IV fluids, positioning) are VALID treatment options. Do NOT omit them.
- Search terms must relate to the patient's actual condition and symptoms.
- For low-acuity cases (simple UTI, stable chronic conditions), set disposition to discharge or outpatient follow-up, NOT ICU.
- MATCH immediate_actions to risk_stratification severity:
  - LOW risk: immediate_actions should be DIAGNOSTIC (e.g., chest X-ray, labs, spirometry) and CONSERVATIVE (e.g., oral meds, outpatient referral). Do NOT include intubation, high-flow O2, IV drips, or ICU-level interventions.
  - MODERATE risk: include monitoring and targeted interventions but not emergent procedures unless specifically indicated by findings.
  - HIGH risk: include all indicated emergent interventions.
- Only recommend drug FORMULATIONS that exist (e.g., atorvastatin is ORAL only — no IV form). For NPO/dysphagia patients, note the constraint.
- Output ONLY the JSON object. No preamble, no explanation, no reasoning. Start your response with {{ and end with }}."""


TREATMENT_EVALUATION_PROMPT = """Evaluate this treatment option for the clinical case.

CLINICAL CONTEXT:
- Patient: {patient_summary}
- Presentation: {presentation}
- Precipitating Factors: {precipitating_factors}
- Context of Onset: {context_of_onset}
- Timeline: {timeline}
- Vitals: {vitals}
- Physical Exam: {physical_exam}
- Key Labs: {labs}
- Response to Treatment: {response_to_treatment}
- Category: {case_category}
- Clinical Question: {clinical_question}
- CURRENT MEDICATIONS: {current_medications}

TREATMENT TO EVALUATE:
{treatment_name}

===== EVIDENCE FROM PUBMED =====
{evidence_summary}
===== END OF EVIDENCE =====

VERDICT RULES — follow these strictly:

1. Use your MEDICAL KNOWLEDGE first, then PubMed evidence to supplement.
2. If a treatment is standard-of-care for this condition (e.g., aspirin for MI, insulin for DKA, tPA for stroke), rate "recommended" REGARDLESS of whether PubMed results mention it.
3. Absence of retrieved PubMed evidence does NOT mean "not_recommended". Many standard therapies are too established for recent trial abstracts.
4. Rate "not_recommended" if the treatment is:
   - Genuinely contraindicated for this patient
   - For a DIFFERENT condition than the one this patient has
   - Potentially harmful given the patient's specific context (e.g., thrombolytics in post-surgical patient = "consider" not "recommended")
5. Rate "consider" if the treatment:
   - Has conditional indications (e.g., thrombolysis in submassive PE — only if deteriorating)
   - Is an alternative to first-line therapy
   - Has significant risks that need to be weighed

DRUG INTERACTION RULE:
6. Check for drug-drug interactions between this treatment and CURRENT MEDICATIONS. If a major interaction exists (e.g., "triple whammy" of NSAID + ACEi/ARB + anticoagulant, or duplicate anticoagulation), downgrade to "consider" or "not_recommended" and list the interaction in cons.

TYPE-SPECIFIC RULES:
- PROCEDURES (PCI, thrombectomy, intubation): Set fda_approved=false. Evaluate based on clinical indication. Standard emergency procedures should be "recommended".
- DIAGNOSTICS (ECG, labs, imaging): Set fda_approved=false. If the test is indicated for this presentation, rate "recommended".
- SUPPORTIVE CARE (O2, IV fluids, monitoring, telemetry): Set fda_approved=false. If appropriate for this acuity, rate "recommended".
- MEDICATIONS: Evaluate FDA status normally. Standard-of-care meds should be "recommended". Check interactions with CURRENT MEDICATIONS.

Provide evaluation in JSON format:
{{
    "verdict": "recommended|consider|not_recommended",
    "confidence": 0.0 to 1.0,
    "fda_approved": true/false,
    "fda_indication": "FDA indication or 'N/A — procedure/diagnostic/supportive'",
    "evidence_grade": "high|moderate|low|very_low",
    "pros": ["advantages for this patient (2-3 items)"],
    "cons": ["risks or disadvantages (1-2 items)"],
    "rationale": "2-3 sentences on why this verdict for THIS patient",
    "reasoning": {{
        "patient_factors_considered": ["key patient factors that influenced this verdict (e.g., '21-year-old male', 'post-exercise onset', 'no fever')"],
        "supporting_evidence": "which evidence supports this verdict",
        "key_concern": "most important risk/benefit consideration",
        "context_relevance": "how precipitating factors or onset context influenced the assessment"
    }}
}}

CRITICAL: If a treatment is STANDARD-OF-CARE (first-line guideline therapy) for the primary diagnosis, verdict MUST be "recommended" with confidence ≥0.8. Examples: tPA for acute ischemic stroke in window, PCI for STEMI, heparin for PE, insulin for DKA, magnesium for eclampsia. Do NOT downgrade standard-of-care to "consider".

Output ONLY the JSON. No explanation. Start with {{ end with }}."""


class ClinicalCaseAnalyzer:
    """Analyzes clinical vignettes and provides evidence-based recommendations."""

    def __init__(self):
        self.medgemma = get_medgemma_client()

    async def analyze_case(
        self,
        case_text: str,
        papers: list[dict] | None = None,
    ) -> AsyncIterator[dict]:
        """Analyze a clinical case with streaming updates.

        Yields progress updates and final result.
        """
        try:
            # Step 1: Parse the case
            yield {
                "type": "step",
                "step": "parsing",
                "status": "started",
                "message": "Parsing clinical vignette...",
                "progress": 0.1,
            }

            parsed_case = await self._parse_case(case_text)

            yield {
                "type": "step",
                "step": "parsing",
                "status": "completed",
                "message": f"Identified: {parsed_case.clinical_question[:50]}...",
                "progress": 0.2,
                "data": {
                    "patient": {
                        "age": parsed_case.patient.age,
                        "sex": parsed_case.patient.sex,
                        "history": parsed_case.patient.relevant_history,
                    },
                    "findings": {
                        "presentation": parsed_case.findings.presentation,
                        "timeline": parsed_case.findings.timeline,
                        "labs": parsed_case.findings.labs,
                        "imaging": parsed_case.findings.imaging,
                        "physical_exam": parsed_case.findings.physical_exam,
                        "precipitating_factors": parsed_case.findings.precipitating_factors,
                        "context_of_onset": parsed_case.findings.context_of_onset,
                        "associated_symptoms": parsed_case.findings.associated_symptoms,
                    },
                    "management": {
                        "medications": parsed_case.management.medications,
                        "recent_changes": parsed_case.management.recent_changes,
                        "response_to_treatment": parsed_case.management.response_to_treatment,
                    },
                    "clinical_question": parsed_case.clinical_question,
                    "case_category": parsed_case.case_category,
                },
            }

            # Build parsed_case_dict once for parallel steps
            from src.medgemma.differential_diagnosis import (
                ddx_result_to_dict,
                generate_differential_diagnosis,
            )
            from src.medgemma.risk_scores import (
                calculate_risk_scores,
                risk_score_report_to_dict,
            )

            parsed_case_dict = {
                "patient": {
                    "age": parsed_case.patient.age,
                    "sex": parsed_case.patient.sex,
                    "relevant_history": parsed_case.patient.relevant_history,
                },
                "findings": {
                    "presentation": parsed_case.findings.presentation,
                    "timeline": parsed_case.findings.timeline,
                    "physical_exam": parsed_case.findings.physical_exam,
                    "labs": parsed_case.findings.labs,
                    "imaging": parsed_case.findings.imaging,
                    "precipitating_factors": parsed_case.findings.precipitating_factors,
                    "context_of_onset": parsed_case.findings.context_of_onset,
                    "associated_symptoms": parsed_case.findings.associated_symptoms,
                },
                "management": {
                    "medications": parsed_case.management.medications,
                    "recent_changes": parsed_case.management.recent_changes,
                    "response_to_treatment": parsed_case.management.response_to_treatment,
                },
                "clinical_question": parsed_case.clinical_question,
                "case_category": parsed_case.case_category,
            }

            # Run DDx, risk scores, and treatment generation in parallel
            # These are independent — each only needs the parsed case
            yield {
                "type": "step",
                "step": "parallel_analysis",
                "status": "started",
                "message": "Generating DDx, risk scores, and treatment options...",
                "progress": 0.22,
            }

            async def _run_ddx():
                return await generate_differential_diagnosis(
                    parsed_case=parsed_case_dict,
                    case_text=case_text,
                )

            async def _run_risk_scores():
                try:
                    report = await calculate_risk_scores(
                        parsed_case=parsed_case_dict,
                        case_text=case_text,
                    )
                    return risk_score_report_to_dict(report)
                except Exception as e:
                    logger.warning("Risk score calculation failed", error=str(e))
                    return {
                        "scores": [],
                        "case_category": parsed_case.case_category,
                        "summary": "Risk score calculation failed.",
                    }

            async def _run_treatment_gen():
                return await self._generate_treatment_options(parsed_case)

            ddx_result, risk_scores_dict, treatment_result = await asyncio.gather(
                _run_ddx(),
                _run_risk_scores(),
                _run_treatment_gen(),
            )

            # Unpack results
            ddx_dict = ddx_result_to_dict(ddx_result)
            options, search_terms, acute_management = treatment_result

            # Yield completed events for each parallel step
            yield {
                "type": "step",
                "step": "differential_diagnosis",
                "status": "completed",
                "message": f"Generated {len(ddx_result.diagnoses)} differential diagnoses",
                "progress": 0.28,
                "data": ddx_dict,
            }

            yield {
                "type": "step",
                "step": "risk_scores",
                "status": "completed",
                "message": f"Calculated {len(risk_scores_dict.get('scores', []))} risk scores",
                "progress": 0.30,
                "data": risk_scores_dict,
            }

            yield {
                "type": "step",
                "step": "generating_options",
                "status": "completed",
                "message": f"Generated {len(options)} treatment options",
                "progress": 0.4,
                "data": {
                    "options": [o.name for o in options],
                    "search_terms": search_terms,
                    "acute_management": acute_management,
                },
            }

            yield {
                "type": "step",
                "step": "parallel_analysis",
                "status": "completed",
                "message": "DDx, risk scores, and treatment options ready",
                "progress": 0.42,
            }

            # Step 3: Search for evidence (if papers not provided)
            if papers is None:
                yield {
                    "type": "step",
                    "step": "evidence_search",
                    "status": "started",
                    "message": "Searching medical literature...",
                    "progress": 0.45,
                }

                # Shared rate-limit lock: max 2 requests per second
                # to stay within NCBI's 3 req/s limit (with margin)
                _pubmed_lock = asyncio.Lock()

                async def _search_pubmed_direct(query: str, max_results: int = 10) -> list[dict]:
                    """Search PubMed directly via E-utilities (no agent).

                    Serialized via _pubmed_lock to avoid 429 rate-limit
                    errors from NCBI (3 req/s without API key).
                    """
                    import httpx

                    base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
                    ident = {
                        "tool": "research-synthesizer",
                        "email": "research-synthesizer@example.com",
                    }
                    headers = {"User-Agent": "research-synthesizer/1.0"}

                    async with _pubmed_lock:
                        # Step 1: esearch → PMIDs
                        search_params = {
                            "db": "pubmed",
                            "term": query,
                            "retmax": max_results,
                            "retmode": "json",
                            "sort": "relevance",
                            **ident,
                        }
                        async with httpx.AsyncClient(timeout=30.0) as client:
                            resp = await client.get(
                                f"{base}/esearch.fcgi",
                                params=search_params,
                                headers=headers,
                            )
                            resp.raise_for_status()

                        pmids = resp.json().get("esearchresult", {}).get("idlist", [])
                        if not pmids:
                            return []

                        # Rate-limit pause between esearch and efetch
                        await asyncio.sleep(0.4)

                        # Step 2: efetch → paper details (XML)
                        fetch_params = {
                            "db": "pubmed",
                            "id": ",".join(pmids),
                            "rettype": "abstract",
                            "retmode": "xml",
                            **ident,
                        }
                        async with httpx.AsyncClient(timeout=60.0) as client:
                            resp = await client.get(
                                f"{base}/efetch.fcgi",
                                params=fetch_params,
                                headers=headers,
                            )
                            resp.raise_for_status()

                        # Rate-limit pause before next search can start
                        await asyncio.sleep(0.4)

                    # Step 3: parse XML into dicts
                    from xml.etree import ElementTree

                    papers = []
                    try:
                        root = ElementTree.fromstring(resp.text)
                        for article in root.findall(".//PubmedArticle"):
                            pmid_el = article.find(".//PMID")
                            title_el = article.find(".//Article/ArticleTitle")
                            abstract_el = article.find(".//Article/Abstract/AbstractText")
                            year_el = article.find(
                                ".//Article/Journal/JournalIssue" "/PubDate/Year"
                            )
                            # Authors
                            authors = []
                            for au in article.findall(".//Article/AuthorList/Author")[:3]:
                                last = au.findtext("LastName", "")
                                init = au.findtext("Initials", "")
                                if last:
                                    authors.append(f"{last} {init}".strip())
                            # MeSH terms
                            mesh = [
                                m.findtext("DescriptorName", "")
                                for m in article.findall(".//MeshHeadingList/MeshHeading")
                            ]
                            # Publication types
                            pub_types = [
                                pt.text or ""
                                for pt in article.findall(
                                    ".//Article/PublicationTypeList" "/PublicationType"
                                )
                            ]
                            papers.append(
                                {
                                    "pmid": pmid_el.text if pmid_el is not None else "",
                                    "title": title_el.text if title_el is not None else "",
                                    "abstract": abstract_el.text if abstract_el is not None else "",
                                    "year": year_el.text if year_el is not None else "",
                                    "authors": authors,
                                    "publication_types": pub_types,
                                    "mesh_terms": mesh,
                                }
                            )
                    except ElementTree.ParseError as e:
                        logger.warning("Failed to parse PubMed XML", error=str(e))
                    return papers

                async def _search_term(term: str) -> list[dict]:
                    """Search PubMed for a single term and filter results."""
                    results = []
                    try:
                        found = await _search_pubmed_direct(query=term, max_results=10)
                        logger.info(
                            "PubMed direct search",
                            search_term=term,
                            count=len(found),
                            pmids=[p.get("pmid") for p in found],
                        )

                        term_words = [w.lower() for w in term.split() if len(w) > 2]
                        relevant = []
                        for p in found:
                            title_text = p.get("title") or ""
                            abstract_text = p.get("abstract") or ""

                            is_relevant = any(
                                _word_matches(word, title_text)
                                or _word_matches(word, abstract_text)
                                for word in term_words
                            )

                            if not is_relevant:
                                logger.info(
                                    "Paper did not match relevance filter",
                                    pmid=p.get("pmid"),
                                    title=title_text[:50],
                                    search_term=term,
                                )
                                continue
                            relevant.append(p)

                        # Soft human-study filter
                        human_only = [p for p in relevant if _is_human_clinical_study(p)]
                        if human_only:
                            results = human_only
                        elif relevant:
                            results = relevant
                        elif found:
                            # Last resort: keep top PubMed results
                            logger.info(
                                "All filters excluded every paper, " "keeping top PubMed results",
                                search_term=term,
                                count=min(5, len(found)),
                            )
                            results = found[:5]
                    except Exception as e:
                        import traceback

                        tb = traceback.format_exc()[-300:]
                        logger.warning(
                            "Search failed for term",
                            term=term,
                            error=str(e),
                            error_type=type(e).__name__,
                            traceback=tb,
                        )
                        search_errors.append(f"{term}: {type(e).__name__}: {e}")
                    return results

                # Search all terms in parallel
                search_errors: list[str] = []
                search_results = await asyncio.gather(
                    *(_search_term(term) for term in search_terms[:3])
                )
                papers = [p for batch in search_results for p in batch]

                if not papers:
                    logger.warning(
                        "No papers found for any search term",
                        search_terms=search_terms[:3],
                        errors=search_errors,
                    )

                yield {
                    "type": "step",
                    "step": "evidence_search",
                    "status": "completed",
                    "message": f"Found {len(papers)} relevant papers",
                    "progress": 0.55,
                    "data": {
                        "count": len(papers),
                        "search_terms": search_terms[:3],
                        "errors": search_errors if not papers else [],
                    },
                }

            # Step 4: Evaluate each treatment option
            yield {
                "type": "step",
                "step": "evaluating",
                "status": "started",
                "message": "Evaluating treatment options against evidence...",
                "progress": 0.6,
            }

            # Evaluate all treatments in parallel
            evaluated_options = list(
                await asyncio.gather(
                    *(self._evaluate_treatment(opt, parsed_case, papers) for opt in options)
                )
            )

            for evaluated in evaluated_options:
                yield {
                    "type": "step",
                    "step": "evaluating",
                    "status": "in_progress",
                    "message": f"Evaluated {evaluated.name}: {evaluated.verdict}",
                    "progress": 0.6
                    + (
                        0.25
                        * (evaluated_options.index(evaluated) + 1)
                        / max(len(evaluated_options), 1)
                    ),
                    "data": {
                        "name": evaluated.name,
                        "verdict": evaluated.verdict,
                        "confidence": evaluated.confidence,
                        "papers_used": evaluated.papers_used,
                        "rationale": evaluated.rationale[:120] if evaluated.rationale else "",
                    },
                }

            yield {
                "type": "step",
                "step": "evaluating",
                "status": "completed",
                "message": "All options evaluated",
                "progress": 0.85,
            }

            # Cross-validate treatments against do_not_do contraindications
            self._cross_validate_against_do_not_do(
                evaluated_options,
                acute_management.get("do_not_do", []),
            )

            # Step 5: Medication reconciliation
            yield {
                "type": "step",
                "step": "medication_review",
                "status": "started",
                "message": "Checking drug interactions and renal dosing...",
                "progress": 0.88,
            }

            medication_review = await self._perform_medication_reconciliation(
                parsed_case, evaluated_options
            )

            yield {
                "type": "step",
                "step": "medication_review",
                "status": "completed",
                "message": f"Found {len(medication_review.get('renal_flags', []))} renal flags, {len(medication_review.get('interactions', []))} interactions",
                "progress": 0.90,
            }

            # Step 6: Determine top recommendation
            evaluated_options.sort(
                key=lambda x: (
                    0 if x.verdict == "recommended" else 1 if x.verdict == "consider" else 2,
                    -x.confidence,
                )
            )

            viable_options = [
                o
                for o in evaluated_options
                if o.verdict in ("recommended", "consider") and o.confidence > 0.3
            ]
            top = viable_options[0] if viable_options else None

            # Generate clinical pearls (with full context)
            pearls = await self._generate_clinical_pearls(
                parsed_case,
                evaluated_options,
                acute_management=acute_management,
                medication_review=medication_review,
            )

            # Validate pearls against actual lab values
            pearls = _validate_pearls_against_labs(pearls, parsed_case.findings.labs)

            # Build warning if no viable recommendation was found
            if not top and evaluated_options:
                top_rationale = (
                    "No treatment received sufficient evidence to be recommended. "
                    "Clinical judgment and specialist consultation are strongly advised."
                )
            else:
                top_rationale = top.rationale if top else ""

            # Final result
            result = CaseAnalysisResult(
                parsed_case=parsed_case,
                treatment_options=evaluated_options,
                top_recommendation=top.name if top else "",
                recommendation_rationale=top_rationale,
                clinical_pearls=pearls,
                papers_reviewed=papers,
                search_terms_used=search_terms,
                acute_management=acute_management,
                medication_review=medication_review,
                differential_diagnosis=ddx_dict,
                clinical_risk_scores=risk_scores_dict,
            )

            # Generate suggested follow-up questions
            result.suggested_followups = self._generate_initial_followup_questions(result)

            yield {
                "type": "step",
                "step": "complete",
                "status": "completed",
                "message": f"Analysis complete. Top recommendation: {result.top_recommendation}",
                "progress": 1.0,
            }

            result_dict = self._result_to_dict(result)

            # Post-processing: validate and repair output deterministically
            from src.evaluation.output_validator import validate_and_repair

            category = result_dict.get("parsed_case", {}).get("case_category", "")
            result_dict = validate_and_repair(result_dict, category)

            yield {"type": "result", "data": result_dict}

        except Exception as e:
            logger.error("Case analysis failed", error=str(e))
            yield {"type": "error", "message": str(e)}

    async def _parse_case(self, case_text: str) -> ParsedCase:
        """Parse clinical vignette into structured components."""
        prompt = CASE_PARSING_PROMPT.format(case_text=case_text)

        response = await self.medgemma.generate(
            prompt=prompt,
            temperature=0.2,
            max_tokens=1500,
        )

        try:
            data = self.medgemma._parse_json_response(response)

            patient_data = data.get("patient", {})
            findings_data = data.get("findings", {})
            mgmt_data = data.get("management", {})

            # Ensure list fields contain only strings (model sometimes returns dicts)
            def ensure_str_list(val: Any) -> list[str]:
                if not isinstance(val, list):
                    return [str(val)] if val else []
                return [str(item) if not isinstance(item, str) else item for item in val]

            # Ensure string fields are actually strings
            def ensure_str(val: Any) -> str:
                if isinstance(val, list):
                    return ", ".join(str(v) for v in val)
                if isinstance(val, dict):
                    return str(val)
                return str(val) if val else ""

            return ParsedCase(
                patient=PatientProfile(
                    age=ensure_str(patient_data.get("age", "")),
                    sex=ensure_str(patient_data.get("sex", "")),
                    relevant_history=ensure_str_list(patient_data.get("relevant_history", [])),
                ),
                findings=ClinicalFindings(
                    presentation=ensure_str(findings_data.get("presentation", "")),
                    timeline=ensure_str(findings_data.get("timeline", "")),
                    physical_exam=ensure_str_list(findings_data.get("physical_exam", [])),
                    labs=ensure_str_list(findings_data.get("labs", [])),
                    imaging=ensure_str_list(findings_data.get("imaging", [])),
                    vitals=ensure_str_list(findings_data.get("vitals", [])),
                    precipitating_factors=ensure_str(
                        findings_data.get("precipitating_factors", "")
                    ),
                    context_of_onset=ensure_str(findings_data.get("context_of_onset", "")),
                    associated_symptoms=ensure_str_list(
                        findings_data.get("associated_symptoms", [])
                    ),
                ),
                management=CurrentManagement(
                    medications=ensure_str_list(mgmt_data.get("medications", [])),
                    recent_changes=ensure_str(mgmt_data.get("recent_changes", "")),
                    response_to_treatment=ensure_str(mgmt_data.get("response_to_treatment", "")),
                ),
                clinical_question=ensure_str(data.get("clinical_question", "")),
                case_category=ensure_str(data.get("case_category", "")),
            )
        except Exception as e:
            logger.error("Case parsing failed", error=str(e))
            return ParsedCase(
                patient=PatientProfile(),
                findings=ClinicalFindings(presentation=case_text[:200]),
                management=CurrentManagement(),
                clinical_question="Unable to parse clinical question",
            )

    async def _generate_treatment_options(
        self, parsed_case: ParsedCase
    ) -> tuple[list[TreatmentOption], list[str], dict]:
        """Generate potential treatment options for the case."""
        prompt = TREATMENT_GENERATION_PROMPT.format(
            age=parsed_case.patient.age,
            sex=parsed_case.patient.sex,
            history=", ".join(parsed_case.patient.relevant_history[:8]),
            presentation=parsed_case.findings.presentation,
            precipitating_factors=parsed_case.findings.precipitating_factors or "None identified",
            context_of_onset=parsed_case.findings.context_of_onset or "Not specified",
            timeline=parsed_case.findings.timeline or "Not specified",
            physical_exam=", ".join(parsed_case.findings.physical_exam[:6]) or "Not documented",
            vitals=", ".join(parsed_case.findings.vitals[:5]) or "Not documented",
            findings=", ".join(parsed_case.findings.labs[:8] + parsed_case.findings.imaging[:5]),
            management=", ".join(parsed_case.management.medications),
            recent_changes=parsed_case.management.recent_changes or "None",
            response_to_treatment=parsed_case.management.response_to_treatment or "Not documented",
            clinical_question=parsed_case.clinical_question,
            category_context=get_category_context(parsed_case.case_category),
        )

        response = await self.medgemma.generate(
            prompt=prompt,
            temperature=0.3,
            max_tokens=5000,
        )

        logger.debug("Treatment generation response", length=len(response))

        try:
            data = self.medgemma._parse_json_response(response)

            options = [
                TreatmentOption(
                    name=opt.get("name", ""),
                    mechanism=opt.get("mechanism", ""),
                    rationale=opt.get("rationale", ""),
                    option_type=opt.get("option_type", "medication"),
                )
                for opt in data.get("options", [])
            ]

            search_terms = data.get("search_terms", [])
            acute_management = data.get("acute_management", {})

            # Combine category with presentation for a specific search term
            # Bare category (e.g. "cardiology") retrieves irrelevant generic papers
            if parsed_case.case_category and parsed_case.findings.presentation:
                specific_term = (
                    f"{parsed_case.findings.presentation} {parsed_case.case_category} treatment"
                )
                search_terms.insert(0, specific_term)
            elif parsed_case.findings.presentation:
                search_terms.insert(0, parsed_case.findings.presentation)

            return options, search_terms, acute_management

        except Exception as e:
            logger.error("Treatment generation failed", error=str(e))
            return (
                [],
                [
                    (
                        f"{parsed_case.findings.presentation} treatment"
                        if parsed_case.findings.presentation
                        else "treatment"
                    )
                ],
                {},
            )

    async def _evaluate_treatment(
        self,
        option: TreatmentOption,
        parsed_case: ParsedCase,
        papers: list[dict],
    ) -> TreatmentOption:
        """Evaluate a treatment option against evidence."""
        # Find relevant papers for this treatment and track match type
        treatment_words = [w.lower() for w in option.name.split() if len(w) > 3]
        keyword_matched = []
        for p in papers:
            matched_words = [
                word
                for word in treatment_words
                if _word_matches(word, p.get("title", ""))
                or _word_matches(word, p.get("abstract", ""))
            ]
            if matched_words:
                keyword_matched.append((p, matched_words))

        if keyword_matched:
            relevant_papers = [item[0] for item in keyword_matched[:3]]
            option.papers_used = [
                {
                    "pmid": str(item[0].get("pmid", "")),
                    "title": item[0].get("title", "Unknown"),
                    "match_type": "keyword",
                    "matched_words": item[1],
                }
                for item in keyword_matched[:3]
            ]
        else:
            # No specific papers found, use general papers
            relevant_papers = papers[:3]
            option.papers_used = [
                {
                    "pmid": str(p.get("pmid", "")),
                    "title": p.get("title", "Unknown"),
                    "match_type": "general",
                    "matched_words": [],
                }
                for p in relevant_papers
            ]

        # Build evidence summary with FULL abstracts and clear PMID labels
        evidence_parts = []
        for p in relevant_papers:
            pmid = p.get("pmid", "N/A")
            title = p.get("title", "Unknown")
            year = p.get("year", "N/A")
            abstract = p.get("abstract", "No abstract available")

            evidence_parts.append(
                f"[PMID: {pmid}] ({year})\n" f"Title: {title}\n" f"Abstract: {abstract}\n"
            )

        evidence_summary = (
            "\n---\n".join(evidence_parts) if evidence_parts else "No direct evidence found."
        )

        patient_summary = f"{parsed_case.patient.age} {parsed_case.patient.sex} with {', '.join(parsed_case.patient.relevant_history[:5])}"

        current_meds = (
            ", ".join(parsed_case.management.medications)
            if parsed_case.management.medications
            else "None listed"
        )

        prompt = TREATMENT_EVALUATION_PROMPT.format(
            patient_summary=patient_summary,
            presentation=parsed_case.findings.presentation,
            precipitating_factors=parsed_case.findings.precipitating_factors or "None identified",
            context_of_onset=parsed_case.findings.context_of_onset or "Not specified",
            timeline=parsed_case.findings.timeline or "Not specified",
            vitals=", ".join(parsed_case.findings.vitals[:5]) or "Not documented",
            physical_exam=", ".join(parsed_case.findings.physical_exam[:6]) or "Not documented",
            labs=", ".join(parsed_case.findings.labs[:8]) or "None",
            response_to_treatment=parsed_case.management.response_to_treatment or "Not documented",
            case_category=parsed_case.case_category,
            clinical_question=parsed_case.clinical_question,
            current_medications=current_meds,
            treatment_name=f"{option.name} - {option.mechanism}",
            evidence_summary=evidence_summary,
        )

        response = await self.medgemma.generate(
            prompt=prompt,
            temperature=0.2,
            max_tokens=1000,
        )

        try:
            data = self.medgemma._parse_json_response(response)

            option.verdict = data.get("verdict", "consider")
            option.confidence = float(data.get("confidence", 0.5))
            option.fda_approved = data.get("fda_approved", False)
            option.fda_indication = data.get("fda_indication", "")
            option.evidence_grade = data.get("evidence_grade", "moderate")
            option.pros = data.get("pros", [])
            option.cons = data.get("cons", [])
            option.rationale = data.get("rationale", option.rationale)
            option.reasoning = data.get("reasoning", {})

            # CRITICAL FIX: Use ACTUAL abstract text instead of MedGemma's hallucinated quotes
            # MedGemma will generate plausible-sounding but completely fake quotes
            # We extract real text directly from the papers we have
            option.key_evidence = []

            for paper in relevant_papers[:2]:
                pmid = str(paper.get("pmid", ""))
                title = paper.get("title", "Unknown title")
                abstract = paper.get("abstract", "")
                year = str(paper.get("year", ""))

                # Extract a relevant snippet from the ACTUAL abstract
                abstract_snippet = get_relevant_snippet(abstract, option.name)

                option.key_evidence.append(
                    {
                        "finding": abstract_snippet,  # REAL text from REAL paper
                        "pmid": pmid,
                        "year": year,
                        "title": title,  # Include title for context
                    }
                )

                logger.info(
                    "Using real abstract text", pmid=pmid, title=title[:50], treatment=option.name
                )

            # Post-processing: boost diagnostics that were incorrectly downgraded
            _maybe_boost_diagnostic(option)

            return option

        except Exception as e:
            logger.warning("Treatment evaluation failed", treatment=option.name, error=str(e))
            return option

    async def _generate_clinical_pearls(
        self,
        parsed_case: ParsedCase,
        options: list[TreatmentOption],
        acute_management: dict | None = None,
        medication_review: dict | None = None,
    ) -> list[str]:
        """Generate clinical teaching points with full treatment context."""
        # Build treatment summary with verdicts
        treatment_lines = []
        for o in options[:6]:
            treatment_lines.append(
                f"- {o.name}: {o.verdict} ({o.confidence:.0%}) — {o.rationale[:60]}"
            )
        treatment_summary = "\n".join(treatment_lines) if treatment_lines else "None evaluated"

        # Do-not-do list
        do_not_do_text = ""
        if acute_management and acute_management.get("do_not_do"):
            do_not_do_text = "\nDO NOT DO:\n" + "\n".join(
                f"- {d}" for d in acute_management["do_not_do"]
            )

        # Medication concerns
        med_concerns_text = ""
        if medication_review:
            concerns = []
            for flag in medication_review.get("renal_flags", []):
                concerns.append(f"- RENAL: {flag['drug']} — {flag['action']}")
            for ix in medication_review.get("interactions", []):
                concerns.append(
                    f"- INTERACTION: {ix.get('drug_a', '?')} + {ix.get('drug_b', '?')} — {ix.get('effect', '?')}"
                )
            if concerns:
                med_concerns_text = "\nMEDICATION CONCERNS:\n" + "\n".join(concerns)

        current_meds = (
            ", ".join(parsed_case.management.medications)
            if parsed_case.management.medications
            else "None"
        )

        prompt = f"""Based on this clinical case about {parsed_case.case_category}, provide 2-3 key clinical pearls or teaching points.

CASE FACTS (only reference what is stated here):
- Patient: {parsed_case.patient.age} {parsed_case.patient.sex}
- Presentation: {parsed_case.findings.presentation}
- Key findings: {', '.join(parsed_case.findings.labs[:3] + parsed_case.findings.imaging[:2])}
- Current Medications: {current_meds}
- Clinical Question: {parsed_case.clinical_question}

TREATMENT VERDICTS (these are the analysis conclusions — do NOT contradict them):
{treatment_summary}
{do_not_do_text}
{med_concerns_text}

RULES:
1. Each pearl must be grounded in the STATED case facts above — do not invent patient details.
2. DO NOT contradict the treatment verdicts above. If a treatment is "recommended", do not say it is contraindicated.
3. Include at least one pearl about a common clinical pitfall or "do not miss" for this presentation.
4. If there are medication concerns listed above, include at least one pearl about medication safety.
5. If this is an emergency presentation, include a time-sensitive pearl (e.g., door-to-balloon, tPA window).
6. Keep pearls concise (1-2 sentences each).

Respond with a JSON array of strings:
["pearl 1", "pearl 2", "pearl 3"]

Output ONLY the JSON array. No preamble. Start with [ and end with ]."""

        response = await self.medgemma.generate(
            prompt=prompt,
            temperature=0.3,
            max_tokens=800,
        )

        try:
            # Search for JSON array in the FULL response (before cleaning)
            # because _clean_response may strip the array if it's inside thinking tokens
            import re

            # Try to find a JSON array with quoted strings
            match = re.search(r'\[\s*"[^"]+?".*?\]', response, re.DOTALL)
            if match:
                try:
                    pearls = json.loads(match.group())
                    if isinstance(pearls, list) and len(pearls) > 0:
                        return [str(p) for p in pearls if p][:3]
                except json.JSONDecodeError:
                    pass

            # Fallback: clean response then try
            cleaned = self.medgemma._clean_response(response)
            match = re.search(r'\[\s*"[^"]+?".*?\]', cleaned, re.DOTALL)
            if match:
                try:
                    pearls = json.loads(match.group())
                    if isinstance(pearls, list):
                        return [str(p) for p in pearls if p][:3]
                except json.JSONDecodeError:
                    pass

            # Last resort: extract bullet points from text
            lines = response.split("\n")
            pearls = []
            for line in lines:
                line = line.strip()
                if (
                    line.startswith("- ")
                    or line.startswith("* ")
                    or (line[:3].replace(".", "").isdigit())
                ):
                    pearl_text = re.sub(r"^[\-\*\d.)\s]+", "", line).strip()
                    if len(pearl_text) > 20 and pearl_text[0].isupper():
                        pearls.append(pearl_text)
            if pearls:
                return pearls[:3]

            return []
        except Exception as e:
            logger.warning("Clinical pearls parsing failed", error=str(e))
            return []

    async def _perform_medication_reconciliation(
        self,
        parsed_case: ParsedCase,
        evaluated_options: list[TreatmentOption],
    ) -> dict:
        """Perform medication reconciliation: renal dosing + drug interaction check.

        Returns dict with renal_flags, interactions, duplicate_therapy, renal_function.
        """
        from src.medgemma.prompts import MEDICATION_RECONCILIATION_PROMPT

        # 1. Deterministic renal dosing check
        renal = _extract_renal_function(parsed_case.findings.labs)
        all_meds = list(parsed_case.management.medications)
        # Include recommended treatment names
        rec_names = [o.name for o in evaluated_options if o.verdict in ("recommended", "consider")]
        all_meds_plus_recs = all_meds + rec_names

        renal_flags = _check_renal_dosing(all_meds_plus_recs, renal)

        # 2. LLM drug interaction check (if there are medications to check)
        interactions: list[dict] = []
        duplicate_therapy: list[dict] = []

        if all_meds and rec_names:
            patient_summary = f"{parsed_case.patient.age} {parsed_case.patient.sex}"
            renal_str = ""
            if renal["egfr"] is not None:
                renal_str += f"eGFR: {renal['egfr']} mL/min/1.73m²"
            if renal["creatinine"] is not None:
                renal_str += f"{', ' if renal_str else ''}Creatinine: {renal['creatinine']} mg/dL"
            if not renal_str:
                renal_str = "Not available"

            conditions = (
                ", ".join(parsed_case.patient.relevant_history[:5])
                if parsed_case.patient.relevant_history
                else "See case"
            )

            prompt = MEDICATION_RECONCILIATION_PROMPT.format(
                patient_summary=patient_summary,
                renal_function=renal_str,
                conditions=conditions,
                current_medications="\n".join(f"- {m}" for m in all_meds),
                recommended_treatments="\n".join(f"- {r}" for r in rec_names),
            )

            try:
                response = await self.medgemma.generate(
                    prompt=prompt,
                    temperature=0.2,
                    max_tokens=1500,
                )
                data = self.medgemma._parse_json_response(response)
                raw_interactions = data.get("interactions", [])
                duplicate_therapy = data.get("duplicate_therapy", [])

                # Deduplicate interactions by normalized drug pair
                seen_pairs: set[tuple[str, str]] = set()
                for ix in raw_interactions:
                    a = ix.get("drug_a", "").lower().strip()
                    b = ix.get("drug_b", "").lower().strip()
                    if not a or not b:
                        continue
                    pair = tuple(sorted([a, b]))
                    if pair in seen_pairs:
                        continue
                    seen_pairs.add(pair)
                    interactions.append(ix)
            except Exception as e:
                logger.warning("Medication reconciliation LLM call failed", error=str(e))

        result = {
            "renal_flags": renal_flags,
            "interactions": interactions,
            "duplicate_therapy": duplicate_therapy,
            "renal_function": {
                "egfr": renal["egfr"],
                "creatinine": renal["creatinine"],
            },
        }

        logger.info(
            "Medication reconciliation complete",
            renal_flags=len(renal_flags),
            interactions=len(interactions),
            duplicate_therapy=len(duplicate_therapy),
        )

        return result

    # Common drug → class lookup for contraindication cross-checking
    _DRUG_CLASS_MAP: dict[str, str] = {
        "amoxicillin": "antibiotic",
        "ampicillin": "antibiotic",
        "azithromycin": "antibiotic",
        "ciprofloxacin": "antibiotic",
        "levofloxacin": "antibiotic",
        "doxycycline": "antibiotic",
        "metronidazole": "antibiotic",
        "ceftriaxone": "antibiotic",
        "cephalexin": "antibiotic",
        "clindamycin": "antibiotic",
        "trimethoprim": "antibiotic",
        "sulfamethoxazole": "antibiotic",
        "penicillin": "antibiotic",
        "vancomycin": "antibiotic",
        "piperacillin": "antibiotic",
        "meropenem": "antibiotic",
        "ibuprofen": "nsaid",
        "naproxen": "nsaid",
        "ketorolac": "nsaid",
        "aspirin": "nsaid",
        "celecoxib": "nsaid",
        "warfarin": "anticoagulant",
        "heparin": "anticoagulant",
        "enoxaparin": "anticoagulant",
        "rivaroxaban": "anticoagulant",
        "apixaban": "anticoagulant",
        "morphine": "opioid",
        "fentanyl": "opioid",
        "oxycodone": "opioid",
        "hydromorphone": "opioid",
        "methadone": "opioid",
        "prednisone": "corticosteroid",
        "prednisolone": "corticosteroid",
        "dexamethasone": "corticosteroid",
        "methylprednisolone": "corticosteroid",
        "hydrocortisone": "corticosteroid",
    }

    _FILLER_WORDS = frozenset(
        {
            "the",
            "and",
            "for",
            "with",
            "this",
            "that",
            "from",
            "have",
            "been",
            "will",
            "can",
            "may",
            "should",
            "would",
            "could",
            "not",
            "are",
            "was",
            "were",
            "has",
            "had",
            "does",
            "did",
            "but",
            "any",
            "all",
            "each",
            "use",
            "due",
            "risk",
            "avoid",
            "give",
            "take",
            "used",
            "such",
        }
    )

    # Verbs whose negation is prescriptive ("do not delay X" = DO X immediately).
    # Entries containing these should be SKIPPED during cross-validation.
    _PRESCRIPTIVE_VERBS = frozenset(
        {
            "delay",
            "withhold",
            "defer",
            "postpone",
            "wait",
            "hold",
            "stop",
            "discontinue",
            "omit",
            "skip",
            "forget",
            "neglect",
        }
    )

    def _cross_validate_against_do_not_do(
        self,
        options: list[TreatmentOption],
        do_not_do: list[str],
    ) -> None:
        """Cross-validate treatment options against do_not_do contraindications.

        Catches cases where a treatment was rated 'recommended' or 'consider'
        but directly contradicts an entry in do_not_do (e.g., antibiotics for
        viral infections). Modifies options in-place.
        """
        if not do_not_do:
            return

        # Extract significant keywords from each do_not_do entry
        dnd_keywords: list[tuple[str, str]] = []  # (keyword, original entry)
        for entry in do_not_do:
            words = re.findall(r"[a-zA-Z]+", entry.lower())
            # Skip prescriptive entries — "do not delay X" means X is MANDATORY
            if any(w in self._PRESCRIPTIVE_VERBS for w in words):
                continue
            for word in words:
                if len(word) > 3 and word not in self._FILLER_WORDS:
                    dnd_keywords.append((word, entry))

        if not dnd_keywords:
            return

        for option in options:
            if option.verdict == "not_recommended":
                continue  # Already flagged

            # Get words from option name
            option_words = [w.lower() for w in re.findall(r"[a-zA-Z]+", option.name)]

            # Check 1: Direct word match — require 2+ distinct keyword matches
            # to avoid false positives from coincidental single-word overlap
            matched_entry = None
            match_count = 0
            for opt_word in option_words:
                for dnd_keyword, entry in dnd_keywords:
                    if _word_matches(opt_word, dnd_keyword) or _word_matches(dnd_keyword, opt_word):
                        match_count += 1
                        matched_entry = entry
                        break
            if match_count < 2:
                matched_entry = None

            # Check 2: Drug class match — if do_not_do says "antibiotics",
            # check if option contains an antibiotic drug name
            if not matched_entry:
                for opt_word in option_words:
                    drug_class = self._DRUG_CLASS_MAP.get(opt_word)
                    if drug_class:
                        for dnd_keyword, entry in dnd_keywords:
                            # Check if the do_not_do keyword matches the drug class
                            # e.g., "antibiotic" in do_not_do matches amoxicillin's class
                            if dnd_keyword in drug_class or drug_class in dnd_keyword:
                                matched_entry = entry
                                break
                            # Also match plurals: "antibiotics" → "antibiotic"
                            if dnd_keyword.rstrip(
                                "s"
                            ) in drug_class or drug_class in dnd_keyword.rstrip("s"):
                                matched_entry = entry
                                break
                    if matched_entry:
                        break

            if matched_entry:
                logger.warning(
                    "SAFETY: Contraindication detected",
                    treatment=option.name,
                    previous_verdict=option.verdict,
                    previous_confidence=option.confidence,
                    do_not_do_entry=matched_entry,
                )
                option.verdict = "not_recommended"
                option.confidence = min(option.confidence, 0.2)
                option.rationale = f'SAFETY: Contradicts do_not_do guideline — "{matched_entry}". {option.rationale}'
                if f"Contradicts: {matched_entry}" not in option.cons:
                    option.cons.insert(0, f"Contradicts: {matched_entry}")

    def _generate_initial_followup_questions(self, result: CaseAnalysisResult) -> list[str]:
        """Generate context-aware follow-up questions deterministically (no LLM call)."""
        questions = []
        if result.parsed_case.management.medications:
            meds = ", ".join(result.parsed_case.management.medications[:3])
            questions.append(f"Are there drug interactions with {meds}?")
        if result.top_recommendation:
            questions.append(f"What if the patient can't tolerate {result.top_recommendation}?")
        not_rec = [t for t in result.treatment_options if t.verdict == "not_recommended"]
        if not_rec:
            questions.append(f"Why was {not_rec[0].name} rated not recommended?")
        questions.append("Should additional workup be ordered before starting treatment?")
        questions.append("What monitoring is needed and what is the disposition plan?")
        return questions[:5]

    def _result_to_dict(self, result: CaseAnalysisResult) -> dict:
        """Convert result to dictionary for JSON serialization."""
        return {
            "parsed_case": {
                "patient": {
                    "age": result.parsed_case.patient.age,
                    "sex": result.parsed_case.patient.sex,
                    "relevant_history": result.parsed_case.patient.relevant_history,
                },
                "findings": {
                    "presentation": result.parsed_case.findings.presentation,
                    "timeline": result.parsed_case.findings.timeline,
                    "physical_exam": result.parsed_case.findings.physical_exam,
                    "labs": result.parsed_case.findings.labs,
                    "imaging": result.parsed_case.findings.imaging,
                    "precipitating_factors": result.parsed_case.findings.precipitating_factors,
                    "context_of_onset": result.parsed_case.findings.context_of_onset,
                    "associated_symptoms": result.parsed_case.findings.associated_symptoms,
                },
                "management": {
                    "medications": result.parsed_case.management.medications,
                    "recent_changes": result.parsed_case.management.recent_changes,
                    "response_to_treatment": result.parsed_case.management.response_to_treatment,
                },
                "clinical_question": result.parsed_case.clinical_question,
                "case_category": result.parsed_case.case_category,
            },
            "treatment_options": [
                {
                    "name": opt.name,
                    "mechanism": opt.mechanism,
                    "verdict": opt.verdict,
                    "confidence": opt.confidence,
                    "fda_approved": opt.fda_approved,
                    "fda_indication": opt.fda_indication,
                    "evidence_grade": opt.evidence_grade,
                    "pros": opt.pros,
                    "cons": opt.cons,
                    "key_evidence": [
                        {
                            "finding": ev.get("finding", ""),
                            "pmid": sanitize_pmid(ev.get("pmid")),
                            "year": str(ev.get("year", "")).strip(),
                            "title": ev.get("title", ""),  # Include paper title
                        }
                        for ev in (opt.key_evidence or [])
                    ],
                    "rationale": opt.rationale,
                    "papers_used": opt.papers_used or [],
                    "reasoning": opt.reasoning or {},
                    "option_type": opt.option_type,
                }
                for opt in result.treatment_options
            ],
            "top_recommendation": result.top_recommendation,
            "recommendation_rationale": result.recommendation_rationale,
            "clinical_pearls": result.clinical_pearls,
            "papers_reviewed": [
                {
                    "pmid": sanitize_pmid(p.get("pmid")),
                    "title": p.get("title", ""),
                    "year": str(p.get("year", "")).strip(),
                }
                for p in (result.papers_reviewed or [])
            ],
            "search_terms_used": result.search_terms_used,
            "acute_management": result.acute_management,
            "suggested_followups": result.suggested_followups,
            "medication_review": result.medication_review,
            "differential_diagnosis": result.differential_diagnosis,
            "clinical_risk_scores": result.clinical_risk_scores,
        }

    def _merge_findings(
        self,
        parsed_case_dict: dict,
        new_findings: list[dict],
    ) -> ParsedCase:
        """Merge new findings into an existing parsed case.

        Programmatically appends new findings to the appropriate section
        of the parsed case without re-running LLM parsing.
        """
        patient_data = parsed_case_dict.get("patient", {})
        findings_data = parsed_case_dict.get("findings", {})
        mgmt_data = parsed_case_dict.get("management", {})

        # Build lists from existing data
        labs = list(findings_data.get("labs", []))
        imaging = list(findings_data.get("imaging", []))
        vitals = list(findings_data.get("vitals", []))
        physical_exam = list(findings_data.get("physical_exam", []))
        medications = list(mgmt_data.get("medications", []))

        # Merge new findings into appropriate categories
        for finding in new_findings:
            cat = finding.get("category", "")
            text = finding.get("text", "")
            time_prefix = f"[{finding['clinical_time']}] " if finding.get("clinical_time") else ""
            entry = f"{time_prefix}{text}"

            if cat == "labs":
                labs.append(entry)
            elif cat == "imaging":
                imaging.append(entry)
            elif cat == "vitals":
                vitals.append(entry)
            elif cat == "physical_exam":
                physical_exam.append(entry)
            elif cat == "medications":
                medications.append(entry)
            elif cat == "clinical_change":
                # Clinical changes go to physical exam as most general bucket
                physical_exam.append(entry)

        return ParsedCase(
            patient=PatientProfile(
                age=str(patient_data.get("age", "")),
                sex=str(patient_data.get("sex", "")),
                relevant_history=list(patient_data.get("relevant_history", [])),
            ),
            findings=ClinicalFindings(
                presentation=str(findings_data.get("presentation", "")),
                timeline=str(findings_data.get("timeline", "")),
                physical_exam=physical_exam,
                labs=labs,
                imaging=imaging,
                vitals=vitals,
                precipitating_factors=str(findings_data.get("precipitating_factors", "")),
                context_of_onset=str(findings_data.get("context_of_onset", "")),
                associated_symptoms=list(findings_data.get("associated_symptoms", [])),
            ),
            management=CurrentManagement(
                medications=medications,
                recent_changes=str(mgmt_data.get("recent_changes", "")),
                response_to_treatment=str(mgmt_data.get("response_to_treatment", "")),
            ),
            clinical_question=str(parsed_case_dict.get("clinical_question", "")),
            case_category=str(parsed_case_dict.get("case_category", "")),
        )

    async def reassess_case(
        self,
        original_case_text: str,
        new_findings: list[dict],
        previous_parsed_case: dict,
        previous_search_terms: list[str] | None = None,
        previous_papers: list[dict] | None = None,
    ) -> AsyncIterator[dict]:
        """Reassess a case with new findings. Streams SSE updates like analyze_case().

        Skips case parsing (uses merged parsed case), reuses overlapping PubMed papers,
        and generates fresh treatment evaluations and clinical pearls.
        """
        try:
            # Step 1: Merge findings
            yield {
                "type": "step",
                "step": "parsing",
                "status": "started",
                "message": "Merging new findings into case...",
                "progress": 0.1,
            }

            merged_case = self._merge_findings(previous_parsed_case, new_findings)

            yield {
                "type": "step",
                "step": "parsing",
                "status": "completed",
                "message": f"Merged {len(new_findings)} new finding(s)",
                "progress": 0.2,
                "data": {
                    "patient": {
                        "age": merged_case.patient.age,
                        "sex": merged_case.patient.sex,
                        "history": merged_case.patient.relevant_history,
                    },
                    "findings": {
                        "presentation": merged_case.findings.presentation,
                        "timeline": merged_case.findings.timeline,
                        "labs": merged_case.findings.labs,
                        "imaging": merged_case.findings.imaging,
                        "physical_exam": merged_case.findings.physical_exam,
                        "precipitating_factors": merged_case.findings.precipitating_factors,
                        "context_of_onset": merged_case.findings.context_of_onset,
                        "associated_symptoms": merged_case.findings.associated_symptoms,
                    },
                    "management": {
                        "medications": merged_case.management.medications,
                        "recent_changes": merged_case.management.recent_changes,
                        "response_to_treatment": merged_case.management.response_to_treatment,
                    },
                    "clinical_question": merged_case.clinical_question,
                    "case_category": merged_case.case_category,
                },
            }

            # Step 2: Generate updated treatment options
            yield {
                "type": "step",
                "step": "generating_options",
                "status": "started",
                "message": "Re-generating treatment options with new findings...",
                "progress": 0.3,
            }

            options, search_terms, acute_management = await self._generate_treatment_options(
                merged_case
            )

            yield {
                "type": "step",
                "step": "generating_options",
                "status": "completed",
                "message": f"Generated {len(options)} treatment options",
                "progress": 0.4,
                "data": {
                    "options": [o.name for o in options],
                    "search_terms": search_terms,
                    "acute_management": acute_management,
                },
            }

            # Step 3: Search for evidence — reuse papers where search terms overlap
            yield {
                "type": "step",
                "step": "evidence_search",
                "status": "started",
                "message": "Searching for additional evidence...",
                "progress": 0.45,
            }

            papers = list(previous_papers or [])
            prev_terms_set = set(previous_search_terms or [])

            # Only search for genuinely new terms
            new_terms = [t for t in search_terms[:3] if t not in prev_terms_set]

            if new_terms:
                from src.agents.ingest_pubmed import search_pubmed_papers

                for term in new_terms:
                    try:
                        found = await search_pubmed_papers(query=term, max_results=5)
                        term_words = [w.lower() for w in term.split() if len(w) > 3]
                        for p in found:
                            title_text = p.title or ""
                            abstract_text = p.abstract or ""
                            is_relevant = any(
                                _word_matches(word, title_text)
                                or _word_matches(word, abstract_text)
                                for word in term_words
                            )
                            if not is_relevant:
                                continue
                            # Deduplicate by PMID
                            existing_pmids = {str(ep.get("pmid", "")) for ep in papers}
                            if str(p.id) in existing_pmids:
                                continue
                            meta = p.metadata if hasattr(p, "metadata") and p.metadata else {}
                            paper_dict = {
                                "pmid": p.id,
                                "title": p.title,
                                "abstract": p.abstract,
                                "year": p.published.year if p.published else "",
                                "authors": p.authors[:3],
                                "publication_types": meta.get("publication_types", []),
                                "mesh_terms": meta.get("mesh_terms", []),
                            }
                            if not _is_human_clinical_study(paper_dict):
                                logger.warning(
                                    "Filtered non-human study (reassess)",
                                    pmid=p.id,
                                    title=p.title[:50],
                                )
                                continue
                            papers.append(paper_dict)
                    except Exception as e:
                        logger.warning("Search failed for term", term=term, error=str(e))

            yield {
                "type": "step",
                "step": "evidence_search",
                "status": "completed",
                "message": f"Using {len(papers)} papers ({len(new_terms)} new searches)",
                "progress": 0.55,
                "data": {"count": len(papers)},
            }

            # Step 4: Evaluate each treatment option
            yield {
                "type": "step",
                "step": "evaluating",
                "status": "started",
                "message": "Evaluating treatment options against evidence...",
                "progress": 0.6,
            }

            evaluated_options = []
            for i, option in enumerate(options):
                progress = 0.6 + (0.25 * (i + 1) / len(options))
                yield {
                    "type": "step",
                    "step": "evaluating",
                    "status": "in_progress",
                    "message": f"Evaluating {option.name}...",
                    "progress": progress,
                }
                evaluated = await self._evaluate_treatment(option, merged_case, papers)
                evaluated_options.append(evaluated)

            yield {
                "type": "step",
                "step": "evaluating",
                "status": "completed",
                "message": "All options evaluated",
                "progress": 0.85,
            }

            # Cross-validate treatments against do_not_do contraindications
            self._cross_validate_against_do_not_do(
                evaluated_options,
                acute_management.get("do_not_do", []),
            )

            # Step 5: Medication reconciliation
            yield {
                "type": "step",
                "step": "medication_review",
                "status": "started",
                "message": "Checking drug interactions and renal dosing...",
                "progress": 0.88,
            }

            medication_review = await self._perform_medication_reconciliation(
                merged_case, evaluated_options
            )

            yield {
                "type": "step",
                "step": "medication_review",
                "status": "completed",
                "message": f"Found {len(medication_review.get('renal_flags', []))} renal flags, {len(medication_review.get('interactions', []))} interactions",
                "progress": 0.90,
            }

            # Step 6: Determine top recommendation
            evaluated_options.sort(
                key=lambda x: (
                    0 if x.verdict == "recommended" else 1 if x.verdict == "consider" else 2,
                    -x.confidence,
                )
            )

            viable_options = [
                o
                for o in evaluated_options
                if o.verdict in ("recommended", "consider") and o.confidence > 0.3
            ]
            top = viable_options[0] if viable_options else None

            pearls = await self._generate_clinical_pearls(
                merged_case,
                evaluated_options,
                acute_management=acute_management,
                medication_review=medication_review,
            )

            if not top and evaluated_options:
                top_rationale = (
                    "No treatment received sufficient evidence to be recommended. "
                    "Clinical judgment and specialist consultation are strongly advised."
                )
            else:
                top_rationale = top.rationale if top else ""

            result = CaseAnalysisResult(
                parsed_case=merged_case,
                treatment_options=evaluated_options,
                top_recommendation=top.name if top else "",
                recommendation_rationale=top_rationale,
                clinical_pearls=pearls,
                papers_reviewed=papers,
                search_terms_used=search_terms,
                acute_management=acute_management,
                medication_review=medication_review,
            )
            result.suggested_followups = self._generate_initial_followup_questions(result)

            yield {
                "type": "step",
                "step": "complete",
                "status": "completed",
                "message": f"Reassessment complete. Top recommendation: {result.top_recommendation}",
                "progress": 1.0,
            }

            yield {"type": "result", "data": self._result_to_dict(result)}

        except Exception as e:
            logger.error("Case reassessment failed", error=str(e))
            yield {"type": "error", "message": str(e)}


# Singleton instance
_analyzer: ClinicalCaseAnalyzer | None = None


def get_case_analyzer() -> ClinicalCaseAnalyzer:
    """Get or create the case analyzer instance."""
    global _analyzer
    if _analyzer is None:
        _analyzer = ClinicalCaseAnalyzer()
    return _analyzer
