/** 580 -> "9h 40m", 32 -> "32m", 0.5 -> "<1m" */
export function formatMinutes(min: number): string {
  const m = Math.round(min);
  if (min > 0 && m === 0) return "<1m";
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/** 756 -> "12m 36s", 4000 -> "1h 06m" */
export function formatSeconds(sec: number): string {
  const s = Math.round(sec);
  if (s >= 3600) return formatMinutes(s / 60);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

/** Hero style: 2292 -> "38h 12m" (always shows hours) */
export function formatTotal(min: number): string {
  const m = Math.round(min);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
