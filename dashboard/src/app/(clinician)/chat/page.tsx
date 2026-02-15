'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Brain,
  ArrowLeft,
  RefreshCw,
  Search,
  FileText,
  Lightbulb,
  Beaker,
} from 'lucide-react';
import { Chat } from '@/components/Chat';
import { api, GraphStats } from '@/lib/api';

interface SearchResult {
  id: string;
  content_type: string;
  semantic_score: number;
  keyword_score: number;
  combined_score: number;
  title: string | null;
  snippet: string | null;
  metadata: Record<string, any>;
}

export default function ChatPage() {
  const router = useRouter();
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchType, setSearchType] = useState<'all' | 'papers' | 'claims' | 'techniques'>('all');

  useEffect(() => {
    api.getGraphStats().then(setStats).catch(console.error);
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isSearching) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/search/semantic?q=${encodeURIComponent(searchQuery)}&type=${searchType}&limit=20`
      );
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePaperClick = useCallback((paperId: string) => {
    // Navigate to paper detail view
    router.push(`/papers/${paperId}`);
  }, [router]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'paper':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'claim':
        return <Lightbulb className="w-4 h-4 text-purple-500" />;
      case 'technique':
        return <Beaker className="w-4 h-4 text-cyan-500" />;
      default:
        return <FileText className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <Brain className="w-7 h-7 text-blue-500" />
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                Research Chat
              </h1>
            </div>

            {stats && (
              <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                <span>{stats.papers} papers</span>
                <span>{stats.claims} claims</span>
                <span>{stats.techniques} techniques</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat Panel */}
          <div className="lg:col-span-2 h-[calc(100vh-8rem)]">
            <Chat onPaperClick={handlePaperClick} />
          </div>

          {/* Semantic Search Panel */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-500" />
                Semantic Search
              </h3>

              <form onSubmit={handleSearch} className="space-y-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by meaning..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <div className="flex gap-2">
                  {(['all', 'papers', 'claims', 'techniques'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSearchType(type)}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        searchType === type
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={!searchQuery.trim() || isSearching}
                  className="w-full px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSearching ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Search
                </button>
              </form>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  {searchResults.length} results
                </h4>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {searchResults.map((result) => (
                    <div
                      key={result.id}
                      className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-start gap-2">
                        {getTypeIcon(result.content_type)}
                        <div className="flex-1 min-w-0">
                          {result.title && (
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                              {result.title}
                            </p>
                          )}
                          {result.snippet && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                              {result.snippet}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-slate-400">
                              Score: {(result.combined_score * 100).toFixed(0)}%
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-400">
                              {result.content_type}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Help */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                Tips for Better Results
              </h4>
              <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                <li>- Ask specific questions about methods or findings</li>
                <li>- Use technical terms when searching for techniques</li>
                <li>- Try different phrasings if results are not relevant</li>
                <li>- Click on sources to see the full paper or claim</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
