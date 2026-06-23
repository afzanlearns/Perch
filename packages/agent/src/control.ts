import { exec } from "child_process";
import { safeExecFile, safeExecFileSync, safeExecSync, safeSpawn } from "./utils/spawn.js";
import { platform } from "os";

export interface ControlResult {
  success: boolean;
  pid: number;
  action: "kill" | "restart" | "signal";
  message: string;
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

export async function killProcess(pid: number): Promise<ControlResult> {
  try {
    const exists = await pidExists(pid);
    if (!exists) {
      return { success: true, pid, action: "kill", message: "Process does not exist" };
    }

    const isWin = platform() === "win32";

    // Phase 1 — graceful kill
    try {
      if (isWin) {
        safeExecFileSync("taskkill", ["/pid", String(pid), "/t"], { timeout: 5000, stdio: "pipe" });
      } else {
        safeExecSync(`kill ${pid} 2>/dev/null`, { timeout: 3000 });
      }
    } catch {
      // Graceful kill failed, will try force kill
    }

    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const alive = await pidExists(pid);
      if (!alive) {
        return { success: true, pid, action: "kill", message: "Process killed" };
      }
      await sleep(100);
    }

    // Phase 2 — force kill
    try {
      if (isWin) {
        safeExecFileSync("taskkill", ["/pid", String(pid), "/f", "/t"], { timeout: 5000, stdio: "pipe" });
      } else {
        safeExecSync(`kill -9 ${pid} 2>/dev/null`, { timeout: 3000 });
      }
    } catch {
      // Force kill also failed
    }

    const forceDeadline = Date.now() + 2000;
    while (Date.now() < forceDeadline) {
      const alive = await pidExists(pid);
      if (!alive) {
        return { success: true, pid, action: "kill", message: "Process force killed" };
      }
      await sleep(100);
    }

    return { success: false, pid, action: "kill", message: "Could not kill process" };
  } catch (err) {
    return { success: false, pid, action: "kill", message: String(err) };
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

export async function restartProcess(
  pid: number,
  command: string,
  cwd?: string
): Promise<ControlResult> {
  const killResult = await killProcess(pid);
  if (!killResult.success) {
    return killResult;
  }

  if (!command) {
    return {
      success: false,
      pid,
      action: "restart",
      message: "No command stored for this process",
    };
  }

  try {
    const child = safeSpawn(command, [], {
      cwd: cwd ?? process.cwd(),
      shell: true,
      stdio: "ignore",
      windowsHide: true,
      detached: true,
    });

    child.unref();

    const newPid = child.pid;
    if (!newPid) {
      return { success: false, pid, action: "restart", message: "Failed to spawn process" };
    }

    return {
      success: true,
      pid: newPid,
      action: "restart",
      message: "Process restarted",
    };
  } catch (err) {
    return { success: false, pid, action: "restart", message: String(err) };
  }
}
