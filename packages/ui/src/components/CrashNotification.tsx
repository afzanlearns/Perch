import { useEffect, useState } from "react";
import { useStore } from "../store";
import { sendWsMessage } from "../hooks/useWebSocket";
import type { CrashAlert } from "../types";

const AUTO_DISMISS_SEC = 30;

function CrashCard({ alert, onDismiss }: { alert: CrashAlert; onDismiss: () => void }) {
  const [remaining, setRemaining] = useState(AUTO_DISMISS_SEC);

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { onDismiss(); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [onDismiss]);

  function handleRestart() {
    sendWsMessage({ type: "restart", pid: alert.pid });
    onDismiss();
  }

  const codeStr = alert.exitCode !== null ? `code ${alert.exitCode}` : "";
  const sigStr  = alert.signal ? `signal ${alert.signal}` : "";
  const reason  = [codeStr, sigStr].filter(Boolean).join(", ") || "unknown reason";

  return (
    <div className="crash-card">
      <div className="crash-card__header">
        <div className="crash-card__title">
          <span className="crash-card__dot" />
          <strong>{alert.name}</strong>
          <span className="crash-card__label">crashed</span>
        </div>
        <div className="crash-card__meta">
          <span className="mono-value" style={{ fontSize: "var(--text-xs)", color: "var(--danger)" }}>
            {reason}
          </span>
          <span className="crash-card__countdown">{remaining}s</span>
          <button className="crash-card__close" onClick={onDismiss} title="Dismiss">×</button>
        </div>
      </div>

      {alert.lastLogs.length > 0 && (
        <div className="crash-card__logs">
          {alert.lastLogs.slice(-3).map((line, i) => (
            <div
              key={i}
              className="crash-card__log-line"
              style={{ color: line.level === "stderr" ? "var(--danger)" : "var(--text-secondary)" }}
            >
              {line.message}
            </div>
          ))}
        </div>
      )}

      <div className="crash-card__actions">
        <button className="btn btn-danger btn-sm" onClick={handleRestart}>
          ↺ Restart
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onDismiss}>
          Dismiss
        </button>
      </div>

      {/* countdown progress bar */}
      <div className="crash-card__progress">
        <div
          className="crash-card__progress-fill"
          style={{ width: `${(remaining / AUTO_DISMISS_SEC) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function CrashNotification() {
  const crashAlerts     = useStore((s) => s.crashAlerts);
  const dismissCrashAlert = useStore((s) => s.dismissCrashAlert);

  if (crashAlerts.length === 0) return null;

  return (
    <div className="crash-notification-container">
      {crashAlerts.map((alert) => (
        <CrashCard
          key={alert.pid}
          alert={alert}
          onDismiss={() => dismissCrashAlert(alert.pid)}
        />
      ))}
    </div>
  );
}
