'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Target, CheckCircle, XCircle, Clock, Loader2, Sparkles, TrendingUp } from 'lucide-react';
import { api, Prediction, PredictionAccuracy } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

export function PredictionTracker() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [accuracy, setAccuracy] = useState<PredictionAccuracy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [predData, accData] = await Promise.all([
          api.getPredictions(),
          api.getPredictionAccuracy(),
        ]);
        setPredictions(predData);
        setAccuracy(accData);
      } catch (error) {
        console.error('Failed to fetch predictions:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const calibrationData = accuracy
    ? [
        { name: 'Correct', value: accuracy.correct, color: '#10b981' },
        { name: 'Incorrect', value: accuracy.incorrect, color: '#ef4444' },
        { name: 'Partial', value: accuracy.partial, color: '#f59e0b' },
      ]
    : [];

  const outcomeConfig = {
    pending: { icon: <Clock className="w-4 h-4" />, color: 'bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400' },
    correct: { icon: <CheckCircle className="w-4 h-4" />, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' },
    incorrect: { icon: <XCircle className="w-4 h-4" />, color: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' },
    partial: { icon: <Target className="w-4 h-4" />, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' },
    unknown: { icon: <Clock className="w-4 h-4" />, color: 'bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400' },
  };

  if (loading) {
    return (
      <div className="card overflow-hidden animate-fade-in">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-200 dark:border-surface-700">
          <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-surface-900 dark:text-white">Prediction Tracking</h2>
            <p className="text-xs text-surface-500">Loading predictions...</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            <p className="text-sm text-surface-500">Loading predictions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-surface-900 dark:text-white">Prediction Tracking</h2>
            <p className="text-xs text-surface-500">{predictions.length} predictions tracked</p>
          </div>
        </div>
        {accuracy && accuracy.total > 0 && (
          <div className="text-right">
            <p className="text-2xl font-bold text-surface-900 dark:text-white tabular-nums">
              {(accuracy.accuracy * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-surface-500">Calibration Score</p>
          </div>
        )}
      </div>

      {accuracy && accuracy.total > 0 && (
        <div className="p-5 border-b border-surface-200 dark:border-surface-700 bg-surface-50/50 dark:bg-surface-900/50">
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={calibrationData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {calibrationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-3 text-xs text-surface-500">
            <span>Total: <strong className="text-surface-700 dark:text-surface-300">{accuracy.total}</strong></span>
            <span>Avg Confidence: <strong className="text-surface-700 dark:text-surface-300">{(accuracy.avg_confidence * 100).toFixed(0)}%</strong></span>
          </div>
        </div>
      )}

      <div className="p-4">
        <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Recent Predictions
        </h3>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {predictions.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-14 h-14 mx-auto mb-4 bg-surface-100 dark:bg-surface-800 rounded-2xl flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-surface-400" />
              </div>
              <p className="text-sm font-medium text-surface-500 dark:text-surface-400">
                No predictions yet
              </p>
              <p className="text-xs text-surface-400 mt-1">
                Predictions will appear as the system learns
              </p>
            </div>
          ) : (
            predictions.slice(0, 5).map((prediction, index) => {
              const outcome = prediction.outcome as keyof typeof outcomeConfig;
              const config = outcomeConfig[outcome] || outcomeConfig.pending;

              return (
                <div
                  key={prediction.id}
                  className="p-3 bg-surface-50 dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600 transition-colors animate-fade-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${config.color}`}>
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-surface-900 dark:text-white line-clamp-2 leading-relaxed">
                        {prediction.statement}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 rounded-full font-medium tabular-nums">
                          {(prediction.confidence * 100).toFixed(0)}% confident
                        </span>
                        <span className="text-xs text-surface-500 capitalize">
                          {prediction.timeframe.replace('_', ' ')}
                        </span>
                        {prediction.due_date && (
                          <span className="text-xs text-surface-400">
                            Due {formatDistanceToNow(new Date(prediction.due_date), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
