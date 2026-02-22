'use client';

import Link from 'next/link';
import {
  ClipboardCheck,
  Pill,
  Activity,
  MessageCircle,
  Sparkles,
  AlertTriangle,
  Calendar,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { useSelectedSummaryContext } from '@/contexts/SelectedSummaryContext';
import { usePostVisitContext } from '@/contexts/PostVisitContext';
import { CarePlanChecklist } from '@/components/care-hub/CarePlanChecklist';
import { VisitPicker } from '@/components/care-hub/VisitPicker';
import { ExplainableText } from '@/components/patient/terms/ExplainableText';
import { useCarePlan } from '@/hooks/useCarePlan';
import { getIntakeResults } from '@/lib/storage';
import type { IntakeTriageResult } from '@/types/intake';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n';

function ESIBadge({ level }: { level: number }) {
  const colors: Record<number, string> = {
    1: 'bg-red-100 text-red-700',
    2: 'bg-orange-100 text-orange-700',
    3: 'bg-amber-100 text-amber-700',
    4: 'bg-green-100 text-green-700',
    5: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[level] ?? 'bg-slate-100 text-slate-600'}`}>
      ESI {level}
    </span>
  );
}

export default function CareHubHomePage() {
  const { allSummaries, selectedSummary, patient } = useSelectedSummaryContext();
  const postVisit = usePostVisitContext();
  const router = useRouter();
  const { t, bcp47 } = useTranslation();
  const [latestIntake, setLatestIntake] = useState<IntakeTriageResult | null>(null);

  useEffect(() => {
    const results = getIntakeResults();
    if (results.length > 0) setLatestIntake(results[0]);
  }, []);

  // No summaries — empty state
  if (allSummaries.length === 0) {
    return (
      <div className="space-y-8 py-4">
        {/* Greeting */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900">
            {patient ? t('home.greetingWithName', { firstName: patient.firstName }) : t('home.greeting')}
          </h2>
          <p className="text-slate-500 mt-1">{t('home.howAreYou')}</p>
        </div>

        {/* Hero CTA */}
        <Link
          href="/patient/checkin"
          className="flex items-center justify-center gap-3 w-full py-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white font-semibold text-lg rounded-2xl shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30 transition-all active:scale-[0.98]"
        >
          <ClipboardCheck className="w-6 h-6" />
          {t('home.startCheckin')}
        </Link>

        {/* How it works */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide text-center">
            {t('home.howItWorks')}
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { step: '1', labelKey: 'home.step1', icon: MessageCircle },
              { step: '2', labelKey: 'home.step2', icon: CheckCircle2 },
              { step: '3', labelKey: 'home.step3', icon: ArrowRight },
            ].map(item => (
              <div key={item.step} className="flex flex-col items-center text-center gap-2 p-3 rounded-xl bg-white border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center">
                  <item.icon className="w-4 h-4 text-teal-600" />
                </div>
                <p className="text-xs font-medium text-slate-600">{t(item.labelKey)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Past check-ins */}
        {latestIntake && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-500">{t('home.pastCheckins')}</h3>
            <div className="p-4 rounded-xl bg-white border border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {latestIntake.triageData.chief_complaint || t('home.checkinCompleted')}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(latestIntake.completedAt).toLocaleDateString(bcp47, {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                </div>
                {latestIntake.triageData.esi_level && (
                  <ESIBadge level={latestIntake.triageData.esi_level} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // With data — dashboard state
  return <CareHubDashboard />;
}

function CareHubDashboard() {
  const { selectedSummary, patient } = useSelectedSummaryContext();
  const postVisit = usePostVisitContext();
  const router = useRouter();

  if (!selectedSummary) return null;

  return <CareHubDashboardInner />;
}

function CareHubDashboardInner() {
  const { selectedSummary, patient } = useSelectedSummaryContext();
  const postVisit = usePostVisitContext();
  const router = useRouter();
  const { t, bcp47 } = useTranslation();

  const summary = selectedSummary!;
  const { items: carePlanItems, statuses: carePlanStatuses, updateStatus: updateCarePlanStatus } = useCarePlan(summary);

  const activeMeds = summary.medications.filter(m => m.action !== 'discontinue');
  const nextFollowUp = summary.followUps[0];
  const visitDate = new Date(summary.visitDate).toLocaleDateString(bcp47, {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  const handleAskAI = useCallback((question: string) => {
    router.push('/patient/messages');
  }, [router]);

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div className="rounded-2xl bg-gradient-to-br from-teal-50 to-white border border-teal-100 p-5">
        <h2 className="text-xl font-bold text-slate-900">
          {patient ? t('home.welcomeBackWithName', { firstName: patient.firstName }) : t('home.welcomeBack')}
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          {t('home.visitOn', { date: visitDate })}
        </p>
      </div>

      {/* Visit picker */}
      <VisitPicker />

      {/* Action cards */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/patient/checkin"
          className="p-4 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-sm hover:shadow-md transition-shadow"
        >
          <ClipboardCheck className="w-5 h-5 mb-2" />
          <p className="text-sm font-semibold">{t('home.newCheckin')}</p>
          <p className="text-xs text-teal-100 mt-0.5">{t('home.startIntake')}</p>
        </Link>
        {nextFollowUp ? (
          <div className="p-4 rounded-xl bg-white border border-slate-200">
            <Calendar className="w-5 h-5 text-slate-400 mb-2" />
            <p className="text-sm font-semibold text-slate-900">{t('home.nextAppointment')}</p>
            <p className="text-xs text-slate-500 mt-0.5">{nextFollowUp.timeframe} &middot; {nextFollowUp.provider}</p>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-white border border-slate-200">
            <Calendar className="w-5 h-5 text-slate-400 mb-2" />
            <p className="text-sm font-semibold text-slate-900">{t('home.noUpcoming')}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t('home.appointments')}</p>
          </div>
        )}
      </div>

      {/* Care Plan */}
      {carePlanItems.length > 0 && (
        <CarePlanChecklist
          items={carePlanItems}
          statuses={carePlanStatuses}
          onStatusChange={updateCarePlanStatus}
          onAskAI={handleAskAI}
        />
      )}

      {/* Warning Signs */}
      {summary.redFlags.length > 0 && (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-700">{t('home.warningSigns')}</h3>
          </div>
          <div className="space-y-2">
            {summary.redFlags.map((flag, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-red-400 shrink-0" />
                <p className="text-sm text-red-700">
                  <ExplainableText text={flag} />
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/patient/health" className="p-4 rounded-xl bg-white border border-slate-200 hover:shadow-sm transition-shadow">
          <Pill className="w-5 h-5 text-teal-600 mb-1.5" />
          <p className="text-sm font-medium text-slate-900">{t('home.medications')}</p>
          <p className="text-xs text-slate-400">{t('home.activeCount', { count: activeMeds.length })}</p>
        </Link>
        <Link href="/patient/health" className="p-4 rounded-xl bg-white border border-slate-200 hover:shadow-sm transition-shadow">
          <Activity className="w-5 h-5 text-teal-600 mb-1.5" />
          <p className="text-sm font-medium text-slate-900">{t('home.labsVitals')}</p>
          <p className="text-xs text-slate-400">{t('home.viewResults')}</p>
        </Link>
        <Link href="/patient/messages" className="p-4 rounded-xl bg-white border border-slate-200 hover:shadow-sm transition-shadow">
          <Sparkles className="w-5 h-5 text-teal-600 mb-1.5" />
          <p className="text-sm font-medium text-slate-900">{t('home.askAI')}</p>
          <p className="text-xs text-slate-400">{t('home.aboutYourVisit')}</p>
        </Link>
        <Link href="/patient/messages?tab=doctor" className="p-4 rounded-xl bg-white border border-slate-200 hover:shadow-sm transition-shadow">
          <MessageCircle className="w-5 h-5 text-teal-600 mb-1.5" />
          <p className="text-sm font-medium text-slate-900">{t('home.messageDoctor')}</p>
          <p className="text-xs text-slate-400">{t('home.sendNote')}</p>
        </Link>
      </div>

      {/* Ask anything prompt bar */}
      <Link
        href="/patient/messages"
        className="flex items-center gap-3 px-4 py-3.5 bg-white rounded-2xl border border-slate-200 hover:shadow-sm transition-shadow"
      >
        <Sparkles className="w-5 h-5 text-teal-500" />
        <span className="text-sm text-slate-400 flex-1">{t('home.askAnything')}</span>
        <ArrowRight className="w-4 h-4 text-slate-300" />
      </Link>
    </div>
  );
}
