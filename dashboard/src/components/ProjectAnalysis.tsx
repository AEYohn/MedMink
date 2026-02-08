'use client';

import {
  Target,
  Lightbulb,
  FileText,
  BookOpen,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Project, Problem, Approach, ProjectPaper, ProjectSynthesis } from '@/lib/api';

interface ProjectAnalysisProps {
  project: Project;
  problems: Problem[];
  approaches: Approach[];
  papers: ProjectPaper[];
  synthesis: ProjectSynthesis | null;
}

export function ProjectAnalysis({
  project,
  problems,
  approaches,
  papers,
  synthesis,
}: ProjectAnalysisProps) {
  // Get top approaches sorted by priority
  const topApproaches = [...approaches].sort((a, b) => b.priority - a.priority).slice(0, 3);

  // Get top problems
  const topProblems = [...problems].sort((a, b) => b.priority - a.priority).slice(0, 4);

  // Get top papers
  const topPapers = [...papers].sort((a, b) => b.relevance - a.relevance).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Target className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {problems.length}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Problems</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Lightbulb className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {approaches.length}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Approaches</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <BookOpen className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {papers.length}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Papers</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <TrendingUp className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {synthesis?.key_techniques.length || 0}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Techniques</p>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {project.description && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
            Problem Summary
          </h2>
          <p className="text-slate-600 dark:text-slate-400">{project.description}</p>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recommended Approaches */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-green-500" />
            Recommended Approaches
          </h2>

          {topApproaches.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-center py-8">
              No approaches generated yet
            </p>
          ) : (
            <div className="space-y-4">
              {topApproaches.map((approach, index) => (
                <div
                  key={approach.id}
                  className={clsx(
                    'p-4 rounded-lg border-l-4',
                    index === 0
                      ? 'border-l-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-l-slate-300 dark:border-l-slate-600 bg-slate-50 dark:bg-slate-700/50'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-slate-900 dark:text-white">
                      {index === 0 && (
                        <span className="mr-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                          TOP PICK
                        </span>
                      )}
                      {approach.name}
                    </h3>
                    <span className="text-sm font-medium text-primary-500">
                      {(approach.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    {approach.description}
                  </p>

                  {approach.reasoning && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                      <strong>Reasoning:</strong> {approach.reasoning}
                    </div>
                  )}

                  {approach.challenges.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {approach.challenges.slice(0, 3).map((challenge, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full"
                        >
                          {challenge}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Key Problems */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-500" />
            Key Problem Components
          </h2>

          {topProblems.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-center py-8">
              No problems extracted yet
            </p>
          ) : (
            <div className="space-y-3">
              {topProblems.map((problem) => (
                <div
                  key={problem.id}
                  className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 capitalize">
                      {problem.category}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Priority: {problem.priority}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {problem.statement}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Papers */}
      {topPapers.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-500" />
            Most Relevant Papers
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topPapers.map((paper) => (
              <a
                key={paper.id}
                href={`https://arxiv.org/abs/${paper.arxiv_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-primary-500">
                    {(paper.relevance * 100).toFixed(0)}%
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-primary-500 transition-colors" />
                </div>
                <h3 className="text-sm font-medium text-slate-900 dark:text-white line-clamp-2 mb-1">
                  {paper.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  arXiv:{paper.arxiv_id}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Key Techniques */}
      {synthesis?.key_techniques && synthesis.key_techniques.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Key Techniques to Consider
          </h2>
          <div className="flex flex-wrap gap-2">
            {synthesis.key_techniques.map((technique, i) => (
              <span
                key={i}
                className="px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg text-sm font-medium"
              >
                {technique}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
