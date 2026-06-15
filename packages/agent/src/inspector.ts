import http from "http";
import httpProxy from "http-proxy";
import net from "net";

export interface InspectorRecord {
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

interface InspectorInstance {
  server: http.Server;
  proxy: httpProxy;
  proxyPort: number;
}

const instances = new Map<number, InspectorInstance>();
const listeners = new Set<(record: InspectorRecord) => void>();
const stateListeners = new Set<(active: ActiveInspector[]) => void>();

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on("error", reject);
    s.listen(0, () => {
      const addr = s.address();
      const port = typeof addr === "string" ? 0 : addr?.port ?? 0;
      s.close(() => resolve(port));
    });
  });
}

function notifyRecord(record: InspectorRecord) {
  for (const cb of listeners) {
    try {
      cb(record);
    } catch (err) {
      console.error("Error in inspector listener:", err);
    }
  }
}

function notifyStateChange() {
  const state = getActiveInspectors();
  for (const cb of stateListeners) {
    try {
      cb(state);
    } catch (err) {
      console.error("Error in inspector state listener:", err);
    }
  }
}

export function getActiveInspectors(): ActiveInspector[] {
  const list: ActiveInspector[] = [];
  for (const [targetPort, inst] of instances.entries()) {
    list.push({ targetPort, proxyPort: inst.proxyPort });
  }
  return list;
}

export function subscribeInspectorRequest(cb: (record: InspectorRecord) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function subscribeInspectorState(cb: (active: ActiveInspector[]) => void): () => void {
  stateListeners.add(cb);
  return () => {
    stateListeners.delete(cb);
  };
}

export async function startInspector(targetPort: number): Promise<number> {
  if (instances.has(targetPort)) {
    return instances.get(targetPort)!.proxyPort;
  }

  const proxyPort = await findFreePort();
  
  // @ts-ignore httpProxy is imported properly as ES Module / CommonJS depending on runtime
  const proxy = httpProxy.createProxyServer({
    target: `http://127.0.0.1:${targetPort}`,
    changeOrigin: true,
  });

  const server = http.createServer((req, res) => {
    const reqId = Math.random().toString(36).substring(2, 9);
    const startTime = Date.now();
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (v !== undefined) {
        headers[k] = Array.isArray(v) ? v.join(", ") : v;
      }
    }

    const record: InspectorRecord = {
      id: reqId,
      timestamp: startTime,
      method: req.method ?? "GET",
      path: req.url ?? "/",
      statusCode: null,
      latencyMs: null,
      requestHeaders: headers,
      responseHeaders: {},
      targetPort,
      proxyPort,
    };

    (req as any)._perchRecord = record;
    (req as any)._perchStartTime = startTime;

    proxy.web(req, res, {});
  });

  proxy.on("error", (err, req, res) => {
    console.error(`Proxy error for target port ${targetPort}:`, err.message);
    
    // Check if it is a standard HTTP response or socket
    if (res && "writeHead" in res && !res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end(`Bad Gateway: Perch proxy failed to connect to target port ${targetPort}`);
    } else if (res && "destroy" in res) {
      (res as any).destroy();
    }

    const record = (req as any)._perchRecord as InspectorRecord;
    const startTime = (req as any)._perchStartTime as number;
    if (record) {
      record.statusCode = 502;
      record.latencyMs = Date.now() - startTime;
      notifyRecord(record);
    }
  });

  proxy.on("proxyRes", (proxyRes, req, res) => {
    const record = (req as any)._perchRecord as InspectorRecord;
    const startTime = (req as any)._perchStartTime as number;
    if (record) {
      record.statusCode = proxyRes.statusCode ?? null;
      record.latencyMs = Date.now() - startTime;
      const respHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(proxyRes.headers)) {
        if (v !== undefined) {
          respHeaders[k] = Array.isArray(v) ? v.join(", ") : v;
        }
      }
      record.responseHeaders = respHeaders;
      notifyRecord(record);
    }
  });

  server.on("upgrade", (req, socket, head) => {
    proxy.ws(req, socket, head);
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(proxyPort, "127.0.0.1", () => {
      resolve();
    });
    server.on("error", reject);
  });

  instances.set(targetPort, { server, proxy, proxyPort });
  notifyStateChange();

  return proxyPort;
}

export async function stopInspector(targetPort: number): Promise<void> {
  const inst = instances.get(targetPort);
  if (!inst) return;

  instances.delete(targetPort);
  
  await new Promise<void>((resolve) => {
    inst.server.close(() => {
      resolve();
    });
  });
  inst.proxy.close();
  
  notifyStateChange();
}

export async function clearAllInspectors(): Promise<void> {
  const ports = Array.from(instances.keys());
  for (const p of ports) {
    await stopInspector(p);
  }
}
