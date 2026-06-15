import express from "express";
import cors from "cors";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import type { ProcessInfo } from "./processes.js";
import type { EnvVars } from "./env.js";
import type { HealthStatus } from "./health.js";
import type { LogLine } from "./logs.js";
import { createApiRouter } from "./api.js";

function getBuiltUIPath(): string | null {
  const paths = [
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "ui", "dist"),
    join(process.cwd(), "..", "ui", "dist"),
    join(process.cwd(), "node_modules", "perch-ui", "dist"),
  ];
  for (const p of paths) {
    if (existsSync(join(p, "index.html"))) return p;
  }
  return null;
}

export function createApp(
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
) {
  const app = express();

  app.use(cors({ origin: ["http://localhost:3000", "http://localhost:5173"] }));
  app.use(express.json());

  app.use(
    "/api",
    createApiRouter(
      getProcessesData, getEnvData, getHealthData, getLogsFn,
      killFn, restartFn, signalFn, getCommandFn,
      getConfigFn, getGroupDataFn, startGroupFn, killGroupFn, startServiceFn,
      startTime
    )
  );

  const uiPath = getBuiltUIPath();
  if (uiPath) {
    app.use(express.static(uiPath));
    app.get("*", (_req, res) => {
      res.sendFile(join(uiPath, "index.html"));
    });
  } else {
    app.get("*", (_req, res) => {
      res.json({
        error: "UI not built",
        message: "Run 'npm run build --workspace=packages/ui' or access the UI at http://localhost:3000 in dev mode",
      });
    });
  }

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "internal server error" });
  });

  return app;
}
