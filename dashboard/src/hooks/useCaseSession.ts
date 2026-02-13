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

export function useCaseSession() {
  const [allSessions, setAllSessions] = useState<CaseSession[]>([]);
  const [currentSession, setCurrentSession] = useState<CaseSession | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Ref to avoid stale closure issues in async callbacks (e.g. SSE stream handlers).
  // Without this, updateResult/addEvent close over the old currentSession value
  // from the render where handleSubmit was called, causing them to silently no-op.
  const sessionRef = useRef<CaseSession | null>(null);

  // Helper: update both React state and ref synchronously
  const setSession = useCallback((s: CaseSession | null) => {
    sessionRef.current = s;
    setCurrentSession(s);
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
    return session;
  }, [refreshSessions, setSession]);

  const saveSession = useCallback((session: CaseSession) => {
    saveCaseSession(session);
    setSession(session);
    refreshSessions();
  }, [refreshSessions, setSession]);

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
  }, [refreshSessions, setSession]);

  const addFindings = useCallback((findings: NewFindings): string => {
    const cur = sessionRef.current;
    if (!cur) return '';

    // Append new findings to case text
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
    return updatedText;
  }, [refreshSessions, setSession]);

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
  }, [refreshSessions, setSession]);

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
  }, [refreshSessions, setSession]);

  const getOverrides = useCallback((): ClinicianOverrides => {
    return sessionRef.current?.overrides || createEmptyOverrides();
  }, []);

  return {
    currentSession,
    allSessions,
    isLoaded,
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
  };
}
