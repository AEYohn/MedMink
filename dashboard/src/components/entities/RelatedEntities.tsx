'use client';

import { useState, useEffect } from 'react';
import { Loader2, FileText, Sparkles, ChevronRight } from 'lucide-react';
import { EntityLink, EntityType } from '@/components/shared/EntityLink';
import { api, SimilarPaper } from '@/lib/api';

interface RelatedEntitiesProps {
  entityType: EntityType;
  entityId: string;
  limit?: number;
}

export function RelatedEntities({ entityType, entityId, limit = 5 }: RelatedEntitiesProps) {
  const [loading, setLoading] = useState(false);
  const [similarPapers, setSimilarPapers] = useState<SimilarPaper[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (entityType !== 'paper') return;

    const fetchSimilar = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.findSimilarPapers(entityId, limit);
        setSimilarPapers(result.similar_papers);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load similar papers');
      } finally {
        setLoading(false);
      }
    };

    fetchSimilar();
  }, [entityType, entityId, limit]);

  if (entityType !== 'paper') {
    return null;
  }

  if (loading) {
    return (
      <div className="card overflow-hidden animate-fade-in">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-200 dark:border-surface-700">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-surface-900 dark:text-white">Similar Papers</h2>
            <p className="text-xs text-surface-500">Finding related research...</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            <p className="text-sm text-surface-500">Loading similar papers...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card overflow-hidden animate-fade-in">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-200 dark:border-surface-700">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <h2 className="font-semibold text-surface-900 dark:text-white">Similar Papers</h2>
        </div>
        <div className="p-6 text-center">
          <p className="text-sm text-surface-500 dark:text-surface-400">
            Could not load similar papers.
          </p>
        </div>
      </div>
    );
  }

  if (similarPapers.length === 0) {
    return (
      <div className="card overflow-hidden animate-fade-in">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-200 dark:border-surface-700">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <h2 className="font-semibold text-surface-900 dark:text-white">Similar Papers</h2>
        </div>
        <div className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-surface-100 dark:bg-surface-800 rounded-2xl flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-surface-400" />
          </div>
          <p className="text-sm font-medium text-surface-500 dark:text-surface-400">
            No similar papers found
          </p>
          <p className="text-xs text-surface-400 mt-1">
            Analyze more papers to improve recommendations
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-surface-900 dark:text-white">Similar Papers</h2>
            <p className="text-xs text-surface-500">{similarPapers.length} related papers found</p>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-2">
        {similarPapers.map((paper, index) => (
          <EntityLink
            key={paper.paper_id}
            type="paper"
            id={paper.paper_id}
            title={paper.title}
          >
            <div
              className="p-4 bg-surface-50 dark:bg-surface-900 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 border border-surface-200 dark:border-surface-700 hover:border-blue-300 dark:hover:border-blue-700 transition-all group animate-fade-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-700 dark:text-surface-300 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {paper.title}
                  </p>
                  {paper.abstract_preview && (
                    <p className="text-xs text-surface-500 dark:text-surface-400 line-clamp-2 mt-2">
                      {paper.abstract_preview}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="px-2.5 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full tabular-nums">
                    {Math.round(paper.similarity * 100)}%
                  </span>
                  <ChevronRight className="w-4 h-4 text-surface-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>
          </EntityLink>
        ))}
      </div>
    </div>
  );
}
