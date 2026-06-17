import { useState, useEffect, useRef, useCallback } from "react";
import { sendWsMessage } from "../hooks/useWebSocket";
import type { GraphNode, GraphEdge } from "../types";

const API_BASE = "http://localhost:7777/api";

const NODE_W = 130;
const NODE_H = 42;

function layoutNodes(
  nodes: GraphNode[],
  edges: GraphEdge[],
  W: number,
  H: number
): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {};
  nodes.forEach((n, i) => {
    const angle = (i / Math.max(nodes.length, 1)) * 2 * Math.PI;
    pos[n.id] = {
      x: W / 2 + Math.cos(angle) * Math.min(W, H) * 0.32,
      y: H / 2 + Math.sin(angle) * Math.min(W, H) * 0.25,
    };
  });

  for (let iter = 0; iter < 40; iter++) {
    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = pos[nodes[i].id], b = pos[nodes[j].id];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 9000 / (dist * dist);
        pos[nodes[i].id].x -= (dx / dist) * force;
        pos[nodes[i].id].y -= (dy / dist) * force;
        pos[nodes[j].id].x += (dx / dist) * force;
        pos[nodes[j].id].y += (dy / dist) * force;
      }
    }
    // Attraction along edges
    for (const e of edges) {
      const a = pos[e.from], b = pos[e.to];
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 160) * 0.04;
      pos[e.from].x += (dx / dist) * force;
      pos[e.from].y += (dy / dist) * force;
      pos[e.to].x   -= (dx / dist) * force;
      pos[e.to].y   -= (dy / dist) * force;
    }
    // Clamp
    for (const n of nodes) {
      pos[n.id].x = Math.max(NODE_W / 2 + 8, Math.min(W - NODE_W / 2 - 8, pos[n.id].x));
      pos[n.id].y = Math.max(NODE_H / 2 + 8, Math.min(H - NODE_H / 2 - 8, pos[n.id].y));
    }
  }
  return pos;
}

export function DependencyGraph() {
  const [nodes, setNodes]         = useState<GraphNode[]>([]);
  const [edges, setEdges]         = useState<GraphEdge[]>([]);
  const [selected, setSelected]   = useState<GraphNode | null>(null);
  const [loading, setLoading]     = useState(true);
  const svgRef                    = useRef<SVGSVGElement>(null);
  const [dims, setDims]           = useState({ w: 800, h: 500 });

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) setDims({ w: e.contentRect.width, h: e.contentRect.height });
    });
    if (svgRef.current?.parentElement) obs.observe(svgRef.current.parentElement);
    return () => obs.disconnect();
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/graph`)
      .then((r) => r.json())
      .then((data) => { setNodes(data.nodes ?? []); setEdges(data.edges ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const pos = nodes.length > 0 ? layoutNodes(nodes, edges, dims.w, dims.h) : {};

  if (loading) {
    return (
      <div className="graph-empty">
        <span style={{ color: "var(--text-muted)" }}>Loading dependency graph…</span>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="graph-empty">
        <div className="empty-state__icon">⬡</div>
        <h3 className="empty-state__title">No service graph</h3>
        <p className="empty-state__description">
          Define groups and services in <span className="mono-value">perch.config.json</span> to see the dependency graph.
        </p>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={load}>↺ Refresh</button>
      </div>
    );
  }

  return (
    <div className="graph-container">
      <div className="graph-header">
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          {nodes.length} services · {edges.length} connections
        </span>
        <button className="btn btn-ghost btn-sm" onClick={load}>↺ Refresh</button>
      </div>

      <div className="graph-canvas-wrap">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="graph-svg"
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="8"
              refX="8"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L8,3 z" fill="var(--text-muted)" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map((edge, i) => {
            const a = pos[edge.from], b = pos[edge.to];
            if (!a || !b) return null;
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            // Shorten line to not overlap node rect
            const dx = b.x - a.x, dy = b.y - a.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const shorten = NODE_W / 2 + 4;
            const x1 = a.x + (dx / len) * shorten;
            const y1 = a.y + (dy / len) * (NODE_H / 2 + 4);
            const x2 = b.x - (dx / len) * shorten;
            const y2 = b.y - (dy / len) * (NODE_H / 2 + 4);
            return (
              <g key={i}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="var(--border)"
                  strokeWidth={1.5}
                  markerEnd="url(#arrowhead)"
                />
                <text
                  x={mx} y={my - 5}
                  fontSize={9}
                  fill="var(--text-muted)"
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                >
                  {edge.label}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const p = pos[node.id];
            if (!p) return null;
            const isSelected = selected?.id === node.id;
            return (
              <g
                key={node.id}
                transform={`translate(${p.x - NODE_W / 2}, ${p.y - NODE_H / 2})`}
                onClick={() => setSelected(isSelected ? null : node)}
                style={{ cursor: "pointer" }}
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  fill={isSelected ? "var(--accent-muted)" : "var(--surface)"}
                  stroke={isSelected ? "var(--accent)" : node.running ? "var(--success)" : "var(--border)"}
                  strokeWidth={isSelected ? 2 : 1}
                />
                {/* Running indicator strip */}
                {node.running && (
                  <rect width={3} height={NODE_H} fill="var(--success)" />
                )}
                <text
                  x={NODE_W / 2}
                  y={NODE_H / 2 - 5}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill="var(--text-primary)"
                  fontFamily="var(--font-sans)"
                >
                  {node.name.length > 14 ? node.name.slice(0, 13) + "…" : node.name}
                </text>
                {node.port && (
                  <text
                    x={NODE_W / 2}
                    y={NODE_H / 2 + 9}
                    textAnchor="middle"
                    fontSize={9}
                    fill="var(--accent)"
                    fontFamily="var(--font-mono)"
                  >
                    :{node.port}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Side panel for selected node */}
        {selected && (
          <div className="graph-side-panel">
            <div className="graph-side-header">
              <span className="graph-side-name">{selected.name}</span>
              <button className="crash-card__close" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="graph-side-body">
              <div className="graph-detail-row">
                <span className="graph-detail-label">Group</span>
                <span className="graph-detail-value">{selected.group}</span>
              </div>
              {selected.port && (
                <div className="graph-detail-row">
                  <span className="graph-detail-label">Port</span>
                  <span className="mono-value">:{selected.port}</span>
                </div>
              )}
              <div className="graph-detail-row">
                <span className="graph-detail-label">Status</span>
                <span style={{ color: selected.running ? "var(--success)" : "var(--text-muted)" }}>
                  {selected.running ? "● Running" : "○ Stopped"}
                </span>
              </div>
            </div>
            <div className="graph-side-actions">
              {selected.running ? (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => sendWsMessage({ type: "killService", serviceId: selected.id, groupId: "" })}
                >
                  Stop
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => sendWsMessage({ type: "startService", serviceId: selected.id, groupId: "" })}
                >
                  Start
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
