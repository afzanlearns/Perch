import { useState } from "react";
import { useStore } from "../store";
import { HealthBadge } from "./HealthBadge";
import { KillModal } from "./KillModal";
import { RestartModal } from "./RestartModal";
import type { ProcessInfo } from "../types";

import { formatMemory, formatCpu } from "../utils/format";

export function ProcessList() {
  const processes = useStore((s) => s.processes);
  const selectedPid = useStore((s) => s.selectedPid);
  const selectPid = useStore((s) => s.selectPid);
  const health = useStore((s) => s.health);
  const [killTarget, setKillTarget] = useState<ProcessInfo | null>(null);
  const [restartTarget, setRestartTarget] = useState<ProcessInfo | null>(null);
  const [search, setSearch] = useState("");

  const filtered = search
    ? processes.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.pid.toString().includes(search)
      )
    : processes;

  return (
    <div className="process-list">
      <div className="process-list-header">
        <input
          type="text"
          placeholder="Search processes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="process-search"
        />
        <span className="process-count">{filtered.length} processes</span>
      </div>
      <div className="process-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>PID</th>
              <th>Memory</th>
              <th>CPU</th>
              <th>Port</th>
              <th>Health</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const h = health.get(p.pid);
              return (
                <tr
                  key={p.pid}
                  className={selectedPid === p.pid ? "selected" : ""}
                  onClick={() => selectPid(p.pid === selectedPid ? null : p.pid)}
                >
                  <td className="cell-name">{p.name}</td>
                  <td className="cell-pid">{p.pid}</td>
                  <td>{formatMemory(p.memory)}</td>
                  <td>{formatCpu(p.cpu)}</td>
                  <td>{p.port ?? "—"}</td>
                  <td><HealthBadge status={h?.status} /></td>
                  <td>
                    <div className="cell-actions">
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={(e) => { e.stopPropagation(); setKillTarget(p); }}
                        title="Kill process"
                      >
                        Kill
                      </button>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={(e) => { e.stopPropagation(); setRestartTarget(p); }}
                        title="Restart process"
                      >
                        Restart
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
    </div>
  );
}
