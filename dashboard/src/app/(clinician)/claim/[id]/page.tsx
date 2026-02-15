'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Lightbulb,
  FileText,
  Bookmark,
  BookmarkCheck,
  Loader2,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { EntityLink } from '@/components/shared/EntityLink';
import { api, Claim, Contradiction } from '@/lib/api';
import { addBookmark, removeBookmark, isBookmarked } from '@/lib/storage';

export default function ClaimDetailPage() {
  const params = useParams();
  const router = useRouter();
  const claimId = params.id as string;

  const [claim, setClaim] = useState<Claim | null>(null);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    if (!claimId) return;

    const fetchClaim = async () => {
      setLoading(true);
      setError(null);
      try {
        const claims = await api.getClaims(500);
        const foundClaim = claims.find(c => c.id === claimId);

        if (!foundClaim) {
          throw new Error('Claim not found');
        }

        setClaim(foundClaim);
        setBookmarked(isBookmarked(claimId));

        const allContradictions = await api.getContradictions(100);
        const relatedContradictions = allContradictions.filter(
          c => c.claim1.id === claimId || c.claim2.id === claimId
        );
        setContradictions(relatedContradictions);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load claim');
      } finally {
        setLoading(false);
      }
    };

    fetchClaim();
  }, [claimId]);

  const toggleBookmark = () => {
    if (!claim) return;

    if (bookmarked) {
      removeBookmark(claimId);
      setBookmarked(false);
    } else {
      addBookmark({
        entityId: claimId,
        entityType: 'claim',
        title: claim.statement.slice(0, 50) + (claim.statement.length > 50 ? '...' : ''),
      });
      setBookmarked(true);
    }
  };

  const getCategoryConfig = (category: string) => {
    switch (category) {
      case 'finding':
        return { class: 'badge-blue', label: 'Finding' };
      case 'method':
        return { class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'Method' };
      case 'limitation':
        return { class: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: 'Limitation' };
      default:
        return { class: 'badge-neutral', label: category };
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'validated':
        return { class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'Validated' };
      case 'disputed':
        return { class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Disputed' };
      default:
        return { class: 'badge-neutral', label: status };
    }
  };

  return (
    <>
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
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
            <p className="text-sm text-surface-500">Loading claim details...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <div className="p-4 bg-red-100 dark:bg-red-900/20 rounded-2xl mb-4">
              <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">
              Failed to load claim
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

        {claim && (
          <div className="space-y-6 animate-fade-in">
            {/* Header Card */}
            <div className="card p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="p-2.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg">
                    <Lightbulb className="w-6 h-6 text-white" />
                  </div>
                  <span className="badge badge-purple">Claim</span>
                  <span className={`badge ${getCategoryConfig(claim.category).class}`}>
                    {getCategoryConfig(claim.category).label}
                  </span>
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

              <p className="text-lg text-surface-900 dark:text-white leading-relaxed mb-5">
                {claim.statement}
              </p>

              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-surface-200 dark:border-surface-700">
                <span className={`badge ${getStatusConfig(claim.status).class}`}>
                  {getStatusConfig(claim.status).label}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-surface-500 dark:text-surface-400">Confidence:</span>
                  <div className="w-24 h-2 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all"
                      style={{ width: `${claim.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-surface-700 dark:text-surface-300 tabular-nums">
                    {Math.round(claim.confidence * 100)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Source Paper */}
            {claim.paper_id && (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  Source Paper
                </h2>
                <EntityLink type="paper" id={claim.paper_id} title="View source paper">
                  <div className="p-4 bg-surface-50 dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 hover:border-blue-300 dark:hover:border-blue-700 transition-all flex items-center gap-3 group">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                      <FileText className="w-5 h-5 text-blue-500" />
                    </div>
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                      View paper details
                    </span>
                    <ChevronRight className="w-4 h-4 text-surface-400 ml-auto group-hover:translate-x-1 transition-transform" />
                  </div>
                </EntityLink>
              </div>
            )}

            {/* Contradictions */}
            {contradictions.length > 0 && (
              <div className="card border-red-200 dark:border-red-900/50 overflow-hidden">
                <div className="px-6 py-4 border-b border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10">
                  <h2 className="font-semibold text-surface-900 dark:text-white flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    Contradictions
                    <span className="badge bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 ml-2">
                      {contradictions.length}
                    </span>
                  </h2>
                </div>
                <div className="p-4 space-y-4">
                  {contradictions.map((contradiction, idx) => {
                    const otherClaim = contradiction.claim1.id === claimId
                      ? contradiction.claim2
                      : contradiction.claim1;

                    return (
                      <div
                        key={idx}
                        className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-900/30 animate-fade-in"
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                            Contradicting claim
                          </span>
                          <span className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full font-medium tabular-nums">
                            {Math.round(contradiction.strength * 100)}% strength
                          </span>
                        </div>
                        <EntityLink type="claim" id={otherClaim.id} title={otherClaim.statement}>
                          <p className="text-sm text-surface-700 dark:text-surface-300 mb-3 hover:text-red-600 dark:hover:text-red-400 cursor-pointer transition-colors">
                            {otherClaim.statement}
                          </p>
                        </EntityLink>
                        <div className="pt-3 border-t border-red-200 dark:border-red-900/30">
                          <p className="text-sm text-surface-500 dark:text-surface-400 italic">
                            {contradiction.explanation}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No contradictions */}
            {contradictions.length === 0 && (
              <div className="card p-8 text-center">
                <div className="w-14 h-14 mx-auto mb-4 bg-emerald-100 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-surface-500 dark:text-surface-400">
                  No contradictions detected
                </p>
                <p className="text-xs text-surface-400 mt-1">
                  This claim is consistent with other research
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
