'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  Brain,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { api, ThoughtSignature } from '@/lib/api';

interface ActivityItem {
  id: string;
  type: 'search' | 'analyze' | 'synthesize' | 'error';
  status: 'success' | 'error' | 'in_progress';
  message: string;
  timestamp: string;
}

const activityIcons = {
  search: Search,
  analyze: Brain,
  synthesize: Sparkles,
  error: AlertTriangle,
};

const statusIcons = {
  success: CheckCircle,
  error: XCircle,
  in_progress: Loader2,
};

const statusColors = {
  success: 'text-green-500',
  error: 'text-red-500',
  in_progress: 'text-blue-500',
};

function thoughtToActivity(thought: ThoughtSignature): ActivityItem {
  let type: ActivityItem['type'] = 'analyze';
  if (thought.agent_name === 'ingest') type = 'search';
  else if (thought.agent_name === 'synthesize') type = 'synthesize';
  else if (thought.agent_name === 'correct') type = 'error';

  // Make messages more human-readable
  let message = thought.decision_made;
  if (message.length > 80) {
    message = message.slice(0, 77) + '...';
  }

  return {
    id: thought.id,
    type,
    status: 'success',
    message,
    timestamp: thought.created_at || new Date().toISOString(),
  };
}

interface ActivityLogProps {
  refreshTrigger?: number;
}

export function ActivityLog({ refreshTrigger }: ActivityLogProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    try {
      const thoughts = await api.getThoughts(10);
      setActivities(thoughts.map(thoughtToActivity));
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();

    // Refresh every 10 seconds
    const interval = setInterval(fetchActivities, 10000);
    return () => clearInterval(interval);
  }, [fetchActivities]);

  // Refresh when trigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchActivities();
    }
  }, [refreshTrigger, fetchActivities]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Recent Activity
        </h2>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        Recent Activity
      </h2>

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {activities.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No activity yet. Search for papers to get started!
            </p>
          </div>
        ) : (
          activities.map((activity) => {
            const TypeIcon = activityIcons[activity.type];
            const StatusIcon = statusIcons[activity.status];

            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg"
              >
                <div className="flex-shrink-0 p-1.5 bg-white dark:bg-slate-800 rounded">
                  <TypeIcon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusIcon
                      className={`w-4 h-4 ${statusColors[activity.status]} ${
                        activity.status === 'in_progress' ? 'animate-spin' : ''
                      }`}
                    />
                    <span className="text-sm text-slate-900 dark:text-white">
                      {activity.message}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {formatDistanceToNow(new Date(activity.timestamp), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
