/** Local-time calendar helpers. All functions use the machine's local time zone. */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Adds calendar days (DST-safe: uses the date, not 24h multiples). */
export function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function startOfWeek(ts: number, weekStartsOn: number): number {
  const d = new Date(startOfDay(ts));
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d.getTime();
}

export function toISODate(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromISODate(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** Returns the 7 day-start timestamps of the week + the exclusive end. */
export function weekDays(weekStart: number): { days: number[]; end: number } {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return { days, end: addDays(weekStart, 7) };
}

/** Splits [start,end) into pieces that never cross a local hour boundary. */
export function splitByHour(start: number, end: number): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  let s = start;
  while (s < end) {
    const d = new Date(s);
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    const e = Math.min(end, d.getTime());
    out.push({ start: s, end: e });
    s = e;
  }
  return out;
}

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dayLabel(ts: number): string {
  return SHORT_DAYS[new Date(ts).getDay()];
}

/** "Nov 16 – 22, 2026" or "Nov 30 – Dec 6, 2026" */
export function weekRangeLabel(weekStart: number): string {
  const a = new Date(weekStart);
  const b = new Date(addDays(weekStart, 6));
  const left = `${MONTHS[a.getMonth()]} ${a.getDate()}`;
  const right = a.getMonth() === b.getMonth() ? `${b.getDate()}` : `${MONTHS[b.getMonth()]} ${b.getDate()}`;
  return `${left} – ${right}, ${b.getFullYear()}`;
}

/** "Today", "Yesterday" or "Fri, Nov 14" */
export function relativeDayLabel(ts: number, now: number): string {
  const d = startOfDay(ts);
  const today = startOfDay(now);
  if (d === today) return "Today";
  if (d === addDays(today, -1)) return "Yesterday";
  const dt = new Date(ts);
  return `${SHORT_DAYS[dt.getDay()]}, ${MONTHS[dt.getMonth()]} ${dt.getDate()}`;
}

export function clock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
