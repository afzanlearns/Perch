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

  console.log("Perch daemon started.");
  console.log("Open http://localhost:7777 in your browser.");
  process.exit(0);
}

function stopDaemon() {
  console.log("Stopping Perch daemon...");
  try {
    if (isWindows) {
      execFileSync("taskkill", ["/f", "/im", "node.exe"], { timeout: 3000, windowsHide: true, stdio: "pipe" });
    } else {
      execSync("pkill -f 'perch.*dist/index' 2>/dev/null || pkill -f 'tsx.*index.ts' 2>/dev/null", { timeout: 3000, windowsHide: true });
    }
    console.log("Perch daemon stopped.");
  } catch {
    console.log("Could not find Perch daemon to stop.");
  }
}

async function showStatus() {
  console.log("Perch daemon status:");
  try {
    const res = await fetch("http://localhost:7777/api/status");
    const data = await res.json();
    console.log("  Status: " + data.status);
    console.log("  Uptime: " + data.uptimeFormatted);
    console.log("  Processes: " + data.processCount);
  } catch {
    console.log("  Daemon is not running.");
  }
}

async function main() {
  const cmd = process.argv[2];
  switch (cmd) {
    case "start":
      await startDaemon();
      break;
    case "stop":
      stopDaemon();
      break;
    case "status":
      await showStatus();
      break;
    default:
      console.log("");
      console.log("Perch \u2014 Local developer dashboard");
      console.log("");
      console.log("Usage:");
      console.log("  perch start      Start the Perch daemon");
      console.log("  perch stop       Stop the Perch daemon");
      console.log("  perch status     Show daemon status");
      console.log("");
      console.log("Then open http://localhost:7777");
      console.log("");
  }
}

main().catch(console.error);
