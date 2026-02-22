'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, Mic, ChevronDown, ChevronUp, ClipboardCheck } from 'lucide-react';
import { useSelectedSummaryContext } from '@/contexts/SelectedSummaryContext';
import { usePostVisitContext } from '@/contexts/PostVisitContext';
import { PostVisitOverview } from '@/components/postvisit/PostVisitOverview';
import { CareHubScribe } from '@/components/care-hub/CareHubScribe';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n';

export default function MyVisitPage() {
  const { selectedSummary } = useSelectedSummaryContext();
  const router = useRouter();
  const [scribeOpen, setScribeOpen] = useState(false);
  const { t } = useTranslation();

  if (!selectedSummary) {
    return (
      <div className="text-center py-16">
        <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">{t('visit.noData')}</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {t('visit.noDataDesc')}
        </p>
        <Link
          href="/patient/checkin"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors"
        >
          <ClipboardCheck className="w-5 h-5" />
          {t('visit.startCheckin')}
        </Link>
      </div>
    );
  }

  const handleAskAI = (question: string) => {
    router.push('/patient/messages');
  };

  return (
    <div className="space-y-5">
      {/* Diagnosis header */}
      <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
        <p className="text-xs font-medium text-primary-foreground/70 uppercase tracking-wide mb-1">{t('visit.diagnosis')}</p>
        <p className="text-lg font-semibold">{selectedSummary.diagnosis}</p>
        {selectedSummary.diagnosisExplanation && (
          <p className="text-sm text-primary-foreground/80 mt-1">{selectedSummary.diagnosisExplanation}</p>
        )}
      </div>

      {/* Visit Overview */}
      <PostVisitOverview summary={selectedSummary} onAskAI={handleAskAI} />

      {/* Scribe section */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <button
          onClick={() => setScribeOpen(!scribeOpen)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-3">
            <Mic className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{t('visit.recordNotes')}</span>
          </div>
          {scribeOpen ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        {scribeOpen && (
          <div className="border-t border-border p-4">
            <CareHubScribe />
          </div>
        )}
      </div>
    </div>
  );
}
