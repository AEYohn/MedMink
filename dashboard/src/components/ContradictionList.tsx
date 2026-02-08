'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, ExternalLink, Shield, ChevronRight, Zap } from 'lucide-react';
import { api, Contradiction } from '@/lib/api';

export function ContradictionList() {
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContradictions() {
      try {
        const data = await api.getContradictions(10);
        setContradictions(data);
      } catch (error) {
        console.error('Failed to fetch contradictions:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchContradictions();
  }, []);

  if (loading) {
    return (
      <div className="card overflow-hidden animate-fade-in">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-200 dark:border-surface-700">
          <div className="p-2 bg-gradient-to-br from-amber-500 to-red-500 rounded-xl">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-surface-900 dark:text-white">Detected Contradictions</h2>
            <p className="text-xs text-surface-500">Analyzing conflicting claims...</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            <p className="text-sm text-surface-500">Loading contradictions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-amber-500 to-red-500 rounded-xl">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-surface-900 dark:text-white">Detected Contradictions</h2>
            <p className="text-xs text-surface-500">{contradictions.length} conflicts found</p>
          </div>
        </div>
        {contradictions.length > 0 && (
          <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Needs Review
          </span>
        )}
      </div>

      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {contradictions.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center">
              <Zap className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-surface-500 dark:text-surface-400">
              No contradictions detected
            </p>
            <p className="text-xs text-surface-400 mt-1">
              Your research is consistent so far
            </p>
          </div>
        ) : (
          contradictions.map((contradiction, index) => (
            <div
              key={index}
              className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-xl hover:border-amber-300 dark:hover:border-amber-700 transition-all animate-fade-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  {/* Claim 1 */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2 py-0.5 text-xs font-semibold bg-amber-200 dark:bg-amber-800/50 text-amber-800 dark:text-amber-300 rounded-md">
                        Claim 1
                      </span>
                      <span className="text-xs text-surface-400">
                        {contradiction.claim1.category}
                      </span>
                    </div>
                    <p className="text-sm text-surface-900 dark:text-white leading-relaxed">
                      {contradiction.claim1.statement}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-surface-500">Confidence:</span>
                      <div className="w-16 h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${contradiction.claim1.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-surface-600 dark:text-surface-400 tabular-nums">
                        {(contradiction.claim1.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* VS Divider */}
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-amber-200 dark:bg-amber-800/50" />
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">VS</span>
                    <div className="flex-1 h-px bg-amber-200 dark:bg-amber-800/50" />
                  </div>

                  {/* Claim 2 */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2 py-0.5 text-xs font-semibold bg-amber-200 dark:bg-amber-800/50 text-amber-800 dark:text-amber-300 rounded-md">
                        Claim 2
                      </span>
                      <span className="text-xs text-surface-400">
                        {contradiction.claim2.category}
                      </span>
                    </div>
                    <p className="text-sm text-surface-900 dark:text-white leading-relaxed">
                      {contradiction.claim2.statement}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-surface-500">Confidence:</span>
                      <div className="w-16 h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${contradiction.claim2.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-surface-600 dark:text-surface-400 tabular-nums">
                        {(contradiction.claim2.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Analysis */}
                  <div className="pt-3 border-t border-amber-200 dark:border-amber-800/50">
                    <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">
                      <span className="font-semibold text-surface-900 dark:text-white">Analysis:</span>{' '}
                      {contradiction.explanation}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-surface-500">Conflict Strength:</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          contradiction.strength > 0.7
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                            : contradiction.strength > 0.4
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                            : 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400'
                        }`}>
                          {(contradiction.strength * 100).toFixed(0)}%
                        </span>
                      </div>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors">
                        Review
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
