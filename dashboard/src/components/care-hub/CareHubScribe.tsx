'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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

const MOCK_ENHANCED_NOTES: PatientSOAPNotes = {
  whatIToldTheDoctor:
    'I told the doctor about chest pressure that started 3 days ago, especially when climbing stairs. I mentioned feeling more short of breath than usual and noticing that my ankles have been swollen.',
  whatTheDoctorFound:
    'Blood pressure was 148/92 (a bit high). Heart sounds were normal. The doctor heard some crackles at the base of my lungs when listening with the stethoscope, which can indicate fluid. An EKG and blood tests (troponin and BNP) were ordered.',
  myDiagnosis:
    'The doctor thinks my symptoms are likely related to my existing heart condition. The fluid in my lungs and swollen ankles suggest my heart may not be pumping as efficiently as it should. The blood tests will help confirm this.',
  myTreatmentPlan:
    'My Lisinopril (blood pressure/heart medication) is being increased from 10 mg to 20 mg daily. A new medication called Furosemide (a "water pill") 20 mg once daily is being added to help reduce the fluid buildup. I need lab work in 3 days and a follow-up visit in 1 week.',
  questionsIHad: [
    'Should I be worried about the fluid in my lungs?',
    'Can I still do my cardiac rehab exercises?',
    'What side effects should I watch for with the new water pill?',
  ],
  thingsToRemember: [
    'Weigh myself every morning at the same time',
    'Call the office if I gain more than 3 pounds in one day',
    'Call the office or go to the ER if chest pain gets worse',
    'New medication: Furosemide 20 mg \u2014 take in the morning (may cause more frequent urination)',
    'Increased Lisinopril from 10 mg to 20 mg',
    'Lab work in 3 days, follow-up visit in 1 week',
  ],
};

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
    <div className="rounded-2xl border border-rose-100 dark:border-surface-700 bg-white dark:bg-surface-800 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <h3 className="font-semibold text-surface-900 dark:text-white">{title}</h3>
      </div>
      <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">{content}</p>
    </div>
  );
}

export function CareHubScribe() {
  const { transcript, interimTranscript, isListening, isSupported, start, stop } =
    useSpeechRecognition();

  const [phase, setPhase] = useState<'idle' | 'recording' | 'review'>('idle');
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [enhancedNotes, setEnhancedNotes] = useState<PatientSOAPNotes | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
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
    await new Promise(r => setTimeout(r, 2000));
    setEnhancedNotes(MOCK_ENHANCED_NOTES);
    setIsEnhancing(false);
    const session: ScribeSession = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      transcript: currentTranscript,
      enhancedNotes: MOCK_ENHANCED_NOTES,
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
          <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-rose-100 to-orange-100 dark:from-rose-900/30 dark:to-orange-900/30 flex items-center justify-center mb-6">
            <Mic className="w-10 h-10 text-rose-500" />
          </div>
          <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-2">
            Record Your Visit
          </h2>
          <p className="text-surface-500 dark:text-surface-400 max-w-md mx-auto mb-8">
            Tap the button below to start recording during your doctor visit. We&apos;ll turn the conversation into easy-to-understand notes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={startRecording}
              disabled={!isSupported}
              className="px-8 py-3 bg-rose-500 hover:bg-rose-600 disabled:bg-surface-300 text-white rounded-2xl font-medium transition-colors flex items-center gap-2"
            >
              <Mic className="w-5 h-5" />
              Start Recording
            </button>
            <button
              onClick={tryExample}
              className="px-6 py-3 border border-rose-100 dark:border-surface-700 hover:bg-rose-50 dark:hover:bg-surface-800 rounded-2xl text-sm font-medium text-surface-700 dark:text-surface-300 transition-colors flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Try an Example
            </button>
          </div>
          {!isSupported && (
            <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
              Speech recognition is not supported in your browser. Try Chrome or Edge.
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
            <p className="text-lg font-semibold text-red-600 dark:text-red-400">Recording...</p>
            <p className="text-2xl font-mono text-surface-900 dark:text-white mt-1">{formatDuration(recordingTime)}</p>
          </div>
          <div className="max-w-2xl mx-auto rounded-2xl border border-rose-100 dark:border-surface-700 bg-white dark:bg-surface-800 p-4 text-left min-h-[120px]">
            <p className="text-xs font-medium text-surface-500 dark:text-surface-400 mb-2">Live Transcript</p>
            <p className="text-sm text-surface-700 dark:text-surface-300">
              {currentTranscript || <span className="text-surface-400 italic">Listening...</span>}
              {interimTranscript && <span className="text-surface-400 italic"> {interimTranscript}</span>}
            </p>
          </div>
          <button
            onClick={stopRecording}
            className="px-8 py-3 bg-surface-800 dark:bg-surface-200 text-white dark:text-surface-900 rounded-2xl font-medium transition-colors flex items-center gap-2 mx-auto hover:bg-surface-700 dark:hover:bg-surface-300"
          >
            <Square className="w-4 h-4" />
            Stop Recording
          </button>
        </div>
      )}

      {/* Review */}
      {phase === 'review' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-rose-100 dark:border-surface-700 bg-white dark:bg-surface-800 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-surface-500" />
                <h3 className="font-semibold text-surface-900 dark:text-white">Your Recording</h3>
              </div>
              <div className="flex items-center gap-2 text-xs text-surface-500">
                <Clock className="w-3.5 h-3.5" />
                {formatDuration(recordingTime)}
              </div>
            </div>
            <p className="text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap leading-relaxed">{currentTranscript}</p>
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-surface-100 dark:border-surface-700">
              {!enhancedNotes && (
                <button
                  onClick={enhance}
                  disabled={isEnhancing || !currentTranscript}
                  className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:bg-surface-300 dark:disabled:bg-surface-700 text-white rounded-2xl text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {isEnhancing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating your notes...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Enhance with AI
                    </>
                  )}
                </button>
              )}
              <button
                onClick={reset}
                className="px-4 py-2.5 border border-rose-100 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-rose-50 dark:hover:bg-surface-700 rounded-2xl text-sm font-medium transition-colors"
              >
                New Recording
              </button>
            </div>
          </div>

          {enhancedNotes && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-rose-500" />
                Your Visit Notes
              </h2>
              <NoteCard icon={Lightbulb} title="What I Told the Doctor" color="bg-blue-500" content={enhancedNotes.whatIToldTheDoctor} />
              <NoteCard icon={Stethoscope} title="What the Doctor Found" color="bg-teal-500" content={enhancedNotes.whatTheDoctorFound} />
              <NoteCard icon={ClipboardList} title="My Diagnosis" color="bg-amber-500" content={enhancedNotes.myDiagnosis} />
              <NoteCard icon={FileText} title="My Treatment Plan" color="bg-emerald-500" content={enhancedNotes.myTreatmentPlan} />

              <div className="rounded-2xl border border-rose-100 dark:border-surface-700 bg-white dark:bg-surface-800 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-purple-500">
                    <HelpCircle className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-surface-900 dark:text-white">Questions I Had</h3>
                </div>
                <ul className="space-y-2">
                  {enhancedNotes.questionsIHad.map((q, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-surface-700 dark:text-surface-300">
                      <span className="text-purple-500 mt-0.5">?</span>
                      {q}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-rose-500">
                    <BookmarkCheck className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-rose-800 dark:text-rose-300">Things to Remember</h3>
                </div>
                <ul className="space-y-2">
                  {enhancedNotes.thingsToRemember.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-rose-800 dark:text-rose-300">
                      <span className="text-rose-500 mt-0.5">&bull;</span>
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
        <div className="border-t border-rose-100 dark:border-surface-700 pt-5">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm font-medium text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            Past Recordings ({sessions.length})
          </button>
          {showHistory && (
            <div className="mt-3 space-y-2">
              {sessions.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-2xl border border-rose-100 dark:border-surface-700 bg-white dark:bg-surface-800">
                  <div>
                    <p className="text-sm font-medium text-surface-900 dark:text-white">{s.title}</p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      {formatDuration(s.duration)} &middot; {new Date(s.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button onClick={() => handleDeleteSession(s.id)} className="p-2 text-surface-400 hover:text-red-500 transition-colors">
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
