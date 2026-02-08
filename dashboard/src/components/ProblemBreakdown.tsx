'use client';

import {
  Target,
  FileText,
  AlertTriangle,
  CheckCircle,
  Layers,
  ArrowDownRight,
  Database,
  FileOutput,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Problem } from '@/lib/api';

interface ProblemBreakdownProps {
  problems: Problem[];
}

const categoryConfig: Record<
  string,
  {
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    borderColor: string;
    label: string;
  }
> = {
  objective: {
    icon: <Target className="w-5 h-5" />,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-500',
    label: 'Objective',
  },
  input: {
    icon: <Database className="w-5 h-5" />,
    color: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-500',
    label: 'Input Data',
  },
  output: {
    icon: <FileOutput className="w-5 h-5" />,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-500',
    label: 'Output Format',
  },
  constraint: {
    icon: <AlertTriangle className="w-5 h-5" />,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-500',
    label: 'Constraint',
  },
  metric: {
    icon: <CheckCircle className="w-5 h-5" />,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
    borderColor: 'border-cyan-500',
    label: 'Evaluation Metric',
  },
  domain: {
    icon: <Layers className="w-5 h-5" />,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-500',
    label: 'Domain',
  },
};

const defaultConfig = {
  icon: <FileText className="w-5 h-5" />,
  color: 'text-slate-500',
  bgColor: 'bg-slate-50 dark:bg-slate-700/50',
  borderColor: 'border-slate-400',
  label: 'Other',
};

export function ProblemBreakdown({ problems }: ProblemBreakdownProps) {
  // Group problems by category
  const groupedProblems = problems.reduce<Record<string, Problem[]>>((acc, problem) => {
    const category = problem.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(problem);
    return acc;
  }, {});

  // Sort categories by priority
  const categoryOrder = ['objective', 'input', 'output', 'metric', 'constraint', 'domain'];
  const sortedCategories = Object.keys(groupedProblems).sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a);
    const bIndex = categoryOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  if (problems.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Problem Breakdown
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-center py-12">
          No problem components have been extracted yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          Problem Breakdown
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          The problem has been decomposed into {problems.length} components across{' '}
          {sortedCategories.length} categories
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sortedCategories.map((category) => {
            const config = categoryConfig[category] || defaultConfig;
            const categoryProblems = groupedProblems[category].sort(
              (a, b) => b.priority - a.priority
            );

            return (
              <div key={category} className="space-y-3">
                <div
                  className={clsx(
                    'flex items-center gap-2 p-3 rounded-lg',
                    config.bgColor
                  )}
                >
                  <span className={config.color}>{config.icon}</span>
                  <h3 className="font-medium text-slate-900 dark:text-white">
                    {config.label}
                  </h3>
                  <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">
                    {categoryProblems.length}{' '}
                    {categoryProblems.length === 1 ? 'item' : 'items'}
                  </span>
                </div>

                <div className="space-y-2 pl-2">
                  {categoryProblems.map((problem) => (
                    <div
                      key={problem.id}
                      className={clsx(
                        'p-4 bg-white dark:bg-slate-800 rounded-lg border-l-4 shadow-sm',
                        config.borderColor
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <ArrowDownRight className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-slate-900 dark:text-white">
                            {problem.statement}
                          </p>
                          {problem.details && (
                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                              {problem.details}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            <span
                              className={clsx(
                                'px-2 py-0.5 text-xs rounded-full',
                                problem.priority >= 4
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                  : problem.priority >= 2
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-600 dark:text-slate-300'
                              )}
                            >
                              Priority: {problem.priority}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Priority Overview */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Priority Distribution
        </h3>

        <div className="flex items-center gap-4">
          {[5, 4, 3, 2, 1].map((priority) => {
            const count = problems.filter((p) => p.priority === priority).length;
            if (count === 0) return null;

            return (
              <div key={priority} className="flex items-center gap-2">
                <div
                  className={clsx(
                    'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm',
                    priority >= 4
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : priority >= 2
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-600 dark:text-slate-300'
                  )}
                >
                  {priority}
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {count} {count === 1 ? 'item' : 'items'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
