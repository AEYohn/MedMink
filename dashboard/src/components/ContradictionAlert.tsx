'use client';

import { AlertTriangle, ArrowLeftRight, Lightbulb } from 'lucide-react';

interface Contradiction {
  topic: string;
  position_a: string;
  position_b: string;
  possible_explanation: string;
  clinical_significance: 'high' | 'moderate' | 'low';
}

interface ContradictionAlertProps {
  contradictions: Contradiction[];
}

const significanceConfig = {
  high: {
    bgClass: 'bg-red-50 dark:bg-red-900/10',
    borderClass: 'border-red-200 dark:border-red-800/50',
    iconBgClass: 'bg-red-100 dark:bg-red-900/40',
    iconClass: 'text-red-600 dark:text-red-400',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    label: 'High Impact',
  },
  moderate: {
    bgClass: 'bg-amber-50 dark:bg-amber-900/10',
    borderClass: 'border-amber-200 dark:border-amber-800/50',
    iconBgClass: 'bg-amber-100 dark:bg-amber-900/40',
    iconClass: 'text-amber-600 dark:text-amber-400',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    label: 'Moderate Impact',
  },
  low: {
    bgClass: 'bg-surface-50 dark:bg-surface-800/50',
    borderClass: 'border-surface-200 dark:border-surface-700',
    iconBgClass: 'bg-surface-100 dark:bg-surface-800',
    iconClass: 'text-surface-600 dark:text-surface-400',
    badgeClass: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400',
    label: 'Low Impact',
  },
};

export function ContradictionAlert({ contradictions }: ContradictionAlertProps) {
  if (!contradictions || contradictions.length === 0) {
    return null;
  }

  return (
    <div className="card overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-200 dark:border-surface-700 bg-amber-50 dark:bg-amber-900/10">
        <div className="p-2 bg-gradient-to-br from-amber-500 to-red-500 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold text-surface-900 dark:text-white">
            Conflicting Evidence Detected
          </h2>
          <p className="text-xs text-surface-500">
            {contradictions.length} contradiction{contradictions.length !== 1 ? 's' : ''} found in the literature
          </p>
        </div>
      </div>

      {/* Contradictions List */}
      <div className="p-4 space-y-4">
        {contradictions.map((contradiction, index) => {
          const config = significanceConfig[contradiction.clinical_significance] || significanceConfig.low;

          return (
            <div
              key={index}
              className={`p-4 ${config.bgClass} border ${config.borderClass} rounded-xl animate-fade-in-up`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Topic Header */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-surface-900 dark:text-white">{contradiction.topic}</h3>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${config.badgeClass}`}>
                  {config.label}
                </span>
              </div>

              {/* Positions */}
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                {/* Position A */}
                <div className="p-3 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                      Position A
                    </span>
                  </div>
                  <p className="text-sm text-surface-700 dark:text-surface-300">
                    {contradiction.position_a}
                  </p>
                </div>

                {/* VS Indicator (visible on larger screens) */}
                <div className="hidden md:flex items-center justify-center absolute left-1/2 transform -translate-x-1/2" style={{ position: 'relative', width: 0 }}>
                  <div className="p-2 bg-white dark:bg-surface-800 rounded-full border-2 border-surface-200 dark:border-surface-600 shadow-sm">
                    <ArrowLeftRight className="w-4 h-4 text-surface-400" />
                  </div>
                </div>

                {/* Position B */}
                <div className="p-3 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded">
                      Position B
                    </span>
                  </div>
                  <p className="text-sm text-surface-700 dark:text-surface-300">
                    {contradiction.position_b}
                  </p>
                </div>
              </div>

              {/* VS Indicator (visible on mobile) */}
              <div className="flex md:hidden items-center justify-center -my-2 py-2">
                <div className="flex items-center gap-2 text-xs text-surface-400">
                  <div className="w-8 h-px bg-surface-300 dark:bg-surface-600" />
                  <span className="font-semibold">VS</span>
                  <div className="w-8 h-px bg-surface-300 dark:bg-surface-600" />
                </div>
              </div>

              {/* Explanation */}
              <div className="flex items-start gap-3 p-3 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
                <div className={`p-1.5 ${config.iconBgClass} rounded-lg flex-shrink-0`}>
                  <Lightbulb className={`w-4 h-4 ${config.iconClass}`} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide mb-1">
                    Possible Explanation
                  </h4>
                  <p className="text-sm text-surface-700 dark:text-surface-300">
                    {contradiction.possible_explanation}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Note */}
      <div className="px-5 py-3 bg-surface-50 dark:bg-surface-800/50 border-t border-surface-200 dark:border-surface-700">
        <p className="text-xs text-surface-500 dark:text-surface-400">
          <strong className="text-surface-600 dark:text-surface-300">Clinical Note:</strong>{' '}
          Conflicting evidence is common in medical literature. Consider patient-specific factors when applying these findings.
        </p>
      </div>
    </div>
  );
}
