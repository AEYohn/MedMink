'use client';

import { FileText, Lightbulb, Beaker, ArrowRight, Loader2, TrendingUp, Network } from 'lucide-react';
import Link from 'next/link';

interface ProgressPanelProps {
  papers: number;
  claims: number;
  methods: number;
  trends: number;
  onAnalyze: () => Promise<void>;
  onSynthesize: () => Promise<void>;
  isSearching: boolean;
  isAnalyzing: boolean;
  isSynthesizing: boolean;
}

type WorkflowState = 'empty' | 'has-papers' | 'has-claims' | 'complete';

function getWorkflowState(papers: number, claims: number, trends: number): WorkflowState {
  if (papers === 0) return 'empty';
  if (claims === 0) return 'has-papers';
  if (trends === 0) return 'has-claims';
  return 'complete';
}

function getNextStepInfo(state: WorkflowState): { label: string; description: string } {
  switch (state) {
    case 'empty':
      return {
        label: 'Search for papers to get started',
        description: 'Enter a research topic above to begin',
      };
    case 'has-papers':
      return {
        label: 'Extract Insights',
        description: 'Analyze your papers to extract claims and methods',
      };
    case 'has-claims':
      return {
        label: 'Find Patterns',
        description: 'Synthesize findings to discover trends and contradictions',
      };
    case 'complete':
      return {
        label: 'View Knowledge Graph',
        description: 'Explore your synthesized research knowledge',
      };
  }
}

export function ProgressPanel({
  papers,
  claims,
  methods,
  trends,
  onAnalyze,
  onSynthesize,
  isSearching,
  isAnalyzing,
  isSynthesizing,
}: ProgressPanelProps) {
  const state = getWorkflowState(papers, claims, trends);
  const nextStep = getNextStepInfo(state);
  const isProcessing = isSearching || isAnalyzing || isSynthesizing;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Current Progress
        </h2>
        <Link
          href="/projects"
          className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
        >
          View Details
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
          <div className="flex items-center justify-center mb-2">
            <FileText className="w-6 h-6 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {papers}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Papers</div>
        </div>

        <div className="text-center p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
          <div className="flex items-center justify-center mb-2">
            <Lightbulb className="w-6 h-6 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {claims}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Claims</div>
        </div>

        <div className="text-center p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
          <div className="flex items-center justify-center mb-2">
            <Beaker className="w-6 h-6 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {methods}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Methods</div>
        </div>
      </div>

      {/* Next Step */}
      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
        {isSearching ? (
          <div className="flex items-center justify-center gap-3 py-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Searching for papers...
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Fetching from arXiv and processing results
              </p>
            </div>
          </div>
        ) : state === 'empty' ? (
          <div className="text-center py-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {nextStep.description}
            </p>
          </div>
        ) : isAnalyzing ? (
          <div className="flex items-center justify-center gap-3 py-3">
            <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Analyzing papers...
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Extracting claims, methods, and key findings
              </p>
            </div>
          </div>
        ) : isSynthesizing ? (
          <div className="flex items-center justify-center gap-3 py-3">
            <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Synthesizing knowledge...
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Finding trends, contradictions, and patterns
              </p>
            </div>
          </div>
        ) : state === 'has-papers' ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Next step:
              </p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {nextStep.description}
              </p>
            </div>
            <button
              onClick={onAnalyze}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white font-medium rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Lightbulb className="w-4 h-4" />
              {nextStep.label}
            </button>
          </div>
        ) : state === 'has-claims' ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Next step:
              </p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {nextStep.description}
              </p>
            </div>
            <button
              onClick={onSynthesize}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              {nextStep.label}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Synthesis complete!
              </p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {trends} trends discovered
              </p>
            </div>
            <Link
              href="/projects"
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-600 transition-colors"
            >
              <Network className="w-4 h-4" />
              {nextStep.label}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
