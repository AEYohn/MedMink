export interface CompanionSource {
  type: 'visit-summary' | 'lab' | 'medication' | 'guideline' | 'vital';
  label: string;
  detail?: string;
}

export interface CompanionMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: CompanionSource[];
}

export interface CompanionSession {
  id: string;
  messages: Array<Omit<CompanionMessage, 'timestamp'> & { timestamp: string }>;
  createdAt: string;
  lastActiveAt: string;
}
