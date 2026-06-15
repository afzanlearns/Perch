import type { HealthStatus } from "../types";

const dotMap: Record<HealthStatus, string> = {
  healthy: "running",
  unhealthy: "error",
  unreachable: "error",
  "no-port": "idle",
};

export function HealthBadge({ status }: { status?: HealthStatus }) {
  if (!status) return null;
  return <span className={`status-dot ${dotMap[status]}`} title={status} />;
}
