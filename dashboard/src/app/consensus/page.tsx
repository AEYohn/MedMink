'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  Search,
  Loader2,
  ArrowLeft,
  User,
  ShieldAlert,
  Scale,
  FileText,
  ExternalLink,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

// Types matching the backend response
interface ConsensusResult {
  question: string;
  pico: Record<string, string>;
  primary_synthesis: string;
  primary_grade: string;
  primary_confidence: number;
  primary_key_points: string[];
  skeptical_synthesis: string;
  skeptical_concerns: string[];
  vision_findings: string[] | null;
  agreement_score: number;
  divergence_points: string[];
  final_synthesis: string;
  final_recommendation: string;
  final_grade: string;
  confidence: number;
  papers: Array<{
    title: string;
    abstract?: string;
    year?: string;
    pmid?: string;
    authors?: string[];
  }>;
  search_terms: string[];
}

interface StepUpdate {
  type: 'step';
  step: string;
  status: string;
  message: string;
  progress: number;
  data?: Record<string, unknown>;
}

const STEP_LABELS: Record<string, string> = {
  parsing: 'Parsing Question',
  evidence_search: 'Searching Evidence',
  primary_analysis: 'Primary Analysis',
  skeptical_review: 'Skeptical Review',
  synthesis: 'Synthesizing',
  consensus: 'Building Consensus',
  complete: 'Complete',
};

const EXAMPLE_QUESTIONS = [
  'Is dual antiplatelet therapy superior to aspirin alone after ischemic stroke?',
  'What is the evidence for SGLT2 inhibitors in heart failure with preserved ejection fraction?',
  'Does early physical therapy improve outcomes in acute low back pain compared to rest?',
  'What is the role of immunotherapy in triple-negative breast cancer?',
];

function gradeColor(grade: string): string {
  switch (grade.toLowerCase()) {
    case 'high': return 'text-emerald-400';
    case 'moderate': return 'text-amber-400';
    case 'low': return 'text-orange-400';
    case 'very_low': return 'text-red-400';
    default: return 'text-muted-foreground';
  }
}

function gradeBadgeVariant(grade: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (grade.toLowerCase()) {
    case 'high': return 'default';
    case 'moderate': return 'secondary';
    case 'low':
    case 'very_low': return 'destructive';
    default: return 'outline';
  }
}

function confidencePercent(c: number): string {
  return `${Math.round(c * 100)}%`;
}

export default function ConsensusPage() {
  const [question, setQuestion] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [stepMessage, setStepMessage] = useState('');
  const [result, setResult] = useState<ConsensusResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleAnalyze = async () => {
    if (!question.trim() || question.trim().length < 10) return;

    setIsAnalyzing(true);
    setResult(null);
    setError(null);
    setProgress(0);
    setCurrentStep('parsing');
    setStepMessage('Starting analysis...');

    abortRef.current = new AbortController();

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const response = await fetch(`${apiUrl}/api/consensus/analyze/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          include_preprints: false,
          max_papers: 5,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const event = JSON.parse(raw);

            if (event.type === 'step') {
              setCurrentStep(event.step);
              setStepMessage(event.message);
              setProgress(Math.round((event.progress || 0) * 100));
            } else if (event.type === 'result') {
              setResult(event as ConsensusResult);
              setProgress(100);
              setCurrentStep('complete');
              setStepMessage('Analysis complete');
            } else if (event.type === 'error') {
              setError(event.message || 'Analysis failed');
            } else if (event.type === 'done') {
              // Stream complete
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setIsAnalyzing(false);
    setStepMessage('Cancelled');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Home
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-accent" />
            <h1 className="font-semibold text-lg">Evidence Query</h1>
          </div>
          <Badge variant="outline" className="ml-auto text-xs">Multi-Model Consensus</Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Input Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ask a Clinical Question</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="e.g., Is dual antiplatelet therapy superior to aspirin alone after ischemic stroke?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              className="resize-none"
              disabled={isAnalyzing}
            />

            {/* Example questions */}
            {!result && !isAnalyzing && (
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => setQuestion(q)}
                    className="text-xs px-2.5 py-1.5 rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:border-accent/50 transition-colors"
                  >
                    {q.length > 60 ? q.slice(0, 57) + '...' : q}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              {isAnalyzing ? (
                <Button onClick={handleCancel} variant="outline" size="sm">
                  Cancel
                </Button>
              ) : (
                <Button
                  onClick={handleAnalyze}
                  disabled={!question.trim() || question.trim().length < 10}
                  size="sm"
                  className="gap-2"
                >
                  <Search className="h-4 w-4" />
                  Analyze Evidence
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Progress */}
        {isAnalyzing && (
          <Card>
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                <span className="text-sm font-medium">
                  {STEP_LABELS[currentStep] || currentStep}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {progress}%
                </span>
              </div>
              <Progress value={progress} className="h-1.5" />
              <p className="text-xs text-muted-foreground">{stepMessage}</p>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card className="border-destructive/50">
            <CardContent className="py-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Analysis Failed</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* PICO Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  PICO Framework
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {Object.entries(result.pico).map(([key, val]) => (
                    <div key={key}>
                      <span className="text-xs font-medium text-muted-foreground uppercase">{key}</span>
                      <p className="mt-0.5">{val || 'Not specified'}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Consensus Summary */}
            <Card className="border-accent/30">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Scale className="h-4 w-4 text-accent" />
                    Consensus
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={gradeBadgeVariant(result.final_grade)}>
                      {result.final_grade.replace('_', ' ')} evidence
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {confidencePercent(result.confidence)} confidence
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-relaxed">{result.final_synthesis}</p>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Recommendation</p>
                  <p className="text-sm">{result.final_recommendation}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Agreement: {confidencePercent(result.agreement_score)}</span>
                  {result.divergence_points.length > 0 && (
                    <span>{result.divergence_points.length} divergence point(s)</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Primary Clinician */}
            <Collapsible defaultOpen>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-400" />
                        Primary Clinician
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={gradeColor(result.primary_grade)}>
                          {result.primary_grade}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {confidencePercent(result.primary_confidence)}
                        </span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3 pt-0">
                    <p className="text-sm leading-relaxed">{result.primary_synthesis}</p>
                    {result.primary_key_points.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Key Points</p>
                        <ul className="text-sm space-y-1">
                          {result.primary_key_points.map((pt, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-blue-400 mt-1.5 shrink-0 h-1.5 w-1.5 rounded-full bg-blue-400" />
                              {pt}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Skeptical Reviewer */}
            <Collapsible defaultOpen>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-orange-400" />
                        Skeptical Reviewer
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {result.skeptical_concerns.length} concern(s)
                        </span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3 pt-0">
                    <p className="text-sm leading-relaxed">{result.skeptical_synthesis}</p>
                    {result.skeptical_concerns.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Concerns</p>
                        <ul className="text-sm space-y-1">
                          {result.skeptical_concerns.map((c, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <AlertTriangle className="h-3.5 w-3.5 text-orange-400 shrink-0 mt-0.5" />
                              {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Divergence Points */}
            {result.divergence_points.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Divergence Points</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1">
                    {result.divergence_points.map((d, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-amber-400 mt-1.5 shrink-0 h-1.5 w-1.5 rounded-full bg-amber-400" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Papers */}
            {result.papers.length > 0 && (
              <Collapsible>
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Sources ({result.papers.length})
                        </CardTitle>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-3 pt-0">
                      {result.papers.map((paper, i) => (
                        <div key={i} className="text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0">
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-muted-foreground shrink-0">[{i + 1}]</span>
                            <div className="min-w-0">
                              <p className="font-medium leading-snug">{paper.title}</p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                {paper.year && <span>{paper.year}</span>}
                                {paper.pmid && (
                                  <a
                                    href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-accent hover:underline"
                                  >
                                    PMID: {paper.pmid}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
