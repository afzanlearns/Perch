#!/usr/bin/env node
import psList from "ps-list";
import { execFileSync } from "child_process";
import { platform } from "os";

/**
 * Scans all active network connections and returns a sorted list of
 * port entries with process name, PID, and connection state.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.all]  Show all states (not just LISTENING/ESTABLISHED).
 */
export async function listPorts(opts = {}) {
  const isWin = platform() === "win32";

  // ── Build PID → process name map ──────────────────────────────────
  const processes = await psList();
  const pidToName = new Map();
  for (const p of processes) {
    if (!pidToName.has(p.pid)) {
      pidToName.set(p.pid, p.name || p.cmd || null);
    }
  }

  // ── Scan active connections ───────────────────────────────────────
  const rawEntries = [];

  if (isWin) {
    const output = execFileSync("netstat", ["-ano"], {
      encoding: "utf8",
      timeout: 5000,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    });

    const lines = output.split("\n");
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5 && (parts[1] || "").includes(":")) {
        const addrPart = parts[1];
        const colonIdx = addrPart.lastIndexOf(":");
        if (colonIdx > 0) {
          const port = parseInt(addrPart.slice(colonIdx + 1), 10);
          const pid = parseInt(parts[4], 10);
          if (!isNaN(port) && !isNaN(pid)) {
            rawEntries.push({ port, pid, state: parts[3] || "" });
          }
        }
      }
    }
  } else {
    const output = execFileSync("lsof", ["-i", "-P", "-n"], {
      encoding: "utf8",
      timeout: 5000,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    });

    const lines = output.split("\n");
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 9 && parts[0] !== "COMMAND") {
        const pid = parseInt(parts[1], 10);
        const addrMatch = parts[8] ? parts[8].match(/:(\d+)$/) : null;
        if (addrMatch && !isNaN(pid)) {
          const port = parseInt(addrMatch[1], 10);
          rawEntries.push({ port, pid, state: parts[7] || "" });
        }
      }
    }
  }

  const totalRaw = rawEntries.length;

  // ── Filter to developer-relevant states ────────────────────────────
  // Default: LISTENING only (port conflict diagnosis).  --all includes every state.
  const filtered = opts.all
    ? rawEntries
    : rawEntries.filter((e) => {
        return e.state.toUpperCase() === "LISTENING";
      });

  // ── Deduplicate ───────────────────────────────────────────────────
  const seen = new Set();
  const unique = [];
  for (const e of filtered) {
    const key = `${e.port}:${e.pid}:${e.state}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(e);
    }
  }

  // ── Sort by port number ───────────────────────────────────────────
  unique.sort((a, b) => a.port - b.port);

  // ── Build result rows ─────────────────────────────────────────────
  const rows = unique.map((e) => {
    const raw = pidToName.get(e.pid);
    const processName = raw ?? `Unknown Process (PID ${e.pid})`;
    return { port: e.port, process: processName, pid: e.pid, state: e.state || "?" };
  });

  return { rows, totalRaw };
}

/**
 * Displays port entries as a formatted table on stdout.
 */
export function printPortTable(result, opts = {}) {
  const rows = result.rows || result;
  const totalRaw = result.totalRaw ?? rows.length;

  if (rows.length === 0) {
    console.log("No active network connections found.");
    return;
  }

  const listeningCount = rows.filter((r) => r.state.toUpperCase() === "LISTENING").length;
  const establishedCount = rows.filter((r) => r.state.toUpperCase() === "ESTABLISHED").length;

  const colPort = 6;
  const colProc = Math.min(Math.max(...rows.map((r) => r.process.length), 8), 32);
  const colPid = 7;
  const colState = 14;

  const header = `PORT${" ".repeat(colPort - 4)} PROCESS${" ".repeat(colProc - 7)} PID${" ".repeat(colPid - 3)} STATE`;
  const sep = "─".repeat(header.length);

  console.log(header);
  console.log(sep);

  for (const r of rows) {
    const p = String(r.port);
    const proc = r.process.length > colProc ? r.process.slice(0, colProc - 1) + "\u2026" : r.process;
    const pid = String(r.pid);
    console.log(
      p + " ".repeat(colPort - p.length) +
      " " + proc + " ".repeat(colProc - proc.length) +
      " " + pid + " ".repeat(colPid - pid.length) +
      " " + r.state
    );
  }

  console.log(sep);

  // ── Summary ─────────────────────────────────────────────────────────
  if (opts.all) {
    console.log(
      `${rows.length} connection${rows.length !== 1 ? "s" : ""} ` +
      `(${listeningCount} listening, ${establishedCount} established).`
    );
  } else {
    const skipped = totalRaw - rows.length;
    const skipNote = skipped > 0
      ? ` (${skipped} non-listening connection${skipped !== 1 ? "s" : ""} hidden; use --all to show)`
      : "";
    console.log(`${listeningCount} listening port${listeningCount !== 1 ? "s" : ""}.${skipNote}`);
  }
}

// Allow running directly: `node ports-command.js`
const isMain = process.argv[1] && (
  process.argv[1].endsWith("ports-command.js") ||
  process.argv[1].endsWith("ports-command")
);
if (isMain) {
  const showAll = process.argv.includes("--all");
  listPorts({ all: showAll }).then((result) => {
    printPortTable(result, { all: showAll });
  }).catch((err) => {
    console.error("Failed to list ports:", err.message);
    process.exit(1);
  });
}
