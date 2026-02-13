// Persistence utilities for localStorage with type safety

const STORAGE_PREFIX = 'research-synthesizer:';

export interface StorageOptions {
  prefix?: string;
  serialize?: (value: unknown) => string;
  deserialize?: <T>(value: string) => T;
}

const defaultOptions: StorageOptions = {
  prefix: STORAGE_PREFIX,
  serialize: JSON.stringify,
  deserialize: JSON.parse,
};

export function getStorageKey(key: string, prefix = STORAGE_PREFIX): string {
  return `${prefix}${key}`;
}

export function getItem<T>(key: string, defaultValue: T, options = defaultOptions): T {
  if (typeof window === 'undefined') return defaultValue;

  try {
    const fullKey = getStorageKey(key, options.prefix);
    const item = localStorage.getItem(fullKey);
    if (item === null) return defaultValue;
    return options.deserialize ? options.deserialize<T>(item) : (item as unknown as T);
  } catch (error) {
    console.error(`Error reading from localStorage key "${key}":`, error);
    return defaultValue;
  }
}

export function setItem<T>(key: string, value: T, options = defaultOptions): void {
  if (typeof window === 'undefined') return;

  try {
    const fullKey = getStorageKey(key, options.prefix);
    const serialized = options.serialize ? options.serialize(value) : String(value);
    localStorage.setItem(fullKey, serialized);
  } catch (error) {
    console.error(`Error writing to localStorage key "${key}":`, error);
  }
}

export function removeItem(key: string, prefix = STORAGE_PREFIX): void {
  if (typeof window === 'undefined') return;

  try {
    const fullKey = getStorageKey(key, prefix);
    localStorage.removeItem(fullKey);
  } catch (error) {
    console.error(`Error removing localStorage key "${key}":`, error);
  }
}

export function clearAll(prefix = STORAGE_PREFIX): void {
  if (typeof window === 'undefined') return;

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
}

// Conversation types
export interface SavedConversation {
  id: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  followUpQuestions?: string[];
  confidence?: number;
  timestamp: string;
}

export interface ChatSource {
  id: string;
  content_type: string;
  title: string;
  relevance: number;
  snippet: string | null;
  paper_id: string | null;
}

// Search history types
export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: string;
  resultCount: number;
  filters?: SearchFilters;
}

export interface SearchFilters {
  types: string[];
  minConfidence: number;
  dateRange?: { start: string; end: string };
}

// Bookmark types
export interface Bookmark {
  id: string;
  entityId: string;
  entityType: 'paper' | 'claim' | 'technique';
  title: string;
  createdAt: string;
}

// Clinician overrides — separate layer on top of AI-generated data
export interface TreatmentOverride {
  verdict?: 'accepted' | 'rejected' | 'modified';
  notes?: string;
  status?: 'pending' | 'ordered' | 'administered' | 'held';
  modifiedDose?: string;
}

export interface AcuteActionOverride {
  checked: boolean;
  editedText?: string;
  addedAt?: string;
}

export interface DischargeMedOverride {
  name: string;
  dose: string;
  frequency: string;
  source: 'ai' | 'clinician';
  action: 'continue' | 'new' | 'discontinue';
}

export interface SafetyAcknowledgment {
  acknowledged: boolean;
  by?: string;
  note?: string;
}

export interface CustomTreatment {
  id: string;
  name: string;
  dose: string;
  rationale: string;
  status: 'pending' | 'ordered' | 'administered' | 'held';
  addedAt: string;
}

export interface SectionCustomAction {
  id: string;
  text: string;
  checked: boolean;
  addedAt: string;
}

export interface ClinicianOverrides {
  treatments: Record<string, TreatmentOverride>;
  acuteActions: Record<string, AcuteActionOverride>;
  customActions: Array<{ text: string; checked: boolean; addedAt: string }>;
  sectionCustomActions: Record<string, SectionCustomAction[]>;
  customTreatments: CustomTreatment[];
  dischargeMeds: DischargeMedOverride[];
  dischargeInstructions: string;
  safetyAcknowledgments: Record<string, SafetyAcknowledgment>;
  riskScoreInputs: Record<string, Record<string, number | boolean>>;
  lastModified: string;
}

export function createEmptyOverrides(): ClinicianOverrides {
  return {
    treatments: {},
    acuteActions: {},
    customActions: [],
    sectionCustomActions: {},
    customTreatments: [],
    dischargeMeds: [],
    dischargeInstructions: '',
    safetyAcknowledgments: {},
    riskScoreInputs: {},
    lastModified: new Date().toISOString(),
  };
}

// Case session types
export interface CaseSession {
  id: string;
  title: string;
  patientId?: string;
  createdAt: string;
  updatedAt: string;
  originalCaseText: string;
  currentCaseText: string;
  currentResult: Record<string, unknown> | null;
  events: CaseEvent[];
  followUpMessages: CaseFollowUpMessage[];
  overrides?: ClinicianOverrides;
}

export interface CaseEvent {
  id: string;
  timestamp: string;
  type: 'initial_analysis' | 'new_findings' | 'reassessment_complete' | 'note';
  findings?: NewFindings;
  changeSummary?: string;
}

export interface NewFindings {
  category: 'labs' | 'imaging' | 'vitals' | 'physical_exam' | 'medications' | 'clinical_change';
  text: string;
  clinicalTime?: string;
}

export interface CaseFollowUpMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// Storage keys
export const STORAGE_KEYS = {
  CONVERSATIONS: 'conversations',
  CURRENT_CONVERSATION: 'current-conversation',
  SEARCH_HISTORY: 'search-history',
  BOOKMARKS: 'bookmarks',
  SIDEBAR_COLLAPSED: 'sidebar-collapsed',
  FILTERS: 'filters',
  THEME: 'theme',
  CASE_SESSIONS: 'case-sessions',
  CURRENT_CASE_SESSION: 'current-case-session',
} as const;

// Conversation helpers
export function getConversations(): SavedConversation[] {
  return getItem<SavedConversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
}

export function saveConversation(conversation: SavedConversation): void {
  const conversations = getConversations();
  const index = conversations.findIndex(c => c.id === conversation.id);
  if (index >= 0) {
    conversations[index] = { ...conversation, updatedAt: new Date().toISOString() };
  } else {
    conversations.unshift(conversation);
  }
  // Keep only last 50 conversations
  setItem(STORAGE_KEYS.CONVERSATIONS, conversations.slice(0, 50));
}

export function deleteConversation(id: string): void {
  const conversations = getConversations();
  setItem(STORAGE_KEYS.CONVERSATIONS, conversations.filter(c => c.id !== id));
}

// Search history helpers
export function getSearchHistory(): SearchHistoryItem[] {
  return getItem<SearchHistoryItem[]>(STORAGE_KEYS.SEARCH_HISTORY, []);
}

export function addSearchToHistory(item: Omit<SearchHistoryItem, 'id' | 'timestamp'>): void {
  const history = getSearchHistory();
  const newItem: SearchHistoryItem = {
    ...item,
    id: `search-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
  // Avoid duplicates of same query
  const filtered = history.filter(h => h.query !== item.query);
  filtered.unshift(newItem);
  // Keep only last 20 searches
  setItem(STORAGE_KEYS.SEARCH_HISTORY, filtered.slice(0, 20));
}

export function clearSearchHistory(): void {
  setItem(STORAGE_KEYS.SEARCH_HISTORY, []);
}

// Bookmark helpers
export function getBookmarks(): Bookmark[] {
  return getItem<Bookmark[]>(STORAGE_KEYS.BOOKMARKS, []);
}

export function addBookmark(bookmark: Omit<Bookmark, 'id' | 'createdAt'>): void {
  const bookmarks = getBookmarks();
  // Check if already bookmarked
  if (bookmarks.some(b => b.entityId === bookmark.entityId)) return;

  const newBookmark: Bookmark = {
    ...bookmark,
    id: `bookmark-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  bookmarks.unshift(newBookmark);
  setItem(STORAGE_KEYS.BOOKMARKS, bookmarks);
}

export function removeBookmark(entityId: string): void {
  const bookmarks = getBookmarks();
  setItem(STORAGE_KEYS.BOOKMARKS, bookmarks.filter(b => b.entityId !== entityId));
}

export function isBookmarked(entityId: string): boolean {
  return getBookmarks().some(b => b.entityId === entityId);
}

// Case session helpers
export function getCaseSessions(): CaseSession[] {
  return getItem<CaseSession[]>(STORAGE_KEYS.CASE_SESSIONS, []);
}

export function saveCaseSession(session: CaseSession): void {
  const sessions = getCaseSessions();
  const index = sessions.findIndex(s => s.id === session.id);
  if (index >= 0) {
    sessions[index] = { ...session, updatedAt: new Date().toISOString() };
  } else {
    sessions.unshift(session);
  }
  // Keep max 20 sessions
  setItem(STORAGE_KEYS.CASE_SESSIONS, sessions.slice(0, 20));
}

export function deleteCaseSession(id: string): void {
  const sessions = getCaseSessions();
  setItem(STORAGE_KEYS.CASE_SESSIONS, sessions.filter(s => s.id !== id));
}

export function getCurrentCaseSessionId(): string | null {
  return getItem<string | null>(STORAGE_KEYS.CURRENT_CASE_SESSION, null);
}

export function setCurrentCaseSessionId(id: string | null): void {
  if (id === null) {
    removeItem(STORAGE_KEYS.CURRENT_CASE_SESSION);
  } else {
    setItem(STORAGE_KEYS.CURRENT_CASE_SESSION, id);
  }
}
