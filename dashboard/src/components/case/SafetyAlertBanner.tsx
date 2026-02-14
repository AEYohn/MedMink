'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface SafetyAlertBannerProps {
  count: number;
  onReview: () => void;
}

export function SafetyAlertBanner({ count, onReview }: SafetyAlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (count <= 0 || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-sm">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
        <span className="text-destructive font-medium">
          {count} unacknowledged safety alert{count !== 1 ? 's' : ''}
        </span>
        <button
          onClick={onReview}
          className="text-destructive underline underline-offset-2 hover:text-destructive/80 font-medium text-sm"
        >
          Review
        </button>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-destructive/60 hover:text-destructive transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
