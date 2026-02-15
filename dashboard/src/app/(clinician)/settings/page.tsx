'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  History,
  Trash2,
  Database,
  DollarSign,
  Activity,
  Wifi,
  WifiOff,
  Moon,
  Sun,
  MessageCircle,
  Search,
  Bookmark,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useProgress } from '@/contexts/ProgressContext';
import { api, SystemStatus } from '@/lib/api';
import {
  clearSearchHistory,
  getSearchHistory,
  getConversations,
  getBookmarks,
  clearAll,
  SearchHistoryItem,
  SavedConversation,
  Bookmark as BookmarkType,
} from '@/lib/storage';

interface CacheStats {
  enabled: boolean;
  total_entries: number;
  valid_entries: number;
  similarity_threshold: number;
  ttl_hours: number;
}

interface AnalysisSettings {
  analysis_mode: string;
  token_budgets: { quick: number; standard: number; deep: number };
  caching: { enabled: boolean; similarity_threshold: number; ttl_hours: number };
  batch_analysis: { enabled: boolean; batch_size: number; max_batch_tokens: number };
}

export default function SettingsPage() {
  const { isConnected } = useProgress();
  const { theme, setTheme } = useTheme();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClearingDatabase, setIsClearingDatabase] = useState(false);
  const [clearResult, setClearResult] = useState<{ success: boolean; message: string } | null>(null);

  // Cache and analysis settings
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [analysisSettings, setAnalysisSettings] = useState<AnalysisSettings | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Storage stats
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>([]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [statusResult, cacheResult, settingsResult] = await Promise.allSettled([
          api.getStatus(),
          api.getCacheStats(),
          api.getAnalysisSettings(),
        ]);

        if (statusResult.status === 'fulfilled') setStatus(statusResult.value);
        if (cacheResult.status === 'fulfilled') setCacheStats(cacheResult.value);
        if (settingsResult.status === 'fulfilled') setAnalysisSettings(settingsResult.value);
      } catch (error) {
        console.error('Failed to fetch status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    setSearchHistory(getSearchHistory());
    setConversations(getConversations());
    setBookmarks(getBookmarks());
  }, []);

  const handleClearSearchHistory = () => {
    if (confirm('Are you sure you want to clear your search history?')) {
      clearSearchHistory();
      setSearchHistory([]);
    }
  };

  const handleClearAllData = () => {
    if (confirm('Are you sure you want to clear all local data? This cannot be undone.')) {
      clearAll();
      setSearchHistory([]);
      setConversations([]);
      setBookmarks([]);
    }
  };

  const handleClearDatabase = async () => {
    const confirmed = confirm(
      'WARNING: This will permanently delete ALL data from the knowledge graph, including:\n\n' +
      '• All papers\n' +
      '• All claims\n' +
      '• All techniques\n' +
      '• All trends\n' +
      '• All predictions\n' +
      '• All contradictions\n\n' +
      'This action CANNOT be undone. Are you absolutely sure?'
    );

    if (!confirmed) return;

    const doubleConfirmed = confirm(
      'FINAL CONFIRMATION: Type "DELETE" in your mind and click OK if you really want to clear the entire database.'
    );

    if (!doubleConfirmed) return;

    setIsClearingDatabase(true);
    setClearResult(null);

    try {
      const result = await api.clearDatabase(true);
      setClearResult({
        success: true,
        message: `Database cleared. Deleted: ${Object.entries(result.deleted_counts)
          .map(([type, count]) => `${count} ${type}`)
          .join(', ')}`,
      });
      // Refresh status
      const newStatus = await api.getStatus();
      setStatus(newStatus);
    } catch (error) {
      setClearResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to clear database',
      });
    } finally {
      setIsClearingDatabase(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-slate-500" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        </div>

        {/* System Status */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-500" />
            System Status
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Connection Status */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {isConnected ? (
                  <Wifi className="w-4 h-4 text-green-500" />
                ) : (
                  <WifiOff className="w-4 h-4 text-slate-400" />
                )}
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  WebSocket
                </span>
              </div>
              <p className={`text-sm ${isConnected ? 'text-green-600' : 'text-slate-500'}`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </p>
            </div>

            {/* API Status */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  API
                </span>
              </div>
              <p className={`text-sm ${status?.status === 'operational' ? 'text-green-600' : 'text-yellow-600'}`}>
                {loading ? 'Loading...' : status?.status || 'Unknown'}
              </p>
            </div>

            {/* Model */}
            {status?.gemini && (
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Model
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {status.gemini.model}
                </p>
              </div>
            )}

            {/* Knowledge Graph */}
            {status?.knowledge_graph && (
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-cyan-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Knowledge Graph
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {status.knowledge_graph.papers} papers
                </p>
              </div>
            )}
          </div>
        </div>

        {/* API Usage & Costs */}
        {status?.gemini && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-500" />
              API Usage & Costs
            </h2>

            <div className="grid grid-cols-2 gap-6">
              {/* Rate Limits */}
              <div>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Rate Limits
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600 dark:text-slate-400">Requests</span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {status.gemini.rate_limiter.requests_used} / {status.gemini.rate_limiter.requests_limit}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{
                          width: `${(status.gemini.rate_limiter.requests_used / status.gemini.rate_limiter.requests_limit) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600 dark:text-slate-400">Tokens</span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {status.gemini.rate_limiter.tokens_used.toLocaleString()} / {status.gemini.rate_limiter.tokens_limit.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{
                          width: `${(status.gemini.rate_limiter.tokens_used / status.gemini.rate_limiter.tokens_limit) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Costs */}
              <div>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Cost Tracking
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600 dark:text-slate-400">Daily Cost</span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {formatCurrency(status.gemini.cost_tracker.daily_cost)} / {formatCurrency(status.gemini.cost_tracker.daily_budget)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          status.gemini.cost_tracker.daily_cost > status.gemini.cost_tracker.daily_budget * 0.8
                            ? 'bg-red-500'
                            : 'bg-green-500'
                        }`}
                        style={{
                          width: `${Math.min((status.gemini.cost_tracker.daily_cost / status.gemini.cost_tracker.daily_budget) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600 dark:text-slate-400">Monthly Cost</span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {formatCurrency(status.gemini.cost_tracker.monthly_cost)} / {formatCurrency(status.gemini.cost_tracker.monthly_budget)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          status.gemini.cost_tracker.monthly_cost > status.gemini.cost_tracker.monthly_budget * 0.8
                            ? 'bg-red-500'
                            : 'bg-green-500'
                        }`}
                        style={{
                          width: `${Math.min((status.gemini.cost_tracker.monthly_cost / status.gemini.cost_tracker.monthly_budget) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Local Storage */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-cyan-500" />
            Local Storage
          </h2>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Search className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Search History
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {searchHistory.length}
              </p>
              <p className="text-xs text-slate-500">searches saved</p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Conversations
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {conversations.length}
              </p>
              <p className="text-xs text-slate-500">chats saved</p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Bookmark className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Bookmarks
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {bookmarks.length}
              </p>
              <p className="text-xs text-slate-500">items saved</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleClearSearchHistory}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              <History className="w-4 h-4" />
              Clear Search History
            </button>
            <button
              onClick={handleClearAllData}
              className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear All Local Data
            </button>
          </div>
        </div>

        {/* Analysis Optimization Settings */}
        {analysisSettings && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-500" />
              Analysis Optimization (Research-Backed)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Analysis Mode */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Analysis Mode
                </h3>
                <p className="text-xl font-bold text-purple-600 dark:text-purple-400 capitalize">
                  {analysisSettings.analysis_mode}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {analysisSettings.token_budgets[analysisSettings.analysis_mode as keyof typeof analysisSettings.token_budgets]?.toLocaleString()} max tokens
                </p>
              </div>

              {/* Batch Analysis */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Batch Analysis
                </h3>
                <p className={`text-xl font-bold ${analysisSettings.batch_analysis.enabled ? 'text-green-600' : 'text-slate-400'}`}>
                  {analysisSettings.batch_analysis.enabled ? 'Enabled' : 'Disabled'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {analysisSettings.batch_analysis.batch_size} papers/batch
                </p>
              </div>

              {/* Caching */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Analysis Caching
                </h3>
                <p className={`text-xl font-bold ${analysisSettings.caching.enabled ? 'text-green-600' : 'text-slate-400'}`}>
                  {analysisSettings.caching.enabled ? 'Enabled' : 'Disabled'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {(analysisSettings.caching.similarity_threshold * 100).toFixed(0)}% similarity threshold
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              These optimizations reduce API costs by batching paper analysis and caching results. Based on research from "Agent Workflow Optimization" and "Trajectory Recycling" papers.
            </p>
          </div>
        )}

        {/* Cache Stats */}
        {cacheStats && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-cyan-500" />
              Analysis Cache
            </h2>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {cacheStats.valid_entries}
                </p>
                <p className="text-xs text-slate-500">Cached Analyses</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {cacheStats.ttl_hours}h
                </p>
                <p className="text-xs text-slate-500">Cache TTL</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {(cacheStats.similarity_threshold * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-slate-500">Reuse Threshold</p>
              </div>
            </div>

            <button
              onClick={async () => {
                setIsClearingCache(true);
                try {
                  await api.clearCache();
                  const newStats = await api.getCacheStats();
                  setCacheStats(newStats);
                } finally {
                  setIsClearingCache(false);
                }
              }}
              disabled={isClearingCache}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
            >
              {isClearingCache ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Clear Analysis Cache
            </button>
          </div>
        )}

        {/* Clear Database */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-red-200 dark:border-red-900/30 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Danger Zone: Database Management
          </h2>

          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-700 dark:text-red-300">
              Clearing the database will permanently delete all papers, claims, techniques, trends, and predictions.
              This action cannot be undone. Only use this if you want to start fresh.
            </p>
          </div>

          {clearResult && (
            <div
              className={`p-4 rounded-lg mb-4 ${
                clearResult.success
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/30'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30'
              }`}
            >
              <p
                className={`text-sm ${
                  clearResult.success
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-red-700 dark:text-red-300'
                }`}
              >
                {clearResult.message}
              </p>
            </div>
          )}

          <button
            onClick={handleClearDatabase}
            disabled={isClearingDatabase}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isClearingDatabase ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {isClearingDatabase ? 'Clearing Database...' : 'Clear Entire Database'}
          </button>
        </div>

        {/* Appearance — Theme */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            Appearance
          </h2>

          <div className="flex gap-2">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-4 py-2 text-sm rounded-lg capitalize transition-colors ${
                  theme === t
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Theme preferences are stored locally and applied on page load.
          </p>
        </div>
      </div>
  );
}
