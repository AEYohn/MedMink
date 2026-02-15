import { getApiUrl } from './api-url';

const API_URL = getApiUrl() || '';

export interface GraphStats {
  papers: number;
  claims: number;
  methods: number;
  techniques: number;
  trends: number;
  predictions: number;
  contradictions: number;
}

export interface Technique {
  id: string;
  name: string;
  technique_type: string;
  description: string;
  formula: string | null;
  pseudocode: string | null;
  implementation_notes: string | null;
  is_novel: boolean;
  improves_upon: string | null;
  paper_count: number;
}

export interface Paper {
  id: string;
  arxiv_id: string;
  title: string;
  abstract: string;
  authors: string[];
  categories: string[];
  published_date: string | null;
  analyzed: boolean;
}

export interface Claim {
  id: string;
  paper_id: string;
  statement: string;
  category: string;
  status: string;
  confidence: number;
}

export interface Trend {
  id: string;
  name: string;
  description: string;
  direction: string;
  velocity: number;
  confidence: number;
}

export interface Contradiction {
  claim1: Claim;
  claim2: Claim;
  strength: number;
  explanation: string;
}

export interface Prediction {
  id: string;
  statement: string;
  category: string;
  confidence: number;
  timeframe: string;
  outcome: string;
  due_date: string | null;
}

export interface PredictionAccuracy {
  total: number;
  correct: number;
  incorrect: number;
  partial: number;
  accuracy: number;
  brier_score: number;
  avg_confidence: number;
}

export interface TaskStats {
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
}

export interface ThoughtSignature {
  id: string;
  agent_name: string;
  task_id: string | null;
  context_summary: string;
  decision_made: string;
  confidence: number;
  created_at: string | null;
}

// Project Analysis types
export interface Project {
  id: string;
  name: string;
  url: string;
  source: string;
  description: string;
  status: string;
  created_at: string | null;
}

export interface Problem {
  id: string;
  statement: string;
  category: string;
  details: string;
  priority: number;
}

export interface Approach {
  id: string;
  name: string;
  description: string;
  priority: number;
  confidence: number;
  reasoning: string | null;
  challenges: string[];
  mitigations: string[];
}

export interface ProjectPaper {
  id: string;
  title: string;
  abstract: string;
  arxiv_id: string;
  relevance: number;
  explanation: string | null;
}

export interface ProjectSynthesis {
  recommended_approach: string | null;
  approach_count: number;
  paper_count: number;
  key_techniques: string[];
}

export interface ProjectDetail {
  project: Project;
  problems: Problem[];
  approaches: Approach[];
  papers: ProjectPaper[];
  synthesis: ProjectSynthesis | null;
}

export interface ProjectGraphNode {
  id: string;
  type: string;
  label: string;
  data: Record<string, any>;
}

export interface ProjectGraphEdge {
  source: string;
  target: string;
  type: string;
  relevance?: number;
}

export interface ProjectGraph {
  nodes: ProjectGraphNode[];
  edges: ProjectGraphEdge[];
}

export interface ProjectTaskResponse {
  id: string;
  type: string;
  status: string;
  project_id: string;
}

export interface SystemStatus {
  status: string;
  timestamp: string;
  knowledge_graph: GraphStats;
  gemini: {
    model: string;
    rate_limiter: {
      requests_used: number;
      requests_limit: number;
      tokens_used: number;
      tokens_limit: number;
    };
    cost_tracker: {
      daily_cost: number;
      daily_budget: number;
      monthly_cost: number;
      monthly_budget: number;
    };
  };
}

// Chat types
export interface ChatSource {
  id: string;
  content_type: string;
  title: string;
  relevance: number;
  snippet: string | null;
  paper_id: string | null;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  follow_up_questions: string[];
  confidence: number;
  conversation_id: string;
  message_id: string;
}

// Search types
export interface SearchResultItem {
  id: string;
  content_type: string;
  semantic_score: number;
  keyword_score: number;
  combined_score: number;
  title: string | null;
  snippet: string | null;
  metadata: Record<string, any>;
}

export interface SearchResponse {
  results: SearchResultItem[];
  total_found: number;
  query: string;
}

export interface SimilarPaper {
  paper_id: string;
  title: string;
  abstract_preview: string | null;
  similarity: number;
}

export interface EmbeddingStats {
  papers: number;
  claims: number;
  techniques: number;
  total: number;
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export const api = {
  // System
  getStatus: () => fetchApi<SystemStatus>('/api/status'),
  getCost: () => fetchApi<any>('/api/cost'),

  // Graph
  getGraphStats: () => fetchApi<GraphStats>('/api/graph/stats'),
  getPapers: (limit = 50) => fetchApi<Paper[]>(`/api/graph/papers?limit=${limit}`),
  getPaper: (id: string) => fetchApi<{ paper: Paper; claims: Claim[] }>(`/api/graph/papers/${id}`),
  getClaims: (limit = 100) => fetchApi<Claim[]>(`/api/graph/claims?limit=${limit}`),
  getTrends: (limit = 20) => fetchApi<Trend[]>(`/api/graph/trends?limit=${limit}`),
  getContradictions: (limit = 20) => fetchApi<Contradiction[]>(`/api/graph/contradictions?limit=${limit}`),
  getPredictions: () => fetchApi<Prediction[]>('/api/graph/predictions'),
  getPredictionAccuracy: () => fetchApi<PredictionAccuracy>('/api/graph/predictions/accuracy'),
  getMethods: (limit = 20) => fetchApi<any[]>(`/api/graph/methods?limit=${limit}`),
  getTechniques: (limit = 100) => fetchApi<Technique[]>(`/api/graph/techniques?limit=${limit}`),

  // Tasks
  getTaskStats: () => fetchApi<TaskStats>('/api/tasks/stats'),
  triggerIngest: (topic = 'machine learning', maxResults = 50) =>
    fetchApi('/api/tasks/ingest', {
      method: 'POST',
      body: JSON.stringify({ topic, max_results: maxResults }),
    }),
  triggerAnalyze: (batchSize = 10) =>
    fetchApi('/api/tasks/analyze', {
      method: 'POST',
      body: JSON.stringify({ batch_size: batchSize }),
    }),
  triggerSynthesize: () =>
    fetchApi('/api/tasks/synthesize', { method: 'POST' }),
  getThoughts: (limit = 50) => fetchApi<ThoughtSignature[]>(`/api/tasks/thoughts?limit=${limit}`),

  // Review
  getReviewItems: (status = 'pending') =>
    fetchApi<any[]>(`/api/review/items?status=${status}`),
  submitReviewDecision: (itemId: string, status: string, notes?: string) =>
    fetchApi(`/api/review/items/${itemId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ status, notes }),
    }),

  // Projects
  submitProject: (url: string, name?: string) =>
    fetchApi<ProjectTaskResponse>('/api/projects/analyze', {
      method: 'POST',
      body: JSON.stringify({ url, name }),
    }),
  getProjects: (limit = 50, status?: string) =>
    fetchApi<Project[]>(
      `/api/projects?limit=${limit}${status ? `&status=${status}` : ''}`
    ),
  getProject: (id: string) => fetchApi<ProjectDetail>(`/api/projects/${id}`),
  getProjectGraph: (id: string) =>
    fetchApi<ProjectGraph>(`/api/projects/${id}/graph`),
  deleteProject: (id: string) =>
    fetchApi(`/api/projects/${id}`, { method: 'DELETE' }),
  reanalyzeProject: (id: string) =>
    fetchApi<ProjectTaskResponse>(`/api/projects/${id}/reanalyze`, {
      method: 'POST',
    }),

  // Chat
  chat: (message: string, conversationId?: string, contentTypes?: string[]) =>
    fetchApi<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
        content_types: contentTypes,
      }),
    }),

  // Semantic Search
  semanticSearch: (query: string, type = 'all', limit = 20, threshold = 0.4) =>
    fetchApi<SearchResponse>(
      `/api/search/semantic?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}&threshold=${threshold}`
    ),
  findSimilarPapers: (paperId: string, limit = 10) =>
    fetchApi<{ source_paper_id: string; similar_papers: SimilarPaper[] }>(
      `/api/search/similar/${paperId}?limit=${limit}`
    ),
  getEmbeddingStats: () => fetchApi<EmbeddingStats>('/api/search/stats'),
  createSearchIndexes: () =>
    fetchApi('/api/search/index/create', { method: 'POST' }),

  // Database Management
  clearDatabase: (confirm = true) =>
    fetchApi<{ message: string; deleted_counts: Record<string, number> }>(
      `/api/graph/clear?confirm=${confirm}`,
      { method: 'DELETE' }
    ),

  // Cache Management
  getCacheStats: () =>
    fetchApi<{
      enabled: boolean;
      total_entries: number;
      valid_entries: number;
      similarity_threshold: number;
      ttl_hours: number;
    }>('/api/cache/stats'),
  clearCache: () =>
    fetchApi<{ cleared: number; message: string }>('/api/cache/clear', {
      method: 'DELETE',
    }),

  // Analysis Settings
  getAnalysisSettings: () =>
    fetchApi<{
      analysis_mode: string;
      token_budgets: { quick: number; standard: number; deep: number };
      caching: { enabled: boolean; similarity_threshold: number; ttl_hours: number };
      batch_analysis: { enabled: boolean; batch_size: number; max_batch_tokens: number };
    }>('/api/settings/analysis'),
};

// WebSocket connection
export function createWebSocket(onMessage: (data: any) => void): WebSocket | null {
  if (typeof window === 'undefined') return null;
  if (!API_URL) return null;

  try {
    const wsUrl = API_URL.replace('http', 'ws') + '/ws';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return ws;
  } catch {
    return null;
  }
}

// Extended API types for claim detail
export interface ClaimDetail {
  claim: Claim;
  paper: Paper | null;
  contradictions: Contradiction[];
}

// Extended API types for technique detail
export interface TechniqueDetail {
  technique: Technique;
  papers: Paper[];
}

// Helper to get claim by ID (fetches all and filters)
export async function getClaimById(id: string): Promise<Claim | null> {
  const claims = await api.getClaims(500);
  return claims.find(c => c.id === id) || null;
}

// Helper to get technique by ID (fetches all and filters)
export async function getTechniqueById(id: string): Promise<Technique | null> {
  const techniques = await api.getTechniques(500);
  return techniques.find(t => t.id === id) || null;
}

// ── Patient API ──────────────────────────────────────────────────────

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
  return fetchApi<PatientAPI[]>(`/api/patients?${query}`);
}

export async function fetchPatient(id: string): Promise<PatientAPI> {
  return fetchApi<PatientAPI>(`/api/patients/${id}`);
}

export async function apiCreatePatient(data: Omit<PatientAPI, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<PatientAPI> {
  return fetchApi<PatientAPI>('/api/patients', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiUpdatePatient(id: string, data: Partial<PatientAPI>): Promise<PatientAPI> {
  return fetchApi<PatientAPI>(`/api/patients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function apiDeletePatient(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/patients/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete patient');
}

// ── Encounter API ────────────────────────────────────────────────────

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
  return fetchApi<EncounterAPI[]>(`/api/encounters?${query}`);
}

export async function fetchEncounter(id: string): Promise<EncounterAPI> {
  return fetchApi<EncounterAPI>(`/api/encounters/${id}`);
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
  return fetchApi<EncounterAPI>('/api/encounters', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiUpdateEncounter(id: string, data: Partial<EncounterAPI>): Promise<EncounterAPI> {
  return fetchApi<EncounterAPI>(`/api/encounters/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function apiDeleteEncounter(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/encounters/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete encounter');
}

export async function fetchEvents(encounterId: string): Promise<EventAPI[]> {
  return fetchApi<EventAPI[]>(`/api/encounters/${encounterId}/events`);
}

export async function apiCreateEvent(encounterId: string, data: {
  event_type: string;
  role?: string;
  message_content?: string;
  metadata?: Record<string, unknown>;
}): Promise<EventAPI> {
  return fetchApi<EventAPI>(`/api/encounters/${encounterId}/events`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Document API ─────────────────────────────────────────────────────

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
  return fetchApi<DocumentAPI[]>(`/api/documents?${query}`);
}

export async function fetchDocument(id: string): Promise<DocumentAPI> {
  return fetchApi<DocumentAPI>(`/api/documents/${id}`);
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
  return fetchApi<DocumentAPI>('/api/documents', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiUpdateDocument(id: string, data: Partial<DocumentAPI>): Promise<DocumentAPI> {
  return fetchApi<DocumentAPI>(`/api/documents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
