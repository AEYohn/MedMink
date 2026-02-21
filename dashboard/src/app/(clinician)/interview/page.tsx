'use client';

import { useState, useCallback, useEffect } from 'react';
import { ClipboardList, Phone, Loader2, ChevronRight, AlertTriangle } from 'lucide-react';
import { InterviewChat } from '@/components/interview/InterviewChat';
import { TriageResult } from '@/components/interview/TriageResult';
import { ManagementPlanPanel } from '@/components/interview/ManagementPlanPanel';
import { VisitHistory } from '@/components/interview/VisitHistory';
import { CoughRecorder } from '@/components/interview/CoughRecorder';
import { RespiratoryRiskCard } from '@/components/interview/RespiratoryRiskCard';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { PatientBanner } from '@/components/shared/PatientBanner';
import { usePatientFromUrl } from '@/hooks/usePatientFromUrl';
import { useActivePatient } from '@/contexts/ActivePatientContext';
import { getPatient, getPatientDisplayName, getPatientAge } from '@/lib/patient-storage';
import { getApiUrl } from '@/lib/api-url';
import { mockStartInterview, mockRespond, mockComplete } from '@/lib/mock-interview';

const API_URL = getApiUrl() || '';

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .catch((err) => {
      if (err.name === 'AbortError') throw new Error('Request timed out. Please try again.');
      throw err;
    })
    .finally(() => clearTimeout(timeout));
}

interface Message {
  role: 'assistant' | 'user';
  content: string;
  transcript?: string;
}

interface TriageData {
  chief_complaint: string;
  hpi: Record<string, string>;
  review_of_systems: { positive?: string[]; negative?: string[] };
  past_medical_history: string[];
  medications: string[];
  allergies: string[];
  esi_level: number;
  esi_reasoning: string;
  recommended_setting: string;
  setting_reasoning: string;
  red_flags: string[];
}

const PHASE_LABELS: Record<string, string> = {
  greeting: 'Greeting',
  chief_complaint: 'Chief Complaint',
  hpi: 'History of Present Illness',
  review_of_systems: 'Review of Systems',
  pmh_psh_fh_sh: 'Past History',
  medications: 'Medications',
  allergies: 'Allergies',
  review_and_triage: 'Review & Triage',
  complete: 'Complete',
};

const PHASES = [
  'chief_complaint',
  'hpi',
  'review_of_systems',
  'pmh_psh_fh_sh',
  'medications',
  'allergies',
  'review_and_triage',
  'complete',
];

const LANGUAGES = [
  { code: 'en', label: 'English', bcp47: 'en-US' },
  { code: 'zh', label: '中文 (Mandarin)', bcp47: 'zh-CN' },
  { code: 'ms', label: 'Bahasa Melayu', bcp47: 'ms-MY' },
  { code: 'ta', label: 'தமிழ் (Tamil)', bcp47: 'ta-IN' },
  { code: 'es', label: 'Español', bcp47: 'es-US' },
  { code: 'vi', label: 'Tiếng Việt', bcp47: 'vi-VN' },
  { code: 'ar', label: 'العربية (Arabic)', bcp47: 'ar-SA' },
];

export default function InterviewPage() {
  usePatientFromUrl();
  const { patientId: activePatientId } = useActivePatient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string>('greeting');
  const [isLoading, setIsLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [triage, setTriage] = useState<TriageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState('en');

  const [patientId, setPatientId] = useState<string | null>(null);
  const [showVisitHistory, setShowVisitHistory] = useState(false);
  const [promptCough, setPromptCough] = useState(false);
  const [respiratoryResults, setRespiratoryResults] = useState<any>(null);
  const [mockMode, setMockMode] = useState(false);

  // Sync active patient context into local patientId
  useEffect(() => {
    if (activePatientId && !patientId) {
      setPatientId(activePatientId);
    }
  }, [activePatientId, patientId]);

  const { isRecording, audioBlob, audioDuration, start: startRecording, stop: stopRecording, clear: clearRecording } = useAudioRecorder();

  const startInterview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Build patient context from active patient if available
      let body: Record<string, unknown> = { language };
      if (patientId) {
        const patient = getPatient(patientId);
        if (patient) {
          body = {
            language,
            patient_context: {
              id: patient.id,
              name: getPatientDisplayName(patient),
              age: getPatientAge(patient),
              sex: patient.sex,
              mrn: patient.mrn || null,
              conditions: patient.conditions,
              medications: patient.medications,
              allergies: patient.allergies,
            },
          };
        }
      }
      const res = await fetchWithTimeout(`${API_URL}/api/interview/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, 10000);
      if (!res.ok) throw new Error(`Failed to start interview: ${res.status}`);
      const data = await res.json();
      setSessionId(data.session_id);
      setCurrentPhase(data.phase);
      const greeting = data.question?.trim() || "Hello! I'm here to help with your intake. What brought you in today?";
      setMessages([{ role: 'assistant', content: greeting }]);
    } catch {
      // Backend unavailable — fall back to mock mode
      setMockMode(true);
      const data = mockStartInterview();
      setSessionId(data.session_id);
      setCurrentPhase(data.phase);
      const greeting = data.question?.trim() || "Hello! I'm here to help with your intake. What brought you in today?";
      setMessages([{ role: 'assistant', content: greeting }]);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, [patientId, language]);

  const sendText = useCallback(async () => {
    if (!inputText.trim() || !sessionId || isLoading) return;

    const text = inputText.trim();
    setInputText('');
    const updatedMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(updatedMessages);
    setIsLoading(true);
    setError(null);

    try {
      if (mockMode) {
        await new Promise(r => setTimeout(r, 800));
        const data = mockRespond(sessionId, text, updatedMessages, currentPhase);
        setCurrentPhase(data.phase);
        const aiResponse = data.question?.trim() || "I understand. Can you tell me more?";
        setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
        if (data.prompt_cough_recording) setPromptCough(true);
        if (data.phase === 'review_and_triage' || data.phase === 'complete') {
          await completeInterview();
        }
      } else {
        const res = await fetchWithTimeout(`${API_URL}/api/interview/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            text,
            conversation_history: messages.map(m => ({ role: m.role, content: m.content })),
            phase: currentPhase,
            patient_id: patientId,
            language,
          }),
        }, 60000);
        if (!res.ok) throw new Error(`Response failed: ${res.status}`);
        const data = await res.json();

        setCurrentPhase(data.phase);
        const aiResponse = data.question?.trim() || "I understand. Can you tell me more?";
        setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);

        if (data.prompt_cough_recording) setPromptCough(true);
        if (data.phase === 'review_and_triage' || data.phase === 'complete') {
          await completeInterview();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process response');
    } finally {
      setIsLoading(false);
    }
  }, [inputText, sessionId, isLoading, messages, currentPhase, patientId, language, mockMode]);

  const handleStopRecording = useCallback(async () => {
    stopRecording();
    // Wait a tick for audioBlob to be set
    setTimeout(async () => {
      await sendAudio();
    }, 200);
  }, [stopRecording]);

  const sendAudio = useCallback(async () => {
    if (!sessionId || !audioBlob) return;

    setMessages(prev => [...prev, { role: 'user', content: '(audio recording...)', transcript: 'transcribing' }]);
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('session_id', sessionId);
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('conversation_history', JSON.stringify(messages.map(m => ({ role: m.role, content: m.content }))));
      formData.append('phase', currentPhase);
      formData.append('language', language);
      if (patientId) formData.append('patient_id', patientId);

      const res = await fetchWithTimeout(`${API_URL}/api/interview/respond/audio`, {
        method: 'POST',
        body: formData,
      }, 90000);
      if (!res.ok) throw new Error(`Audio response failed: ${res.status}`);
      const data = await res.json();

      // Replace the placeholder message with the actual transcript
      setMessages(prev => {
        const updated = [...prev];
        const lastUserIdx = updated.findLastIndex(m => m.role === 'user');
        if (lastUserIdx >= 0) {
          updated[lastUserIdx] = {
            role: 'user',
            content: data.transcript || '(transcription failed)',
            transcript: data.transcript,
          };
        }
        const aiResponse = data.question?.trim() || "I understand. Can you tell me more?";
        return [...updated, { role: 'assistant', content: aiResponse }];
      });
      setCurrentPhase(data.phase);
      clearRecording();

      if (data.phase === 'review_and_triage' || data.phase === 'complete') {
        await completeInterview();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process audio');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, audioBlob, clearRecording, messages, currentPhase, patientId, language]);

  const completeInterview = useCallback(async () => {
    if (!sessionId) return;

    setIsLoading(true);
    try {
      if (mockMode) {
        await new Promise(r => setTimeout(r, 1500));
        const data = mockComplete(sessionId, messages);
        setTriage(data as unknown as TriageData);
        setCurrentPhase('complete');
      } else {
        const res = await fetchWithTimeout(`${API_URL}/api/interview/${sessionId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_history: messages.map(m => ({ role: m.role, content: m.content })),
            phase: currentPhase,
            patient_id: patientId,
          }),
        }, 120000);
        if (!res.ok) throw new Error(`Triage failed: ${res.status}`);
        const data = await res.json();
        setTriage(data);
        setCurrentPhase('complete');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate triage');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, messages, currentPhase, patientId, mockMode]);

  // Phase progress calculation
  const currentPhaseIndex = PHASES.indexOf(currentPhase);
  const progress = currentPhaseIndex >= 0 ? ((currentPhaseIndex + 1) / PHASES.length) * 100 : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <PatientBanner className="mb-3" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <ClipboardList className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Patient Interview</h1>
              <p className="text-sm text-muted-foreground">
                AI-powered clinical intake & triage
              </p>
            </div>
          </div>

          {sessionId && !triage && (
            <button
              onClick={completeInterview}
              disabled={isLoading || messages.length < 4}
              className="px-4 py-2 text-sm font-medium border border-border rounded-xl hover:bg-muted transition-colors disabled:opacity-50"
            >
              Complete & Triage
            </button>
          )}
        </div>

        {/* Phase Progress */}
        {sessionId && (
          <div className="mt-3">
            <div className="flex items-center gap-1 mb-1.5">
              {PHASES.map((phase, i) => (
                <div key={phase} className="flex items-center">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      i <= currentPhaseIndex
                        ? 'bg-primary w-8'
                        : 'bg-muted w-6'
                    }`}
                  />
                  {i < PHASES.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/30" />}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {PHASE_LABELS[currentPhase] || currentPhase}
            </p>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-6 mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {!sessionId ? (
          /* Start Screen */
          <div className="flex flex-col items-center justify-center h-full gap-6 px-6">
            <div className="text-center max-w-md">
              <div className="p-4 bg-primary/10 rounded-2xl w-fit mx-auto mb-4">
                <Phone className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Patient Intake Interview</h2>
              <p className="text-sm text-muted-foreground">
                An AI triage nurse will guide you through a structured medical interview,
                collecting your symptoms, history, and relevant information to determine
                the appropriate level of care.
              </p>
            </div>

            {/* Emergency Warning */}
            <div className="max-w-md p-3 rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-red-800 dark:text-red-300">
                  <p className="font-semibold mb-1">Emergency Warning</p>
                  <p>
                    If you are experiencing a life-threatening emergency — such as chest pain,
                    difficulty breathing, severe bleeding, or loss of consciousness —{' '}
                    <strong>call 911 (or your local emergency number) immediately</strong> or
                    alert nearby medical staff. Do not rely on this tool for emergency care.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm max-w-sm">
              <div className="p-3 rounded-xl bg-muted/50 text-center">
                <p className="font-medium">Voice or Text</p>
                <p className="text-xs text-muted-foreground mt-0.5">Use mic or keyboard</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 text-center">
                <p className="font-medium">5-8 Questions</p>
                <p className="text-xs text-muted-foreground mt-0.5">Adaptive interview</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 text-center">
                <p className="font-medium">ESI Triage</p>
                <p className="text-xs text-muted-foreground mt-0.5">Severity assessment</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 text-center">
                <p className="font-medium">Care Setting</p>
                <p className="text-xs text-muted-foreground mt-0.5">Where to go next</p>
              </div>
            </div>

            {/* Language Selector */}
            <div className="flex flex-col items-center gap-1.5">
              <label htmlFor="interview-language" className="text-sm font-medium text-muted-foreground">
                Interview Language
              </label>
              <select
                id="interview-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="px-4 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={startInterview}
              disabled={isLoading}
              className="flex items-center gap-2 px-8 py-3 bg-primary hover:bg-primary/90 text-white font-medium rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ClipboardList className="w-5 h-5" />
              )}
              Start Interview
            </button>
          </div>
        ) : triage ? (
          /* Triage Result */
          <div className="overflow-y-auto h-full p-6">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-lg font-semibold mb-4">Triage Assessment</h2>
              <TriageResult triage={triage} />

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setSessionId(null);
                    setMessages([]);
                    setTriage(null);
                    setCurrentPhase('greeting');
                    setError(null);
                    setMockMode(false);
                  }}
                  className="px-4 py-2 text-sm font-medium border border-border rounded-xl hover:bg-muted transition-colors"
                >
                  New Interview
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Split-view: Chat + Management Plan */
          <div className="flex flex-col h-full">
            {/* Persistent Emergency Banner */}
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>If this is a medical emergency, <strong>call 911</strong> or alert nearby medical staff immediately.</span>
            </div>
            <div className="flex flex-1 min-h-0">
            {/* Left: Chat Interface */}
            <div className="flex-1 min-w-0">
              <InterviewChat
                messages={messages}
                isLoading={isLoading}
                isRecording={isRecording}
                audioDuration={audioDuration}
                inputText={inputText}
                onInputChange={setInputText}
                onSendText={sendText}
                onStartRecording={startRecording}
                onStopRecording={handleStopRecording}
              />

              {/* Cough Recorder — appears when respiratory symptoms detected */}
              {promptCough && (
                <div className="px-4 pb-3">
                  <CoughRecorder
                    onResultsReceived={(results) => setRespiratoryResults(results)}
                  />
                </div>
              )}
            </div>

            {/* Right: Management Plan Panel */}
            <div className="w-80 border-l border-border overflow-y-auto p-4 hidden lg:block">
              <ManagementPlanPanel
                sessionId={sessionId}
                currentPhase={currentPhase}
              />

              {respiratoryResults && (
                <div className="mt-4">
                  <RespiratoryRiskCard results={respiratoryResults} />
                </div>
              )}

              {/* Patient ID + Visit History */}
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Patient ID..."
                    value={patientId || ''}
                    onChange={(e) => setPatientId(e.target.value || null)}
                    className="flex-1 px-2 py-1 text-xs border border-border rounded-lg bg-background"
                  />
                  {patientId && (
                    <button
                      onClick={() => setShowVisitHistory(!showVisitHistory)}
                      className="text-xs text-primary hover:underline"
                    >
                      {showVisitHistory ? 'Hide' : 'History'}
                    </button>
                  )}
                </div>
                {showVisitHistory && <VisitHistory patientId={patientId} />}
              </div>
            </div>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
