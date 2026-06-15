import { useState, useEffect } from "react";

interface Props {
  startedAt: number | null;
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function UptimeBadge({ startedAt }: Props) {
  const [, tick] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!startedAt) {
    return (
      <span className="mono-value" style={{ color: "var(--text-tertiary)" }}>—</span>
    );
  }

  const elapsed = Date.now() - startedAt;
  return (
    <span
      className="mono-value"
      style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}
      title={`Started at ${new Date(startedAt).toLocaleTimeString()}`}
    >
      ↑ {formatMs(elapsed)}
    </span>
  );
}
