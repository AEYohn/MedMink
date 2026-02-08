'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Loader2 } from 'lucide-react';
import { ProjectGraph, ProjectGraphNode, ProjectGraphEdge } from '@/lib/api';

interface SolutionGraphProps {
  graph: ProjectGraph;
}

const nodeColors: Record<string, string> = {
  project: '#3b82f6',    // blue
  problem: '#ef4444',    // red
  approach: '#10b981',   // green
  paper: '#8b5cf6',      // purple
  method: '#f59e0b',     // amber
  claim: '#06b6d4',      // cyan
};

const nodeRadii: Record<string, number> = {
  project: 20,
  problem: 10,
  approach: 14,
  paper: 8,
  method: 8,
  claim: 6,
};

const edgeColors: Record<string, string> = {
  HAS_PROBLEM: '#ef4444',
  HAS_APPROACH: '#10b981',
  ADDRESSED_BY: '#8b5cf6',
  USES_TECHNIQUE: '#f59e0b',
  BASED_ON_CLAIM: '#06b6d4',
};

interface D3Node extends ProjectGraphNode {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface D3Edge extends Omit<ProjectGraphEdge, 'source' | 'target'> {
  source: D3Node | string;
  target: D3Node | string;
}

export function SolutionGraph({ graph }: SolutionGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<ProjectGraphNode | null>(null);

  useEffect(() => {
    if (!svgRef.current || graph.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const g = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Prepare nodes and edges for D3
    const nodes: D3Node[] = graph.nodes.map((n) => ({ ...n }));
    const edges: D3Edge[] = graph.edges.map((e) => ({ ...e }));

    // Create simulation
    const simulation = d3.forceSimulation(nodes)
      .force(
        'link',
        d3.forceLink<D3Node, D3Edge>(edges)
          .id((d) => d.id)
          .distance((d) => {
            // Different distances based on relationship type
            const relType = d.type;
            if (relType === 'HAS_PROBLEM' || relType === 'HAS_APPROACH') return 100;
            return 150;
          })
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => nodeRadii[d.type] + 10));

    // Draw edges
    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', (d) => edgeColors[d.type] || '#94a3b8')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d) => (d.relevance ? d.relevance * 3 + 1 : 2));

    // Draw edge labels
    const linkLabel = g
      .append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(edges)
      .join('text')
      .attr('font-size', '8px')
      .attr('fill', '#94a3b8')
      .text((d) => d.type.replace(/_/g, ' '));

    // Draw nodes
    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(
        d3.drag<SVGGElement, D3Node>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }) as any
      );

    // Node circles
    node
      .append('circle')
      .attr('r', (d) => nodeRadii[d.type] || 8)
      .attr('fill', (d) => nodeColors[d.type] || '#94a3b8')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        setSelectedNode(d);
      });

    // Node labels
    node
      .append('text')
      .attr('dx', (d) => (nodeRadii[d.type] || 8) + 4)
      .attr('dy', 4)
      .attr('font-size', '10px')
      .attr('fill', '#64748b')
      .text((d) => d.label.length > 20 ? d.label.slice(0, 20) + '...' : d.label);

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkLabel
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // Initial zoom to fit
    setTimeout(() => {
      const bounds = g.node()?.getBBox();
      if (bounds) {
        const scale = Math.min(
          width / (bounds.width + 100),
          height / (bounds.height + 100),
          1
        );
        const translateX = width / 2 - (bounds.x + bounds.width / 2) * scale;
        const translateY = height / 2 - (bounds.y + bounds.height / 2) * scale;

        svg.call(
          zoom.transform,
          d3.zoomIdentity.translate(translateX, translateY).scale(scale)
        );
      }
    }, 1000);

    return () => {
      simulation.stop();
    };
  }, [graph]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Solution Knowledge Graph
        </h2>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          {Object.entries(nodeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-slate-600 dark:text-slate-400 capitalize">
                {type}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative h-[500px] bg-slate-50 dark:bg-slate-900/50 rounded-lg overflow-hidden">
        {graph.nodes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-slate-500 dark:text-slate-400">
              No graph data available
            </p>
          </div>
        ) : (
          <svg ref={svgRef} className="w-full h-full" />
        )}
      </div>

      {/* Node Details Panel */}
      {selectedNode && (
        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: nodeColors[selectedNode.type] }}
              />
              <span className="font-medium text-slate-900 dark:text-white capitalize">
                {selectedNode.type}
              </span>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              &times;
            </button>
          </div>

          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            {selectedNode.label}
          </h3>

          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            {selectedNode.data.description && (
              <p>{selectedNode.data.description}</p>
            )}
            {selectedNode.data.statement && (
              <p>{selectedNode.data.statement}</p>
            )}
            {selectedNode.data.abstract && (
              <p className="line-clamp-3">{selectedNode.data.abstract}</p>
            )}
            {selectedNode.data.confidence && (
              <p>
                <strong>Confidence:</strong>{' '}
                {(selectedNode.data.confidence * 100).toFixed(0)}%
              </p>
            )}
            {selectedNode.data.relevance && (
              <p>
                <strong>Relevance:</strong>{' '}
                {(selectedNode.data.relevance * 100).toFixed(0)}%
              </p>
            )}
          </div>
        </div>
      )}

      {/* Edge Type Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        <span className="text-slate-500 dark:text-slate-400">Relationships:</span>
        {Object.entries(edgeColors).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1">
            <div
              className="w-4 h-0.5"
              style={{ backgroundColor: color }}
            />
            <span className="text-slate-600 dark:text-slate-400">
              {type.replace(/_/g, ' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
