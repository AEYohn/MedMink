'use client';

import { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Square,
  Play,
  Loader2,
  AlertCircle,
  Volume2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

interface DictationInputProps {
  onTranscriptChange: (transcript: string, isInterim: boolean) => void;
  onAudioReady?: (audioBlob: Blob) => void;
  disabled?: boolean;
}

export function DictationInput({
  onTranscriptChange,
  onAudioReady,
  disabled = false,
}: DictationInputProps) {
  const {
    transcript,
    interimTranscript,
    isListening,
    isSupported: webSpeechSupported,
    error: speechError,
    start: startSpeech,
    stop: stopSpeech,
    reset: resetSpeech,
  } = useSpeechRecognition();

  const {
    isRecording,
    audioBlob,
    audioDuration,
    error: recorderError,
    start: startRecording,
    stop: stopRecording,
    clear: clearRecording,
  } = useAudioRecorder();

  const [mode, setMode] = useState<'speech' | 'audio'>('speech');

  // Auto-select mode based on browser support
  useEffect(() => {
    if (!webSpeechSupported) {
      setMode('audio');
    }
  }, [webSpeechSupported]);

  // Notify parent of transcript changes
  useEffect(() => {
    const fullTranscript = transcript + interimTranscript;
    onTranscriptChange(fullTranscript, interimTranscript.length > 0);
  }, [transcript, interimTranscript, onTranscriptChange]);

  // Notify parent when audio is ready
  useEffect(() => {
    if (audioBlob && onAudioReady) {
      onAudioReady(audioBlob);
    }
  }, [audioBlob, onAudioReady]);

  const handleToggleSpeech = () => {
    if (isListening) {
      stopSpeech();
    } else {
      startSpeech();
    }
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const handleReset = () => {
    if (mode === 'speech') {
      resetSpeech();
    } else {
      clearRecording();
    }
    onTranscriptChange('', false);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const error = mode === 'speech' ? speechError : recorderError;
  const isActive = mode === 'speech' ? isListening : isRecording;

  return (
    <Card className={cn(
      'transition-all duration-300',
      isActive && 'ring-2 ring-red-500 shadow-lg shadow-red-500/20'
    )}>
      <CardContent className="pt-6">
        {/* Mode Selector (only show if web speech is supported) */}
        {webSpeechSupported && (
          <div className="flex items-center gap-2 mb-4">
            <Badge
              variant={mode === 'speech' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => {
                setMode('speech');
                clearRecording();
              }}
            >
              <Volume2 className="w-3 h-3 mr-1" />
              Live Transcription
            </Badge>
            <Badge
              variant={mode === 'audio' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => {
                setMode('audio');
                resetSpeech();
              }}
            >
              <Upload className="w-3 h-3 mr-1" />
              Record Audio
            </Badge>
          </div>
        )}

        {/* Browser Not Supported Warning */}
        {!webSpeechSupported && mode === 'audio' && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Web Speech API not supported in this browser. Using audio recording instead.
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 rounded-lg border border-red-500/30">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex items-center justify-center gap-4">
          {mode === 'speech' ? (
            <>
              <Button
                size="lg"
                variant={isListening ? 'destructive' : 'default'}
                onClick={handleToggleSpeech}
                disabled={disabled}
                className="w-16 h-16 rounded-full"
              >
                {isListening ? (
                  <MicOff className="w-8 h-8" />
                ) : (
                  <Mic className="w-8 h-8" />
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="lg"
                variant={isRecording ? 'destructive' : 'default'}
                onClick={handleToggleRecording}
                disabled={disabled}
                className="w-16 h-16 rounded-full"
              >
                {isRecording ? (
                  <Square className="w-6 h-6" />
                ) : (
                  <Mic className="w-8 h-8" />
                )}
              </Button>
            </>
          )}

          {/* Reset Button */}
          <Button
            size="icon"
            variant="outline"
            onClick={handleReset}
            disabled={disabled || (!transcript && !audioBlob)}
            className="rounded-full"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </Button>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center justify-center mt-4 gap-2">
          {isActive && (
            <>
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-sm font-medium text-red-600 dark:text-red-400">
                {mode === 'speech' ? 'Listening...' : `Recording ${formatDuration(audioDuration)}`}
              </span>
            </>
          )}
          {!isActive && transcript && mode === 'speech' && (
            <span className="text-sm text-muted-foreground">
              {transcript.split(/\s+/).length} words captured
            </span>
          )}
          {!isActive && audioBlob && mode === 'audio' && (
            <span className="text-sm text-muted-foreground">
              Audio ready ({formatDuration(audioDuration)}) - Click "Enhance" to process
            </span>
          )}
          {!isActive && !transcript && !audioBlob && (
            <span className="text-sm text-muted-foreground">
              {mode === 'speech'
                ? 'Click the microphone to start dictating'
                : 'Click to start recording'}
            </span>
          )}
        </div>

        {/* Interim Transcript Preview (speech mode only) */}
        {mode === 'speech' && interimTranscript && (
          <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground italic">
              {interimTranscript}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
