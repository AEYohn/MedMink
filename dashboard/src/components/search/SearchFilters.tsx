'use client';

import { FileText, Lightbulb, Beaker, X, SlidersHorizontal } from 'lucide-react';
import { useSearch } from '@/contexts/SearchContext';

export function SearchFilters() {
  const { filters, setFilters } = useSearch();

  const typeOptions = [
    { value: 'paper', label: 'Papers', icon: FileText, color: 'blue' },
    { value: 'claim', label: 'Claims', icon: Lightbulb, color: 'purple' },
    { value: 'technique', label: 'Techniques', icon: Beaker, color: 'cyan' },
  ];

  const toggleType = (type: string) => {
    const types = filters.types.includes(type)
      ? filters.types.filter(t => t !== type)
      : [...filters.types, type];
    setFilters({ types: types.length > 0 ? types : filters.types });
  };

  const getButtonClass = (type: string, color: string) => {
    const isActive = filters.types.includes(type);
    if (isActive) {
      switch (color) {
        case 'blue':
          return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700 shadow-sm';
        case 'purple':
          return 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700 shadow-sm';
        case 'cyan':
          return 'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-700 shadow-sm';
        default:
          return 'bg-surface-100 text-surface-700 border-surface-300 shadow-sm';
      }
    }
    return 'bg-white dark:bg-surface-800 text-surface-500 dark:text-surface-400 border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600 hover:bg-surface-50 dark:hover:bg-surface-700/50';
  };

  const hasActiveFilters = filters.types.length < 3 || filters.minConfidence > 0.4;

  const resetFilters = () => {
    setFilters({
      types: ['paper', 'claim', 'technique'],
      minConfidence: 0.4,
    });
  };

  return (
    <div className="card p-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-4">
        {/* Filter Icon */}
        <div className="flex items-center gap-2 text-surface-500 dark:text-surface-400">
          <SlidersHorizontal className="w-4 h-4" />
          <span className="text-sm font-medium">Filters</span>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-6 bg-surface-200 dark:bg-surface-700" />

        {/* Type Filters */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-surface-400 dark:text-surface-500 uppercase tracking-wide">Types</span>
          <div className="flex items-center gap-1.5">
            {typeOptions.map(option => (
              <button
                key={option.value}
                onClick={() => toggleType(option.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${getButtonClass(
                  option.value,
                  option.color
                )}`}
              >
                <option.icon className="w-3.5 h-3.5" />
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-6 bg-surface-200 dark:bg-surface-700" />

        {/* Confidence Filter */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-surface-400 dark:text-surface-500 uppercase tracking-wide">Min Score</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              step="10"
              value={filters.minConfidence * 100}
              onChange={e => setFilters({ minConfidence: parseInt(e.target.value) / 100 })}
              className="w-24 h-2 bg-surface-200 dark:bg-surface-700 rounded-full appearance-none cursor-pointer accent-brand-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-500 [&::-webkit-slider-thumb]:shadow-md"
            />
            <span className="text-sm font-semibold text-surface-700 dark:text-surface-300 w-10 tabular-nums">
              {Math.round(filters.minConfidence * 100)}%
            </span>
          </div>
        </div>

        {/* Reset Button */}
        {hasActiveFilters && (
          <>
            <div className="hidden sm:block w-px h-6 bg-surface-200 dark:bg-surface-700" />
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-surface-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              Reset
            </button>
          </>
        )}
      </div>
    </div>
  );
}
