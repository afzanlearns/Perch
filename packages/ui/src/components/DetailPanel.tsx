import { useState } from "react";
import { useStore } from "../store";
import { LogViewer } from "./LogViewer";
import { EnvViewer } from "./EnvViewer";
import { KeyboardShortcuts } from "./Keyboard";
import { UptimeBadge } from "./UptimeBadge";
import { Sparkline } from "./Sparkline";
import { sendWsMessage } from "../hooks/useWebSocket";

type Tab = "overview" | "logs" | "env";

function formatMemory(mb: number): string {
  if (mb === 0) return "-";
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function formatCpu(cpu: number): string {
  if (cpu === 0) return "-";
  return `${cpu.toFixed(1)}%`;
}

export function DetailPanel() {
  const [tab, setTab]    = useState<Tab>("overview");
  const selectedPid      = useStore((s) => s.selectedPid);
  const processes        = useStore((s) => s.processes);
  const logsBuffer       = useStore((s) => s.logsBuffer);
  const selectPid        = useStore((s) => s.selectPid);

  const hasProcesses = processes.length > 0;

  if (!selectedPid && !hasProcesses) {
    return (
      <div className="detail-panel empty">
        <div className="detail-panel-empty-content">
          <h3>Select a process</h3>
          <p>Click a process in the list or use arrow keys to navigate.</p>
          <KeyboardShortcuts />
        </div>
      </div>
    );
  }

  if (!selectedPid && hasProcesses) {
    const uniquePorts = new Set(processes.map((p) => p.port).filter(Boolean)).size;
    const totalCpu    = processes.reduce((sum, p) => sum + p.cpu, 0);
    const totalMem    = processes.reduce((sum, p) => sum + p.memory, 0);
    const allLogs     = Object.entries(logsBuffer)
      .flatMap(([pid, lines]) => lines.slice(-1).map((l) => ({ ...l, pid: parseInt(pid) })))
      .slice(-5);

    return (
      <div className="detail-panel" style={{ overflow: "hidden" }}>
        <div className="detail-panel-body" style={{ padding: "12px" }}>
          <div className="metric-panel" style={{ width: "100%", padding: 0, borderLeft: "none", background: "transparent" }}>
            <div className="metric-card">
              <span className="metric-card__label">Processes</span>
              <span className="metric-card__value">{processes.length}</span>
            </div>
            <div className="metric-card">
              <span className="metric-card__label">Ports</span>
              <span className="metric-card__value">{uniquePorts}</span>
            </div>
            <div className="metric-card">
              <span className="metric-card__label">CPU</span>
              <span className="metric-card__value">{formatCpu(totalCpu)}</span>
            </div>
            <div className="metric-card">
              <span className="metric-card__label">Memory</span>
              <span className="metric-card__value">{formatMemory(totalMem)}</span>
            </div>
          </div>
          {allLogs.length > 0 && (
            <div className="summary-recent-logs" style={{ marginTop: "12px" }}>
              <h3>Recent Log Events</h3>
              {allLogs.map((l, i) => {
                const proc = processes.find((p) => p.pid === l.pid);
                return (
                  <div key={i} className="summary-log-item" style={{ color: l.level === "stderr" ? "var(--status-red)" : "var(--text-tertiary)" }}>
                    <span className="summary-log-source">{proc?.name ?? `PID ${l.pid}`}</span>
                    <span>{l.message}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  const proc = processes.find((p) => p.pid === selectedPid);
  if (!proc) return null;

  return (
    <div className="detail-panel">
      <div className="detail-panel-tabs">
        <button className={`detail-panel-tab ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>Overview</button>
        <button className={`detail-panel-tab ${tab === "logs" ? "active" : ""}`} onClick={() => setTab("logs")}>Logs</button>
        <button className={`detail-panel-tab ${tab === "env" ? "active" : ""}`} onClick={() => setTab("env")}>Environment</button>
      </div>

      <div className="detail-panel-body">
        {tab === "overview" && (
          <div className="detail-overview">
            <div className="detail-overview-header">
              <div className="detail-overview-name">{proc.name}</div>
              {proc.command && (
                <div className="detail-overview-command">{proc.command}</div>
              )}
              <div className="detail-overview-meta">
                <div className="detail-meta-item">
                  <div className="detail-meta-label">PID</div>
                  <div className="detail-meta-value mono-value">{proc.pid}</div>
                </div>
                {proc.port && (
                  <div className="detail-meta-item">
                    <div className="detail-meta-label">Port</div>
                    <div className="detail-meta-value mono-value" style={{ color: "var(--accent)" }}>:{proc.port}</div>
                  </div>
                )}
                <div className="detail-meta-item">
                  <div className="detail-meta-label">CPU</div>
                  <div className="detail-meta-value">
                    {formatCpu(proc.cpu)}
                    <div style={{ marginTop: 2 }}>
                      <Sparkline data={proc.cpuHistory ?? []} color="var(--status-yellow)" width={80} height={16} />
                    </div>
                  </div>
                </div>
                <div className="detail-meta-item">
                  <div className="detail-meta-label">Memory</div>
                  <div className="detail-meta-value">
                    {formatMemory(proc.memory)}
                    <div style={{ marginTop: 2 }}>
                      <Sparkline data={proc.memHistory ?? []} color="var(--accent)" width={80} height={16} />
                    </div>
                  </div>
                </div>
                {proc.startedAt && (
                  <div className="detail-meta-item">
                    <div className="detail-meta-label">Uptime</div>
                    <div className="detail-meta-value">
                      <UptimeBadge startedAt={proc.startedAt} />
                    </div>
                  </div>
                )}
                {proc.groupId && (
                  <div className="detail-meta-item">
                    <div className="detail-meta-label">Group</div>
                    <div className="detail-meta-value">{proc.groupId}</div>
                  </div>
                )}
                {proc.serviceId && (
                  <div className="detail-meta-item">
                    <div className="detail-meta-label">Service</div>
                    <div className="detail-meta-value">{proc.serviceId}</div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
              <button className="btn btn-ghost btn-sm" onClick={() => selectPid(null)}>Close</button>
              <button className="btn btn-primary btn-sm" onClick={() => sendWsMessage({ type: "restart", pid: proc.pid })}>Restart</button>
              <button className="btn btn-danger btn-sm" onClick={() => sendWsMessage({ type: "kill", pid: proc.pid })}>Kill</button>
            </div>
          </div>
        )}
        {tab === "logs" && <LogViewer />}
        {tab === "env" && <EnvViewer />}
      </div>
    </div>
  );
}
