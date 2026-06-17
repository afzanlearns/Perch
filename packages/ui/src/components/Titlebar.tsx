import { useEffect } from "react";
import { useStore } from "../store";
import { PerchLogo } from "./PerchLogo";

interface TitlebarProps {
  onSearchOpen: () => void;
}

function SearchIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12.5 8.5A6 6 0 0 1 6.5 2.5 6 6 0 1 0 12.5 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="3" stroke="currentColor" strokeWidth="1.5" />
      <line x1="7.5" y1="1" x2="7.5" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7.5" y1="12" x2="7.5" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="1" y1="7.5" x2="3" y2="7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="7.5" x2="14" y2="7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3.5" y1="3.5" x2="4.5" y2="4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10.5" y1="10.5" x2="11.5" y2="11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3.5" y1="11.5" x2="4.5" y2="10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10.5" y1="4.5" x2="11.5" y2="3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SlidersIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <line x1="4.5" y1="3.5" x2="4.5" y2="12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10.5" y1="2.5" x2="10.5" y2="11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="4.5" cy="6" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10.5" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function Titlebar({ onSearchOpen }: TitlebarProps) {
  const connected = useStore((s) => s.connected);
  const darkMode = useStore((s) => s.darkMode);
  const toggleDarkMode = useStore((s) => s.toggleDarkMode);
  const setShowSettings = useStore((s) => s.setShowSettings);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("perch:theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  return (
    <div className="titlebar">
      <div className="titlebar__brand">
        <PerchLogo size={18} />
        <span className="brand-wordmark">Perch</span>
      </div>

      <div className="titlebar__spacer" />

      <div className="titlebar__controls">
        <button className="search-trigger" onClick={onSearchOpen} title="Search (Cmd+K)">
          <SearchIcon size={13} />
          <span className="search-trigger__text">Search</span>
          <kbd className="search-trigger__kbd">&#8984;K</kbd>
        </button>

        <div className="titlebar__divider" />

        <div className="connection-status" title={connected ? "Connected to daemon" : "Disconnected"}>
          <span className={`connection-status__dot ${connected ? "connected" : "disconnected"}`} />
          <span className="connection-status__label">{connected ? "Connected" : "Disconnected"}</span>
        </div>

        <button
          className="icon-btn"
          onClick={toggleDarkMode}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          title={darkMode ? "Light mode" : "Dark mode"}
        >
          {darkMode ? <SunIcon size={15} /> : <MoonIcon size={15} />}
        </button>

        <button className="icon-btn" onClick={() => setShowSettings(true)} title="Settings" aria-label="Settings">
          <SlidersIcon size={15} />
        </button>
      </div>
    </div>
  );
}
