'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  Plus,
  Loader2,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Trash2,
  ArrowLeft,
  Brain,
} from 'lucide-react';
import { clsx } from 'clsx';
import { api, Project, ProjectTaskResponse } from '@/lib/api';

const statusConfig = {
  pending: {
    icon: <Clock className="w-4 h-4" />,
    color: 'text-yellow-500',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    label: 'Pending',
  },
  analyzing: {
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    color: 'text-blue-500',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    label: 'Analyzing',
  },
  completed: {
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'text-green-500',
    bg: 'bg-green-100 dark:bg-green-900/30',
    label: 'Completed',
  },
  failed: {
    icon: <XCircle className="w-4 h-4" />,
    color: 'text-red-500',
    bg: 'bg-red-100 dark:bg-red-900/30',
    label: 'Failed',
  },
};

const sourceLabels = {
  kaggle: 'Kaggle',
  github: 'GitHub',
  custom: 'Custom',
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();

    // Refresh every 10 seconds to check for status updates
    const interval = setInterval(fetchProjects, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!url.trim()) {
      setError('Please enter a project URL');
      return;
    }

    setSubmitting(true);

    try {
      const result = await api.submitProject(url, name || undefined);
      setSuccessMessage(`Project submitted for analysis. Task ID: ${result.id}`);
      setUrl('');
      setName('');
      fetchProjects();
    } catch (err: any) {
      setError(err.message || 'Failed to submit project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project?')) {
      return;
    }

    try {
      await api.deleteProject(projectId);
      fetchProjects();
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const handleReanalyze = async (projectId: string) => {
    try {
      await api.reanalyzeProject(projectId);
      fetchProjects();
    } catch (err) {
      console.error('Failed to reanalyze project:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <FolderKanban className="w-8 h-8 text-primary-500" />
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Project Analysis
              </h1>
            </div>
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <Brain className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Submit Form */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Analyze New Project
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="url"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Project URL
              </label>
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.kaggle.com/competitions/example or https://github.com/user/repo"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Project Name (optional)
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Leave empty to auto-detect from URL"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm">
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {submitting ? 'Submitting...' : 'Analyze Project'}
            </button>
          </form>
        </div>

        {/* Projects List */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Analyzed Projects
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <FolderKanban className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400">
                No projects analyzed yet. Submit a URL above to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {projects.map((project) => {
                const status = statusConfig[project.status as keyof typeof statusConfig] ||
                  statusConfig.pending;

                return (
                  <div
                    key={project.id}
                    className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/projects/${project.id}`}
                            className="font-medium text-slate-900 dark:text-white hover:text-primary-500 truncate"
                          >
                            {project.name}
                          </Link>
                          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">
                            {sourceLabels[project.source as keyof typeof sourceLabels] ||
                              project.source}
                          </span>
                        </div>

                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                          {project.description || 'No description available'}
                        </p>

                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                          <a
                            href={project.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-primary-500"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View Source
                          </a>
                          {project.created_at && (
                            <span>
                              {new Date(project.created_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={clsx(
                            'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                            status.bg,
                            status.color
                          )}
                        >
                          {status.icon}
                          {status.label}
                        </span>

                        {project.status === 'completed' && (
                          <Link
                            href={`/projects/${project.id}`}
                            className="p-1.5 text-slate-500 hover:text-primary-500 transition-colors"
                            title="View Details"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        )}

                        {(project.status === 'completed' || project.status === 'failed') && (
                          <button
                            onClick={() => handleReanalyze(project.id)}
                            className="p-1.5 text-slate-500 hover:text-blue-500 transition-colors"
                            title="Reanalyze"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(project.id)}
                          className="p-1.5 text-slate-500 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
