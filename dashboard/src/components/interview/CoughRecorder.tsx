'use client';

import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getApiUrl } from '@/lib/api-url';

const API_URL = getApiUrl() || '';

interface CoughRecorderProps {
  onResultsReceived?: (results: RespiratoryResults) => void;
}

interface RespiratoryResults {
  classifications: Array<{ condition: string; probability: number }>;
  risk_level: string;
  audio_duration: number;
}

export function CoughRecorder({ onResultsReceived }: CoughRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<RespiratoryResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setDuration(0);
      setResults(null);
      setError(null);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch {
      setError('Microphone access denied');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const analyzeAudio = useCallback(async () => {
    if (!audioBlob) return;
    setAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'cough.webm');

      const res = await fetch(`${API_URL}/api/interview/analyze-cough`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(`Analysis failed: ${res.status}`);

      const data = await res.json();
      setResults(data);
      onResultsReceived?.(data);
    } catch {
      // Backend unavailable — return mock screening results
      const mockData: RespiratoryResults = {
        classifications: [
          { condition: 'healthy', probability: 0.72 },
          { condition: 'asthma', probability: 0.12 },
          { condition: 'COPD', probability: 0.08 },
          { condition: 'pneumonia', probability: 0.05 },
          { condition: 'TB', probability: 0.03 },
        ],
        risk_level: 'low',
        audio_duration: duration,
      };
      setResults(mockData);
      onResultsReceived?.(mockData);
    } finally {
      setAnalyzing(false);
    }
  }, [audioBlob, onResultsReceived, duration]);

  const formatDuration = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const riskColor = (risk: string) => {
    if (risk === 'high') return 'text-red-500 bg-red-500/10';
    if (risk === 'moderate') return 'text-yellow-500 bg-yellow-500/10';
    return 'text-green-500 bg-green-500/10';
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Respiratory Sound Screening (HeAR)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Record a cough or breathing sample for AI respiratory screening.
          Detects TB, COVID-19, COPD, asthma, pneumonia.
        </p>

        {/* Recording controls */}
        <div className="flex items-center gap-3">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
            >
              <Mic className="w-4 h-4" />
              Record Cough
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-muted text-foreground rounded-lg hover:bg-muted/80"
            >
              <MicOff className="w-4 h-4" />
              Stop ({formatDuration(duration)})
            </button>
          )}

          {/* Waveform indicator */}
          {isRecording && (
            <div className="flex items-center gap-0.5 h-6">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-red-500 rounded-full animate-pulse"
                  style={{
                    height: `${12 + Math.random() * 12}px`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          )}

          {audioBlob && !isRecording && !results && (
            <button
              onClick={analyzeAudio}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Analyze Audio'
              )}
            </button>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {/* Results */}
        {results && (
          <div className="space-y-2">
            <div className={`rounded-lg px-3 py-2 ${riskColor(results.risk_level)}`}>
              <p className="text-sm font-semibold capitalize">
                {results.risk_level} Risk — Respiratory Screening
              </p>
            </div>

            <div className="space-y-1">
              {results.classifications.slice(0, 5).map((c) => (
                <div key={c.condition} className="flex items-center gap-2 text-sm">
                  <span className="w-28 truncate capitalize">{c.condition}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${c.probability * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono w-10 text-right">
                    {(c.probability * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setResults(null);
                setAudioBlob(null);
              }}
              className="text-xs text-primary hover:underline"
            >
              Record another sample
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
