'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Phone, Loader2, ChevronRight, AlertTriangle, X, CheckCircle2, Stethoscope } from 'lucide-react';
import { InterviewChat } from '@/components/interview/InterviewChat';
import { TriageResult } from '@/components/interview/TriageResult';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { getApiUrl } from '@/lib/api-url';
import { saveIntakeResult } from '@/lib/storage';
import { mockStartInterview, mockRespond, mockComplete } from '@/lib/mock-interview';
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

export function CareHubIntake() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string>('greeting');
  const [isLoading, setIsLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [triage, setTriage] = useState<TriageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState('en');
  const [mockMode, setMockMode] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isHandingOff, setIsHandingOff] = useState(false);

  const { isRecording, audioBlob, audioDuration, start: startRecording, stop: stopRecording, clear: clearRecording } = useAudioRecorder();
  const pendingSendRef = useRef(false);

  const startInterview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/interview/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      }, 10000);
      if (!res.ok) throw new Error(`Failed to start: ${res.status}`);
      const data = await res.json();
      setSessionId(data.session_id);
      setCurrentPhase(data.phase);
      const greeting = data.question?.trim() || FALLBACK_GREETING[language] || FALLBACK_GREETING.en;
      setMessages([{ role: 'assistant', content: greeting }]);
    } catch {
      setMockMode(true);
      const data = mockStartInterview(language);
      setSessionId(data.session_id);
      setCurrentPhase(data.phase);
      const greeting = data.question?.trim() || FALLBACK_GREETING[language] || FALLBACK_GREETING.en;
      setMessages([{ role: 'assistant', content: greeting }]);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, [language]);

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
  }, [sessionId, messages, currentPhase, mockMode]);

  // Save triage result when complete
  useEffect(() => {
    if (triage && sessionId && !saved) {
      setSaved(true);
      saveIntakeResult({
        id: `intake-${Date.now()}`,
        patientId: null,
        sessionId,
        completedAt: new Date().toISOString(),
        triageData: triage,
        conversationSummary: triage.chief_complaint || 'Patient intake completed',
        source: 'patient-intake',
      });
    }
  }, [triage, sessionId, saved]);

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
            language,
          }),
        }, 60000);
        if (!res.ok) throw new Error(`Response failed: ${res.status}`);
        const data = await res.json();
        setCurrentPhase(data.phase);
        const aiResponse = data.question?.trim() || "I understand. Can you tell me more?";
        setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
        if (data.phase === 'review_and_triage' || data.phase === 'complete') {
          await completeInterview();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process response');
    } finally {
      setIsLoading(false);
    }
  }, [inputText, sessionId, isLoading, messages, currentPhase, language, mockMode, completeInterview]);

  const handleStopRecording = useCallback(() => {
    stopRecording();
    pendingSendRef.current = true;
  }, [stopRecording]);

  const sendAudio = useCallback(async () => {
    if (!sessionId || !audioBlob) return;
    if (mockMode) {
      clearRecording();
      setError('Voice input requires the backend. Please type your response instead.');
      return;
    }

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
        if (idx >= 0) updated[idx] = { role: 'user', content: transcript || '(audio)', transcript };
        return updated;
      });

      const aiResponse = data.question?.trim() || "I understand. Can you tell me more?";
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
      setCurrentPhase(data.phase);
      if (data.phase === 'review_and_triage' || data.phase === 'complete') {
        await completeInterview();
      }
      clearRecording();
    } catch (err) {
      setMessages(prev => {
        const lastUserIdx = prev.findLastIndex(m => m.content === '(audio recording...)');
        if (lastUserIdx >= 0) return prev.filter((_, i) => i !== lastUserIdx);
        return prev;
      });
      clearRecording();
      setError(err instanceof Error ? err.message : 'Failed to process audio');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, audioBlob, clearRecording, messages, currentPhase, language, mockMode, completeInterview]);

  useEffect(() => {
    if (pendingSendRef.current && audioBlob) {
      pendingSendRef.current = false;
      sendAudio();
    }
  }, [audioBlob, sendAudio]);

  const currentPhaseIndex = PHASES.indexOf(currentPhase);

  return (
    <div className="flex flex-col h-full min-h-[60vh]">
      {!sessionId ? (
        /* Start Screen */
        <div className="flex flex-col items-center justify-center flex-1 gap-6 px-4 py-10">
          <div className="text-center max-w-md">
            <div className="p-4 bg-primary/10 rounded-2xl w-fit mx-auto mb-4">
              <Phone className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Patient Intake</h2>
            <p className="text-sm text-muted-foreground">
              Complete your medical intake before your visit. An AI assistant will
              guide you through a structured interview to collect your symptoms,
              history, and relevant information.
            </p>
          </div>

          {/* Emergency Warning */}
          <div className="max-w-md p-4 rounded-xl border-2 border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800 dark:text-red-300">
                <p className="font-semibold mb-1">Emergency Warning</p>
                <p>
                  If you are experiencing a life-threatening emergency — such as chest pain,
                  difficulty breathing, severe bleeding, or loss of consciousness —{' '}
                  <strong>call 911 (or your local emergency number) immediately</strong>.
                  Do not rely on this tool for emergency care.
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
          </div>

          {/* Language Selector */}
          <div className="flex flex-col items-center gap-1.5">
            <label htmlFor="intake-language" className="text-sm font-medium text-muted-foreground">
              Language
            </label>
            <select
              id="intake-language"
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
            Start Intake
          </button>
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
                    Intake Complete
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Your intake has been shared with your care team. They will review it before your visit.
                  </p>
                </div>
              </div>
            </div>

            <h2 className="text-lg font-semibold">Your Assessment Summary</h2>
            <TriageResult triage={triage} />

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={async () => {
                  if (!sessionId || isHandingOff) return;
                  setIsHandingOff(true);
                  try {
                    const res = await fetchWithTimeout(`${API_URL}/api/interview/${sessionId}/handoff`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        conversation_history: messages.map(m => ({ role: m.role, content: m.content })),
                        phase: currentPhase,
                      }),
                    }, 30000);
                    if (!res.ok) throw new Error(`Handoff failed: ${res.status}`);
                    const data = await res.json();
                    // Store vignette in sessionStorage for the case page to pick up
                    sessionStorage.setItem('handoff-vignette', data.vignette);
                    if (data.management_plan) {
                      sessionStorage.setItem('handoff-management-plan', JSON.stringify(data.management_plan));
                    }
                    if (data.recommended_imaging?.length) {
                      sessionStorage.setItem('handoff-imaging', JSON.stringify(data.recommended_imaging));
                    }
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
                    Preparing Clinician Workspace...
                  </>
                ) : (
                  <>
                    <Stethoscope className="w-4 h-4" />
                    Prepare Case for Clinician
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setSessionId(null);
                  setMessages([]);
                  setTriage(null);
                  setCurrentPhase('greeting');
                  setError(null);
                  setMockMode(false);
                  setSaved(false);
                }}
                className="px-4 py-2 text-sm font-medium border border-border rounded-xl hover:bg-muted transition-colors"
              >
                Start New Intake
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Chat Interface */
        <div className="flex flex-col flex-1 min-h-0">
          {/* Emergency Banner */}
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>If this is a medical emergency, <strong>call 911</strong> immediately.</span>
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
                {PHASE_LABELS[currentPhase] || currentPhase}
              </p>
              <button
                onClick={completeInterview}
                disabled={isLoading || messages.length < 4}
                className="text-xs font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline"
              >
                Complete & Submit
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-4 mt-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-700 dark:text-red-300 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-2 p-0.5 hover:bg-red-500/10 rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Chat */}
          <div className="flex-1 min-h-0">
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
