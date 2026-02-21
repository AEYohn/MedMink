'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Mic,
  Square,
  Loader2,
  X,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { getApiUrl } from '@/lib/api-url';

interface DictationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscript: (text: string) => void;
}

export function DictationModal({ isOpen, onClose, onTranscript }: DictationModalProps) {
  const [transcript, setTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    isRecording,
    audioBlob,
    audioDuration,
    error: recorderError,
    start: startRecording,
    stop: stopRecording,
    clear: clearRecording,
  } = useAudioRecorder();

  // When recording stops and we have audio, send to backend for transcription
  useEffect(() => {
    if (!audioBlob || isRecording) return;

    let cancelled = false;

    const blob = audioBlob;

    async function transcribe() {
      setIsTranscribing(true);
      setError(null);

      try {
        const apiUrl = getApiUrl() || '';
        const formData = new FormData();
        formData.append('audio', blob, 'recording.webm');

        const res = await fetch(`${apiUrl}/api/chart/transcribe`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(body || `Server error: ${res.status}`);
        }

        const data = await res.json();
        if (!cancelled) {
          setTranscript(data.text || '');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Transcription failed:', err);
          setError(err instanceof Error ? err.message : 'Transcription failed');
        }
      } finally {
        if (!cancelled) {
          setIsTranscribing(false);
        }
      }
    }

    transcribe();
    return () => { cancelled = true; };
  }, [audioBlob, isRecording]);

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
    } else {
      setTranscript('');
      setError(null);
      await startRecording();
    }
  }, [isRecording, stopRecording, startRecording]);

  const handleAccept = useCallback(() => {
    const finalText = transcript.trim();
    if (finalText) {
      onTranscript(finalText);
    }
    setTranscript('');
    clearRecording();
    onClose();
  }, [transcript, onTranscript, onClose, clearRecording]);

  const handleCancel = useCallback(() => {
    stopRecording();
    clearRecording();
    setTranscript('');
    setError(null);
    onClose();
  }, [stopRecording, clearRecording, onClose]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const displayError = error || recorderError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-lg mx-4 shadow-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="w-5 h-5 text-primary" />
              <CardTitle>Dictate Clinical Case</CardTitle>
            </div>
            <button onClick={handleCancel} className="p-1 hover:bg-muted rounded-lg transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-center gap-3">
            {isRecording ? (
              <Badge variant="outline" className="gap-1.5 bg-red-500/10 text-red-500 border-red-500/30 animate-pulse">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                Recording {formatDuration(audioDuration)}
              </Badge>
            ) : isTranscribing ? (
              <Badge variant="outline" className="gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Transcribing...
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1.5">
                <Mic className="w-3 h-3" />
                Ready
              </Badge>
            )}
          </div>

          {/* Transcript Display */}
          <div className="min-h-[150px] max-h-[300px] overflow-y-auto p-4 bg-muted/50 rounded-lg border text-sm">
            {transcript ? (
              <span>{transcript}</span>
            ) : isTranscribing ? (
              <div className="flex items-center justify-center mt-8 gap-2 text-muted-foreground/60">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing audio...
              </div>
            ) : (
              <p className="text-muted-foreground/50 text-center mt-8">
                {isRecording
                  ? 'Speak your clinical case...'
                  : 'Press the button below to start recording'
                }
              </p>
            )}
          </div>

          {/* Error */}
          {displayError && (
            <p className="text-sm text-destructive text-center">{displayError}</p>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between gap-3">
            <Button
              variant={isRecording ? 'destructive' : 'default'}
              size="lg"
              onClick={handleToggleRecording}
              disabled={isTranscribing}
              className="flex-1"
            >
              {isRecording ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  {transcript ? 'Record Again' : 'Start Recording'}
                </>
              )}
            </Button>
            {transcript.trim() && !isRecording && !isTranscribing && (
              <Button variant="outline" size="lg" onClick={handleAccept}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Use Transcript
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Records audio and transcribes using MedASR
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
