import { createConnection, Socket } from "net";
import type { ProcessInfo } from "./processes.js";

export type HealthStatus = "healthy" | "unhealthy" | "unreachable" | "no-port";

interface HealthResult {
  pid: number;
  status: HealthStatus;
  checkedAt: number;
}

let healthCache: Map<number, HealthResult> = new Map();
let lastHealthRun = 0;
const HEALTH_CACHE_TTL = 5000;

async function checkPort(port: number, timeout = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new Socket();
    let resolved = false;

    const done = (result: boolean) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
        socket.destroy();
      }
    };

    socket.setTimeout(timeout);
    socket.on("connect", () => done(true));
    socket.on("error", () => done(false));
    socket.on("timeout", () => done(false));

    socket.connect(port, "127.0.0.1");
  });
}

export async function checkHealth(processes: ProcessInfo[]): Promise<HealthResult[]> {
  const now = Date.now();
  if (now - lastHealthRun < HEALTH_CACHE_TTL) {
    return Array.from(healthCache.values());
  }

  const results: HealthResult[] = [];

  for (const proc of processes) {
    if (proc.port === null) {
      results.push({ pid: proc.pid, status: "no-port", checkedAt: now });
      continue;
    }

    let status: HealthStatus;
    const reachable = await checkPort(proc.port);
    if (reachable) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const resp = await fetch(`http://127.0.0.1:${proc.port}/health`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        status = resp.ok ? "healthy" : "unhealthy";
      } catch {
        status = "healthy";
      }
    } else {
      status = "unreachable";
    }

    results.push({ pid: proc.pid, status, checkedAt: now });
  }

  healthCache = new Map(results.map((r) => [r.pid, r]));
  lastHealthRun = now;
  return results;
}
