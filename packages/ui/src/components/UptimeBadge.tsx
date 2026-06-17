import { useState, useEffect } from "react";
import { formatUptime } from "../utils/format";

interface Props {
  startedAt: number | null;
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
      <span className="mono-value" style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
        Unavailable
      </span>
    );
  }

  const elapsed = Date.now() - startedAt;
  return (
    <span
      className="mono-value"
      style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}
      title={`Started at ${new Date(startedAt).toLocaleTimeString()}`}
    >
      ↑ {formatUptime(elapsed)}
    </span>
  );
}
