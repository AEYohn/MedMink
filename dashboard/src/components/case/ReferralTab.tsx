'use client';

import { useState } from 'react';
import {
  Send,
  Loader2,
  Copy,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  FileText,
  ArrowRightLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface ReferralNote {
  specialty: string;
  urgency: 'emergent' | 'urgent' | 'routine';
  clinical_question: string;
  relevant_history: string;
  pertinent_findings: string[];
  current_management: string;
  specific_asks: string[];
  reason_for_urgency: string;
}

interface HandoffContent {
  // I-PASS fields
  illness_severity?: string;
  patient_summary?: string;
  action_list?: string[];
  situation_awareness?: Array<{ watch_for: string; if_then: string }>;
  synthesis_questions?: string[];
  // SBAR fields
  situation?: string;
  background?: string;
  assessment?: string;
  recommendation?: string[];
  // error
  error?: string;
}

interface HandoffNote {
  format: string;
  content: HandoffContent;
}

interface ReferralTabProps {
  parsedCase: Record<string, unknown>;
  treatmentOptions: Array<Record<string, unknown>>;
  acuteManagement: Record<string, unknown>;
  suggestedConsults: string[];
}

const urgencyColor = {
  emergent: 'bg-red-100 text-red-800 border-red-300',
  urgent: 'bg-amber-100 text-amber-800 border-amber-300',
  routine: 'bg-green-100 text-green-800 border-green-300',
};

export function ReferralTab({
  parsedCase,
  treatmentOptions,
  acuteManagement,
  suggestedConsults,
}: ReferralTabProps) {
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [referral, setReferral] = useState<ReferralNote | null>(null);
  const [handoff, setHandoff] = useState<HandoffNote | null>(null);
  const [handoffFormat, setHandoffFormat] = useState<'ipass' | 'sbar'>('ipass');
  const [isLoadingReferral, setIsLoadingReferral] = useState(false);
  const [isLoadingHandoff, setIsLoadingHandoff] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [copiedHandoff, setCopiedHandoff] = useState(false);

  const specialty = customSpecialty || selectedSpecialty;

  const handleGenerateReferral = async () => {
    if (!specialty) return;
    setIsLoadingReferral(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const response = await fetch(`${apiUrl}/api/case/referral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specialty,
          parsed_case: parsedCase,
          treatment_options: treatmentOptions,
          acute_management: acuteManagement,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setReferral(data);
      }
    } catch (err) {
      console.error('Referral generation failed:', err);
    } finally {
      setIsLoadingReferral(false);
    }
  };

  const handleGenerateHandoff = async () => {
    setIsLoadingHandoff(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const response = await fetch(`${apiUrl}/api/case/handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: handoffFormat,
          parsed_case: parsedCase,
          treatment_options: treatmentOptions,
          acute_management: acuteManagement,
          pending_tasks: [],
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setHandoff(data);
      }
    } catch (err) {
      console.error('Handoff generation failed:', err);
    } finally {
      setIsLoadingHandoff(false);
    }
  };

  const copyReferralText = () => {
    if (!referral) return;
    const text = formatReferralText(referral);
    navigator.clipboard.writeText(text);
    setCopiedReferral(true);
    setTimeout(() => setCopiedReferral(false), 2000);
  };

  const copyHandoffText = () => {
    if (!handoff) return;
    const text = formatHandoffText(handoff);
    navigator.clipboard.writeText(text);
    setCopiedHandoff(true);
    setTimeout(() => setCopiedHandoff(false), 2000);
  };

  // Extract specialty names from consult strings like "Cardiology (emergent)"
  const specialtyOptions = suggestedConsults.map((c) => {
    const match = c.match(/^([^(]+)/);
    return match ? match[1].trim() : c;
  });

  return (
    <div className="space-y-6">
      {/* Referral Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-1">
          <Send className="w-4 h-4" /> Referral Note
        </h3>

        {/* Specialty Selector */}
        <div className="flex gap-2 flex-wrap">
          {specialtyOptions.map((spec) => (
            <Button
              key={spec}
              size="sm"
              variant={selectedSpecialty === spec && !customSpecialty ? 'default' : 'outline'}
              onClick={() => { setSelectedSpecialty(spec); setCustomSpecialty(''); }}
              className="text-xs"
            >
              {spec}
            </Button>
          ))}
          <Input
            placeholder="Other specialty..."
            value={customSpecialty}
            onChange={(e) => { setCustomSpecialty(e.target.value); setSelectedSpecialty(''); }}
            className="w-40 h-8 text-xs"
          />
          <Button
            onClick={handleGenerateReferral}
            disabled={!specialty || isLoadingReferral}
            size="sm"
          >
            {isLoadingReferral ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
            Generate
          </Button>
        </div>

        {/* Referral Result */}
        {referral && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  Referral to {referral.specialty}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className={cn('text-xs', urgencyColor[referral.urgency])}>
                    {referral.urgency}
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={copyReferralText}>
                    {copiedReferral ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {referral.reason_for_urgency && (
                <div className="bg-amber-50 border border-amber-200 rounded p-2">
                  <p className="text-xs text-amber-800">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    {referral.reason_for_urgency}
                  </p>
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Clinical Question</h4>
                <p className="text-sm font-medium bg-blue-50 p-2 rounded">{referral.clinical_question}</p>
              </div>

              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                  <ChevronDown className="w-3 h-3" /> Relevant History
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <p className="text-sm mt-1">{referral.relevant_history}</p>
                </CollapsibleContent>
              </Collapsible>

              {referral.pertinent_findings?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Pertinent Findings</h4>
                  <ul className="space-y-0.5">
                    {referral.pertinent_findings.map((f, i) => (
                      <li key={i} className="text-sm flex items-start gap-1">
                        <span className="text-muted-foreground">-</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {referral.current_management && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Current Management</h4>
                  <p className="text-sm">{referral.current_management}</p>
                </div>
              )}

              {referral.specific_asks?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Specific Asks</h4>
                  <ol className="list-decimal list-inside space-y-0.5">
                    {referral.specific_asks.map((ask, i) => (
                      <li key={i} className="text-sm">{ask}</li>
                    ))}
                  </ol>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Handoff Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-1">
          <ArrowRightLeft className="w-4 h-4" /> Handoff Note
        </h3>

        <div className="flex gap-2 items-center">
          <Button
            size="sm"
            variant={handoffFormat === 'ipass' ? 'default' : 'outline'}
            onClick={() => setHandoffFormat('ipass')}
            className="text-xs"
          >
            I-PASS
          </Button>
          <Button
            size="sm"
            variant={handoffFormat === 'sbar' ? 'default' : 'outline'}
            onClick={() => setHandoffFormat('sbar')}
            className="text-xs"
          >
            SBAR
          </Button>
          <Button
            onClick={handleGenerateHandoff}
            disabled={isLoadingHandoff}
            size="sm"
          >
            {isLoadingHandoff ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <FileText className="w-3.5 h-3.5 mr-1" />}
            Generate Handoff
          </Button>
        </div>

        {/* Handoff Result */}
        {handoff && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  {handoff.format === 'ipass' ? 'I-PASS' : 'SBAR'} Handoff
                </CardTitle>
                <Button size="sm" variant="ghost" onClick={copyHandoffText}>
                  {copiedHandoff ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {handoff.format === 'ipass' ? (
                <IPASSContent content={handoff.content} />
              ) : (
                <SBARContent content={handoff.content} />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function IPASSContent({ content }: { content: HandoffContent }) {
  const severityColor: Record<string, string> = {
    stable: 'bg-green-100 text-green-800',
    watcher: 'bg-amber-100 text-amber-800',
    unstable: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-muted-foreground">I — Illness Severity</span>
          {content.illness_severity && (
            <Badge className={cn('text-xs', severityColor[content.illness_severity] || 'bg-gray-100')}>
              {content.illness_severity}
            </Badge>
          )}
        </div>
      </div>

      {content.patient_summary && (
        <div>
          <span className="text-xs font-bold text-muted-foreground">P — Patient Summary</span>
          <p className="text-sm mt-0.5">{content.patient_summary}</p>
        </div>
      )}

      {content.action_list && content.action_list.length > 0 && (
        <div>
          <span className="text-xs font-bold text-muted-foreground">A — Action List</span>
          <ul className="mt-0.5 space-y-0.5">
            {content.action_list.map((action, i) => (
              <li key={i} className="text-sm flex items-start gap-1">
                <CheckCircle2 className="w-3 h-3 mt-1 text-blue-500 shrink-0" /> {action}
              </li>
            ))}
          </ul>
        </div>
      )}

      {content.situation_awareness && content.situation_awareness.length > 0 && (
        <div>
          <span className="text-xs font-bold text-muted-foreground">S — Situation Awareness</span>
          <ul className="mt-0.5 space-y-1">
            {content.situation_awareness.map((sa, i) => (
              <li key={i} className="text-sm">
                <span className="text-amber-700">Watch:</span> {sa.watch_for}
                <br />
                <span className="text-blue-700">Then:</span> {sa.if_then}
              </li>
            ))}
          </ul>
        </div>
      )}

      {content.synthesis_questions && content.synthesis_questions.length > 0 && (
        <div>
          <span className="text-xs font-bold text-muted-foreground">S — Synthesis</span>
          <ul className="mt-0.5 space-y-0.5">
            {content.synthesis_questions.map((q, i) => (
              <li key={i} className="text-sm text-muted-foreground">- {q}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SBARContent({ content }: { content: HandoffContent }) {
  return (
    <div className="space-y-3">
      {content.situation && (
        <div>
          <span className="text-xs font-bold text-muted-foreground">S — Situation</span>
          <p className="text-sm mt-0.5">{content.situation}</p>
        </div>
      )}

      {content.background && (
        <div>
          <span className="text-xs font-bold text-muted-foreground">B — Background</span>
          <p className="text-sm mt-0.5">{content.background}</p>
        </div>
      )}

      {content.assessment && (
        <div>
          <span className="text-xs font-bold text-muted-foreground">A — Assessment</span>
          <p className="text-sm mt-0.5">{content.assessment}</p>
        </div>
      )}

      {content.recommendation && content.recommendation.length > 0 && (
        <div>
          <span className="text-xs font-bold text-muted-foreground">R — Recommendation</span>
          <ul className="mt-0.5 space-y-0.5">
            {content.recommendation.map((r, i) => (
              <li key={i} className="text-sm flex items-start gap-1">
                <CheckCircle2 className="w-3 h-3 mt-1 text-blue-500 shrink-0" /> {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatReferralText(referral: ReferralNote): string {
  let text = `=== REFERRAL TO ${referral.specialty.toUpperCase()} ===\n`;
  text += `Urgency: ${referral.urgency}\n\n`;
  text += `CLINICAL QUESTION:\n${referral.clinical_question}\n\n`;
  if (referral.relevant_history) text += `RELEVANT HISTORY:\n${referral.relevant_history}\n\n`;
  if (referral.pertinent_findings?.length) {
    text += 'PERTINENT FINDINGS:\n';
    referral.pertinent_findings.forEach((f) => { text += `- ${f}\n`; });
    text += '\n';
  }
  if (referral.current_management) text += `CURRENT MANAGEMENT:\n${referral.current_management}\n\n`;
  if (referral.specific_asks?.length) {
    text += 'SPECIFIC ASKS:\n';
    referral.specific_asks.forEach((a, i) => { text += `${i + 1}. ${a}\n`; });
  }
  return text;
}

function formatHandoffText(handoff: HandoffNote): string {
  const c = handoff.content;
  if (handoff.format === 'ipass') {
    let text = '=== I-PASS HANDOFF ===\n\n';
    text += `I — Illness Severity: ${c.illness_severity || 'N/A'}\n`;
    text += `P — Patient Summary: ${c.patient_summary || 'N/A'}\n`;
    if (c.action_list?.length) {
      text += 'A — Action List:\n';
      c.action_list.forEach((a) => { text += `  - ${a}\n`; });
    }
    if (c.situation_awareness?.length) {
      text += 'S — Situation Awareness:\n';
      c.situation_awareness.forEach((sa) => {
        text += `  Watch: ${sa.watch_for}\n  Then: ${sa.if_then}\n`;
      });
    }
    if (c.synthesis_questions?.length) {
      text += 'S — Synthesis:\n';
      c.synthesis_questions.forEach((q) => { text += `  - ${q}\n`; });
    }
    return text;
  } else {
    let text = '=== SBAR HANDOFF ===\n\n';
    text += `S — Situation: ${c.situation || 'N/A'}\n`;
    text += `B — Background: ${c.background || 'N/A'}\n`;
    text += `A — Assessment: ${c.assessment || 'N/A'}\n`;
    if (c.recommendation?.length) {
      text += 'R — Recommendation:\n';
      c.recommendation.forEach((r) => { text += `  - ${r}\n`; });
    }
    return text;
  }
}
