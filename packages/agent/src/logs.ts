import { ChildProcess } from "child_process";
import { safeSpawn } from "./utils/spawn.js";

const MAX_LINES = 500;

export interface LogLine {
  timestamp: number;
  level: "stdout" | "stderr";
  message: string;
}

class RingBuffer {
  private buffer: LogLine[] = [];
  private maxLines: number;

  constructor(maxLines: number = MAX_LINES) {
    this.maxLines = maxLines;
  }

  push(line: LogLine): void {
    this.buffer.push(line);
    if (this.buffer.length > this.maxLines) {
      this.buffer = this.buffer.slice(-this.maxLines);
    }
  }

  getLines(count?: number): LogLine[] {
    if (count === undefined) return [...this.buffer];
    return this.buffer.slice(-count);
  }

  clear(): void {
    this.buffer = [];
  }

  get length(): number {
    return this.buffer.length;
  }
}

const logBuffers = new Map<number, RingBuffer>();
const managedProcesses = new Map<number, ChildProcess>();

const logSubscribers = new Set<(pid: number, line: LogLine) => void>();

export function subscribe(callback: (pid: number, line: LogLine) => void): () => void {
  logSubscribers.add(callback);
  return () => logSubscribers.delete(callback);
}

function broadcast(pid: number, line: LogLine): void {
  for (const cb of logSubscribers) {
    cb(pid, line);
  }
}

export function startManagedProcess(name: string, command: string, cwd: string): number | null {
  if (!command) return null;

  const parts = command.split(/\s+/);
  const cmd = parts[0];
  const args = parts.slice(1);

  try {
    const proc = safeSpawn(cmd, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: true,
    });

    const pid = proc.pid ?? 0;
    if (!pid) return null;

    const buffer = new RingBuffer();
    logBuffers.set(pid, buffer);
    managedProcesses.set(pid, proc);

    proc.stdout?.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      for (const msg of lines) {
        const line: LogLine = { timestamp: Date.now(), level: "stdout", message: msg };
        buffer.push(line);
        broadcast(pid, line);
      }
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      for (const msg of lines) {
        const line: LogLine = { timestamp: Date.now(), level: "stderr", message: msg };
        buffer.push(line);
        broadcast(pid, line);
      }
    });

    proc.on("exit", () => {
      managedProcesses.delete(pid);
    });

    return pid;
  } catch {
    return null;
  }
}

export function ensureBuffer(pid: number): RingBuffer {
  if (!logBuffers.has(pid)) {
    logBuffers.set(pid, new RingBuffer());
  }
  return logBuffers.get(pid)!;
}

export function getLogs(pid: number, count?: number): LogLine[] {
  const buf = logBuffers.get(pid);
  return buf ? buf.getLines(count) : [];
}

export function clearLogs(pid: number): void {
  const buf = logBuffers.get(pid);
  if (buf) buf.clear();
}
