import { useState, useRef, useEffect, useCallback } from "react";
import { useStore } from "../store";
import { sendWsMessage } from "../hooks/useWebSocket";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const processes = useStore((s) => s.processes);
  const selectPid = useStore((s) => s.selectPid);
  const selectedPid = useStore((s) => s.selectedPid);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlightIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleClose = useCallback(() => {
    setQuery("");
    onClose();
  }, [onClose]);

  const results = query
    ? processes.filter((p) => {
        const q = query.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.pid.toString().includes(q) ||
          (p.port && p.port.toString().includes(q)) ||
          p.command.toLowerCase().includes(q)
        );
      })
    : processes.slice(0, 20);

  function handleSelect(pid: number) {
    selectPid(pid);
    handleClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      handleClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, results.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && results[highlightIdx]) {
      handleSelect(results[highlightIdx].pid);
      return;
    }
  }

  function highlightMatch(text: string): React.ReactNode {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark>{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  }

  function handleAction(e: React.MouseEvent, action: string, pid: number) {
    e.stopPropagation();
    if (action === "kill") {
      sendWsMessage({ type: "kill", pid });
    } else if (action === "restart") {
      sendWsMessage({ type: "restart", pid });
    } else if (action === "select") {
      handleSelect(pid);
    }
  }

  if (!open) return null;

  return (
    <div
      className="command-palette-overlay"
      onClick={handleClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Command palette"
    >
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-input-wrap">
          <span className="command-palette-icon">&#8981;</span>
          <input
            ref={inputRef}
            className="command-palette-input"
            type="text"
            placeholder="Search processes, ports, PIDs..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlightIdx(0);
            }}
            onKeyDown={handleKeyDown}
            aria-label="Search"
          />
        </div>
        <div className="command-palette-results" role="listbox">
          {results.length === 0 ? (
            <div className="command-palette-empty">No results found</div>
          ) : (
            results.map((p, i) => (
              <div
                key={p.pid}
                className={`command-palette-item ${highlightIdx === i ? "highlighted" : ""} ${selectedPid === p.pid ? "active" : ""}`}
                onClick={() => handleSelect(p.pid)}
                role="option"
                aria-selected={highlightIdx === i}
              >
                <span className="command-palette-item-icon">{p.port ? "\u26BF" : "\u2699"}</span>
                <div className="command-palette-item-info">
                  <div className="command-palette-item-name">
                    {highlightMatch(p.name)}
                  </div>
                  <div className="command-palette-item-meta">
                    PID {p.pid}
                    {p.port ? ` \u00B7 Port ${p.port}` : ""}
                    {p.groupId ? ` \u00B7 ${p.groupId}` : ""}
                  </div>
                </div>
                <div className="command-palette-item-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => handleAction(e, "restart", p.pid)}
                    title="Restart process"
                  >
                    Restart
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => handleAction(e, "kill", p.pid)}
                    title="Kill process"
                  >
                    Kill
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
