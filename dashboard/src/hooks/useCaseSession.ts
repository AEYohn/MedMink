'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CaseSession,
  CaseEvent,
  CaseFollowUpMessage,
  NewFindings,
  ClinicianOverrides,
  createEmptyOverrides,
  getCaseSessions,
  saveCaseSession,
  deleteCaseSession as deleteSessionFromStorage,
  getCurrentCaseSessionId,
  setCurrentCaseSessionId,
} from '@/lib/storage';
import { apiCreateEncounter, apiUpdateEncounter } from '@/lib/api';

type SyncStatus = 'idle' | 'saving' | 'synced' | 'error';

export function useCaseSession() {
  const [allSessions, setAllSessions] = useState<CaseSession[]>([]);
  const [currentSession, setCurrentSession] = useState<CaseSession | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  // Ref to avoid stale closure issues in async callbacks (e.g. SSE stream handlers).
  const sessionRef = useRef<CaseSession | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper: update both React state and ref synchronously
  const setSession = useCallback((s: CaseSession | null) => {
    sessionRef.current = s;
    setCurrentSession(s);
  }, []);

  // Debounced API sync — fire-and-forget, doesn't block UI
  const syncToAPI = useCallback((session: CaseSession) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setSyncStatus('saving');
        // If the session has a server ID (UUID format), update; otherwise create
        const isServerSession = session.id.includes('-') && session.id.length > 20 && !session.id.startsWith('case-');
        if (isServerSession) {
          await apiUpdateEncounter(session.id, {
            title: session.title,
            current_case_text: session.currentCaseText,
            analysis_result: session.currentResult as Record<string, unknown> | undefined,
            clinician_overrides: session.overrides as unknown as Record<string, unknown> | undefined,
          });
        } else {
          // Try to create on the server — but don't block if API is down
          await apiCreateEncounter({
            patient_id: session.patientId,
            title: session.title,
            original_case_text: session.originalCaseText,
            current_case_text: session.currentCaseText,
            analysis_result: session.currentResult as Record<string, unknown> | undefined,
            clinician_overrides: session.overrides as unknown as Record<string, unknown> | undefined,
          });
        }
        setSyncStatus('synced');
      } catch {
        // API unavailable — localStorage is the fallback
        setSyncStatus('error');
      }
    }, 2000);
  }, []);

  // Load sessions on mount
  useEffect(() => {
    const sessions = getCaseSessions();
    setAllSessions(sessions);

    const currentId = getCurrentCaseSessionId();
    if (currentId) {
      const found = sessions.find(s => s.id === currentId);
      if (found) {
        setSession(found);
      }
    }
    setIsLoaded(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshSessions = useCallback(() => {
    setAllSessions(getCaseSessions());
  }, []);

  const createSession = useCallback((caseText: string, title?: string): CaseSession => {
    const now = new Date().toISOString();
    const session: CaseSession = {
      id: `case-${Date.now()}`,
      title: title || caseText.slice(0, 60).replace(/\n/g, ' ') + '...',
      createdAt: now,
      updatedAt: now,
      originalCaseText: caseText,
      currentCaseText: caseText,
      currentResult: null,
      events: [],
      followUpMessages: [],
    };
    saveCaseSession(session);
    setCurrentCaseSessionId(session.id);
    setSession(session);
    refreshSessions();
    syncToAPI(session);
    return session;
  }, [refreshSessions, setSession, syncToAPI]);

  const saveSession = useCallback((session: CaseSession) => {
    saveCaseSession(session);
    setSession(session);
    refreshSessions();
    syncToAPI(session);
  }, [refreshSessions, setSession, syncToAPI]);

  const loadSession = useCallback((id: string) => {
    const sessions = getCaseSessions();
    const found = sessions.find(s => s.id === id);
    if (found) {
      setCurrentCaseSessionId(found.id);
      setSession(found);
    }
    return found || null;
  }, [setSession]);

  const deleteSession = useCallback((id: string) => {
    deleteSessionFromStorage(id);
    if (sessionRef.current?.id === id) {
      setSession(null);
      setCurrentCaseSessionId(null);
    }
    refreshSessions();
  }, [refreshSessions, setSession]);

  const clearCurrentSession = useCallback(() => {
    setSession(null);
    setCurrentCaseSessionId(null);
  }, [setSession]);

  const addEvent = useCallback((event: Omit<CaseEvent, 'id' | 'timestamp'>) => {
    const cur = sessionRef.current;
    if (!cur) return;
    const newEvent: CaseEvent = {
      ...event,
      id: `event-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    const updated = {
      ...cur,
      events: [...cur.events, newEvent],
      updatedAt: new Date().toISOString(),
    };
    saveCaseSession(updated);
    setSession(updated);
    refreshSessions();
    syncToAPI(updated);
  }, [refreshSessions, setSession, syncToAPI]);

  const addFindings = useCallback((findings: NewFindings): string => {
    const cur = sessionRef.current;
    if (!cur) return '';

    const findingsLabel = findings.category.replace('_', ' ');
    const timePrefix = findings.clinicalTime ? `[${findings.clinicalTime}] ` : '';
    const addition = `\n\n--- New ${findingsLabel} ${timePrefix}---\n${findings.text}`;
    const updatedText = cur.currentCaseText + addition;

    const updated = {
      ...cur,
      currentCaseText: updatedText,
      updatedAt: new Date().toISOString(),
    };
    saveCaseSession(updated);
    setSession(updated);
    refreshSessions();
    syncToAPI(updated);
    return updatedText;
  }, [refreshSessions, setSession, syncToAPI]);

  const updateResult = useCallback((result: Record<string, unknown>) => {
    const cur = sessionRef.current;
    if (!cur) return;
    const updated = {
      ...cur,
      currentResult: result,
      updatedAt: new Date().toISOString(),
    };
    saveCaseSession(updated);
    setSession(updated);
    refreshSessions();
    syncToAPI(updated);
  }, [refreshSessions, setSession, syncToAPI]);

  const updateFollowUpMessages = useCallback((messages: CaseFollowUpMessage[]) => {
    const cur = sessionRef.current;
    if (!cur) return;
    const updated = {
      ...cur,
      followUpMessages: messages,
      updatedAt: new Date().toISOString(),
    };
    saveCaseSession(updated);
    setSession(updated);
    refreshSessions();
  }, [refreshSessions, setSession]);

  const updateOverrides = useCallback((overrides: ClinicianOverrides) => {
    const cur = sessionRef.current;
    if (!cur) return;
    const updated = {
      ...cur,
      overrides: { ...overrides, lastModified: new Date().toISOString() },
      updatedAt: new Date().toISOString(),
    };
    saveCaseSession(updated);
    setSession(updated);
    refreshSessions();
    syncToAPI(updated);
  }, [refreshSessions, setSession, syncToAPI]);

  const getOverrides = useCallback((): ClinicianOverrides => {
    return sessionRef.current?.overrides || createEmptyOverrides();
  }, []);

  const updateUIState = useCallback((uiState: { activeTab?: string; chatOpen?: boolean }) => {
    const cur = sessionRef.current;
    if (!cur) return;
    const updated = { ...cur, ...uiState, updatedAt: new Date().toISOString() };
    saveCaseSession(updated);
    setSession(updated);
  }, [setSession]);

  const updatePatientId = useCallback((patientId: string) => {
    const cur = sessionRef.current;
    if (!cur) return;
    const updated = {
      ...cur,
      patientId,
      updatedAt: new Date().toISOString(),
    };
    saveCaseSession(updated);
    setSession(updated);
    refreshSessions();
    syncToAPI(updated);
  }, [refreshSessions, setSession, syncToAPI]);

  return {
    currentSession,
    allSessions,
    isLoaded,
    syncStatus,
    createSession,
    saveSession,
    loadSession,
    deleteSession,
    clearCurrentSession,
    addEvent,
    addFindings,
    updateResult,
    updateFollowUpMessages,
    updateOverrides,
    getOverrides,
    updatePatientId,
    updateUIState,
  };
}
