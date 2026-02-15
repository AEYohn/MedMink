const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface PatientAPI {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: string;
  mrn: string | null;
  phone: string | null;
  email: string | null;
  allergies: string[];
  conditions: string[];
  medications: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

export async function fetchPatients(params?: { status?: string; search?: string }): Promise<PatientAPI[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  const res = await fetch(`${API_URL}/api/patients?${query}`);
  if (!res.ok) throw new Error('Failed to fetch patients');
  return res.json();
}

export async function fetchPatient(id: string): Promise<PatientAPI> {
  const res = await fetch(`${API_URL}/api/patients/${id}`);
  if (!res.ok) throw new Error('Patient not found');
  return res.json();
}

export async function apiCreatePatient(data: Omit<PatientAPI, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<PatientAPI> {
  const res = await fetch(`${API_URL}/api/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create patient');
  return res.json();
}

export async function apiUpdatePatient(id: string, data: Partial<PatientAPI>): Promise<PatientAPI> {
  const res = await fetch(`${API_URL}/api/patients/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update patient');
  return res.json();
}

export async function apiDeletePatient(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/patients/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete patient');
}
