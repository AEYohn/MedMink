'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CaseSession,
  CaseEvent,
  CaseFollowUpMessage,
  NewFindings,
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

  // Load sessions on mount
  useEffect(() => {
    const sessions = getCaseSessions();
    setAllSessions(sessions);

    const currentId = getCurrentCaseSessionId();
    if (currentId) {
      const found = sessions.find(s => s.id === currentId);
      if (found) {
        setCurrentSession(found);
      }
    }
    setIsLoaded(true);
  }, []);

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
    setCurrentSession(session);
    refreshSessions();
    return session;
  }, [refreshSessions]);

  const saveSession = useCallback((session: CaseSession) => {
    saveCaseSession(session);
    setCurrentSession(session);
    refreshSessions();
  }, [refreshSessions]);

  const loadSession = useCallback((id: string) => {
    const sessions = getCaseSessions();
    const found = sessions.find(s => s.id === id);
    if (found) {
      setCurrentCaseSessionId(found.id);
      setCurrentSession(found);
    }
    return found || null;
  }, []);

  const deleteSession = useCallback((id: string) => {
    deleteSessionFromStorage(id);
    if (currentSession?.id === id) {
      setCurrentSession(null);
      setCurrentCaseSessionId(null);
    }
    refreshSessions();
  }, [currentSession, refreshSessions]);

  const clearCurrentSession = useCallback(() => {
    setCurrentSession(null);
    setCurrentCaseSessionId(null);
  }, []);

  const addEvent = useCallback((event: Omit<CaseEvent, 'id' | 'timestamp'>) => {
    if (!currentSession) return;
    const newEvent: CaseEvent = {
      ...event,
      id: `event-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    const updated = {
      ...currentSession,
      events: [...currentSession.events, newEvent],
      updatedAt: new Date().toISOString(),
    };
    saveCaseSession(updated);
    setCurrentSession(updated);
    refreshSessions();
  }, [currentSession, refreshSessions]);

  const addFindings = useCallback((findings: NewFindings): string => {
    if (!currentSession) return '';

    // Append new findings to case text
    const findingsLabel = findings.category.replace('_', ' ');
    const timePrefix = findings.clinicalTime ? `[${findings.clinicalTime}] ` : '';
    const addition = `\n\n--- New ${findingsLabel} ${timePrefix}---\n${findings.text}`;
    const updatedText = currentSession.currentCaseText + addition;

    const updated = {
      ...currentSession,
      currentCaseText: updatedText,
      updatedAt: new Date().toISOString(),
    };
    saveCaseSession(updated);
    setCurrentSession(updated);
    refreshSessions();
    return updatedText;
  }, [currentSession, refreshSessions]);

  const updateResult = useCallback((result: Record<string, unknown>) => {
    if (!currentSession) return;
    const updated = {
      ...currentSession,
      currentResult: result,
      updatedAt: new Date().toISOString(),
    };
    saveCaseSession(updated);
    setCurrentSession(updated);
    refreshSessions();
  }, [currentSession, refreshSessions]);

  const updateFollowUpMessages = useCallback((messages: CaseFollowUpMessage[]) => {
    if (!currentSession) return;
    const updated = {
      ...currentSession,
      followUpMessages: messages,
      updatedAt: new Date().toISOString(),
    };
    saveCaseSession(updated);
    setCurrentSession(updated);
    refreshSessions();
  }, [currentSession, refreshSessions]);

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
  };
}
