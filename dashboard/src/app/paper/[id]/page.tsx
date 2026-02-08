'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  ExternalLink,
  Calendar,
  User,
  Tag,
  Lightbulb,
  Beaker,
  Bookmark,
  BookmarkCheck,
  Loader2,
  AlertTriangle,
  ChevronRight,
  Download,
  Sparkles,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { EntityLink } from '@/components/shared/EntityLink';
import { RelatedEntities } from '@/components/entities/RelatedEntities';
import { api, Paper, Claim } from '@/lib/api';
import { addBookmark, removeBookmark, isBookmarked } from '@/lib/storage';

interface PaperDetail {
  paper: Paper;
  claims: Claim[];
}

export default function PaperDetailPage() {
  const params = useParams();
  const router = useRouter();
  const paperId = params.id as string;

  const [data, setData] = useState<PaperDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    if (!paperId) return;

    const fetchPaper = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.getPaper(paperId);
        setData(result);
        setBookmarked(isBookmarked(paperId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load paper');
      } finally {
        setLoading(false);
      }
    };

    fetchPaper();
  }, [paperId]);

  const toggleBookmark = () => {
    if (!data) return;

    if (bookmarked) {
      removeBookmark(paperId);
      setBookmarked(false);
    } else {
      addBookmark({
        entityId: paperId,
        entityType: 'paper',
        title: data.paper.title,
      });
      setBookmarked(true);
    }
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-6">
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
              <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            </div>
            <p className="text-sm text-surface-500">Loading paper details...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <div className="p-4 bg-red-100 dark:bg-red-900/20 rounded-2xl mb-4">
              <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">
              Failed to load paper
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

        {data && (
          <div className="space-y-6 animate-fade-in">
            {/* Header Card */}
            <div className="card p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <span className="badge badge-blue">Paper</span>
                  {data.paper.analyzed && (
                    <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Analyzed
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

              <h1 className="text-2xl font-bold text-surface-900 dark:text-white mb-5 leading-tight">
                {data.paper.title}
              </h1>

              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-surface-600 dark:text-surface-400 mb-5">
                <span className="flex items-center gap-1.5 font-medium">
                  <Tag className="w-4 h-4 text-surface-400" />
                  {data.paper.arxiv_id}
                </span>
                {data.paper.published_date && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-surface-400" />
                    {new Date(data.paper.published_date).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Authors */}
              {data.paper.authors.length > 0 && (
                <div className="flex items-start gap-2 mb-5">
                  <User className="w-4 h-4 text-surface-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-surface-600 dark:text-surface-400">
                    {data.paper.authors.join(', ')}
                  </p>
                </div>
              )}

              {/* Categories */}
              {data.paper.categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5">
                  {data.paper.categories.map((category, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 rounded-lg text-xs font-medium"
                    >
                      {category}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 pt-4 border-t border-surface-200 dark:border-surface-700">
                <a
                  href={`https://arxiv.org/abs/${data.paper.arxiv_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 rounded-xl text-sm font-medium hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  View on arXiv
                </a>
                <a
                  href={`https://arxiv.org/pdf/${data.paper.arxiv_id}.pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </a>
              </div>
            </div>

            {/* Abstract */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                Abstract
              </h2>
              <p className="text-surface-700 dark:text-surface-300 leading-relaxed whitespace-pre-wrap">
                {data.paper.abstract}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Claims */}
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-purple-500" />
                  Extracted Claims
                  <span className="badge badge-purple ml-auto">{data.claims.length}</span>
                </h2>

                {data.claims.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {data.claims.map((claim, index) => (
                      <EntityLink
                        key={claim.id}
                        type="claim"
                        id={claim.id}
                        title={claim.statement}
                      >
                        <div
                          className="p-4 bg-surface-50 dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all group animate-fade-in"
                          style={{ animationDelay: `${index * 30}ms` }}
                        >
                          <p className="text-sm text-surface-700 dark:text-surface-300 mb-3 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            {claim.statement}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`badge ${
                                claim.category === 'finding'
                                  ? 'badge-blue'
                                  : claim.category === 'method'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : 'badge-neutral'
                              }`}
                            >
                              {claim.category}
                            </span>
                            <span className="text-xs text-surface-500 tabular-nums">
                              {Math.round(claim.confidence * 100)}% confidence
                            </span>
                            <ChevronRight className="w-4 h-4 text-surface-400 ml-auto group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </EntityLink>
                    ))}
                  </div>
                ) : !data.paper.analyzed ? (
                  <div className="p-8 text-center bg-surface-50 dark:bg-surface-900 rounded-xl border border-dashed border-surface-300 dark:border-surface-700">
                    <Beaker className="w-10 h-10 mx-auto text-surface-400 mb-3" />
                    <p className="text-surface-600 dark:text-surface-400 font-medium">
                      Paper not analyzed yet
                    </p>
                    <p className="text-sm text-surface-500 mt-1">
                      Run &quot;Extract Insights&quot; to extract claims
                    </p>
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <Sparkles className="w-10 h-10 mx-auto text-surface-400 mb-3" />
                    <p className="text-surface-500">No claims extracted</p>
                  </div>
                )}
              </div>

              {/* Related Papers */}
              <RelatedEntities entityType="paper" entityId={paperId} limit={5} />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
