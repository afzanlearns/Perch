import { Router } from "express";
import { readFileSync, writeFileSync } from "fs";
import type { ProcessInfo } from "./processes.js";
import type { EnvVars } from "./env.js";
import type { HealthStatus } from "./health.js";
import type { LogLine } from "./logs.js";
import { swapPort } from "./portSwap.js";
import { getConfigFilePath, reloadConfig, validateConfig, getConfig } from "./config.js";
import { buildDependencyGraph } from "./graph.js";
import { getRunningServiceIds } from "./groups.js";

export function createApiRouter(
  getProcessesData: () => ProcessInfo[],
  getEnvData: () => EnvVars,
  getHealthData: () => Map<number, { pid: number; status: HealthStatus; checkedAt: number }>,
  getLogsFn: (pid: number, count?: number) => LogLine[],
  killFn: (pid: number) => Promise<{ success: boolean; pid: number; action: string; message: string }>,
  restartFn: (pid: number, command: string, cwd?: string) => Promise<{ success: boolean; pid: number; action: string; message: string }>,
  signalFn: (pid: number, signal: string) => Promise<{ success: boolean; pid: number; action: string; message: string }>,
  getCommandFn: (pid: number) => string,
  getConfigFn: () => object,
  getGroupDataFn: () => { groups: any[]; favorites: string[] },
  startGroupFn: (groupId: string) => Promise<{ serviceId: string; pid: number | null }[]>,
  killGroupFn: (groupId: string) => Promise<boolean>,
  startServiceFn: (serviceId: string, groupId: string) => Promise<number | null>,
  startTime: number
): Router {
  const router = Router();

  // ── Process endpoints ──────────────────────────────────────────────

  router.get("/processes", (_req, res) => {
    res.json({ processes: getProcessesData() });
  });

  router.get("/env", (_req, res) => {
    res.json({ env: getEnvData() });
  });

  router.get("/status", (_req, res) => {
    const uptime = Date.now() - startTime;
    res.json({
      status: "ok",
      uptime,
      uptimeFormatted: formatUptime(uptime),
      processCount: getProcessesData().length,
    });
  });

  router.get("/health", (_req, res) => {
    res.json({ health: Array.from(getHealthData().values()) });
  });

  router.get("/logs/:pid", (req, res) => {
    const pid = parseInt(req.params.pid, 10);
    if (isNaN(pid)) { res.status(400).json({ error: "Invalid PID" }); return; }
    const lines = parseInt(req.query.lines as string, 10) || 100;
    res.json({ pid, logs: getLogsFn(pid, lines) });
  });

  router.post("/processes/:pid/kill", async (req, res) => {
    const pid = parseInt(req.params.pid, 10);
    if (isNaN(pid)) { res.status(400).json({ error: "Invalid PID" }); return; }
    res.json(await killFn(pid));
  });

  router.post("/processes/:pid/restart", async (req, res) => {
    const pid = parseInt(req.params.pid, 10);
    if (isNaN(pid)) { res.status(400).json({ error: "Invalid PID" }); return; }
    const cmd = getCommandFn(pid);
    res.json(await restartFn(pid, cmd));
  });

  router.post("/processes/:pid/signal", async (req, res) => {
    const pid = parseInt(req.params.pid, 10);
    if (isNaN(pid)) { res.status(400).json({ error: "Invalid PID" }); return; }
    const signal = (req.query.sig as string) || "TERM";
    res.json(await signalFn(pid, signal));
  });

  // ── Port endpoints ─────────────────────────────────────────────────

  /**
   * GET /ports
   * Returns all processes that are listening on a port, enriched with
   * health and service information.
   */
  router.get("/ports", (_req, res) => {
    const processes = getProcessesData();
    const health = getHealthData();
    const portProcesses = processes
      .filter((p) => p.port !== null)
      .map((p) => ({
        ...p,
        health: health.get(p.pid)?.status ?? "no-port",
      }));
    res.json({ ports: portProcesses });
  });

  /**
   * POST /ports/swap
   * Body: { pid, newPort, oldPort }
   * Kills the process on oldPort and restarts it on newPort by injecting
   * PORT=<newPort> into the environment.
   */
  router.post("/ports/swap", async (req, res) => {
    const { pid, newPort, oldPort } = req.body as {
      pid: number;
      newPort: number;
      oldPort: number;
    };

    if (!pid || !newPort || !oldPort) {
      res.status(400).json({ error: "pid, newPort, and oldPort are required" });
      return;
    }
    if (newPort < 1024 || newPort > 65535) {
      res.status(400).json({ error: "newPort must be between 1024 and 65535" });
      return;
    }

    const result = await swapPort(pid, newPort, oldPort);
    res.json(result);
  });

  // ── Group / service endpoints ──────────────────────────────────────

  router.get("/config", (_req, res) => {
    res.json(getConfigFn());
  });

  router.get("/groups", (_req, res) => {
    res.json(getGroupDataFn());
  });

  router.post("/groups/:groupId/start", async (req, res) => {
    const results = await startGroupFn(req.params.groupId);
    res.json({ groupId: req.params.groupId, results });
  });

  router.post("/groups/:groupId/kill", async (req, res) => {
    const ok = await killGroupFn(req.params.groupId);
    res.json({ groupId: req.params.groupId, success: ok });
  });

  router.post("/services/:serviceId/start", async (req, res) => {
    const { groupId } = req.body as { groupId: string };
    if (!groupId) { res.status(400).json({ error: "groupId required" }); return; }
    const pid = await startServiceFn(req.params.serviceId, groupId);
    res.json({ serviceId: req.params.serviceId, groupId, pid });
  });

  // ── Config editor endpoints ────────────────────────────────────────

  router.get("/config/raw", (_req, res) => {
    const path = getConfigFilePath();
    if (!path) { res.json({ content: "{}" }); return; }
    try { res.json({ content: readFileSync(path, "utf8") }); }
    catch { res.json({ content: "{}" }); }
  });

  router.post("/config/raw", (req, res) => {
    const { content } = req.body as { content: string };
    try {
      const parsed = JSON.parse(content);
      if (!validateConfig(parsed)) throw new Error("Invalid config schema");
      const path = getConfigFilePath();
      if (!path) throw new Error("No config file path found");
      writeFileSync(path, JSON.stringify(parsed, null, 2), "utf8");
      reloadConfig();
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false, error: (err as Error).message });
    }
  });

  // ── Port reservations endpoint ─────────────────────────────────────

  router.post("/reservations", (req, res) => {
    const { port, label } = req.body as { port: number; label: string };
    if (!port || !label) { res.status(400).json({ error: "port and label required" }); return; }
    const portNum = Number(port);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      res.status(400).json({ error: "invalid port" }); return;
    }
    const path = getConfigFilePath();
    if (!path) { res.status(500).json({ error: "No config path" }); return; }
    try {
      const cfg = getConfig();
      cfg.reservedPorts = cfg.reservedPorts ?? {};
      cfg.reservedPorts[portNum] = label;
      writeFileSync(path, JSON.stringify(cfg, null, 2), "utf8");
      reloadConfig();
      res.json({ success: true, port: portNum, label });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.delete("/reservations/:port", (req, res) => {
    const portNum = Number(req.params.port);
    const path = getConfigFilePath();
    if (!path) { res.status(500).json({ error: "No config path" }); return; }
    try {
      const cfg = getConfig();
      cfg.reservedPorts = cfg.reservedPorts ?? {};
      delete cfg.reservedPorts[portNum];
      writeFileSync(path, JSON.stringify(cfg, null, 2), "utf8");
      reloadConfig();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ── Dependency graph endpoint ──────────────────────────────────────

  router.get("/graph", (_req, res) => {
    const running = getRunningServiceIds();
    const graph = buildDependencyGraph(running);
    res.json(graph);
  });

  return router;
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
