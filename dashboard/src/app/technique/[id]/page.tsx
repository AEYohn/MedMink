'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Beaker,
  FileText,
  Bookmark,
  BookmarkCheck,
  Loader2,
  AlertTriangle,
  Sparkles,
  GitBranch,
  Code,
  Lightbulb,
  Copy,
  Check,
  Hash,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { api, Technique } from '@/lib/api';
import { MathRenderer, MathText } from '@/components/shared/MathRenderer';
import { addBookmark, removeBookmark, isBookmarked } from '@/lib/storage';

export default function TechniqueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const techniqueId = params.id as string;

  const [technique, setTechnique] = useState<Technique | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!techniqueId) return;

    const fetchTechnique = async () => {
      setLoading(true);
      setError(null);
      try {
        const techniques = await api.getTechniques(500);
        const foundTechnique = techniques.find(t => t.id === techniqueId);

        if (!foundTechnique) {
          throw new Error('Technique not found');
        }

        setTechnique(foundTechnique);
        setBookmarked(isBookmarked(techniqueId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load technique');
      } finally {
        setLoading(false);
      }
    };

    fetchTechnique();
  }, [techniqueId]);

  const toggleBookmark = () => {
    if (!technique) return;

    if (bookmarked) {
      removeBookmark(techniqueId);
      setBookmarked(false);
    } else {
      addBookmark({
        entityId: techniqueId,
        entityType: 'technique',
        title: technique.name,
      });
      setBookmarked(true);
    }
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'algorithm':
        return { class: 'badge-blue', label: 'Algorithm' };
      case 'architecture':
        return { class: 'badge-purple', label: 'Architecture' };
      case 'loss_function':
        return { class: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: 'Loss Function' };
      case 'optimization':
        return { class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'Optimization' };
      default:
        return { class: 'badge-neutral', label: type.replace('_', ' ') };
    }
  };

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const hasActionableContent = technique?.formula || technique?.pseudocode || technique?.implementation_notes;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 lg:px-6 py-6">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 mb-6 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back
        </button>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="p-4 bg-white dark:bg-surface-800 rounded-2xl shadow-lg mb-4">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
            </div>
            <p className="text-sm text-surface-500">Loading technique details...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <div className="p-4 bg-red-100 dark:bg-red-900/20 rounded-2xl mb-4">
              <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">
              Failed to load technique
            </h2>
            <p className="text-surface-500 dark:text-surface-400 mb-6">{error}</p>
            <button
              onClick={() => router.back()}
              className="btn btn-primary"
            >
              Go Back
            </button>
          </div>
        )}

        {technique && (
          <div className="space-y-6 animate-fade-in">
            {/* Header Card */}
            <div className="card p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl shadow-lg">
                    <Beaker className="w-6 h-6 text-white" />
                  </div>
                  <span className="badge badge-cyan">Technique</span>
                  <span className={`badge ${getTypeConfig(technique.technique_type).class}`}>
                    {getTypeConfig(technique.technique_type).label}
                  </span>
                  {technique.is_novel && (
                    <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Novel
                    </span>
                  )}
                </div>

                <button
                  onClick={toggleBookmark}
                  className={`p-2.5 rounded-xl transition-all ${
                    bookmarked
                      ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-sm'
                      : 'text-surface-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                  }`}
                >
                  {bookmarked ? (
                    <BookmarkCheck className="w-5 h-5" />
                  ) : (
                    <Bookmark className="w-5 h-5" />
                  )}
                </button>
              </div>

              <h1 className="text-2xl font-bold text-surface-900 dark:text-white mb-4 leading-tight">
                {technique.name}
              </h1>

              <p className="text-surface-700 dark:text-surface-300 leading-relaxed">
                <MathText>{technique.description}</MathText>
              </p>

              {/* Paper count */}
              <div className="flex items-center gap-2 mt-5 pt-4 border-t border-surface-200 dark:border-surface-700">
                <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
                  <FileText className="w-4 h-4" />
                  <span>Used in <strong className="text-surface-700 dark:text-surface-300">{technique.paper_count}</strong> paper{technique.paper_count !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>

            {/* Actionable Content Warning */}
            {!hasActionableContent && (
              <div className="card border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 p-5">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-amber-800 dark:text-amber-300">
                      Limited Actionable Content
                    </h3>
                    <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                      This technique doesn't have formulas, pseudocode, or implementation notes extracted yet.
                      Re-run the analysis pipeline to extract more detailed information.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Formula - Most Prominent */}
            {technique.formula && (
              <div className="card border-2 border-blue-200 dark:border-blue-800/50 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800/50">
                  <h2 className="font-semibold text-surface-900 dark:text-white flex items-center gap-2">
                    <Hash className="w-5 h-5 text-blue-500" />
                    Formula / Mathematical Definition
                  </h2>
                  <button
                    onClick={() => copyToClipboard(technique.formula!, 'formula')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
                  >
                    {copiedField === 'formula' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedField === 'formula' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="p-6">
                  <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800/50 overflow-x-auto flex justify-center">
                    <div className="text-lg text-surface-800 dark:text-surface-200">
                      <MathRenderer math={technique.formula} block />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Pseudocode - Very Prominent */}
            {technique.pseudocode && (
              <div className="card border-2 border-emerald-200 dark:border-emerald-800/50 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800/50">
                  <h2 className="font-semibold text-surface-900 dark:text-white flex items-center gap-2">
                    <Code className="w-5 h-5 text-emerald-500" />
                    Pseudocode / Algorithm Steps
                  </h2>
                  <button
                    onClick={() => copyToClipboard(technique.pseudocode!, 'pseudocode')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors"
                  >
                    {copiedField === 'pseudocode' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedField === 'pseudocode' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="p-6">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800/50 overflow-x-auto">
                    <pre className="text-sm text-surface-800 dark:text-surface-200 font-mono whitespace-pre-wrap leading-relaxed">
                      {technique.pseudocode}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Implementation Notes - Prominent */}
            {technique.implementation_notes && (
              <div className="card border-2 border-purple-200 dark:border-purple-800/50 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-800/50">
                  <h2 className="font-semibold text-surface-900 dark:text-white flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-purple-500" />
                    Implementation Notes
                  </h2>
                  <button
                    onClick={() => copyToClipboard(technique.implementation_notes!, 'notes')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors"
                  >
                    {copiedField === 'notes' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedField === 'notes' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="p-6">
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800/50">
                    <p className="text-surface-700 dark:text-surface-300 whitespace-pre-wrap leading-relaxed">
                      {technique.implementation_notes}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Improves Upon */}
            {technique.improves_upon && (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-emerald-500" />
                  Improves Upon
                </h2>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-200 dark:border-emerald-900/30">
                  <p className="text-surface-700 dark:text-surface-300">
                    {technique.improves_upon}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
