import { useState } from "react";
import { useStore } from "../store";

interface Props {
  onOpenConfigEditor: () => void;
}

const API_BASE = "http://localhost:7777/api";

function PortReservationPanel() {
  const [portInput, setPortInput]   = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [status, setStatus]         = useState<string | null>(null);
  const portViolations = useStore((s) => s.portViolations);
  const addToast       = useStore((s) => s.addToast);

  function handleAdd() {
    const portNum = Number(portInput);
    if (!portNum || !labelInput.trim()) { setStatus("Port and label are required."); return; }
    fetch(`${API_BASE}/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ port: portNum, label: labelInput.trim() }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          addToast({ id: `res-${Date.now()}`, message: `Reserved :${portNum} as "${labelInput}"`, success: true, timestamp: Date.now() });
          setPortInput(""); setLabelInput(""); setStatus(null);
        } else {
          setStatus(d.error ?? "Failed to add reservation");
        }
      })
      .catch(() => setStatus("Failed to connect to daemon"));
  }

  function handleRemove(port: number) {
    fetch(`${API_BASE}/reservations/${port}`, { method: "DELETE" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) addToast({ id: `res-rm-${Date.now()}`, message: `Removed reservation for :${port}`, success: true, timestamp: Date.now() });
      })
      .catch(() => {});
  }

  return (
    <div className="settings-section">
      <div className="settings-section-title">Port Reservations</div>
      {portViolations.length > 0 && (
        <div className="settings-violations">
          {portViolations.map((v) => (
            <div key={v.port} className="settings-violation-row">
              <span style={{ color: "var(--warning)" }}>⚠</span>
              <span style={{ fontSize: "var(--text-xs)", flex: 1 }}>
                <span className="mono-value">:{v.port}</span> expected {v.expectedLabel}, got {v.actualName}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 10, padding: "1px 6px" }}
                onClick={() => handleRemove(v.port)}
                title="Remove reservation"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="settings-reservation-form">
        <input
          className="settings-input"
          type="number"
          placeholder="Port"
          value={portInput}
          onChange={(e) => setPortInput(e.target.value)}
          style={{ width: 70 }}
        />
        <input
          className="settings-input"
          type="text"
          placeholder="Label (e.g. Frontend)"
          value={labelInput}
          onChange={(e) => setLabelInput(e.target.value)}
          style={{ flex: 1 }}
        />
        <button className="btn btn-ghost btn-sm" onClick={handleAdd}>Reserve</button>
      </div>
      {status && <div style={{ fontSize: "var(--text-xs)", color: "var(--danger)", marginTop: 4 }}>{status}</div>}
    </div>
  );
}

export function Settings({ onOpenConfigEditor }: Props) {
  const showSettings    = useStore((s) => s.showSettings);
  const setShowSettings = useStore((s) => s.setShowSettings);
  const darkMode        = useStore((s) => s.darkMode);
  const toggleDarkMode  = useStore((s) => s.toggleDarkMode);

  if (!showSettings) return null;

  return (
    <div className="modal-overlay" onClick={() => setShowSettings(false)}>
      <div className="modal-card settings-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Settings</h3>

        <div className="settings-body" style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
          {/* Dark mode */}
          <label className="settings-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "var(--text-sm)" }}>
            <span>Dark mode</span>
            <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} />
          </label>

          {/* Connection */}
          <div className="settings-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "var(--text-sm)" }}>
            <span>Daemon port</span>
            <span className="mono-value" style={{ color: "var(--accent)" }}>:7777</span>
          </div>

          {/* Config editor */}
          <div className="settings-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "var(--text-sm)" }}>
            <span>Config file</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setShowSettings(false); onOpenConfigEditor(); }}
            >
              Edit Config ↗
            </button>
          </div>

          {/* Port reservation */}
          <PortReservationPanel />
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => setShowSettings(false)}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
