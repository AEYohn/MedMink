'use client';

import { useState, useEffect, useCallback } from 'react';
import { getReleasedSummaries } from '@/lib/storage';
import { getApiUrl } from '@/lib/api-url';
import type { ReleasedVisitSummary } from '@/types/visit-summary';
import type {
  VitalReading,
  VitalTrend,
  VitalAlert,
  VitalAnalysis,
  PostVisitMessage,
  ChatMessage,
  CompanionConfig,
  PostVisitTab,
} from '@/types/postvisit';

const API = getApiUrl();

interface UsePostVisitReturn {
  // Summary
  summary: ReleasedVisitSummary | null;
  loading: boolean;

  // Companion chat
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  sendChatMessage: (message: string) => Promise<void>;

  // Vitals
  vitals: VitalReading[];
  vitalTrends: Record<string, VitalTrend>;
  vitalAnalysis: VitalAnalysis | null;
  logVital: (reading: Omit<VitalReading, 'id'>) => Promise<void>;
  importVitals: (file: File) => Promise<number>;
  analyzeVitals: () => Promise<void>;
  vitalsLoading: boolean;

  // Messages
  messages: PostVisitMessage[];
  sendMessage: (content: string) => Promise<void>;
  messagesLoading: boolean;

  // Tab
  activeTab: PostVisitTab;
  setActiveTab: (tab: PostVisitTab) => void;
}

export function usePostVisit(summaryId: string): UsePostVisitReturn {
  const [summary, setSummary] = useState<ReleasedVisitSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Vitals state
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [vitalTrends, setVitalTrends] = useState<Record<string, VitalTrend>>({});
  const [vitalAnalysis, setVitalAnalysis] = useState<VitalAnalysis | null>(null);
  const [vitalsLoading, setVitalsLoading] = useState(false);

  // Messages state
  const [messages, setMessages] = useState<PostVisitMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<PostVisitTab>('overview');

  // Load summary from localStorage
  useEffect(() => {
    const all = getReleasedSummaries().filter(s => s.status === 'released');
    const found = all.find(s => s.id === summaryId);
    setSummary(found || null);
    setLoading(false);
  }, [summaryId]);

  // Load vitals when switching to tracker tab
  useEffect(() => {
    if (activeTab === 'tracker' && summary?.patientId && API) {
      setVitalsLoading(true);
      fetch(`${API}/api/postvisit/vitals/${summary.patientId}`)
        .then(r => r.json())
        .then(data => {
          setVitals(data.readings || []);
          // Also load trends
          return fetch(`${API}/api/postvisit/vitals/${summary.patientId}/trends`);
        })
        .then(r => r.json())
        .then(data => setVitalTrends(data.trends || {}))
        .catch(() => {})
        .finally(() => setVitalsLoading(false));
    }
  }, [activeTab, summary?.patientId]);

  // Load messages when switching to messages tab
  useEffect(() => {
    if (activeTab === 'messages' && API) {
      setMessagesLoading(true);
      fetch(`${API}/api/postvisit/${summaryId}/messages`)
        .then(r => r.json())
        .then(data => setMessages(data.messages || []))
        .catch(() => {})
        .finally(() => setMessagesLoading(false));
    }
  }, [activeTab, summaryId]);

  // Send chat message with SSE streaming
  const sendChatMessage = useCallback(async (message: string) => {
    if (!summary || !API) return;
    setChatLoading(true);

    const userMsg: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, userMsg]);

    try {
      const resp = await fetch(`${API}/api/postvisit/${summaryId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversation_history: chatMessages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          summary: {
            diagnosis: summary.diagnosis,
            diagnosisExplanation: summary.diagnosisExplanation,
            medications: summary.medications,
            dischargeInstructions: summary.dischargeInstructions,
            followUps: summary.followUps,
            redFlags: summary.redFlags,
            restrictions: summary.restrictions,
            visitDate: summary.visitDate,
            releasedBy: summary.releasedBy,
            companionConfig: (summary as any).companionConfig,
          },
          patient_id: summary.patientId,
        }),
      });

      if (!resp.ok) throw new Error('Chat request failed');

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let fullContent = '';
      let citations: any[] = [];
      let assistantIndex = -1;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'token') {
              fullContent += event.data.text;
              setChatMessages(prev => {
                const updated = [...prev];
                if (assistantIndex === -1) {
                  assistantIndex = updated.length;
                  updated.push({
                    role: 'assistant',
                    content: fullContent,
                    timestamp: new Date().toISOString(),
                  });
                } else {
                  updated[assistantIndex] = {
                    ...updated[assistantIndex],
                    content: fullContent,
                  };
                }
                return updated;
              });
            } else if (event.type === 'response') {
              fullContent = event.data.content;
              citations = event.data.citations || [];
              setChatMessages(prev => {
                const updated = [...prev];
                if (assistantIndex === -1) {
                  updated.push({
                    role: 'assistant',
                    content: fullContent,
                    citations,
                    timestamp: new Date().toISOString(),
                  });
                } else {
                  updated[assistantIndex] = {
                    ...updated[assistantIndex],
                    content: fullContent,
                    citations,
                  };
                }
                return updated;
              });
            }
          } catch {
            // Skip parse errors
          }
        }
      }
    } catch (err) {
      // Fallback: add error message
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'I\'m sorry, I wasn\'t able to connect to the AI service. Please try again later or contact your healthcare provider directly.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [summary, summaryId, chatMessages]);

  // Log a vital reading
  const logVital = useCallback(async (reading: Omit<VitalReading, 'id'>) => {
    if (!API) return;
    const resp = await fetch(`${API}/api/postvisit/vitals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: reading.patientId,
        vital_type: reading.vitalType,
        value: reading.value,
        unit: reading.unit,
        recorded_at: reading.recordedAt,
        source: reading.source,
        notes: reading.notes,
      }),
    });
    if (resp.ok) {
      const newReading = await resp.json();
      setVitals(prev => [...prev, newReading]);
      // Refresh trends
      const trendsResp = await fetch(`${API}/api/postvisit/vitals/${reading.patientId}/trends`);
      if (trendsResp.ok) {
        const data = await trendsResp.json();
        setVitalTrends(data.trends || {});
      }
    }
  }, []);

  // Import vitals from file
  const importVitals = useCallback(async (file: File): Promise<number> => {
    if (!API || !summary?.patientId) return 0;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('patient_id', summary.patientId);

    const resp = await fetch(`${API}/api/postvisit/vitals/import?patient_id=${summary.patientId}`, {
      method: 'POST',
      body: formData,
    });
    if (resp.ok) {
      const data = await resp.json();
      setVitals(prev => [...prev, ...(data.readings || [])]);
      return data.imported || 0;
    }
    return 0;
  }, [summary?.patientId]);

  // Analyze vitals
  const analyzeVitals = useCallback(async () => {
    if (!API || !summary?.patientId) return;
    setVitalsLoading(true);
    try {
      const resp = await fetch(`${API}/api/postvisit/vitals/${summary.patientId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '',
          summary: {
            diagnosis: summary.diagnosis,
            medications: summary.medications,
            redFlags: summary.redFlags,
          },
          patient_id: summary.patientId,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setVitalAnalysis(data);
      }
    } finally {
      setVitalsLoading(false);
    }
  }, [summary]);

  // Send a message to clinician
  const sendMessage = useCallback(async (content: string) => {
    if (!API) return;
    const resp = await fetch(`${API}/api/postvisit/${summaryId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        sender: 'patient',
        patient_id: summary?.patientId || '',
      }),
    });
    if (resp.ok) {
      const msg = await resp.json();
      setMessages(prev => [...prev, msg]);
    }
  }, [summaryId, summary?.patientId]);

  return {
    summary,
    loading,
    chatMessages,
    chatLoading,
    sendChatMessage,
    vitals,
    vitalTrends,
    vitalAnalysis,
    logVital,
    importVitals,
    analyzeVitals,
    vitalsLoading,
    messages,
    sendMessage,
    messagesLoading,
    activeTab,
    setActiveTab,
  };
}
