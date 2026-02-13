'use client';

import { useState, useRef, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  Pencil,
  FileText,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Minus,
  GripVertical,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { TreatmentOption } from '@/types/case';
import type { ClinicianOverrides, TreatmentOverride } from '@/lib/storage';

interface TreatmentPlanEditorProps {
  treatmentOptions: TreatmentOption[];
  topRecommendation: string;
  recommendationRationale: string;
  overrides: ClinicianOverrides;
  onOverridesChange: (overrides: ClinicianOverrides) => void;
}

const STATUS_CYCLE: TreatmentOverride['status'][] = ['pending', 'ordered', 'administered', 'held'];

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-700 border-gray-300' },
  ordered: { label: 'Ordered', className: 'bg-blue-100 text-blue-700 border-blue-300' },
  administered: { label: 'Administered', className: 'bg-green-100 text-green-700 border-green-300' },
  held: { label: 'Held', className: 'bg-amber-100 text-amber-700 border-amber-300' },
};

const verdictConfig = {
  accepted: { label: 'Accepted', className: 'bg-green-500/10 text-green-600 border-green-500/30', border: 'border-l-green-500' },
  rejected: { label: 'Rejected', className: 'bg-red-500/10 text-red-600 border-red-500/30', border: 'border-l-red-500' },
  modified: { label: 'Modified', className: 'bg-amber-500/10 text-amber-600 border-amber-500/30', border: 'border-l-amber-500' },
};

const aiVerdictConfig = {
  recommended: { label: 'Recommended', className: 'bg-green-500/10 text-green-600 border-green-500/30', icon: ThumbsUp, border: 'border-l-green-500' },
  consider: { label: 'Consider', className: 'bg-amber-500/10 text-amber-600 border-amber-500/30', icon: Minus, border: 'border-l-amber-500' },
  not_recommended: { label: 'Not Recommended', className: 'bg-red-500/10 text-red-600 border-red-500/30', icon: ThumbsDown, border: 'border-l-red-500' },
};

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

export function TreatmentPlanEditor({
  treatmentOptions,
  topRecommendation,
  recommendationRationale,
  overrides,
  onOverridesChange,
}: TreatmentPlanEditorProps) {
  const [order, setOrder] = useState<string[]>(() =>
    treatmentOptions.map(t => t.name)
  );
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  const getOverride = (name: string): TreatmentOverride =>
    overrides.treatments[name] || {};

  const setOverride = useCallback((name: string, update: Partial<TreatmentOverride>) => {
    onOverridesChange({
      ...overrides,
      treatments: {
        ...overrides.treatments,
        [name]: { ...overrides.treatments[name], ...update },
      },
      lastModified: new Date().toISOString(),
    });
  }, [overrides, onOverridesChange]);

  const handleDragStart = (idx: number) => { dragItem.current = idx; };
  const handleDragEnter = (idx: number) => { dragOver.current = idx; };
  const handleDragEnd = () => {
    if (dragItem.current === null || dragOver.current === null) return;
    const newOrder = [...order];
    const [removed] = newOrder.splice(dragItem.current, 1);
    newOrder.splice(dragOver.current, 0, removed);
    setOrder(newOrder);
    dragItem.current = null;
    dragOver.current = null;
  };

  const orderedOptions = order
    .map(name => treatmentOptions.find(t => t.name === name))
    .filter((t): t is TreatmentOption => !!t);

  return (
    <div className="space-y-4">
      {/* Top recommendation banner */}
      {topRecommendation && (
        <Card className="border-primary/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">AI Top Recommendation</span>
            </div>
            <p className="text-lg font-bold">{topRecommendation}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{recommendationRationale}</p>
          </CardContent>
        </Card>
      )}

      {/* Treatment cards */}
      {orderedOptions.map((option, idx) => {
        const override = getOverride(option.name);
        const clinicianVerdict = override.verdict;
        const isTop = option.name === topRecommendation;

        // Determine border color: clinician verdict overrides AI verdict
        const borderClass = clinicianVerdict
          ? verdictConfig[clinicianVerdict].border
          : aiVerdictConfig[option.verdict].border;

        return (
          <InteractiveTreatmentCard
            key={option.name}
            option={option}
            isTop={isTop}
            override={override}
            borderClass={borderClass}
            index={idx}
            onSetVerdict={(v) => setOverride(option.name, {
              verdict: override.verdict === v ? undefined : v,
            })}
            onCycleStatus={() => {
              const currentIdx = STATUS_CYCLE.indexOf(override.status || 'pending');
              const nextIdx = (currentIdx + 1) % STATUS_CYCLE.length;
              setOverride(option.name, { status: STATUS_CYCLE[nextIdx] });
            }}
            onNotesChange={(notes) => setOverride(option.name, { notes })}
            onDoseChange={(dose) => setOverride(option.name, { modifiedDose: dose })}
            onDragStart={() => handleDragStart(idx)}
            onDragEnter={() => handleDragEnter(idx)}
            onDragEnd={handleDragEnd}
          />
        );
      })}
    </div>
  );
}

interface InteractiveTreatmentCardProps {
  option: TreatmentOption;
  isTop: boolean;
  override: TreatmentOverride;
  borderClass: string;
  index: number;
  onSetVerdict: (v: 'accepted' | 'rejected' | 'modified') => void;
  onCycleStatus: () => void;
  onNotesChange: (notes: string) => void;
  onDoseChange: (dose: string) => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
}

function InteractiveTreatmentCard({
  option,
  isTop,
  override,
  borderClass,
  onSetVerdict,
  onCycleStatus,
  onNotesChange,
  onDoseChange,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: InteractiveTreatmentCardProps) {
  const [expanded, setExpanded] = useState(isTop);
  const [editingDose, setEditingDose] = useState(false);
  const [showNotes, setShowNotes] = useState(!!override.notes);
  const isRejected = override.verdict === 'rejected';
  const status = override.status || 'pending';
  const sc = statusConfig[status];
  const aiVerdict = aiVerdictConfig[option.verdict];
  const AiVerdictIcon = aiVerdict.icon;

  return (
    <Card
      className={cn(
        'transition-all border-l-4',
        borderClass,
        isTop && !override.verdict && 'ring-2 ring-primary/30',
        isRejected && 'opacity-60',
      )}
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
    >
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground/50 cursor-grab flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {isTop && !override.verdict && (
                      <Badge className="bg-primary text-primary-foreground text-[10px]">TOP PICK</Badge>
                    )}
                    {/* AI verdict */}
                    <Badge variant="outline" className={cn('gap-1 text-xs', aiVerdict.className)}>
                      <AiVerdictIcon className="w-3 h-3" />
                      AI: {aiVerdict.label}
                    </Badge>
                    {/* Clinician verdict */}
                    {override.verdict && (
                      <Badge variant="outline" className={cn('gap-1 text-xs font-bold', verdictConfig[override.verdict].className)}>
                        You: {verdictConfig[override.verdict].label}
                      </Badge>
                    )}
                    <GradeBadge grade={option.evidence_grade} />
                  </div>
                  <CardTitle className={cn('text-base', isRejected && 'line-through')}>
                    {option.name}
                  </CardTitle>
                  <CardDescription className="mt-0.5 text-xs">{option.mechanism}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right">
                  <p className="text-xl font-bold text-primary">{Math.round(option.confidence * 100)}%</p>
                  <p className="text-[10px] text-muted-foreground">confidence</p>
                </div>
                <ChevronDown className={cn('w-4 h-4 transition-transform', expanded && 'rotate-180')} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Clinician action bar */}
            <div className="flex items-center gap-2 flex-wrap p-2 bg-muted/30 rounded-lg">
              {/* Verdict buttons */}
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant={override.verdict === 'accepted' ? 'default' : 'outline'}
                  className={cn('h-7 text-xs gap-1', override.verdict === 'accepted' && 'bg-green-600 hover:bg-green-700')}
                  onClick={(e) => { e.stopPropagation(); onSetVerdict('accepted'); }}
                >
                  <CheckCircle2 className="w-3 h-3" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant={override.verdict === 'rejected' ? 'default' : 'outline'}
                  className={cn('h-7 text-xs gap-1', override.verdict === 'rejected' && 'bg-red-600 hover:bg-red-700')}
                  onClick={(e) => { e.stopPropagation(); onSetVerdict('rejected'); }}
                >
                  <XCircle className="w-3 h-3" /> Reject
                </Button>
                <Button
                  size="sm"
                  variant={override.verdict === 'modified' ? 'default' : 'outline'}
                  className={cn('h-7 text-xs gap-1', override.verdict === 'modified' && 'bg-amber-600 hover:bg-amber-700')}
                  onClick={(e) => { e.stopPropagation(); onSetVerdict('modified'); }}
                >
                  <Pencil className="w-3 h-3" /> Modify
                </Button>
              </div>

              <Separator orientation="vertical" className="h-6" />

              {/* Status badge (click to cycle) */}
              <button
                onClick={(e) => { e.stopPropagation(); onCycleStatus(); }}
                className="inline-flex items-center"
              >
                <Badge variant="outline" className={cn('text-xs cursor-pointer hover:opacity-80', sc.className)}>
                  {sc.label}
                </Badge>
              </button>

              <Separator orientation="vertical" className="h-6" />

              {/* Notes toggle */}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1"
                onClick={(e) => { e.stopPropagation(); setShowNotes(!showNotes); }}
              >
                <MessageSquare className="w-3 h-3" />
                {showNotes ? 'Hide Notes' : 'Add Notes'}
              </Button>
            </div>

            {/* Dose edit */}
            {(override.verdict === 'modified' || editingDose) && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Modified dose:</span>
                <input
                  type="text"
                  value={override.modifiedDose || ''}
                  onChange={(e) => onDoseChange(e.target.value)}
                  placeholder="e.g., 500mg PO BID"
                  className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}

            {/* Notes */}
            {showNotes && (
              <Textarea
                value={override.notes || ''}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="Add your clinical rationale or notes..."
                className="min-h-[60px] text-sm"
                onClick={(e) => e.stopPropagation()}
              />
            )}

            {/* FDA Status */}
            {option.fda_approved && (
              <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-700">FDA Approved: {option.fda_indication}</span>
              </div>
            )}

            {/* Rationale */}
            <div>
              <p className="text-sm text-muted-foreground leading-relaxed">{option.rationale}</p>
              {option.reasoning && Object.keys(option.reasoning).length > 0 && (
                <div className="mt-2 space-y-1.5 border-t border-border pt-2">
                  {option.reasoning.patient_factors_considered && option.reasoning.patient_factors_considered.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase">Patient Factors:</span>
                      {option.reasoning.patient_factors_considered.map((f, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-700">{f}</span>
                      ))}
                    </div>
                  )}
                  {option.reasoning.key_concern && (
                    <p className="text-xs text-amber-600">Concern: {option.reasoning.key_concern}</p>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Pros & Cons */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-green-600 mb-1">Pros</p>
                <ul className="space-y-0.5">
                  {option.pros.map((pro, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs">
                      <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-red-600 mb-1">Cons</p>
                <ul className="space-y-0.5">
                  {option.cons.map((con, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs">
                      <XCircle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
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
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Evidence Trail</p>
                    {option.papers_used?.length > 0 && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <FileText className="w-2.5 h-2.5" />
                        {option.papers_used.length} paper{option.papers_used.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  {option.key_evidence.length > 0 ? (
                    <ul className="space-y-2">
                      {option.key_evidence.map((ev, i) => (
                        <li key={i} className="text-xs p-2 bg-muted/30 rounded-md border border-border/50">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="w-3 h-3 text-primary flex-shrink-0" />
                            {ev.pmid && /^\d{7,9}$/.test(ev.pmid) && (
                              <a
                                href={`https://pubmed.ncbi.nlm.nih.gov/${ev.pmid}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
                              >
                                PMID: {ev.pmid} {ev.year && `(${ev.year})`}
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                          {ev.title && <p className="font-medium text-foreground mb-1">{ev.title}</p>}
                          {ev.finding && (
                            <p className="text-muted-foreground italic">&ldquo;{ev.finding}&rdquo;</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : option.papers_used?.length > 0 ? (
                    <ul className="space-y-2">
                      {option.papers_used.map((paper, i) => (
                        <li key={i} className="text-xs p-2 bg-muted/30 rounded-md border border-border/50">
                          <div className="flex items-center gap-2">
                            <FileText className="w-3 h-3 text-primary flex-shrink-0" />
                            <a
                              href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
                            >
                              PMID: {paper.pmid} <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                          {paper.title && <p className="font-medium text-foreground mt-1">{paper.title}</p>}
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
