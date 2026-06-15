import { useState } from "react";
import { useStore } from "../store";
import { KillModal } from "./KillModal";
import { RestartModal } from "./RestartModal";
import type { ProcessInfo } from "../types";
import { sendWsMessage } from "../hooks/useWebSocket";
import { UptimeBadge } from "./UptimeBadge";
import { Sparkline } from "./Sparkline";

function formatMemory(mb: number): string {
  if (mb === 0) return "-";
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function formatCpu(cpu: number): string {
  if (cpu === 0) return "-";
  return `${cpu.toFixed(1)}%`;
}



function getStatusClass(p: ProcessInfo, healthStatus?: string): string {
  if (healthStatus === "unhealthy" || healthStatus === "unreachable") return "crashed";
  if (p.cpu > 80) return "high-cpu";
  if (p.memory > 1024 * 2) return "high-mem";
  return "";
}

function getStatusDot(p: ProcessInfo, healthStatus?: string): "running" | "warning" | "error" | "idle" {
  if (healthStatus === "unhealthy" || healthStatus === "unreachable") return "error";
  if (healthStatus === "no-port") return "idle";
  if (p.cpu > 80) return "warning";
  if (p.memory > 1024 * 2) return "warning";
  return "running";
}

export function ProcessGroups() {
  const groups = useStore((s) => s.groups);
  const processes = useStore((s) => s.processes);
  const health = useStore((s) => s.health);
  const selectedPid = useStore((s) => s.selectedPid);
  const selectPid = useStore((s) => s.selectPid);
  const searchQuery = useStore((s) => s.searchQuery);
  const [killTarget, setKillTarget] = useState<ProcessInfo | null>(null);
  const [restartTarget, setRestartTarget] = useState<ProcessInfo | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const ungroupedProcesses = processes.filter((p) => !p.groupId);

  function toggleGroup(id: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderProcessRow(p: ProcessInfo) {
    const h = health.get(p.pid);
    const status = h?.status;
    const statusDot = getStatusDot(p, status);
    const rowClass = `proc-row ${selectedPid === p.pid ? "selected" : ""} ${getStatusClass(p, status)}`;

    return (
      <tr
        key={p.pid}
        className={rowClass}
        onClick={() => selectPid(p.pid === selectedPid ? null : p.pid)}
      >
        <td className="col-status">
          <span className={`status-dot ${statusDot}`} />
        </td>
        <td className="col-name">
          <div className="proc-name">{p.name}</div>
          {p.command && <div className="proc-command">{p.command}</div>}
        </td>
        <td className="col-pid">{p.pid}</td>
        <td className="col-port">{p.port ?? "\u2014"}</td>
        <td className="col-cpu">
          <div>{formatCpu(p.cpu)}</div>
          <Sparkline data={p.cpuHistory ?? []} color="var(--status-yellow)" width={44} height={12} />
        </td>
        <td className="col-mem">
          <div>{formatMemory(p.memory)}</div>
          <Sparkline data={p.memHistory ?? []} color="var(--accent)" width={44} height={12} />
        </td>
        <td className="col-uptime"><UptimeBadge startedAt={p.startedAt} /></td>
        <td className="col-actions">
          <div className="cell-actions">
            <button
              className="btn btn-ghost btn-sm"
              onClick={(e) => { e.stopPropagation(); setRestartTarget(p); }}
              title="Restart process"
            >
              Restart
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={(e) => { e.stopPropagation(); setKillTarget(p); }}
              title="Kill process"
            >
              Kill
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      <div className="process-list-container">
        {groups.length > 0 ? (
          groups.map((group) => {
            const groupProcs = processes.filter((p) => p.groupId === group.id);
            const filtered = searchQuery
              ? groupProcs.filter(
                  (p) =>
                    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.pid.toString().includes(searchQuery)
                )
              : groupProcs;
            const running = groupProcs.filter((p) => health.get(p.pid)?.status === "healthy").length;
            const isCollapsed = collapsedGroups.has(group.id);

            return (
              <div key={group.id} className="group-section">
                <div className="group-header" onClick={() => toggleGroup(group.id)}>
                  <div className="group-header-left">
                    <span className={`group-chevron ${!isCollapsed ? "open" : ""}`}>&#9654;</span>
                    <span className="group-name">{group.name}</span>
                    <span className="group-status">
                      {running > 0 ? `${running}/${groupProcs.length} running` : "0 running"}
                    </span>
                  </div>
                  <div className="group-header-actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => { e.stopPropagation(); sendWsMessage({ type: "startGroup", groupId: group.id }); }}
                      title="Start all services"
                    >
                      Start group
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => { e.stopPropagation(); sendWsMessage({ type: "killGroup", groupId: group.id }); }}
                      title="Kill all services"
                    >
                      Kill group
                    </button>
                  </div>
                </div>
                <div className={`group-processes-wrap ${isCollapsed ? "collapsed" : ""}`}>
                  {filtered.length === 0 ? (
                    <div className="group-empty">
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                        No running processes
                      </span>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                        Start the group to see processes here
                      </span>
                    </div>
                  ) : (
                    <table className="proc-table">
                      <thead>
                        <tr>
                          <th className="col-status" />
                          <th className="col-name">Name</th>
                          <th className="col-pid">PID</th>
                          <th className="col-port">Port</th>
                          <th className="col-cpu">CPU</th>
                          <th className="col-mem">Memory</th>
                          <th className="col-uptime">Uptime</th>
                          <th className="col-actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(renderProcessRow)}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })
        ) : ungroupedProcesses.length > 0 ? (
          <table className="proc-table">
            <thead>
              <tr>
                <th className="col-status" />
                <th className="col-name">Name</th>
                <th className="col-pid">PID</th>
                <th className="col-port">Port</th>
                <th className="col-cpu">CPU</th>
                <th className="col-mem">Memory</th>
                <th className="col-uptime">Uptime</th>
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {ungroupedProcesses.map(renderProcessRow)}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="empty-state__icon">&#9881;</div>
            <h3 className="empty-state__title">No processes running</h3>
            <p className="empty-state__description">Start a service group or add a process manually.</p>
            {groups.length > 0 && (
              <>
                <div className="empty-state__actions">
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      className="btn btn-primary btn-sm"
                      onClick={() => sendWsMessage({ type: "startGroup", groupId: g.id })}
                    >
                      Start {g.name}
                    </button>
                  ))}
                </div>
              </>
            )}
            <p className="helper-text" style={{ marginTop: "12px" }}>
              Perch is monitoring your local environment.<br />
              Start a service to see it here.
            </p>
          </div>
        )}
      </div>

      {killTarget && (
        <KillModal
          pid={killTarget.pid}
          name={killTarget.name}
          onClose={() => setKillTarget(null)}
        />
      )}
      {restartTarget && (
        <RestartModal
          pid={restartTarget.pid}
          name={restartTarget.name}
          onClose={() => setRestartTarget(null)}
        />
      )}
    </>
  );
}
