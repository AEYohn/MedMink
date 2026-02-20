"""ePCR (Electronic Patient Care Report) data models for EMS run reports.

Defines all dataclasses for the structured ePCR data model including
dispatch, scene assessment, patient info, assessments, interventions,
transport, and validation.
"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class DispatchInfo:
    """CAD/dispatch information."""

    call_type: str = ""  # 911, IFT, mutual aid, standby
    dispatch_complaint: str = ""
    priority: str = ""  # emergent, non-emergent, ALS, BLS
    unit_number: str = ""
    crew: list[str] = field(default_factory=list)
    # Timestamps (ISO-8601)
    time_dispatched: str = ""
    time_enroute: str = ""
    time_on_scene: str = ""
    time_at_patient: str = ""
    time_left_scene: str = ""
    time_at_destination: str = ""
    time_in_service: str = ""


@dataclass
class SceneAssessment:
    """Scene size-up and assessment."""

    location_type: str = ""  # residence, street, workplace, public
    address: str = ""
    scene_safe: bool | None = None
    hazards: list[str] = field(default_factory=list)
    patient_count: int = 1
    mci: bool = False
    mechanism_of_injury: str = ""
    nature_of_illness: str = ""


@dataclass
class PatientInfo:
    """Patient demographics and history."""

    name: str = ""
    age: str = ""
    sex: str = ""
    weight: str = ""
    chief_complaint: str = ""
    medical_history: list[str] = field(default_factory=list)
    current_medications: list[str] = field(default_factory=list)
    allergies: list[str] = field(default_factory=list)
    dnr_status: str = ""  # full code, DNR, DNR-CCA, POLST


@dataclass
class PrimaryAssessment:
    """Primary survey / initial assessment."""

    avpu: str = ""  # Alert, Verbal, Pain, Unresponsive
    airway_status: str = ""  # patent, obstructed, managed
    breathing_status: str = ""  # adequate, inadequate, absent
    circulation_status: str = ""  # adequate, inadequate, absent
    pulse_quality: str = ""  # strong, weak, thready, absent
    skin: str = ""  # warm/dry, cool/clammy, diaphoretic, cyanotic
    bleeding: str = ""  # none, controlled, uncontrolled
    gcs_eye: int | None = None
    gcs_verbal: int | None = None
    gcs_motor: int | None = None
    priority: str = ""  # immediate, delayed, minor, expectant


@dataclass
class VitalSet:
    """A single set of vital signs."""

    time: str = ""
    bp_systolic: int | None = None
    bp_diastolic: int | None = None
    heart_rate: int | None = None
    respiratory_rate: int | None = None
    spo2: int | None = None
    temperature: float | None = None
    blood_glucose: int | None = None
    etco2: int | None = None
    pain_scale: int | None = None
    gcs_total: int | None = None


@dataclass
class SecondaryAssessment:
    """Secondary survey and detailed assessment."""

    vitals: list[VitalSet] = field(default_factory=list)
    # Head-to-toe
    head: str = ""
    neck: str = ""
    chest: str = ""
    abdomen: str = ""
    pelvis: str = ""
    extremities: str = ""
    back: str = ""
    neuro: str = ""
    # Cardiac / Stroke
    cardiac_rhythm: str = ""
    twelve_lead: str = ""
    stroke_screen: str = ""
    trauma_score: str = ""


@dataclass
class Intervention:
    """A procedure or intervention performed."""

    time: str = ""
    procedure: str = ""
    details: str = ""
    performed_by: str = ""
    success: bool = True


@dataclass
class MedicationGiven:
    """A medication administered in the field."""

    time: str = ""
    medication: str = ""
    dose: str = ""
    route: str = ""  # PO, IV, IM, IN, IO, SL, nebulized, topical
    response: str = ""


@dataclass
class TransportInfo:
    """Transport and disposition details."""

    destination: str = ""
    destination_type: str = ""  # ER, trauma center, stroke center, burn center
    transport_mode: str = ""  # emergent, non-emergent, no transport
    position: str = ""  # supine, semi-fowler, left lateral, sitting
    condition_change: str = ""  # improved, unchanged, deteriorated
    handoff_to: str = ""


@dataclass
class ValidationFlag:
    """A validation finding from rule or AI checking."""

    severity: str = "warning"  # error, warning, info
    section: str = ""
    field: str = ""
    rule_id: str = ""
    message: str = ""
    auto_fixable: bool = False
    suggested_fix: str = ""


@dataclass
class EMSRunReport:
    """Complete ePCR run report."""

    run_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str = ""
    status: str = "draft"  # draft, in_progress, complete, locked
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    # Sections
    dispatch: DispatchInfo = field(default_factory=DispatchInfo)
    scene: SceneAssessment = field(default_factory=SceneAssessment)
    patient: PatientInfo = field(default_factory=PatientInfo)
    primary_assessment: PrimaryAssessment = field(default_factory=PrimaryAssessment)
    secondary_assessment: SecondaryAssessment = field(default_factory=SecondaryAssessment)
    interventions: list[Intervention] = field(default_factory=list)
    medications: list[MedicationGiven] = field(default_factory=list)
    transport: TransportInfo = field(default_factory=TransportInfo)
    # Completion outputs
    narrative: str = ""
    icd10_codes: list[dict[str, Any]] = field(default_factory=list)
    medical_necessity: str = ""
    # Validation
    validation_flags: list[ValidationFlag] = field(default_factory=list)
    section_completeness: dict[str, float] = field(default_factory=dict)


# EMS report sections and their ePCR phase mapping
EMS_SECTIONS = [
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


def compute_section_completeness(report: EMSRunReport) -> dict[str, float]:
    """Compute completion percentage for each ePCR section."""

    def _ratio(filled: int, total: int) -> float:
        return round(filled / total, 2) if total > 0 else 0.0

    d = report.dispatch
    dispatch_fields = [
        d.call_type,
        d.dispatch_complaint,
        d.priority,
        d.time_dispatched,
        d.time_on_scene,
        d.time_at_patient,
    ]
    dispatch_score = _ratio(sum(1 for f in dispatch_fields if f), len(dispatch_fields))

    s = report.scene
    scene_fields = [
        s.location_type,
        s.scene_safe is not None,
        s.mechanism_of_injury or s.nature_of_illness,
    ]
    scene_score = _ratio(sum(1 for f in scene_fields if f), len(scene_fields))

    p = report.patient
    patient_fields = [p.age, p.sex, p.chief_complaint]
    patient_score = _ratio(sum(1 for f in patient_fields if f), len(patient_fields))

    pa = report.primary_assessment
    primary_fields = [pa.avpu, pa.airway_status, pa.breathing_status, pa.circulation_status]
    primary_score = _ratio(sum(1 for f in primary_fields if f), len(primary_fields))

    vitals_score = 1.0 if report.secondary_assessment.vitals else 0.0

    sa = report.secondary_assessment
    secondary_fields = [
        sa.head or sa.neuro,
        sa.chest,
        sa.cardiac_rhythm or sa.twelve_lead or sa.stroke_screen,
    ]
    secondary_score = _ratio(sum(1 for f in secondary_fields if f), len(secondary_fields))

    interventions_score = 1.0 if report.interventions or report.medications else 0.0

    t = report.transport
    transport_fields = [t.destination, t.transport_mode, t.condition_change]
    transport_score = _ratio(sum(1 for f in transport_fields if f), len(transport_fields))

    return {
        "dispatch": dispatch_score,
        "scene": scene_score,
        "patient_info": patient_score,
        "primary_assessment": primary_score,
        "vitals": vitals_score,
        "secondary_assessment": secondary_score,
        "interventions": interventions_score,
        "transport": transport_score,
    }
