const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface DocumentAPI {
  id: string;
  doc_type: string;
  title: string;
  content: Record<string, unknown> | string | null;
  raw_text: string | null;
  encounter_id: string | null;
  patient_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export async function fetchDocuments(params?: { doc_type?: string; encounter_id?: string; patient_id?: string }): Promise<DocumentAPI[]> {
  const query = new URLSearchParams();
  if (params?.doc_type) query.set('doc_type', params.doc_type);
  if (params?.encounter_id) query.set('encounter_id', params.encounter_id);
  if (params?.patient_id) query.set('patient_id', params.patient_id);
  const res = await fetch(`${API_URL}/api/documents?${query}`);
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

export async function fetchDocument(id: string): Promise<DocumentAPI> {
  const res = await fetch(`${API_URL}/api/documents/${id}`);
  if (!res.ok) throw new Error('Document not found');
  return res.json();
}

export async function apiCreateDocument(data: {
  doc_type: string;
  title: string;
  content?: Record<string, unknown> | string;
  raw_text?: string;
  encounter_id?: string;
  patient_id?: string;
  status?: string;
}): Promise<DocumentAPI> {
  const res = await fetch(`${API_URL}/api/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create document');
  return res.json();
}

export async function apiUpdateDocument(id: string, data: Partial<DocumentAPI>): Promise<DocumentAPI> {
  const res = await fetch(`${API_URL}/api/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update document');
  return res.json();
}
