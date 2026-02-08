'use client';

import { useState, useRef, useEffect, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import {
  Stethoscope,
  Loader2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  User,
  Activity,
  Pill,
  FileText,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Clock,
  Beaker,
  ExternalLink,
  ArrowLeft,
  Clipboard,
  ShieldAlert,
  MessageCircle,
  Send,
  Mic,
  Download,
  Camera,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useCaseSession } from '@/hooks/useCaseSession';
import { CaseSessionList } from '@/components/case/CaseSessionList';
import { CaseTimeline } from '@/components/case/CaseTimeline';
import { AddFindingsForm } from '@/components/case/AddFindingsForm';
import { ImageAnalysisCard } from '@/components/case/ImageAnalysisCard';
import { LabExtractorCard } from '@/components/case/LabExtractorCard';
import { DictationModal } from '@/components/case/DictationModal';
import { SOAPExportCard } from '@/components/case/SOAPExportCard';
import { CaseReportExport } from '@/components/case/CaseReportExport';
import { TreatmentComparisonChart } from '@/components/visualizations/TreatmentComparisonChart';
import { EvidenceRadar } from '@/components/visualizations/EvidenceRadar';
import { CaseTimelineD3 } from '@/components/visualizations/CaseTimelineD3';
import type { NewFindings } from '@/lib/storage';

// Types
interface StepUpdate {
  type: 'step';
  step: string;
  status: string;
  message: string;
  progress: number;
  data?: Record<string, unknown>;
}

interface TreatmentOption {
  name: string;
  mechanism: string;
  verdict: 'recommended' | 'consider' | 'not_recommended';
  confidence: number;
  fda_approved: boolean;
  fda_indication: string;
  evidence_grade: string;
  pros: string[];
  cons: string[];
  key_evidence: Array<{ finding: string; pmid?: string; year?: string; title?: string }>;
  rationale: string;
  papers_used: Array<{
    pmid: string;
    title: string;
    match_type: 'keyword' | 'general';
    matched_words: string[];
  }>;
}

interface ParsedCase {
  patient: {
    age: string;
    sex: string;
    relevant_history: string[];
  };
  findings: {
    presentation: string;
    timeline: string;
    physical_exam: string[];
    labs: string[];
    imaging: string[];
  };
  management: {
    medications: string[];
    recent_changes: string;
    response_to_treatment: string;
  };
  clinical_question: string;
  case_category: string;
}

interface AcuteManagement {
  risk_stratification?: string;
  immediate_actions?: string[];
  do_not_do?: string[];
  monitoring_plan?: string[];
  disposition?: string;
  consults?: string[];
  activity_restrictions?: string;
  key_counseling?: string[];
  metabolic_corrections?: string[];
}

interface MedicationReview {
  renal_flags: Array<{
    drug: string;
    severity: 'critical' | 'warning';
    action: string;
    parameter: string;
    value: number;
  }>;
  interactions: Array<{
    drug_a: string;
    drug_b: string;
    severity: 'major' | 'moderate' | 'minor';
    effect: string;
    recommendation: string;
  }>;
  duplicate_therapy: Array<{
    drugs: string[];
    drug_class: string;
    recommendation: string;
  }>;
  renal_function: {
    egfr: number | null;
    creatinine: number | null;
  };
}

interface CaseAnalysisResult {
  type: 'result';
  data: {
    parsed_case: ParsedCase;
    treatment_options: TreatmentOption[];
    top_recommendation: string;
    recommendation_rationale: string;
    clinical_pearls: string[];
    papers_reviewed: Array<{
      pmid: string;
      title: string;
      year?: string;
    }>;
    search_terms_used: string[];
    acute_management?: AcuteManagement;
    suggested_followups?: string[];
    medication_review?: MedicationReview;
  };
}

interface FollowUpMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

type SSEEvent = StepUpdate | CaseAnalysisResult | { type: 'done' } | { type: 'error'; message: string };

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
  { id: 'parsing', label: 'Parse Case', icon: FileText },
  { id: 'generating_options', label: 'Generate Options', icon: Lightbulb },
  { id: 'evidence_search', label: 'Search Evidence', icon: Beaker },
  { id: 'evaluating', label: 'Evaluate', icon: Activity },
  { id: 'medication_review', label: 'Med Review', icon: Pill },
  { id: 'complete', label: 'Complete', icon: CheckCircle2 },
];

function VerdictBadge({ verdict }: { verdict: string }) {
  const config = {
    recommended: { label: 'Recommended', class: 'bg-green-500/10 text-green-600 border-green-500/30', icon: ThumbsUp },
    consider: { label: 'Consider', class: 'bg-amber-500/10 text-amber-600 border-amber-500/30', icon: Minus },
    not_recommended: { label: 'Not Recommended', class: 'bg-red-500/10 text-red-600 border-red-500/30', icon: ThumbsDown },
  };

  const c = config[verdict as keyof typeof config] || config.consider;
  const Icon = c.icon;

  return (
    <Badge variant="outline" className={cn('gap-1.5 font-semibold', c.class)}>
      <Icon className="w-3 h-3" />
      {c.label}
    </Badge>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    high: 'default',
    moderate: 'secondary',
    low: 'outline',
    very_low: 'destructive',
  };

  return (
    <Badge variant={variants[grade?.toLowerCase()] || 'secondary'} className="text-xs">
      {grade?.replace('_', ' ').toUpperCase() || 'MODERATE'} evidence
    </Badge>
  );
}

function TreatmentCard({ option, isTop }: { option: TreatmentOption; isTop: boolean }) {
  const [expanded, setExpanded] = useState(isTop);

  return (
    <Card className={cn(
      'transition-all border-l-4',
      isTop && 'ring-2 ring-primary border-primary/50',
      option.verdict === 'recommended' && 'border-l-green-500',
      option.verdict === 'consider' && 'border-l-amber-500',
      option.verdict === 'not_recommended' && 'border-l-red-500 opacity-75',
    )}>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {isTop && (
                    <Badge className="bg-primary text-primary-foreground text-[10px]">
                      TOP PICK
                    </Badge>
                  )}
                  <VerdictBadge verdict={option.verdict} />
                  <GradeBadge grade={option.evidence_grade} />
                </div>
                <CardTitle className="text-lg">{option.name}</CardTitle>
                <CardDescription className="mt-1">{option.mechanism}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">
                    {Math.round(option.confidence * 100)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">confidence</p>
                </div>
                <ChevronDown className={cn('w-5 h-5 transition-transform', expanded && 'rotate-180')} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* FDA Status */}
            {option.fda_approved && (
              <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-700">
                  FDA Approved: {option.fda_indication}
                </span>
              </div>
            )}

            {/* Rationale */}
            <div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {option.rationale}
              </p>
            </div>

            <Separator />

            {/* Pros & Cons */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-green-600 mb-2">
                  Pros
                </p>
                <ul className="space-y-1">
                  {option.pros.map((pro, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-red-600 mb-2">
                  Cons
                </p>
                <ul className="space-y-1">
                  {option.cons.map((con, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{con}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Evidence Trail */}
            {(option.papers_used?.length > 0 || option.key_evidence.length > 0) && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Evidence Trail
                    </p>
                    {option.papers_used?.length > 0 && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <FileText className="w-2.5 h-2.5" />
                        {option.papers_used.length} paper{option.papers_used.length !== 1 ? 's' : ''}
                        {option.papers_used.some(p => p.match_type === 'keyword')
                          ? ' (keyword match)'
                          : ' (general)'}
                        {' + medical knowledge'}
                      </Badge>
                    )}
                  </div>
                  {/* Show key_evidence if available, otherwise fall back to papers_used */}
                  {option.key_evidence.length > 0 ? (
                    <ul className="space-y-3">
                      {option.key_evidence.map((ev, i) => {
                        const paperUsed = option.papers_used?.find(p => p.pmid === ev.pmid);
                        return (
                          <li key={i} className="text-sm p-3 bg-muted/30 rounded-lg border border-border/50">
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                {ev.pmid && /^\d{7,9}$/.test(ev.pmid) && (
                                  <a
                                    href={`https://pubmed.ncbi.nlm.nih.gov/${ev.pmid}/`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline font-medium"
                                  >
                                    PMID: {ev.pmid} {ev.year && `(${ev.year})`}
                                  </a>
                                )}
                                {ev.pmid && /^PMC\d+$/i.test(ev.pmid) && (
                                  <a
                                    href={`https://www.ncbi.nlm.nih.gov/pmc/articles/${ev.pmid}/`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline font-medium"
                                  >
                                    {ev.pmid} {ev.year && `(${ev.year})`}
                                  </a>
                                )}
                              </div>
                              {ev.pmid && (
                                <a
                                  href={
                                    /^\d{7,9}$/.test(ev.pmid)
                                      ? `https://pubmed.ncbi.nlm.nih.gov/${ev.pmid}/`
                                      : `https://www.ncbi.nlm.nih.gov/pmc/articles/${ev.pmid}/`
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 flex-shrink-0"
                                >
                                  View on PubMed
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            {ev.title && (
                              <p className="font-medium text-foreground text-sm mb-1.5">{ev.title}</p>
                            )}
                            {paperUsed && (
                              <p className="text-[11px] text-muted-foreground mb-1.5">
                                Match: {paperUsed.match_type === 'keyword'
                                  ? `keyword (${paperUsed.matched_words.map(w => `"${w}"`).join(', ')})`
                                  : 'general — no specific keyword match found'}
                              </p>
                            )}
                            {ev.finding && (
                              <div className="p-2 bg-background/50 rounded border border-border/30">
                                <p className="text-xs text-muted-foreground italic leading-relaxed">
                                  &ldquo;{ev.finding}&rdquo;
                                </p>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : option.papers_used?.length > 0 ? (
                    <ul className="space-y-3">
                      {option.papers_used.map((paper, i) => (
                        <li key={i} className="text-sm p-3 bg-muted/30 rounded-lg border border-border/50">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                              <a href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`}
                                 target="_blank" rel="noopener noreferrer"
                                 className="text-xs text-primary hover:underline font-medium">
                                PMID: {paper.pmid}
                              </a>
                            </div>
                            <a href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`}
                               target="_blank" rel="noopener noreferrer"
                               className="text-xs text-primary hover:underline inline-flex items-center gap-1 flex-shrink-0">
                              View on PubMed <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          {paper.title && <p className="font-medium text-foreground text-sm mb-1.5">{paper.title}</p>}
                          <p className="text-[11px] text-muted-foreground">
                            Match: {paper.match_type === 'keyword'
                              ? `keyword (${paper.matched_words.map(w => `"${w}"`).join(', ')})`
                              : 'general — no specific keyword match found'}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function hasMedicationReview(mr?: MedicationReview): boolean {
  if (!mr) return false;
  return (
    (mr.renal_flags && mr.renal_flags.length > 0) ||
    (mr.interactions && mr.interactions.length > 0) ||
    (mr.duplicate_therapy && mr.duplicate_therapy.length > 0)
  ) as boolean;
}

function MedicationReviewCard({ review }: { review: MedicationReview }) {
  return (
    <Card className="border-purple-500/50 bg-gradient-to-br from-purple-500/5 to-transparent">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-purple-600" />
            <CardTitle className="text-purple-700">Medication Review</CardTitle>
          </div>
          {(review.renal_function?.egfr != null || review.renal_function?.creatinine != null) && (
            <div className="flex gap-2">
              {review.renal_function.egfr != null && (
                <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-500/30">
                  eGFR: {review.renal_function.egfr}
                </Badge>
              )}
              {review.renal_function.creatinine != null && (
                <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-500/30">
                  Cr: {review.renal_function.creatinine}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Renal Dosing Adjustments */}
        {review.renal_flags && review.renal_flags.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-600 mb-2">
              Renal Dosing Adjustments
            </p>
            <div className="space-y-2">
              {review.renal_flags.map((flag, i) => (
                <div key={i} className={cn(
                  'p-3 rounded-lg border',
                  flag.severity === 'critical'
                    ? 'bg-red-500/10 border-red-500/20'
                    : 'bg-amber-500/10 border-amber-500/20'
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={cn(
                      'text-[10px]',
                      flag.severity === 'critical'
                        ? 'bg-red-500/20 text-red-700 border-red-500/30'
                        : 'bg-amber-500/20 text-amber-700 border-amber-500/30'
                    )}>
                      {flag.severity.toUpperCase()}
                    </Badge>
                    <span className="font-medium text-sm capitalize">{flag.drug}</span>
                    <span className="text-xs text-muted-foreground">
                      ({flag.parameter}: {flag.value})
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{flag.action}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Drug Interactions */}
        {review.interactions && review.interactions.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-600 mb-2">
              Drug Interactions
            </p>
            <div className="space-y-2">
              {review.interactions.map((ix, i) => (
                <div key={i} className={cn(
                  'p-3 rounded-lg border',
                  ix.severity === 'major'
                    ? 'bg-red-500/10 border-red-500/20'
                    : ix.severity === 'moderate'
                    ? 'bg-amber-500/10 border-amber-500/20'
                    : 'bg-blue-500/10 border-blue-500/20'
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={cn(
                      'text-[10px]',
                      ix.severity === 'major'
                        ? 'bg-red-500/20 text-red-700 border-red-500/30'
                        : ix.severity === 'moderate'
                        ? 'bg-amber-500/20 text-amber-700 border-amber-500/30'
                        : 'bg-blue-500/20 text-blue-700 border-blue-500/30'
                    )}>
                      {ix.severity.toUpperCase()}
                    </Badge>
                    <span className="font-medium text-sm">
                      {ix.drug_a} + {ix.drug_b}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{ix.effect}</p>
                  {ix.recommendation && (
                    <p className="text-sm text-foreground mt-1 font-medium">{ix.recommendation}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Duplicate Therapy */}
        {review.duplicate_therapy && review.duplicate_therapy.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-600 mb-2">
              Duplicate Therapy
            </p>
            <div className="space-y-2">
              {review.duplicate_therapy.map((dup, i) => (
                <div key={i} className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px] bg-purple-500/20 text-purple-700 border-purple-500/30">
                      DUPLICATE
                    </Badge>
                    <span className="font-medium text-sm">
                      {dup.drugs.join(' + ')}
                    </span>
                    <span className="text-xs text-muted-foreground">({dup.drug_class})</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{dup.recommendation}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function hasAcuteManagement(am?: AcuteManagement): boolean {
  if (!am) return false;
  return (
    !!am.risk_stratification ||
    (am.immediate_actions && am.immediate_actions.length > 0) ||
    (am.do_not_do && am.do_not_do.length > 0) ||
    (am.monitoring_plan && am.monitoring_plan.length > 0) ||
    (am.consults && am.consults.length > 0) ||
    !!am.disposition ||
    !!am.activity_restrictions ||
    (am.key_counseling && am.key_counseling.length > 0) ||
    (am.metabolic_corrections && am.metabolic_corrections.length > 0)
  ) as boolean;
}

export default function CaseAnalysisPage() {
  const [caseText, setCaseText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [stepProgress, setStepProgress] = useState(0);
  const [stepMessage, setStepMessage] = useState('');
  const [parsedCase, setParsedCase] = useState<ParsedCase | null>(null);
  const [result, setResult] = useState<CaseAnalysisResult['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [showParsedCase, setShowParsedCase] = useState(true);
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

  // Case session state
  const session = useCaseSession();

  // Restore session state on mount (or from ?session= query param)
  useEffect(() => {
    if (!session.isLoaded) return;

    // Check for session ID in URL (e.g. from home page recent sessions)
    const params = new URLSearchParams(window.location.search);
    const urlSessionId = params.get('session');
    if (urlSessionId) {
      handleLoadSession(urlSessionId);
      // Clean up URL so refresh doesn't re-trigger
      window.history.replaceState({}, '', '/case');
      return;
    }

    if (session.currentSession) {
      const s = session.currentSession;
      setCaseText(s.currentCaseText);
      if (s.currentResult) {
        const r = s.currentResult as unknown as CaseAnalysisResult['data'];
        setResult(r);
        if (r.parsed_case) {
          setParsedCase(r.parsed_case);
        }
        if (r.suggested_followups?.length) {
          setSuggestedQuestions(r.suggested_followups);
        }
      }
      if (s.followUpMessages?.length) {
        setFollowUpMessages(s.followUpMessages);
      }
    }
  }, [session.isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    followUpEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [followUpMessages]);

  // Persist follow-up messages when they change
  useEffect(() => {
    if (session.currentSession && followUpMessages.length > 0) {
      session.updateFollowUpMessages(followUpMessages);
    }
  }, [followUpMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  // SSE stream helper — shared between analyze and reassess
  const processSSEStream = useCallback(async (
    response: Response,
    onResult: (data: CaseAnalysisResult['data']) => void,
  ) => {
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
              // Capture evaluated treatment options as they stream in
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
          } catch (e) {
            console.error('SSE parse error:', e);
          }
        }
      }
    }
  }, []);

  const handleFollowUpSubmit = async (question: string) => {
    if (!question.trim() || isFollowUpLoading || !result) return;

    const userMsg: FollowUpMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question.trim(),
    };
    setFollowUpMessages(prev => [...prev, userMsg]);
    setFollowUpInput('');
    setIsFollowUpLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const conversationHistory = followUpMessages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Slim payload: only send what the backend needs
      const slimSummary = {
        top_recommendation: result.top_recommendation,
        recommendation_rationale: result.recommendation_rationale,
        treatment_options: result.treatment_options.map(t => ({
          name: t.name,
          verdict: t.verdict,
        })),
        parsed_case: {
          case_category: result.parsed_case?.case_category || '',
        },
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
          conversation_history: conversationHistory,
        }),
      });

      if (!response.ok) throw new Error('Failed to get follow-up answer');

      const data = await response.json();
      const assistantMsg: FollowUpMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
      };
      setFollowUpMessages(prev => [...prev, assistantMsg]);

      if (data.suggested_questions?.length > 0) {
        setSuggestedQuestions(data.suggested_questions);
      }
    } catch {
      const errorMsg: FollowUpMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I was unable to answer that question. Please try again.',
      };
      setFollowUpMessages(prev => [...prev, errorMsg]);
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
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!caseText.trim() || isLoading) return;

    setIsLoading(true);
    resetAnalysisState();

    // Create or update session
    const title = caseText.trim().slice(0, 60).replace(/\n/g, ' ') + '...';
    if (!session.currentSession) {
      session.createSession(caseText.trim(), title);
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const response = await fetch(`${apiUrl}/api/case/analyze/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_text: caseText.trim() }),
      });

      if (!response.ok) throw new Error('Failed to start analysis');

      await processSSEStream(response, (resultData) => {
        // Save result to session
        session.updateResult(resultData as unknown as Record<string, unknown>);
        session.addEvent({
          type: 'initial_analysis',
          changeSummary: `Initial analysis: ${resultData.top_recommendation || 'No recommendation'}`,
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFindings = (findings: NewFindings) => {
    setPendingFindings(prev => [...prev, findings]);
    // Add to session timeline
    session.addEvent({
      type: 'new_findings',
      findings,
      changeSummary: `Added ${findings.category.replace('_', ' ')}: ${findings.text.slice(0, 60)}`,
    });
    // Merge into case text
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
          new_findings: pendingFindings.map(f => ({
            category: f.category,
            text: f.text,
            clinical_time: f.clinicalTime || '',
          })),
          previous_parsed_case: result.parsed_case,
          previous_search_terms: result.search_terms_used || [],
          previous_papers: result.papers_reviewed || [],
        }),
      });

      if (!response.ok) throw new Error('Failed to start reassessment');

      const previousTopRec = result.top_recommendation;

      await processSSEStream(response, (resultData) => {
        // Update session with new result
        session.updateResult(resultData as unknown as Record<string, unknown>);

        // Compute change summary
        const newTopRec = resultData.top_recommendation;
        const changed = newTopRec !== previousTopRec;
        const summary = changed
          ? `Reassessment: recommendation changed from "${previousTopRec}" to "${newTopRec}"`
          : `Reassessment complete: recommendation unchanged (${newTopRec})`;

        session.addEvent({
          type: 'reassessment_complete',
          changeSummary: summary,
        });

        // Update case text with merged text from session
        if (session.currentSession) {
          setCaseText(session.currentSession.currentCaseText);
        }
      });

      // Clear pending findings after successful reassessment
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
      if (loaded.currentResult) {
        const r = loaded.currentResult as unknown as CaseAnalysisResult['data'];
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

  // Image analysis handler
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

      const response = await fetch(`${apiUrl}/api/case/image/analyze`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Image analysis failed');
      setImageResult(await response.json());
    } catch {
      setImageResult({
        modality: 'unknown', findings: ['Analysis failed'], impression: '',
        differential_diagnoses: [], confidence: 0, recommendations: [], model: 'error',
      });
    } finally {
      setIsImageLoading(false);
    }
  }, [caseText]);

  const handleImageImportToCase = useCallback((findings: string[]) => {
    const findingsText = findings.join('; ');
    setCaseText(prev => prev + '\n\nImaging findings: ' + findingsText);
  }, []);

  // Lab extraction handler
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

  // Dictation handler
  const handleDictationTranscript = useCallback((text: string) => {
    setCaseText(prev => prev ? prev + '\n' + text : text);
  }, []);

  const loadExample = () => {
    const key = EXAMPLE_CASE_KEYS[exampleIndex];
    setCaseText(EXAMPLE_CASES[key].text);
    setExampleIndex((exampleIndex + 1) % EXAMPLE_CASE_KEYS.length);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <Stethoscope className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Clinical Case Analyzer</h1>
              <p className="text-sm text-muted-foreground">
                Evidence-based treatment recommendations powered by MedGemma 27B + PubMed
              </p>
            </div>
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
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit}>
              <Textarea
                value={caseText}
                onChange={(e) => setCaseText(e.target.value)}
                placeholder="Paste your clinical case here...

Example: A 21-year-old male presents with neck stiffness and pain for 3 days..."
                className="min-h-[200px] text-sm mb-4"
                disabled={isLoading}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadExample}
                    disabled={isLoading}
                  >
                    <Clipboard className="w-4 h-4 mr-2" />
                    {EXAMPLE_CASES[EXAMPLE_CASE_KEYS[exampleIndex]].label}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDictation(true)}
                    disabled={isLoading}
                  >
                    <Mic className="w-4 h-4 mr-2" />
                    Dictate
                  </Button>
                </div>
                <Button type="submit" disabled={!caseText.trim() || isLoading}>
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  {isLoading ? 'Analyzing...' : 'Analyze Case'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <div>
                  <CardTitle className="text-lg">
                    {isReassessing ? 'Reassessing Case...' : 'Analyzing Case...'}
                  </CardTitle>
                  <CardDescription>{stepMessage || 'Starting analysis'}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                {PIPELINE_STEPS.map((step) => {
                  const isCompleted = completedSteps.has(step.id);
                  const isCurrent = currentStep === step.id;
                  const Icon = step.icon;
                  return (
                    <div key={step.id} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                        isCompleted ? 'bg-primary text-primary-foreground' :
                        isCurrent ? 'bg-primary/20 text-primary animate-pulse' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                      </div>
                      <p className={cn(
                        'text-[10px] text-center font-medium',
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

        {/* Progressive Treatment Cards During Loading */}
        {isLoading && streamingOptions.length > 0 && !result && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-4">
              Treatment Options ({streamingOptions.length} evaluated)
            </h2>
            <div className="space-y-3">
              {streamingOptions.map((opt, i) => (
                <Card
                  key={opt.name}
                  className="animate-in slide-in-from-bottom-2 duration-300"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <VerdictBadge verdict={opt.verdict || 'consider'} />
                        <span className="font-medium">{opt.name}</span>
                      </div>
                      <span className="text-lg font-bold text-primary">
                        {Math.round((opt.confidence || 0) * 100)}%
                      </span>
                    </div>
                    {opt.rationale && (
                      <p className="text-sm text-muted-foreground mt-1">{opt.rationale}</p>
                    )}
                    {opt.papers_used && opt.papers_used.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <FileText className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground">
                          {opt.papers_used.length} paper{opt.papers_used.length !== 1 ? 's' : ''}
                          {opt.papers_used.some(p => p.match_type === 'keyword') ? ' (keyword match)' : ' (general)'}
                        </span>
                      </div>
                    )}
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="flex items-center gap-3 pt-6">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Parsed Case Display */}
        {parsedCase && (
          <Collapsible open={showParsedCase} onOpenChange={setShowParsedCase} className="mb-6">
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <CardTitle className="text-base">Case Summary</CardTitle>
                      {parsedCase.case_category && (
                        <Badge variant="secondary">{parsedCase.case_category}</Badge>
                      )}
                    </div>
                    <ChevronDown className={cn('w-5 h-5 transition-transform', showParsedCase && 'rotate-180')} />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 grid grid-cols-2 gap-4">
                  {/* Patient */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <User className="w-4 h-4 text-blue-500" />
                      Patient
                    </div>
                    <div className="text-sm text-muted-foreground pl-6">
                      <p>{parsedCase.patient?.age} {parsedCase.patient?.sex}</p>
                      {parsedCase.patient?.relevant_history?.length > 0 && (
                        <ul className="list-disc list-inside mt-1">
                          {parsedCase.patient.relevant_history.map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Presentation */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Activity className="w-4 h-4 text-purple-500" />
                      Presentation
                    </div>
                    <div className="text-sm text-muted-foreground pl-6">
                      <p>{parsedCase.findings?.presentation}</p>
                      {parsedCase.findings?.timeline && (
                        <p className="flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          {parsedCase.findings.timeline}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Labs & Imaging */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Beaker className="w-4 h-4 text-green-500" />
                      Key Findings
                    </div>
                    <div className="text-sm text-muted-foreground pl-6">
                      {parsedCase.findings?.labs?.length > 0 && (
                        <ul className="list-disc list-inside">
                          {parsedCase.findings.labs.slice(0, 4).map((lab, i) => (
                            <li key={i}>{lab}</li>
                          ))}
                        </ul>
                      )}
                      {parsedCase.findings?.imaging?.length > 0 && (
                        <ul className="list-disc list-inside mt-1">
                          {parsedCase.findings.imaging.map((img, i) => (
                            <li key={i}>{img}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Current Management */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Pill className="w-4 h-4 text-amber-500" />
                      Current Management
                    </div>
                    <div className="text-sm text-muted-foreground pl-6">
                      {parsedCase.management?.medications?.length > 0 && (
                        <ul className="list-disc list-inside">
                          {parsedCase.management.medications.map((med, i) => (
                            <li key={i}>{med}</li>
                          ))}
                        </ul>
                      )}
                      {parsedCase.management?.recent_changes && (
                        <p className="mt-1 italic">{parsedCase.management.recent_changes}</p>
                      )}
                    </div>
                  </div>

                  {/* Clinical Question */}
                  <div className="col-span-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                      Clinical Question
                    </p>
                    <p className="text-sm font-medium">{parsedCase.clinical_question}</p>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* Results */}
        {result && (
          <Tabs defaultValue="visuals" className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <TabsList className="grid grid-cols-5">
                <TabsTrigger value="visuals" className="gap-1">
                  <BarChart3 className="w-3.5 h-3.5" /> Visual
                </TabsTrigger>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="treatments">
                  Treatments ({result.treatment_options.length})
                </TabsTrigger>
                <TabsTrigger value="media" className="gap-1">
                  <Camera className="w-3.5 h-3.5" /> Media
                </TabsTrigger>
                <TabsTrigger value="followup">Follow-Up</TabsTrigger>
              </TabsList>
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
            </div>

            {/* === Visual Summary Tab === */}
            <TabsContent value="visuals" className="space-y-6">
              {/* Top Recommendation Banner */}
              {result.top_recommendation && (
                <Card className="border-primary/50 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary">Top Recommendation</span>
                    </div>
                    <p className="text-xl font-bold">{result.top_recommendation}</p>
                    <p className="text-sm text-muted-foreground mt-1">{result.recommendation_rationale}</p>
                  </CardContent>
                </Card>
              )}

              {/* Charts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TreatmentComparisonChart
                  treatments={result.treatment_options.map(t => ({
                    name: t.name,
                    verdict: t.verdict,
                    confidence: t.confidence,
                  }))}
                />
                <EvidenceRadar />
              </div>

              {/* Case Timeline (D3) */}
              {session.currentSession && session.currentSession.events.length > 0 && (
                <CaseTimelineD3
                  events={session.currentSession.events.map(e => ({
                    type: e.type,
                    timestamp: e.timestamp,
                    changeSummary: e.changeSummary || '',
                    findings: e.findings ? { [e.findings.category]: e.findings.text } : undefined,
                  }))}
                />
              )}
            </TabsContent>

            {/* === Overview Tab === */}
            <TabsContent value="overview" className="space-y-6">
              {/* Top Recommendation Hero */}
              {result.top_recommendation ? (
                <Card className="border-primary/50 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        <CardTitle className="text-primary">Top Recommendation</CardTitle>
                      </div>
                      <Badge variant="outline" className="text-[10px] gap-1 bg-primary/10 border-primary/30">
                        MedGemma 27B
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold mb-2">{result.top_recommendation}</p>
                    <p className="text-muted-foreground mb-3">{result.recommendation_rationale}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {result.papers_reviewed.length} papers reviewed
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        {result.treatment_options.length} options evaluated
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-destructive/50 bg-gradient-to-br from-destructive/5 to-transparent">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      <CardTitle className="text-destructive">Insufficient Evidence</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {result.recommendation_rationale || 'No treatment received sufficient evidence to be recommended. Clinical judgment and specialist consultation are strongly advised.'}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Acute Management Protocol */}
              {hasAcuteManagement(result.acute_management) && (
                <Card className="border-orange-500/50 bg-gradient-to-br from-orange-500/5 to-transparent">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-orange-600" />
                      <CardTitle className="text-orange-700">Acute Management Protocol</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {result.acute_management?.risk_stratification && (
                      <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                        <p className="text-xs font-semibold uppercase tracking-wider text-orange-600 mb-1">
                          Risk Stratification
                        </p>
                        <p className="text-sm font-medium text-orange-800">
                          {result.acute_management.risk_stratification}
                        </p>
                      </div>
                    )}

                    {result.acute_management?.immediate_actions && result.acute_management.immediate_actions.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-orange-600 mb-2">
                          Immediate Actions
                        </p>
                        <ol className="space-y-1.5">
                          {result.acute_management.immediate_actions.map((action, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-sm">
                              <span className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center text-[10px] font-bold text-orange-700 flex-shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              <span className="text-foreground">{action}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {result.acute_management?.do_not_do && result.acute_management.do_not_do.length > 0 && (
                      <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                        <p className="text-xs font-semibold uppercase tracking-wider text-red-600 mb-2">
                          Do Not Do
                        </p>
                        <ul className="space-y-1.5">
                          {result.acute_management.do_not_do.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                              <span className="text-red-800">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.acute_management?.monitoring_plan && result.acute_management.monitoring_plan.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          Monitoring Plan
                        </p>
                        <ul className="space-y-1">
                          {result.acute_management.monitoring_plan.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <Activity className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                              <span className="text-muted-foreground">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.acute_management?.metabolic_corrections && result.acute_management.metabolic_corrections.length > 0 && (
                      <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                        <p className="text-xs font-semibold uppercase tracking-wider text-purple-600 mb-2">
                          Metabolic Corrections
                        </p>
                        <ul className="space-y-1.5">
                          {result.acute_management.metabolic_corrections.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <Beaker className="w-3.5 h-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
                              <span className="text-purple-800">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.acute_management?.disposition && (
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Disposition:
                        </p>
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/30 font-medium">
                          {result.acute_management.disposition}
                        </Badge>
                      </div>
                    )}

                    {result.acute_management?.consults && result.acute_management.consults.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          Consults
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {result.acute_management.consults.map((consult, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {consult}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.acute_management?.activity_restrictions && result.acute_management.activity_restrictions.toLowerCase() !== 'none' && (
                      <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-1">
                          Activity Restrictions
                        </p>
                        <p className="text-sm font-medium text-amber-800">
                          {result.acute_management.activity_restrictions}
                        </p>
                      </div>
                    )}

                    {result.acute_management?.key_counseling && result.acute_management.key_counseling.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          Key Counseling Points
                        </p>
                        <ul className="space-y-1.5">
                          {result.acute_management.key_counseling.map((point, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <MessageCircle className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                              <span className="text-muted-foreground">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Medication Review */}
              {hasMedicationReview(result.medication_review) && (
                <MedicationReviewCard review={result.medication_review!} />
              )}

              {/* Clinical Pearls */}
              {result.clinical_pearls.length > 0 && (
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-amber-500" />
                      <CardTitle>Clinical Pearls</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {result.clinical_pearls.map((pearl, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-600 flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-sm text-muted-foreground">{pearl}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* === Treatments Tab === */}
            <TabsContent value="treatments" className="space-y-6">
              {/* Treatment Options */}
              <div>
                <h2 className="text-lg font-semibold mb-4">Treatment Options</h2>
                <div className="space-y-4">
                  {result.treatment_options.map((option, i) => (
                    <TreatmentCard
                      key={i}
                      option={option}
                      isTop={option.name === result.top_recommendation}
                    />
                  ))}
                </div>
              </div>

              {/* Add New Findings */}
              {!isLoading && (
                <AddFindingsForm
                  onAddFindings={handleAddFindings}
                  onReassess={handleReassess}
                  pendingFindings={pendingFindings}
                  isReassessing={isReassessing}
                />
              )}
            </TabsContent>

            {/* === Media Tab (Image + Lab + SOAP) === */}
            <TabsContent value="media" className="space-y-6">
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
                treatmentOptions={result.treatment_options.map(t => ({
                  name: t.name,
                  verdict: t.verdict,
                }))}
              />
            </TabsContent>

            {/* === Follow-Up Tab === */}
            <TabsContent value="followup" className="space-y-6">
              {/* Follow-Up Chat */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-primary" />
                    <CardTitle className="text-base">Ask Follow-Up Questions</CardTitle>
                  </div>
                  <CardDescription>
                    Ask questions about this analysis, drug interactions, alternative approaches, or anything else
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Message History */}
                  {followUpMessages.length > 0 && (
                    <div className="max-h-[400px] overflow-y-auto space-y-3 p-3 bg-muted/30 rounded-lg">
                      {followUpMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            'flex',
                            msg.role === 'user' ? 'justify-end' : 'justify-start'
                          )}
                        >
                          <div
                            className={cn(
                              'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                              msg.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-background border shadow-sm'
                            )}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      ))}
                      {isFollowUpLoading && (
                        <div className="flex justify-start">
                          <div className="bg-background border shadow-sm rounded-lg px-3 py-2">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          </div>
                        </div>
                      )}
                      <div ref={followUpEndRef} />
                    </div>
                  )}

                  {/* Suggested Questions */}
                  {suggestedQuestions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {suggestedQuestions.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => handleFollowUpSubmit(q)}
                          disabled={isFollowUpLoading}
                          className="text-xs px-3 py-1.5 rounded-full border bg-background hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 text-left"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Input */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleFollowUpSubmit(followUpInput);
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={followUpInput}
                      onChange={(e) => setFollowUpInput(e.target.value)}
                      placeholder="Ask a follow-up question..."
                      className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      disabled={isFollowUpLoading}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!followUpInput.trim() || isFollowUpLoading}
                    >
                      {isFollowUpLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Case Timeline */}
              {session.currentSession && session.currentSession.events.length > 0 && (
                <CaseTimeline events={session.currentSession.events} />
              )}
            </TabsContent>

            {/* Footer */}
            <p className="text-center text-xs text-muted-foreground pt-4">
              Powered by MedGemma 27B on Modal | Evidence from PubMed | For educational purposes only
            </p>
          </Tabs>
        )}

        {/* Dictation Modal */}
        <DictationModal
          isOpen={showDictation}
          onClose={() => setShowDictation(false)}
          onTranscript={handleDictationTranscript}
        />
      </div>
    </div>
  );
}
