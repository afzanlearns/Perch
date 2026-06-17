import { useStore } from "../store";

export type View = "processes" | "ports" | "logs" | "env" | "projects" | "graph" | "inspector";

interface NavRailProps {
  activeView: View;
  onViewChange: (view: View) => void;
}

function ProcessIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function PortIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="6" width="12" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <line x1="4" y1="10" x2="4" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="10" x2="12" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6" y1="6" x2="6" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10" y1="6" x2="10" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function LogIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <line x1="3" y1="4" x2="13" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EnvIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="5" y1="5" x2="8" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="5" y1="11" x2="7" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ProjectIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M2 4C2 2.89543 2.89543 2 4 2H12C13.1046 2 14 2.89543 14 4V12C14 13.1046 13.1046 14 12 14H4C2.89543 14 2 13.1046 2 12V4Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 2L6 14" stroke="currentColor" strokeWidth="1.5" />
      <line x1="2" y1="7" x2="6" y2="7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function GraphIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="8" cy="3" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="3" cy="13" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="13" cy="13" r="2" stroke="currentColor" strokeWidth="1.5" />
      <line x1="6.5" y1="4.5" x2="4" y2="11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9.5" y1="4.5" x2="12" y2="11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="5" y1="13" x2="11" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function InspectorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.5" />
      <line x1="5" y1="9" x2="8" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="5" y1="11.5" x2="11" y2="11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const navItems: { id: View; label: string; icon: JSX.Element }[] = [
  { id: "processes", label: "Processes",   icon: <ProcessIcon /> },
  { id: "ports",     label: "Ports",       icon: <PortIcon /> },
  { id: "logs",      label: "Logs",        icon: <LogIcon /> },
  { id: "env",       label: "Environment", icon: <EnvIcon /> },
  { id: "graph",     label: "Graph",       icon: <GraphIcon /> },
  { id: "inspector", label: "Inspector",   icon: <InspectorIcon /> },
  { id: "projects",  label: "Projects",    icon: <ProjectIcon /> },
];

export function NavRail({ activeView, onViewChange }: NavRailProps) {
  const connected   = useStore((s) => s.connected);
  const crashAlerts = useStore((s) => s.crashAlerts);

  return (
    <nav className="nav-rail" role="navigation">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`nav-rail-item ${activeView === item.id ? "active" : ""}`}
          onClick={() => onViewChange(item.id)}
          title={item.label}
          aria-label={item.label}
          aria-current={activeView === item.id ? "page" : undefined}
        >
          {item.icon}
          {item.id === "processes" && crashAlerts.length > 0 && (
            <span className="badge-count">{crashAlerts.length}</span>
          )}
        </button>
      ))}
      <div className="nav-rail-spacer" />
      <div className={`nav-rail-dot ${connected ? "connected" : "disconnected"}`} title={connected ? "Connected" : "Disconnected"} />
    </nav>
  );
}
