import { useEffect, useRef } from "react";
import { useStore } from "../store";

function getApiBase(): string {
  if (typeof window !== "undefined" && (window as any).__PERCH_API_BASE__) {
    return (window as any).__PERCH_API_BASE__;
  }
  if (typeof window !== "undefined" && window.location.protocol === "file:") {
    return "http://localhost:7777/api";
  }
  const host = window.location.hostname || "localhost";
  return `http://${host}:7777/api`;
}

const API_BASE = getApiBase();
const POLL_INTERVAL = 3000;

export function useProcesses() {
  const setProcesses = useStore((s) => s.setProcesses);
  const setEnv = useStore((s) => s.setEnv);
  const setError = useStore((s) => s.setError);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function fetchProcesses() {
      try {
        const res = await fetch(`${API_BASE}/processes`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setProcesses(data.processes ?? []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch processes");
      }
    }

    async function fetchEnv() {
      try {
        const res = await fetch(`${API_BASE}/env`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setEnv(data.env ?? {});
      } catch {
        // env fetch failure is non-critical
      }
    }

    fetchProcesses();
    fetchEnv();

    intervalRef.current = setInterval(fetchProcesses, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [setProcesses, setEnv, setError]);
}
