#!/usr/bin/env node
import { spawn, execFileSync, execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { platform } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWindows = platform() === "win32";

function getAgentPath() {
  const distPath = join(__dirname, "dist", "index.js");
  if (existsSync(distPath)) return distPath;

  const srcPath = join(__dirname, "src", "index.ts");
  if (existsSync(srcPath)) return srcPath;

  return null;
}

async function ensureBuilt() {
  const distPath = join(__dirname, "dist", "index.js");
  if (existsSync(distPath)) return distPath;

  const srcPath = join(__dirname, "src", "index.ts");
  if (!existsSync(srcPath)) return null;

  try {
    execSync("npx --yes tsc --version", { stdio: "ignore", timeout: 15000, windowsHide: true });
    console.log("Building Perch agent...");
    execSync("npx --yes tsc", { cwd: join(__dirname), stdio: "inherit", timeout: 60000, windowsHide: true });
    return distPath;
  } catch {
    return null;
  }
}

function startDaemonWin(agentPath) {
  const child = spawn(process.execPath, [agentPath], {
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
    windowsHide: true,
  });
  child.unref();
}

function startDaemonUnix(agentPath) {
  const child = spawn(process.execPath, [agentPath], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

async function startDaemon() {
  if (await isDaemonRunning()) {
    console.log(GREEN + "Perch daemon is already running on http://localhost:7777" + RESET);
    process.exit(0);
  }

  const agentPath = await ensureBuilt();
  if (!agentPath) {
    console.error("Perch agent not found.");
    console.error("Run 'npm run build' from the perch directory, then try again.");
    process.exit(1);
  }

  console.log("Starting Perch daemon...");

  if (isWindows) {
    startDaemonWin(agentPath);
  } else {
    startDaemonUnix(agentPath);
  }

  console.log(GREEN + "Perch daemon started." + RESET);
  console.log("Open http://localhost:7777 in your browser.");
  process.exit(0);
}

const GREEN = '\x1b[32m';
const RED = '\x1b[91m';
const RESET = '\x1b[0m';

async function isDaemonRunning() {
  try {
    const res = await fetch("http://localhost:7777/api/status", { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function stopDaemon() {
  const running = await isDaemonRunning();
  if (!running) {
    console.log(RED + "Perch daemon is not running." + RESET);
    return;
  }
  console.log("Stopping Perch daemon...");
  try {
    if (isWindows) {
      execFileSync("taskkill", ["/f", "/im", "node.exe"], { timeout: 3000, windowsHide: true, stdio: "pipe" });
    } else {
      execSync("pkill -f 'perch.*dist/index' 2>/dev/null || pkill -f 'tsx.*index.ts' 2>/dev/null", { timeout: 3000, windowsHide: true });
    }
    console.log(GREEN + "Perch daemon stopped." + RESET);
  } catch {
    console.log("Could not find Perch daemon to stop.");
  }
}

async function showStatus() {
  try {
    const res = await fetch("http://localhost:7777/api/status", { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    console.log(GREEN + "Perch daemon is running" + RESET);
    console.log("  Status:  " + data.status);
    console.log("  Uptime:  " + data.uptimeFormatted);
    console.log("  Processes: " + data.processCount);
  } catch {
    console.log(RED + "Perch daemon is not running." + RESET);
  }
}

function toFileUrl(path) {
  if (process.platform === "win32") {
    // Convert Windows path like C:\foo\bar to file:///C:/foo/bar
    return "file:///" + path.replace(/\\/g, "/");
  }
  return path;
}

async function loadCliModule() {
  // Try dist first (built), then src (via tsx/node with ts extension)
  const distPath = join(__dirname, "dist", "cli.js");
  const srcPath = join(__dirname, "src", "cli.ts");

  if (existsSync(distPath)) {
    return await import(toFileUrl(distPath));
  }
  if (existsSync(srcPath)) {
    try {
      return await import(toFileUrl(srcPath));
    } catch {
      // Could not import TS directly, try falling back
    }
  }
  return null;
}

async function main() {
  const cmd = process.argv[2];

  // Commands that don't need the daemon
  switch (cmd) {
    case "start":
      await startDaemon();
      return;
    case "stop":
      await stopDaemon();
      return;
    case "status":
      await showStatus();
      return;
  }

  // Commands that need CLI module (and daemon API)
  const cli = await loadCliModule();
  if (!cli) {
    console.error("CLI module not built. Run 'npm run build' first.");
    process.exit(1);
  }

  switch (cmd) {
    case "ports": {
      const { listPorts, printPortTable } = await import("./ports-command.js");
      const showAll = process.argv.includes("--all");
      const result = await listPorts({ all: showAll });
      printPortTable(result, { all: showAll });
      break;
    }
    case "kill": {
      const portOrPid = process.argv[3];
      if (!portOrPid) {
        console.error("Usage: perch kill <port or pid>");
        process.exit(1);
      }
      await cli.cliKill(portOrPid);
      break;
    }
    case "restart": {
      const portOrPid = process.argv[3];
      if (!portOrPid) {
        console.error("Usage: perch restart <port or pid>");
        process.exit(1);
      }
      await cli.cliRestart(portOrPid);
      break;
    }
    case "health":
      await cli.cliHealth();
      break;
    case "logs": {
      const portOrPid = process.argv[3];
      if (!portOrPid) {
        console.error("Usage: perch logs <port or pid> [--lines N]");
        process.exit(1);
      }
      const linesIdx = process.argv.indexOf("--lines");
      const lines = linesIdx !== -1 ? parseInt(process.argv[linesIdx + 1], 10) || 50 : 50;
      await cli.cliLogs(portOrPid, lines);
      break;
    }
    case "config":
      await cli.cliConfig();
      break;
    default:
      console.log("");
      console.log("Perch \u2014 Local developer dashboard");

      // Show daemon status inline
      try {
        const res = await fetch("http://localhost:7777/api/status", { signal: AbortSignal.timeout(1500) });
        if (res.ok) {
          console.log(GREEN + "  \u25CF Running on http://localhost:7777" + RESET);
        } else {
          console.log(RED + "  \u25CF Stopped" + RESET);
        }
      } catch {
        console.log(RED + "  \u25CF Stopped" + RESET);
      }

      console.log("");
      console.log("Usage:");
      console.log("  perch start            Start the Perch daemon");
      console.log("  perch stop             Stop the Perch daemon");
      console.log("  perch status           Show daemon status");
      console.log("  perch ports            List listening ports");
      console.log("  perch ports --all      List all connections");
      console.log("  perch kill <p|pid>     Kill a process by port or PID");
      console.log("  perch restart <p|pid>  Restart a process by port or PID");
      console.log("  perch health           Check service health");
      console.log("  perch logs <p|pid>     Show logs for a process");
      console.log("  perch config           Show daemon config");
      console.log("");
  }
}

main().catch(console.error);
