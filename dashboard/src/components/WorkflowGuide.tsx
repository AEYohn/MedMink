'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Search, Brain, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'workflow-guide-dismissed';

export function WorkflowGuide() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isFirstVisit, setIsFirstVisit] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed === 'true') {
      setIsExpanded(false);
      setIsFirstVisit(false);
    }
  }, []);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    if (!newExpanded && isFirstVisit) {
      localStorage.setItem(STORAGE_KEY, 'true');
      setIsFirstVisit(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            How It Works
          </h2>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1 */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Search className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                    Search Papers
                  </h3>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Fetch research papers from arXiv on any topic
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                    Extract Insights
                  </h3>
                </div>
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  AI extracts claims and methods from each paper
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-amber-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                    Find Patterns
                  </h3>
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Discover trends, contradictions, and predictions
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
