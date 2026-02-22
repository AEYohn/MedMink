'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n';
import {
  Mic,
  Square,
  Play,
  Sparkles,
  Loader2,
  FileText,
  Clock,
  Trash2,
  ChevronDown,
  Lightbulb,
  Stethoscope,
  ClipboardList,
  HelpCircle,
  BookmarkCheck,
} from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import type { PatientSOAPNotes, ScribeSession } from '@/types/patient-scribe';

const EXAMPLE_TRANSCRIPT = `Doctor said my chest pain started three days ago, it's been feeling like pressure in the center of my chest, especially when I walk up stairs. I also mentioned I've been feeling more short of breath lately, and my ankles have been a bit swollen. The doctor checked my blood pressure which was 148 over 92, and listened to my heart and lungs. They said my heart sounds were normal but they heard some crackles at the base of my lungs. They ordered an EKG and blood work including troponin and BNP levels. The doctor thinks this could be related to my heart condition and wants to adjust my medications. They're increasing my Lisinopril from 10 to 20 mg and adding a water pill called Furosemide 20 mg once daily. I need to come back in one week and go to the lab in 3 days for repeat blood work. The doctor said I should weigh myself every morning and call the office if I gain more than 3 pounds in a day or if my chest pain gets worse.`;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Simple localStorage helpers for scribe sessions
const SCRIBE_KEY = 'research-synthesizer:scribe-sessions';

function listScribeSessions(): ScribeSession[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(SCRIBE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveScribeSession(session: ScribeSession): void {
  const sessions = listScribeSessions();
  sessions.unshift(session);
  localStorage.setItem(SCRIBE_KEY, JSON.stringify(sessions.slice(0, 20)));
}

function deleteScribeSession(id: string): void {
  const sessions = listScribeSessions().filter(s => s.id !== id);
  localStorage.setItem(SCRIBE_KEY, JSON.stringify(sessions));
}

function NoteCard({
  icon: Icon,
  title,
  color,
  content,
}: {
  icon: React.ElementType;
  title: string;
  color: string;
  content: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{content}</p>
    </div>
  );
}

export function CareHubScribe() {
  const { t } = useTranslation();
  const { transcript, interimTranscript, isListening, isSupported, start, stop } =
    useSpeechRecognition();

  const [phase, setPhase] = useState<'idle' | 'recording' | 'review'>('idle');
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [enhancedNotes, setEnhancedNotes] = useState<PatientSOAPNotes | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [sessions, setSessions] = useState<ScribeSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const recordingStartRef = useRef<number>(0);

  useEffect(() => {
    setSessions(listScribeSessions());
  }, []);

  useEffect(() => {
    if (phase !== 'recording') return;
    recordingStartRef.current = Date.now() - recordingTime * 1000;
    const interval = setInterval(() => {
      setRecordingTime(Math.floor((Date.now() - recordingStartRef.current) / 1000));
    }, 250);
    function onVisible() {
      if (document.visibilityState === 'visible') {
        setRecordingTime(Math.floor((Date.now() - recordingStartRef.current) / 1000));
      }
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (transcript) {
      setCurrentTranscript(prev => (prev ? prev + ' ' + transcript : transcript));
    }
  }, [transcript]);

  const startRecording = useCallback(() => {
    setPhase('recording');
    setRecordingTime(0);
    setCurrentTranscript('');
    setEnhancedNotes(null);
    setEnhanceError(null);
    if (isSupported) start();
  }, [isSupported, start]);

  const stopRecording = useCallback(() => {
    if (isListening) stop();
    setPhase('review');
  }, [isListening, stop]);

  const tryExample = useCallback(() => {
    setCurrentTranscript(EXAMPLE_TRANSCRIPT);
    setPhase('review');
    setRecordingTime(187);
    setEnhancedNotes(null);
  }, []);

  const enhance = useCallback(async () => {
    setIsEnhancing(true);
    setEnhanceError(null);
    let notes: PatientSOAPNotes | null = null;

    try {
      const resp = await fetch('/api/chart/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dictation_text: currentTranscript }),
      });

      if (!resp.ok) throw new Error('Enhance request failed');

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'result' && event.data?.soap) {
              const soap = event.data.soap;
              notes = {
                whatIToldTheDoctor: soap.subjective || soap.Subjective || '',
                whatTheDoctorFound: soap.objective || soap.Objective || '',
                myDiagnosis: soap.assessment || soap.Assessment || '',
                myTreatmentPlan: soap.plan || soap.Plan || '',
                questionsIHad: soap.questions || [],
                thingsToRemember: soap.reminders || soap.key_points || [],
              };
            }
          } catch { /* skip parse errors */ }
        }
      }
    } catch {
      setEnhanceError('Unable to enhance your notes right now. Please try again later.');
      setIsEnhancing(false);
      return;
    }

    if (!notes) {
      setEnhanceError('No notes were generated. Please try again.');
      setIsEnhancing(false);
      return;
    }

    setEnhancedNotes(notes);
    setIsEnhancing(false);
    const session: ScribeSession = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      transcript: currentTranscript,
      enhancedNotes: notes,
      duration: recordingTime,
      title: `Visit on ${new Date().toLocaleDateString()}`,
    };
    saveScribeSession(session);
    setSessions(listScribeSessions());
  }, [currentTranscript, recordingTime]);

  const reset = useCallback(() => {
    setPhase('idle');
    setCurrentTranscript('');
    setEnhancedNotes(null);
    setEnhanceError(null);
    setRecordingTime(0);
  }, []);

  const handleDeleteSession = useCallback((id: string) => {
    deleteScribeSession(id);
    setSessions(listScribeSessions());
  }, []);

  return (
    <div className="space-y-5">
      {/* Idle */}
      {phase === 'idle' && (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-6">
            <Mic className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {t('scribe.recordVisit')}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-8">
            {t('scribe.recordDesc')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={startRecording}
              disabled={!isSupported}
              className="px-8 py-3 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-2xl font-medium transition-colors flex items-center gap-2"
            >
              <Mic className="w-5 h-5" />
              {t('scribe.startRecording')}
            </button>
            <button
              onClick={tryExample}
              className="px-6 py-3 border border-border hover:bg-muted rounded-2xl text-sm font-medium text-muted-foreground transition-colors flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              {t('scribe.tryExample')}
            </button>
          </div>
          {!isSupported && (
            <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
              {t('scribe.browserNotSupported')}
            </p>
          )}
        </div>
      )}

      {/* Recording */}
      {phase === 'recording' && (
        <div className="text-center space-y-6">
          <div className="mx-auto w-24 h-24 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center animate-pulse">
            <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
              <Mic className="w-8 h-8 text-white" />
            </div>
          </div>
          <div>
            <p className="text-lg font-semibold text-red-600 dark:text-red-400">{t('scribe.recording')}</p>
            <p className="text-2xl font-mono text-foreground mt-1">{formatDuration(recordingTime)}</p>
          </div>
          <div className="max-w-2xl mx-auto rounded-2xl border border-border bg-card p-4 text-left min-h-[120px]">
            <p className="text-xs font-medium text-muted-foreground mb-2">{t('scribe.liveTranscript')}</p>
            <p className="text-sm text-muted-foreground">
              {currentTranscript || <span className="text-muted-foreground italic">{t('scribe.listening')}</span>}
              {interimTranscript && <span className="text-muted-foreground italic"> {interimTranscript}</span>}
            </p>
          </div>
          <button
            onClick={stopRecording}
            className="px-8 py-3 bg-foreground text-background rounded-2xl font-medium transition-colors flex items-center gap-2 mx-auto hover:bg-foreground/80"
          >
            <Square className="w-4 h-4" />
            {t('scribe.stopRecording')}
          </button>
        </div>
      )}

      {/* Review */}
      {phase === 'review' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">{t('scribe.yourRecording')}</h3>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                {formatDuration(recordingTime)}
              </div>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{currentTranscript}</p>
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
              {!enhancedNotes && (
                <button
                  onClick={enhance}
                  disabled={isEnhancing || !currentTranscript}
                  className="px-5 py-2.5 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-2xl text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {isEnhancing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('scribe.creatingNotes')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {t('scribe.enhanceAI')}
                    </>
                  )}
                </button>
              )}
              <button
                onClick={reset}
                className="px-4 py-2.5 border border-border text-muted-foreground hover:bg-muted rounded-2xl text-sm font-medium transition-colors"
              >
                {t('scribe.newRecording')}
              </button>
            </div>

            {enhanceError && (
              <div className="mt-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                {enhanceError}
              </div>
            )}
          </div>

          {enhancedNotes && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                {t('scribe.visitNotes')}
              </h2>
              <NoteCard icon={Lightbulb} title={t('scribe.whatITold')} color="bg-blue-500" content={enhancedNotes.whatIToldTheDoctor} />
              <NoteCard icon={Stethoscope} title={t('scribe.whatDoctorFound')} color="bg-teal-500" content={enhancedNotes.whatTheDoctorFound} />
              <NoteCard icon={ClipboardList} title={t('scribe.myDiagnosis')} color="bg-amber-500" content={enhancedNotes.myDiagnosis} />
              <NoteCard icon={FileText} title={t('scribe.myTreatmentPlan')} color="bg-emerald-500" content={enhancedNotes.myTreatmentPlan} />

              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-purple-500">
                    <HelpCircle className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-foreground">{t('scribe.questionsIHad')}</h3>
                </div>
                <ul className="space-y-2">
                  {enhancedNotes.questionsIHad.map((q, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-purple-500 mt-0.5">?</span>
                      {q}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-destructive">
                    <BookmarkCheck className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-destructive">{t('scribe.thingsToRemember')}</h3>
                </div>
                <ul className="space-y-2">
                  {enhancedNotes.thingsToRemember.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-destructive">
                      <span className="text-destructive/70 mt-0.5">&bull;</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Past Sessions */}
      {sessions.length > 0 && (
        <div className="border-t border-border pt-5">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            {t('scribe.pastRecordings', { count: sessions.length })}
          </button>
          {showHistory && (
            <div className="mt-3 space-y-2">
              {sessions.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-2xl border border-border bg-card">
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDuration(s.duration)} &middot; {new Date(s.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button onClick={() => handleDeleteSession(s.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
