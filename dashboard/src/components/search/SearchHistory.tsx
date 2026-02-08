'use client';

import { History, Search, Trash2, Clock } from 'lucide-react';
import { useSearch } from '@/contexts/SearchContext';
import { formatDistanceToNow } from 'date-fns';

interface SearchHistoryProps {
  onSelectQuery?: (query: string) => void;
  maxItems?: number;
}

export function SearchHistory({ onSelectQuery, maxItems = 10 }: SearchHistoryProps) {
  const { history, setQuery, executeSearch, clearHistory } = useSearch();

  const displayedHistory = history.slice(0, maxItems);

  const handleSelect = async (query: string) => {
    setQuery(query);
    if (onSelectQuery) {
      onSelectQuery(query);
    } else {
      await executeSearch(query);
    }
  };

  if (displayedHistory.length === 0) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-4 bg-surface-100 dark:bg-surface-800 rounded-2xl flex items-center justify-center">
          <History className="w-8 h-8 text-surface-400" />
        </div>
        <p className="text-sm font-medium text-surface-500 dark:text-surface-400">No recent searches</p>
        <p className="text-xs text-surface-400 mt-1">Your search history will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 animate-fade-in">
      <div className="flex items-center justify-between px-2 py-2">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2">
          <div className="p-1.5 bg-surface-100 dark:bg-surface-800 rounded-lg">
            <History className="w-4 h-4 text-surface-500" />
          </div>
          Recent Searches
        </h3>
        <button
          onClick={clearHistory}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear all
        </button>
      </div>

      <div className="space-y-1">
        {displayedHistory.map((item, index) => (
          <button
            key={item.id}
            onClick={() => handleSelect(item.query)}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-colors text-left group animate-fade-in-up"
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <div className="p-2 bg-surface-100 dark:bg-surface-800 rounded-lg group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30 transition-colors">
              <Search className="w-4 h-4 text-surface-400 group-hover:text-brand-500 transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-700 dark:text-surface-300 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                {item.query}
              </p>
              <div className="flex items-center gap-2 text-xs text-surface-400 mt-0.5">
                <span className="font-medium">{item.resultCount} results</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
