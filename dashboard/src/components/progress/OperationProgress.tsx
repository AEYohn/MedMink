'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle,
  XCircle,
  X,
  Search,
  Beaker,
  TrendingUp,
  MessageCircle,
  Wifi,
  WifiOff,
  Activity,
  Zap,
} from 'lucide-react';
import { useProgress, Operation } from '@/contexts/ProgressContext';

export function OperationProgress() {
  const { operations, isConnected, removeOperation, clearCompleted } = useProgress();
  const [isExpanded, setIsExpanded] = useState(true);

  const activeOperations = operations.filter(op => op.status === 'running' || op.status === 'pending');
  const completedOperations = operations.filter(op => op.status === 'completed' || op.status === 'failed');

  if (operations.length === 0) {
    return null;
  }

  return (
    <div className="card overflow-hidden animate-fade-in">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-gradient-to-br from-brand-500 to-accent-500 rounded-lg">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-surface-900 dark:text-white">
            Operations
          </span>
          {activeOperations.length > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 rounded-full text-xs font-medium">
              <Loader2 className="w-3 h-3 animate-spin" />
              {activeOperations.length} running
            </span>
          )}
          {completedOperations.length > 0 && (
            <span className="badge badge-neutral">
              {completedOperations.length} completed
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Connection status */}
          <span
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
              isConnected
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400'
            }`}
            title={isConnected ? 'Real-time updates active' : 'Reconnecting...'}
          >
            {isConnected ? (
              <>
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full status-pulse" />
                <Wifi className="w-3 h-3" />
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                <span>Offline</span>
              </>
            )}
          </span>
          <div className={`p-1 rounded-lg transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            <ChevronDown className="w-4 h-4 text-surface-400" />
          </div>
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-surface-200 dark:border-surface-700 animate-fade-in">
          {/* Active Operations */}
          {activeOperations.length > 0 && (
            <div className="p-4 space-y-3">
              {activeOperations.map((op, index) => (
                <div
                  key={op.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <OperationItem operation={op} onRemove={removeOperation} />
                </div>
              ))}
            </div>
          )}

          {/* Completed Operations */}
          {completedOperations.length > 0 && (
            <div className="border-t border-surface-200 dark:border-surface-700 p-4 space-y-3 bg-surface-50/50 dark:bg-surface-900/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-surface-500 dark:text-surface-400">
                  Recent completions
                </span>
                <button
                  onClick={clearCompleted}
                  className="text-xs text-surface-400 hover:text-red-500 transition-colors"
                >
                  Clear all
                </button>
              </div>
              {completedOperations.slice(0, 3).map((op, index) => (
                <div
                  key={op.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <OperationItem operation={op} onRemove={removeOperation} compact />
                </div>
              ))}
            </div>
          )}

          {operations.length === 0 && (
            <div className="p-8 text-center">
              <Zap className="w-8 h-8 mx-auto text-surface-300 dark:text-surface-600 mb-2" />
              <p className="text-sm text-surface-500 dark:text-surface-400">
                No active operations
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface OperationItemProps {
  operation: Operation;
  onRemove: (id: string) => void;
  compact?: boolean;
}

function OperationItem({ operation, onRemove, compact }: OperationItemProps) {
  const getIconConfig = () => {
    switch (operation.type) {
      case 'ingest':
        return { icon: Search, color: 'blue' };
      case 'analyze':
        return { icon: Beaker, color: 'purple' };
      case 'synthesize':
        return { icon: TrendingUp, color: 'cyan' };
      case 'search':
        return { icon: Search, color: 'amber' };
      case 'chat':
        return { icon: MessageCircle, color: 'emerald' };
      default:
        return { icon: Loader2, color: 'surface' };
    }
  };

  const { icon: Icon, color } = getIconConfig();

  const getIconBgClass = () => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
      purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400',
      cyan: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400',
      amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
      emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
      surface: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400',
    };
    return colorMap[color] || colorMap.surface;
  };

  const getStatusIcon = () => {
    switch (operation.status) {
      case 'running':
      case 'pending':
        return <Loader2 className="w-4 h-4 animate-spin text-brand-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getTypeLabel = () => {
    switch (operation.type) {
      case 'ingest':
        return 'Paper Ingestion';
      case 'analyze':
        return 'Insight Extraction';
      case 'synthesize':
        return 'Pattern Discovery';
      case 'search':
        return 'Search';
      case 'chat':
        return 'Chat Query';
      default:
        return 'Operation';
    }
  };

  const getProgressBarColor = () => {
    const colorMap: Record<string, string> = {
      blue: 'from-blue-500 to-blue-400',
      purple: 'from-purple-500 to-purple-400',
      cyan: 'from-cyan-500 to-cyan-400',
      amber: 'from-amber-500 to-amber-400',
      emerald: 'from-emerald-500 to-emerald-400',
      surface: 'from-brand-500 to-brand-400',
    };
    return colorMap[color] || colorMap.surface;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors group">
        {getStatusIcon()}
        <span className="flex-1 text-sm text-surface-600 dark:text-surface-400 truncate">
          {operation.step}
        </span>
        <button
          onClick={() => onRemove(operation.id)}
          className="p-1 text-surface-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 space-y-3 hover:border-surface-300 dark:hover:border-surface-600 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`flex items-center justify-center w-8 h-8 rounded-lg ${getIconBgClass()}`}>
            <Icon className="w-4 h-4" />
          </span>
          <div>
            <span className="text-sm font-medium text-surface-900 dark:text-white">
              {getTypeLabel()}
            </span>
            {operation.status === 'running' && (
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                {operation.step}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          {(operation.status === 'completed' || operation.status === 'failed') && (
            <button
              onClick={() => onRemove(operation.id)}
              className="p-1.5 text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {(operation.status === 'running' || operation.status === 'pending') && (
        <div className="space-y-2">
          <div className="w-full h-2 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${getProgressBarColor()} rounded-full transition-all duration-500 ease-out`}
              style={{ width: `${operation.progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-surface-500 dark:text-surface-400 truncate max-w-[80%]">
              {operation.step}
            </span>
            <span className="text-surface-600 dark:text-surface-300 font-medium tabular-nums">
              {operation.progress}%
            </span>
          </div>
        </div>
      )}

      {/* Error message */}
      {operation.status === 'failed' && operation.error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">
            {operation.error}
          </p>
        </div>
      )}

      {/* Completion message */}
      {operation.status === 'completed' && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            {operation.step}
          </p>
        </div>
      )}
    </div>
  );
}
