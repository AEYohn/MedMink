import { getItem, setItem } from './storage';
import { ClinicalDocument, DocumentType, DocumentStatus } from '@/types/document';

const STORAGE_KEY = 'documents';

export function getDocuments(): ClinicalDocument[] {
  return getItem<ClinicalDocument[]>(STORAGE_KEY, []);
}

export function getDocument(id: string): ClinicalDocument | null {
  return getDocuments().find(d => d.id === id) ?? null;
}

export function createDocument(data: {
  type: DocumentType;
  title: string;
  content: string;
  patientId?: string;
  encounterId?: string;
  status?: DocumentStatus;
}): ClinicalDocument {
  const now = new Date().toISOString();
  const doc: ClinicalDocument = {
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: data.type,
    title: data.title,
    content: data.content,
    patientId: data.patientId,
    encounterId: data.encounterId,
    status: data.status || 'draft',
    createdAt: now,
    updatedAt: now,
  };
  const docs = getDocuments();
  docs.unshift(doc);
  setItem(STORAGE_KEY, docs);
  return doc;
}

export function updateDocument(id: string, data: Partial<Omit<ClinicalDocument, 'id' | 'createdAt'>>): ClinicalDocument | null {
  const docs = getDocuments();
  const index = docs.findIndex(d => d.id === id);
  if (index === -1) return null;
  docs[index] = {
    ...docs[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  setItem(STORAGE_KEY, docs);
  return docs[index];
}

export function deleteDocument(id: string): boolean {
  const docs = getDocuments();
  const filtered = docs.filter(d => d.id !== id);
  if (filtered.length === docs.length) return false;
  setItem(STORAGE_KEY, filtered);
  return true;
}

export function getDocumentsByEncounter(encounterId: string): ClinicalDocument[] {
  return getDocuments().filter(d => d.encounterId === encounterId);
}

export function getDocumentsByPatient(patientId: string): ClinicalDocument[] {
  return getDocuments().filter(d => d.patientId === patientId);
}
