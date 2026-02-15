export type DocumentType = 'discharge_summary' | 'soap_note' | 'referral' | 'imaging_report' | 'lab_report';
export type DocumentStatus = 'draft' | 'final' | 'amended';

export interface ClinicalDocument {
  id: string;
  type: DocumentType;
  title: string;
  patientId?: string;
  encounterId?: string;
  content: string;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  discharge_summary: 'Discharge Summary',
  soap_note: 'SOAP Note',
  referral: 'Referral',
  imaging_report: 'Imaging Report',
  lab_report: 'Lab Report',
};
