'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Loader2,
  X,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DictationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscript: (text: string) => void;
}

export function DictationModal({ isOpen, onClose, onTranscript }: DictationModalProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Check browser support
  const isSupported = typeof window !== 'undefined' && (
    'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  );

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition not supported in this browser. Use Chrome for best results.');
      return;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }

        if (final) {
          setTranscript(prev => prev + ' ' + final);
        }
        setInterimTranscript(interim);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setError(`Error: ${event.error}`);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
      setError(null);
    } catch (err) {
      setError('Failed to start speech recognition');
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const handleAccept = useCallback(() => {
    const finalText = transcript.trim();
    if (finalText) {
      onTranscript(finalText);
    }
    setTranscript('');
    setInterimTranscript('');
    onClose();
  }, [transcript, onTranscript, onClose]);

  const handleCancel = useCallback(() => {
    stopListening();
    setTranscript('');
    setInterimTranscript('');
    onClose();
  }, [stopListening, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  if (!isOpen) return null;

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
            {isListening ? (
              <Badge variant="outline" className="gap-1.5 bg-red-500/10 text-red-500 border-red-500/30 animate-pulse">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                Recording...
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1.5">
                <MicOff className="w-3 h-3" />
                Ready
              </Badge>
            )}
            {!isSupported && (
              <Badge variant="destructive" className="text-xs">
                Not Supported
              </Badge>
            )}
          </div>

          {/* Transcript Display */}
          <div className="min-h-[150px] max-h-[300px] overflow-y-auto p-4 bg-muted/50 rounded-lg border text-sm">
            {transcript || interimTranscript ? (
              <>
                <span>{transcript}</span>
                {interimTranscript && (
                  <span className="text-muted-foreground/60 italic"> {interimTranscript}</span>
                )}
              </>
            ) : (
              <p className="text-muted-foreground/50 text-center mt-8">
                {isListening
                  ? 'Speak your clinical case...'
                  : 'Press the microphone button to start dictating'
                }
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between gap-3">
            <Button
              variant={isListening ? 'destructive' : 'default'}
              size="lg"
              onClick={isListening ? stopListening : startListening}
              disabled={!isSupported}
              className="flex-1"
            >
              {isListening ? (
                <>
                  <MicOff className="w-4 h-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Start Dictation
                </>
              )}
            </Button>
            {transcript.trim() && (
              <Button variant="outline" size="lg" onClick={handleAccept}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Use Transcript
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Uses browser Web Speech API &bull; Works best in Chrome
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
