import { useState } from "react";
import { useStore } from "../store";
import { sendWsMessage } from "../hooks/useWebSocket";
import type { InspectorRequest } from "../types";

function methodColor(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":    return "var(--status-blue)";
    case "POST":   return "var(--success)";
    case "DELETE": return "var(--danger)";
    case "PUT":    return "var(--warning)";
    case "PATCH":  return "var(--accent)";
    default:       return "var(--text-secondary)";
  }
}

function statusColor(code: number | null): string {
  if (!code) return "var(--text-muted)";
  if (code < 300) return "var(--success)";
  if (code < 400) return "var(--warning)";
  if (code < 500) return "var(--warning)";
  return "var(--danger)";
}

function HeaderTable({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers);
  if (entries.length === 0) return <span style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>None</span>;
  return (
    <table className="inspector-header-table">
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k}>
            <td className="inspector-header-key">{k}</td>
            <td className="inspector-header-val">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Inspector() {
  const processes       = useStore((s) => s.processes);
  const inspectorReqs   = useStore((s) => s.inspectorRequests);
  const activeInspectors = useStore((s) => s.activeInspectors);
  const [targetPort, setTargetPort] = useState<number | null>(null);
  const [selectedReq, setSelectedReq] = useState<InspectorRequest | null>(null);

  const portProcesses = processes.filter((p) => p.port !== null);
  const activePort    = targetPort ?? activeInspectors[0]?.targetPort ?? null;
  const requests      = activePort ? (inspectorReqs[activePort] ?? []) : [];

  function startInspecting(port: number) {
    setTargetPort(port);
    sendWsMessage({ type: "inspector:start", targetPort: port });
  }

  function stopInspecting(port: number) {
    sendWsMessage({ type: "inspector:stop", targetPort: port });
    if (targetPort === port) setTargetPort(null);
  }

  const isActive = (port: number) => activeInspectors.some((i) => i.targetPort === port);

  return (
    <div className="inspector-layout">
      {/* Left sidebar */}
      <div className="inspector-sidebar">
        <div className="inspector-sidebar-header">Inspect Port</div>
        {portProcesses.length === 0 ? (
          <div style={{ padding: "12px", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            No port processes
          </div>
        ) : (
          portProcesses.map((p) => {
            const active = isActive(p.port!);
            return (
              <div
                key={p.pid}
                className={`inspector-port-row ${activePort === p.port ? "inspector-port-row--active" : ""}`}
                onClick={() => setTargetPort(p.port!)}
              >
                <div>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)" }}>
                    {p.name}
                  </div>
                  <div className="mono-value">:{p.port}</div>
                </div>
                <button
                  className={`btn btn-sm ${active ? "btn-danger" : "btn-ghost"}`}
                  onClick={(e) => { e.stopPropagation(); active ? stopInspecting(p.port!) : startInspecting(p.port!); }}
                  title={active ? "Stop inspecting" : "Start inspecting"}
                >
                  {active ? "■" : "●"}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Main request log */}
      <div className="inspector-main">
        {activePort ? (
          <>
            <div className="inspector-main-header">
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                Inspecting :{activePort}
                {activeInspectors.find((i) => i.targetPort === activePort) && (
                  <span className="mono-value" style={{ marginLeft: 8 }}>
                    → proxy :{activeInspectors.find((i) => i.targetPort === activePort)?.proxyPort}
                  </span>
                )}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedReq(null)}>
                Clear selection
              </button>
            </div>

            <div className="inspector-requests">
              {requests.length === 0 ? (
                <div className="inspector-empty">
                  {isActive(activePort)
                    ? "Waiting for requests… Send traffic to the proxy port above."
                    : "Click ● next to a port to start capturing requests."}
                </div>
              ) : (
                <table className="proc-table inspector-table">
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>Method</th>
                      <th>Path</th>
                      <th style={{ width: 60 }}>Status</th>
                      <th style={{ width: 70 }}>Latency</th>
                      <th style={{ width: 90 }}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...requests].reverse().map((req) => (
                      <tr
                        key={req.id}
                        className={`proc-row ${selectedReq?.id === req.id ? "selected" : ""}`}
                        onClick={() => setSelectedReq(selectedReq?.id === req.id ? null : req)}
                      >
                        <td>
                          <span
                            className="inspector-method"
                            style={{ color: methodColor(req.method) }}
                          >
                            {req.method}
                          </span>
                        </td>
                        <td>
                          <span className="mono-value" style={{ fontSize: "var(--text-xs)" }}>
                            {req.path.length > 60 ? req.path.slice(0, 59) + "…" : req.path}
                          </span>
                        </td>
                        <td>
                          <span className="mono-value" style={{ color: statusColor(req.statusCode), fontSize: "var(--text-xs)" }}>
                            {req.statusCode ?? "—"}
                          </span>
                        </td>
                        <td>
                          <span className="mono-value" style={{ fontSize: "var(--text-xs)" }}>
                            {req.latencyMs !== null ? `${req.latencyMs}ms` : "—"}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                            {new Date(req.timestamp).toLocaleTimeString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Detail drawer */}
            {selectedReq && (
              <div className="inspector-drawer">
                <div className="inspector-drawer-header">
                  <span className="mono-value" style={{ fontSize: "var(--text-xs)" }}>
                    <span style={{ color: methodColor(selectedReq.method) }}>{selectedReq.method}</span>
                    {" "}{selectedReq.path}
                  </span>
                  <button className="crash-card__close" onClick={() => setSelectedReq(null)}>×</button>
                </div>
                <div className="inspector-drawer-body">
                  <div className="inspector-drawer-section">
                    <div className="inspector-drawer-label">Request Headers</div>
                    <HeaderTable headers={selectedReq.requestHeaders} />
                  </div>
                  <div className="inspector-drawer-section">
                    <div className="inspector-drawer-label">Response Headers</div>
                    <HeaderTable headers={selectedReq.responseHeaders} />
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="inspector-empty" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="empty-state">
              <div className="empty-state__icon">⚿</div>
              <h3 className="empty-state__title">HTTP Inspector</h3>
              <p className="empty-state__description">Select a port from the sidebar and click ● to start capturing HTTP requests.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
