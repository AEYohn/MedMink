'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Send,
  Loader2,
  Inbox,
  ArrowLeft,
  Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/api-url';
import type { ReferralSummary, ReferralStatus, ReferralUrgency } from '@/types/referral';

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

const STATUS_OPTIONS: ReferralStatus[] = ['sent', 'viewed', 'responded', 'completed'];

export default function ReferralsInboxPage() {
  const [referrals, setReferrals] = useState<ReferralSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [specialtyFilter, setSpecialtyFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReferralStatus | null>(null);

  const loadReferrals = useCallback(async () => {
    const apiUrl = getApiUrl();
    try {
      const params = new URLSearchParams();
      if (specialtyFilter) params.set('specialty', specialtyFilter);
      if (statusFilter) params.set('status', statusFilter);
      const response = await fetch(`${apiUrl}/api/case/referrals/inbox?${params}`);
      if (response.ok) {
        setReferrals(await response.json());
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [specialtyFilter, statusFilter]);

  useEffect(() => {
    loadReferrals();
  }, [loadReferrals]);

  // Extract unique specialties for filter pills
  const specialties = Array.from(new Set(referrals.map(r => r.specialty)));

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <header className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Send className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Referral Inbox</h1>
              <p className="text-xs text-muted-foreground">
                Review and respond to specialist referrals
              </p>
            </div>
          </div>
        </header>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Button
            size="sm"
            variant={!specialtyFilter ? 'default' : 'outline'}
            onClick={() => setSpecialtyFilter(null)}
            className="text-xs"
          >
            All
          </Button>
          {specialties.map(s => (
            <Button
              key={s}
              size="sm"
              variant={specialtyFilter === s ? 'default' : 'outline'}
              onClick={() => setSpecialtyFilter(s)}
              className="text-xs"
            >
              {s}
            </Button>
          ))}
          <div className="ml-auto">
            <select
              value={statusFilter || ''}
              onChange={(e) => setStatusFilter(e.target.value as ReferralStatus || null)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Referrals List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : referrals.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Inbox className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No referrals found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Referrals sent from case analyses will appear here
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {referrals.map((ref) => (
              <Link
                key={ref.referral_id}
                href={`/referrals/${ref.referral_id}`}
                className="block"
              >
                <Card className="hover:bg-accent/30 transition-colors cursor-pointer">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {/* Urgency */}
                      <Badge className={cn('text-[10px] shrink-0', urgencyColor[ref.urgency])}>
                        {ref.urgency}
                      </Badge>

                      {/* Patient / Specialty */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{ref.specialty}</span>
                          {ref.patient_id && (
                            <span className="text-xs text-muted-foreground">
                              Patient: {ref.patient_id}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {ref.clinical_question}
                        </p>
                      </div>

                      {/* Status + Time */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={cn('text-[10px]', statusColor[ref.status as ReferralStatus])}>
                          {ref.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {formatTime(ref.created_at)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
