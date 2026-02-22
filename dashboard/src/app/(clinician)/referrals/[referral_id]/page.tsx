'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  Send,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Stethoscope,
  ChevronDown,
  Plus,
  Trash2,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/api-url';
import type { Referral, ReferralStatus, ReferralUrgency } from '@/types/referral';
import type { TreatmentOption, AcuteManagement, ParsedCase } from '@/types/case';

const urgencyColor: Record<ReferralUrgency, string> = {
  emergent: 'bg-red-100 text-red-800 border-red-300',
  urgent: 'bg-amber-100 text-amber-800 border-amber-300',
  routine: 'bg-green-100 text-green-800 border-green-300',
};

const statusColor: Record<ReferralStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-purple-100 text-purple-700',
  responded: 'bg-green-100 text-green-700',
  completed: 'bg-gray-200 text-gray-500',
};

export default function ReferralDetailPage() {
  const params = useParams();
  const router = useRouter();
  const referralId = params.referral_id as string;

  const [referral, setReferral] = useState<Referral | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Response form state
  const [specialistName, setSpecialistName] = useState('');
  const [responseText, setResponseText] = useState('');
  const [recommendations, setRecommendations] = useState<string[]>(['']);
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const apiUrl = getApiUrl();
      try {
        const response = await fetch(`${apiUrl}/api/case/referral/${referralId}`);
        if (!response.ok) throw new Error('Referral not found');
        setReferral(await response.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load referral');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [referralId]);

  const handleSubmitResponse = async () => {
    if (!specialistName.trim() || !responseText.trim()) {
      toast.error('Please fill in your name and consultation note');
      return;
    }
    setIsSubmitting(true);
    try {
      const apiUrl = getApiUrl();
      const filteredRecs = recommendations.filter(r => r.trim());
      const response = await fetch(`${apiUrl}/api/case/referral/${referralId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specialist_name: specialistName.trim(),
          response: responseText.trim(),
          recommendations: filteredRecs,
          follow_up_needed: followUpNeeded,
        }),
      });
      if (!response.ok) throw new Error('Failed to submit response');
      setReferral(await response.json());
      toast.success('Response submitted');
    } catch {
      toast.error('Failed to submit response');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/case/referral/${referralId}/complete`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to complete referral');
      setReferral(prev => prev ? { ...prev, status: 'completed' } : null);
      toast.success('Referral marked as complete');
    } catch {
      toast.error('Failed to complete referral');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !referral) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-semibold mb-1">Referral Not Found</h2>
        <p className="text-sm text-muted-foreground mb-4">{error || 'This referral could not be loaded.'}</p>
        <Button variant="outline" onClick={() => router.push('/referrals')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Inbox
        </Button>
      </div>
    );
  }

  const pc = referral.parsed_case as unknown as ParsedCase | undefined;
  const am = referral.acute_management as unknown as AcuteManagement | undefined;
  const treatments = (referral.treatment_options || []) as unknown as TreatmentOption[];
  const ddx = referral.differential_diagnosis as { diagnoses?: Array<{ diagnosis: string; likelihood: string; supporting_findings: string[] }> } | null;

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <header className="mb-6">
          <Link href="/referrals" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="w-4 h-4" /> Back to Inbox
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Send className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight">{referral.specialty} Referral</h1>
                  <Badge className={cn('text-xs', urgencyColor[referral.urgency as ReferralUrgency])}>
                    {referral.urgency}
                  </Badge>
                  <Badge className={cn('text-xs', statusColor[referral.status as ReferralStatus])}>
                    {referral.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sent {new Date(referral.created_at).toLocaleString()}
                  {referral.view_count > 0 && ` · Viewed ${referral.view_count} time${referral.view_count !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Case Data (readonly) */}
          <div className="lg:col-span-3 space-y-4">
            {/* Referral Note */}
            <Card className="border-blue-200">
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

            {/* Case Summary */}
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

            {/* Treatment Options */}
            {treatments.length > 0 && (
              <Collapsible defaultOpen>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="pb-2 cursor-pointer hover:bg-accent/30 transition-colors">
                      <CardTitle className="text-sm flex items-center gap-1.5">
                        <Stethoscope className="w-4 h-4" />
                        Treatment Plan ({treatments.length})
                        <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
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
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

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
                            {am.immediate_actions.map((a, i) => <li key={i} className="flex gap-1"><span>-</span>{a}</li>)}
                          </ul>
                        </div>
                      )}
                      {am.monitoring_plan && am.monitoring_plan.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-1">Monitoring</p>
                          <ul className="text-xs space-y-0.5">
                            {am.monitoring_plan.map((m, i) => <li key={i} className="flex gap-1"><span>-</span>{m}</li>)}
                          </ul>
                        </div>
                      )}
                      {am.disposition && (
                        <p className="text-xs"><span className="font-semibold">Disposition:</span> {am.disposition}</p>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* DDx */}
            {ddx?.diagnoses && ddx.diagnoses.length > 0 && (
              <Collapsible>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="pb-2 cursor-pointer hover:bg-accent/30 transition-colors">
                      <CardTitle className="text-sm flex items-center gap-1.5">
                        <Stethoscope className="w-4 h-4 text-purple-600" />
                        Differential Diagnosis
                        <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
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
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* Clinical Pearls */}
            {referral.clinical_pearls?.length > 0 && (
              <Collapsible>
                <Card className="border-amber-500/30">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="pb-2 cursor-pointer hover:bg-accent/30 transition-colors">
                      <CardTitle className="text-sm flex items-center gap-1.5">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        Clinical Pearls
                        <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <ul className="space-y-1">
                        {referral.clinical_pearls.map((p, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex gap-2">
                            <span className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center text-[9px] font-bold text-amber-600 shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            {p}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* Pertinent Findings + Specific Asks */}
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
          </div>

          {/* Right: Specialist Response */}
          <div className="lg:col-span-2 space-y-4">
            {referral.status === 'responded' || referral.status === 'completed' ? (
              /* Read-only response display */
              <Card className="border-green-200">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      Specialist Response
                    </CardTitle>
                    <Badge className={cn('text-[10px]', statusColor[referral.status as ReferralStatus])}>
                      {referral.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">From</p>
                    <p className="text-sm font-medium">{referral.specialist_name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Consultation Note</p>
                    <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-lg p-3">{referral.specialist_response}</p>
                  </div>
                  {referral.recommendations?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Recommendations</p>
                      <ul className="space-y-1">
                        {referral.recommendations.map((r, i) => (
                          <li key={i} className="text-xs flex items-start gap-1.5">
                            <CheckCircle2 className="w-3 h-3 mt-0.5 text-green-500 shrink-0" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {referral.follow_up_needed && (
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700">
                      Follow-up needed
                    </Badge>
                  )}
                  {referral.status === 'responded' && (
                    <Button onClick={handleComplete} size="sm" className="w-full mt-2">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      Mark as Complete
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              /* Response form */
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Specialist Response</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Your Name</label>
                    <Input
                      value={specialistName}
                      onChange={(e) => setSpecialistName(e.target.value)}
                      placeholder="Dr. ..."
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Consultation Note</label>
                    <Textarea
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="Your assessment and recommendations..."
                      rows={10}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Recommendations</label>
                    <div className="space-y-1.5">
                      {recommendations.map((rec, i) => (
                        <div key={i} className="flex gap-1.5">
                          <Input
                            value={rec}
                            onChange={(e) => {
                              const updated = [...recommendations];
                              updated[i] = e.target.value;
                              setRecommendations(updated);
                            }}
                            placeholder={`Recommendation ${i + 1}`}
                            className="text-xs"
                          />
                          {recommendations.length > 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setRecommendations(recommendations.filter((_, j) => j !== i))}
                            >
                              <Trash2 className="w-3 h-3 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRecommendations([...recommendations, ''])}
                        className="text-xs w-full"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Recommendation
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="followup"
                      checked={followUpNeeded}
                      onChange={(e) => setFollowUpNeeded(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="followup" className="text-xs">Follow-up needed</label>
                  </div>
                  <Button
                    onClick={handleSubmitResponse}
                    disabled={isSubmitting || !specialistName.trim() || !responseText.trim()}
                    className="w-full"
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                    Submit Response
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
