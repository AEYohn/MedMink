'use client';

import { useState, useRef, useEffect, useCallback, useMemo, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  Beaker,
  ArrowLeft,
  Clipboard,
  Mic,
  Camera,
  BarChart3,
  Save,
  ClipboardList,
  Wrench,
  Send,
  Eye,
  Pill,
  UserPlus,
  FileBarChart,
  Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/api-url';
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
import { ReferencesPanel } from '@/components/case/ReferencesPanel';
import { PatientQuestionsPanel, usePatientQuestionCount } from '@/components/case/PatientQuestionsPanel';

// New interactive components
import { CaseSummaryCard } from '@/components/case/CaseSummaryCard';
import { TreatmentPlanEditor } from '@/components/case/TreatmentPlanEditor';
import { AcuteManagementEditor } from '@/components/case/AcuteManagementEditor';
import { DischargeEditor } from '@/components/case/DischargeEditor';
import type { DischargePlanData } from '@/components/case/DischargeEditor';
import { SafetyAlertsPanel } from '@/components/case/SafetyAlertsPanel';
import { FollowUpChatDrawer } from '@/components/case/FollowUpChatDrawer';
import { AgentReasoningTrace } from '@/components/case/AgentReasoningTrace';
import { ConsensusPanel } from '@/components/case/ConsensusPanel';
import type { ConsensusData } from '@/components/case/ConsensusPanel';
import { ModelAttributionStrip } from '@/components/case/ModelAttributionStrip';
import { FoundationModelFindings } from '@/components/case/FoundationModelFindings';
import { QualityScorecard } from '@/components/case/QualityScorecard';
import { SafetyAlertBanner } from '@/components/case/SafetyAlertBanner';
import { PatientSummaryPreview } from '@/components/case/PatientSummaryPreview';
import { PatientBanner } from '@/components/shared/PatientBanner';
import { PatientSelector } from '@/components/case/PatientSelector';
import { PatientContextCard } from '@/components/case/PatientContextCard';
import { TriageDataBanner } from '@/components/case/TriageDataBanner';
import { usePatientFromUrl } from '@/hooks/usePatientFromUrl';
import { useActivePatient } from '@/contexts/ActivePatientContext';
import { getPatient, getPatientAge } from '@/lib/patient-storage';
import type { Patient } from '@/lib/patient-storage';
import { buildVisitSummary } from '@/lib/visit-summary-builder';
import { saveReleasedSummary, getReleasedSummaryBySession } from '@/lib/storage';
import type { CompanionConfig } from '@/types/postvisit';
import { buildSOAPFromCase } from '@/lib/case-to-soap';

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
  AgentAssessment,
  AgentToolResult,
  AgentConsensusData,
} from '@/types/case';

// Tab migration for saved sessions with old tab names
const TAB_MIGRATION: Record<string, string> = {
  assessment: 'review',
  treatment: 'plan',
  safety: 'review',
  orders: 'plan',
  tools: 'tools',
};

// Example cases
const EXAMPLE_CASES: Record<string, { label: string; text: string }> = {
  emergency: {
    label: 'Chest Pain (PE)',
    text: `A 21-year-old male college student presents to urgent care with sharp right-sided chest pain that started this morning, rated 5/10, worse with deep breaths. He just finished finals and spent the past 4 days mostly sitting at his desk studying and gaming with minimal breaks. No significant past medical history, no medications, no allergies. Vitals: HR 108, BP 128/82, RR 20, SpO2 94% on room air, Temp 98.6°F. Lung exam is clear bilaterally. No chest wall tenderness. He has mild left calf swelling with tenderness on palpation, which he attributes to "sleeping in a weird position."`,
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
  { id: 'agent_reasoning', label: 'Agent', icon: Brain },
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
  usePatientFromUrl();
  const router = useRouter();
  const { patientId: activePatientId, setActivePatient, clearActivePatient } = useActivePatient();
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

  // Agent state
  const [agentAssessment, setAgentAssessment] = useState<AgentAssessment | null>(null);
  const [agentConsensus, setAgentConsensus] = useState<AgentConsensusData | null>(null);
  const [agentToolResults, setAgentToolResults] = useState<AgentToolResult[]>([]);
  const [agentToolsUsed, setAgentToolsUsed] = useState<string[]>([]);

  // Agent streaming events for inline progress display
  const [agentStreamEvents, setAgentStreamEvents] = useState<Array<{ type: string; text: string; tool?: string; model?: string }>>([]);
  const agentAutoRunRef = useRef(false);

  // Interview handoff state
  const [interviewDDx, setInterviewDDx] = useState<Record<string, unknown> | null>(null);
  const handoffAutoSubmitRef = useRef(false);
  const [dictationUsed, setDictationUsed] = useState(false);

  // Clinician overrides
  const [overrides, setOverrides] = useState<ClinicianOverrides>(createEmptyOverrides());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tab & drawer state
  const [activeTab, setActiveTab] = useState('review');
  const [chatOpen, setChatOpen] = useState(false);

  // Patient visit summary release state
  const [showSummaryPreview, setShowSummaryPreview] = useState(false);
  const [isReleasingSummary, setIsReleasingSummary] = useState(false);
  const dischargePlanRef = useRef<DischargePlanData | null>(null);

  // Patient ID
  const [patientId, setPatientId] = useState('');
  const pendingPatientQuestions = usePatientQuestionCount(patientId || undefined);

  const linkedPatient = useMemo(() => {
    if (!patientId) return null;
    return getPatient(patientId);
  }, [patientId]);

  // Case session state
  const session = useCaseSession();

  const handlePatientSelect = useCallback((patient: Patient | null) => {
    if (patient) {
      setPatientId(patient.id);
      setActivePatient(patient.id);
      session.updatePatientId(patient.id);
    } else {
      setPatientId('');
      clearActivePatient();
    }
  }, [session, setActivePatient, clearActivePatient]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    session.updateUIState({ activeTab: tab });
  }, [session]);

  const handleChatToggle = useCallback(() => {
    setChatOpen(prev => {
      const next = !prev;
      session.updateUIState({ chatOpen: next });
      return next;
    });
  }, [session]);

  // Sync active patient context into local patientId
  useEffect(() => {
    if (activePatientId && !patientId) {
      setPatientId(activePatientId);
    }
  }, [activePatientId, patientId]);

  // Released visit summary for current session
  const existingSummary = useMemo(() => {
    if (!session.currentSession?.id) return undefined;
    return getReleasedSummaryBySession(session.currentSession.id);
  }, [session.currentSession?.id, isReleasingSummary]); // eslint-disable-line react-hooks/exhaustive-deps

  const previewSummary = useMemo(() => {
    if (!result || !session.currentSession) return null;
    return buildVisitSummary({
      caseSessionId: session.currentSession.id,
      patientId: patientId || 'unknown',
      analysisData: result,
      overrides,
      dischargePlan: dischargePlanRef.current,
      visitDate: session.currentSession.createdAt,
    });
  }, [result, session.currentSession, patientId, overrides, showSummaryPreview]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReleaseSummary = useCallback((
    editedSummary: Parameters<typeof saveReleasedSummary>[0],
    companionConfig?: CompanionConfig,
  ) => {
    setIsReleasingSummary(true);
    const withCompanion = companionConfig
      ? { ...editedSummary, companionConfig }
      : editedSummary;
    // If updating an existing summary, preserve the original id
    const summaryToSave = existingSummary
      ? { ...withCompanion, id: existingSummary.id, releasedAt: new Date().toISOString() }
      : withCompanion;
    saveReleasedSummary(summaryToSave);
    setShowSummaryPreview(false);
    setIsReleasingSummary(false);
    toast.success(existingSummary ? 'Patient summary updated' : 'Patient summary released');
  }, [existingSummary]);

  const handlePlanChange = useCallback((plan: DischargePlanData | null) => {
    dischargePlanRef.current = plan;
  }, []);

  // Agent callbacks
  const handleAgentAssessment = useCallback((assessment: AgentAssessment, toolsUsed: string[]) => {
    setAgentAssessment(assessment);
    setAgentToolsUsed(toolsUsed);

    // Auto-inject recommended_actions into acute management overrides
    if (assessment.recommended_actions?.length) {
      setOverrides(prev => {
        const existing = prev.sectionCustomActions['immediate'] || [];
        const existingTexts = new Set(existing.map(a => a.text));
        const newActions = assessment.recommended_actions!
          .filter(action => !existingTexts.has(`[Agent] ${action}`))
          .map(action => ({
            id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            text: `[Agent] ${action}`,
            checked: false,
            addedAt: new Date().toISOString(),
          }));
        if (newActions.length === 0) return prev;
        const updated = {
          ...prev,
          sectionCustomActions: {
            ...prev.sectionCustomActions,
            immediate: [...existing, ...newActions],
          },
          lastModified: new Date().toISOString(),
        };
        session.updateOverrides(updated);
        return updated;
      });
    }

    // Persist to session
    session.saveSession({
      ...session.currentSession!,
      agentResult: {
        assessment,
        consensus: agentConsensus,
        toolResults: agentToolResults,
        toolsUsed,
        completedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });
  }, [session, agentConsensus, agentToolResults]);

  const handleAgentConsensus = useCallback((consensus: AgentConsensusData) => {
    setAgentConsensus(consensus);
    // Persist to session
    if (session.currentSession) {
      session.saveSession({
        ...session.currentSession,
        agentResult: {
          assessment: agentAssessment,
          consensus,
          toolResults: agentToolResults,
          toolsUsed: agentToolsUsed,
          completedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      });
    }
  }, [session, agentAssessment, agentToolResults, agentToolsUsed]);

  const handleAgentToolResult = useCallback((tool: string, model: string, result: Record<string, unknown>) => {
    setAgentToolResults(prev => [...prev, { tool, model, result }]);
  }, []);

  const handleOverridesChange = useCallback((newOverrides: ClinicianOverrides) => {
    // Detect treatment verdict changes and log timeline events
    if (session.currentSession && result) {
      for (const [name, treatment] of Object.entries(newOverrides.treatments)) {
        const prev = overrides.treatments[name];
        if (treatment.verdict && treatment.verdict !== prev?.verdict) {
          const label = treatment.verdict === 'accepted' ? 'Accepted'
            : treatment.verdict === 'rejected' ? 'Rejected'
            : 'Modified';
          session.addEvent({
            type: 'note',
            changeSummary: `${label}: ${name}`,
          });
        }
      }
    }
    setOverrides(newOverrides);
    session.updateOverrides(newOverrides);
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus('saved');
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1500);
    }, 300);
  }, [session, result, overrides]);

  // Restore session state on mount
  useEffect(() => {
    if (!session.isLoaded) return;

    const params = new URLSearchParams(window.location.search);

    // New case requested — clear session and start fresh
    if (params.get('new') === 'true') {
      session.clearCurrentSession();
      setCaseText('');
      setPatientId('');
      resetAnalysisState();
      window.history.replaceState({}, '', '/case');
      return;
    }

    // Interview handoff — load vignette from sessionStorage and auto-submit
    if (params.get('from') === 'interview') {
      const vignette = sessionStorage.getItem('handoff-vignette');
      const mgmtPlanRaw = sessionStorage.getItem('handoff-management-plan');
      if (vignette) {
        session.clearCurrentSession();
        resetAnalysisState();
        setCaseText(vignette);
        if (mgmtPlanRaw) {
          try { setInterviewDDx(JSON.parse(mgmtPlanRaw)); } catch {}
        }
        sessionStorage.removeItem('handoff-vignette');
        sessionStorage.removeItem('handoff-management-plan');
        sessionStorage.removeItem('handoff-extracted-data');
        sessionStorage.removeItem('handoff-imaging');
        // Mark for auto-submit
        handoffAutoSubmitRef.current = true;
      }
      window.history.replaceState({}, '', '/case');
      return;
    }

    const urlSessionId = params.get('session');
    if (urlSessionId) {
      handleLoadSession(urlSessionId);
      window.history.replaceState({}, '', '/case');
      return;
    }

    if (session.currentSession) {
      const s = session.currentSession;
      s.events = s.events || [];
      s.followUpMessages = s.followUpMessages || [];
      setCaseText(s.currentCaseText);
      setPatientId(s.patientId || '');
      if (s.patientId) setActivePatient(s.patientId);
      if (s.overrides) setOverrides(s.overrides);
      if (s.currentResult) {
        const r = s.currentResult as unknown as CaseAnalysisData;
        // Guard against old stored sessions missing array fields
        r.treatment_options = r.treatment_options || [];
        r.clinical_pearls = r.clinical_pearls || [];
        r.papers_reviewed = r.papers_reviewed || [];
        if (r.medication_review) {
          r.medication_review.interactions = r.medication_review.interactions || [];
          r.medication_review.renal_flags = r.medication_review.renal_flags || [];
          r.medication_review.duplicate_therapy = r.medication_review.duplicate_therapy || [];
        }
        setResult(r);
        if (r.parsed_case) setParsedCase(r.parsed_case);
        if (r.suggested_followups?.length) setSuggestedQuestions(r.suggested_followups);
      }
      if (s.followUpMessages?.length) setFollowUpMessages(s.followUpMessages);
      if (s.activeTab) setActiveTab(TAB_MIGRATION[s.activeTab] || s.activeTab);
      if (s.chatOpen) setChatOpen(s.chatOpen);
      if (s.agentResult) {
        if (s.agentResult.assessment) setAgentAssessment(s.agentResult.assessment);
        if (s.agentResult.consensus) setAgentConsensus(s.agentResult.consensus);
        if (s.agentResult.toolResults) setAgentToolResults(s.agentResult.toolResults);
        if (s.agentResult.toolsUsed) setAgentToolsUsed(s.agentResult.toolsUsed);
      }
    }
  }, [session.isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-submit on interview handoff
  useEffect(() => {
    if (handoffAutoSubmitRef.current && caseText.trim().length >= MIN_CASE_LENGTH && !isLoading && !result) {
      handoffAutoSubmitRef.current = false;
      // Trigger submit programmatically
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      handleSubmit(fakeEvent);
    }
  }, [caseText]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    followUpEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [followUpMessages]);

  useEffect(() => {
    if (session.currentSession && followUpMessages.length > 0) {
      session.updateFollowUpMessages(followUpMessages);
    }
  }, [followUpMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save case text to session as user types (debounced)
  const caseTextSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!session.currentSession || !caseText || isLoading) return;
    if (caseText === session.currentSession.currentCaseText) return;
    if (caseTextSaveRef.current) clearTimeout(caseTextSaveRef.current);
    caseTextSaveRef.current = setTimeout(() => {
      session.saveSession({
        ...session.currentSession!,
        currentCaseText: caseText,
        updatedAt: new Date().toISOString(),
      });
    }, 1000);
    return () => { if (caseTextSaveRef.current) clearTimeout(caseTextSaveRef.current); };
  }, [caseText]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const apiUrl = getApiUrl();
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
          session_id: session.currentSession?.id || null,
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
    setAgentAssessment(null);
    setAgentConsensus(null);
    setAgentToolResults([]);
    setAgentToolsUsed([]);
    setAgentStreamEvents([]);
    setInterviewDDx(null);
  };

  const runAgentReasoning = useCallback(async (analysisText: string, resultData: CaseAnalysisData) => {
    setCurrentStep('agent_reasoning');
    setStepMessage('Running clinical reasoning agent...');
    setAgentStreamEvents([]);

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/agent/reason/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_text: analysisText,
          parsed_case: resultData.parsed_case || null,
        }),
      });

      if (!response.ok) {
        console.warn('Agent reasoning failed:', response.status);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (part.startsWith(': heartbeat')) continue;
          const dataLine = part.split('\n').find(l => l.startsWith('data: '));
          if (!dataLine) continue;

          try {
            const event = JSON.parse(dataLine.slice(6));

            // Update inline progress display
            if (event.type === 'thinking') {
              setAgentStreamEvents(prev => [...prev, { type: 'thinking', text: event.reasoning }]);
              setStepMessage(event.reasoning.slice(0, 80) + '...');
            } else if (event.type === 'tool_call') {
              const toolLabel = event.tool?.replace(/_/g, ' ') || 'tool';
              setAgentStreamEvents(prev => [...prev, { type: 'tool_call', text: `Invoking ${toolLabel}`, tool: event.tool, model: event.model }]);
              setStepMessage(`Invoking ${toolLabel}...`);
            } else if (event.type === 'tool_result') {
              setAgentStreamEvents(prev => [...prev, { type: 'tool_result', text: `${event.tool?.replace(/_/g, ' ')} complete`, tool: event.tool }]);
              if (event.tool && event.result) {
                // Find the matching tool_call for its model
                handleAgentToolResult(event.tool, '', event.result);
              }
            } else if (event.type === 'assessment') {
              setAgentStreamEvents(prev => [...prev, { type: 'assessment', text: event.final_assessment?.primary_diagnosis || 'Assessment complete' }]);
              handleAgentAssessment(event.final_assessment, event.tools_used);
            } else if (event.type === 'consensus') {
              setAgentStreamEvents(prev => [...prev, { type: 'consensus', text: 'Cross-modal consensus built' }]);
              handleAgentConsensus(event.consensus);
            } else if (event.type === 'done') {
              setCompletedSteps(prev => new Set([...Array.from(prev), 'agent_reasoning']));
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (err) {
      console.warn('Agent reasoning error:', err);
    }
  }, [handleAgentAssessment, handleAgentConsensus, handleAgentToolResult]);

  const MIN_CASE_LENGTH = 50;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (caseText.trim().length < MIN_CASE_LENGTH || isLoading) return;
    setIsLoading(true);
    resetAnalysisState();
    const title = caseText.trim().slice(0, 60).replace(/\n/g, ' ') + '...';
    if (!session.currentSession) {
      session.createSession(caseText.trim(), title);
    } else {
      // Update existing session with latest text before analyzing
      session.saveSession({
        ...session.currentSession,
        currentCaseText: caseText.trim(),
        updatedAt: new Date().toISOString(),
      });
    }
    if (patientId.trim()) session.updatePatientId(patientId.trim());

    // Enrich case text with patient medical context
    let analysisText = caseText.trim();
    if (linkedPatient) {
      const ctx: string[] = [];
      const age = getPatientAge(linkedPatient);
      const sex = linkedPatient.sex;
      ctx.push(`Patient: ${age}yo ${sex === 'male' ? 'male' : sex === 'female' ? 'female' : 'patient'}`);
      if (linkedPatient.conditions?.length > 0) ctx.push(`PMH: ${linkedPatient.conditions.join(', ')}`);
      if (linkedPatient.medications?.length > 0) ctx.push(`Current medications: ${linkedPatient.medications.join(', ')}`);
      if (linkedPatient.allergies?.length > 0) ctx.push(`Allergies: ${linkedPatient.allergies.join(', ')}`);
      const contextBlock = ctx.join('. ') + '.';
      if (!analysisText.includes(contextBlock.slice(0, 30))) {
        analysisText = contextBlock + '\n\n' + analysisText;
      }
    }

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/case/analyze/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_text: analysisText }),
      });
      if (!response.ok) throw new Error('Failed to start analysis');
      let resultData: CaseAnalysisData | null = null;
      await processSSEStream(response, (data) => {
        resultData = data;
        session.updateResult(data as unknown as Record<string, unknown>);
        session.addEvent({ type: 'initial_analysis', changeSummary: `Initial analysis: ${data.top_recommendation || 'No recommendation'}` });
      });

      // Auto-trigger agent reasoning after main analysis completes
      if (resultData) {
        await runAgentReasoning(analysisText, resultData);
      }
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
      const apiUrl = getApiUrl();
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
        // Insert divider in follow-up chat so doctor knows context changed
        const dividerMsg: FollowUpMessage = {
          id: `divider-${Date.now()}`,
          role: 'assistant',
          content: changed
            ? `--- Case reassessed with new findings. Recommendation changed to: **${resultData.top_recommendation}**. Subsequent answers reference the updated analysis. ---`
            : `--- Case reassessed with new findings. Recommendation unchanged: **${resultData.top_recommendation}**. Subsequent answers reference the updated analysis. ---`,
        };
        setFollowUpMessages(prev => [...prev, dividerMsg]);
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
      setPatientId(loaded.patientId || '');
      if (loaded.patientId) setActivePatient(loaded.patientId);
      else clearActivePatient();
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
      if (loaded.agentResult) {
        if (loaded.agentResult.assessment) setAgentAssessment(loaded.agentResult.assessment);
        if (loaded.agentResult.consensus) setAgentConsensus(loaded.agentResult.consensus);
        if (loaded.agentResult.toolResults) setAgentToolResults(loaded.agentResult.toolResults);
        if (loaded.agentResult.toolsUsed) setAgentToolsUsed(loaded.agentResult.toolsUsed);
      } else {
        setAgentAssessment(null);
        setAgentConsensus(null);
        setAgentToolResults([]);
        setAgentToolsUsed([]);
      }
    }
  };

  const handleNewCase = () => {
    session.clearCurrentSession();
    setCaseText('');
    setPatientId('');
    resetAnalysisState();
  };

  const handleImageUpload = useCallback(async (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setIsImageLoading(true);
    setImageResult(null);
    try {
      const apiUrl = getApiUrl();
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
      const apiUrl = getApiUrl();
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
    // If we have an existing analysis, trigger reassessment with the new lab data
    if (result) {
      const findings: NewFindings = {
        category: 'labs',
        text: labText,
      };
      handleAddFindings(findings);
    }
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDictationTranscript = useCallback((text: string) => {
    setCaseText(prev => prev ? prev + '\n' + text : text);
    setDictationUsed(true);
  }, []);

  const loadExample = () => {
    const key = EXAMPLE_CASE_KEYS[exampleIndex];
    setCaseText(EXAMPLE_CASES[key].text);
    setExampleIndex((exampleIndex + 1) % EXAMPLE_CASE_KEYS.length);
  };

  // Merge agent risk scores with main analysis scores
  const { mergedRiskScores, agentScoreIds } = useMemo(() => {
    const mainScores = result?.clinical_risk_scores || null;
    const agentRiskResult = agentToolResults.find(tr => tr.tool === 'compute_risk_scores');
    if (!agentRiskResult) return { mergedRiskScores: mainScores, agentScoreIds: new Set<string>() };

    const agentScores = (agentRiskResult.result as { scores?: Array<{ score_id: string; score_name: string; total_score: number; max_score: number; risk_level: string; risk_interpretation: string; recommendation: string; variables: Array<{ name: string; value: number | string | null; source: string; points: number; label: string; criteria: string }>; missing_variables: string[]; applicable: boolean }> })?.scores || [];
    if (agentScores.length === 0) return { mergedRiskScores: mainScores, agentScoreIds: new Set<string>() };

    const existingIds = new Set((mainScores?.scores || []).map(s => s.score_id));
    const newScores = agentScores.filter(s => !existingIds.has(s.score_id));
    const newIds = new Set(newScores.map(s => s.score_id));

    if (newScores.length === 0) return { mergedRiskScores: mainScores, agentScoreIds: new Set<string>() };

    const merged = {
      scores: [...(mainScores?.scores || []), ...newScores.map(s => ({
        ...s,
        variables: s.variables.map(v => ({ ...v, source: v.source as 'deterministic' | 'medgemma' | 'missing' })),
      }))],
      case_category: mainScores?.case_category || '',
      summary: mainScores?.summary || '',
    };

    return { mergedRiskScores: merged, agentScoreIds: newIds };
  }, [result?.clinical_risk_scores, agentToolResults]);

  // Agent diagnosis for DDx tab
  const agentDiagnosis = useMemo(() => {
    if (!agentAssessment?.primary_diagnosis || !agentAssessment?.confidence) return null;
    return {
      primary_diagnosis: agentAssessment.primary_diagnosis,
      confidence: agentAssessment.confidence,
      key_findings: agentAssessment.key_findings,
    };
  }, [agentAssessment]);

  // Build lightweight consensus when agent consensus is unavailable
  const effectiveConsensus = useMemo((): ConsensusData | null => {
    // If full agent consensus exists, use it
    if (agentConsensus) return agentConsensus;
    // If no result yet, nothing to show
    if (!result) return null;

    // Build lightweight consensus from available signals
    const agreements: Array<{ finding: string; models: string[]; confidence: number }> = [];
    const contributingModels: string[] = ['MedGemma'];

    // MedGemma core reasoning
    if (result.top_recommendation) {
      agreements.push({
        finding: `Primary recommendation: ${result.top_recommendation}`,
        models: ['MedGemma'],
        confidence: result.treatment_options.find(t => t.name === result.top_recommendation)?.confidence || 0.8,
      });
    }

    // Risk scores (deterministic)
    if (result.clinical_risk_scores?.scores?.length) {
      const highRisk = result.clinical_risk_scores.scores.filter(s =>
        /high|critical|elevated/i.test(s.risk_level)
      );
      if (highRisk.length > 0) {
        agreements.push({
          finding: `Risk scores: ${highRisk.map(s => `${s.score_name} (${s.risk_level})`).join(', ')}`,
          models: ['Deterministic Scoring'],
          confidence: 0.95,
        });
        if (!contributingModels.includes('Risk Scores')) contributingModels.push('Risk Scores');
      }
    }

    // TxGemma / medication safety
    if (result.medication_review) {
      const mr = result.medication_review;
      const totalFlags = (mr.interactions?.length || 0) + (mr.renal_flags?.length || 0);
      if (totalFlags > 0) {
        agreements.push({
          finding: `Medication safety: ${totalFlags} flag(s) identified`,
          models: ['TxGemma', 'Deterministic'],
          confidence: 0.9,
        });
        if (!contributingModels.includes('TxGemma')) contributingModels.push('TxGemma');
      } else {
        agreements.push({
          finding: 'Medication safety: No significant interactions detected',
          models: ['TxGemma', 'Deterministic'],
          confidence: 0.85,
        });
        if (!contributingModels.includes('TxGemma')) contributingModels.push('TxGemma');
      }
    }

    // Agent tool results — CXR, Derm, etc.
    for (const tr of agentToolResults) {
      const toolModelMap: Record<string, string> = {
        analyze_chest_xray: 'CXR Foundation',
        analyze_skin_lesion: 'Derm Foundation',
        analyze_pathology: 'Path Foundation',
        screen_respiratory: 'HeAR',
        predict_drug_toxicity: 'TxGemma',
      };
      const modelName = toolModelMap[tr.tool];
      if (modelName && !('error' in (tr.result || {}))) {
        if (!contributingModels.includes(modelName)) contributingModels.push(modelName);
      }
    }

    // Disposition agreement
    if (result.acute_management?.disposition && result.acute_management?.risk_stratification) {
      agreements.push({
        finding: `Disposition: ${result.acute_management.disposition} (${result.acute_management.risk_stratification})`,
        models: ['MedGemma'],
        confidence: 0.85,
      });
    }

    if (agreements.length === 0) return null;

    const avgConf = agreements.reduce((sum, a) => sum + a.confidence, 0) / agreements.length;

    return {
      agreements,
      disagreements: [],
      integrated_assessment: `${contributingModels.length} signal source${contributingModels.length !== 1 ? 's' : ''} evaluated. ${agreements.length} points of agreement identified.`,
      overall_confidence: avgConf,
      contributing_models: contributingModels,
    };
  }, [result, agentConsensus, agentToolResults]);

  // Count unacknowledged safety alerts for sidebar badge
  const SERIOUS_KEYWORDS_RE = /contraindicated|avoid|risk|caution|dangerous|toxic|fatal|severe/i;
  const medReviewAlertCount = result?.medication_review
    ? (result.medication_review.renal_flags?.length || 0) +
      (result.medication_review.interactions?.length || 0) +
      (result.medication_review.duplicate_therapy?.length || 0)
    : 0;
  const treatmentAlertCount = result?.treatment_options
    ? result.treatment_options.filter(t => t.verdict === 'not_recommended' && t.cons?.length).length +
      result.treatment_options.filter(t => t.verdict === 'recommended').reduce(
        (acc, t) => acc + (t.cons?.filter(c => SERIOUS_KEYWORDS_RE.test(c)).length || 0), 0
      )
    : 0;
  const safetyAlertCount = medReviewAlertCount + treatmentAlertCount;
  const unackedAlerts = safetyAlertCount - Object.values(overrides.safetyAcknowledgments).filter(a => a.acknowledged).length;

  return (
    <div className="bg-background">
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
            <div className="flex items-center gap-3">
              {saveStatus !== 'idle' && (
                <div className={cn(
                  'flex items-center gap-1.5 text-xs transition-opacity duration-300',
                  saveStatus === 'saved' ? 'text-emerald-600' : 'text-muted-foreground',
                )}>
                  {saveStatus === 'saving' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
                </div>
              )}
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
          </div>
        </header>

        {linkedPatient && (
          <PatientContextCard
            patient={linkedPatient}
            onUnlink={() => handlePatientSelect(null)}
          />
        )}

        {/* Triage Data Banner — show when patient linked and no analysis yet */}
        {linkedPatient && !result && (
          <TriageDataBanner
            patientId={linkedPatient.id}
            onLoadIntoCase={(text) => setCaseText(text)}
          />
        )}

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
                placeholder="Paste your clinical case here (at least 50 characters)..."
                className="min-h-[140px] text-sm mb-3"
                disabled={isLoading}
              />
              {caseText.trim().length > 0 && caseText.trim().length < MIN_CASE_LENGTH && (
                <p className="text-xs text-amber-500 mb-3 -mt-2">
                  Add more clinical detail — {MIN_CASE_LENGTH - caseText.trim().length} more characters needed
                </p>
              )}
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
                <div className="flex items-center gap-2">
                  <PatientSelector
                    selectedPatientId={patientId || null}
                    onSelect={handlePatientSelect}
                    disabled={isLoading}
                  />
                  {result && parsedCase && !patientId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const params = new URLSearchParams();
                        if (parsedCase.patient?.sex) params.set('sex', parsedCase.patient.sex);
                        if (parsedCase.patient?.age) {
                          const ageNum = parseInt(parsedCase.patient.age);
                          if (!isNaN(ageNum)) {
                            const year = new Date().getFullYear() - ageNum;
                            params.set('dateOfBirth', `${year}-01-01`);
                          }
                        }
                        if (parsedCase.patient?.relevant_history?.length) {
                          params.set('conditions', parsedCase.patient.relevant_history.join(','));
                        }
                        if (parsedCase.management?.medications?.length) {
                          params.set('medications', parsedCase.management.medications.join(','));
                        }
                        router.push(`/patients/new?${params.toString()}`);
                      }}
                    >
                      <UserPlus className="w-4 h-4 mr-1" />
                      Create Patient
                    </Button>
                  )}
                  <Button type="submit" disabled={caseText.trim().length < MIN_CASE_LENGTH || isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
                    {isLoading ? 'Analyzing...' : 'Analyze Case'}
                  </Button>
                </div>
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
              {/* Agent reasoning inline progress */}
              {currentStep === 'agent_reasoning' && agentStreamEvents.length > 0 && (
                <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                  {agentStreamEvents.slice(-5).map((evt, i) => (
                    <div key={i} className={cn(
                      'flex items-center gap-2 text-xs px-2 py-1 rounded',
                      evt.type === 'thinking' && 'text-indigo-600',
                      evt.type === 'tool_call' && 'text-amber-600 font-medium',
                      evt.type === 'tool_result' && 'text-green-600',
                      evt.type === 'assessment' && 'text-green-700 font-semibold',
                      evt.type === 'consensus' && 'text-purple-600 font-semibold',
                    )}>
                      {evt.type === 'thinking' && <Brain className="w-3 h-3 shrink-0" />}
                      {evt.type === 'tool_call' && <Wrench className="w-3 h-3 shrink-0" />}
                      {evt.type === 'tool_result' && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                      {evt.type === 'assessment' && <Sparkles className="w-3 h-3 shrink-0" />}
                      {evt.type === 'consensus' && <Sparkles className="w-3 h-3 shrink-0" />}
                      <span className="truncate">{evt.text}</span>
                      {evt.model && <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{evt.model}</Badge>}
                    </div>
                  ))}
                </div>
              )}
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
            RESULTS — Tab-Based Case File Layout
            ═══════════════════════════════════════════════════════════════ */}
        {result && (
          <div className="space-y-4 animate-fade-in">
            {/* Patient banner in results view */}
            {linkedPatient && <PatientBanner className="mb-0" />}

            {/* Case Summary — always visible */}
            {parsedCase && <CaseSummaryCard parsedCase={parsedCase} />}

            {/* Model Attribution Strip — shows which Google Health AI models contributed */}
            <ModelAttributionStrip
              activeTools={currentStep === 'agent_reasoning'
                ? agentStreamEvents.filter(e => e.type === 'tool_call').map(e => e.tool!).filter(Boolean)
                : []
              }
              usedTools={agentToolsUsed}
              toolResults={agentToolResults}
              isAnalyzing={isLoading}
              dictationUsed={dictationUsed}
              medicationReviewRan={!!result?.medication_review && (
                (result.medication_review.interactions?.length || 0) > 0 ||
                (result.medication_review.renal_flags?.length || 0) > 0 ||
                (result.medication_review.duplicate_therapy?.length || 0) > 0 ||
                !!result.medication_review.renal_function?.egfr
              )}
            />

            {/* Interview DDx Card — shows when case came from interview handoff */}
            {interviewDDx && (
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <ClipboardList className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                      Interview Triage Data
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {'triage' in interviewDDx && interviewDDx.triage != null && (
                      <div>
                        <span className="text-muted-foreground">ESI Level:</span>{' '}
                        <span className="font-medium">{String((interviewDDx.triage as Record<string, unknown>).esi_level || 'N/A')}</span>
                      </div>
                    )}
                    {'recommended_setting' in interviewDDx && interviewDDx.recommended_setting != null && (
                      <div>
                        <span className="text-muted-foreground">Setting:</span>{' '}
                        <span className="font-medium">{String(interviewDDx.recommended_setting)}</span>
                      </div>
                    )}
                    {Array.isArray(interviewDDx.red_flags) && (interviewDDx.red_flags as string[]).length > 0 && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Red Flags:</span>{' '}
                        <span className="font-medium text-red-600">{(interviewDDx.red_flags as string[]).join(', ')}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Safety Alert Banner */}
            <SafetyAlertBanner
              count={unackedAlerts}
              onReview={() => handleTabChange('review')}
            />

            {/* Tabbed Interface */}
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="review" className="gap-1.5 relative">
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clinical Review</span>
                  {unackedAlerts > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                      {unackedAlerts}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="plan" className="gap-1.5 relative">
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Plan &amp; Orders</span>
                  {pendingPatientQuestions > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center font-bold">
                      {pendingPatientQuestions}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="tools" className="gap-1.5">
                  <Wrench className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tools</span>
                </TabsTrigger>
              </TabsList>

              {/* ─── Clinical Review Tab (Assessment + Safety) ─── */}
              <TabsContent value="review" forceMount className={activeTab !== 'review' ? 'hidden' : ''}>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  <div className="lg:col-span-3 space-y-6">
                    {/* Agent Assessment Banner */}
                    {agentAssessment && (
                      <Card className="border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20">
                        <CardContent className="pt-3 pb-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Brain className="w-4 h-4 text-indigo-600" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Agent Assessment</span>
                            {agentAssessment.confidence != null && (
                              <Badge variant="outline" className="ml-auto font-mono text-indigo-700 border-indigo-300">
                                {Math.round(agentAssessment.confidence * 100)}%
                              </Badge>
                            )}
                          </div>
                          {agentAssessment.primary_diagnosis && (
                            <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">{agentAssessment.primary_diagnosis}</p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {agentToolsUsed.map(tool => (
                              <Badge key={tool} variant="secondary" className="text-[10px] bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                                {tool.replace(/_/g, ' ')}
                              </Badge>
                            ))}
                          </div>
                          {agentAssessment.disposition && result.acute_management?.disposition &&
                            agentAssessment.disposition !== result.acute_management.disposition && (
                            <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1.5">
                              Agent disposition: <span className="font-medium">{agentAssessment.disposition}</span>
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    )}
                    {hasAcuteManagement(result.acute_management) && (
                      <AcuteManagementEditor
                        acuteManagement={result.acute_management!}
                        overrides={overrides}
                        onOverridesChange={handleOverridesChange}
                        caseSnippet={caseText.slice(0, 300)}
                      />
                    )}
                    <SafetyAlertsPanel
                      medicationReview={result.medication_review}
                      currentMedications={[
                        ...(result.parsed_case?.management?.medications || []),
                        ...(linkedPatient?.medications || []).filter(
                          (med: string) => !(result.parsed_case?.management?.medications || [])
                            .some((m: string) => m.toLowerCase().includes(med.toLowerCase()))
                        ),
                      ]}
                      newMedications={
                        result.treatment_options
                          ?.filter((t: TreatmentOption) => t.verdict === 'recommended')
                          .map((t: TreatmentOption) => t.name) || []
                      }
                      patientConditions={result.parsed_case?.patient?.relevant_history || []}
                      allergies={linkedPatient?.allergies || []}
                      labs={result.parsed_case?.findings?.labs || []}
                      age={result.parsed_case?.patient?.age || ''}
                      sex={result.parsed_case?.patient?.sex || ''}
                      overrides={overrides}
                      onOverridesChange={handleOverridesChange}
                      treatmentOptions={result.treatment_options.map(t => ({
                        name: t.name,
                        verdict: t.verdict,
                        cons: t.cons,
                      }))}
                    />
                    {/* Foundation Model Findings — visual cards from agent tool results */}
                    {agentToolResults.length > 0 && (
                      <FoundationModelFindings toolResults={agentToolResults} />
                    )}
                  </div>
                  <div className="lg:col-span-2 space-y-6">
                    <RiskScoresTab
                      riskScores={mergedRiskScores}
                      caseText={caseText}
                      parsedCase={result.parsed_case as unknown as Record<string, unknown>}
                      overrides={overrides}
                      onOverridesChange={handleOverridesChange}
                      agentScoreIds={agentScoreIds}
                    />
                    <Section
                      title="Differential Diagnosis"
                      icon={<Stethoscope className="w-4 h-4 text-purple-600" />}
                    >
                      <DifferentialDiagnosisTab
                        ddxResult={result.differential_diagnosis || null}
                        caseText={caseText}
                        parsedCase={result.parsed_case as unknown as Record<string, unknown>}
                        agentDiagnosis={agentDiagnosis}
                      />
                    </Section>
                    {(result.clinical_pearls?.length ?? 0) > 0 && (
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
                    {effectiveConsensus && (
                      <Section
                        title="Cross-Modal Consensus"
                        icon={<Sparkles className="w-4 h-4 text-purple-600" />}
                        badge={agentConsensus ? (
                          <Badge variant="secondary" className="text-[9px] bg-purple-100 text-purple-700">Full</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px]">Lightweight</Badge>
                        )}
                      >
                        <ConsensusPanel consensus={effectiveConsensus} />
                      </Section>
                    )}
                    {/* Quality Scorecard — 14-point evaluation */}
                    <QualityScorecard result={result} />
                  </div>
                </div>
              </TabsContent>

              {/* ─── Plan & Orders Tab (Treatment + Orders) ─── */}
              <TabsContent value="plan" forceMount className={activeTab !== 'plan' ? 'hidden' : ''}>
                <div className="space-y-6">
                  {/* Treatment Section */}
                  <TreatmentPlanEditor
                    treatmentOptions={result.treatment_options}
                    topRecommendation={result.top_recommendation}
                    recommendationRationale={result.recommendation_rationale}
                    overrides={overrides}
                    onOverridesChange={handleOverridesChange}
                    caseSnippet={caseText.slice(0, 300)}
                  />
                  {!isLoading && (
                    <AddFindingsForm
                      onAddFindings={handleAddFindings}
                      onReassess={handleReassess}
                      pendingFindings={pendingFindings}
                      isReassessing={isReassessing}
                    />
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TreatmentComparisonChart
                      treatments={result.treatment_options.map(t => ({
                        name: t.name, verdict: t.verdict, confidence: t.confidence,
                        evidence_grade: t.evidence_grade,
                      }))}
                    />
                    <EvidenceRadar data={(() => {
                      try {
                        const treatments = result.treatment_options || [];
                        const papers = result.papers_reviewed || [];
                        if (treatments.length === 0) return undefined;

                        const gradeMap: Record<string, number> = { A: 1, B: 0.75, C: 0.5, D: 0.25 };
                        const grades = treatments.map(t => gradeMap[t.evidence_grade?.charAt(0)?.toUpperCase()] ?? 0.4);
                        const studyQuality = grades.reduce((a, b) => a + b, 0) / grades.length;

                        const years = papers.map(p => parseInt(p.year || '0')).filter(y => y > 2000);
                        const recency = years.length > 0
                          ? Math.min(1, (years.reduce((a, b) => a + b, 0) / years.length - 2015) / 10)
                          : 0.3;

                        const withEvidence = treatments.filter(t => t.key_evidence?.length > 0).length;
                        const consistency = treatments.length > 0 ? withEvidence / treatments.length : 0;

                        const volume = Math.min(1, papers.length / 15);
                        const relevance = treatments.reduce((a, t) => a + (t.confidence || 0), 0) / treatments.length;

                        const allPapers = treatments.flatMap(t => t.papers_used || []);
                        const keywordMatched = allPapers.filter(p => p.match_type === 'keyword').length;
                        const directness = allPapers.length > 0 ? keywordMatched / allPapers.length : 0.3;

                        return [
                          { dimension: 'Study Quality', score: studyQuality },
                          { dimension: 'Recency', score: Math.max(0, recency) },
                          { dimension: 'Consistency', score: consistency },
                          { dimension: 'Volume', score: volume },
                          { dimension: 'Relevance', score: relevance },
                          { dimension: 'Directness', score: directness },
                        ];
                      } catch (e) {
                        console.error('EvidenceRadar IIFE error:', e);
                        return undefined;
                      }
                    })()} />
                  </div>
                  <ReferencesPanel
                    papersReviewed={result.papers_reviewed || []}
                    treatmentOptions={result.treatment_options}
                  />

                  {/* Divider between treatment and orders */}
                  <hr className="border-border" />

                  {/* Orders Section */}
                  <DischargeEditor
                    parsedCase={result.parsed_case as unknown as Record<string, unknown>}
                    treatmentOptions={result.treatment_options as unknown as Array<Record<string, unknown>>}
                    acuteManagement={(result.acute_management || {}) as Record<string, unknown>}
                    topRecommendation={result.top_recommendation}
                    overrides={overrides}
                    onOverridesChange={handleOverridesChange}
                    onPlanChange={handlePlanChange}
                  />
                  <ReferralTab
                    parsedCase={result.parsed_case as unknown as Record<string, unknown>}
                    treatmentOptions={result.treatment_options as unknown as Array<Record<string, unknown>>}
                    acuteManagement={(result.acute_management || {}) as Record<string, unknown>}
                    suggestedConsults={result.acute_management?.consults || []}
                    caseSessionId={session.currentSession?.id}
                    clinicalPearls={result.clinical_pearls}
                    differentialDiagnosis={result.differential_diagnosis as unknown as Record<string, unknown> | null}
                    riskScores={result.clinical_risk_scores as unknown as Record<string, unknown> | null}
                  />

                  {/* Release to Patient */}
                  <Card className="border-emerald-200 dark:border-emerald-800">
                    <CardContent className="pt-5 pb-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <Send className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold">Release to Patient</h3>
                            {existingSummary ? (
                              <p className="text-xs text-emerald-600">
                                Released on {new Date(existingSummary.releasedAt).toLocaleString()}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Patient will see diagnosis, medications, and instructions
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={existingSummary ? 'outline' : 'default'}
                          className={existingSummary ? '' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}
                          onClick={() => setShowSummaryPreview(true)}
                        >
                          <Eye className="w-4 h-4 mr-1.5" />
                          {existingSummary ? 'View / Update' : 'Preview & Release'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  <PatientQuestionsPanel
                    caseSessionId={session.currentSession?.id}
                    patientId={patientId || undefined}
                  />
                </div>
              </TabsContent>

              {/* ─── Tools Tab ─── */}
              <TabsContent value="tools">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  </div>
                  <SOAPExportCard
                    caseText={caseText}
                    topRecommendation={result.top_recommendation}
                    acuteManagement={result.acute_management}
                    treatmentOptions={result.treatment_options.map(t => ({ name: t.name, verdict: t.verdict }))}
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const soap = buildSOAPFromCase(result, caseText);
                      sessionStorage.setItem('case-to-chart-soap', JSON.stringify(soap));
                      router.push('/chart');
                    }}
                  >
                    <FileBarChart className="w-4 h-4 mr-2" />
                    Send to Chart
                  </Button>
                  {session.currentSession && (session.currentSession.events?.length ?? 0) > 0 && (
                    <>
                      <Section
                        title="Visual Timeline"
                        icon={<BarChart3 className="w-4 h-4 text-indigo-600" />}
                      >
                        <CaseTimelineD3
                          events={session.currentSession.events.map(e => ({
                            type: e.type, timestamp: e.timestamp, changeSummary: e.changeSummary || '',
                            findings: e.findings ? { [e.findings.category]: e.findings.text } : undefined,
                          }))}
                        />
                      </Section>
                      <Section
                        title="Case Timeline"
                        icon={<Activity className="w-4 h-4 text-muted-foreground" />}
                        defaultOpen={false}
                      >
                        <CaseTimeline events={session.currentSession.events} />
                      </Section>
                    </>
                  )}
                </div>
              </TabsContent>

            </Tabs>

            {/* Floating Follow-Up Chat Drawer */}
            <FollowUpChatDrawer
              isOpen={chatOpen}
              onToggle={handleChatToggle}
              followUpMessages={followUpMessages}
              followUpInput={followUpInput}
              setFollowUpInput={setFollowUpInput}
              handleFollowUpSubmit={handleFollowUpSubmit}
              isFollowUpLoading={isFollowUpLoading}
              suggestedQuestions={suggestedQuestions}
              followUpEndRef={followUpEndRef}
            />

            <p className="text-center text-[10px] text-muted-foreground pt-2">
              Powered by 7 Google Health AI Models &middot; MedGemma &middot; CXR Foundation &middot; Derm Foundation &middot; Path Foundation &middot; TxGemma &middot; HeAR &middot; MedASR
            </p>
          </div>
        )}

        <DictationModal
          isOpen={showDictation}
          onClose={() => setShowDictation(false)}
          onTranscript={handleDictationTranscript}
        />

        <PatientSummaryPreview
          isOpen={showSummaryPreview}
          onClose={() => setShowSummaryPreview(false)}
          onRelease={handleReleaseSummary}
          summary={previewSummary}
          isReleasing={isReleasingSummary}
          hasDischargePlan={dischargePlanRef.current !== null}
        />
      </div>
    </div>
  );
}
