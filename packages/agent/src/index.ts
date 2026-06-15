import { createServer } from "http";
import { createApp } from "./app.js";
import { getProcesses, getPortViolations } from "./processes.js";
import { getEnvVars } from "./env.js";
import { checkHealth } from "./health.js";
import { getLogs, subscribe as subscribeLogs } from "./logs.js";
import { killProcess, restartProcess, sendSignal } from "./control.js";
import { createWebSocketServer } from "./ws.js";
import { loadConfig, getConfig, onConfigChange } from "./config.js";
import {
  startGroup, killGroup, startService, getGroupData, autoStartServices, subscribeCrash,
} from "./groups.js";
import { subscribeInspectorRequest, subscribeInspectorState, clearAllInspectors } from "./inspector.js";
import type { ProcessInfo } from "./processes.js";
import type { EnvVars } from "./env.js";
import type { HealthStatus } from "./health.js";

function main() {
  const config = loadConfig();

  let processes: ProcessInfo[] = [];
  let env: EnvVars = {};
  let healthData = new Map<number, { pid: number; status: HealthStatus; checkedAt: number }>();
  const startTime = Date.now();

  function getCommand(pid: number): string {
    const proc = processes.find((p) => p.pid === pid);
    return proc?.command ?? "";
  }

  async function poll() {
    try {
      processes = await getProcesses();
      env = getEnvVars();
    } catch (err) {
      console.error("Poll error:", err);
    }
  }

  async function runHealthChecks() {
    try {
      const results = await checkHealth(processes);
      healthData = new Map(results.map((r) => [r.pid, r]));
    } catch (err) {
      console.error("Health check error:", err);
    }
  }

  function makeStartServiceFn() {
    return (serviceId: string, groupId: string) => {
      const cfg = getConfig();
      for (const group of cfg.groups) {
        if (group.id === groupId) {
          const service = group.services.find((s) => s.id === serviceId);
          if (service) return startService(service, groupId);
        }
      }
      return Promise.resolve(null);
    };
  }

  const app = createApp(
    () => processes, () => env, () => healthData,
    (pid, count) => getLogs(pid, count),
    (pid) => killProcess(pid),
    (pid, command, cwd) => restartProcess(pid, command, cwd),
    (pid, signal) => sendSignal(pid, signal),
    (pid) => getCommand(pid),
    () => getConfig(),
    () => getGroupData(),
    (groupId) => startGroup(groupId),
    (groupId) => killGroup(groupId),
    makeStartServiceFn(),
    startTime
  );

  const server = createServer(app);

  const ws = createWebSocketServer(
    server,
    () => processes, () => env, () => healthData,
    (pid) => killProcess(pid),
    (pid, command, cwd) => restartProcess(pid, command, cwd),
    (pid, signal) => sendSignal(pid, signal),
    (pid, count) => getLogs(pid, count),
    (pid) => getCommand(pid),
    () => getGroupData(),
    (groupId) => startGroup(groupId),
    (groupId) => killGroup(groupId),
    makeStartServiceFn(),
  );

  subscribeLogs((pid, line) => {
    ws.broadcastLog(pid, line);
  });

  // Subscribe to crash alerts from managed services
  subscribeCrash((alert) => {
    ws.broadcastCrash(alert);
  });

  // Subscribe to inspector proxy requests and state changes
  subscribeInspectorRequest((record) => {
    ws.broadcastInspectorRequest(record);
  });
  subscribeInspectorState((active) => {
    ws.broadcastInspectorState(active);
  });

  const daemonPort = getConfig().daemonPort || 7777;

  server.listen(daemonPort, () => {
    console.log(`perch agent listening on http://localhost:${daemonPort}`);
    console.log(`WebSocket at ws://localhost:${daemonPort}/ws`);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    console.error("Failed to start server:", err.message);
    if ((err as any).code === "EADDRINUSE") {
      console.error(`Port ${daemonPort} is already in use`);
    }
    process.exit(1);
  });

  const cleanup = async () => {
    console.log("Shutting down Perch daemon...");
    await clearAllInspectors();
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  onConfigChange(() => {
    console.log("Config reloaded");
    ws.broadcastGroupUpdate();
  });

  autoStartServices();

  let isPolling = false;
  let isHealthChecking = false;
  let lastViolationKey = "";

  poll();
  setInterval(async () => {
    if (isPolling) return;
    isPolling = true;
    try {
      await poll();
      // Check port reservations after each poll
      const cfg = getConfig();
      if (Object.keys(cfg.reservedPorts).length > 0) {
        const violations = getPortViolations(processes, cfg.reservedPorts);
        const key = JSON.stringify(violations);
        if (key !== lastViolationKey) {
          lastViolationKey = key;
          ws.broadcastPortViolations(violations);
        }
      }
    } catch (err) {
      console.error("Poll error:", err);
    } finally {
      isPolling = false;
    }
  }, getConfig().pollInterval || 2000);

  setInterval(() => {
    ws.broadcastProcessUpdate(processes);
  }, getConfig().pollInterval || 2000);

  setInterval(async () => {
    if (isHealthChecking) return
    isHealthChecking = true
    try {
      await runHealthChecks()
      ws.broadcastHealthUpdate(healthData)
    } catch (err) {
      console.error("Health check error:", err)
    } finally {
      isHealthChecking = false
    }
  }, getConfig().healthCheckInterval || 5000);
}

try {
  main();
} catch (err) {
  console.error("Daemon failed to start:", err);
  process.exit(1);
}
