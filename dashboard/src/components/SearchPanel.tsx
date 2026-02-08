'use client';

import { useState } from 'react';
import { Search, Loader2, Upload, Link, Sparkles, ChevronDown, ChevronUp, Rocket } from 'lucide-react';

interface SearchPanelProps {
  onSearch: (topic: string, maxResults: number) => Promise<void>;
  isSearching: boolean;
}

export function SearchPanel({ onSearch, isSearching }: SearchPanelProps) {
  const [topic, setTopic] = useState('');
  const [maxResults, setMaxResults] = useState(20);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim() && !isSearching) {
      await onSearch(topic.trim(), maxResults);
    }
  };

  const suggestions = [
    'transformer attention mechanisms',
    'large language model scaling',
    'vision transformers',
    'reinforcement learning from human feedback',
  ];

  return (
    <div className="card overflow-hidden animate-fade-in">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-200 dark:border-surface-700">
        <div className="p-2 bg-gradient-to-br from-brand-500 to-accent-500 rounded-xl">
          <Rocket className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold text-surface-900 dark:text-white">Start New Research</h2>
          <p className="text-xs text-surface-500">Search and analyze research papers</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        <div>
          <label
            htmlFor="topic"
            className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2"
          >
            Enter a research topic
          </label>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <Search className="w-5 h-5 text-surface-400" />
              </div>
              <input
                id="topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., transformer attention mechanisms"
                className="w-full pl-12 pr-4 py-3 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-white placeholder-surface-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                disabled={isSearching}
              />
            </div>
            <button
              type="submit"
              disabled={!topic.trim() || isSearching}
              className="btn btn-primary px-6 py-3 flex items-center gap-2"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="hidden sm:inline">Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  <span className="hidden sm:inline">Search</span>
                </>
              )}
            </button>
          </div>

          {/* Suggestions */}
          {!topic && (
            <div className="mt-3">
              <p className="text-xs text-surface-400 mb-2">Try these topics:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setTopic(suggestion)}
                    className="px-3 py-1.5 text-xs bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 rounded-full hover:bg-brand-100 dark:hover:bg-brand-900/30 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Advanced Options Toggle */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
          >
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showAdvanced ? 'Hide' : 'Show'} advanced options
          </button>

          {showAdvanced && (
            <div className="mt-4 p-4 bg-surface-50 dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 animate-fade-in">
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">
                Maximum papers to fetch
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={maxResults}
                  onChange={(e) => setMaxResults(Number(e.target.value))}
                  className="flex-1 h-2 bg-surface-200 dark:bg-surface-700 rounded-full appearance-none cursor-pointer accent-brand-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-500 [&::-webkit-slider-thumb]:shadow-md"
                  disabled={isSearching}
                />
                <span className="w-16 text-center px-3 py-1.5 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg text-sm font-semibold text-surface-900 dark:text-white tabular-nums">
                  {maxResults}
                </span>
              </div>
              <div className="flex justify-between text-xs text-surface-400 mt-2">
                <span>5 papers</span>
                <span>100 papers</span>
              </div>
            </div>
          )}
        </div>

        {/* Alternative Actions */}
        <div className="flex items-center gap-4 pt-4 border-t border-surface-200 dark:border-surface-700">
          <span className="text-sm text-surface-500 dark:text-surface-400">Or:</span>
          <button
            type="button"
            disabled
            className="flex items-center gap-2 px-3 py-2 text-sm text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Paper
            <span className="text-2xs bg-surface-200 dark:bg-surface-700 px-1.5 py-0.5 rounded font-medium">Soon</span>
          </button>
          <button
            type="button"
            disabled
            className="flex items-center gap-2 px-3 py-2 text-sm text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <Link className="w-4 h-4" />
            Paste arXiv URL
            <span className="text-2xs bg-surface-200 dark:bg-surface-700 px-1.5 py-0.5 rounded font-medium">Soon</span>
          </button>
        </div>
      </form>
    </div>
  );
}
