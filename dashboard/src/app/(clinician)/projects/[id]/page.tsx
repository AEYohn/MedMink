'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  FileText,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  Target,
  Layers,
  BookOpen,
} from 'lucide-react';
import { clsx } from 'clsx';
import { api, ProjectDetail, ProjectGraph } from '@/lib/api';
import { ProblemBreakdown } from '@/components/ProblemBreakdown';
import { SolutionGraph } from '@/components/SolutionGraph';
import { ProjectAnalysis } from '@/components/ProjectAnalysis';

const categoryIcons = {
  objective: <Target className="w-4 h-4" />,
  input: <FileText className="w-4 h-4" />,
  output: <FileText className="w-4 h-4" />,
  constraint: <AlertTriangle className="w-4 h-4" />,
  metric: <CheckCircle className="w-4 h-4" />,
  domain: <Layers className="w-4 h-4" />,
};

const categoryColors = {
  objective: 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/20',
  input: 'border-l-green-500 bg-green-50 dark:bg-green-900/20',
  output: 'border-l-purple-500 bg-purple-50 dark:bg-purple-900/20',
  constraint: 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/20',
  metric: 'border-l-cyan-500 bg-cyan-50 dark:bg-cyan-900/20',
  domain: 'border-l-amber-500 bg-amber-50 dark:bg-amber-900/20',
};

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [projectGraph, setProjectGraph] = useState<ProjectGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'problems' | 'papers' | 'graph'>(
    'overview'
  );

  useEffect(() => {
    async function fetchData() {
      try {
        const [detail, graph] = await Promise.all([
          api.getProject(projectId),
          api.getProjectGraph(projectId),
        ]);
        setProjectDetail(detail);
        setProjectGraph(graph);
      } catch (error) {
        console.error('Failed to fetch project:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [projectId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary-500 mx-auto" />
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!projectDetail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">Project not found</p>
          <Link href="/projects" className="text-primary-500 hover:underline mt-4 inline-block">
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  const { project, problems, approaches, papers, synthesis } = projectDetail;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link
                href="/projects"
                className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                  {project.name}
                </h1>
                <a
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-primary-500"
                >
                  <ExternalLink className="w-3 h-3" />
                  {project.source}
                </a>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  'px-3 py-1 rounded-full text-sm font-medium',
                  project.status === 'completed'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : project.status === 'analyzing'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                )}
              >
                {project.status}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-4">
            {(['overview', 'problems', 'papers', 'graph'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab
                    ? 'border-primary-500 text-primary-500'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <ProjectAnalysis
            project={project}
            problems={problems}
            approaches={approaches}
            papers={papers}
            synthesis={synthesis}
          />
        )}

        {activeTab === 'problems' && (
          <ProblemBreakdown problems={problems} />
        )}

        {activeTab === 'papers' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Relevant Papers ({papers.length})
            </h2>

            {papers.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-center py-8">
                No relevant papers found
              </p>
            ) : (
              <div className="space-y-4">
                {papers.map((paper) => (
                  <div
                    key={paper.id}
                    className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <BookOpen className="w-4 h-4 text-slate-400" />
                          <h3 className="font-medium text-slate-900 dark:text-white">
                            {paper.title}
                          </h3>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                          {paper.abstract}
                        </p>
                        {paper.explanation && (
                          <p className="text-sm text-primary-600 dark:text-primary-400">
                            <strong>Relevance:</strong> {paper.explanation}
                          </p>
                        )}
                        <div className="mt-2">
                          <a
                            href={`https://arxiv.org/abs/${paper.arxiv_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-slate-500 hover:text-primary-500 flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            arXiv:{paper.arxiv_id}
                          </a>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary-500">
                          {(paper.relevance * 100).toFixed(0)}%
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          relevance
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'graph' && projectGraph && (
          <SolutionGraph graph={projectGraph} />
        )}
      </main>
    </div>
  );
}
