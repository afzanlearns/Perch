import { useStore } from "../store";

export function Favorites() {
  const favorites = useStore((s) => s.favorites);
  const processes = useStore((s) => s.processes);
  const health = useStore((s) => s.health);
  const selectedPid = useStore((s) => s.selectedPid);
  const selectPid = useStore((s) => s.selectPid);

  if (favorites.length === 0) return null;

  const favProcs = processes.filter(
    (p) => p.serviceId && favorites.includes(p.serviceId)
  );

  if (favProcs.length === 0) return null;

  return (
    <div className="group-section">
      <div className="group-header" style={{ cursor: "default" }}>
        <div className="group-header-left">
          <span style={{ fontSize: "12px", color: "var(--text-muted)", width: "12px", textAlign: "center" }}>&#9733;</span>
          <span className="group-name">Favorites</span>
        </div>
      </div>
      {favProcs.map((p) => {
        const h = health.get(p.pid);
        const dotClass = h?.status === "healthy" ? "running" : h?.status === "unhealthy" || h?.status === "unreachable" ? "error" : "idle";
        return (
          <div
            key={p.pid}
            className="proc-row"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "4px 12px",
              cursor: "pointer",
              borderRadius: "4px",
              fontSize: "var(--text-sm)",
            }}
            onClick={() => selectPid(p.pid === selectedPid ? null : p.pid)}
          >
            <span className={`status-dot ${dotClass}`} />
            <span style={{ flex: 1, color: "var(--text-primary)" }}>{p.name}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{p.pid}</span>
          </div>
        );
      })}
    </div>
  );
}
