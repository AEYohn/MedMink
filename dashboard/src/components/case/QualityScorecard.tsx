'use client';

import { useState, useMemo } from 'react';
import {
  Shield,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Award,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { CaseAnalysisData, TreatmentOption } from '@/types/case';

interface QualityCheck {
  id: string;
  name: string;
  description: string;
  passed: boolean;
  detail?: string;
}

interface QualityScorecardProps {
  result: CaseAnalysisData;
  className?: string;
}

/** Run quality checks against case analysis data (pure functions, no backend). */
function runQualityChecks(data: CaseAnalysisData): QualityCheck[] {
  const checks: QualityCheck[] = [];
  const opts = data.treatment_options || [];
  const am = data.acute_management;
  const pc = data.parsed_case;
  const ddx = data.differential_diagnosis;

  // 1. Category classification
  checks.push({
    id: 'category',
    name: 'Category Classification',
    description: 'Case classified into a medical specialty',
    passed: !!pc?.case_category && pc.case_category.length > 0,
    detail: pc?.case_category || 'Missing',
  });

  // 2. Risk stratification present
  checks.push({
    id: 'risk_strat',
    name: 'Risk Stratification',
    description: 'Risk level assigned to the case',
    passed: !!am?.risk_stratification && am.risk_stratification.length > 0,
    detail: am?.risk_stratification || 'Missing',
  });

  // 3. Disposition provided
  checks.push({
    id: 'disposition',
    name: 'Disposition',
    description: 'Patient disposition recommendation provided',
    passed: !!am?.disposition && am.disposition.length > 0,
    detail: am?.disposition || 'Missing',
  });

  // 4. Has treatment recommendations
  const recommended = opts.filter(t => t.verdict === 'recommended');
  checks.push({
    id: 'has_recommendations',
    name: 'Treatment Recommendations',
    description: 'At least one treatment recommended',
    passed: recommended.length > 0,
    detail: `${recommended.length} recommended, ${opts.length} total`,
  });

  // 5. No self-contradictions
  const doNotDo = new Set((am?.do_not_do || []).map(d => d.toLowerCase()));
  const contradictions = recommended.filter(t =>
    doNotDo.has(t.name.toLowerCase()) ||
    Array.from(doNotDo).some(d => t.name.toLowerCase().includes(d) || d.includes(t.name.toLowerCase()))
  );
  checks.push({
    id: 'no_contradictions',
    name: 'No Self-Contradictions',
    description: 'No recommended treatment conflicts with do-not-do list',
    passed: contradictions.length === 0,
    detail: contradictions.length > 0
      ? `Conflict: ${contradictions.map(t => t.name).join(', ')}`
      : 'No conflicts',
  });

  // 6. Etiology addressed in rationale
  const hasEtiology = recommended.some(t =>
    t.rationale && (
      t.rationale.toLowerCase().includes('cause') ||
      t.rationale.toLowerCase().includes('mechanism') ||
      t.rationale.toLowerCase().includes('pathophysiology') ||
      t.rationale.toLowerCase().includes('etiology') ||
      t.rationale.toLowerCase().includes('underlying')
    )
  );
  checks.push({
    id: 'etiology',
    name: 'Etiology Addressed',
    description: 'Treatment rationale mentions underlying cause',
    passed: hasEtiology || recommended.length === 0,
    detail: hasEtiology ? 'Mechanism referenced in rationale' : 'No etiology reference found',
  });

  // 7. Consults present (if acute)
  const hasConsults = am?.consults && am.consults.length > 0;
  checks.push({
    id: 'consults',
    name: 'Specialist Consults',
    description: 'Specialist consultation recommendations included',
    passed: !!hasConsults,
    detail: hasConsults ? am!.consults!.join(', ') : 'None specified',
  });

  // 8. Do-not-do coverage
  checks.push({
    id: 'do_not_do',
    name: 'Do-Not-Do Coverage',
    description: 'Safety contraindications documented',
    passed: (am?.do_not_do?.length || 0) > 0,
    detail: `${am?.do_not_do?.length || 0} contraindication(s)`,
  });

  // 9. Evidence quality — keyword-matched papers
  const allPapers = opts.flatMap(t => t.papers_used || []);
  const keywordMatched = allPapers.filter(p => p.match_type === 'keyword').length;
  const evidenceRatio = allPapers.length > 0 ? keywordMatched / allPapers.length : 0;
  checks.push({
    id: 'evidence_quality',
    name: 'Evidence Quality',
    description: 'At least 30% of papers are keyword-matched (not title-only)',
    passed: allPapers.length === 0 || evidenceRatio >= 0.3,
    detail: `${keywordMatched}/${allPapers.length} keyword-matched (${Math.round(evidenceRatio * 100)}%)`,
  });

  // 10. Acute management present
  checks.push({
    id: 'acute_mgmt',
    name: 'Acute Management',
    description: 'Immediate actions and monitoring plan present',
    passed: !!(am?.immediate_actions?.length && am.immediate_actions.length > 0),
    detail: `${am?.immediate_actions?.length || 0} immediate action(s)`,
  });

  // 11. Monitoring plan
  checks.push({
    id: 'monitoring',
    name: 'Monitoring Plan',
    description: 'Patient monitoring parameters specified',
    passed: !!(am?.monitoring_plan?.length && am.monitoring_plan.length > 0),
    detail: `${am?.monitoring_plan?.length || 0} monitoring item(s)`,
  });

  // 12. DDx includes differential
  const hasDDx = ddx && ddx.diagnoses && ddx.diagnoses.length > 0;
  checks.push({
    id: 'ddx',
    name: 'Differential Diagnosis',
    description: 'Differential diagnoses generated with likelihood ranking',
    passed: !!hasDDx,
    detail: hasDDx ? `${ddx!.diagnoses.length} diagnoses` : 'Not generated',
  });

  // 13. Cross-field consistency: risk level vs disposition
  const riskText = (am?.risk_stratification || '').toLowerCase();
  const dispText = (am?.disposition || '').toLowerCase();
  const isHighRisk = /high|critical|severe|emergent/.test(riskText);
  const isDischarge = /discharge|home/.test(dispText);
  const crossFieldOk = !(isHighRisk && isDischarge);
  checks.push({
    id: 'cross_field',
    name: 'Cross-Field Consistency',
    description: 'Risk level coherent with disposition',
    passed: crossFieldOk,
    detail: crossFieldOk
      ? 'Risk and disposition are consistent'
      : 'High-risk case with discharge disposition',
  });

  // 14. Clinical pearls
  checks.push({
    id: 'pearls',
    name: 'Clinical Pearls',
    description: 'Educational clinical pearls generated',
    passed: (data.clinical_pearls?.length || 0) > 0,
    detail: `${data.clinical_pearls?.length || 0} pearl(s)`,
  });

  return checks;
}

function getGrade(score: number): { letter: string; color: string; label: string } {
  if (score >= 0.93) return { letter: 'A', color: 'text-emerald-600', label: 'Excellent' };
  if (score >= 0.85) return { letter: 'A-', color: 'text-emerald-600', label: 'Very Good' };
  if (score >= 0.78) return { letter: 'B+', color: 'text-blue-600', label: 'Good' };
  if (score >= 0.7) return { letter: 'B', color: 'text-blue-600', label: 'Satisfactory' };
  if (score >= 0.6) return { letter: 'C', color: 'text-amber-600', label: 'Needs Improvement' };
  return { letter: 'D', color: 'text-red-600', label: 'Below Standard' };
}

export function QualityScorecard({ result, className }: QualityScorecardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const checks = useMemo(() => runQualityChecks(result), [result]);
  const passed = checks.filter(c => c.passed).length;
  const total = checks.length;
  const score = total > 0 ? passed / total : 0;
  const grade = getGrade(score);
  const failed = checks.filter(c => !c.passed);

  return (
    <Card className={cn('border-slate-200 dark:border-slate-800', className)}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-accent/30 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-600" />
                Quality Scorecard
                <Badge variant="secondary" className="text-[10px] ml-1">
                  {passed}/{total} checks
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-2xl font-bold', grade.color)}>{grade.letter}</span>
                  <div className="text-right">
                    <p className={cn('text-xs font-medium', grade.color)}>{grade.label}</p>
                    <p className="text-[10px] text-muted-foreground">{Math.round(score * 100)}%</p>
                  </div>
                </div>
                <ChevronDown className={cn(
                  'w-4 h-4 text-muted-foreground transition-transform ml-2',
                  isExpanded && 'rotate-180',
                )} />
              </div>
            </div>

            {/* Compact dots view when collapsed */}
            {!isExpanded && (
              <div className="flex gap-1 mt-2">
                {checks.map(c => (
                  <div
                    key={c.id}
                    className={cn(
                      'w-2 h-2 rounded-full',
                      c.passed ? 'bg-emerald-500' : 'bg-red-400',
                    )}
                    title={`${c.name}: ${c.passed ? 'Pass' : 'Fail'}`}
                  />
                ))}
              </div>
            )}
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            {/* Failed checks first */}
            {failed.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Needs Attention ({failed.length})
                </p>
                <div className="space-y-1.5">
                  {failed.map(c => (
                    <div key={c.id} className="flex items-start gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
                      <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground">{c.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Passed checks */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Passing ({passed})
            </p>
            <div className="space-y-1">
              {checks.filter(c => c.passed).map(c => (
                <div key={c.id} className="flex items-center gap-2 py-1 px-2 rounded">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="text-xs">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto truncate max-w-[200px]">
                    {c.detail}
                  </span>
                </div>
              ))}
            </div>

            {/* Score bar */}
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center gap-2">
                <Award className={cn('w-4 h-4', grade.color)} />
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      score >= 0.8 ? 'bg-emerald-500' : score >= 0.6 ? 'bg-amber-500' : 'bg-red-500',
                    )}
                    style={{ width: `${Math.round(score * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  {Math.round(score * 100)}%
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 text-center">
                {total}-point quality evaluation based on clinical completeness, safety, and evidence
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
