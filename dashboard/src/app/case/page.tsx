'use client';

import { useState, useRef, useEffect, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import {
  Stethoscope,
  Loader2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileText,
  Lightbulb,
  Activity,
  Pill,
  Beaker,
  ArrowLeft,
  Clipboard,
  MessageCircle,
  Send,
  Mic,
  Camera,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useCaseSession } from '@/hooks/useCaseSession';
import { createEmptyOverrides } from '@/lib/storage';
import { CaseSessionList } from '@/components/case/CaseSessionList';
import { CaseTimeline } from '@/components/case/CaseTimeline';
import { AddFindingsForm } from '@/components/case/AddFindingsForm';
import { ImageAnalysisCard } from '@/components/case/ImageAnalysisCard';
import { LabExtractorCard } from '@/components/case/LabExtractorCard';
import { DictationModal } from '@/components/case/DictationModal';
import { SOAPExportCard } from '@/components/case/SOAPExportCard';
import { CaseReportExport } from '@/components/case/CaseReportExport';
import { DifferentialDiagnosisTab } from '@/components/case/DifferentialDiagnosisTab';
import { RiskScoresTab } from '@/components/case/RiskScoresTab';
import { ReferralTab } from '@/components/case/ReferralTab';
import { TreatmentComparisonChart } from '@/components/visualizations/TreatmentComparisonChart';
import { EvidenceRadar } from '@/components/visualizations/EvidenceRadar';
import { CaseTimelineD3 } from '@/components/visualizations/CaseTimelineD3';

// New interactive components
import { CaseSummaryCard } from '@/components/case/CaseSummaryCard';
import { TreatmentPlanEditor } from '@/components/case/TreatmentPlanEditor';
import { AcuteManagementEditor } from '@/components/case/AcuteManagementEditor';
import { DischargeEditor } from '@/components/case/DischargeEditor';
import { SafetyAlertsPanel } from '@/components/case/SafetyAlertsPanel';

import type { NewFindings, ClinicianOverrides } from '@/lib/storage';
import {
  hasAcuteManagement,
} from '@/types/case';
import type {
  TreatmentOption,
  ParsedCase,
  CaseAnalysisData,
  StepUpdate,
  CaseAnalysisResult,
  FollowUpMessage,
  SSEEvent,
} from '@/types/case';

// Example cases
const EXAMPLE_CASES: Record<string, { label: string; text: string }> = {
  musculoskeletal: {
    label: 'Neck Pain',
    text: `A 21-year-old male college student presents with progressive neck stiffness and pain for the past 3 days. He reports difficulty turning his head to the left. No fever, no trauma history. He spends 8+ hours daily on his laptop. Physical exam shows limited cervical range of motion, tenderness over the left trapezius and sternocleidomastoid muscles, no neurological deficits. No meningeal signs.`,
  },
  cardiology: {
    label: 'Chest Pain (STEMI)',
    text: `A 62-year-old female with history of hypertension and hyperlipidemia presents with substernal chest pressure radiating to her left jaw for the past 45 minutes. She is diaphoretic and nauseated. Vitals: BP 165/95, HR 102, SpO2 96% on room air. ECG shows ST-segment elevation in leads II, III, and aVF. Troponin I is 2.4 ng/mL (normal <0.04).`,
  },
  infectious_disease: {
    label: 'UTI',
    text: `A 35-year-old female presents with 3 days of dysuria, urinary frequency, and suprapubic pain. She denies fever, flank pain, or vaginal discharge. No history of recurrent UTIs. Urinalysis shows positive leukocyte esterase, positive nitrites, and >50 WBC/hpf. She has no drug allergies.`,
  },
  neurology: {
    label: 'Thunderclap Headache',
    text: `A 45-year-old male presents with the worst headache of his life, onset 2 hours ago while lifting weights. He reports neck stiffness and photophobia. Vital signs: BP 180/100, HR 90. Neurological exam shows no focal deficits but positive Kernig's and Brudzinski's signs. Non-contrast CT head is negative.`,
  },
  psychiatry: {
    label: 'Depression',
    text: `A 28-year-old female presents with 4 weeks of persistent low mood, anhedonia, poor sleep with early morning awakening, decreased appetite with 8-pound weight loss, difficulty concentrating at work, and passive suicidal ideation without plan or intent. PHQ-9 score is 18. No prior psychiatric history. No substance use.`,
  },
  endocrinology: {
    label: 'HIV Lipodystrophy',
    text: `A 48-year-old male with a 15-year history of HIV, well-controlled on antiretroviral therapy (viral load undetectable, CD4 count 620 cells/mm³), presents with progressive truncal obesity over the past 2 years despite regular exercise and a balanced diet. Physical examination reveals increased abdominal girth with relatively thin extremities. CT imaging confirms a significant increase in visceral adipose tissue. His BMI is 27 kg/m² and fasting glucose is 108 mg/dL. His current antiretroviral regimen was recently switched from an older protease inhibitor-based regimen to an integrase inhibitor-based regimen, but the abdominal fat accumulation has not improved after 12 months.`,
  },
  pulmonology: {
    label: 'COPD',
    text: `A 55-year-old male with a 30 pack-year smoking history presents with worsening dyspnea on exertion over the past 6 months. He now gets short of breath walking up one flight of stairs. He has a chronic productive cough with white sputum. PFTs show FEV1/FVC ratio of 0.62, FEV1 55% predicted. Chest X-ray shows hyperinflation.`,
  },
  dermatology: {
    label: 'Ringworm',
    text: `A 32-year-old female presents with a 2-month history of an expanding erythematous, scaly plaque on her right shin. The lesion is well-demarcated, approximately 5cm in diameter, with central clearing giving an annular appearance. She recently adopted a kitten. KOH preparation of skin scrapings is positive for fungal hyphae.`,
  },
};

const EXAMPLE_CASE_KEYS = Object.keys(EXAMPLE_CASES);

const PIPELINE_STEPS = [
  { id: 'parsing', label: 'Parse', icon: FileText },
  { id: 'parallel_analysis', label: 'Analyze', icon: Lightbulb },
  { id: 'evidence_search', label: 'Evidence', icon: Beaker },
  { id: 'evaluating', label: 'Evaluate', icon: Activity },
  { id: 'medication_review', label: 'Meds', icon: Pill },
  { id: 'complete', label: 'Done', icon: CheckCircle2 },
];

// ─── Collapsible Section Wrapper ────────────────────────────────────────────
function Section({
  title,
  icon,
  defaultOpen = true,
  badge,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between cursor-pointer hover:bg-accent/30 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-sm font-semibold">{title}</h2>
            {badge}
          </div>
          <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Main Page Component ────────────────────────────────────────────────────
export default function CaseAnalysisPage() {
  const [caseText, setCaseText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [stepProgress, setStepProgress] = useState(0);
  const [stepMessage, setStepMessage] = useState('');
  const [parsedCase, setParsedCase] = useState<ParsedCase | null>(null);
  const [result, setResult] = useState<CaseAnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [exampleIndex, setExampleIndex] = useState(0);

  // Follow-up chat state
  const [followUpMessages, setFollowUpMessages] = useState<FollowUpMessage[]>([]);
  const [followUpInput, setFollowUpInput] = useState('');
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const followUpEndRef = useRef<HTMLDivElement>(null);

  // New findings / reassessment state
  const [pendingFindings, setPendingFindings] = useState<NewFindings[]>([]);
  const [isReassessing, setIsReassessing] = useState(false);

  // Progressive treatment card rendering during evaluation
  const [streamingOptions, setStreamingOptions] = useState<Partial<TreatmentOption>[]>([]);

  // Image analysis state
  const [imageResult, setImageResult] = useState<{
    modality: string; findings: string[]; impression: string;
    differential_diagnoses: string[]; confidence: number;
    recommendations: string[]; model: string;
  } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);

  // Lab extraction state
  const [labResult, setLabResult] = useState<{
    labs: Array<{ test: string; value: string; unit: string; reference_range: string; flag: string }>;
    collection_date: string; patient_info: string; model: string; error: string;
  } | null>(null);
  const [labPreview, setLabPreview] = useState<string | null>(null);
  const [isLabLoading, setIsLabLoading] = useState(false);

  // Dictation state
  const [showDictation, setShowDictation] = useState(false);

  // Clinician overrides
  const [overrides, setOverrides] = useState<ClinicianOverrides>(createEmptyOverrides());

  // Case session state
  const session = useCaseSession();

  const handleOverridesChange = useCallback((newOverrides: ClinicianOverrides) => {
    setOverrides(newOverrides);
    session.updateOverrides(newOverrides);
  }, [session]);

  // Restore session state on mount
  useEffect(() => {
    if (!session.isLoaded) return;

    const params = new URLSearchParams(window.location.search);
    const urlSessionId = params.get('session');
    if (urlSessionId) {
      handleLoadSession(urlSessionId);
      window.history.replaceState({}, '', '/case');
      return;
    }

    if (session.currentSession) {
      const s = session.currentSession;
      setCaseText(s.currentCaseText);
      if (s.overrides) setOverrides(s.overrides);
      if (s.currentResult) {
        const r = s.currentResult as unknown as CaseAnalysisData;
        setResult(r);
        if (r.parsed_case) setParsedCase(r.parsed_case);
        if (r.suggested_followups?.length) setSuggestedQuestions(r.suggested_followups);
      }
      if (s.followUpMessages?.length) setFollowUpMessages(s.followUpMessages);
    }
  }, [session.isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    followUpEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [followUpMessages]);

  useEffect(() => {
    if (session.currentSession && followUpMessages.length > 0) {
      session.updateFollowUpMessages(followUpMessages);
    }
  }, [followUpMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  // SSE stream helper
  const processSSEStream = useCallback(async (
    response: Response,
    onResult: (data: CaseAnalysisData) => void,
  ) => {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) throw new Error('No response body');

    const handleSSEData = (data: SSEEvent) => {
      if (data.type === 'step') {
        const step = data as StepUpdate;
        setCurrentStep(step.step);
        setStepProgress(step.progress);
        setStepMessage(step.message);
        if (step.status === 'completed') {
          setCompletedSteps(prev => new Set([...Array.from(prev), step.step]));
          if (step.step === 'parsing' && step.data) {
            setParsedCase(step.data as unknown as ParsedCase);
          }
        }
        if (step.step === 'evaluating' && step.data?.name && step.data?.verdict) {
          setStreamingOptions(prev => {
            const exists = prev.some(o => o.name === step.data?.name);
            if (exists) return prev;
            return [...prev, {
              name: step.data!.name as string,
              verdict: step.data!.verdict as TreatmentOption['verdict'],
              confidence: step.data!.confidence as number,
              papers_used: step.data!.papers_used as TreatmentOption['papers_used'],
              rationale: step.data!.rationale as string,
            }];
          });
        }
      } else if (data.type === 'result') {
        const r = data as CaseAnalysisResult;
        setResult(r.data);
        if (r.data.suggested_followups?.length) {
          setSuggestedQuestions(r.data.suggested_followups);
        }
        onResult(r.data);
      } else if (data.type === 'error') {
        setError((data as { type: 'error'; message: string }).message);
      }
    };

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      for (const part of parts) {
        const dataLine = part.split('\n').find(l => l.startsWith('data: '));
        if (!dataLine) continue;
        try { handleSSEData(JSON.parse(dataLine.slice(6)) as SSEEvent); }
        catch (e) { console.error('SSE parse error:', e); }
      }
    }
    if (buffer.trim()) {
      const dataLine = buffer.split('\n').find(l => l.startsWith('data: '));
      if (dataLine) {
        try { handleSSEData(JSON.parse(dataLine.slice(6)) as SSEEvent); }
        catch (e) { console.error('SSE parse error (final):', e); }
      }
    }
  }, []);

  const handleFollowUpSubmit = async (question: string) => {
    if (!question.trim() || isFollowUpLoading || !result) return;
    const userMsg: FollowUpMessage = { id: `user-${Date.now()}`, role: 'user', content: question.trim() };
    setFollowUpMessages(prev => [...prev, userMsg]);
    setFollowUpInput('');
    setIsFollowUpLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const slimSummary = {
        top_recommendation: result.top_recommendation,
        recommendation_rationale: result.recommendation_rationale,
        treatment_options: result.treatment_options.map(t => ({ name: t.name, verdict: t.verdict })),
        parsed_case: { case_category: result.parsed_case?.case_category || '' },
        acute_management: {
          disposition: result.acute_management?.disposition || '',
          monitoring_plan: result.acute_management?.monitoring_plan || [],
        },
      };
      const response = await fetch(`${apiUrl}/api/case/followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_text: caseText,
          analysis_summary: slimSummary,
          question: question.trim(),
          conversation_history: followUpMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      if (!response.ok) throw new Error('Failed to get follow-up answer');
      const data = await response.json();
      setFollowUpMessages(prev => [...prev, { id: `assistant-${Date.now()}`, role: 'assistant', content: data.answer }]);
      if (data.suggested_questions?.length > 0) setSuggestedQuestions(data.suggested_questions);
    } catch {
      setFollowUpMessages(prev => [...prev, { id: `error-${Date.now()}`, role: 'assistant', content: 'Sorry, I was unable to answer that question. Please try again.' }]);
    } finally {
      setIsFollowUpLoading(false);
    }
  };

  const resetAnalysisState = () => {
    setError(null);
    setResult(null);
    setParsedCase(null);
    setCurrentStep(null);
    setStepProgress(0);
    setCompletedSteps(new Set());
    setFollowUpMessages([]);
    setFollowUpInput('');
    setSuggestedQuestions([]);
    setPendingFindings([]);
    setStreamingOptions([]);
    setOverrides(createEmptyOverrides());
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!caseText.trim() || isLoading) return;
    setIsLoading(true);
    resetAnalysisState();
    const title = caseText.trim().slice(0, 60).replace(/\n/g, ' ') + '...';
    if (!session.currentSession) session.createSession(caseText.trim(), title);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const response = await fetch(`${apiUrl}/api/case/analyze/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_text: caseText.trim() }),
      });
      if (!response.ok) throw new Error('Failed to start analysis');
      await processSSEStream(response, (resultData) => {
        session.updateResult(resultData as unknown as Record<string, unknown>);
        session.addEvent({ type: 'initial_analysis', changeSummary: `Initial analysis: ${resultData.top_recommendation || 'No recommendation'}` });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFindings = (findings: NewFindings) => {
    setPendingFindings(prev => [...prev, findings]);
    session.addEvent({ type: 'new_findings', findings, changeSummary: `Added ${findings.category.replace('_', ' ')}: ${findings.text.slice(0, 60)}` });
    session.addFindings(findings);
  };

  const handleReassess = async () => {
    if (!result || pendingFindings.length === 0 || isReassessing) return;
    setIsReassessing(true);
    setIsLoading(true);
    setError(null);
    setCurrentStep(null);
    setStepProgress(0);
    setCompletedSteps(new Set());
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const response = await fetch(`${apiUrl}/api/case/reassess/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_case_text: caseText,
          new_findings: pendingFindings.map(f => ({ category: f.category, text: f.text, clinical_time: f.clinicalTime || '' })),
          previous_parsed_case: result.parsed_case,
          previous_search_terms: result.search_terms_used || [],
          previous_papers: result.papers_reviewed || [],
        }),
      });
      if (!response.ok) throw new Error('Failed to start reassessment');
      const previousTopRec = result.top_recommendation;
      await processSSEStream(response, (resultData) => {
        session.updateResult(resultData as unknown as Record<string, unknown>);
        const changed = resultData.top_recommendation !== previousTopRec;
        session.addEvent({
          type: 'reassessment_complete',
          changeSummary: changed
            ? `Reassessment: recommendation changed from "${previousTopRec}" to "${resultData.top_recommendation}"`
            : `Reassessment complete: recommendation unchanged (${resultData.top_recommendation})`,
        });
        if (session.currentSession) setCaseText(session.currentSession.currentCaseText);
      });
      setPendingFindings([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reassessment failed');
    } finally {
      setIsLoading(false);
      setIsReassessing(false);
    }
  };

  const handleLoadSession = (id: string) => {
    const loaded = session.loadSession(id);
    if (loaded) {
      setCaseText(loaded.currentCaseText);
      if (loaded.overrides) setOverrides(loaded.overrides);
      else setOverrides(createEmptyOverrides());
      if (loaded.currentResult) {
        const r = loaded.currentResult as unknown as CaseAnalysisData;
        setResult(r);
        if (r.parsed_case) setParsedCase(r.parsed_case);
        if (r.suggested_followups?.length) setSuggestedQuestions(r.suggested_followups);
      } else {
        setResult(null);
        setParsedCase(null);
        setSuggestedQuestions([]);
      }
      setFollowUpMessages(loaded.followUpMessages || []);
      setPendingFindings([]);
      setError(null);
    }
  };

  const handleNewCase = () => {
    session.clearCurrentSession();
    setCaseText('');
    resetAnalysisState();
  };

  const handleImageUpload = useCallback(async (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setIsImageLoading(true);
    setImageResult(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const formData = new FormData();
      formData.append('image', file);
      formData.append('context', caseText || '');
      const response = await fetch(`${apiUrl}/api/case/image/analyze`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Image analysis failed');
      setImageResult(await response.json());
    } catch {
      setImageResult({ modality: 'unknown', findings: ['Analysis failed'], impression: '', differential_diagnoses: [], confidence: 0, recommendations: [], model: 'error' });
    } finally {
      setIsImageLoading(false);
    }
  }, [caseText]);

  const handleImageImportToCase = useCallback((findings: string[]) => {
    setCaseText(prev => prev + '\n\nImaging findings: ' + findings.join('; '));
  }, []);

  const handleLabUpload = useCallback(async (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setLabPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setIsLabLoading(true);
    setLabResult(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch(`${apiUrl}/api/labs/extract`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Lab extraction failed');
      setLabResult(await response.json());
    } catch {
      setLabResult({ labs: [], collection_date: '', patient_info: '', model: 'error', error: 'Extraction failed' });
    } finally {
      setIsLabLoading(false);
    }
  }, []);

  const handleLabImportToCase = useCallback((labText: string) => {
    setCaseText(prev => prev + '\n\nLab results: ' + labText);
  }, []);

  const handleDictationTranscript = useCallback((text: string) => {
    setCaseText(prev => prev ? prev + '\n' + text : text);
  }, []);

  const loadExample = () => {
    const key = EXAMPLE_CASE_KEYS[exampleIndex];
    setCaseText(EXAMPLE_CASES[key].text);
    setExampleIndex((exampleIndex + 1) % EXAMPLE_CASE_KEYS.length);
  };

  // Count unacknowledged safety alerts for sidebar badge
  const safetyAlertCount = result?.medication_review
    ? (result.medication_review.renal_flags?.length || 0) +
      (result.medication_review.interactions?.length || 0) +
      (result.medication_review.duplicate_therapy?.length || 0)
    : 0;
  const unackedAlerts = safetyAlertCount - Object.values(overrides.safetyAcknowledgments).filter(a => a.acknowledged).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <header className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
                <Stethoscope className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Clinical Case Analyzer</h1>
                <p className="text-xs text-muted-foreground">
                  Evidence-based treatment recommendations &middot; MedGemma 27B + PubMed
                </p>
              </div>
            </div>
            {result && (
              <CaseReportExport
                data={{
                  parsedCase: result.parsed_case || { clinical_question: '', case_category: '' },
                  topRecommendation: result.top_recommendation,
                  recommendationRationale: result.recommendation_rationale,
                  treatmentOptions: result.treatment_options,
                  acuteManagement: result.acute_management,
                  clinicalPearls: result.clinical_pearls,
                  papersReviewed: result.papers_reviewed,
                }}
              />
            )}
          </div>
        </header>

        {/* Case Sessions */}
        {session.allSessions.length > 0 && (
          <div className="mb-4">
            <CaseSessionList
              sessions={session.allSessions}
              currentSessionId={session.currentSession?.id || null}
              onLoad={handleLoadSession}
              onDelete={session.deleteSession}
              onNewCase={handleNewCase}
            />
          </div>
        )}

        {/* Input Form */}
        <Card className="mb-6">
          <CardContent className="pt-5 pb-4">
            <form onSubmit={handleSubmit}>
              <Textarea
                value={caseText}
                onChange={(e) => setCaseText(e.target.value)}
                placeholder="Paste your clinical case here..."
                className="min-h-[140px] text-sm mb-3"
                disabled={isLoading}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={loadExample} disabled={isLoading}>
                    <Clipboard className="w-4 h-4 mr-1" />
                    {EXAMPLE_CASES[EXAMPLE_CASE_KEYS[exampleIndex]].label}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowDictation(true)} disabled={isLoading}>
                    <Mic className="w-4 h-4 mr-1" /> Dictate
                  </Button>
                </div>
                <Button type="submit" disabled={!caseText.trim() || isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
                  {isLoading ? 'Analyzing...' : 'Analyze Case'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <Card className="mb-6">
            <CardHeader className="py-3">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <div>
                  <CardTitle className="text-base">
                    {isReassessing ? 'Reassessing Case...' : 'Analyzing Case...'}
                  </CardTitle>
                  <CardDescription className="text-xs">{stepMessage || 'Starting analysis'}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex gap-1.5 mb-3">
                {PIPELINE_STEPS.map((step) => {
                  const isCompleted = completedSteps.has(step.id);
                  const isCurrent = currentStep === step.id;
                  const Icon = step.icon;
                  return (
                    <div key={step.id} className="flex-1 flex flex-col items-center gap-1">
                      <div className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center transition-colors',
                        isCompleted ? 'bg-primary text-primary-foreground' :
                        isCurrent ? 'bg-primary/20 text-primary animate-pulse' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                      </div>
                      <p className={cn(
                        'text-[9px] text-center font-medium',
                        isCompleted ? 'text-primary' : isCurrent ? 'text-primary/70' : 'text-muted-foreground'
                      )}>
                        {step.label}
                      </p>
                    </div>
                  );
                })}
              </div>
              <Progress value={stepProgress * 100} className="h-1" />
            </CardContent>
          </Card>
        )}

        {/* Streaming treatment cards during loading */}
        {isLoading && streamingOptions.length > 0 && !result && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold mb-3">Treatment Options ({streamingOptions.length} evaluated)</h2>
            <div className="space-y-2">
              {streamingOptions.map((opt, i) => (
                <Card key={opt.name} className="animate-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${i * 100}ms` }}>
                  <CardHeader className="py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn('text-xs',
                          opt.verdict === 'recommended' ? 'bg-green-500/10 text-green-600' :
                          opt.verdict === 'not_recommended' ? 'bg-red-500/10 text-red-600' :
                          'bg-amber-500/10 text-amber-600'
                        )}>
                          {opt.verdict}
                        </Badge>
                        <span className="font-medium text-sm">{opt.name}</span>
                      </div>
                      <span className="text-base font-bold text-primary">{Math.round((opt.confidence || 0) * 100)}%</span>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="flex items-center gap-3 pt-4 pb-4">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <p className="text-destructive text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            RESULTS — Two-Column Priority Layout
            ═══════════════════════════════════════════════════════════════ */}
        {result && (
          <div className="space-y-6 animate-fade-in">
            {/* Case Summary — always visible */}
            {parsedCase && <CaseSummaryCard parsedCase={parsedCase} />}

            {/* Two-column grid */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* ─── LEFT COLUMN (60%) — Actionable items ─── */}
              <div className="lg:col-span-3 space-y-6">
                {/* Acute Management */}
                {hasAcuteManagement(result.acute_management) && (
                  <AcuteManagementEditor
                    acuteManagement={result.acute_management!}
                    overrides={overrides}
                    onOverridesChange={handleOverridesChange}
                  />
                )}

                {/* Treatment Plan */}
                <Section
                  title="Treatment Plan"
                  icon={<Pill className="w-4 h-4 text-primary" />}
                  badge={
                    <Badge variant="outline" className="text-xs">
                      {result.treatment_options.length} options
                    </Badge>
                  }
                >
                  <TreatmentPlanEditor
                    treatmentOptions={result.treatment_options}
                    topRecommendation={result.top_recommendation}
                    recommendationRationale={result.recommendation_rationale}
                    overrides={overrides}
                    onOverridesChange={handleOverridesChange}
                  />

                  {/* Add New Findings */}
                  {!isLoading && (
                    <div className="mt-4">
                      <AddFindingsForm
                        onAddFindings={handleAddFindings}
                        onReassess={handleReassess}
                        pendingFindings={pendingFindings}
                        isReassessing={isReassessing}
                      />
                    </div>
                  )}
                </Section>

                {/* Discharge Plan */}
                <Section
                  title="Discharge Plan"
                  icon={<FileText className="w-4 h-4 text-blue-600" />}
                  defaultOpen={false}
                >
                  <DischargeEditor
                    parsedCase={result.parsed_case as unknown as Record<string, unknown>}
                    treatmentOptions={result.treatment_options as unknown as Array<Record<string, unknown>>}
                    acuteManagement={(result.acute_management || {}) as Record<string, unknown>}
                    topRecommendation={result.top_recommendation}
                    overrides={overrides}
                    onOverridesChange={handleOverridesChange}
                  />
                </Section>

                {/* Referral */}
                <Section
                  title="Referral"
                  icon={<MessageCircle className="w-4 h-4 text-teal-600" />}
                  defaultOpen={false}
                >
                  <ReferralTab
                    parsedCase={result.parsed_case as unknown as Record<string, unknown>}
                    treatmentOptions={result.treatment_options as unknown as Array<Record<string, unknown>>}
                    acuteManagement={(result.acute_management || {}) as Record<string, unknown>}
                    suggestedConsults={result.acute_management?.consults || []}
                  />
                </Section>

                {/* Visual Charts */}
                <Section
                  title="Visual Summary"
                  icon={<BarChart3 className="w-4 h-4 text-indigo-600" />}
                  defaultOpen={false}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TreatmentComparisonChart
                      treatments={result.treatment_options.map(t => ({
                        name: t.name, verdict: t.verdict, confidence: t.confidence,
                      }))}
                    />
                    <EvidenceRadar />
                  </div>
                  {session.currentSession && session.currentSession.events.length > 0 && (
                    <div className="mt-4">
                      <CaseTimelineD3
                        events={session.currentSession.events.map(e => ({
                          type: e.type, timestamp: e.timestamp, changeSummary: e.changeSummary || '',
                          findings: e.findings ? { [e.findings.category]: e.findings.text } : undefined,
                        }))}
                      />
                    </div>
                  )}
                </Section>

                {/* Media (Image + Lab + SOAP) */}
                <Section
                  title="Media & Tools"
                  icon={<Camera className="w-4 h-4 text-pink-600" />}
                  defaultOpen={false}
                >
                  <div className="space-y-4">
                    <ImageAnalysisCard
                      result={imageResult}
                      imagePreview={imagePreview}
                      isLoading={isImageLoading}
                      onUpload={handleImageUpload}
                      onClear={() => { setImagePreview(null); setImageResult(null); }}
                      onImportToCase={handleImageImportToCase}
                    />
                    <LabExtractorCard
                      result={labResult}
                      imagePreview={labPreview}
                      isLoading={isLabLoading}
                      onUpload={handleLabUpload}
                      onClear={() => { setLabPreview(null); setLabResult(null); }}
                      onImportToCase={handleLabImportToCase}
                    />
                    <SOAPExportCard
                      caseText={caseText}
                      topRecommendation={result.top_recommendation}
                      acuteManagement={result.acute_management}
                      treatmentOptions={result.treatment_options.map(t => ({ name: t.name, verdict: t.verdict }))}
                    />
                  </div>
                </Section>
              </div>

              {/* ─── RIGHT COLUMN (40%) — Reference & Alerts ─── */}
              <div className="lg:col-span-2 space-y-6">
                {/* Safety Alerts */}
                <SafetyAlertsPanel
                  medicationReview={result.medication_review}
                  currentMedications={result.parsed_case?.management?.medications || []}
                  newMedications={
                    result.treatment_options
                      ?.filter((t: TreatmentOption) => t.verdict === 'recommended')
                      .map((t: TreatmentOption) => t.name) || []
                  }
                  patientConditions={result.parsed_case?.patient?.relevant_history || []}
                  allergies={[]}
                  labs={result.parsed_case?.findings?.labs || []}
                  age={result.parsed_case?.patient?.age || ''}
                  sex={result.parsed_case?.patient?.sex || ''}
                  overrides={overrides}
                  onOverridesChange={handleOverridesChange}
                />

                {/* Risk Scores */}
                <Section
                  title="Risk Scores"
                  icon={<Activity className="w-4 h-4 text-blue-600" />}
                >
                  <RiskScoresTab
                    riskScores={result.clinical_risk_scores || null}
                    caseText={caseText}
                    parsedCase={result.parsed_case as unknown as Record<string, unknown>}
                    overrides={overrides}
                    onOverridesChange={handleOverridesChange}
                  />
                </Section>

                {/* DDx */}
                <Section
                  title="Differential Diagnosis"
                  icon={<Stethoscope className="w-4 h-4 text-purple-600" />}
                  defaultOpen={false}
                >
                  <DifferentialDiagnosisTab
                    ddxResult={result.differential_diagnosis || null}
                    caseText={caseText}
                    parsedCase={result.parsed_case as unknown as Record<string, unknown>}
                  />
                </Section>

                {/* Clinical Pearls */}
                {result.clinical_pearls.length > 0 && (
                  <Section
                    title="Clinical Pearls"
                    icon={<Lightbulb className="w-4 h-4 text-amber-500" />}
                    defaultOpen={false}
                  >
                    <Card className="border-amber-500/30 bg-amber-500/5">
                      <CardContent className="pt-3 pb-3">
                        <ul className="space-y-1.5">
                          {result.clinical_pearls.map((pearl, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px] font-bold text-amber-600 flex-shrink-0">
                                {i + 1}
                              </span>
                              <span className="text-xs text-muted-foreground">{pearl}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </Section>
                )}

                {/* Follow-Up Chat */}
                <Section
                  title="Follow-Up Chat"
                  icon={<MessageCircle className="w-4 h-4 text-primary" />}
                >
                  <Card>
                    <CardContent className="pt-3 pb-3 space-y-3">
                      {followUpMessages.length > 0 && (
                        <div className="max-h-[300px] overflow-y-auto space-y-2 p-2 bg-muted/30 rounded-lg">
                          {followUpMessages.map((msg) => (
                            <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                              <div className={cn(
                                'max-w-[85%] rounded-lg px-3 py-1.5 text-xs',
                                msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-background border shadow-sm'
                              )}>
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                              </div>
                            </div>
                          ))}
                          {isFollowUpLoading && (
                            <div className="flex justify-start">
                              <div className="bg-background border shadow-sm rounded-lg px-3 py-1.5">
                                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                              </div>
                            </div>
                          )}
                          <div ref={followUpEndRef} />
                        </div>
                      )}

                      {suggestedQuestions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {suggestedQuestions.map((q, i) => (
                            <button
                              key={i}
                              onClick={() => handleFollowUpSubmit(q)}
                              disabled={isFollowUpLoading}
                              className="text-[10px] px-2 py-1 rounded-full border bg-background hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 text-left"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      )}

                      <form
                        onSubmit={(e) => { e.preventDefault(); handleFollowUpSubmit(followUpInput); }}
                        className="flex gap-1.5"
                      >
                        <input
                          type="text"
                          value={followUpInput}
                          onChange={(e) => setFollowUpInput(e.target.value)}
                          placeholder="Ask a follow-up question..."
                          className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          disabled={isFollowUpLoading}
                        />
                        <Button type="submit" size="sm" className="h-8 w-8 p-0" disabled={!followUpInput.trim() || isFollowUpLoading}>
                          {isFollowUpLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </Section>
              </div>
            </div>

            {/* Timeline (bottom, full width) */}
            {session.currentSession && session.currentSession.events.length > 0 && (
              <Section
                title="Case Timeline"
                icon={<Activity className="w-4 h-4 text-muted-foreground" />}
                defaultOpen={false}
              >
                <CaseTimeline events={session.currentSession.events} />
              </Section>
            )}

            <p className="text-center text-[10px] text-muted-foreground pt-2">
              Powered by MedGemma 27B on Modal &middot; Evidence from PubMed &middot; For educational purposes only
            </p>
          </div>
        )}

        <DictationModal
          isOpen={showDictation}
          onClose={() => setShowDictation(false)}
          onTranscript={handleDictationTranscript}
        />
      </div>
    </div>
  );
}
