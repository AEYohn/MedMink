'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Pill, Activity, Calendar, ChevronDown, ChevronUp, ClipboardCheck, HeartPulse } from 'lucide-react';
import { useSelectedSummaryContext } from '@/contexts/SelectedSummaryContext';
import { usePostVisitContext } from '@/contexts/PostVisitContext';
import { CareHubMedications } from '@/components/care-hub/CareHubMedications';
import { CareHubLabs } from '@/components/care-hub/CareHubLabs';
import { CareHubAppointments } from '@/components/care-hub/CareHubAppointments';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n';

function Section({
  icon: Icon,
  title,
  defaultOpen = true,
  children,
}: {
  icon: typeof Pill;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-primary" />
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="border-t border-border p-4">
          {children}
        </div>
      )}
    </div>
  );
}

export default function MyHealthPage() {
  const { selectedSummary } = useSelectedSummaryContext();
  const postVisit = usePostVisitContext();
  const router = useRouter();
  const { t } = useTranslation();

  // Trigger vitals loading when page mounts
  useEffect(() => {
    postVisit.setActiveTab('tracker');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!selectedSummary) {
    return (
      <div className="text-center py-16">
        <HeartPulse className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">{t('health.noData')}</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {t('health.noDataDesc')}
        </p>
        <Link
          href="/patient/checkin"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors"
        >
          <ClipboardCheck className="w-5 h-5" />
          {t('health.startCheckin')}
        </Link>
      </div>
    );
  }

  const handleAskAI = (question: string) => {
    router.push('/patient/messages');
  };

  return (
    <div className="space-y-4">
      <Section icon={Pill} title={t('health.medications')} defaultOpen={true}>
        <CareHubMedications summary={selectedSummary} onAskAI={handleAskAI} />
      </Section>

      <Section icon={Activity} title={t('health.labsVitals')} defaultOpen={true}>
        <CareHubLabs
          summary={selectedSummary}
          vitals={postVisit.vitals}
          vitalTrends={postVisit.vitalTrends}
          vitalAnalysis={postVisit.vitalAnalysis}
          onLogVital={postVisit.logVital}
          onImport={postVisit.importVitals}
          onAnalyze={postVisit.analyzeVitals}
          vitalsLoading={postVisit.vitalsLoading}
        />
      </Section>

      <Section icon={Calendar} title={t('health.appointments')} defaultOpen={false}>
        <CareHubAppointments summary={selectedSummary} />
      </Section>
    </div>
  );
}
