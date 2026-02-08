'use client';

import { useRouter } from 'next/navigation';
import {
  FileText,
  Lightbulb,
  Beaker,
  ChevronRight,
  ExternalLink,
  Search,
} from 'lucide-react';
import { SearchResultItem } from '@/lib/api';

interface SearchResultsProps {
  results: SearchResultItem[];
  isLoading?: boolean;
}

export function SearchResults({ results, isLoading }: SearchResultsProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="card p-4 animate-pulse"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-surface-200 dark:bg-surface-700 rounded-xl" />
              <div className="flex-1 space-y-3">
                <div className="h-5 bg-surface-200 dark:bg-surface-700 rounded-lg w-3/4" />
                <div className="h-4 bg-surface-200 dark:bg-surface-700 rounded-lg w-full" />
                <div className="h-4 bg-surface-200 dark:bg-surface-700 rounded-lg w-2/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="card p-12 text-center animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-4 bg-surface-100 dark:bg-surface-800 rounded-2xl flex items-center justify-center">
          <Search className="w-8 h-8 text-surface-400" />
        </div>
        <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">
          No results found
        </h3>
        <p className="text-surface-500 dark:text-surface-400">
          Try a different search term or adjust your filters.
        </p>
      </div>
    );
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'paper':
        return <FileText className="w-5 h-5" />;
      case 'claim':
        return <Lightbulb className="w-5 h-5" />;
      case 'technique':
        return <Beaker className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'paper':
        return 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400';
      case 'claim':
        return 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400';
      case 'technique':
        return 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400';
      default:
        return 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400';
    }
  };

  const getRoute = (type: string, id: string) => {
    switch (type) {
      case 'paper':
        return `/paper/${id}`;
      case 'claim':
        return `/claim/${id}`;
      case 'technique':
        return `/technique/${id}`;
      default:
        return '#';
    }
  };

  const handleClick = (result: SearchResultItem) => {
    router.push(getRoute(result.content_type, result.id));
  };

  return (
    <div className="space-y-3">
      {results.map((result, index) => (
        <button
          key={result.id}
          onClick={() => handleClick(result)}
          className="w-full card p-4 hover:border-brand-300 dark:hover:border-brand-600 hover:shadow-lg transition-all text-left group animate-fade-in-up"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className="flex items-start gap-4">
            {/* Type Icon */}
            <div className={`flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 ${getTypeColor(result.content_type)}`}>
              {getTypeIcon(result.content_type)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-surface-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-2">
                  {result.title || 'Untitled'}
                </h3>
                <ChevronRight className="w-5 h-5 text-surface-400 group-hover:text-brand-500 group-hover:translate-x-1 transition-all flex-shrink-0 mt-0.5" />
              </div>

              {result.snippet && (
                <p className="mt-2 text-sm text-surface-600 dark:text-surface-400 line-clamp-2">
                  {result.snippet}
                </p>
              )}

              {/* Metadata */}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span className={`badge ${
                  result.content_type === 'paper' ? 'badge-blue' :
                  result.content_type === 'claim' ? 'badge-purple' :
                  result.content_type === 'technique' ? 'badge-cyan' : 'badge-neutral'
                }`}>
                  {result.content_type}
                </span>

                <ConfidenceBadge score={result.combined_score} />

                {result.metadata?.arxiv_id && (
                  <a
                    href={`https://arxiv.org/abs/${result.metadata.arxiv_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-1.5 text-xs text-brand-500 hover:text-brand-600 dark:hover:text-brand-400 font-medium transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    arXiv
                  </a>
                )}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

interface ConfidenceBadgeProps {
  score: number;
}

export function ConfidenceBadge({ score }: ConfidenceBadgeProps) {
  const percentage = Math.round(score * 100);

  let colorClass = 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400';
  if (percentage >= 80) {
    colorClass = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  } else if (percentage >= 60) {
    colorClass = 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400';
  } else if (percentage >= 40) {
    colorClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  }

  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${colorClass}`}>
      {percentage}% match
    </span>
  );
}
