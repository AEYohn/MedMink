// Types for the specialist referral system

export type ReferralStatus = 'draft' | 'sent' | 'viewed' | 'responded' | 'completed';
export type ReferralUrgency = 'emergent' | 'urgent' | 'routine';

export interface Referral {
  referral_id: string;
  token: string;
  case_session_id: string;
  patient_id: string;

  // Referral note
  specialty: string;
  urgency: ReferralUrgency;
  clinical_question: string;
  relevant_history: string;
  pertinent_findings: string[];
  current_management: string;
  specific_asks: string[];
  reason_for_urgency: string;

  // Case snapshot
  parsed_case: Record<string, unknown>;
  treatment_options: Array<Record<string, unknown>>;
  acute_management: Record<string, unknown>;
  clinical_pearls: string[];
  differential_diagnosis: Record<string, unknown> | null;
  risk_scores: Record<string, unknown> | null;

  // Status lifecycle
  status: ReferralStatus;
  created_at: string;
  sent_at: string;
  viewed_at: string;
  responded_at: string;
  completed_at: string;

  // Specialist response
  specialist_name: string;
  specialist_response: string;
  recommendations: string[];
  follow_up_needed: boolean;

  // Access
  link_expires_at: string;
  view_count: number;
}

export interface ReferralSummary {
  referral_id: string;
  token: string;
  case_session_id: string;
  patient_id: string;
  specialty: string;
  urgency: ReferralUrgency;
  clinical_question: string;
  status: ReferralStatus;
  created_at: string;
}

export interface ReferralNotification {
  id: string;
  referral_id: string;
  type: 'viewed' | 'response_received';
  message: string;
  read: boolean;
  created_at: string;
}
