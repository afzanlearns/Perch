import { create } from "zustand";
import type { ProcessInfo, LogLine, HealthResult, GroupInfo, CrashAlert, PortViolation, InspectorRequest, ActiveInspector } from "./types";

interface ControlToast {
  id: string;
  message: string;
  success: boolean;
  timestamp: number;
}

interface StoreState {
  processes: ProcessInfo[];
  env: Record<string, string>;
  health: Map<number, HealthResult>;
  logsBuffer: Record<number, LogLine[]>;
  selectedPid: number | null;
  connected: boolean;
  loading: boolean;
  error: string | null;
  toasts: ControlToast[];
  darkMode: boolean;

  groups: GroupInfo[];
  favorites: string[];
  searchQuery: string;
  showSettings: boolean;
  showOnboarding: boolean;

  // Feature 1: Crash Alerts
  crashAlerts: CrashAlert[];

  // Feature 3: Port Violations
  portViolations: PortViolation[];

  // Feature 4: Inspector
  inspectorRequests: Record<number, InspectorRequest[]>;
  activeInspectors: ActiveInspector[];

  setProcesses: (processes: ProcessInfo[]) => void;
  setEnv: (env: Record<string, string>) => void;
  setHealth: (health: HealthResult[]) => void;
  addLogs: (pid: number, logs: LogLine[]) => void;
  appendLog: (pid: number, line: LogLine) => void;
  selectPid: (pid: number | null) => void;
  setConnected: (connected: boolean) => void;
  setError: (error: string | null) => void;
  addToast: (toast: ControlToast) => void;
  removeToast: (id: string) => void;
  toggleDarkMode: () => void;

  setGroups: (groups: GroupInfo[]) => void;
  setFavorites: (favs: string[]) => void;
  setSearchQuery: (q: string) => void;
  setShowSettings: (v: boolean) => void;
  setShowOnboarding: (v: boolean) => void;

  addCrashAlert: (alert: CrashAlert) => void;
  dismissCrashAlert: (pid: number) => void;

  setPortViolations: (violations: PortViolation[]) => void;

  addInspectorRequest: (req: InspectorRequest) => void;
  setActiveInspectors: (inspectors: ActiveInspector[]) => void;
}

const MAX_LOG_LINES = 500;
const MAX_INSPECTOR_REQUESTS = 200;

function getInitialDarkMode(): boolean {
  const stored = localStorage.getItem("perch:theme");
  if (stored === "dark") return true;
  return false;
}

const onboardingShown = localStorage.getItem("perch-onboarding-shown");

export const useStore = create<StoreState>((set) => ({
  processes: [],
  env: {},
  health: new Map(),
  logsBuffer: {},
  selectedPid: null,
  connected: false,
  loading: true,
  error: null,
  toasts: [],
  darkMode: getInitialDarkMode(),

  groups: [],
  favorites: [],
  searchQuery: "",
  showSettings: false,
  showOnboarding: !onboardingShown,

  crashAlerts: [],
  portViolations: [],
  inspectorRequests: {},
  activeInspectors: [],

  setProcesses: (processes) => set({ processes, loading: false }),

  setEnv: (env) => set({ env }),

  setHealth: (healthArray) => {
    const map = new Map<number, HealthResult>();
    for (const h of healthArray) map.set(h.pid, h);
    set({ health: map });
  },

  addLogs: (pid, logs) =>
    set((state) => {
      const existing = state.logsBuffer[pid] ?? [];
      const merged = [...existing, ...logs].slice(-MAX_LOG_LINES);
      return { logsBuffer: { ...state.logsBuffer, [pid]: merged } };
    }),

  appendLog: (pid, line) =>
    set((state) => {
      const existing = state.logsBuffer[pid] ?? [];
      const updated = [...existing, line].slice(-MAX_LOG_LINES);
      return { logsBuffer: { ...state.logsBuffer, [pid]: updated } };
    }),

  selectPid: (pid) => set({ selectedPid: pid }),

  setConnected: (connected) => set({ connected }),
  setError: (error) => set({ error, loading: false }),

  addToast: (toast) =>
    set((state) => ({ toasts: [...state.toasts, toast].slice(-5) })),

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  toggleDarkMode: () =>
    set((state) => ({ darkMode: !state.darkMode })),

  setGroups: (groups) => set({ groups }),
  setFavorites: (favs) => set({ favorites: favs }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setShowSettings: (v) => set({ showSettings: v }),
  setShowOnboarding: (v) => {
    if (v === false) localStorage.setItem("perch-onboarding-shown", "true");
    set({ showOnboarding: v });
  },

  addCrashAlert: (alert) =>
    set((state) => ({
      crashAlerts: [
        ...state.crashAlerts.filter((a) => a.pid !== alert.pid),
        alert,
      ].slice(-10),
    })),

  dismissCrashAlert: (pid) =>
    set((state) => ({
      crashAlerts: state.crashAlerts.filter((a) => a.pid !== pid),
    })),

  setPortViolations: (violations) => set({ portViolations: violations }),

  addInspectorRequest: (req) =>
    set((state) => {
      const existing = state.inspectorRequests[req.targetPort] ?? [];
      const updated = [...existing, req].slice(-MAX_INSPECTOR_REQUESTS);
      return { inspectorRequests: { ...state.inspectorRequests, [req.targetPort]: updated } };
    }),

  setActiveInspectors: (inspectors) => set({ activeInspectors: inspectors }),
}));
