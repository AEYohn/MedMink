const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface EncounterAPI {
  id: string;
  patient_id: string | null;
  encounter_type: string;
  title: string | null;
  original_case_text: string | null;
  current_case_text: string | null;
  analysis_result: Record<string, unknown> | null;
  clinician_overrides: Record<string, unknown> | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface EventAPI {
  id: string;
  encounter_id: string;
  event_type: string;
  sequence_num: number;
  role: string | null;
  message_content: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function fetchEncounters(params?: { patient_id?: string; status?: string }): Promise<EncounterAPI[]> {
  const query = new URLSearchParams();
  if (params?.patient_id) query.set('patient_id', params.patient_id);
  if (params?.status) query.set('status', params.status);
  const res = await fetch(`${API_URL}/api/encounters?${query}`);
  if (!res.ok) throw new Error('Failed to fetch encounters');
  return res.json();
}

export async function fetchEncounter(id: string): Promise<EncounterAPI> {
  const res = await fetch(`${API_URL}/api/encounters/${id}`);
  if (!res.ok) throw new Error('Encounter not found');
  return res.json();
}

export async function apiCreateEncounter(data: {
  patient_id?: string;
  encounter_type?: string;
  title?: string;
  original_case_text?: string;
  current_case_text?: string;
  analysis_result?: Record<string, unknown>;
  clinician_overrides?: Record<string, unknown>;
}): Promise<EncounterAPI> {
  const res = await fetch(`${API_URL}/api/encounters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create encounter');
  return res.json();
}

export async function apiUpdateEncounter(id: string, data: Partial<EncounterAPI>): Promise<EncounterAPI> {
  const res = await fetch(`${API_URL}/api/encounters/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update encounter');
  return res.json();
}

export async function apiDeleteEncounter(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/encounters/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete encounter');
}

export async function fetchEvents(encounterId: string): Promise<EventAPI[]> {
  const res = await fetch(`${API_URL}/api/encounters/${encounterId}/events`);
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
}

export async function apiCreateEvent(encounterId: string, data: {
  event_type: string;
  role?: string;
  message_content?: string;
  metadata?: Record<string, unknown>;
}): Promise<EventAPI> {
  const res = await fetch(`${API_URL}/api/encounters/${encounterId}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create event');
  return res.json();
}
