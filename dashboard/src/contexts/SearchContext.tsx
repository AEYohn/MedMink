'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { usePersistentState } from '@/hooks/usePersistentState';
import { addSearchToHistory, SearchFilters, SearchHistoryItem, getSearchHistory, clearSearchHistory } from '@/lib/storage';
import { api, SearchResultItem } from '@/lib/api';

export type SearchMode = 'search' | 'chat';

export interface SearchState {
  query: string;
  mode: SearchMode;
  results: SearchResultItem[];
  isSearching: boolean;
  error: string | null;
  filters: SearchFilters;
  history: SearchHistoryItem[];
}

interface SearchContextValue extends SearchState {
  setQuery: (query: string) => void;
  setMode: (mode: SearchMode) => void;
  setFilters: (filters: Partial<SearchFilters>) => void;
  executeSearch: (query?: string) => Promise<void>;
  clearResults: () => void;
  clearHistory: () => void;
}

const defaultFilters: SearchFilters = {
  types: ['paper', 'claim', 'technique'],
  minConfidence: 0.4,
};

const SearchContext = createContext<SearchContextValue | undefined>(undefined);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = usePersistentState<SearchMode>('search-mode', 'search');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = usePersistentState<SearchFilters>('search-filters', defaultFilters);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);

  // Load history on mount
  React.useEffect(() => {
    setHistory(getSearchHistory());
  }, []);

  const setFilters = useCallback((newFilters: Partial<SearchFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, [setFiltersState]);

  const executeSearch = useCallback(async (searchQuery?: string) => {
    const q = searchQuery ?? query;
    if (!q.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      // Determine type filter based on selected types
      const typeFilter = filters.types.length === 3 ? 'all' : filters.types[0] || 'all';

      const response = await api.semanticSearch(
        q,
        typeFilter,
        20,
        filters.minConfidence
      );

      setResults(response.results);

      // Add to history
      addSearchToHistory({
        query: q,
        resultCount: response.total_found,
        filters,
      });
      setHistory(getSearchHistory());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query, filters]);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  const handleClearHistory = useCallback(() => {
    clearSearchHistory();
    setHistory([]);
  }, []);

  const value: SearchContextValue = {
    query,
    mode,
    results,
    isSearching,
    error,
    filters,
    history,
    setQuery,
    setMode,
    setFilters,
    executeSearch,
    clearResults,
    clearHistory: handleClearHistory,
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch(): SearchContextValue {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}
