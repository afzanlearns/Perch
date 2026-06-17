import { useEffect, useRef } from "react";
import { useStore } from "../store";

function getWsUrl(): string {
  if (typeof window !== "undefined" && (window as any).__PERCH_WS_URL__) {
    return (window as any).__PERCH_WS_URL__;
  }
  if (typeof window !== "undefined" && window.location.protocol === "file:") {
    return "ws://localhost:7777/ws";
  }
  const host = window.location.hostname || "localhost";
  return `ws://${host}:7777/ws`;
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  const setProcesses        = useStore((s) => s.setProcesses);
  const setSystemStats      = useStore((s) => s.setSystemStats);
  const setEnv              = useStore((s) => s.setEnv);
  const setHealth           = useStore((s) => s.setHealth);
  const addLogs             = useStore((s) => s.addLogs);
  const appendLog           = useStore((s) => s.appendLog);
  const setConnected        = useStore((s) => s.setConnected);
  const setError            = useStore((s) => s.setError);
  const addToast            = useStore((s) => s.addToast);
  const setGroups           = useStore((s) => s.setGroups);
  const setFavorites        = useStore((s) => s.setFavorites);
  const addCrashAlert       = useStore((s) => s.addCrashAlert);
  const setPortViolations   = useStore((s) => s.setPortViolations);
  const addInspectorRequest = useStore((s) => s.addInspectorRequest);
  const setActiveInspectors = useStore((s) => s.setActiveInspectors);

  useEffect(() => {
    (window as any).__perchWs = () => wsRef.current;
  }, []);

  useEffect(() => {
    const WS_URL = getWsUrl();

    function connect() {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          retryCountRef.current = 0;
          setConnected(true);
          setError(null);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);

            switch (msg.type) {
              case "initial":
                console.log("[WS-RENDERER] initial message received. msg.system:", JSON.stringify(msg.system));
                setProcesses(msg.processes ?? []);
                setSystemStats(msg.system ?? null);
                setEnv(msg.env ?? {});
                setHealth(msg.health ?? []);
                setGroups(msg.groups ?? []);
                setFavorites(msg.favorites ?? []);
                break;

              case "processes:update":
                console.log("[WS-RENDERER] processes:update — msg.system:", JSON.stringify(msg.system));
                setProcesses(msg.processes ?? []);
                setSystemStats(msg.system ?? null);
                break;

              case "health:update":
                setHealth(msg.health ?? []);
                break;

              case "groups:update":
                setGroups(msg.groups ?? []);
                setFavorites(msg.favorites ?? []);
                break;

              case "logs:initial":
                addLogs(msg.pid, msg.logs ?? []);
                break;

              case "log":
                if (msg.pid && msg.line) {
                  appendLog(msg.pid, msg.line);
                }
                break;

              case "control:result":
                addToast({
                  id: `${Date.now()}-${Math.random()}`,
                  message: msg.message,
                  success: msg.success,
                  timestamp: Date.now(),
                });
                break;

              case "port:swap:result":
                addToast({
                  id: `swap-${Date.now()}`,
                  message: msg.message,
                  success: msg.success,
                  timestamp: Date.now(),
                });
                break;

              // Feature 1: Crash Alerts
              case "process:crash":
                addCrashAlert({
                  pid: msg.pid,
                  name: msg.name,
                  exitCode: msg.exitCode,
                  signal: msg.signal,
                  lastLogs: msg.lastLogs ?? [],
                  timestamp: msg.timestamp ?? Date.now(),
                });
                break;

              // Feature 3: Port Violations
              case "port:violations":
                setPortViolations(msg.violations ?? []);
                break;

              // Feature 4: Inspector
              case "inspector:request":
                addInspectorRequest(msg.record);
                break;

              case "inspector:started":
              case "inspector:stopped":
                setActiveInspectors(msg.activeInspectors ?? []);
                break;
            }
          } catch {
            // ignore bad messages
          }
        };

        ws.onclose = () => {
          setConnected(false);
          scheduleReconnect();
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        scheduleReconnect();
      }
    }

    function scheduleReconnect() {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      retryCountRef.current++;
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [setProcesses, setSystemStats, setEnv, setHealth, addLogs, appendLog, setConnected, setError, addToast,
      setGroups, setFavorites, addCrashAlert, setPortViolations, addInspectorRequest, setActiveInspectors]);
}

/** Send a message via the shared WebSocket connection. */
export function sendWsMessage(payload: Record<string, unknown>): boolean {
  const ws: WebSocket | null = (window as any).__perchWs?.();
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
    return true;
  }
  return false;
}
