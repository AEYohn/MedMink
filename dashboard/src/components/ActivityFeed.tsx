'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  FileText,
  Brain,
  AlertTriangle,
  TrendingUp,
  Target,
  XCircle,
  Loader2,
  Activity,
  Zap,
} from 'lucide-react';
import { api, ThoughtSignature } from '@/lib/api';

interface ActivityItem {
  id: string;
  type: 'ingest' | 'analyze' | 'contradiction' | 'trend' | 'prediction' | 'error';
  agent: string;
  message: string;
  confidence?: number;
  timestamp: string;
}

const activityIcons = {
  ingest: <FileText className="w-4 h-4" />,
  analyze: <Brain className="w-4 h-4" />,
  contradiction: <AlertTriangle className="w-4 h-4" />,
  trend: <TrendingUp className="w-4 h-4" />,
  prediction: <Target className="w-4 h-4" />,
  error: <XCircle className="w-4 h-4" />,
};

const activityColors = {
  ingest: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  analyze: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400',
  contradiction: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  trend: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  prediction: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400',
  error: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
};

function thoughtToActivity(thought: ThoughtSignature): ActivityItem {
  let type: ActivityItem['type'] = 'analyze';
  if (thought.agent_name === 'ingest') type = 'ingest';
  else if (thought.agent_name === 'synthesize') type = 'trend';
  else if (thought.agent_name === 'correct') type = 'error';

  return {
    id: thought.id,
    type,
    agent: thought.agent_name,
    message: thought.decision_made,
    confidence: thought.confidence,
    timestamp: thought.created_at || new Date().toISOString(),
  };
}

export function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivities() {
      try {
        const thoughts = await api.getThoughts(20);
        setActivities(thoughts.map(thoughtToActivity));
      } catch (error) {
        console.error('Failed to fetch activities:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchActivities();

    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="card overflow-hidden animate-fade-in">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-200 dark:border-surface-700">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-surface-900 dark:text-white">Agent Activity</h2>
            <p className="text-xs text-surface-500">Real-time agent decisions</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            <p className="text-sm text-surface-500">Loading activity...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-surface-900 dark:text-white">Agent Activity</h2>
            <p className="text-xs text-surface-500">{activities.length} recent decisions</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full status-pulse" />
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Live</span>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {activities.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-surface-100 dark:bg-surface-800 rounded-2xl flex items-center justify-center">
              <Zap className="w-8 h-8 text-surface-400" />
            </div>
            <p className="text-sm font-medium text-surface-500 dark:text-surface-400">
              No recent activity
            </p>
            <p className="text-xs text-surface-400 mt-1">
              Agent decisions will appear here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {activities.map((activity, index) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-4 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors animate-fade-in"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div
                  className={`flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0 ${activityColors[activity.type]}`}
                >
                  {activityIcons[activity.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-900 dark:text-white leading-relaxed">
                    <span className="font-semibold capitalize text-surface-700 dark:text-surface-300">
                      {activity.agent}
                    </span>
                    {' '}
                    <span className="text-surface-600 dark:text-surface-400">
                      {activity.message.slice(0, 100)}
                      {activity.message.length > 100 && '...'}
                    </span>
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <p className="text-xs text-surface-400">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </p>
                    {activity.confidence !== undefined && (
                      <span className="text-xs px-2 py-0.5 bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 rounded-full font-medium">
                        {(activity.confidence * 100).toFixed(0)}% confident
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
