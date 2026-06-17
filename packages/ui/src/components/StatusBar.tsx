import { useStore } from "../store";
import { formatSystemCpu, formatSystemMemory } from "../utils/format";

export function StatusBar() {
  const connected   = useStore((s) => s.connected);
  const processes   = useStore((s) => s.processes);
  const systemStats = useStore((s) => s.systemStats);
  const processCount = processes.length;
  const uniquePorts  = new Set(processes.map((p) => p.port).filter(Boolean)).size;

  if (!connected) {
    return (
      <div className="statusbar">
        <span className="statusbar-item">
          <span className="statusbar-dot disconnected" />
          Disconnected from daemon
        </span>
      </div>
    );
  }

  return (
    <div className="statusbar">
      <span className="statusbar-item">
        <span className="statusbar-dot connected" />
        Connected to daemon
      </span>
      <span className="statusbar-sep">&middot;</span>
      <span className="statusbar-item">{processCount} process{processCount !== 1 ? "es" : ""}</span>
      {uniquePorts > 0 && (
        <>
          <span className="statusbar-sep">&middot;</span>
          <span className="statusbar-item">{uniquePorts} port{uniquePorts !== 1 ? "s" : ""}</span>
        </>
      )}
      {systemStats && (
        <>
          <span className="statusbar-sep">&middot;</span>
          <span className="statusbar-item">CPU {formatSystemCpu(systemStats.cpuUsage)}</span>
          <span className="statusbar-sep">&middot;</span>
          <span className="statusbar-item">{formatSystemMemory(systemStats.usedMemMb, systemStats.totalMemMb)}</span>
        </>
      )}
      <span className="statusbar-right">v0.1.0</span>
    </div>
  );
}
