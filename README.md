# Perch 

**A local mission-control dashboard for developers. Monitor every service, port, process, and log on your machine from a single unified interface.**

---

![Perch Dashboard](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational?style=flat-square)
![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Daemon Port](https://img.shields.io/badge/daemon%20port-7777-orange?style=flat-square)

---

## What is Perch?

Modern local development is chaos. You have a Next.js frontend on port 3000, an Express API on 4000, a database on 5432, a Redis instance somewhere, a Docker container you forgot about, and six terminal tabs open — each showing a different service's logs. You don't know which process owns which port, why a service went down, or where your bottlenecks are.

Perch fixes this.

Perch is a lightweight desktop client and background daemon that continuously monitors your entire local machine and aggregates everything into a single premium developer dashboard. Think of it as Vercel or Railway for localhost — keeping your entire development ecosystem visible at a glance.

---

## Core Features (V2 Edition)

### 1. HTTP Request Inspector
* Dynamic proxying to intercept and debug localhost traffic.
* Real-time logging of HTTP methods, routes, response status codes, header tables, and execution latency.
* Start and stop port traffic interception with a single click in the UI.

### 2. Process Dependency Graph
* Auto-discovered service architectures visualised in an interactive node-link dependency graph.
* Visual indicators showing service states (healthy, warning, offline) and active port traffic directions.

### 3. System Tray Mode
* Native Electron integration that enables Perch to run unobtrusively in your system tray.
* Closing the window minimizes Perch to the tray, keeping the polling agent alive in the background.
* Quick-access tray menus to open the dashboard, check status, start/stop daemon, or quit the app.

### 4. Process Crash Alerts
* Real-time notifications and toast warnings when monitored services crash or terminate unexpectedly.
* Detailed debug logs, signals, and exit codes surfaced instantly to pinpoint failures.

### 5. Port Reservation & Violation Detection
* Declare expected port mappings in your configuration (e.g., PostgreSQL on `5432`).
* Spot port conflicts immediately. If another process hijacks a reserved port, it highlights the violation and offers one-click port swapping.

### 6. Interactive Config File Editor
* Edit, update, and manage your `perch.config.json` directly from the dashboard.
* Live JSON schema validation prevents formatting mistakes or invalid fields before applying changes.

### 7. CPU & Memory Sparklines
* Resource-dense process tables featuring micro-sparkline charts that show CPU and Memory trends over time.

### 8. Startup & Uptime Tracking
* Real-time uptime badges showing exactly how long each process has been alive, complete with milliseconds-level granularity.

---

## Installation & Setup

### Global Production Install (Recommended)

1. Clone the repository and install root dependencies:
   ```bash
   npm install
   ```
2. Build the packages (Agent and UI):
   ```bash
   npm run build
   ```
3. Link the package globally to install the CLI tool:
   ```bash
   npm link
   ```
4. Start the Perch system:
   ```bash
   perch start
   ```

### Development Mode

Run the following command in the root folder to start both the daemon (port `7777`) and the React UI (port `3000`) concurrently:
```bash
npm run dev
```
Open **http://localhost:3000** in your browser.

---

## CLI Command Usage

Use the globally linked `perch` CLI command to easily control the background daemon:

```bash
# Start the background daemon
perch start

# Show current daemon status (running state, uptime, active process count)
perch status

# Stop the daemon completely
perch stop
```

---

## Windows Support

Perch is fully optimized for Windows systems:
* All shell processes are launched invisibly using native child process safe-spawning (`windowsHide: true`).
* Daemon processes run smoothly in the background without causing intrusive cmd window flashes.
* Clean tray integration handles standard process cleanups and window visibility hooks.

---

## Architecture

Perch operates as a split-architecture system:

```
┌───────────────────────────────────────────────┐
│        Perch Desktop App (Electron Tray)      │
│   Serves UI dashboard & registers tray icon   │
│                                               │
│  Nav Rail │ Process List │ HTTP Inspector     │
│  Graph    │ Config Ed    │ Resource Badges    │
└───────────────────────┬───────────────────────┘
                        │ IPC / WebSocket
┌───────────────────────▼───────────────────────┐
│            Perch Daemon (Node.js)             │
│   Listens on port 7777 (HTTP / WebSocket)     │
│                                               │
│  Process Monitor   │  Port Scanner            │
│  http-proxy Server │  Env File Watcher        │
│  Health Checker    │  Config Validator        │
└───────────────────────────────────────────────┘
```

---

## Configuration

Customise your dashboard workspace by placing a `perch.config.json` file in your project directory:

```json
{
  "version": "1.0",
  "daemonPort": 7777,
  "pollInterval": 2000,
  "reservedPorts": {
    "3000": "NextJS App",
    "5432": "Database"
  },
  "groups": [
    {
      "id": "frontend",
      "name": "Frontend Services",
      "services": [
        {
          "id": "web",
          "name": "React Client",
          "command": "npm run dev",
          "cwd": "./apps/web",
          "expectedPort": 3000,
          "autoRestart": true
        }
      ]
    }
  ]
}
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + K` | Open command palette |
| `Cmd/Ctrl + W` | Kill selected process |
| `Cmd/Ctrl + R` | Restart selected process |
| `↑ / ↓` | Navigate process list |
| `Enter` | Select / expand process |
| `Esc` | Clear search / close panels |

---

## Tech Stack

* **Desktop Framework:** Electron
* **Web UI:** React + Zustand (Themed with CSS Custom Properties)
* **Daemon Runtime:** Node.js + Express + WebSocket
* **Proxy Core:** `http-proxy`
* **Process Intelligence:** `ps-list`, `pidusage`, `node-netstat`, `chokidar`

---

## License

MIT © 2026 Perch Contributors
