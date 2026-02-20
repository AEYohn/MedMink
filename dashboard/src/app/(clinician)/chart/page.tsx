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
  CheckCircle2,
  Clipboard,
  PanelRightOpen,
  PanelRightClose,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DictationInput } from '@/components/charting/DictationInput';
import { TranscriptDisplay } from '@/components/charting/TranscriptDisplay';
import { SOAPEditor, SOAPData } from '@/components/charting/SOAPEditor';
import { usePatientFromUrl } from '@/hooks/usePatientFromUrl';
import { PatientBanner } from '@/components/shared/PatientBanner';
import { getApiUrl } from '@/lib/api-url';
import { useComplianceScan } from '@/hooks/useComplianceScan';
import { ComplianceScoreBadge } from '@/components/compliance/ComplianceScoreBadge';
import { CompliancePanel } from '@/components/compliance/CompliancePanel';
import type { ComplianceFlag } from '@/types/compliance';

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

const EXAMPLE_DICTATION = `Patient is a 62-year-old male presenting with chief complaint of substernal chest pressure for approximately 2 hours, onset at rest. He describes the pain as heavy pressure in the center of his chest, radiating to the left arm and jaw, associated with shortness of breath, nausea, and diaphoresis. Pain is constant since onset, not relieved by rest. Past medical history significant for hypertension, hyperlipidemia, and 20-pack-year smoking history. Family history notable for father with myocardial infarction at age 55. Home medications include lice in oh pril 20 milligrams daily, a tore va statin 40 milligrams daily, and aspirin 81 milligrams daily. No known drug allergies. Vital signs: blood pressure 162 over 98, heart rate 94, respiratory rate 20, oxygen saturation 96 percent on room air, temperature 98.4. Physical exam: patient is anxious and diaphoretic, regular rate and rhythm, no murmurs rubs or gallops, lungs clear to auscultation bilaterally, no lower extremity edema. 12 lead EKG shows ST elevation in leads V2 through V5 with reciprocal changes in inferior leads. Initial troponin I elevated at 0.82. Assessment is acute STEMI, ST elevation myocardial infarction, anterior wall. Plan: Cath lab activated, aspirin 325 milligrams chewed and swallowed, ticagrelor 180 milligrams loading dose, heparin bolus 60 units per kilogram, morphine 4 milligrams IV for pain, supplemental oxygen via nasal cannula at 2 liters. Cardiology on the way for emergent PCI. Admit to CCU post procedure.`;

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
  const [showCompliance, setShowCompliance] = useState(true);

  // Compliance scanning hook
  const compliance = useComplianceScan(soapData);

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
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        response = await fetch(`${apiUrl}/api/chart/transcribe-and-structure`, {
          method: 'POST',
          body: formData,
        });
      } else {
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
                if (data.step === 'transcribing') setProcessingProgress(25);
                else if (data.step === 'processing') setProcessingProgress(40);
                else if (data.step === 'structuring') setProcessingProgress(70);
              } else if (data.type === 'transcript' && data.data) {
                if (data.data.text) {
                  setTranscript(data.data.text);
                  setProcessingMode('text');
                }
              } else if (data.type === 'result' && data.data) {
                setProcessingProgress(100);
                if (data.data.corrections) setCorrections(data.data.corrections);
                if (data.data.soap) {
                  const soap = data.data.soap;
                  // MedGemma sometimes returns follow_up as an array — coerce to string
                  if (soap.plan && Array.isArray(soap.plan.follow_up)) {
                    soap.plan.follow_up = (soap.plan.follow_up as unknown as string[]).join('; ');
                  }
                  // MedGemma sometimes returns array fields as comma-separated strings — coerce to arrays
                  for (const field of ['review_of_systems', 'patient_reported'] as const) {
                    if (soap.subjective && !Array.isArray(soap.subjective[field])) {
                      soap.subjective[field] = typeof soap.subjective[field] === 'string'
                        ? (soap.subjective[field] as unknown as string).split(/[;,]\s*/).filter(Boolean)
                        : [];
                    }
                  }
                  for (const field of ['physical_exam', 'labs', 'imaging'] as const) {
                    if (soap.objective && !Array.isArray(soap.objective[field])) {
                      soap.objective[field] = typeof soap.objective[field] === 'string'
                        ? (soap.objective[field] as unknown as string).split(/[;,]\s*/).filter(Boolean)
                        : [];
                    }
                  }
                  if (soap.assessment && !Array.isArray(soap.assessment.differential)) {
                    soap.assessment.differential = typeof soap.assessment.differential === 'string'
                      ? (soap.assessment.differential as unknown as string).split(/[;,]\s*/).filter(Boolean)
                      : [];
                  }
                  for (const field of ['procedures', 'referrals', 'patient_education'] as const) {
                    if (soap.plan && !Array.isArray(soap.plan[field])) {
                      soap.plan[field] = typeof soap.plan[field] === 'string'
                        ? (soap.plan[field] as unknown as string).split(/[;,]\s*/).filter(Boolean)
                        : [];
                    }
                  }
                  setSoapData(soap);
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
  };

  // Apply a compliance fix by updating the specific field in soapData
  const handleApplyFix = async (flag: ComplianceFlag) => {
    const result = await compliance.applyFix(flag);
    if (!result || !soapData) return;

    const { fixedText, fieldPath } = result;
    const pathParts = fieldPath.split('.');
    const newData = JSON.parse(JSON.stringify(soapData));

    let current: Record<string, unknown> = newData;
    for (let i = 0; i < pathParts.length - 1; i++) {
      current = current[pathParts[i]] as Record<string, unknown>;
    }

    const lastKey = pathParts[pathParts.length - 1];
    const currentValue = current[lastKey];

    // If the target is an array, append the fix text as a new item
    if (Array.isArray(currentValue)) {
      currentValue.push(fixedText);
    } else {
      current[lastKey] = fixedText;
    }

    setSoapData(newData);
  };

  const canEnhance =
    (transcript.trim().length > 10 || audioBlob) && !isProcessing && !isInterim;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto px-6 py-8">
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

        {/* 3-column layout on xl, 2-column on lg, 1-column on mobile */}
        <div className={`grid grid-cols-1 gap-6 ${showCompliance && soapData ? 'lg:grid-cols-2 xl:grid-cols-[3fr_4fr_3fr]' : 'lg:grid-cols-2'}`}>
          {/* Left Column - Input */}
          <div className="space-y-6">
            {/* Try an Example banner */}
            {!transcript && !soapData && !isProcessing && (
              <Card
                className="border-dashed border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => { setTranscript(EXAMPLE_DICTATION); setProcessingMode('text'); }}
              >
                <CardContent className="flex items-center gap-3 py-4">
                  <Clipboard className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Try an Example</p>
                    <p className="text-xs text-muted-foreground">Load a sample clinical encounter to see how charting works</p>
                  </div>
                </CardContent>
              </Card>
            )}

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

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                size="lg"
                onClick={handleEnhance}
                disabled={!canEnhance}
                className="flex-1"
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
            </div>

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

          {/* Middle Column - SOAP Output */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">SOAP Note</h2>
              </div>
              <div className="flex items-center gap-2">
                {soapData && (
                  <>
                    <ComplianceScoreBadge
                      score={compliance.score}
                      grade={compliance.grade}
                      isScanning={compliance.isScanning}
                      onClick={() => setShowCompliance(prev => !prev)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 xl:hidden"
                      onClick={() => setShowCompliance(prev => !prev)}
                    >
                      {showCompliance ? (
                        <PanelRightClose className="w-4 h-4" />
                      ) : (
                        <PanelRightOpen className="w-4 h-4" />
                      )}
                    </Button>
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Structured
                    </Badge>
                  </>
                )}
              </div>
            </div>

            <SOAPEditor
              data={soapData}
              onChange={setSoapData}
              readOnly={isProcessing}
              complianceFlags={compliance.flags}
            />
          </div>

          {/* Right Column - Compliance Panel */}
          {soapData && showCompliance && (
            <div className="space-y-6">
              <CompliancePanel
                flags={compliance.flags}
                score={compliance.score}
                grade={compliance.grade}
                claimDenialScore={compliance.claimDenialScore}
                malpracticeScore={compliance.malpracticeScore}
                rulesChecked={compliance.rulesChecked}
                rulesPassed={compliance.rulesPassed}
                isScanning={compliance.isScanning}
                onFix={handleApplyFix}
                onDismiss={compliance.dismissFlag}
                dismissedRules={compliance.dismissedRules}
              />
            </div>
          )}
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
