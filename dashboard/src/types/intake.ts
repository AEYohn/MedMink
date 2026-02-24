export interface IntakeTriageResult {
  id: string;
  patientId: string | null;
  sessionId: string;
  completedAt: string; // ISO-8601
  triageData: TriageData;
  conversationSummary: string; // chief complaint + key findings prose
  conversationHistory?: Array<{ role: 'assistant' | 'user'; content: string; transcript?: string }>;
  source: 'patient-intake' | 'clinician-interview';
}

export interface TriageData {
  chief_complaint: string;
  hpi: Record<string, string>;
  review_of_systems: { positive?: string[]; negative?: string[] };
  past_medical_history: string[];
  medications: string[];
  allergies: string[];
  esi_level: number;
  esi_reasoning: string;
  recommended_setting: string;
  setting_reasoning: string;
  red_flags: string[];
}
