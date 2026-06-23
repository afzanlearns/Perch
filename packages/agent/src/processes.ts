import psList from "ps-list";
import pidusage from "pidusage";
import { safeExecFileSync, safeExecSync } from "./utils/spawn.js";
import { platform } from "os";
import { getStartedAt } from "./groups.js";

export interface ProcessInfo {
  pid: number;
  ppid?: number;
  name: string;
  memory: number | null;
  cpu: number | null;
  port: number | null;
  command: string;
  groupId?: string;
  serviceId?: string;
  cpuHistory: (number | null)[];
  memHistory: (number | null)[];
  uptimeMs: number | null;
  startedAt: number | null;
}

interface MetricPoint { ts: number; cpu: number | null; mem: number | null; }
const metricsHistory = new Map<number, MetricPoint[]>();
const HISTORY_SIZE = 20;

interface PortEntry {
  port: number;
  pid: number;
}

let portCache: PortEntry[] = [];
let lastPortCheck = 0;
const PORT_CACHE_TTL = 2000;

const COMMON_PORTS = [3000, 7777, 8080, 8000, 5432, 3306, 6379, 27017, 9090, 5000, 4000, 4173, 3001, 3002, 5174, 8081, 9000, 9229, 9230];

let groupAnnotations: Map<number, { groupId: string; serviceId: string }> = new Map();

export function setGroupAnnotations(annotations: Map<number, { groupId: string; serviceId: string }>) {
  groupAnnotations = annotations;
}

function getPortMap(): PortEntry[] {
  const now = Date.now();
  if (now - lastPortCheck < PORT_CACHE_TTL) {
    return portCache;
  }

  try {
    if (platform() === "win32") {
      const output = safeExecFileSync("netstat", ["-ano"], {
        encoding: "utf8",
        timeout: 3000,
        maxBuffer: 16 * 1024 * 1024,
      });
      const entries: PortEntry[] = [];
      const lines = output.split("\n");
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && (parts[1] || "").includes(":")) {
          const addrPart = parts[1];
          const colonIdx = addrPart.lastIndexOf(":");
          if (colonIdx > 0) {
            const port = parseInt(addrPart.slice(colonIdx + 1), 10);
            const pid = parseInt(parts[4], 10);
            if (!isNaN(port) && !isNaN(pid)) {
              const state = parts[3] || "";
              if (state === "LISTENING" || state === "ESTABLISHED") {
                entries.push({ port, pid });
              }
            }
          }
        }
      }
      portCache = entries;
    } else {
      const output = safeExecSync("lsof -i -P -n 2>/dev/null | awk 'NR>1{print $9, $2}'", {
        encoding: "utf8",
        timeout: 3000,
        windowsHide: true,
      });
      const entries: PortEntry[] = [];
      const lines = output.split("\n");
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const addrMatch = parts[0].match(/:(\d+)$/);
          if (addrMatch) {
            const port = parseInt(addrMatch[1], 10);
            const pid = parseInt(parts[1], 10);
            if (!isNaN(port) && !isNaN(pid)) {
              entries.push({ port, pid });
            }
          }
        }
      }
      portCache = entries;
    }
  } catch {
    portCache = [];
  }

  lastPortCheck = now;
  return portCache;
}

export async function getProcesses(): Promise<ProcessInfo[]> {
  const allProcesses = await psList();
  const portMap = getPortMap();

  const pidToPorts: Map<number, number[]> = new Map();
  for (const entry of portMap) {
    if (COMMON_PORTS.includes(entry.port) || (entry.port >= 3000 && entry.port <= 9999)) {
      const ports = pidToPorts.get(entry.pid) ?? [];
      if (!ports.includes(entry.port)) {
        ports.push(entry.port);
      }
      pidToPorts.set(entry.pid, ports);
    }
  }

  // ── Get CPU, memory, and elapsed time via pidusage ──────────────────
  const pids = allProcesses.map((p) => p.pid);
  let pidStats: Record<number, { cpu: number; memory: number; elapsed: number }> = {};
  try {
    const raw = await pidusage(pids, { maxage: 30000 });
    for (const [pid, stat] of Object.entries(raw)) {
      pidStats[Number(pid)] = {
        cpu: stat.cpu,
        memory: stat.memory,
        elapsed: stat.elapsed,
      };
    }
  } catch (err) {
    console.error("pidusage collection error:", err);
  }

  const results: ProcessInfo[] = [];
  const seen = new Set<number>();

  for (const proc of allProcesses) {
    if (seen.has(proc.pid)) continue;
    seen.add(proc.pid);

    const usageMetrics = pidStats[proc.pid];

    // cpu: pidusage returns a percentage (0-100), or undefined on failure
    const cpu = usageMetrics?.cpu ?? null;

    // memory: pidusage returns bytes; convert to MB
    const memoryBytes = usageMetrics?.memory ?? null;
    const memoryMB = memoryBytes !== null ? Math.round(memoryBytes / (1024 * 1024)) : null;

    // elapsed: pidusage returns ms since process start; derive startedAt
    const elapsedMs = usageMetrics?.elapsed ?? null;
    const derivedStartedAt = elapsedMs !== null && elapsedMs > 0
      ? Date.now() - elapsedMs
      : null;

    // Prefer Perch-managed startedAt, fall back to pidusage elapsed
    const managedStartedAt = getStartedAt(proc.pid);
    const startedAt = managedStartedAt ?? derivedStartedAt;

    // Update metrics history
    const history = metricsHistory.get(proc.pid) ?? [];
    history.push({ ts: Date.now(), cpu, mem: memoryMB });
    if (history.length > HISTORY_SIZE) history.shift();
    metricsHistory.set(proc.pid, history);

    const annotation = groupAnnotations.get(proc.pid);
    const ports = pidToPorts.get(proc.pid) ?? [];

    // If the process has multiple ports, create one entry per port
    if (ports.length > 1) {
      for (const port of ports) {
        results.push({
          pid: proc.pid,
          ppid: proc.ppid,
          name: proc.name || proc.cmd || "unknown",
          memory: memoryMB,
          cpu,
          port,
          command: proc.cmd || proc.name || "",
          cpuHistory: history.map((h) => h.cpu),
          memHistory: history.map((h) => h.mem),
          uptimeMs: startedAt !== null ? Date.now() - startedAt : null,
          startedAt,
          ...(annotation ? { groupId: annotation.groupId, serviceId: annotation.serviceId } : {}),
        });
      }
    } else {
      results.push({
        pid: proc.pid,
        ppid: proc.ppid,
        name: proc.name || proc.cmd || "unknown",
        memory: memoryMB,
        cpu,
        port: ports.length === 1 ? ports[0] : null,
        command: proc.cmd || proc.name || "",
        cpuHistory: history.map((h) => h.cpu),
        memHistory: history.map((h) => h.mem),
        uptimeMs: startedAt !== null ? Date.now() - startedAt : null,
        startedAt,
        ...(annotation ? { groupId: annotation.groupId, serviceId: annotation.serviceId } : {}),
      });
    }
  }

  results.sort((a, b) => {
    if (a.port !== null && b.port === null) return -1;
    if (a.port === null && b.port !== null) return 1;
    if (a.port !== null && b.port !== null) return a.port - b.port;
    return a.name.localeCompare(b.name);
  });

  return results;
}

export function getPortViolations(
  processes: ProcessInfo[],
  reservations: Record<number, string>
): Array<{ port: number; expectedLabel: string; actualPid: number; actualName: string }> {
  return Object.entries(reservations)
    .map(([portStr, label]) => {
      const port = Number(portStr);
      const occupant = processes.find((p) => p.port === port);
      if (!occupant) return null;
      const labelWords = label.toLowerCase().split(/\W+/);
      const nameMatch = labelWords.some((w) => w.length > 2 && occupant.name.toLowerCase().includes(w));
      if (nameMatch) return null;
      return { port, expectedLabel: label, actualPid: occupant.pid, actualName: occupant.name };
    })
    .filter(Boolean) as Array<{ port: number; expectedLabel: string; actualPid: number; actualName: string }>;
}
