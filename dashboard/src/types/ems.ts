// EMS Run Report types — TypeScript equivalents of ems_models.py

export interface DispatchInfo {
  call_type: string;
  dispatch_complaint: string;
  priority: string;
  unit_number: string;
  crew: string[];
  time_dispatched: string;
  time_enroute: string;
  time_on_scene: string;
  time_at_patient: string;
  time_left_scene: string;
  time_at_destination: string;
  time_in_service: string;
}

export interface SceneAssessment {
  location_type: string;
  address: string;
  scene_safe: boolean | null;
  hazards: string[];
  patient_count: number;
  mci: boolean;
  mechanism_of_injury: string;
  nature_of_illness: string;
}

export interface PatientInfo {
  name: string;
  age: string;
  sex: string;
  weight: string;
  chief_complaint: string;
  medical_history: string[];
  current_medications: string[];
  allergies: string[];
  dnr_status: string;
}

export interface PrimaryAssessment {
  avpu: string;
  airway_status: string;
  breathing_status: string;
  circulation_status: string;
  pulse_quality: string;
  skin: string;
  bleeding: string;
  gcs_eye: number | null;
  gcs_verbal: number | null;
  gcs_motor: number | null;
  priority: string;
}

export interface VitalSet {
  time: string;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  heart_rate: number | null;
  respiratory_rate: number | null;
  spo2: number | null;
  temperature: number | null;
  blood_glucose: number | null;
  etco2: number | null;
  pain_scale: number | null;
  gcs_total: number | null;
}

export interface SecondaryAssessment {
  vitals: VitalSet[];
  head: string;
  neck: string;
  chest: string;
  abdomen: string;
  pelvis: string;
  extremities: string;
  back: string;
  neuro: string;
  cardiac_rhythm: string;
  twelve_lead: string;
  stroke_screen: string;
  trauma_score: string;
}

export interface Intervention {
  time: string;
  procedure: string;
  details: string;
  performed_by: string;
  success: boolean;
}

export interface MedicationGiven {
  time: string;
  medication: string;
  dose: string;
  route: string;
  response: string;
}

export interface TransportInfo {
  destination: string;
  destination_type: string;
  transport_mode: string;
  position: string;
  condition_change: string;
  handoff_to: string;
}

export interface ValidationFlag {
  severity: 'error' | 'warning' | 'info';
  section: string;
  field: string;
  rule_id: string;
  message: string;
  auto_fixable: boolean;
  suggested_fix: string;
}

export interface ICD10Code {
  code: string;
  description: string;
  confidence: number;
  rationale: string;
}

export interface EMSRunReport {
  run_id: string;
  session_id: string;
  status: 'draft' | 'in_progress' | 'complete' | 'locked';
  created_at: string;
  updated_at: string;
  dispatch: DispatchInfo;
  scene: SceneAssessment;
  patient: PatientInfo;
  primary_assessment: PrimaryAssessment;
  secondary_assessment: SecondaryAssessment;
  interventions: Intervention[];
  medications: MedicationGiven[];
  transport: TransportInfo;
  narrative: string;
  icd10_codes: ICD10Code[];
  medical_necessity: string;
  validation_flags: ValidationFlag[];
  section_completeness: Record<string, number>;
}

// Session types for the frontend hook
export interface EMSMessage {
  role: 'assistant' | 'user';
  content: string;
  transcript?: string;
  timestamp?: string;
}

export interface EMSSession {
  id: string;
  sessionId: string;
  runId: string;
  phase: string;
  messages: EMSMessage[];
  extractedData: Record<string, unknown>;
  validationFlags: ValidationFlag[];
  sectionCompleteness: Record<string, number>;
  startedAt: string;
  status: 'active' | 'complete';
}

export interface EMSDictateResponse {
  session_id: string;
  run_id: string;
  question: string;
  phase: string;
  phase_complete: boolean;
  extracted_data: Record<string, unknown>;
  validation_flags: ValidationFlag[];
  section_completeness: Record<string, number>;
  transcript?: string;
}

export interface EMSCompleteResponse {
  session_id: string;
  run_id: string;
  status: string;
  narrative: string;
  icd10_codes: ICD10Code[];
  medical_necessity: string;
  validation_flags: ValidationFlag[];
  section_completeness: Record<string, number>;
}

export interface EMSRunSummary {
  run_id: string;
  session_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  chief_complaint: string;
  section_completeness: Record<string, number>;
}

// Phase configuration
export const EMS_PHASES = [
  'dispatch',
  'scene',
  'patient_info',
  'primary_assessment',
  'vitals',
  'secondary_assessment',
  'interventions',
  'transport',
  'review',
  'complete',
] as const;

export type EMSPhase = typeof EMS_PHASES[number];

export const EMS_PHASE_LABELS: Record<string, string> = {
  dispatch: 'Dispatch',
  scene: 'Scene',
  patient_info: 'Patient',
  primary_assessment: 'Primary',
  vitals: 'Vitals',
  secondary_assessment: 'Secondary',
  interventions: 'Interventions',
  transport: 'Transport',
  review: 'Review',
  complete: 'Complete',
};
