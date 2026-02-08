'use client';

import { useState } from 'react';
import { Search, MessageCircle, X, Loader2, Sparkles } from 'lucide-react';
import { useSearch, SearchMode } from '@/contexts/SearchContext';

interface GlobalSearchBarProps {
  onSubmit?: (query: string, mode: SearchMode) => void;
  autoFocus?: boolean;
  className?: string;
}

export function GlobalSearchBar({ onSubmit, autoFocus, className = '' }: GlobalSearchBarProps) {
  const { query, setQuery, mode, setMode, executeSearch, isSearching, clearResults } = useSearch();
  const [localQuery, setLocalQuery] = useState(query);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localQuery.trim() || isSearching) return;

    setQuery(localQuery);

    if (onSubmit) {
      onSubmit(localQuery, mode);
    } else {
      await executeSearch(localQuery);
    }
  };

  const handleClear = () => {
    setLocalQuery('');
    setQuery('');
    clearResults();
  };

  return (
    <form onSubmit={handleSubmit} className={`w-full ${className}`}>
      <div className="relative flex items-center gap-3">
        {/* Mode Toggle */}
        <div className="flex items-center bg-surface-100 dark:bg-surface-800 rounded-xl p-1 border border-surface-200 dark:border-surface-700">
          <button
            type="button"
            onClick={() => setMode('search')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'search'
                ? 'bg-white dark:bg-surface-700 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
            }`}
          >
            <Search className="w-4 h-4" />
            Search
          </button>
          <button
            type="button"
            onClick={() => setMode('chat')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'chat'
                ? 'bg-white dark:bg-surface-700 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            Chat
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            {mode === 'chat' ? (
              <Sparkles className="w-5 h-5 text-accent-500" />
            ) : (
              <Search className="w-5 h-5 text-surface-400" />
            )}
          </div>
          <input
            type="text"
            value={localQuery}
            onChange={e => setLocalQuery(e.target.value)}
            placeholder={
              mode === 'search'
                ? 'Search papers, claims, techniques...'
                : 'Ask a question about your research...'
            }
            className="w-full pl-12 pr-10 py-3 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            disabled={isSearching}
            autoFocus={autoFocus}
          />

          {localQuery && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!localQuery.trim() || isSearching}
          className="btn btn-primary px-6 py-3 flex items-center gap-2"
        >
          {isSearching ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              {mode === 'search' ? <Search className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
              <span className="hidden sm:inline font-medium">{mode === 'search' ? 'Search' : 'Ask'}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
