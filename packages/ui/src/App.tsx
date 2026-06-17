import { useState, useCallback, useEffect, ReactNode } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { sendWsMessage } from "./hooks/useWebSocket";
import { useKeyboard } from "./hooks/useKeyboard";
import { ProcessGroups } from "./components/ProcessGroups";
import { Favorites } from "./components/Favorites";
import { Settings } from "./components/Settings";
import { OnboardingModal } from "./components/OnboardingModal";
import { Titlebar } from "./components/Titlebar";
import { NavRail } from "./components/NavRail";
import type { View } from "./components/NavRail";
import { StatusBar } from "./components/StatusBar";
import { CommandPalette } from "./components/CommandPalette";
import { DetailPanel } from "./components/DetailPanel";
import { PortSwapModal } from "./components/PortSwapModal";
import { CrashNotification } from "./components/CrashNotification";
import { DependencyGraph } from "./components/DependencyGraph";
import { Inspector } from "./components/Inspector";
import { UptimeBadge } from "./components/UptimeBadge";
import { Sparkline } from "./components/Sparkline";
import { ConfigEditor } from "./components/ConfigEditor";
import { useStore } from "./store";

// ── Helpers ───────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}

function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon}</div>
      <h3 className="empty-state__title">{title}</h3>
      <p className="empty-state__description">{description}</p>
      {(action || secondaryAction) && (
        <div className="empty-state__actions">
          {action && (
            <button className="btn btn-primary" onClick={action.onClick}>
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button className="btn btn-ghost" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const KNOWN_SERVICES: Record<number, { name: string; color: string }> = {
  3000:  { name: "React/Next",  color: "#61dafb" },
  3001:  { name: "Dev Alt",     color: "#888" },
  3306:  { name: "MySQL",       color: "#f29111" },
  4000:  { name: "API",         color: "#a855f7" },
  5173:  { name: "Vite",        color: "#646cff" },
  5174:  { name: "Vite Alt",    color: "#646cff" },
  5432:  { name: "PostgreSQL",  color: "#336791" },
  6379:  { name: "Redis",       color: "#d82c20" },
  7777:  { name: "Perch",       color: "#f97316" },
  8000:  { name: "Django",      color: "#092e20" },
  8080:  { name: "HTTP Alt",    color: "#888" },
  8443:  { name: "HTTPS Alt",   color: "#888" },
  9000:  { name: "PHP-FPM",     color: "#8892bf" },
  27017: { name: "MongoDB",     color: "#4db33d" },
};

function getServiceInfo(port: number) {
  return KNOWN_SERVICES[port] ?? null;
}

function HealthDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    healthy:     "var(--success)",
    unhealthy:   "var(--danger)",
    unreachable: "var(--warning)",
    "no-port":   "var(--text-muted)",
  };
  const color = colors[status] ?? "var(--text-muted)";
  return (
    <span
      title={status}
      style={{
        display: "inline-block",
        width: 7, height: 7,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

function StateBadge({ state }: { state: string }) {
  const variants: Record<string, { color: string; label: string }> = {
    LISTENING:   { color: "green",  label: "Listening" },
    ESTABLISHED: { color: "blue",   label: "Connected" },
    TIME_WAIT:   { color: "yellow", label: "Closing" },
    CLOSE_WAIT:  { color: "yellow", label: "Close Wait" },
    CLOSED:      { color: "gray",   label: "Closed" },
  };
  const v = variants[state] ?? { color: "gray", label: state };
  return <span className={`state-badge state-badge--${v.color}`}>{v.label}</span>;
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [activeView, setActiveView]   = useState<View>("processes");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [copiedPort, setCopiedPort]   = useState<number | null>(null);
  const [swapTarget, setSwapTarget]   = useState<{ pid: number; port: number; name: string } | null>(null);
  const [portFilter, setPortFilter]   = useState("");
  const [stoppingPid, setStoppingPid] = useState<number | null>(null);
  const [showConfigEditor, setShowConfigEditor] = useState(false);

  useWebSocket();
  useKeyboard();

  const connected      = useStore((s) => s.connected);
  const error          = useStore((s) => s.error);
  const processes      = useStore((s) => s.processes);
  const groups         = useStore((s) => s.groups);
  const health         = useStore((s) => s.health);
  const toasts         = useStore((s) => s.toasts);
  const removeToast    = useStore((s) => s.removeToast);
  const logsBuffer     = useStore((s) => s.logsBuffer);
  const selectedPid    = useStore((s) => s.selectedPid);
  const selectPid      = useStore((s) => s.selectPid);
  const portViolations = useStore((s) => s.portViolations);

  const handleSearchOpen  = useCallback(() => setCommandPaletteOpen(true), []);
  const handleSearchClose = useCallback(() => setCommandPaletteOpen(false), []);
  const goToProcesses     = useCallback(() => setActiveView("processes"), []);

  useEffect(() => {
    function onOpenPalette() { setCommandPaletteOpen(true); }
    window.addEventListener("perch:open-palette", onOpenPalette);
    return () => window.removeEventListener("perch:open-palette", onOpenPalette);
  }, []);

  // Listen for config editor open event from Settings
  useEffect(() => {
    function onOpenConfig() { setShowConfigEditor(true); }
    window.addEventListener("perch:open-config-editor", onOpenConfig);
    return () => window.removeEventListener("perch:open-config-editor", onOpenConfig);
  }, []);

  const copyToClipboard = useCallback((text: string, port: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedPort(port);
      setTimeout(() => setCopiedPort(null), 1500);
    });
  }, []);

  const handleStopPort = useCallback((pid: number) => {
    setStoppingPid(pid);
    sendWsMessage({ type: "kill", pid });
    setTimeout(() => setStoppingPid(null), 2000);
  }, []);

  const handleRestartPort = useCallback((pid: number) => {
    sendWsMessage({ type: "restart", pid });
  }, []);

  const portProcesses = processes
    .filter((p) => p.port !== null)
    .sort((a, b) => (a.port ?? 0) - (b.port ?? 0));

  const filteredPorts = portFilter.trim()
    ? portProcesses.filter((p) =>
        String(p.port).includes(portFilter) ||
        p.name.toLowerCase().includes(portFilter.toLowerCase()) ||
        String(p.pid).includes(portFilter)
      )
    : portProcesses;

  const logPid     = selectedPid ?? portProcesses[0]?.pid ?? null;
  const logLines   = logPid ? (logsBuffer[logPid] ?? []) : [];
  const logProcess = processes.find((p) => p.pid === logPid);

  const handleStartAll = useCallback(() => {
    groups.forEach((g) => sendWsMessage({ type: "startGroup", groupId: g.id }));
  }, [groups]);

  const handleStopAll = useCallback(() => {
    groups.forEach((g) => sendWsMessage({ type: "killGroup", groupId: g.id }));
  }, [groups]);

  const violationPorts = new Set(portViolations.map((v) => v.port));

  return (
    <div className="app">
      <Titlebar onSearchOpen={handleSearchOpen} />

      <div className="app-body">
        <NavRail activeView={activeView} onViewChange={setActiveView} />

        <div className="main-content">
          {error && (
            <div className="banner banner--error">{error}</div>
          )}
          {!connected && !error && (
            <div className="banner banner--warning">
              Connecting to Perch daemon on :7777… Retrying with exponential backoff.
            </div>
          )}

          {/* ══ PROCESSES VIEW ══ */}
          {activeView === "processes" && (
            <>
              <div className="main-header">
                <h1 className="page-title">Processes</h1>
                <div className="main-actions">
                  {groups.length > 0 && (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={handleStartAll}>Start All</button>
                      <button className="btn btn-ghost btn-sm" onClick={handleStopAll}>Stop All</button>
                    </>
                  )}
                </div>
              </div>
              <Favorites />
              <ProcessGroups />
            </>
          )}

          {/* ══ PORTS VIEW ══ */}
          {activeView === "ports" && (
            <>
              <div className="main-header">
                <h1 className="page-title">Ports</h1>
                <div className="main-actions">
                  <input
                    className="search-input search-input--sm"
                    placeholder="Filter by port, process, PID…"
                    value={portFilter}
                    onChange={(e) => setPortFilter(e.target.value)}
                    style={{ width: 220 }}
                  />
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginLeft: 8 }}>
                    {filteredPorts.length} / {portProcesses.length} ports
                  </span>
                </div>
              </div>

              {/* Port violation banner */}
              {portViolations.length > 0 && (
                <div className="port-violation-banner">
                  ⚠ {portViolations.length} port reservation{portViolations.length > 1 ? "s" : ""} violated:{" "}
                  {portViolations.map((v) => `${v.expectedLabel} on :${v.port} is occupied by ${v.actualName}`).join(" · ")}
                </div>
              )}

              <div className="process-list-container">
                {portProcesses.length === 0 ? (
                  <EmptyState
                    icon={<>&#9741;</>}
                    title="No ports in use"
                    description="Ports appear here when a process starts listening. Start a service from the Processes view."
                    action={{ label: "Go to Processes", onClick: goToProcesses }}
                  />
                ) : filteredPorts.length === 0 ? (
                  <EmptyState
                    icon={<>&#9741;</>}
                    title="No ports match that filter"
                    description={`${portProcesses.length} port${portProcesses.length !== 1 ? "s" : ""} active, none matching "${portFilter}".`}
                    action={{ label: "Clear filter", onClick: () => setPortFilter("") }}
                  />
                ) : (
                  <table className="proc-table ports-table">
                    <thead>
                      <tr>
                        <th style={{ width: 130 }}>Port</th>
                        <th>Process</th>
                        <th style={{ width: 80 }}>PID</th>
                        <th style={{ width: 90 }}>State</th>
                        <th style={{ width: 75 }}>Health</th>
                        <th style={{ width: 70 }}>CPU</th>
                        <th style={{ width: 70 }}>Mem</th>
                        <th style={{ width: 90 }}>Uptime</th>
                        <th style={{ width: 200, textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPorts.map((p) => {
                        const svc     = getServiceInfo(p.port!);
                        const h       = health.get(p.pid);
                        const isPerch = p.port === 7777;
                        const hasViolation = violationPorts.has(p.port!);

                        return (
                          <tr
                            key={`port-${p.pid}`}
                            className={`port-row ${selectedPid === p.pid ? "port-row--selected" : ""} ${hasViolation ? "port-row--violation" : ""}`}
                            onClick={() => selectPid(p.pid)}
                          >
                            {/* Port number */}
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {hasViolation && <span title="Port reservation violated" style={{ color: "var(--warning)", fontSize: 12 }}>⚠</span>}
                                <button
                                  className="port-number"
                                  onClick={(e) => { e.stopPropagation(); copyToClipboard(String(p.port), p.port!); }}
                                  title="Click to copy port number"
                                >
                                  <span>:{p.port}</span>
                                  <span className="copy-icon" style={{ fontSize: 10 }}>
                                    {copiedPort === p.port ? <span style={{ color: "var(--success)" }}>✓</span> : "⎘"}
                                  </span>
                                </button>
                                {svc && (
                                  <span className="port-row__service-hint" style={{ color: svc.color }}>
                                    {svc.name}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Process name */}
                            <td><div className="proc-name" title={p.name}>{p.name}</div></td>

                            {/* PID */}
                            <td><span className="mono-value">{p.pid}</span></td>

                            {/* State */}
                            <td><StateBadge state="LISTENING" /></td>

                            {/* Health */}
                            <td>
                              <span className={`state-badge state-badge--${h?.status === "healthy" ? "green" : h?.status === "unhealthy" ? "gray" : h?.status === "unreachable" ? "yellow" : "gray"}`}>
                                <HealthDot status={h?.status ?? "no-port"} />
                                <span>{h?.status ?? "—"}</span>
                              </span>
                            </td>

                            {/* CPU Sparkline */}
                            <td>
                              <Sparkline data={p.cpuHistory ?? []} color="var(--warning)" width={60} height={18} />
                            </td>

                            {/* Mem Sparkline */}
                            <td>
                              <Sparkline data={p.memHistory ?? []} color="var(--accent)" width={60} height={18} />
                            </td>

                            {/* Uptime */}
                            <td><UptimeBadge startedAt={p.startedAt} /></td>

                            {/* Actions */}
                            <td>
                              <div
                                className="port-actions"
                                style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button className="btn btn-ghost btn-xs" title={`Open http://localhost:${p.port}`} onClick={() => window.open(`http://localhost:${p.port}`, "_blank")}>↗</button>
                                <button className="btn btn-ghost btn-xs" title="Copy localhost URL" onClick={() => copyToClipboard(`http://localhost:${p.port}`, p.port!)}>URL</button>
                                {!isPerch && (
                                  <button className="btn btn-ghost btn-xs" title="Move to different port" onClick={() => setSwapTarget({ pid: p.pid, port: p.port!, name: p.name })}>⇄</button>
                                )}
                                {!isPerch && (
                                  <button className="btn btn-danger btn-xs" title="Stop" disabled={stoppingPid === p.pid} onClick={() => handleStopPort(p.pid)}>
                                    {stoppingPid === p.pid ? "…" : "■"}
                                  </button>
                                )}
                                {!isPerch && (
                                  <button className="btn btn-ghost btn-xs" title="Restart" onClick={() => handleRestartPort(p.pid)}>↺</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {portProcesses.length > 0 && (
                <div className="port-summary-bar">
                  <span>{portProcesses.length} port{portProcesses.length !== 1 ? "s" : ""} active</span>
                  <span>·</span>
                  <span style={{ color: "var(--success)" }}>
                    {portProcesses.filter((p) => health.get(p.pid)?.status === "healthy").length} healthy
                  </span>
                  <span>·</span>
                  <span style={{ color: "var(--danger)" }}>
                    {portProcesses.filter((p) => health.get(p.pid)?.status === "unhealthy").length} unhealthy
                  </span>
                  {portViolations.length > 0 && (
                    <>
                      <span>·</span>
                      <span style={{ color: "var(--warning)" }}>{portViolations.length} violations</span>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* ══ LOGS VIEW ══ */}
          {activeView === "logs" && (
            <>
              <div className="main-header">
                <h1 className="page-title">Logs</h1>
                {logProcess && (
                  <div className="main-actions">
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                      {logProcess.name}
                      <span className="mono-value" style={{ marginLeft: 8, color: "var(--text-muted)" }}>
                        PID {logPid}
                      </span>
                    </span>
                  </div>
                )}
              </div>
              <div className="process-list-container">
                {!logPid ? (
                  <EmptyState icon={<>&#9776;</>} title="No process selected" description="Select a running process from the Processes view to stream its logs here." action={{ label: "Go to Processes", onClick: goToProcesses }} />
                ) : logLines.length === 0 ? (
                  <EmptyState icon={<>&#9776;</>} title="No logs yet" description={`Waiting for log output from "${logProcess?.name ?? `PID ${logPid}`}"…`} action={{ label: "Go to Processes", onClick: goToProcesses }} />
                ) : (
                  <div className="log-viewer" style={{ padding: "12px 16px" }}>
                    {logLines.map((line, i) => (
                      <div
                        key={i}
                        className={`log-line log-line--${line.level}`}
                        style={{
                          fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)",
                          lineHeight: 1.7,
                          color: line.level === "stderr" ? "var(--danger)" : "var(--text-primary)",
                          padding: "1px 0",
                        }}
                      >
                        <span style={{ color: "var(--text-muted)", marginRight: 10, userSelect: "none" }}>
                          {new Date(line.timestamp).toLocaleTimeString()}
                        </span>
                        {line.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ══ ENV VIEW ══ */}
          {activeView === "env" && (
            <>
              <div className="main-header"><h1 className="page-title">Environment</h1></div>
              <div className="process-list-container">
                <EmptyState icon={<>&#8801;</>} title="Select a process to inspect environment" description="Environment variables and .env file sources appear here when a process is selected from the Processes view." action={{ label: "Go to Processes", onClick: goToProcesses }} />
              </div>
            </>
          )}

          {/* ══ GRAPH VIEW ══ */}
          {activeView === "graph" && (
            <>
              <div className="main-header">
                <h1 className="page-title">Dependency Graph</h1>
              </div>
              <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <DependencyGraph />
              </div>
            </>
          )}

          {/* ══ INSPECTOR VIEW ══ */}
          {activeView === "inspector" && (
            <>
              <div className="main-header">
                <h1 className="page-title">HTTP Inspector</h1>
              </div>
              <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <Inspector />
              </div>
            </>
          )}

          {/* ══ PROJECTS VIEW ══ */}
          {activeView === "projects" && (
            <>
              <div className="main-header"><h1 className="page-title">Projects</h1></div>
              <div className="process-list-container">
                <EmptyState icon={<>&#8962;</>} title="No projects detected" description="Perch scans your workspace automatically. Configure scan paths in perch.config.json." action={{ label: "Open Config", onClick: () => setShowConfigEditor(true) }} secondaryAction={{ label: "Scan Now", onClick: () => {} }} />
              </div>
            </>
          )}

        </div>

        <DetailPanel />
      </div>

      <StatusBar />

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.success ? "toast-success" : "toast-error"}`}>
            <span>{t.message}</span>
            <button className="toast-close" onClick={() => removeToast(t.id)}>&times;</button>
          </div>
        ))}
      </div>

      {/* Crash notifications */}
      <CrashNotification />

      <Settings onOpenConfigEditor={() => setShowConfigEditor(true)} />
      <OnboardingModal />
      <CommandPalette open={commandPaletteOpen} onClose={handleSearchClose} />

      {swapTarget && (
        <PortSwapModal
          pid={swapTarget.pid}
          currentPort={swapTarget.port}
          processName={swapTarget.name}
          onClose={() => setSwapTarget(null)}
        />
      )}

      {showConfigEditor && (
        <ConfigEditor onClose={() => setShowConfigEditor(false)} />
      )}

    </div>
  );
}
