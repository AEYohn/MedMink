'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as d3 from 'd3';
import { Loader2, X, ExternalLink, FileText, ArrowRight, Network, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { api, Paper, Claim } from '@/lib/api';

interface Node {
  id: string;
  label: string;
  fullLabel: string;
  type: 'paper' | 'claim' | 'method' | 'trend' | 'technique';
  value?: number;
  arxivId?: string;
  abstract?: string;
  authors?: string[];
  categories?: string[];
  confidence?: number;
  statement?: string;
  formula?: string;
  techniqueType?: string;
}

interface Link {
  source: string;
  target: string;
  type: string;
}

interface SelectedNode extends Node {
  x?: number;
  y?: number;
}

const nodeColors = {
  paper: '#6366f1',
  claim: '#a855f7',
  method: '#10b981',
  trend: '#f59e0b',
  technique: '#06b6d4',
};

const nodeRadii = {
  paper: 10,
  claim: 7,
  method: 8,
  trend: 12,
  technique: 9,
};

export function GraphVisualization() {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [graphData, setGraphData] = useState<{ nodes: Node[]; links: Link[] }>({
    nodes: [],
    links: [],
  });

  useEffect(() => {
    async function fetchGraphData() {
      try {
        const [papers, claims, trends, methods, techniques] = await Promise.all([
          api.getPapers(20),
          api.getClaims(50),
          api.getTrends(10),
          api.getMethods(15),
          api.getTechniques(30),
        ]);

        const nodes: Node[] = [];
        const links: Link[] = [];

        papers.forEach((p) => {
          nodes.push({
            id: p.id,
            label: p.title.slice(0, 30) + (p.title.length > 30 ? '...' : ''),
            fullLabel: p.title,
            type: 'paper',
            arxivId: p.arxiv_id,
            abstract: p.abstract,
            authors: p.authors,
            categories: p.categories,
          });
        });

        claims.forEach((c) => {
          nodes.push({
            id: c.id,
            label: c.statement.slice(0, 30) + (c.statement.length > 30 ? '...' : ''),
            fullLabel: c.statement,
            type: 'claim',
            value: c.confidence,
            confidence: c.confidence,
            statement: c.statement,
          });
          if (papers.find((p) => p.id === c.paper_id)) {
            links.push({ source: c.paper_id, target: c.id, type: 'contains' });
          }
        });

        trends.forEach((t) => {
          nodes.push({
            id: t.id,
            label: t.name,
            fullLabel: t.name + ': ' + t.description,
            type: 'trend',
            value: t.velocity,
          });
        });

        methods.forEach((m) => {
          nodes.push({
            id: m.id,
            label: m.name,
            fullLabel: m.name,
            type: 'method',
            value: m.paper_count,
          });
        });

        techniques.forEach((t) => {
          nodes.push({
            id: t.id,
            label: t.name.slice(0, 30) + (t.name.length > 30 ? '...' : ''),
            fullLabel: t.name,
            type: 'technique',
            formula: t.formula || undefined,
            techniqueType: t.technique_type,
          });
        });

        setGraphData({ nodes, links });
      } catch (error) {
        console.error('Failed to fetch graph data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchGraphData();
  }, []);

  useEffect(() => {
    if (!svgRef.current || loading || graphData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Add gradient definitions
    const defs = svg.append('defs');

    // Create gradients for each node type
    Object.entries(nodeColors).forEach(([type, color]) => {
      const gradient = defs.append('radialGradient')
        .attr('id', `gradient-${type}`)
        .attr('cx', '30%')
        .attr('cy', '30%');

      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', d3.color(color)?.brighter(0.5)?.toString() || color);

      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', color);
    });

    // Add glow filter
    const filter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');

    filter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');

    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    const simulation = d3.forceSimulation(graphData.nodes as any)
      .force('link', d3.forceLink(graphData.links).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(25));

    // Draw links with gradient
    const link = g.append('g')
      .selectAll('line')
      .data(graphData.links)
      .join('line')
      .attr('stroke', 'url(#link-gradient)')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1.5);

    const nodeGroup = g.append('g')
      .selectAll('g')
      .data(graphData.nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .on('click', (event, d: any) => {
        event.stopPropagation();
        setSelectedNode({ ...d });
      })
      .call(d3.drag<SVGGElement, Node>()
        .on('start', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }) as any);

    // Add outer glow circle
    nodeGroup.append('circle')
      .attr('r', (d) => nodeRadii[d.type] + 4)
      .attr('fill', 'none')
      .attr('stroke', (d) => nodeColors[d.type])
      .attr('stroke-opacity', 0)
      .attr('stroke-width', 6)
      .attr('class', 'glow-circle');

    // Add main circles with gradient
    nodeGroup.append('circle')
      .attr('r', (d) => nodeRadii[d.type])
      .attr('fill', (d) => `url(#gradient-${d.type})`)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('filter', 'url(#glow)')
      .on('mouseenter', function(event, d) {
        d3.select(this.parentNode as Element).select('.glow-circle')
          .transition()
          .duration(200)
          .attr('stroke-opacity', 0.3);
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', nodeRadii[d.type] + 2);
      })
      .on('mouseleave', function(event, d) {
        d3.select(this.parentNode as Element).select('.glow-circle')
          .transition()
          .duration(200)
          .attr('stroke-opacity', 0);
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', nodeRadii[d.type]);
      });

    // Add labels with better styling
    nodeGroup.append('text')
      .text((d) => d.label)
      .attr('x', (d) => nodeRadii[d.type] + 6)
      .attr('y', 4)
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .attr('fill', '#64748b')
      .attr('pointer-events', 'none');

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodeGroup
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    svg.on('click', () => setSelectedNode(null));

    return () => {
      simulation.stop();
    };
  }, [graphData, loading]);

  const getArxivUrl = (arxivId: string) => `https://arxiv.org/abs/${arxivId}`;
  const getArxivPdfUrl = (arxivId: string) => `https://arxiv.org/pdf/${arxivId}.pdf`;

  return (
    <div className="card overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-brand-500 to-accent-500 rounded-xl">
            <Network className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-surface-900 dark:text-white">
              Knowledge Graph
            </h2>
            <p className="text-xs text-surface-500">
              {graphData.nodes.length} nodes • Click to explore
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="hidden lg:flex items-center gap-4 text-xs">
          {Object.entries(nodeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full shadow-sm"
                style={{ backgroundColor: color }}
              />
              <span className="text-surface-600 dark:text-surface-400 capitalize">{type}s</span>
            </div>
          ))}
        </div>
      </div>

      {/* Graph Container */}
      <div className="relative h-[450px] bg-gradient-to-br from-surface-50 to-surface-100 dark:from-surface-900 dark:to-surface-800 overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="p-4 bg-white dark:bg-surface-800 rounded-2xl shadow-lg mb-4">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            </div>
            <p className="text-sm text-surface-500">Loading knowledge graph...</p>
          </div>
        ) : graphData.nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="p-4 bg-surface-100 dark:bg-surface-800 rounded-2xl mb-4">
              <Network className="w-12 h-12 text-surface-400" />
            </div>
            <p className="text-surface-500 dark:text-surface-400 font-medium">
              No graph data available
            </p>
            <p className="text-xs text-surface-400 mt-1">
              Ingest some papers to see the knowledge graph
            </p>
          </div>
        ) : (
          <>
            <svg ref={svgRef} className="w-full h-full" />

            {/* Detail Panel */}
            {selectedNode && (
              <div className="absolute top-3 right-3 w-80 max-h-[calc(100%-1.5rem)] bg-white dark:bg-surface-800 rounded-xl shadow-xl border border-surface-200 dark:border-surface-700 overflow-hidden animate-scale-in">
                {/* Panel Header */}
                <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between bg-surface-50 dark:bg-surface-900/50">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: nodeColors[selectedNode.type] }}
                    />
                    <span className="text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase tracking-wide">
                      {selectedNode.type}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="p-1.5 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Panel Content */}
                <div className="p-4 overflow-y-auto max-h-80 space-y-4">
                  <h3 className="font-semibold text-surface-900 dark:text-white text-sm leading-snug">
                    {selectedNode.fullLabel}
                  </h3>

                  {selectedNode.type === 'paper' && (
                    <>
                      {selectedNode.authors && selectedNode.authors.length > 0 && (
                        <p className="text-xs text-surface-500 dark:text-surface-400">
                          {selectedNode.authors.slice(0, 3).join(', ')}
                          {selectedNode.authors.length > 3 && ` +${selectedNode.authors.length - 3} more`}
                        </p>
                      )}

                      {selectedNode.categories && selectedNode.categories.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedNode.categories.map((cat) => (
                            <span
                              key={cat}
                              className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md font-medium"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}

                      {selectedNode.abstract && (
                        <p className="text-xs text-surface-600 dark:text-surface-300 line-clamp-4 leading-relaxed">
                          {selectedNode.abstract}
                        </p>
                      )}

                      {selectedNode.arxivId && (
                        <div className="flex flex-col gap-2 pt-2">
                          <a
                            href={getArxivUrl(selectedNode.arxivId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 px-3 py-2.5 bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200 rounded-lg text-xs font-medium hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                            View on arXiv
                          </a>
                          <a
                            href={getArxivPdfUrl(selectedNode.arxivId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 px-3 py-2.5 bg-brand-500 text-white rounded-lg text-xs font-medium hover:bg-brand-600 transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            Open PDF
                          </a>
                        </div>
                      )}
                    </>
                  )}

                  {selectedNode.type === 'claim' && (
                    <>
                      <p className="text-xs text-surface-600 dark:text-surface-300 leading-relaxed">
                        {selectedNode.statement}
                      </p>
                      {selectedNode.confidence !== undefined && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-surface-500">Confidence</span>
                            <span className="text-xs font-semibold text-surface-700 dark:text-surface-300">
                              {Math.round(selectedNode.confidence * 100)}%
                            </span>
                          </div>
                          <div className="h-2 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all"
                              style={{ width: `${selectedNode.confidence * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {selectedNode.type === 'trend' && (
                    <p className="text-xs text-surface-600 dark:text-surface-300 leading-relaxed">
                      {selectedNode.fullLabel}
                    </p>
                  )}

                  {selectedNode.type === 'method' && (
                    <p className="text-xs text-surface-600 dark:text-surface-300">
                      Used in <span className="font-semibold">{selectedNode.value || 0}</span> papers
                    </p>
                  )}

                  {selectedNode.type === 'technique' && (
                    <>
                      {selectedNode.techniqueType && (
                        <span className="inline-block px-2 py-0.5 text-xs bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 rounded-md font-medium">
                          {selectedNode.techniqueType}
                        </span>
                      )}
                      {selectedNode.formula && (
                        <div className="p-3 bg-surface-100 dark:bg-surface-900 rounded-lg text-xs font-mono text-surface-700 dark:text-surface-300 overflow-x-auto">
                          {selectedNode.formula.slice(0, 100)}...
                        </div>
                      )}
                    </>
                  )}

                  {/* Navigation Button */}
                  <button
                    onClick={() => router.push(`/${selectedNode.type}/${selectedNode.id}`)}
                    className="flex items-center justify-center gap-2 w-full px-3 py-2.5 mt-2 text-white rounded-lg text-xs font-medium transition-colors"
                    style={{ backgroundColor: nodeColors[selectedNode.type] }}
                  >
                    <ArrowRight className="w-4 h-4" />
                    View Full Details
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
