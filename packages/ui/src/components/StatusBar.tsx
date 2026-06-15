import { useStore } from "../store";

function formatMemory(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function formatCpu(cpu: number): string {
  return `${cpu.toFixed(1)}%`;
}

export function StatusBar() {
  const connected = useStore((s) => s.connected);
  const processes = useStore((s) => s.processes);
  const processCount = processes.length;
  const uniquePorts = new Set(processes.map((p) => p.port).filter(Boolean)).size;
  const totalCpu = processes.reduce((sum, p) => sum + p.cpu, 0);
  const totalMem = processes.reduce((sum, p) => sum + p.memory, 0);

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
      {totalCpu > 0 && (
        <>
          <span className="statusbar-sep">&middot;</span>
          <span className="statusbar-item">CPU {formatCpu(totalCpu)}</span>
        </>
      )}
      {totalMem > 0 && (
        <>
          <span className="statusbar-sep">&middot;</span>
          <span className="statusbar-item">Mem {formatMemory(totalMem)}</span>
        </>
      )}
      <span className="statusbar-right">v0.1.0</span>
    </div>
  );
}
