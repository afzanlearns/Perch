export function formatMemory(mb: number | null | undefined): string {
  if (mb == null) return "Unavailable";
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

export function formatCpu(cpu: number | null | undefined): string {
  if (cpu == null) return "Unavailable";
  return `${cpu.toFixed(1)}%`;
}

export function formatSystemCpu(cpu: number): string {
  return `${cpu.toFixed(1)}%`;
}

export function formatSystemMemory(usedMb: number, totalMb: number): string {
  const usedGb = (usedMb / 1024).toFixed(1);
  const totalGb = (totalMb / 1024).toFixed(1);
  return `${usedGb} / ${totalGb} GB`;
}

export function formatUptime(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return "Unavailable";
  const totalSeconds = Math.floor(ms / 1000);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
