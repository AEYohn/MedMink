'use client';

import { useMemo } from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { TreatmentOption } from '@/types/case';

interface ReferencesPanelProps {
  papersReviewed: Array<{ pmid: string; title: string; year?: string }>;
  treatmentOptions: TreatmentOption[];
}

interface DeduplicatedPaper {
  pmid: string;
  title: string;
  year?: string;
  citedBy: string[];
  keyFindings: string[];
}

export function ReferencesPanel({ papersReviewed, treatmentOptions }: ReferencesPanelProps) {
  const papers = useMemo(() => {
    const map = new Map<string, DeduplicatedPaper>();

    // Seed from papers_reviewed
    for (const p of papersReviewed) {
      if (!p.pmid) continue;
      map.set(p.pmid, {
        pmid: p.pmid,
        title: p.title,
        year: p.year,
        citedBy: [],
        keyFindings: [],
      });
    }

    // Merge papers_used + key_evidence from each treatment
    for (const t of treatmentOptions) {
      for (const pu of t.papers_used || []) {
        if (!pu.pmid) continue;
        const existing = map.get(pu.pmid);
        if (existing) {
          if (!existing.citedBy.includes(t.name)) existing.citedBy.push(t.name);
          if (!existing.title && pu.title) existing.title = pu.title;
        } else {
          map.set(pu.pmid, {
            pmid: pu.pmid,
            title: pu.title,
            citedBy: [t.name],
            keyFindings: [],
          });
        }
      }

      for (const ev of t.key_evidence || []) {
        if (!ev.pmid) continue;
        const existing = map.get(ev.pmid);
        if (existing) {
          if (!existing.citedBy.includes(t.name)) existing.citedBy.push(t.name);
          if (ev.finding && !existing.keyFindings.includes(ev.finding)) {
            existing.keyFindings.push(ev.finding);
          }
          if (ev.year && !existing.year) existing.year = ev.year;
          if (ev.title && !existing.title) existing.title = ev.title;
        } else {
          map.set(ev.pmid, {
            pmid: ev.pmid,
            title: ev.title || '',
            year: ev.year,
            citedBy: [t.name],
            keyFindings: ev.finding ? [ev.finding] : [],
          });
        }
      }
    }

    // Sort: papers with key findings first, then by year descending
    return Array.from(map.values()).sort((a, b) => {
      if (a.keyFindings.length > 0 && b.keyFindings.length === 0) return -1;
      if (a.keyFindings.length === 0 && b.keyFindings.length > 0) return 1;
      const yearA = parseInt(a.year || '0');
      const yearB = parseInt(b.year || '0');
      return yearB - yearA;
    });
  }, [papersReviewed, treatmentOptions]);

  if (papers.length === 0) return null;

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">References ({papers.length} papers)</h3>
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {papers.map((paper) => (
            <div
              key={paper.pmid}
              className="p-2.5 bg-muted/30 rounded-lg border border-border/50 text-xs"
            >
              <div className="flex items-start gap-2">
                <FileText className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    {/^\d{7,9}$/.test(paper.pmid) ? (
                      <a
                        href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
                      >
                        PMID: {paper.pmid}
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ) : (
                      <span className="font-medium text-muted-foreground">
                        PMID: {paper.pmid}
                      </span>
                    )}
                    {paper.year && (
                      <span className="text-muted-foreground">({paper.year})</span>
                    )}
                  </div>

                  {paper.title && (
                    <p className="font-medium text-foreground mb-1">{paper.title}</p>
                  )}

                  {paper.citedBy.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {paper.citedBy.map((name) => (
                        <Badge
                          key={name}
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {paper.keyFindings.map((finding, i) => (
                    <p
                      key={i}
                      className="text-muted-foreground italic mt-1"
                    >
                      &ldquo;{finding}&rdquo;
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
