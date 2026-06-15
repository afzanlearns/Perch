import { useRef, useEffect, useState } from "react";
import { useStore } from "../store";

export function LogViewer() {
  const selectedPid = useStore((s) => s.selectedPid);
  const logsBuffer = useStore((s) => s.logsBuffer);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);

  const logs = selectedPid ? logsBuffer[selectedPid] ?? [] : [];
  const proc = useStore((s) => s.processes.find((p) => p.pid === selectedPid));

  const filtered = search
    ? logs.filter((l) => l.message.toLowerCase().includes(search.toLowerCase()))
    : logs;

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [filtered.length, autoScroll]);

  if (!selectedPid) {
    return (
      <div className="log-viewer">
        <div className="log-empty">Select a process to view logs</div>
      </div>
    );
  }

  return (
    <div className="detail-logs">
      <div className="log-viewer-header">
        <span className="log-viewer-title">
          {proc ? `${proc.name} (PID ${proc.pid})` : `PID ${selectedPid}`}
        </span>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="log-viewer-search"
        />
        <label className="log-auto-scroll">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          Auto
        </label>
      </div>
      <div className="log-viewer-content">
        {filtered.length === 0 ? (
          <div className="log-empty">No logs available</div>
        ) : (
          filtered.map((line, i) => (
            <div key={i} className={`log-line log-${line.level}`}>
              <span className="log-time">
                {new Date(line.timestamp).toLocaleTimeString()}
              </span>
              <span className="log-level">{line.level === "stdout" ? "out" : "err"}</span>
              <span className="log-msg">{line.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
