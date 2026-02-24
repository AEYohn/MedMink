'use client';

import { useState, useCallback, useRef } from 'react';
import type { EMSSession, EMSMessage, ValidationFlag } from '@/types/ems';

const STORAGE_KEY = 'ems-sessions';
const CURRENT_KEY = 'ems-current-session';
const MAX_SESSIONS = 20;

function getSessions(): EMSSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: EMSSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
}

function saveSession(session: EMSSession) {
  const sessions = getSessions();
  const idx = sessions.findIndex(s => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.unshift(session);
  }
  saveSessions(sessions);
}

export function useEMSSession() {
  const [allSessions, setAllSessions] = useState<EMSSession[]>([]);
  const [currentSession, setCurrentSession] = useState<EMSSession | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const sessionRef = useRef<EMSSession | null>(null);

  const setSession = useCallback((s: EMSSession | null) => {
    sessionRef.current = s;
    setCurrentSession(s);
  }, []);

  const refreshSessions = useCallback(() => {
    setAllSessions(getSessions());
  }, []);

  const initialize = useCallback(() => {
    const sessions = getSessions();
    setAllSessions(sessions);
    const currentId = typeof window !== 'undefined' ? localStorage.getItem(CURRENT_KEY) : null;
    if (currentId) {
      const found = sessions.find(s => s.id === currentId);
      if (found) setSession(found);
    }
    setIsLoaded(true);
  }, [setSession]);

  const createSession = useCallback((sessionId: string, runId: string): EMSSession => {
    const session: EMSSession = {
      id: `ems-${Date.now()}`,
      sessionId,
      runId,
      phase: 'dispatch',
      messages: [],
      extractedData: {},
      validationFlags: [],
      sectionCompleteness: {},
      startedAt: new Date().toISOString(),
      status: 'active',
    };
    saveSession(session);
    localStorage.setItem(CURRENT_KEY, session.id);
    setSession(session);
    refreshSessions();
    return session;
  }, [refreshSessions, setSession]);

  const updateSession = useCallback((updates: Partial<EMSSession>) => {
    const cur = sessionRef.current;
    if (!cur) return;
    const updated = { ...cur, ...updates };
    saveSession(updated);
    setSession(updated);
    refreshSessions();
  }, [refreshSessions, setSession]);

  const addMessage = useCallback((msg: EMSMessage) => {
    const cur = sessionRef.current;
    if (!cur) return;
    const stamped = msg.timestamp ? msg : { ...msg, timestamp: new Date().toISOString() };
    const updated = { ...cur, messages: [...cur.messages, stamped] };
    saveSession(updated);
    setSession(updated);
  }, [setSession]);

  const updateFromResponse = useCallback((data: {
    phase: string;
    extracted_data: Record<string, unknown>;
    validation_flags: ValidationFlag[];
    section_completeness: Record<string, number>;
  }) => {
    const cur = sessionRef.current;
    if (!cur) return;
    const updated = {
      ...cur,
      phase: data.phase,
      extractedData: data.extracted_data,
      validationFlags: data.validation_flags,
      sectionCompleteness: data.section_completeness,
    };
    saveSession(updated);
    setSession(updated);
    refreshSessions();
  }, [refreshSessions, setSession]);

  const loadSession = useCallback((id: string) => {
    const sessions = getSessions();
    const found = sessions.find(s => s.id === id);
    if (found) {
      localStorage.setItem(CURRENT_KEY, found.id);
      setSession(found);
    }
    return found || null;
  }, [setSession]);

  const deleteSession = useCallback((id: string) => {
    const sessions = getSessions().filter(s => s.id !== id);
    saveSessions(sessions);
    if (sessionRef.current?.id === id) {
      setSession(null);
      localStorage.removeItem(CURRENT_KEY);
    }
    refreshSessions();
  }, [refreshSessions, setSession]);

  const clearCurrentSession = useCallback(() => {
    setSession(null);
    localStorage.removeItem(CURRENT_KEY);
  }, [setSession]);

  return {
    currentSession,
    allSessions,
    isLoaded,
    initialize,
    createSession,
    updateSession,
    addMessage,
    updateFromResponse,
    loadSession,
    deleteSession,
    clearCurrentSession,
    refreshSessions,
  };
}
