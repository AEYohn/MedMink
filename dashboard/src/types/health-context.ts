export interface VitalReading {
  date: string; // ISO date
  systolic?: number;
  diastolic?: number;
  heartRate?: number;
  temperature?: number; // Fahrenheit
  weight?: number; // lbs
  spO2?: number; // percentage
  glucose?: number; // mg/dL
}

export interface LabResult {
  id: string;
  testName: string;
  value: number;
  unit: string;
  referenceRange: { low: number; high: number };
  status: 'normal' | 'high' | 'low' | 'critical';
  date: string; // ISO date
  category: 'metabolic' | 'cbc' | 'lipid' | 'thyroid' | 'cardiac' | 'other';
}

export interface ConditionEntry {
  name: string;
  icdCode?: string;
  diagnosedDate: string;
  status: 'active' | 'resolved' | 'managed';
  description: string;
}

export interface MedicationEntry {
  name: string;
  dose: string;
  frequency: string;
  prescribedDate: string;
  indication: string;
  action: 'continue' | 'new' | 'discontinue';
}

export interface GuidelineRef {
  id: string;
  title: string;
  source: string; // e.g. "AHA", "ADA", "USPSTF"
  condition: string;
  summary: string;
  recommendations: string[];
  evidenceLevel: 'strong' | 'moderate' | 'expert-opinion';
  lastUpdated: string;
  whatItMeansForYou: string;
}

export interface TranscriptEntry {
  timestamp: string;
  speaker: 'patient' | 'clinician';
  text: string;
}

export interface FullHealthContext {
  patientName: string;
  age: number;
  sex: string;
  conditions: ConditionEntry[];
  medications: MedicationEntry[];
  vitals: VitalReading[];
  labs: LabResult[];
  guidelines: GuidelineRef[];
  recentVisitDiagnosis?: string;
  recentVisitDate?: string;
}
