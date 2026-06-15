/**
 * portSwap.ts
 * Handles port reassignment for running services.
 *
 * Strategy:
 *  1. Find the service instance for the requested PID.
 *  2. Determine if it is a config-managed service or a raw process.
 *  3. Kill the existing process.
 *  4. For config-managed services: inject PORT=<newPort> env var and restart.
 *     For raw processes: attempt to restart via shell with PORT=<newPort> prepended.
 *  5. Update the service's expectedPort in the in-memory config.
 */

import { killProcess } from "./control.js";
import { getServiceInstance, startService } from "./groups.js";
import { getConfig } from "./config.js";
import { platform } from "os";
import { safeSpawn } from "./utils/spawn.js";

export interface PortSwapResult {
  success: boolean;
  oldPort: number;
  newPort: number;
  newPid: number | null;
  message: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function swapPort(
  pid: number,
  newPort: number,
  oldPort: number
): Promise<PortSwapResult> {
  // Check for port conflict before doing anything
  const conflict = await isPortInUse(newPort);
  if (conflict) {
    return {
      success: false,
      oldPort,
      newPort,
      newPid: null,
      message: `Port ${newPort} is already in use by another process.`,
    };
  }

  const instance = getServiceInstance(pid);

  // Kill the current process
  const killResult = await killProcess(pid);
  if (!killResult.success) {
    return {
      success: false,
      oldPort,
      newPort,
      newPid: null,
      message: `Failed to stop process: ${killResult.message}`,
    };
  }

  // Brief pause to let the OS release the old port
  await sleep(500);

  if (instance) {
    // Config-managed service: find its ServiceConfig and restart with new port env
    const config = getConfig();
    for (const group of config.groups) {
      const svc = group.services.find((s) => s.id === instance.serviceId);
      if (svc) {
        // Patch the expectedPort in memory (non-persistent; user can save to config manually)
        svc.expectedPort = newPort;

        const newPid = await startService(
          {
            ...svc,
            expectedPort: newPort,
            env: {
              ...(svc.env ?? {}),
              PORT: String(newPort),
              VITE_PORT: String(newPort),
            },
          },
          group.id
        );

        return {
          success: newPid !== null,
          oldPort,
          newPort,
          newPid,
          message: newPid
            ? `Service "${svc.name}" restarted on port ${newPort}`
            : `Killed on :${oldPort} but failed to restart on :${newPort}`,
        };
      }
    }
  }

  // Raw process (not config-managed): try to restart with PORT env prepended
  if (!instance) {
    return {
      success: true,
      oldPort,
      newPort,
      newPid: null,
      message: `Process killed. It was not a managed service — restart it manually on port ${newPort}.`,
    };
  }

  // Fallback: raw spawn with PORT= env
  try {
    const env = { ...process.env, PORT: String(newPort) };
    const child = safeSpawn(instance.command, [], {
      cwd: instance.cwd || process.cwd(),
      shell: true,
      stdio: "ignore",
      windowsHide: true,
      detached: true,
      env,
    });
    child.unref();
    const newPid = child.pid ?? null;
    return {
      success: newPid !== null,
      oldPort,
      newPort,
      newPid,
      message: newPid
        ? `Restarted on port ${newPort} (PID ${newPid})`
        : `Killed on :${oldPort} but spawn failed on :${newPort}`,
    };
  } catch (err) {
    return {
      success: false,
      oldPort,
      newPort,
      newPid: null,
      message: String(err),
    };
  }
}

/** Quick non-blocking check whether a TCP port is already bound. */
function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require("net");
    const tester = net.createServer();
    tester.once("error", () => resolve(true));
    tester.once("listening", () => {
      tester.close(() => resolve(false));
    });
    tester.listen(port, "127.0.0.1");
  });
}
