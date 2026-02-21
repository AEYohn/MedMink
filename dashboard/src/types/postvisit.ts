// Types for PostVisit AI — Patient Companion Integration

export type VitalType =
  | 'heart_rate'
  | 'blood_pressure_systolic'
  | 'blood_pressure_diastolic'
  | 'weight'
  | 'temperature'
  | 'spo2'
  | 'blood_glucose'
  | 'custom';

export type VitalSource = 'manual' | 'csv_import' | 'apple_health' | 'google_fit';

export interface VitalReading {
  id: string;
  patientId: string;
  vitalType: VitalType;
  value: number;
  unit: string;
  recordedAt: string;
  source: VitalSource;
  notes?: string;
}

export interface VitalTrend {
  vitalType: string;
  readings: VitalReading[];
  stats: {
    min: number;
    max: number;
    mean: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  referenceRange?: { low: number; high: number };
}

export interface VitalAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  vitalType: string;
  message: string;
  triggerValue: number;
  recommendation: string;
  createdAt: string;
  sentToDoctor: boolean;
}

export interface VitalAnalysis {
  alerts: VitalAlert[];
  summary: string;
  trends: Record<string, string>;
}

export interface EvidenceCitation {
  type: 'pubmed' | 'guideline' | 'clinician_approved';
  title: string;
  url?: string;
  snippet: string;
}

export interface PostVisitMessage {
  id: string;
  summaryId: string;
  sender: 'patient' | 'clinician' | 'system';
  content: string;
  aiDraft?: string;
  status: 'sent' | 'read' | 'replied';
  evidenceRefs?: EvidenceCitation[];
  createdAt: string;
  readAt?: string;
  repliedAt?: string;
}

export interface CompanionConfig {
  allowedTopics?: string[];
  blockedTopics?: string[];
  clinicianNotesToAi?: string;
  evidenceSearchEnabled: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: EvidenceCitation[];
  timestamp: string;
}

export interface PostVisitSummary {
  id: string;
  diagnosis: string;
  diagnosisExplanation: string;
  medications: Array<{
    name: string;
    dose: string;
    frequency: string;
    action: string;
    plainLanguageInstructions: string;
  }>;
  dischargeInstructions: string;
  followUps: Array<{
    timeframe: string;
    provider: string;
    reason: string;
  }>;
  redFlags: string[];
  restrictions: string[];
  visitDate: string;
  releasedBy: string;
  companionConfig?: CompanionConfig;
}

// Reference ranges for vitals display
export const VITAL_REFERENCE_RANGES: Record<string, { low: number; high: number; unit: string; label: string }> = {
  heart_rate: { low: 60, high: 100, unit: 'bpm', label: 'Heart Rate' },
  blood_pressure_systolic: { low: 90, high: 140, unit: 'mmHg', label: 'Systolic BP' },
  blood_pressure_diastolic: { low: 60, high: 90, unit: 'mmHg', label: 'Diastolic BP' },
  weight: { low: 0, high: 999, unit: 'kg', label: 'Weight' },
  temperature: { low: 36.1, high: 37.2, unit: '°C', label: 'Temperature' },
  spo2: { low: 95, high: 100, unit: '%', label: 'SpO2' },
  blood_glucose: { low: 70, high: 140, unit: 'mg/dL', label: 'Blood Glucose' },
};

export type PostVisitTab = 'overview' | 'companion' | 'tracker' | 'messages';
