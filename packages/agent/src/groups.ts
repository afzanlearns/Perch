import { exec, ChildProcess } from "child_process";
import { safeExecFile, safeExecFileSync, safeExecSync, safeSpawn } from "./utils/spawn.js";
import { platform } from "os";
import { getConfig, type ServiceConfig, type GroupConfig } from "./config.js";
import { setGroupAnnotations } from "./processes.js";
import { getLogs } from "./logs.js";
import type { LogLine } from "./logs.js";

export interface ServiceInstance {
  serviceId: string;
  groupId: string;
  pid: number;
  command: string;
  cwd: string;
  expectedPort: number | null;
  autoRestart: boolean;
  name: string;
  process: ChildProcess | null;
  startedAt: number;
}

export interface CrashAlert {
  pid: number;
  name: string;
  exitCode: number | null;
  signal: string | null;
  lastLogs: LogLine[];
  timestamp: number;
}

const instances = new Map<number, ServiceInstance>();
const serviceInstances = new Map<string, number[]>();

/** PIDs that were intentionally killed — prevents crash alert from firing */
const intentionalKills = new Set<number>();

/** Crash alert subscribers */
const crashSubscribers = new Set<(alert: CrashAlert) => void>();

export function subscribeCrash(cb: (alert: CrashAlert) => void): () => void {
  crashSubscribers.add(cb);
  return () => crashSubscribers.delete(cb);
}

function emitCrash(alert: CrashAlert) {
  for (const cb of crashSubscribers) cb(alert);
}

export function getUptimeMs(pid: number): number | null {
  const inst = instances.get(pid);
  if (!inst) return null;
  return Date.now() - inst.startedAt;
}

export function getStartedAt(pid: number): number | null {
  return instances.get(pid)?.startedAt ?? null;
}

export function getServiceInstance(pid: number): ServiceInstance | undefined {
  return instances.get(pid);
}

export function getInstancesForGroup(groupId: string): ServiceInstance[] {
  const result: ServiceInstance[] = [];
  for (const inst of instances.values()) {
    if (inst.groupId === groupId) {
      result.push(inst);
    }
  }
  return result;
}

export function removeInstance(pid: number): void {
  const inst = instances.get(pid);
  if (inst) {
    instances.delete(pid);
    const pids = serviceInstances.get(inst.serviceId) ?? [];
    serviceInstances.set(inst.serviceId, pids.filter((p) => p !== pid));
  }
  updateAnnotations();
}

function updateAnnotations() {
  const annotations = new Map<number, { groupId: string; serviceId: string }>();
  for (const [pid, inst] of instances) {
    annotations.set(pid, { groupId: inst.groupId, serviceId: inst.serviceId });
  }
  setGroupAnnotations(annotations);
}

function pidExists(pid: number): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (platform() === "win32") {
        safeExecFile("tasklist", ["/fi", `PID eq ${pid}`, "/nh"], { timeout: 2000 })
          .then(({ stdout }) => resolve(stdout.includes(pid.toString())))
          .catch(() => resolve(false));
      } else {
        exec(`kill -0 ${pid} 2>/dev/null`, { timeout: 2000, windowsHide: true }, (err) => {
          resolve(!err);
        });
      }
    } catch {
      resolve(false);
    }
  });
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function startService(service: ServiceConfig, groupId: string): Promise<number | null> {
  try {
    const env = service.env
      ? { ...process.env, ...service.env }
      : process.env;

    const child = safeSpawn(service.command, [], {
      cwd: service.cwd,
      shell: true,
      stdio: "ignore",
      windowsHide: true,
      detached: true,
      env,
    });
    child.unref();

    const pid = child.pid;
    if (!pid) return null;

    const instance: ServiceInstance = {
      serviceId: service.id,
      groupId,
      pid,
      command: service.command,
      cwd: service.cwd,
      expectedPort: service.expectedPort ?? null,
      autoRestart: service.autoRestart ?? false,
      name: service.name,
      process: child,
      startedAt: Date.now(),
    };

    instances.set(pid, instance);
    const pids = serviceInstances.get(service.id) ?? [];
    pids.push(pid);
    serviceInstances.set(service.id, pids);
    updateAnnotations();

    child.on("exit", (code, signal) => {
      instances.delete(pid);
      const existing = serviceInstances.get(service.id) ?? [];
      serviceInstances.set(service.id, existing.filter((p) => p !== pid));
      updateAnnotations();

      // Emit crash alert if exit was unexpected (not intentional)
      const wasIntentional = intentionalKills.has(pid);
      if (!wasIntentional) {
        const lastLogs = getLogs(pid, 5);
        emitCrash({ pid, name: instance.name, exitCode: code, signal: signal as string | null, lastLogs, timestamp: Date.now() });
      }
      intentionalKills.delete(pid);

      if (instance.autoRestart) {
        startService(service, groupId);
      }
    });

    return pid;
  } catch {
    return null;
  }
}

export async function killService(pid: number): Promise<boolean> {
  intentionalKills.add(pid); // mark as intentional before sending signal
  try {
    const exists = await pidExists(pid);
    if (!exists) {
      removeInstance(pid);
      return true;
    }

    const isWin = platform() === "win32";
    if (isWin) {
      safeExecFileSync("taskkill", ["/pid", String(pid), "/t"], { timeout: 5000, stdio: "pipe" });
    } else {
      safeExecSync(`kill ${pid} 2>/dev/null`, { timeout: 3000 });
    }

    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const alive = await pidExists(pid);
      if (!alive) {
        removeInstance(pid);
        return true;
      }
      await sleep(100);
    }

    if (isWin) {
      safeExecFileSync("taskkill", ["/pid", String(pid), "/f", "/t"], { timeout: 5000, stdio: "pipe" });
    } else {
      safeExecSync(`kill -9 ${pid} 2>/dev/null`, { timeout: 3000 });
    }

    const forceDeadline = Date.now() + 2000;
    while (Date.now() < forceDeadline) {
      const alive = await pidExists(pid);
      if (!alive) {
        removeInstance(pid);
        return true;
      }
      await sleep(100);
    }

    removeInstance(pid);
    return false;
  } catch {
    removeInstance(pid);
    return false;
  }
}

export async function startGroup(groupId: string): Promise<{ serviceId: string; pid: number | null }[]> {
  const config = getConfig();
  const group = config.groups.find((g) => g.id === groupId);
  if (!group) return [];

  const results: { serviceId: string; pid: number | null }[] = [];
  for (const service of group.services) {
    const pid = await startService(service, groupId);
    results.push({ serviceId: service.id, pid });
  }
  return results;
}

export async function killGroup(groupId: string): Promise<boolean> {
  const groupInstances = getInstancesForGroup(groupId);
  let allSuccess = true;
  for (const inst of groupInstances) {
    const ok = await killService(inst.pid);
    if (!ok) allSuccess = false;
  }
  return allSuccess;
}

export function getAllInstances(): ServiceInstance[] {
  return Array.from(instances.values());
}

export function getGroupData() {
  const config = getConfig();
  return {
    groups: config.groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      services: g.services.map((s) => ({
        id: s.id,
        name: s.name,
        command: s.command,
        expectedPort: s.expectedPort,
        running: getInstancesForService(s.id).length > 0,
      })),
    })),
    favorites: config.favorites,
  };
}

function getInstancesForService(serviceId: string): ServiceInstance[] {
  const pids = serviceInstances.get(serviceId) ?? [];
  return pids.map((pid) => instances.get(pid)).filter(Boolean) as ServiceInstance[];
}

export async function autoStartServices(): Promise<void> {
  const config = getConfig();
  if (!config.autoStart) return;

  for (const group of config.groups) {
    for (const service of group.services) {
      if (service.autoRestart) {
        await startService(service, group.id);
      }
    }
  }
}

export function getRunningServiceIds(): Set<string> {
  const running = new Set<string>();
  for (const inst of instances.values()) {
    running.add(inst.serviceId);
  }
  return running;
}
