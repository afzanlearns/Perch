import {
  exec as cpExec,
  execFile as cpExecFile,
  execFileSync as cpExecFileSync,
  execSync as cpExecSync,
  spawn as cpSpawn,
  spawnSync as cpSpawnSync,
} from "child_process"

const IS_WINDOWS = process.platform === "win32"

export function safeExec(
  command: string,
  options: Record<string, unknown> = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    cpExec(command, { windowsHide: true, ...options } as any, (err: any, stdout: string, stderr: string) => {
      if (err) return reject(Object.assign(err, { stderr }))
      resolve({ stdout, stderr })
    })
  })
}

export function safeExecFile(
  file: string,
  args: string[] = [],
  options: Record<string, unknown> = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    cpExecFile(file, args, { windowsHide: true, ...options } as any, (err: any, stdout: string | Buffer, stderr: string | Buffer) => {
      if (err) return reject(Object.assign(err, { stderr }))
      resolve({ stdout: String(stdout), stderr: String(stderr) })
    })
  })
}

export function safeSpawn(command: string, args: string[] = [], options: Record<string, unknown> = {}) {
  return cpSpawn(command, args, {
    ...options,
    windowsHide: true,
    stdio: options.stdio ?? "pipe",
  } as any)
}

export function safeExecSync(command: string, options: Record<string, unknown> = {}): string {
  return cpExecSync(command, { ...options, windowsHide: true, stdio: "pipe" } as any).toString()
}

export function safeExecFileSync(file: string, args: string[] = [], options: Record<string, unknown> = {}): string {
  return cpExecFileSync(file, args, { ...options, windowsHide: true, stdio: "pipe" } as any).toString()
}

export function safeSpawnSync(command: string, args: string[] = [], options: Record<string, unknown> = {}) {
  return cpSpawnSync(command, args, { ...options, windowsHide: true, stdio: "pipe" } as any)
}

export function safePowerShell(command: string, options: Record<string, unknown> = {}) {
  return safeSpawn("powershell.exe", [
    "-NonInteractive",
    "-NoProfile",
    "-WindowStyle", "Hidden",
    "-Command", command,
  ], {
    ...options,
    windowsHide: true,
    stdio: "pipe",
  })
}

export { IS_WINDOWS }
