'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Brain,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Loader2,
  Sparkles,
  Zap,
  Search,
  Shield,
  Activity,
  Stethoscope,
  ImageIcon,
  Mic,
  Pill,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/api-url';

// Types for SSE events
interface ThinkingEvent {
  type: 'thinking';
  step: number;
  reasoning: string;
  iteration: number;
}

interface ToolCallEvent {
  type: 'tool_call';
  step: number;
  tool: string;
  parameters: Record<string, unknown>;
  model: string;
}

interface ToolResultEvent {
  type: 'tool_result';
  step: number;
  tool: string;
  result: Record<string, unknown>;
}

interface AssessmentEvent {
  type: 'assessment';
  step: number;
  final_assessment: {
    primary_diagnosis?: string;
    confidence?: number;
    key_findings?: string[];
    disposition?: string;
    recommended_actions?: string[];
  };
  tools_used: string[];
}

interface ConsensusEvent {
  type: 'consensus';
  step: number;
  consensus: {
    agreements?: Array<{ finding: string; models: string[]; confidence: number }>;
    disagreements?: Array<{
      finding: string;
      model_a: { name: string; position: string };
      model_b: { name: string; position: string };
      resolution: string;
    }>;
    integrated_assessment?: string;
    overall_confidence?: number;
    contributing_models?: string[];
    recommended_next_steps?: string[];
  };
}

interface DoneEvent {
  type: 'done';
  total_steps: number;
  tools_used: string[];
}

interface ErrorEvent {
  type: 'error';
  message: string;
}

type AgentEvent =
  | ThinkingEvent
  | ToolCallEvent
  | ToolResultEvent
  | AssessmentEvent
  | ConsensusEvent
  | DoneEvent
  | ErrorEvent;

interface TraceStep {
  id: number;
  event: AgentEvent;
  timestamp: Date;
}

// Tool icon mapping
const TOOL_ICONS: Record<string, React.ReactNode> = {
  analyze_chest_xray: <ImageIcon className="w-4 h-4" />,
  analyze_skin_lesion: <ImageIcon className="w-4 h-4" />,
  analyze_pathology: <ImageIcon className="w-4 h-4" />,
  screen_respiratory: <Mic className="w-4 h-4" />,
  check_drug_interactions: <Shield className="w-4 h-4" />,
  predict_drug_toxicity: <Pill className="w-4 h-4" />,
  compute_risk_scores: <Activity className="w-4 h-4" />,
  search_evidence: <Search className="w-4 h-4" />,
};

const TOOL_LABELS: Record<string, string> = {
  analyze_chest_xray: 'CXR Foundation',
  analyze_skin_lesion: 'Derm Foundation',
  analyze_pathology: 'Path Foundation',
  screen_respiratory: 'HeAR',
  check_drug_interactions: 'Medication Safety',
  predict_drug_toxicity: 'TxGemma',
  compute_risk_scores: 'Risk Scores',
  search_evidence: 'PubMed Search',
};

interface AgentReasoningTraceProps {
  caseText: string;
  parsedCase?: Record<string, unknown> | null;
  chestXrayB64?: string | null;
  skinImageB64?: string | null;
  pathologyImageB64?: string | null;
  audioPath?: string | null;
  /** If provided, trace auto-starts on mount */
  autoStart?: boolean;
  /** Called when the agent produces a final assessment */
  onAssessment?: (assessment: AssessmentEvent['final_assessment']) => void;
  /** Called when consensus is built */
  onConsensus?: (consensus: ConsensusEvent['consensus']) => void;
}

export function AgentReasoningTrace({
  caseText,
  parsedCase,
  chestXrayB64,
  skinImageB64,
  pathologyImageB64,
  audioPath,
  autoStart = false,
  onAssessment,
  onConsensus,
}: AgentReasoningTraceProps) {
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const traceEndRef = useRef<HTMLDivElement>(null);
  const hasAutoStarted = useRef(false);

  const toggleStep = useCallback((stepId: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }, []);

  const runAgent = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setIsDone(false);
    setError(null);
    setSteps([]);
    setExpandedSteps(new Set());

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${getApiUrl()}/api/agent/reason/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_text: caseText,
          parsed_case: parsedCase || null,
          chest_xray_b64: chestXrayB64 || null,
          skin_image_b64: skinImageB64 || null,
          pathology_image_b64: pathologyImageB64 || null,
          audio_path: audioPath || null,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Agent request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let stepCounter = 0;

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
            const event = JSON.parse(dataLine.slice(6)) as AgentEvent;
            stepCounter++;
            const traceStep: TraceStep = {
              id: stepCounter,
              event,
              timestamp: new Date(),
            };

            setSteps(prev => [...prev, traceStep]);

            // Auto-scroll to bottom
            setTimeout(() => traceEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

            if (event.type === 'assessment' && onAssessment) {
              onAssessment(event.final_assessment);
            }
            if (event.type === 'consensus' && onConsensus) {
              onConsensus(event.consensus);
            }
            if (event.type === 'done') {
              setIsDone(true);
              setIsRunning(false);
            }
            if (event.type === 'error') {
              setError(event.message);
              setIsRunning(false);
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [caseText, parsedCase, chestXrayB64, skinImageB64, pathologyImageB64, audioPath, isRunning, onAssessment, onConsensus]);

  const stopAgent = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
  }, []);

  // Auto-start
  if (autoStart && !hasAutoStarted.current && !isRunning && !isDone && caseText) {
    hasAutoStarted.current = true;
    setTimeout(runAgent, 100);
  }

  return (
    <Card className="border-indigo-200 dark:border-indigo-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-600" />
            Clinical Reasoning Agent
            {isRunning && (
              <Badge variant="secondary" className="animate-pulse bg-indigo-100 text-indigo-700">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Reasoning...
              </Badge>
            )}
            {isDone && (
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Complete
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            {!isRunning && !isDone && (
              <Button size="sm" onClick={runAgent} className="bg-indigo-600 hover:bg-indigo-700">
                <Zap className="w-3.5 h-3.5 mr-1" />
                Run Agent
              </Button>
            )}
            {!isRunning && isDone && (
              <Button size="sm" variant="outline" onClick={runAgent}>
                <Zap className="w-3.5 h-3.5 mr-1" />
                Re-run
              </Button>
            )}
            {isRunning && (
              <Button size="sm" variant="destructive" onClick={stopAgent}>
                Stop
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {steps.length === 0 && !isRunning && !error && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Run the agent to see it autonomously analyze this case using HAI-DEF foundation models.
          </p>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-1">
          {steps.map((step) => (
            <TraceStepItem
              key={step.id}
              step={step}
              isExpanded={expandedSteps.has(step.id)}
              onToggle={() => toggleStep(step.id)}
              isLatest={step.id === steps.length}
              isRunning={isRunning}
            />
          ))}
          {isRunning && steps.length > 0 && steps[steps.length - 1].event.type !== 'thinking' && (
            <div className="flex items-center gap-2 pl-6 py-2 text-sm text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Thinking...
            </div>
          )}
        </div>
        <div ref={traceEndRef} />
      </CardContent>
    </Card>
  );
}

// Individual step renderer
function TraceStepItem({
  step,
  isExpanded,
  onToggle,
  isLatest,
  isRunning,
}: {
  step: TraceStep;
  isExpanded: boolean;
  onToggle: () => void;
  isLatest: boolean;
  isRunning: boolean;
}) {
  const { event } = step;

  if (event.type === 'thinking') {
    return (
      <div className={cn(
        'flex items-start gap-2 py-2 pl-2 rounded-lg transition-colors',
        isLatest && isRunning && 'bg-indigo-50 dark:bg-indigo-950/30',
      )}>
        <Brain className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
        <p className="text-sm">{event.reasoning}</p>
      </div>
    );
  }

  if (event.type === 'tool_call') {
    return (
      <div className={cn(
        'flex items-center gap-2 py-2 pl-2 rounded-lg',
        isLatest && isRunning && 'bg-amber-50 dark:bg-amber-950/30',
      )}>
        {TOOL_ICONS[event.tool] || <Wrench className="w-4 h-4" />}
        <span className="text-sm font-medium">
          Invoking {TOOL_LABELS[event.tool] || event.tool}
        </span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {event.model}
        </Badge>
        {isLatest && isRunning && (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500 ml-auto" />
        )}
      </div>
    );
  }

  if (event.type === 'tool_result') {
    const hasError = 'error' in (event.result || {});
    return (
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-2 py-2 pl-6 cursor-pointer hover:bg-accent/30 rounded-lg">
            {hasError ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
            )}
            <span className="text-sm text-muted-foreground">
              {TOOL_LABELS[event.tool] || event.tool} — {hasError ? 'Error' : 'Results ready'}
            </span>
            <ChevronDown className={cn(
              'w-3.5 h-3.5 text-muted-foreground ml-auto transition-transform',
              isExpanded && 'rotate-180',
            )} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="text-xs bg-muted/50 p-3 rounded-lg ml-6 mt-1 overflow-x-auto max-h-48 overflow-y-auto">
            {JSON.stringify(event.result, null, 2)}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  if (event.type === 'assessment') {
    const a = event.final_assessment;
    return (
      <div className="mt-3 p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-green-600" />
          <span className="text-sm font-semibold text-green-800 dark:text-green-200">Final Assessment</span>
          {a.confidence != null && (
            <Badge variant="outline" className="ml-auto text-green-700 border-green-300">
              {Math.round(a.confidence * 100)}% confidence
            </Badge>
          )}
        </div>
        {a.primary_diagnosis && (
          <p className="text-sm font-medium mb-1">{a.primary_diagnosis}</p>
        )}
        {a.disposition && (
          <p className="text-sm text-muted-foreground mb-2">Disposition: {a.disposition}</p>
        )}
        {a.key_findings && a.key_findings.length > 0 && (
          <div className="mb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Key Findings:</p>
            <ul className="text-sm space-y-0.5">
              {a.key_findings.map((f, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
        {a.recommended_actions && a.recommended_actions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Recommended Actions:</p>
            <ul className="text-sm space-y-0.5">
              {a.recommended_actions.map((action, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <Stethoscope className="w-3 h-3 text-indigo-500 mt-0.5 shrink-0" />
                  {action}
                </li>
              ))}
            </ul>
          </div>
        )}
        {event.tools_used.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3 pt-2 border-t border-green-200 dark:border-green-800">
            {event.tools_used.map((tool) => (
              <Badge key={tool} variant="secondary" className="text-[10px] bg-green-100 dark:bg-green-900">
                {TOOL_LABELS[tool] || tool}
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (event.type === 'consensus') {
    const c = event.consensus;
    return (
      <div className="mt-3 p-4 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-semibold text-purple-800 dark:text-purple-200">
            Cross-Modal Consensus
          </span>
          {c.overall_confidence != null && (
            <Badge variant="outline" className="ml-auto text-purple-700 border-purple-300">
              {Math.round(c.overall_confidence * 100)}% consensus
            </Badge>
          )}
        </div>
        {c.integrated_assessment && (
          <p className="text-sm mb-2">{c.integrated_assessment}</p>
        )}
        {c.agreements && c.agreements.length > 0 && (
          <div className="mb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Agreements:</p>
            {c.agreements.map((a, i) => (
              <div key={i} className="flex items-start gap-1.5 text-sm mb-1">
                <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                <span>{a.finding}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {a.models.join(', ')} ({Math.round(a.confidence * 100)}%)
                </span>
              </div>
            ))}
          </div>
        )}
        {c.disagreements && c.disagreements.length > 0 && (
          <div className="mb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Disagreements:</p>
            {c.disagreements.map((d, i) => (
              <div key={i} className="text-sm p-2 bg-amber-50 dark:bg-amber-950/30 rounded mb-1">
                <p className="font-medium text-amber-800 dark:text-amber-200">{d.finding}</p>
                <p className="text-xs text-muted-foreground">
                  {d.model_a.name}: {d.model_a.position} vs {d.model_b.name}: {d.model_b.position}
                </p>
                {d.resolution && (
                  <p className="text-xs mt-1">Resolution: {d.resolution}</p>
                )}
              </div>
            ))}
          </div>
        )}
        {c.contributing_models && c.contributing_models.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-purple-200 dark:border-purple-800">
            {c.contributing_models.map((model) => (
              <Badge key={model} variant="secondary" className="text-[10px] bg-purple-100 dark:bg-purple-900">
                {model}
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
  }

  // done/error events are handled at the parent level
  return null;
}
