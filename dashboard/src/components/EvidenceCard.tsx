'use client';

import { useState } from 'react';
import {
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Users,
  Calendar,
  BookOpen,
  Beaker,
} from 'lucide-react';
import { GradeBadge } from './GradeIndicator';

interface Finding {
  finding: string;
  effect_size?: string;
  citation: string;
  confidence: number;
}

interface Paper {
  pmid?: string;
  doi?: string;
  title: string;
  abstract: string;
  year?: string | number;
  authors?: string[];
  source?: string;
}

interface EvidenceCardProps {
  synthesis: string;
  evidenceGrade: string;
  keyFindings: Finding[];
  papers: Paper[];
  recommendation: string;
  recommendationStrength: string;
  limitations: string[];
}

export function EvidenceCard({
  synthesis,
  evidenceGrade,
  keyFindings,
  papers,
  recommendation,
  recommendationStrength,
  limitations,
}: EvidenceCardProps) {
  const [showPapers, setShowPapers] = useState(false);
  const [expandedPaper, setExpandedPaper] = useState<string | null>(null);

  const strengthColors = {
    strong: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    conditional: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    none: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400',
  };

  const getPaperUrl = (paper: Paper) => {
    if (paper.pmid) {
      return `https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`;
    }
    if (paper.doi) {
      return `https://doi.org/${paper.doi}`;
    }
    return null;
  };

  return (
    <div className="card overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl">
              <Beaker className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-surface-900 dark:text-white">Evidence Synthesis</h2>
              <p className="text-xs text-surface-500">{papers.length} papers analyzed</p>
            </div>
          </div>
          <GradeBadge grade={evidenceGrade} />
        </div>
      </div>

      {/* Synthesis */}
      <div className="p-5 border-b border-surface-200 dark:border-surface-700">
        <p className="text-surface-700 dark:text-surface-300 leading-relaxed">{synthesis}</p>
      </div>

      {/* Key Findings */}
      {keyFindings.length > 0 && (
        <div className="p-5 border-b border-surface-200 dark:border-surface-700">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-3">
            Key Findings
          </h3>
          <ul className="space-y-3">
            {keyFindings.map((finding, index) => (
              <li
                key={index}
                className="flex items-start gap-3 p-3 bg-surface-50 dark:bg-surface-800/50 rounded-lg"
              >
                <div className="w-6 h-6 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-xs font-bold flex-shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-900 dark:text-white">{finding.finding}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    {finding.effect_size && (
                      <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded">
                        {finding.effect_size}
                      </span>
                    )}
                    <span className="text-xs text-surface-500">{finding.citation}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-12 h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${finding.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-surface-500 tabular-nums">
                    {(finding.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Clinical Recommendation */}
      <div className="p-5 border-b border-surface-200 dark:border-surface-700 bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-900/10 dark:to-cyan-900/10">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg flex-shrink-0">
            <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-surface-900 dark:text-white">
                Clinical Recommendation
              </h3>
              <span
                className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                  strengthColors[recommendationStrength as keyof typeof strengthColors] ||
                  strengthColors.none
                }`}
              >
                {recommendationStrength.charAt(0).toUpperCase() + recommendationStrength.slice(1)}
              </span>
            </div>
            <p className="text-sm text-surface-700 dark:text-surface-300">{recommendation}</p>
          </div>
        </div>
      </div>

      {/* Limitations */}
      {limitations.length > 0 && (
        <div className="p-5 border-b border-surface-200 dark:border-surface-700">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-2">
            Limitations
          </h3>
          <ul className="space-y-1">
            {limitations.map((limitation, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-surface-600 dark:text-surface-400">
                <span className="text-amber-500 mt-0.5">•</span>
                {limitation}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Source Papers */}
      <div className="p-5">
        <button
          onClick={() => setShowPapers(!showPapers)}
          className="flex items-center justify-between w-full text-sm font-semibold text-surface-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
        >
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Source Papers ({papers.length})
          </span>
          {showPapers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showPapers && (
          <div className="mt-4 space-y-3">
            {papers.map((paper, index) => {
              const paperId = paper.pmid || paper.doi || `paper-${index}`;
              const isExpanded = expandedPaper === paperId;
              const paperUrl = getPaperUrl(paper);

              return (
                <div
                  key={paperId}
                  className="p-4 bg-surface-50 dark:bg-surface-800/50 rounded-xl border border-surface-200 dark:border-surface-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-surface-900 dark:text-white line-clamp-2">
                        {paper.title}
                      </h4>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-surface-500">
                        {paper.authors && paper.authors.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {paper.authors.slice(0, 3).join(', ')}
                            {paper.authors.length > 3 && ` +${paper.authors.length - 3}`}
                          </span>
                        )}
                        {paper.year && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {paper.year}
                          </span>
                        )}
                        {paper.source && (
                          <span className="px-1.5 py-0.5 bg-surface-200 dark:bg-surface-700 rounded text-xs">
                            {paper.source}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {paperUrl && (
                        <a
                          href={paperUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-surface-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => setExpandedPaper(isExpanded ? null : paperId)}
                        className="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {isExpanded && paper.abstract && (
                    <div className="mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
                      <p className="text-xs text-surface-600 dark:text-surface-400 leading-relaxed">
                        {paper.abstract}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
