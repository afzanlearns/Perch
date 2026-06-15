import { useEffect, useCallback } from "react";
import { useStore } from "../store";
import { sendWsMessage } from "./useWebSocket";

export function useKeyboard() {
  const selectedPid = useStore((s) => s.selectedPid);
  const processes = useStore((s) => s.processes);
  const selectPid = useStore((s) => s.selectPid);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const searchQuery = useStore((s) => s.searchQuery);
  const addToast = useStore((s) => s.addToast);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      if (isMeta && e.key === "k") {
        e.preventDefault();
        // Dispatch custom event to open command palette
        window.dispatchEvent(new CustomEvent("perch:open-palette"));
        return;
      }

      if (isMeta && e.key === "w") {
        e.preventDefault();
        if (selectedPid) {
          sendWsMessage({ type: "kill", pid: selectedPid });
          addToast({ id: `${Date.now()}`, message: `Killing PID ${selectedPid}...`, success: true, timestamp: Date.now() });
        }
        return;
      }

      if (isMeta && e.key === "r") {
        e.preventDefault();
        if (selectedPid) {
          sendWsMessage({ type: "restart", pid: selectedPid });
          addToast({ id: `${Date.now()}`, message: `Restarting PID ${selectedPid}...`, success: true, timestamp: Date.now() });
        }
        return;
      }

      if (e.key === "ArrowDown" && !searchQuery) {
        e.preventDefault();
        const idx = selectedPid ? processes.findIndex((p) => p.pid === selectedPid) : -1;
        const next = idx < processes.length - 1 ? processes[idx + 1] : processes[0];
        if (next) selectPid(next.pid);
        return;
      }

      if (e.key === "ArrowUp" && !searchQuery) {
        e.preventDefault();
        const idx = selectedPid ? processes.findIndex((p) => p.pid === selectedPid) : 0;
        const prev = idx > 0 ? processes[idx - 1] : processes[processes.length - 1];
        if (prev) selectPid(prev.pid);
        return;
      }

      if (e.key === "Escape") {
        setSearchQuery("");
        return;
      }

      if (e.key === "?" && !isMeta) {
        // Could show help modal here
        return;
      }
    },
    [selectedPid, processes, selectPid, setSearchQuery, searchQuery, addToast]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
