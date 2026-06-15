import { getConfig } from "./config.js";

export interface GraphNode {
  id: string;
  name: string;
  port: number | null;
  group: string;
  running: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
}

export function buildDependencyGraph(
  runningIds: Set<string>
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const config = getConfig();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const portToService = new Map<number, string>();

  for (const group of config.groups) {
    for (const svc of group.services) {
      nodes.push({
        id: svc.id,
        name: svc.name,
        port: svc.expectedPort ?? null,
        group: group.name,
        running: runningIds.has(svc.id),
      });
      if (svc.expectedPort) portToService.set(svc.expectedPort, svc.id);
    }
  }

  // Detect edges from env vars and healthCheckPath port references
  for (const group of config.groups) {
    for (const svc of group.services) {
      for (const val of Object.values(svc.env ?? {})) {
        const portMatch = val.match(/(\d{4,5})/);
        if (portMatch) {
          const port = Number(portMatch[1]);
          const target = portToService.get(port);
          if (target && target !== svc.id) {
            edges.push({ from: svc.id, to: target, label: `env→:${port}` });
          }
        }
      }
      if (svc.healthCheckPath) {
        const match = svc.healthCheckPath.match(/:(\d{4,5})/);
        if (match) {
          const port = Number(match[1]);
          const target = portToService.get(port);
          if (target && target !== svc.id) {
            edges.push({ from: svc.id, to: target, label: `health→:${port}` });
          }
        }
      }
    }
  }

  return { nodes, edges: dedupEdges(edges) };
}

function dedupEdges(edges: GraphEdge[]): GraphEdge[] {
  const seen = new Set<string>();
  return edges.filter((e) => {
    const key = `${e.from}→${e.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
