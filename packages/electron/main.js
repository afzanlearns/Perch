const { app, BrowserWindow, Tray, Menu } = require("electron");
const { spawn, execSync, execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");

let mainWindow = null;
let tray = null;
let daemonProcess = null;
let isQuitting = false;

const isWindows = process.platform === "win32";
const daemonPort = 7777;

function getAgentPath() {
  const distPath = path.join(__dirname, "..", "agent", "dist", "index.js");
  if (fs.existsSync(distPath)) return { path: distPath, type: "node" };

  const srcPath = path.join(__dirname, "..", "agent", "src", "index.ts");
  if (fs.existsSync(srcPath)) return { path: srcPath, type: "tsx" };

  return null;
}

function checkDaemonRunning() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${daemonPort}/api/status`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => {
      resolve(false);
    });
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startDaemon() {
  const isRunning = await checkDaemonRunning();
  if (isRunning) {
    console.log("Perch daemon already running.");
    updateTrayMenu(true);
    return;
  }

  const agent = getAgentPath();
  if (!agent) {
    console.error("Could not find Perch agent path.");
    return;
  }

  console.log("Starting Perch agent from:", agent.path);
  const cwd = path.join(__dirname, "..", "agent");

  if (agent.type === "tsx") {
    // Development mode
    daemonProcess = spawn("npx", ["tsx", "src/index.ts"], {
      cwd,
      detached: true,
      stdio: "ignore",
      shell: true,
      windowsHide: true,
    });
  } else {
    // Production mode
    daemonProcess = spawn(process.execPath, [agent.path], {
      cwd,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
  }

  if (daemonProcess) {
    daemonProcess.unref();
  }

  // Poll to confirm start
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const ok = await checkDaemonRunning();
    if (ok) {
      console.log("Perch daemon successfully started.");
      updateTrayMenu(true);
      return;
    }
  }
  console.error("Daemon did not respond on startup.");
  updateTrayMenu(false);
}

async function stopDaemon() {
  console.log("Stopping Perch agent...");
  if (daemonProcess) {
    daemonProcess.kill();
    daemonProcess = null;
  }

  try {
    if (isWindows) {
      execFileSync("taskkill", ["/f", "/im", "node.exe"], { timeout: 3000, windowsHide: true, stdio: "pipe" });
    } else {
      execSync("pkill -f 'perch.*dist/index' 2>/dev/null || pkill -f 'tsx.*index.ts' 2>/dev/null", { timeout: 3000, windowsHide: true });
    }
  } catch (err) {
    // ignore process not found errors
  }

  updateTrayMenu(false);
}

function updateTrayMenu(daemonRunning) {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    { label: `Daemon Port: ${daemonPort}`, enabled: false },
    { label: `Daemon Status: ${daemonRunning ? "Running" : "Stopped"}`, enabled: false },
    { type: "separator" },
    {
      label: "Open Dashboard",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: "separator" },
    {
      label: "Start Daemon",
      enabled: !daemonRunning,
      click: async () => {
        await startDaemon();
      },
    },
    {
      label: "Stop Daemon",
      enabled: daemonRunning,
      click: async () => {
        await stopDaemon();
      },
    },
    { type: "separator" },
    {
      label: "Quit Perch",
      click: async () => {
        isQuitting = true;
        await stopDaemon();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Perch",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://localhost:${daemonPort}`);

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  const iconExists = fs.existsSync(path.join(__dirname, "icon.png"));
  if (!iconExists) {
    console.warn("Tray icon not found. System tray might show a blank space.");
  }

  tray = new Tray(path.join(__dirname, iconExists ? "icon.png" : "icon_fallback.png"));
  tray.setToolTip("Perch Dashboard");

  const running = await checkDaemonRunning();
  updateTrayMenu(running);

  await startDaemon();
  createWindow();

  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });

  setInterval(async () => {
    const ok = await checkDaemonRunning();
    updateTrayMenu(ok);
  }, 5000);
});

app.on("before-quit", async () => {
  isQuitting = true;
  await stopDaemon();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Keep running in the system tray
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
