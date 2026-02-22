'use client';

import { useSelectedSummaryContext } from '@/contexts/SelectedSummaryContext';

export function VisitPicker() {
  const { allSummaries, selectedId, setSelectedId } = useSelectedSummaryContext();

  if (allSummaries.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
      {allSummaries.map(s => {
        const date = new Date(s.visitDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        const isSelected = s.id === selectedId;
        return (
          <button
            key={s.id}
            onClick={() => setSelectedId(s.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
              isSelected
                ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {s.diagnosis.length > 20 ? s.diagnosis.slice(0, 20) + '...' : s.diagnosis} &middot; {date}
          </button>
        );
      })}
    </div>
  );
}
