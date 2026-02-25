'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Phone, Loader2, ChevronRight, AlertTriangle, X, CheckCircle2, Stethoscope, MessageSquare, ChevronDown, ChevronUp, User, Search } from 'lucide-react';
import { InterviewChat } from '@/components/interview/InterviewChat';
import { TriageResult } from '@/components/interview/TriageResult';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { getApiUrl } from '@/lib/api-url';
import { saveIntakeResult } from '@/lib/storage';
import { createPatient, updatePatient, getPatient, getPatients, searchPatients, getPatientAge } from '@/lib/patient-storage';
import type { Patient } from '@/lib/patient-storage';
// mock-interview import removed — we now wait for backend boot instead of falling back
import { useTranslation, LANGUAGES } from '@/i18n';
import { useRole } from '@/contexts/RoleContext';
import { buildVignetteFromTriage } from '@/lib/build-vignette';
import type { TriageData } from '@/types/intake';

const API_URL = getApiUrl() || '';

const FALLBACK_GREETING: Record<string, string> = {
  en: "Hello! I'm here to help with your intake. What brought you in today?",
  es: "¡Hola! Estoy aquí para ayudarle con su admisión. ¿Qué lo trae hoy?",
  zh: "您好！我来帮您完成入院登记。今天是什么原因来就诊？",
  ms: "Hai! Saya di sini untuk membantu pendaftaran anda. Apa yang membawa anda hari ini?",
  ta: "வணக்கம்! உங்கள் பதிவு செய்ய உதவ நான் இங்கே இருக்கிறேன். இன்று என்ன காரணம்?",
  vi: "Xin chào! Tôi ở đây để hỗ trợ tiếp nhận. Hôm nay bạn đến vì lý do gì?",
  ar: "مرحباً! أنا هنا للمساعدة في تسجيلك. ما الذي أتى بك اليوم؟",
};

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
  audioUrl?: string;
}

// --- Persistence helpers for in-progress intake ---
const INTAKE_STORAGE_KEY = 'research-synthesizer:active-intake';
const INTAKE_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

interface PersistedIntake {
  sessionId: string;
  messages: Array<{ role: 'assistant' | 'user'; content: string; transcript?: string }>;
  currentPhase: string;
  mockMode?: boolean; // legacy, ignored
  savedAt: number;
  patientId: string | null;
}

function saveActiveIntake(state: { sessionId: string; messages: Message[]; currentPhase: string; patientId: string | null }) {
  try {
    const data: PersistedIntake = {
      sessionId: state.sessionId,
      messages: state.messages.map(({ role, content, transcript }) => ({ role, content, transcript })),
      currentPhase: state.currentPhase,
      savedAt: Date.now(),
      patientId: state.patientId,
    };
    localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(data));
  } catch { /* quota exceeded — ignore */ }
}

function loadActiveIntake(): PersistedIntake | null {
  try {
    const raw = localStorage.getItem(INTAKE_STORAGE_KEY);
    if (!raw) return null;
    const data: PersistedIntake = JSON.parse(raw);
    if (Date.now() - data.savedAt > INTAKE_MAX_AGE_MS) {
      localStorage.removeItem(INTAKE_STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function clearActiveIntake() {
  try { localStorage.removeItem(INTAKE_STORAGE_KEY); } catch { /* ignore */ }
}

const PHASE_LABEL_KEYS: Record<string, string> = {
  greeting: 'intake.phase.greeting',
  chief_complaint: 'intake.phase.chief_complaint',
  hpi: 'intake.phase.hpi',
  review_of_systems: 'intake.phase.review_of_systems',
  pmh_psh_fh_sh: 'intake.phase.pmh_psh_fh_sh',
  medications: 'intake.phase.medications',
  allergies: 'intake.phase.allergies',
  review_and_triage: 'intake.phase.review_and_triage',
  complete: 'intake.phase.complete',
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

export function CareHubIntake({
  onComplete,
  onBack,
}: {
  onComplete?: () => void;
  onBack?: () => void;
} = {}) {
  const router = useRouter();
  const { setRole } = useRole();
  const { locale: language, setLocale: setLanguage, t } = useTranslation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string>('greeting');
  const [isLoading, setIsLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [triage, setTriage] = useState<TriageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isHandingOff, setIsHandingOff] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Demographics state
  const [patientId, setPatientId] = useState<string | null>(null);
  const [demographicsComplete, setDemographicsComplete] = useState(false);
  const [demoFirstName, setDemoFirstName] = useState('');
  const [demoLastName, setDemoLastName] = useState('');
  const [demoDob, setDemoDob] = useState('');
  const [demoSex, setDemoSex] = useState<'male' | 'female' | 'other' | ''>('');
  const [showReturningPatient, setShowReturningPatient] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');

  const { isRecording, audioBlob, audioDuration, start: startRecording, stop: stopRecording, clear: clearRecording } = useAudioRecorder();
  const pendingSendRef = useRef(false);

  // Restore persisted intake on mount
  useEffect(() => {
    const persisted = loadActiveIntake();
    if (persisted) {
      setSessionId(persisted.sessionId);
      setMessages(persisted.messages as Message[]);
      setCurrentPhase(persisted.currentPhase);
      if (persisted.patientId) {
        setPatientId(persisted.patientId);
        setDemographicsComplete(true);
      }
    }
  }, []);

  // Persist intake state on meaningful changes
  useEffect(() => {
    if (sessionId && !triage) {
      saveActiveIntake({ sessionId, messages, currentPhase, patientId });
    }
  }, [sessionId, messages, currentPhase, triage, patientId]);

  // Auto-start interview after demographics are submitted
  useEffect(() => {
    if (demographicsComplete && !sessionId && !triage) {
      startInterview();
    }
  }, [demographicsComplete, sessionId, triage]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDemographicsSubmit = useCallback(() => {
    if (!demoFirstName.trim() || !demoLastName.trim() || !demoDob || !demoSex) return;
    const patient = createPatient({
      firstName: demoFirstName.trim(),
      lastName: demoLastName.trim(),
      dateOfBirth: demoDob,
      sex: demoSex,
      allergies: [],
      conditions: [],
      medications: [],
    });
    setPatientId(patient.id);
    setDemographicsComplete(true);
  }, [demoFirstName, demoLastName, demoDob, demoSex]);

  const handleSelectReturningPatient = useCallback((patient: Patient) => {
    setPatientId(patient.id);
    setDemoFirstName(patient.firstName);
    setDemoLastName(patient.lastName);
    setDemoDob(patient.dateOfBirth);
    setDemoSex(patient.sex);
    setShowReturningPatient(false);
    setDemographicsComplete(true);
  }, []);

  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up retry timer on unmount
  useEffect(() => {
    return () => { if (retryRef.current) clearTimeout(retryRef.current); };
  }, []);

  const startInterview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/interview/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      }, 30000);
      if (!res.ok) throw new Error(`Failed to start: ${res.status}`);
      const data = await res.json();
      setConnecting(false);
      setSessionId(data.session_id);
      setCurrentPhase(data.phase);
      const greeting = data.question?.trim() || FALLBACK_GREETING[language] || FALLBACK_GREETING.en;
      setMessages([{ role: 'assistant', content: greeting }]);
    } catch {
      // Backend is cold-starting — show connecting state and auto-retry
      setConnecting(true);
      setError(null);
      retryRef.current = setTimeout(() => startInterview(), 5000);
    } finally {
      setIsLoading(false);
    }
  }, [language]);

  const completeInterview = useCallback(async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/interview/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_history: messages.map(m => ({ role: m.role, content: m.content })),
          phase: currentPhase,
        }),
      }, 120000);
      if (!res.ok) throw new Error(`Triage failed: ${res.status}`);
      const data = await res.json();
      setTriage(data);
      setCurrentPhase('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate triage');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, messages, currentPhase]);

  // Save triage result when complete & clear persisted intake + enrich patient
  useEffect(() => {
    if (triage && sessionId && !saved) {
      setSaved(true);
      clearActiveIntake();

      // Enrich patient with data from triage
      if (patientId) {
        const existing = getPatient(patientId);
        if (existing) {
          updatePatient(patientId, {
            allergies: Array.from(new Set([...existing.allergies, ...(triage.allergies || [])])),
            conditions: Array.from(new Set([...existing.conditions, ...(triage.past_medical_history || [])])),
            medications: Array.from(new Set([...existing.medications, ...(triage.medications || [])])),
          });
        }
      }

      saveIntakeResult({
        id: `intake-${Date.now()}`,
        patientId,
        sessionId,
        completedAt: new Date().toISOString(),
        triageData: triage,
        conversationSummary: triage.chief_complaint || 'Patient intake completed',
        conversationHistory: messages.map(({ role, content, transcript }) => ({ role, content, transcript })),
        source: 'patient-intake',
      });
      onComplete?.();
    }
  }, [triage, sessionId, saved, patientId]);

  // Revoke blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      messages.forEach(m => { if (m.audioUrl) URL.revokeObjectURL(m.audioUrl); });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendText = useCallback(async () => {
    if (!inputText.trim() || !sessionId || isLoading) return;
    const text = inputText.trim();
    setInputText('');
    const updatedMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(updatedMessages);
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetchWithTimeout(`${API_URL}/api/interview/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          text,
          conversation_history: messages.map(m => ({ role: m.role, content: m.content })),
          phase: currentPhase,
          language,
        }),
      }, 60000);
      if (!res.ok) throw new Error(`Response failed: ${res.status}`);
      const data = await res.json();
      setCurrentPhase(data.phase);
      if (data.phase === 'review_and_triage' || data.phase === 'complete') {
        await completeInterview();
      } else {
        const aiResponse = data.question?.trim() || "I understand. Can you tell me more?";
        setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process response');
    } finally {
      setIsLoading(false);
    }
  }, [inputText, sessionId, isLoading, messages, currentPhase, language, completeInterview]);

  const handleStopRecording = useCallback(() => {
    stopRecording();
    pendingSendRef.current = true;
  }, [stopRecording]);

  const sendAudio = useCallback(async () => {
    if (!sessionId || !audioBlob) return;

    const blobUrl = URL.createObjectURL(audioBlob);
    setMessages(prev => [...prev, { role: 'user', content: '(audio recording...)', transcript: 'transcribing', audioUrl: blobUrl }]);
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('session_id', sessionId);
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('conversation_history', JSON.stringify(messages.map(m => ({ role: m.role, content: m.content }))));
      formData.append('phase', currentPhase);
      formData.append('language', language);

      const res = await fetchWithTimeout(`${API_URL}/api/interview/respond/audio`, {
        method: 'POST',
        body: formData,
      }, 60000);
      if (!res.ok) throw new Error(`Audio response failed: ${res.status}`);

      const data = await res.json();
      const transcript = data.transcript || '';

      setMessages(prev => {
        const updated = [...prev];
        const idx = updated.findLastIndex(m => m.role === 'user');
        if (idx >= 0) updated[idx] = { role: 'user', content: transcript || '(audio)', transcript, audioUrl: updated[idx].audioUrl };
        return updated;
      });

      setCurrentPhase(data.phase);
      if (data.phase === 'review_and_triage' || data.phase === 'complete') {
        await completeInterview();
      } else {
        const aiResponse = data.question?.trim() || "I understand. Can you tell me more?";
        setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
      }
      clearRecording();
    } catch (err) {
      setMessages(prev => {
        const lastUserIdx = prev.findLastIndex(m => m.content === '(audio recording...)');
        if (lastUserIdx >= 0) {
          if (prev[lastUserIdx].audioUrl) URL.revokeObjectURL(prev[lastUserIdx].audioUrl!);
          return prev.filter((_, i) => i !== lastUserIdx);
        }
        return prev;
      });
      clearRecording();
      setError(err instanceof Error ? err.message : 'Failed to process audio');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, audioBlob, clearRecording, messages, currentPhase, language, completeInterview]);

  useEffect(() => {
    if (pendingSendRef.current && audioBlob) {
      pendingSendRef.current = false;
      sendAudio();
    }
  }, [audioBlob, sendAudio]);

  const currentPhaseIndex = PHASES.indexOf(currentPhase);

  return (
    <div className="flex flex-col h-full min-h-[60vh]">
      {!demographicsComplete ? (
        /* Demographics Form */
        <div className="flex flex-col items-center justify-center flex-1 gap-5 px-4 py-8 overflow-y-auto">
          <div className="text-center max-w-md">
            <div className="p-4 bg-primary/10 rounded-2xl w-fit mx-auto mb-4">
              <User className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-1">{t('intake.demographics.title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('intake.demographics.subtitle')}
            </p>
          </div>

          {/* Returning Patient Lookup */}
          {showReturningPatient ? (
            <div className="w-full max-w-md space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={patientSearchQuery}
                  onChange={(e) => setPatientSearchQuery(e.target.value)}
                  placeholder={t('intake.demographics.searchPlaceholder')}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                {(() => {
                  const results = patientSearchQuery.trim()
                    ? searchPatients(patientSearchQuery)
                    : getPatients().slice(0, 10);
                  if (results.length === 0) {
                    return (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {t('intake.demographics.noResults')}
                      </p>
                    );
                  }
                  return results.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectReturningPatient(p)}
                      className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors text-sm"
                    >
                      <span className="font-medium">{p.firstName} {p.lastName}</span>
                      <span className="text-muted-foreground ml-2">
                        {new Date(p.dateOfBirth).toLocaleDateString()}
                      </span>
                    </button>
                  ));
                })()}
              </div>
              <button
                onClick={() => setShowReturningPatient(false)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                &larr; New patient
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); handleDemographicsSubmit(); }}
              className="w-full max-w-md space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="demo-first" className="block text-sm font-medium mb-1">
                    {t('intake.demographics.firstName')}
                  </label>
                  <input
                    id="demo-first"
                    type="text"
                    required
                    value={demoFirstName}
                    onChange={(e) => setDemoFirstName(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label htmlFor="demo-last" className="block text-sm font-medium mb-1">
                    {t('intake.demographics.lastName')}
                  </label>
                  <input
                    id="demo-last"
                    type="text"
                    required
                    value={demoLastName}
                    onChange={(e) => setDemoLastName(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="demo-dob" className="block text-sm font-medium mb-1">
                  {t('intake.demographics.dob')}
                </label>
                <input
                  id="demo-dob"
                  type="date"
                  required
                  value={demoDob}
                  onChange={(e) => setDemoDob(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('intake.demographics.sex')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['male', 'female', 'other'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDemoSex(s)}
                      className={`py-2.5 text-sm font-medium rounded-xl border transition-all ${
                        demoSex === s
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      {t(`intake.demographics.${s}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language Selector */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="intake-language" className="text-sm font-medium text-muted-foreground">
                  {t('intake.language')}
                </label>
                <select
                  id="intake-language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="px-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Emergency Warning */}
              <div className="p-3 rounded-xl border-2 border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800 dark:text-red-300">
                    {t('intake.emergencyText')}
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={!demoFirstName.trim() || !demoLastName.trim() || !demoDob || !demoSex || isLoading}
                className="w-full flex items-center justify-center gap-2 px-8 py-3 bg-primary hover:bg-primary/90 text-white font-medium rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ClipboardList className="w-5 h-5" />
                )}
                {t('intake.demographics.continue')}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowReturningPatient(true)}
                  className="text-sm text-primary hover:underline"
                >
                  {t('intake.demographics.returningPatient')}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : triage ? (
        /* Triage Result + Confirmation */
        <div className="overflow-y-auto flex-1 p-4">
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Confirmation Banner */}
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                    {t('intake.intakeComplete')}
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    {t('intake.intakeShared')}
                  </p>
                </div>
              </div>
            </div>

            <h2 className="text-lg font-semibold">{t('intake.assessmentSummary')}</h2>
            <TriageResult triage={triage} />

            {/* Conversation History */}
            {messages.length > 0 && (
              <div className="border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowHistory(prev => !prev)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    Conversation History
                    <span className="text-xs text-muted-foreground font-normal">({messages.length} messages)</span>
                  </div>
                  {showHistory ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
                {showHistory && (
                  <div className="border-t border-border px-4 py-4 max-h-96 overflow-y-auto space-y-3">
                    {messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-muted rounded-bl-md'
                          }`}
                        >
                          <p dir="auto" className="text-sm leading-relaxed whitespace-pre-wrap">
                            {msg.transcript && msg.transcript !== 'transcribing'
                              ? msg.transcript
                              : msg.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={async () => {
                  if (!sessionId || isHandingOff) return;
                  setIsHandingOff(true);
                  try {
                    // Try backend handoff first
                    try {
                      const res = await fetchWithTimeout(`${API_URL}/api/interview/${sessionId}/handoff`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          conversation_history: messages.map(m => ({ role: m.role, content: m.content })),
                          phase: currentPhase,
                        }),
                      }, 30000);
                      if (res.ok) {
                        const data = await res.json();
                        if (data.vignette) {
                          sessionStorage.setItem('handoff-vignette', data.vignette);
                          if (data.management_plan) {
                            sessionStorage.setItem('handoff-management-plan', JSON.stringify(data.management_plan));
                          }
                          if (data.recommended_imaging?.length) {
                            sessionStorage.setItem('handoff-imaging', JSON.stringify(data.recommended_imaging));
                          }
                          if (patientId) sessionStorage.setItem('handoff-patient-id', patientId);
                          setRole('clinician');
                          router.push('/case?from=interview');
                          return;
                        }
                      }
                    } catch {
                      // Fall through to local vignette
                    }

                    // Fallback: build vignette from triage data
                    const patient = patientId ? getPatient(patientId) : null;
                    const vignette = buildVignetteFromTriage(triage!, patient ? { age: getPatientAge(patient), sex: patient.sex } : undefined);
                    sessionStorage.setItem('handoff-vignette', vignette);
                    sessionStorage.setItem('handoff-management-plan', JSON.stringify({
                      triage: { esi_level: triage!.esi_level, reasoning: triage!.esi_reasoning },
                      red_flags: triage!.red_flags,
                      recommended_setting: triage!.recommended_setting,
                    }));
                    if (patientId) sessionStorage.setItem('handoff-patient-id', patientId);
                    setRole('clinician');
                    router.push('/case?from=interview');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Handoff failed');
                  } finally {
                    setIsHandingOff(false);
                  }
                }}
                disabled={isHandingOff}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-50"
              >
                {isHandingOff ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('intake.preparingClinician')}
                  </>
                ) : (
                  <>
                    <Stethoscope className="w-4 h-4" />
                    {t('intake.prepareClinician')}
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  clearActiveIntake();
                  setSessionId(null);
                  setMessages([]);
                  setTriage(null);
                  setCurrentPhase('greeting');
                  setError(null);
                  setConnecting(false);
                  setSaved(false);
                  setPatientId(null);
                  setDemographicsComplete(false);
                  setDemoFirstName('');
                  setDemoLastName('');
                  setDemoDob('');
                  setDemoSex('');
                  setShowReturningPatient(false);
                  setPatientSearchQuery('');
                }}
                className="px-4 py-2 text-sm font-medium border border-border rounded-xl hover:bg-muted transition-colors"
              >
                {t('intake.startNewIntake')}
              </button>
            </div>
          </div>
        </div>
      ) : connecting ? (
        /* Connecting to backend — waiting for cold start */
        <div className="flex flex-col items-center justify-center flex-1 gap-4 px-4 py-12">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <div className="text-center max-w-sm">
            <h2 className="text-lg font-semibold mb-1">{t('intake.connecting.title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('intake.connecting.message')}
            </p>
          </div>
        </div>
      ) : (
        /* Chat Interface */
        <div className="flex flex-col flex-1 min-h-0">
          {/* Emergency Banner */}
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{t('intake.emergencyBanner')}</span>
          </div>

          {/* Phase Progress */}
          <div className="px-4 py-2 border-b border-border">
            <div className="flex items-center gap-1 mb-1">
              {PHASES.map((phase, i) => (
                <div key={phase} className="flex items-center">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      i <= currentPhaseIndex ? 'bg-primary w-8' : 'bg-muted w-6'
                    }`}
                  />
                  {i < PHASES.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/30" />}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {t(PHASE_LABEL_KEYS[currentPhase] || currentPhase)}
              </p>
              <button
                onClick={completeInterview}
                disabled={isLoading || messages.length < 4}
                className="text-xs font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline"
              >
                {t('intake.completeSubmit')}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-4 mt-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-700 dark:text-red-300 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ms-2 p-0.5 hover:bg-red-500/10 rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Chat */}
          <div className="flex-1 min-h-0 min-w-0">
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
          </div>
        </div>
      )}
    </div>
  );
}
