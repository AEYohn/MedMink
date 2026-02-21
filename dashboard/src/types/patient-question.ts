export interface PatientQuestion {
  id: string;
  summaryId: string;
  patientId: string;
  question: string;
  aiResponse: string;
  status: 'pending' | 'reviewed' | 'replied';
  clinicianReply?: string;
  createdAt: string;
  reviewedAt?: string;
}
