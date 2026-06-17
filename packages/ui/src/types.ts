export type HealthStatus = "healthy" | "unhealthy" | "unreachable" | "no-port";

export interface ProcessInfo {
  pid: number;
  ppid?: number;
  name: string;
  memory: number | null;
  cpu: number | null;
  port: number | null;
  command: string;
  groupId?: string;
  serviceId?: string;
  cpuHistory: (number | null)[];
  memHistory: (number | null)[];
  uptimeMs: number | null;
  startedAt: number | null;
}

export interface LogLine {
  timestamp: number;
  level: "stdout" | "stderr";
  message: string;
}

export interface HealthResult {
  pid: number;
  status: HealthStatus;
  checkedAt: number;
}

export interface ServiceInfo {
  id: string;
  name: string;
  command: string;
  expectedPort: number | null;
  running: boolean;
}

export interface GroupInfo {
  id: string;
  name: string;
  description?: string;
  services: ServiceInfo[];
}

export interface SystemStats {
  cpuUsage: number;
  totalMemMb: number;
  usedMemMb: number;
}

export interface CrashAlert {
  pid: number;
  name: string;
  exitCode: number | null;
  signal: string | null;
  lastLogs: LogLine[];
  timestamp: number;
}

export interface PortViolation {
  port: number;
  expectedLabel: string;
  actualPid: number;
  actualName: string;
}

export interface InspectorRequest {
  id: string;
  timestamp: number;
  method: string;
  path: string;
  statusCode: number | null;
  latencyMs: number | null;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  targetPort: number;
  proxyPort: number;
}

export interface ActiveInspector {
  targetPort: number;
  proxyPort: number;
}

export interface GraphNode {
  id: string;
  name: string;
  port: number | null;
  group: string;
  running: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
}
