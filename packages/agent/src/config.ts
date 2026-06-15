import { readFileSync, existsSync, watchFile } from "fs";
import { join } from "path";

export interface ServiceConfig {
  id: string;
  name: string;
  command: string;
  cwd: string;
  expectedPort: number | null;
  healthCheckPath?: string;
  env?: Record<string, string>;
  autoRestart?: boolean;
}

export interface GroupConfig {
  id: string;
  name: string;
  description?: string;
  services: ServiceConfig[];
}

export interface PerchConfig {
  version: string;
  /** Port the Perch daemon HTTP/WS server listens on. Default 7777. */
  daemonPort: number;
  uiPort: number;
  pollInterval: number;
  healthCheckInterval: number;
  logBufferSize: number;
  groups: GroupConfig[];
  favorites: string[];
  notificationLevel: string;
  autoStart: boolean;
  reservedPorts: Record<number, string>;
}

// BUG FIX: Was 5173 — conflicts with Vite's default port.
// Changed to 7777 which is safe across all common dev stacks.
const DEFAULT_CONFIG: PerchConfig = {
  version: "1.0",
  daemonPort: 7777,
  uiPort: 3000,
  pollInterval: 2000,
  healthCheckInterval: 5000,
  logBufferSize: 500,
  groups: [],
  favorites: [],
  notificationLevel: "error",
  autoStart: false,
  reservedPorts: {},
};

let currentConfig: PerchConfig = { ...DEFAULT_CONFIG };
let configPath: string | null = null;
const listeners = new Set<() => void>();

function getConfigPath(cwd: string): string {
  return join(cwd, "perch.config.json");
}

export function validateConfig(data: unknown): data is PerchConfig {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  if (d.groups !== undefined && !Array.isArray(d.groups)) return false;
  if (d.favorites !== undefined && !Array.isArray(d.favorites)) return false;
  return true;
}

function parseConfig(filePath: string): PerchConfig {
  try {
    if (!existsSync(filePath)) {
      return { ...DEFAULT_CONFIG };
    }
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!validateConfig(parsed)) {
      console.warn("Invalid perch.config.json, using defaults");
      return { ...DEFAULT_CONFIG };
    }
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (err) {
    console.warn("Failed to load perch.config.json:", (err as Error).message);
    return { ...DEFAULT_CONFIG };
  }
}

export function loadConfig(cwd?: string): PerchConfig {
  const dir = cwd ?? process.cwd();
  configPath = getConfigPath(dir);
  currentConfig = parseConfig(configPath);
  return currentConfig;
}

export function reloadConfig(): PerchConfig {
  if (configPath) {
    currentConfig = parseConfig(configPath);
    for (const cb of listeners) {
      cb();
    }
  }
  return currentConfig;
}

export function getConfig(): PerchConfig {
  return currentConfig;
}

export function onConfigChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getConfigFilePath(): string | null {
  return configPath;
}
