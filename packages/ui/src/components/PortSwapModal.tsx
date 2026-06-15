import { useState } from "react";
import { sendWsMessage } from "../hooks/useWebSocket";

interface Props {
  pid: number;
  currentPort: number;
  processName: string;
  onClose: () => void;
}

const COMMON_PORTS = [3000, 3001, 3002, 4000, 4001, 5000, 5173, 5174, 5175, 8000, 8080, 8081, 8443, 9000];

export function PortSwapModal({ pid, currentPort, processName, onClose }: Props) {
  const [newPort, setNewPort] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions = COMMON_PORTS.filter((p) => p !== currentPort);

  function handleSwap() {
    const port = parseInt(newPort, 10);
    if (isNaN(port) || port < 1024 || port > 65535) {
      setError("Port must be between 1024 and 65535.");
      return;
    }
    setError(null);
    setPending(true);
    const sent = sendWsMessage({ type: "port:swap", pid, oldPort: currentPort, newPort: port });
    if (!sent) {
      setError("Not connected to daemon. Retry in a moment.");
      setPending(false);
      return;
    }
    // Close after a brief moment — the toast will report success/failure
    setTimeout(() => {
      setPending(false);
      onClose();
    }, 600);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <span className="modal-title">Swap Port</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            <span className="mono-value">{processName}</span> is running on{" "}
            <span className="mono-value" style={{ color: "var(--accent)" }}>:{currentPort}</span>.
            Choose a new port to restart it on.
          </div>

          <div>
            <label style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", display: "block", marginBottom: 6 }}>
              NEW PORT
            </label>
            <input
              className="port-input"
              type="number"
              min={1024}
              max={65535}
              placeholder="e.g. 5174"
              value={newPort}
              onChange={(e) => { setNewPort(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSwap(); if (e.key === "Escape") onClose(); }}
              autoFocus
              style={{
                width: "100%",
                padding: "8px 10px",
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-sm)",
                outline: "none",
              }}
            />
          </div>

          <div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: 8 }}>QUICK SELECT</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {suggestions.slice(0, 10).map((p) => (
                <button
                  key={p}
                  onClick={() => setNewPort(String(p))}
                  className={`port-chip ${newPort === String(p) ? "port-chip--active" : ""}`}
                >
                  :{p}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ fontSize: "var(--text-xs)", color: "var(--status-red)", padding: "6px 8px", background: "var(--status-red-bg)", border: "1px solid var(--status-red-border)" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSwap}
              disabled={pending || !newPort}
            >
              {pending ? "Swapping…" : `Move to :${newPort || "—"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
