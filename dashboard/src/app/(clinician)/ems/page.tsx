'use client';

import { useState, useCallback, useEffect } from 'react';
import { Siren, Loader2, CheckCircle, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { EMSReportChat } from '@/components/ems/EMSReportChat';
import { SectionProgress } from '@/components/ems/SectionProgress';
import { QuickVitalsGrid } from '@/components/ems/QuickVitalsGrid';
import { QuickInterventionGrid } from '@/components/ems/QuickInterventionGrid';
import { QuickMedicationEntry } from '@/components/ems/QuickMedicationEntry';
import { ValidationPanel } from '@/components/ems/ValidationPanel';
import { RunTimer } from '@/components/ems/RunTimer';
import { NarrativePreview } from '@/components/ems/NarrativePreview';
import { EMSRunList } from '@/components/ems/EMSRunList';
import { useEMSSession } from '@/hooks/useEMSSession';
import { getApiUrl } from '@/lib/api-url';
import type { EMSMessage, EMSDictateResponse, EMSCompleteResponse, ICD10Code, ValidationFlag } from '@/types/ems';

const API_URL = getApiUrl() || '';

type QuickTab = 'vitals' | 'meds' | 'procedures';

export default function EMSPage() {
  const {
    currentSession,
    allSessions,
    initialize,
    createSession,
    updateSession,
    addMessage,
    updateFromResponse,
    loadSession,
    deleteSession,
    clearCurrentSession,
  } = useEMSSession();

  const [isLoading, setIsLoading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [quickTab, setQuickTab] = useState<QuickTab>('vitals');
  const [quickOpen, setQuickOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [narrative, setNarrative] = useState('');
  const [icd10Codes, setIcd10Codes] = useState<ICD10Code[]>([]);
  const [medicalNecessity, setMedicalNecessity] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { initialize(); }, [initialize]);

  // --- Actions ---

  const startNewRun = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/ems/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Failed to start session');
      const data = await res.json();

      const session = createSession(data.session_id, data.run_id);
      addMessage({ role: 'assistant', content: data.question });
      updateSession({ phase: data.phase });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start');
    } finally {
      setIsLoading(false);
    }
  }, [createSession, addMessage, updateSession]);

  const sendDictation = useCallback(async (text: string) => {
    if (!currentSession) return;
    setIsLoading(true);
    setError(null);
    addMessage({ role: 'user', content: text });

    try {
      const res = await fetch(`${API_URL}/api/ems/dictate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentSession.sessionId,
          text,
          conversation_history: currentSession.messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          phase: currentSession.phase,
          extracted_data: currentSession.extractedData,
        }),
      });

      if (!res.ok) throw new Error('Dictation failed');
      const data: EMSDictateResponse = await res.json();

      addMessage({ role: 'assistant', content: data.question });
      updateFromResponse({
        phase: data.phase,
        extracted_data: data.extracted_data,
        validation_flags: data.validation_flags,
        section_completeness: data.section_completeness,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to process');
      addMessage({ role: 'assistant', content: 'Sorry, there was an error. Could you repeat that?' });
    } finally {
      setIsLoading(false);
    }
  }, [currentSession, addMessage, updateFromResponse]);

  const sendAudio = useCallback(async (blob: Blob) => {
    if (!currentSession) return;
    setIsLoading(true);
    setError(null);

    const form = new FormData();
    form.append('session_id', currentSession.sessionId);
    form.append('audio', blob, 'recording.webm');
    if (currentSession.messages.length > 0) {
      form.append('conversation_history', JSON.stringify(
        currentSession.messages.map(m => ({ role: m.role, content: m.content }))
      ));
    }
    form.append('phase', currentSession.phase);
    form.append('extracted_data', JSON.stringify(currentSession.extractedData));

    try {
      const res = await fetch(`${API_URL}/api/ems/dictate/audio`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error('Audio dictation failed');
      const data: EMSDictateResponse = await res.json();

      addMessage({ role: 'user', content: data.transcript || '(audio)', transcript: data.transcript });
      addMessage({ role: 'assistant', content: data.question });
      updateFromResponse({
        phase: data.phase,
        extracted_data: data.extracted_data,
        validation_flags: data.validation_flags,
        section_completeness: data.section_completeness,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Audio failed');
    } finally {
      setIsLoading(false);
    }
  }, [currentSession, addMessage, updateFromResponse]);

  const submitVitals = useCallback(async (vitals: Record<string, number | null>) => {
    if (!currentSession) return;
    try {
      const res = await fetch(`${API_URL}/api/ems/vitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: currentSession.sessionId, ...vitals }),
      });
      if (!res.ok) throw new Error('Failed to save vitals');
      const data = await res.json();
      updateSession({ extractedData: data.extracted_data });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vitals failed');
    }
  }, [currentSession, updateSession]);

  const submitIntervention = useCallback(async (intervention: { procedure: string; details: string }) => {
    if (!currentSession) return;
    try {
      const res = await fetch(`${API_URL}/api/ems/intervention`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: currentSession.sessionId, ...intervention }),
      });
      if (!res.ok) throw new Error('Failed to save intervention');
      const data = await res.json();
      updateSession({ extractedData: data.extracted_data });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Intervention failed');
    }
  }, [currentSession, updateSession]);

  const submitMedication = useCallback(async (med: { medication: string; dose: string; route: string }) => {
    if (!currentSession) return;
    try {
      const res = await fetch(`${API_URL}/api/ems/medication`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: currentSession.sessionId, ...med }),
      });
      if (!res.ok) throw new Error('Failed to save medication');
      const data = await res.json();
      updateSession({ extractedData: data.extracted_data });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Medication failed');
    }
  }, [currentSession, updateSession]);

  const completeReport = useCallback(async () => {
    if (!currentSession) return;
    setIsCompleting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/ems/${currentSession.sessionId}/complete`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to complete report');
      const data: EMSCompleteResponse = await res.json();

      setNarrative(data.narrative);
      setIcd10Codes(data.icd10_codes);
      setMedicalNecessity(data.medical_necessity);
      updateSession({
        status: 'complete',
        phase: 'complete',
        validationFlags: data.validation_flags,
        sectionCompleteness: data.section_completeness,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Completion failed');
    } finally {
      setIsCompleting(false);
    }
  }, [currentSession, updateSession]);

  // --- Render ---

  const isComplete = currentSession?.status === 'complete' || currentSession?.phase === 'complete';
  const flags: ValidationFlag[] = currentSession?.validationFlags ?? [];
  const hasErrors = flags.some(f => f.severity === 'error');

  // No active session — show new run + history
  if (!currentSession) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-3">
          <Siren className="w-12 h-12 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">EMS Run Report</h1>
          <p className="text-muted-foreground">AI-powered ePCR documentation assistant</p>
        </div>

        <button
          onClick={startNewRun}
          disabled={isLoading}
          className="w-full h-16 flex items-center justify-center gap-3 bg-primary text-primary-foreground rounded-xl text-lg font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Plus className="w-5 h-5" />
          )}
          New Run Report
        </button>

        {allSessions.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Previous Reports</h2>
            <EMSRunList
              sessions={allSessions}
              onSelect={(id) => {
                loadSession(id);
                setShowHistory(false);
              }}
              onDelete={deleteSession}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2 space-y-2 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Siren className="w-5 h-5 text-primary" />
            <h1 className="text-base font-bold">EMS Run Report</h1>
          </div>
          <div className="flex items-center gap-3">
            <RunTimer startedAt={currentSession.startedAt} isComplete={isComplete} />
            {!isComplete && (
              <button
                onClick={completeReport}
                disabled={isCompleting || hasErrors}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {isCompleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Complete
              </button>
            )}
            <button
              onClick={() => { clearCurrentSession(); setNarrative(''); setIcd10Codes([]); setMedicalNecessity(''); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        <SectionProgress
          currentPhase={currentSession.phase}
          sectionCompleteness={currentSession.sectionCompleteness}
        />
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-500/10 text-red-600 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Chat */}
        <div className="flex-1 overflow-hidden">
          <EMSReportChat
            messages={currentSession.messages}
            onSendText={sendDictation}
            onSendAudio={sendAudio}
            isLoading={isLoading}
            disabled={isComplete}
          />
        </div>

        {/* Validation flags */}
        {flags.length > 0 && (
          <div className="px-4 py-2 border-t border-border max-h-40 overflow-y-auto">
            <ValidationPanel flags={flags} />
          </div>
        )}

        {/* Completion outputs */}
        {isComplete && (narrative || icd10Codes.length > 0 || medicalNecessity) && (
          <div className="px-4 py-3 border-t border-border max-h-64 overflow-y-auto">
            <NarrativePreview
              narrative={narrative}
              icd10Codes={icd10Codes}
              medicalNecessity={medicalNecessity}
            />
          </div>
        )}

        {/* Quick entry panel */}
        {!isComplete && (
          <div className="border-t border-border">
            <button
              onClick={() => setQuickOpen(!quickOpen)}
              className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <span>Quick Entry</span>
              {quickOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>

            {quickOpen && (
              <div className="px-4 pb-3 space-y-3 animate-in slide-in-from-bottom-2 duration-200">
                {/* Tab buttons */}
                <div className="flex gap-1">
                  {([
                    { key: 'vitals', label: 'Vitals' },
                    { key: 'meds', label: 'Meds' },
                    { key: 'procedures', label: 'Procedures' },
                  ] as const).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setQuickTab(tab.key)}
                      className={`flex-1 h-10 text-sm font-medium rounded-lg transition-colors ${
                        quickTab === tab.key
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {quickTab === 'vitals' && <QuickVitalsGrid onSubmit={submitVitals} />}
                {quickTab === 'meds' && <QuickMedicationEntry onSubmit={submitMedication} />}
                {quickTab === 'procedures' && <QuickInterventionGrid onSubmit={submitIntervention} />}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
