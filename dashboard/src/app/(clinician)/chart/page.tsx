'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Mic,
  ArrowLeft,
  Sparkles,
  Loader2,
  AlertTriangle,
  FileText,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DictationInput } from '@/components/charting/DictationInput';
import { TranscriptDisplay } from '@/components/charting/TranscriptDisplay';
import { SOAPEditor, SOAPData } from '@/components/charting/SOAPEditor';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { PatientBanner } from '@/components/shared/PatientBanner';
import { usePatientFromUrl } from '@/hooks/usePatientFromUrl';
import { getApiUrl } from '@/lib/api-url';

interface Correction {
  original: string;
  corrected: string;
}

interface SSEEvent {
  type: 'step' | 'transcript' | 'result' | 'error' | 'done';
  step?: string;
  message?: string;
  data?: {
    corrections?: Correction[];
    soap?: SOAPData;
    text?: string;
    duration?: number;
    raw_response?: string;
  };
}

export default function ChartingPage() {
  usePatientFromUrl();
  const [transcript, setTranscript] = useState('');
  const [isInterim, setIsInterim] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [soapData, setSoapData] = useState<SOAPData | null>(null);
  const [processingMode, setProcessingMode] = useState<'text' | 'audio'>('text');

  const handleTranscriptChange = useCallback((newTranscript: string, interim: boolean) => {
    setTranscript(newTranscript);
    setIsInterim(interim);
  }, []);

  const handleAudioReady = useCallback((blob: Blob) => {
    setAudioBlob(blob);
    setProcessingMode('audio');
  }, []);

  const handleEnhance = async () => {
    if (!transcript.trim() && !audioBlob) return;

    setIsProcessing(true);
    setError(null);
    setProcessingProgress(0);
    setProcessingStep(null);
    setCorrections([]);
    setSoapData(null);

    try {
      const apiUrl = getApiUrl();
      if (!apiUrl) return;
      let response: Response;

      if (audioBlob && processingMode === 'audio') {
        // Audio upload path
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        response = await fetch(`${apiUrl}/api/chart/transcribe-and-structure`, {
          method: 'POST',
          body: formData,
        });
      } else {
        // Text enhancement path
        response = await fetch(`${apiUrl}/api/chart/enhance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dictation_text: transcript.trim() }),
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to process dictation');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as SSEEvent;

              if (data.type === 'step') {
                setProcessingStep(data.message || data.step || 'Processing...');
                // Estimate progress based on step
                if (data.step === 'transcribing') setProcessingProgress(25);
                else if (data.step === 'processing') setProcessingProgress(40);
                else if (data.step === 'structuring') setProcessingProgress(70);
              } else if (data.type === 'transcript' && data.data) {
                // Update transcript from audio processing
                if (data.data.text) {
                  setTranscript(data.data.text);
                  setProcessingMode('text'); // Switch to text mode after transcription
                }
              } else if (data.type === 'result' && data.data) {
                setProcessingProgress(100);
                if (data.data.corrections) {
                  setCorrections(data.data.corrections);
                }
                if (data.data.soap) {
                  setSoapData(data.data.soap);
                }
              } else if (data.type === 'error') {
                throw new Error(data.message || 'Processing failed');
              }
            } catch (parseError) {
              console.error('SSE parse error:', parseError);
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTranscriptEdit = (newTranscript: string) => {
    setTranscript(newTranscript);
    // Clear SOAP data when transcript is edited
    // setSoapData(null);
  };

  const canEnhance =
    (transcript.trim().length > 10 || audioBlob) && !isProcessing && !isInterim;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Mic className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Clinical Charting</h1>
              <p className="text-muted-foreground">
                Voice-dictated SOAP notes with AI-powered structuring
              </p>
            </div>
          </div>
        </header>

        <PatientBanner className="mb-4" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Input */}
          <div className="space-y-6">
            {/* Dictation Input */}
            <DictationInput
              onTranscriptChange={handleTranscriptChange}
              onAudioReady={handleAudioReady}
              disabled={isProcessing}
            />

            {/* Transcript Display */}
            <TranscriptDisplay
              transcript={transcript}
              isInterim={isInterim}
              corrections={corrections}
              onTranscriptEdit={handleTranscriptEdit}
              readOnly={isProcessing}
            />

            {/* Enhance Button */}
            <Button
              size="lg"
              onClick={handleEnhance}
              disabled={!canEnhance}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Enhance with MedGemma
                </>
              )}
            </Button>

            {/* Processing Status */}
            {isProcessing && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="font-medium">{processingStep || 'Processing...'}</span>
                  </div>
                  <Progress value={processingProgress} className="h-2" />
                </CardContent>
              </Card>
            )}

            {/* Error Display */}
            {error && (
              <Card className="border-destructive">
                <CardContent className="flex items-center gap-3 pt-6">
                  <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
                  <p className="text-destructive">{error}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - SOAP Output */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">SOAP Note</h2>
              </div>
              {soapData && (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Structured
                </Badge>
              )}
            </div>

            <SOAPEditor
              data={soapData}
              onChange={setSoapData}
              readOnly={isProcessing}
            />
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            Powered by MedGemma 1.5 | Voice recognition via Web Speech API |
            For clinical documentation assistance only
          </p>
        </div>
      </div>
    </div>
  );
}
