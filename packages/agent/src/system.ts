import { cpus, totalmem, freemem } from "os";

export interface SystemStats {
  cpuUsage: number;
  totalMemMb: number;
  usedMemMb: number;
}

interface Times {
  idle: number;
  total: number;
}

let prevTimes: Times | null = null;

export function getSystemStats(): SystemStats {
  //
  // CPU: Sampled via os.cpus() delta measurement.
  // At each call we sum idle and total ticks across all logical cores.
  // cpuUsage = (1 - idleDelta/totalDelta) * 100, smoothed to 1 decimal.
  // This gives the percentage of non-idle system-wide CPU time (0-100%).
  // First call returns 0 (no baseline); subsequent calls reflect the
  // interval between consecutive getSystemStats() invocations.
  //
  const cores = cpus();
  let idle = 0;
  let total = 0;
  for (const core of cores) {
    idle += core.times.idle;
    total += core.times.user + core.times.nice + core.times.sys + core.times.idle + core.times.irq;
  }

  let cpuUsage = 0;
  if (prevTimes) {
    const idleDelta = idle - prevTimes.idle;
    const totalDelta = total - prevTimes.total;
    if (totalDelta > 0) {
      cpuUsage = Math.round((1 - idleDelta / totalDelta) * 1000) / 10;
    }
  }
  prevTimes = { idle, total };

  //
  // Memory: Uses OS-level totalmem() and freemem().
  // usedMemMb = total physical RAM - available physical RAM (in MB).
  // This includes kernel, cached, and all process allocations.
  // It is NOT a sum of per-process RSS values and therefore
  // represents genuine system-wide RAM consumption.
  //
  const totalMem = totalmem();
  const freeMem = freemem();
  const usedMemMb = Math.round((totalMem - freeMem) / (1024 * 1024));
  const totalMemMb = Math.round(totalMem / (1024 * 1024));

  const result = { cpuUsage, totalMemMb, usedMemMb };
  console.log("[SYSTEM] getSystemStats returning:", JSON.stringify(result));
  return result;
}
