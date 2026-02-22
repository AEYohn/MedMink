'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, Mic, ChevronDown, ChevronUp, ClipboardCheck } from 'lucide-react';
import { useSelectedSummaryContext } from '@/contexts/SelectedSummaryContext';
import { usePostVisitContext } from '@/contexts/PostVisitContext';
import { PostVisitOverview } from '@/components/postvisit/PostVisitOverview';
import { CareHubScribe } from '@/components/care-hub/CareHubScribe';
import { useRouter } from 'next/navigation';

export default function MyVisitPage() {
  const { selectedSummary } = useSelectedSummaryContext();
  const router = useRouter();
  const [scribeOpen, setScribeOpen] = useState(false);

  if (!selectedSummary) {
    return (
      <div className="text-center py-16">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-slate-900 mb-2">No Visit Data Yet</h2>
        <p className="text-sm text-slate-500 mb-6">
          Complete a check-in to get started with your visit.
        </p>
        <Link
          href="/patient/checkin"
          className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white font-medium rounded-xl hover:bg-teal-700 transition-colors"
        >
          <ClipboardCheck className="w-5 h-5" />
          Start Check-in
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
      <div className="rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 p-5 text-white">
        <p className="text-xs font-medium text-teal-100 uppercase tracking-wide mb-1">Diagnosis</p>
        <p className="text-lg font-semibold">{selectedSummary.diagnosis}</p>
        {selectedSummary.diagnosisExplanation && (
          <p className="text-sm text-teal-100 mt-1">{selectedSummary.diagnosisExplanation}</p>
        )}
      </div>

      {/* Visit Overview */}
      <PostVisitOverview summary={selectedSummary} onAskAI={handleAskAI} />

      {/* Scribe section */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <button
          onClick={() => setScribeOpen(!scribeOpen)}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Mic className="w-5 h-5 text-slate-500" />
            <span className="text-sm font-medium text-slate-900">Record & Take Notes</span>
          </div>
          {scribeOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>
        {scribeOpen && (
          <div className="border-t border-slate-200 p-4">
            <CareHubScribe />
          </div>
        )}
      </div>
    </div>
  );
}
