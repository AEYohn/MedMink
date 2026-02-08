'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  TrendingUp,
  Loader2,
  Code2,
  Sparkles,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { api, Paper, Claim, Trend, Contradiction, Technique } from '@/lib/api';
import { MathRenderer, MathText } from '@/components/shared/MathRenderer';

type Tab = 'papers' | 'claims' | 'trends' | 'contradictions' | 'techniques';

interface DataExplorerProps {
  stats: {
    papers: number;
    claims: number;
    methods: number;
    techniques: number;
    trends: number;
    predictions: number;
    contradictions: number;
  };
  refreshTrigger: number;
}

export function DataExplorer({ stats, refreshTrigger }: DataExplorerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('papers');
  const [papers, setPapers] = useState<Paper[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedPaper, setExpandedPaper] = useState<string | null>(null);

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab, refreshTrigger]);

  const loadData = async (tab: Tab) => {
    setLoading(true);
    try {
      switch (tab) {
        case 'papers':
          const papersData = await api.getPapers(50);
          setPapers(papersData);
          break;
        case 'claims':
          const claimsData = await api.getClaims(100);
          setClaims(claimsData);
          break;
        case 'trends':
          const trendsData = await api.getTrends(20);
          setTrends(trendsData);
          break;
        case 'contradictions':
          const contradictionsData = await api.getContradictions(20);
          setContradictions(contradictionsData);
          break;
        case 'techniques':
          const techniquesData = await api.getTechniques(100);
          setTechniques(techniquesData);
          break;
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'papers' as Tab, label: 'Papers', count: stats.papers, icon: FileText, color: 'blue' },
    { id: 'claims' as Tab, label: 'Claims', count: stats.claims, icon: Lightbulb, color: 'purple' },
    { id: 'techniques' as Tab, label: 'Techniques', count: stats.techniques, icon: Code2, color: 'cyan' },
    { id: 'trends' as Tab, label: 'Trends', count: stats.trends, icon: TrendingUp, color: 'emerald' },
    { id: 'contradictions' as Tab, label: 'Conflicts', count: stats.contradictions, icon: AlertTriangle, color: 'red' },
  ];

  const EmptyState = ({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>, title: string, description: string }) => (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="p-4 bg-surface-100 dark:bg-surface-800 rounded-2xl mb-4">
        <Icon className="w-10 h-10 text-surface-400" />
      </div>
      <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-surface-500 dark:text-surface-400 text-center max-w-sm">{description}</p>
    </div>
  );

  return (
    <div className="card overflow-hidden animate-fade-in">
      {/* Tab Header */}
      <div className="flex border-b border-surface-200 dark:border-surface-700 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-4 text-sm font-medium transition-all relative ${
              activeTab === tab.id
                ? 'text-brand-600 dark:text-brand-400'
                : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
              activeTab === tab.id
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300'
                : 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-400'
            }`}>
              {tab.count}
            </span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 min-h-[400px] max-h-[600px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
              <p className="text-sm text-surface-500">Loading data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Papers Tab */}
            {activeTab === 'papers' && (
              <div className="space-y-3">
                {papers.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="No Papers Yet"
                    description="Search for a topic above to ingest papers from arXiv into your knowledge base."
                  />
                ) : (
                  papers.map((paper, index) => (
                    <div
                      key={paper.id}
                      className="group bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden hover:border-brand-300 dark:hover:border-brand-600 transition-all animate-fade-in-up"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <div className="flex items-start gap-3 p-4">
                        <button
                          onClick={() => setExpandedPaper(expandedPaper === paper.id ? null : paper.id)}
                          className="mt-1 p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 rounded transition-colors"
                        >
                          {expandedPaper === paper.id ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        <div
                          onClick={() => router.push(`/paper/${paper.id}`)}
                          className="flex-1 min-w-0 cursor-pointer"
                        >
                          <h4 className="text-sm font-medium text-surface-900 dark:text-white line-clamp-2 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                            {paper.title}
                          </h4>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-surface-500 dark:text-surface-400 font-mono">
                              {paper.arxiv_id}
                            </span>
                            {paper.analyzed ? (
                              <span className="badge badge-success">
                                <CheckCircle2 className="w-3 h-3" />
                                Analyzed
                              </span>
                            ) : (
                              <span className="badge badge-neutral">
                                <Clock className="w-3 h-3" />
                                Pending
                              </span>
                            )}
                          </div>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-surface-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>

                      {expandedPaper === paper.id && (
                        <div className="px-4 pb-4 pt-2 border-t border-surface-200 dark:border-surface-700 animate-fade-in">
                          <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed">
                            {paper.abstract}
                          </p>
                          <div className="flex items-center justify-between mt-4">
                            <span className="text-xs text-surface-500">
                              {paper.authors.slice(0, 3).join(', ')}
                              {paper.authors.length > 3 && ` +${paper.authors.length - 3} more`}
                            </span>
                            <a
                              href={`https://arxiv.org/abs/${paper.arxiv_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 font-medium"
                            >
                              View on arXiv
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Claims Tab */}
            {activeTab === 'claims' && (
              <div className="space-y-3">
                {claims.length === 0 ? (
                  <EmptyState
                    icon={Lightbulb}
                    title="No Claims Yet"
                    description='Run "Extract Insights" on your papers to extract key claims and findings.'
                  />
                ) : (
                  claims.map((claim, index) => (
                    <button
                      key={claim.id}
                      onClick={() => router.push(`/claim/${claim.id}`)}
                      className="group w-full p-4 bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 rounded-xl text-left hover:border-purple-300 dark:hover:border-purple-600 transition-all animate-fade-in-up"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <p className="text-sm text-surface-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {claim.statement}
                      </p>
                      <div className="flex items-center gap-3 mt-3">
                        <span className={`badge ${
                          claim.category === 'finding' ? 'badge-brand' :
                          claim.category === 'method' ? 'badge-success' :
                          'badge-neutral'
                        }`}>
                          {claim.category}
                        </span>
                        <span className="text-xs text-surface-500">
                          {(claim.confidence * 100).toFixed(0)}% confidence
                        </span>
                        <span className={`badge ${
                          claim.status === 'validated' ? 'badge-success' :
                          claim.status === 'disputed' ? 'badge-error' :
                          'badge-neutral'
                        }`}>
                          {claim.status}
                        </span>
                        <ArrowUpRight className="w-4 h-4 text-surface-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Techniques Tab */}
            {activeTab === 'techniques' && (
              <div className="space-y-3">
                {techniques.length === 0 ? (
                  <EmptyState
                    icon={Code2}
                    title="No Techniques Yet"
                    description='Run "Extract Insights" on your papers to extract techniques and methods.'
                  />
                ) : (
                  techniques.map((technique, index) => (
                    <button
                      key={technique.id}
                      onClick={() => router.push(`/technique/${technique.id}`)}
                      className="group w-full p-4 bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 rounded-xl text-left hover:border-cyan-300 dark:hover:border-cyan-600 transition-all animate-fade-in-up"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-surface-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                            {technique.name}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className={`badge ${
                              technique.technique_type === 'algorithm' ? 'badge-brand' :
                              technique.technique_type === 'architecture' ? 'badge-accent' :
                              technique.technique_type === 'loss_function' ? 'badge-warning' :
                              technique.technique_type === 'optimization' ? 'badge-success' :
                              'badge-neutral'
                            }`}>
                              {technique.technique_type}
                            </span>
                            {technique.is_novel && (
                              <span className="badge bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                <Sparkles className="w-3 h-3" />
                                Novel
                              </span>
                            )}
                            <span className="text-xs text-surface-500">
                              {technique.paper_count} paper{technique.paper_count !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-surface-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </div>
                      <p className="text-sm text-surface-600 dark:text-surface-400 mt-3 line-clamp-2">
                        <MathText>{technique.description}</MathText>
                      </p>
                      {technique.formula && (
                        <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg overflow-x-auto">
                          <div className="text-surface-800 dark:text-surface-200">
                            <MathRenderer math={technique.formula} block />
                          </div>
                        </div>
                      )}
                      {technique.improves_upon && (
                        <p className="text-xs text-surface-500 mt-2">
                          Improves upon: <span className="font-medium text-surface-700 dark:text-surface-300">{technique.improves_upon}</span>
                        </p>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Trends Tab */}
            {activeTab === 'trends' && (
              <div className="space-y-3">
                {trends.length === 0 ? (
                  <EmptyState
                    icon={TrendingUp}
                    title="No Trends Yet"
                    description='Run "Find Patterns" to discover trends across your research corpus.'
                  />
                ) : (
                  trends.map((trend, index) => (
                    <div
                      key={trend.id}
                      className="p-4 bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 rounded-xl animate-fade-in-up"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <div className="flex items-start justify-between">
                        <h4 className="text-sm font-medium text-surface-900 dark:text-white">
                          {trend.name}
                        </h4>
                        <span className={`badge ${
                          trend.direction === 'increasing' ? 'badge-success' :
                          trend.direction === 'decreasing' ? 'badge-error' :
                          'badge-neutral'
                        }`}>
                          {trend.direction === 'increasing' && <TrendingUp className="w-3 h-3" />}
                          {trend.direction}
                        </span>
                      </div>
                      <p className="text-sm text-surface-600 dark:text-surface-400 mt-2">
                        {trend.description}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-surface-500">
                        <span>Velocity: {trend.velocity.toFixed(2)}</span>
                        <span>Confidence: {(trend.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Contradictions Tab */}
            {activeTab === 'contradictions' && (
              <div className="space-y-4">
                {contradictions.length === 0 ? (
                  <EmptyState
                    icon={AlertTriangle}
                    title="No Contradictions Found"
                    description='Run "Find Patterns" to detect conflicting claims in your research.'
                  />
                ) : (
                  contradictions.map((contradiction, idx) => (
                    <div
                      key={idx}
                      className="p-4 border-2 border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 rounded-xl animate-fade-in-up"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 bg-red-100 dark:bg-red-900/40 rounded-lg">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        </div>
                        <span className="text-sm font-medium text-red-700 dark:text-red-400">
                          Contradiction Detected
                        </span>
                        <span className="text-xs text-surface-500 ml-auto">
                          Strength: {(contradiction.strength * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div className="p-3 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
                          <p className="text-sm text-surface-700 dark:text-surface-300">
                            {contradiction.claim1.statement}
                          </p>
                        </div>
                        <div className="flex items-center justify-center">
                          <div className="flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/40 rounded-full">
                            <XCircle className="w-3 h-3 text-red-500" />
                            <span className="text-xs font-medium text-red-600 dark:text-red-400">conflicts with</span>
                          </div>
                        </div>
                        <div className="p-3 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
                          <p className="text-sm text-surface-700 dark:text-surface-300">
                            {contradiction.claim2.statement}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-surface-600 dark:text-surface-400 mt-4 italic">
                        {contradiction.explanation}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
