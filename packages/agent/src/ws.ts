import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { ProcessInfo } from "./processes.js";
import type { EnvVars } from "./env.js";
import type { HealthStatus } from "./health.js";
import type { LogLine } from "./logs.js";
import type { CrashAlert } from "./groups.js";
import type { SystemStats } from "./system.js";
import { swapPort } from "./portSwap.js";
import { startInspector, stopInspector, getActiveInspectors } from "./inspector.js";

interface ClientState {
  subscribedPid: number | null;
}

function wsSend(ws: WebSocket, data: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

export function createWebSocketServer(
  server: Server,
  getProcessesData: () => ProcessInfo[],
  getSystemStatsData: () => SystemStats,
  getEnvData: () => EnvVars,
  getHealthData: () => Map<number, { pid: number; status: HealthStatus; checkedAt: number }>,
  killFn: (pid: number) => Promise<{ success: boolean; pid: number; action: string; message: string }>,
  restartFn: (pid: number, command: string, cwd?: string) => Promise<{ success: boolean; pid: number; action: string; message: string }>,
  signalFn: (pid: number, signal: string) => Promise<{ success: boolean; pid: number; action: string; message: string }>,
  getLogsFn: (pid: number, count?: number) => LogLine[],
  getCommandFn: (pid: number) => string,
  getGroupDataFn: () => { groups: any[]; favorites: string[] },
  startGroupFn: (groupId: string) => Promise<{ serviceId: string; pid: number | null }[]>,
  killGroupFn: (groupId: string) => Promise<boolean>,
  startServiceFn: (serviceId: string, groupId: string) => Promise<number | null>,
) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const clients = new Map<WebSocket, ClientState>();

  wss.on("connection", (ws) => {
    const state: ClientState = { subscribedPid: null };
    clients.set(ws, state);

    const sysData = getSystemStatsData();
    console.log("[WS] initial send — system object:", JSON.stringify(sysData));
    wsSend(ws, {
      type: "initial",
      processes: getProcessesData(),
      system: sysData,
      env: getEnvData(),
      health: Array.from(getHealthData().values()),
      groups: getGroupDataFn().groups,
      favorites: getGroupDataFn().favorites,
      activeInspectors: getActiveInspectors(),
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case "subscribe:logs":
            state.subscribedPid = msg.pid;
            wsSend(ws, { type: "logs:initial", pid: msg.pid, logs: getLogsFn(msg.pid, 100) });
            break;

          case "unsubscribe:logs":
            state.subscribedPid = null;
            break;

          case "kill":
            killFn(msg.pid).then((result) => {
              wsSend(ws, { type: "control:result", ...result });
              // Trigger a processes broadcast so port views refresh immediately
              broadcastProcessUpdate(getProcessesData());
            });
            break;

          case "restart": {
            const cmd = getCommandFn(msg.pid);
            restartFn(msg.pid, cmd).then((result) => {
              wsSend(ws, { type: "control:result", ...result });
              broadcastProcessUpdate(getProcessesData());
            });
            break;
          }

          case "signal":
            signalFn(msg.pid, msg.signal).then((result) => wsSend(ws, { type: "control:result", ...result }));
            break;

          // ── Port swap ───────────────────────────────────────────────
          case "port:swap":
            swapPort(msg.pid, msg.newPort, msg.oldPort).then((result) => {
              wsSend(ws, { type: "port:swap:result", ...result });
              // Broadcast updated process list so port view refreshes
              setTimeout(() => broadcastProcessUpdate(getProcessesData()), 800);
            });
            break;

          case "startGroup":
            startGroupFn(msg.groupId).then((results) => {
              wsSend(ws, { type: "group:started", groupId: msg.groupId, results });
              broadcastGroupUpdate();
            });
            break;

          case "killGroup":
            killGroupFn(msg.groupId).then((ok) => {
              wsSend(ws, { type: "group:killed", groupId: msg.groupId, success: ok });
              broadcastGroupUpdate();
            });
            break;

          case "startService":
            startServiceFn(msg.serviceId, msg.groupId).then((pid) => {
              wsSend(ws, { type: "service:started", serviceId: msg.serviceId, groupId: msg.groupId, pid });
              broadcastGroupUpdate();
            });
            break;

          // Feature 4: Inspector Start/Stop
          case "inspector:start":
            if (typeof msg.targetPort === "number") {
              startInspector(msg.targetPort).then(() => {
                // broadcast active state to everyone
                broadcast({ type: "inspector:started", activeInspectors: getActiveInspectors() });
              }).catch((err) => {
                console.error("Failed to start inspector proxy:", err);
              });
            }
            break;

          case "inspector:stop":
            if (typeof msg.targetPort === "number") {
              stopInspector(msg.targetPort).then(() => {
                broadcast({ type: "inspector:stopped", activeInspectors: getActiveInspectors() });
              }).catch((err) => {
                console.error("Failed to stop inspector proxy:", err);
              });
            }
            break;
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", () => clients.delete(ws));
    ws.on("error", () => clients.delete(ws));
  });

  function broadcast(data: object) {
    const message = JSON.stringify(data);
    for (const [ws_] of clients) {
      if (ws_.readyState === WebSocket.OPEN) {
        ws_.send(message);
      }
    }
  }

  function broadcastGroupUpdate() {
    broadcast({ type: "groups:update", ...getGroupDataFn() });
  }

  function broadcastProcessUpdate(processes: ProcessInfo[]) {
    const sysData = getSystemStatsData();
    console.log("[WS] broadcastProcessUpdate — system object:", JSON.stringify(sysData));
    broadcast({ type: "processes:update", processes, system: sysData });
  }

  return {
    broadcastProcessUpdate,
    broadcastHealthUpdate(health: Map<number, { pid: number; status: HealthStatus; checkedAt: number }>) {
      broadcast({ type: "health:update", health: Array.from(health.values()) });
    },
    broadcastLog(pid: number, line: LogLine) {
      for (const [ws_, state] of clients) {
        if (state.subscribedPid === pid && ws_.readyState === WebSocket.OPEN) {
          ws_.send(JSON.stringify({ type: "log", pid, line }));
        }
      }
    },
    broadcastGroupUpdate,
    broadcastCrash(alert: CrashAlert) {
      broadcast({ type: "process:crash", ...alert });
    },
    broadcastPortViolations(violations: Array<{ port: number; expectedLabel: string; actualPid: number; actualName: string }>) {
      broadcast({ type: "port:violations", violations });
    },
    broadcastInspectorRequest(record: any) {
      broadcast({ type: "inspector:request", record });
    },
    broadcastInspectorState(activeInspectors: any[]) {
      broadcast({ type: "inspector:started", activeInspectors });
    },
  };
}
