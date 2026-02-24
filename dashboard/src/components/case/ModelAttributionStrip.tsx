'use client';

import { useState } from 'react';
import {
  Brain,
  ImageIcon,
  Mic,
  Pill,
  Activity,
  X,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ModelInfo {
  id: string;
  label: string;
  fullName: string;
  icon: React.ReactNode;
  /** Tools that indicate this model was used */
  matchTools: string[];
  /** Description of what this model does */
  description: string;
}

const MODELS: ModelInfo[] = [
  {
    id: 'medgemma',
    label: 'MedGemma',
    fullName: 'MedGemma 27B',
    icon: <Brain className="w-4 h-4" />,
    matchTools: ['__always__'],
    description: 'Core clinical reasoning, treatment evaluation, and evidence synthesis',
  },
  {
    id: 'cxr',
    label: 'CXR',
    fullName: 'CXR Foundation',
    icon: <ImageIcon className="w-4 h-4" />,
    matchTools: ['analyze_chest_xray'],
    description: 'Chest X-ray classification and abnormality detection',
  },
  {
    id: 'derm',
    label: 'Derm',
    fullName: 'Derm Foundation',
    icon: <ImageIcon className="w-4 h-4" />,
    matchTools: ['analyze_skin_lesion'],
    description: 'Dermoscopy image analysis and skin lesion classification',
  },
  {
    id: 'path',
    label: 'Path',
    fullName: 'Path Foundation',
    icon: <ImageIcon className="w-4 h-4" />,
    matchTools: ['analyze_pathology'],
    description: 'Digital pathology tissue classification',
  },
  {
    id: 'txgemma',
    label: 'TxGemma',
    fullName: 'TxGemma',
    icon: <Pill className="w-4 h-4" />,
    matchTools: ['check_drug_interactions', 'predict_drug_toxicity'],
    description: 'Drug interaction prediction and toxicity assessment',
  },
  {
    id: 'hear',
    label: 'HeAR',
    fullName: 'HeAR',
    icon: <Mic className="w-4 h-4" />,
    matchTools: ['screen_respiratory'],
    description: 'Respiratory sound analysis and cough screening',
  },
  {
    id: 'medasr',
    label: 'MedASR',
    fullName: 'Medical ASR',
    icon: <Activity className="w-4 h-4" />,
    matchTools: ['__dictation__'],
    description: 'Medical speech recognition for clinical dictation',
  },
];

type ModelState = 'available' | 'active' | 'used';

interface ModelAttributionStripProps {
  /** Tools currently being invoked (spinning state) */
  activeTools?: string[];
  /** Tools that have been used (green state) */
  usedTools?: string[];
  /** Tool results with contribution details */
  toolResults?: Array<{ tool: string; model?: string; result: Record<string, unknown> }>;
  /** Whether the analysis is currently running */
  isAnalyzing?: boolean;
  /** Whether dictation was used */
  dictationUsed?: boolean;
  /** Whether medication review ran (implies TxGemma layer) */
  medicationReviewRan?: boolean;
  className?: string;
}

export function ModelAttributionStrip({
  activeTools = [],
  usedTools = [],
  toolResults = [],
  isAnalyzing = false,
  dictationUsed = false,
  medicationReviewRan = false,
  className,
}: ModelAttributionStripProps) {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const getModelState = (model: ModelInfo): ModelState => {
    // MedGemma is always used once analysis starts
    if (model.id === 'medgemma') {
      if (isAnalyzing) return 'active';
      if (usedTools.length > 0 || toolResults.length > 0) return 'used';
      return 'available';
    }

    // MedASR if dictation was used
    if (model.id === 'medasr') {
      return dictationUsed ? 'used' : 'available';
    }

    // TxGemma: also triggered by medication review pipeline
    if (model.id === 'txgemma' && medicationReviewRan) {
      return 'used';
    }

    // Check active tools
    if (model.matchTools.some(t => activeTools.includes(t))) return 'active';

    // Check used tools
    if (model.matchTools.some(t => usedTools.includes(t))) return 'used';

    // Check tool results
    if (toolResults.some(r => model.matchTools.includes(r.tool))) return 'used';

    return 'available';
  };

  const getContribution = (model: ModelInfo): string | null => {
    if (model.id === 'medgemma') {
      return 'Clinical reasoning, treatment evaluation, differential diagnosis, risk stratification';
    }
    if (model.id === 'medasr' && dictationUsed) {
      return 'Transcribed clinical dictation to case text';
    }
    if (model.id === 'txgemma' && medicationReviewRan) {
      const txResult = toolResults.find(r =>
        ['check_drug_interactions', 'predict_drug_toxicity'].includes(r.tool)
      );
      if (txResult?.result) {
        const interactions = (txResult.result as Record<string, unknown>).interactions;
        if (Array.isArray(interactions) && interactions.length > 0) {
          return `Found ${interactions.length} drug interaction(s)`;
        }
        return 'Drug safety screening — no significant interactions found';
      }
      return 'Medication safety pipeline (deterministic + AI layers)';
    }

    const relevant = toolResults.filter(r => model.matchTools.includes(r.tool));
    if (relevant.length === 0) return null;

    // Summarize results
    const summaries: string[] = [];
    for (const r of relevant) {
      if (r.tool === 'analyze_chest_xray') {
        const probs = (r.result as Record<string, unknown>).probabilities;
        if (probs && typeof probs === 'object') {
          const entries = Object.entries(probs as Record<string, number>);
          const top = entries.sort(([, a], [, b]) => b - a).slice(0, 2);
          summaries.push(top.map(([k, v]) => `${k}: ${Math.round(v * 100)}%`).join(', '));
        } else {
          summaries.push('Chest X-ray classified');
        }
      } else if (r.tool === 'analyze_skin_lesion') {
        summaries.push('Skin lesion analyzed');
      } else if (r.tool === 'analyze_pathology') {
        summaries.push('Tissue classification complete');
      } else if (r.tool === 'screen_respiratory') {
        summaries.push('Respiratory sounds screened');
      } else if (r.tool === 'check_drug_interactions') {
        const interactions = (r.result as Record<string, unknown>).interactions;
        if (Array.isArray(interactions)) {
          summaries.push(`${interactions.length} interaction(s) checked`);
        }
      } else if (r.tool === 'predict_drug_toxicity') {
        summaries.push('Drug toxicity profile assessed');
      }
    }

    return summaries.join('; ') || null;
  };

  const modelStates = MODELS.map(m => ({ model: m, state: getModelState(m) }));
  const usedCount = modelStates.filter(m => m.state === 'used').length;
  const activeCount = modelStates.filter(m => m.state === 'active').length;
  const totalEngaged = usedCount + activeCount;

  const selectedModelData = selectedModel
    ? MODELS.find(m => m.id === selectedModel)
    : null;

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
      {/* Strip header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-b">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Google Health AI Models
            </span>
          </div>
        </div>
        {totalEngaged > 0 && (
          <Badge
            variant="secondary"
            className={cn(
              'text-xs font-mono',
              totalEngaged >= 5
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
            )}
          >
            {totalEngaged}/7 models {activeCount > 0 ? 'active' : 'used'}
          </Badge>
        )}
      </div>

      {/* Model badges */}
      <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto">
        {modelStates.map(({ model, state }) => (
          <button
            key={model.id}
            onClick={() => setSelectedModel(selectedModel === model.id ? null : model.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap border',
              'hover:scale-105 active:scale-95',
              state === 'available' && 'bg-muted/50 text-muted-foreground border-transparent',
              state === 'active' && 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700',
              state === 'used' && 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-700',
              selectedModel === model.id && 'ring-2 ring-primary ring-offset-1',
            )}
          >
            {state === 'active' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : state === 'used' ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <span className="opacity-50">{model.icon}</span>
            )}
            {model.label}
          </button>
        ))}
      </div>

      {/* Expanded detail panel */}
      {selectedModelData && (
        <div className="px-4 pb-3 border-t">
          <div className="flex items-start justify-between pt-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold">{selectedModelData.fullName}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px]',
                    getModelState(selectedModelData) === 'used'
                      ? 'border-emerald-300 text-emerald-600'
                      : getModelState(selectedModelData) === 'active'
                        ? 'border-blue-300 text-blue-600'
                        : 'border-muted text-muted-foreground',
                  )}
                >
                  {getModelState(selectedModelData) === 'used'
                    ? 'Contributed'
                    : getModelState(selectedModelData) === 'active'
                      ? 'Running...'
                      : 'Available'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-1">{selectedModelData.description}</p>
              {getContribution(selectedModelData) && (
                <p className="text-xs text-foreground/80 bg-muted/30 rounded px-2 py-1 mt-1">
                  {getContribution(selectedModelData)}
                </p>
              )}
            </div>
            <button
              onClick={() => setSelectedModel(null)}
              className="p-1 hover:bg-muted rounded"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
