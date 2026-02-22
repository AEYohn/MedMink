'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2,
  Send,
  AlertTriangle,
  Lightbulb,
  Stethoscope,
  ChevronDown,
  FileText,
  Clock,
  Phone,
  ShieldAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/api-url';
import type { Referral, ReferralUrgency } from '@/types/referral';
import type { TreatmentOption, AcuteManagement, ParsedCase } from '@/types/case';

const urgencyColor: Record<ReferralUrgency, string> = {
  emergent: 'bg-red-100 text-red-800 border-red-300',
  urgent: 'bg-amber-100 text-amber-800 border-amber-300',
  routine: 'bg-green-100 text-green-800 border-green-300',
};

export default function SharedReferralPage() {
  const params = useParams();
  const token = params.token as string;

  const [referral, setReferral] = useState<Referral | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const apiUrl = getApiUrl();
      try {
        const response = await fetch(`${apiUrl}/api/case/referral/shared/${token}`);
        if (response.status === 404) {
          setError('expired');
        } else if (!response.ok) {
          setError('Failed to load referral');
        } else {
          setReferral(await response.json());
        }
      } catch {
        setError('Failed to load referral');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading referral...</p>
        </div>
      </div>
    );
  }

  if (error === 'expired') {
    return (
      <div className="min-h-screen bg-background">
        <SharedHeader />
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <ShieldAlert className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Link Expired or Invalid</h2>
          <p className="text-sm text-muted-foreground mb-4">
            This referral link has expired or is no longer valid.
            Please contact the referring physician for an updated link.
          </p>
        </div>
      </div>
    );
  }

  if (error || !referral) {
    return (
      <div className="min-h-screen bg-background">
        <SharedHeader />
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <AlertTriangle className="w-12 h-12 text-destructive/50 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Unable to Load Referral</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const pc = referral.parsed_case as unknown as ParsedCase | undefined;
  const am = referral.acute_management as unknown as AcuteManagement | undefined;
  const treatments = (referral.treatment_options || []) as unknown as TreatmentOption[];
  const ddx = referral.differential_diagnosis as { diagnoses?: Array<{ diagnosis: string; likelihood: string; supporting_findings: string[] }> } | null;

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader />

      {/* External Referral Banner */}
      <div className="bg-blue-50 border-b border-blue-200">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between">
          <p className="text-xs text-blue-700 font-medium">External Referral View — Read Only</p>
          {referral.link_expires_at && (
            <p className="text-[10px] text-blue-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Expires {new Date(referral.link_expires_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Referral Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Send className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">{referral.specialty} Referral</h1>
                <Badge className={cn('text-xs', urgencyColor[referral.urgency as ReferralUrgency])}>
                  {referral.urgency}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Sent {new Date(referral.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Clinical Question (prominent) */}
        <Card className="border-blue-200 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Clinical Question</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium bg-blue-50 p-3 rounded-lg">{referral.clinical_question}</p>
            {referral.reason_for_urgency && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded p-2">
                <p className="text-xs text-amber-800">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  {referral.reason_for_urgency}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-4">
            {/* Patient Summary */}
            {pc && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <FileText className="w-4 h-4" /> Patient Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Age:</span> {pc.patient?.age}</div>
                    <div><span className="text-muted-foreground">Sex:</span> {pc.patient?.sex}</div>
                    <div><span className="text-muted-foreground">Category:</span> {pc.case_category}</div>
                  </div>
                  {pc.findings?.presentation && (
                    <p className="text-xs text-muted-foreground">{pc.findings.presentation}</p>
                  )}
                  {pc.patient?.relevant_history?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">History</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {pc.patient.relevant_history.map((h, i) => <li key={i}>- {h}</li>)}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Referral Details */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Referral Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {referral.relevant_history && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Relevant History</p>
                    <p className="text-xs">{referral.relevant_history}</p>
                  </div>
                )}
                {referral.pertinent_findings?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Pertinent Findings</p>
                    <ul className="text-xs space-y-0.5">
                      {referral.pertinent_findings.map((f, i) => <li key={i}>- {f}</li>)}
                    </ul>
                  </div>
                )}
                {referral.current_management && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Current Management</p>
                    <p className="text-xs">{referral.current_management}</p>
                  </div>
                )}
                {referral.specific_asks?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Specific Asks</p>
                    <ol className="text-xs list-decimal list-inside space-y-0.5">
                      {referral.specific_asks.map((a, i) => <li key={i}>{a}</li>)}
                    </ol>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Acute Management */}
            {am && (am.immediate_actions?.length || am.monitoring_plan?.length) && (
              <Collapsible>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="pb-2 cursor-pointer hover:bg-accent/30 transition-colors">
                      <CardTitle className="text-sm flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Acute Management
                        <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-2">
                      {am.risk_stratification && (
                        <p className="text-xs bg-amber-50 p-2 rounded">{am.risk_stratification}</p>
                      )}
                      {am.immediate_actions && am.immediate_actions.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-1">Immediate Actions</p>
                          <ul className="text-xs space-y-0.5">
                            {am.immediate_actions.map((a, i) => <li key={i}>- {a}</li>)}
                          </ul>
                        </div>
                      )}
                      {am.monitoring_plan && am.monitoring_plan.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-1">Monitoring</p>
                          <ul className="text-xs space-y-0.5">
                            {am.monitoring_plan.map((m, i) => <li key={i}>- {m}</li>)}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Treatment Plan */}
            {treatments.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Stethoscope className="w-4 h-4" />
                    Treatment Plan ({treatments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {treatments.map((t, i) => (
                    <div key={i} className="flex items-start gap-2 bg-muted/30 rounded-lg p-2">
                      <Badge variant="outline" className={cn('text-[10px] shrink-0',
                        t.verdict === 'recommended' ? 'bg-green-500/10 text-green-600' :
                        t.verdict === 'not_recommended' ? 'bg-red-500/10 text-red-600' :
                        'bg-amber-500/10 text-amber-600'
                      )}>
                        {t.verdict}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{t.name}</p>
                        {t.rationale && <p className="text-xs text-muted-foreground mt-0.5">{t.rationale}</p>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* DDx */}
            {ddx?.diagnoses && ddx.diagnoses.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Stethoscope className="w-4 h-4 text-purple-600" />
                    Differential Diagnosis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {ddx.diagnoses.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className={cn('text-[10px]',
                        d.likelihood === 'high' ? 'bg-red-50 text-red-600' :
                        d.likelihood === 'moderate' ? 'bg-amber-50 text-amber-600' :
                        'bg-gray-50 text-gray-500'
                      )}>
                        {d.likelihood}
                      </Badge>
                      <span className="font-medium">{d.diagnosis}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Clinical Pearls */}
            {referral.clinical_pearls?.length > 0 && (
              <Card className="border-amber-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-500" /> Clinical Pearls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {referral.clinical_pearls.map((p, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-2">
                        <span className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center text-[9px] font-bold text-amber-600 shrink-0">
                          {i + 1}
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Contact CTA */}
            <Card className="border-primary/30">
              <CardContent className="pt-4 pb-4 text-center">
                <Phone className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium">Need to discuss this case?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Contact the referring physician directly to provide your consultation.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function SharedHeader() {
  return (
    <header className="h-14 bg-card/80 backdrop-blur-xl border-b border-border flex items-center px-4 lg:px-5 gap-3 sticky top-0 z-40">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
          <svg viewBox="0 0 24 24" fill="none" className="w-[18px] h-[18px] text-primary-foreground" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 3C7.5 3 5 4.5 5 7c0 1.5.5 2.5 1 3-1.5 1-3 3-3 6 0 3 2 5 5 5 1.5 0 3-.5 4-2 1 1.5 2.5 2 4 2 3 0 5-2 5-5 0-3-1.5-5-3-6 .5-.5 1-1.5 1-3 0-2.5-2.5-4-4-4-1 0-2 .5-3 1.5C11 3.5 10 3 9 3z"/>
            <circle cx="9" cy="7.5" r="0.8" fill="currentColor" stroke="none"/>
            <circle cx="15" cy="7.5" r="0.8" fill="currentColor" stroke="none"/>
            <path d="M10.5 10c.5.5 2.5.5 3 0"/>
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight">
            <span className="text-foreground">Med</span><span className="text-primary">Mink</span>
          </h1>
          <p className="text-2xs text-muted-foreground -mt-0.5 tracking-wide uppercase">Clinical Intelligence</p>
        </div>
      </div>
    </header>
  );
}
