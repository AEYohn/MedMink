import { getItem, setItem } from './storage';

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: 'male' | 'female' | 'other';
  mrn?: string;
  phone?: string;
  email?: string;
  allergies: string[];
  conditions: string[];
  medications: string[];
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'patients';

export function getPatients(): Patient[] {
  return getItem<Patient[]>(STORAGE_KEY, []);
}

export function getPatient(id: string): Patient | null {
  const patients = getPatients();
  return patients.find(p => p.id === id) ?? null;
}

export function createPatient(data: Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Patient {
  const now = new Date().toISOString();
  const patient: Patient = {
    ...data,
    id: `patient-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  const patients = getPatients();
  patients.unshift(patient);
  setItem(STORAGE_KEY, patients);
  return patient;
}

export function updatePatient(id: string, data: Partial<Omit<Patient, 'id' | 'createdAt'>>): Patient | null {
  const patients = getPatients();
  const index = patients.findIndex(p => p.id === id);
  if (index === -1) return null;

  patients[index] = {
    ...patients[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  setItem(STORAGE_KEY, patients);
  return patients[index];
}

export function deletePatient(id: string): boolean {
  const patients = getPatients();
  const filtered = patients.filter(p => p.id !== id);
  if (filtered.length === patients.length) return false;
  setItem(STORAGE_KEY, filtered);
  return true;
}

export function searchPatients(query: string): Patient[] {
  const patients = getPatients();
  if (!query.trim()) return patients;
  const q = query.toLowerCase();
  return patients.filter(p =>
    p.firstName.toLowerCase().includes(q) ||
    p.lastName.toLowerCase().includes(q) ||
    p.mrn?.toLowerCase().includes(q) ||
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
  );
}

export function getPatientDisplayName(patient: Patient): string {
  return `${patient.firstName} ${patient.lastName}`;
}

export function getPatientAge(patient: Patient): number {
  const dob = new Date(patient.dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}
