'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Loader2, Sparkles, Flame } from 'lucide-react';
import { api, Trend } from '@/lib/api';

const directionIcons = {
  rising: <TrendingUp className="w-4 h-4 text-emerald-500" />,
  stable: <Minus className="w-4 h-4 text-surface-400" />,
  declining: <TrendingDown className="w-4 h-4 text-red-500" />,
};

const directionColors = {
  rising: {
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  },
  stable: {
    border: 'border-l-surface-400',
    bg: 'bg-surface-50 dark:bg-surface-800/50',
    badge: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400',
  },
  declining: {
    border: 'border-l-red-500',
    bg: 'bg-red-50 dark:bg-red-900/20',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  },
};

const directionLabels = {
  rising: 'Trending Up',
  stable: 'Stable',
  declining: 'Declining',
};

export function TrendPanel() {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTrends() {
      try {
        const data = await api.getTrends(10);
        setTrends(data);
      } catch (error) {
        console.error('Failed to fetch trends:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTrends();
  }, []);

  if (loading) {
    return (
      <div className="card overflow-hidden animate-fade-in">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-200 dark:border-surface-700">
          <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-surface-900 dark:text-white">Research Trends</h2>
            <p className="text-xs text-surface-500">Emerging patterns in research</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            <p className="text-sm text-surface-500">Loading trends...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-surface-900 dark:text-white">Research Trends</h2>
            <p className="text-xs text-surface-500">{trends.length} trends identified</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
        {trends.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-surface-100 dark:bg-surface-800 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-surface-400" />
            </div>
            <p className="text-sm font-medium text-surface-500 dark:text-surface-400">
              No trends identified yet
            </p>
            <p className="text-xs text-surface-400 mt-1">
              Trends will appear as more papers are analyzed
            </p>
          </div>
        ) : (
          trends.map((trend, index) => {
            const direction = trend.direction as keyof typeof directionColors;
            const colors = directionColors[direction] || directionColors.stable;

            return (
              <div
                key={trend.id}
                className={`p-4 rounded-xl border-l-4 ${colors.border} ${colors.bg} border border-surface-200 dark:border-surface-700 hover:shadow-md transition-all animate-fade-in-up group`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-semibold text-surface-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {trend.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${colors.badge}`}>
                      {directionIcons[direction]}
                      {directionLabels[direction] || 'Unknown'}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-surface-600 dark:text-surface-400 line-clamp-2 leading-relaxed">
                  {trend.description}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-surface-500">Confidence</span>
                      <span className="text-xs font-semibold text-surface-700 dark:text-surface-300 tabular-nums">
                        {(trend.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all"
                        style={{ width: `${trend.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-surface-500">Velocity</span>
                    <p className="text-sm font-bold text-surface-900 dark:text-white tabular-nums">
                      {trend.velocity.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
