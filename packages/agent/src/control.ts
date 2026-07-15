import { exec, spawn } from "child_process";
import { safeExecFile, safeExecFileSync, safeExecSync, safeSpawn } from "./utils/spawn.js";
import { platform } from "os";
import { ensureBuffer } from "./logs.js";

export interface ControlResult {
  success: boolean;
  pid: number;
  action: "kill" | "restart" | "signal";
  message: string;
}

export interface KillResult extends ControlResult {
  killedAt?: string;
  children?: number[];
}

export interface RestartResult extends ControlResult {
  newPid?: number;
  killedAt?: string;
  startedAt?: string;
  command?: string;
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function isProcessAlive(pid: number): Promise<boolean> {
  return pidExists(pid);
}

/**
 * Find child processes of a given PID using ps-list-like approach.
 * Falls back to WMI on Windows, ps on Unix.
 */
async function findChildProcesses(pid: number): Promise<number[]> {
  try {
    const isWin = platform() === "win32";
    const children: number[] = [];

    if (isWin) {
      const { stdout } = await safeExecFile("wmic", [
        "process", "where", `ParentProcessId=${pid}`, "get", "ProcessId", "/format:csv"
      ], { timeout: 3000 });
      const lines = stdout.split("\n").filter(Boolean);
      for (const line of lines) {
        const parts = line.trim().split(",");
        if (parts.length >= 2) {
          const childPid = parseInt(parts[2] || parts[1], 10);
          if (!isNaN(childPid) && childPid !== pid) {
            children.push(childPid);
          }
        }
      }
    } else {
      const { stdout } = await safeExecFile("ps", ["-o", "pid=", "--ppid", String(pid)], { timeout: 3000 });
      const lines = stdout.split("\n").filter(Boolean);
      for (const line of lines) {
        const childPid = parseInt(line.trim(), 10);
        if (!isNaN(childPid)) {
          children.push(childPid);
        }
      }
    }
    return children;
  } catch {
    return [];
  }
}

export async function killProcess(pid: number): Promise<KillResult> {
  const startedAt = new Date().toISOString();

  try {
    const exists = await pidExists(pid);
    if (!exists) {
      return { success: true, pid, action: "kill", message: "Process does not exist", killedAt: startedAt, children: [] };
    }

    const isWin = platform() === "win32";

    // Find child processes for thorough killing
    const children = await findChildProcesses(pid);
    const allPids = [pid, ...children];

    // Phase 1 — graceful kill (including children)
    for (const p of allPids) {
      try {
        if (isWin) {
          safeExecFileSync("taskkill", ["/pid", String(p), "/t"], { timeout: 5000, stdio: "pipe" });
        } else {
          safeExecSync(`kill ${p} 2>/dev/null`, { timeout: 3000 });
        }
      } catch {
        // Graceful kill failed, will try force kill
      }
    }

    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const allDead = (await Promise.all(allPids.map(p => pidExists(p)))).every(alive => !alive);
      if (allDead) {
        return {
          success: true, pid, action: "kill",
          message: children.length > 0
            ? `Killed process ${pid} and ${children.length} child process${children.length !== 1 ? "es" : ""}`
            : "Process killed",
          killedAt: new Date().toISOString(), children
        };
      }
      await sleep(100);
    }

    // Phase 2 — force kill
    for (const p of allPids) {
      try {
        if (isWin) {
          safeExecFileSync("taskkill", ["/pid", String(p), "/f", "/t"], { timeout: 5000, stdio: "pipe" });
        } else {
          safeExecSync(`kill -9 ${p} 2>/dev/null`, { timeout: 3000 });
        }
      } catch {
        // Force kill also failed
      }
    }

    const forceDeadline = Date.now() + 3000;
    while (Date.now() < forceDeadline) {
      const allDead = (await Promise.all(allPids.map(p => pidExists(p)))).every(alive => !alive);
      if (allDead) {
        return {
          success: true, pid, action: "kill",
          message: children.length > 0
            ? `Force killed process ${pid} and ${children.length} child process${children.length !== 1 ? "es" : ""}`
            : "Process force killed",
          killedAt: new Date().toISOString(), children
        };
      }
      await sleep(100);
    }

    return {
      success: false, pid, action: "kill",
      message: `Could not kill process ${pid}`,
      killedAt: new Date().toISOString(), children
    };
  } catch (err) {
    return {
      success: false, pid, action: "kill",
      message: String(err),
      killedAt: new Date().toISOString()
    };
  }
}

export async function sendSignal(pid: number, signal: string): Promise<ControlResult> {
  try {
    const exists = await pidExists(pid);
    if (!exists) {
      return { success: false, pid, action: "signal", message: "Process does not exist" };
    }

    const isWin = platform() === "win32";
    const sigNum = signal.replace("SIG", "");

    if (isWin) {
      const force = sigNum === "KILL" || sigNum === "9";
      const args = ["/pid", String(pid)];
      if (force) args.push("/f");
      args.push("/t");
      safeExecFileSync("taskkill", args, { timeout: 5000, stdio: "pipe" });
    } else {
      safeExecSync(`kill -${sigNum} ${pid} 2>/dev/null`, { timeout: 3000 });
    }

    return {
      success: true,
      pid,
      action: "signal",
      message: `Signal ${signal} sent to PID ${pid}`,
    };
  } catch (err) {
    return { success: false, pid, action: "signal", message: String(err) };
  }
}

async function waitForPortAvailable(port: number, maxWaitMs = 3000): Promise<void> {
  const startTime = Date.now();
  const isWin = platform() === "win32";

  while (Date.now() - startTime < maxWaitMs) {
    try {
      let portInUse = false;
      if (isWin) {
        const { stdout } = await safeExecFile("netstat", ["-ano"], { timeout: 2000 });
        portInUse = stdout.split("\n").some(line => {
          const parts = line.trim().split(/\s+/);
          return parts[1]?.includes(`:${port}`) && parts[3] === "LISTENING";
        });
      } else {
        const { stdout } = await safeExecFile("lsof", ["-i", `:${port}`, "-P", "-n"], { timeout: 2000 });
        portInUse = stdout.includes(`:${port}`);
      }
      if (!portInUse) return;
    } catch {
      // If check fails, assume port might be free
      return;
    }
    await sleep(200);
  }
}

export async function restartProcess(
  pid: number,
  command: string,
  cwd?: string
): Promise<RestartResult> {
  const killResult = await killProcess(pid);
  if (!killResult.success) {
    return { ...killResult, action: "restart" as const };
  }

  if (!command) {
    return {
      success: false,
      pid,
      action: "restart",
      message: "No command stored for this process",
      killedAt: killResult.killedAt,
    };
  }

  try {
    const resolvedCwd = cwd ?? process.cwd();

    const child = safeSpawn(command, [], {
      cwd: resolvedCwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      detached: true,
    });

    const newPid = child.pid;
    if (!newPid) {
      return {
        success: false, pid, action: "restart",
        message: "Failed to spawn process",
        killedAt: killResult.killedAt,
      };
    }

    child.unref();

    // Capture logs from the restarted process
    const buffer = ensureBuffer(newPid);
    child.stdout?.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      for (const msg of lines) {
        buffer.push({ timestamp: Date.now(), level: "stdout", message: msg });
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      for (const msg of lines) {
        buffer.push({ timestamp: Date.now(), level: "stderr", message: msg });
      }
    });

    // Wait briefly for port to become available
    const startedAt = new Date().toISOString();

    return {
      success: true,
      pid: newPid,
      action: "restart",
      message: `Process restarted. Old PID ${pid} → New PID ${newPid}`,
      newPid,
      killedAt: killResult.killedAt,
      startedAt,
      command,
    };
  } catch (err) {
    return {
      success: false, pid, action: "restart",
      message: String(err),
      killedAt: killResult.killedAt,
    };
  }
}
