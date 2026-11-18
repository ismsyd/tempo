import type {
  Item,
  ItemDetail,
  SessionInfo,
  Span,
  WeekFilter,
  WeekItemRow,
  WeekSort,
  WeekSummary,
} from "./types.ts";
import {
  MINUTE,
  addDays,
  dayLabel,
  splitByHour,
  startOfDay,
  toISODate,
} from "./time.ts";

/** Gaps shorter than this between spans of the same item count as one session. */
export const SESSION_GAP_MS = 2 * MINUTE;

interface Window {
  start: number;
  end: number; // exclusive, already clipped to `now`
}

function clip(spans: Span[], w: Window): Span[] {
  const out: Span[] = [];
  for (const s of spans) {
    const a = Math.max(s.start, w.start);
    const b = Math.min(s.end, w.end);
    if (b > a) out.push({ itemId: s.itemId, start: a, end: b });
  }
  return out;
}

function weekWindow(weekStart: number, now: number): Window & { daysElapsed: number; weekEnd: number } {
  const weekEnd = addDays(weekStart, 7);
  const end = Math.min(weekEnd, now);
  let daysElapsed = 7;
  if (now < weekEnd) {
    daysElapsed = 0;
    for (let i = 0; i < 7; i++) if (addDays(weekStart, i) <= now) daysElapsed = i + 1;
  }
  return { start: weekStart, end: Math.max(end, weekStart), daysElapsed, weekEnd };
}

/** Day index (0..6) of a timestamp inside the week starting at weekStart. */
function dayIndex(ts: number, weekStart: number): number {
  const d = startOfDay(ts);
  for (let i = 6; i >= 0; i--) if (d >= addDays(weekStart, i)) return i;
  return 0;
}

export function mergeSessions(spans: Span[], gap = SESSION_GAP_MS): SessionInfo[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const out: SessionInfo[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start - last.end <= gap) {
      last.end = Math.max(last.end, s.end);
      last.minutes += (s.end - s.start) / MINUTE;
    } else {
      out.push({ start: s.start, end: s.end, minutes: (s.end - s.start) / MINUTE });
    }
  }
  return out;
}

function totalMinutes(spans: Span[]): number {
  return spans.reduce((t, s) => t + (s.end - s.start), 0) / MINUTE;
}

type Bucket = "morning" | "afternoon" | "evening" | "night";
export function bucketOfHour(h: number): Bucket {
  if (h >= 6 && h < 12) return "morning";
  if (h >= 12 && h < 18) return "afternoon";
  if (h >= 18) return "evening";
  return "night";
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

function describeDiff(diffMin: number): string {
  const abs = Math.abs(diffMin);
  if (abs < 30) return "About the same as last week.";
  const dir = diffMin < 0 ? "less" : "more";
  if (abs < 75) return `About an hour ${dir} than last week.`;
  const h = Math.round(abs / 60);
  const word = h <= 10 ? NUMBER_WORDS[h] : String(h);
  return `About ${word} hours ${dir} than last week.`;
}

export interface WeekOptions {
  filter?: WeekFilter;
  sort?: WeekSort;
  query?: string;
}

export function aggregateWeek(
  items: Item[],
  allSpans: Span[],
  weekStart: number,
  now: number,
  opts: WeekOptions = {},
): WeekSummary {
  const byId = new Map(items.filter((i) => !i.excluded).map((i) => [i.id, i]));
  const spans = allSpans.filter((s) => byId.has(s.itemId));
  const w = weekWindow(weekStart, now);
  const inWeek = clip(spans, w);

  // Previous week, same elapsed length (fair comparison for partial weeks)
  const prevStart = addDays(weekStart, -7);
  const prevWin = { start: prevStart, end: prevStart + (w.end - w.start) };
  const prevSpans = clip(spans, prevWin);

  const perDay = Array(7).fill(0);
  const perItem = new Map<string, number>();
  const lastUsed = new Map<string, number>();
  const tod: Record<Bucket, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  const catMinutes = new Map<string, number>();

  for (const s of inWeek) {
    for (const p of splitByHour(s.start, s.end)) {
      const m = (p.end - p.start) / MINUTE;
      perDay[dayIndex(p.start, weekStart)] += m;
      tod[bucketOfHour(new Date(p.start).getHours())] += m;
    }
    const m = (s.end - s.start) / MINUTE;
    perItem.set(s.itemId, (perItem.get(s.itemId) ?? 0) + m);
    lastUsed.set(s.itemId, Math.max(lastUsed.get(s.itemId) ?? 0, s.end));
    const cat = byId.get(s.itemId)!.category;
    catMinutes.set(cat, (catMinutes.get(cat) ?? 0) + m);
  }

  const total = totalMinutes(inWeek);
  const prevTotal = totalMinutes(prevSpans);
  const days = Math.max(1, w.daysElapsed);
  const avg = total / days;
  const prevAvg = prevTotal / days;

  const used = [...perItem.keys()].map((id) => byId.get(id)!);
  const apps = used.filter((i) => i.kind === "app");
  const webs = used.filter((i) => i.kind === "web");
  const topWeb = webs.sort((a, b) => perItem.get(b.id)! - perItem.get(a.id)!)[0];

  // longest session across all items
  let longest: WeekSummary["longestSession"] = null;
  const spansByItem = new Map<string, Span[]>();
  for (const s of inWeek) {
    const arr = spansByItem.get(s.itemId) ?? [];
    arr.push(s);
    spansByItem.set(s.itemId, arr);
  }
  for (const [id, arr] of spansByItem) {
    for (const ses of mergeSessions(arr)) {
      if (!longest || ses.minutes > longest.minutes) {
        longest = { minutes: ses.minutes, itemName: byId.get(id)!.name, start: ses.start };
      }
    }
  }

  const maxMinutes = Math.max(0, ...perItem.values());
  let rows: WeekItemRow[] = used.map((i) => ({
    id: i.id,
    kind: i.kind,
    name: i.name,
    category: i.category,
    color: i.color,
    minutes: perItem.get(i.id)!,
    share: maxMinutes ? perItem.get(i.id)! / maxMinutes : 0,
    lastUsed: lastUsed.get(i.id)!,
  }));
  const counts = {
    all: rows.length,
    apps: rows.filter((r) => r.kind === "app").length,
    web: rows.filter((r) => r.kind === "web").length,
  };
  if (opts.filter === "apps") rows = rows.filter((r) => r.kind === "app");
  if (opts.filter === "web") rows = rows.filter((r) => r.kind === "web");
  if (opts.query) {
    const q = opts.query.toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
  }
  const sort = opts.sort ?? "time";
  rows.sort((a, b) =>
    sort === "name" ? a.name.localeCompare(b.name) : sort === "recent" ? b.lastUsed - a.lastUsed : b.minutes - a.minutes,
  );

  // Human summary sentence
  let summary = "Nothing tracked yet this week.";
  if (total > 0) {
    const parts: string[] = [];
    parts.push(prevTotal > 0 ? describeDiff(total - prevTotal) : "Your first tracked week.");
    const cats = [...catMinutes.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c.toLowerCase());
    if (cats.length >= 2) parts.push(`Most of it went to ${cats[0]} and ${cats[1]}`);
    else if (cats.length === 1) parts.push(`Most of it went to ${cats[0]}`);
    const quiet = (["morning", "afternoon", "evening"] as const).reduce((a, b) => (tod[b] < tod[a] ? b : a));
    parts[parts.length - 1] += ` — ${quiet}s were the quietest.`;
    summary = parts.join(" ");
  }

  return {
    weekStart: toISODate(weekStart),
    weekEnd: toISODate(addDays(weekStart, 6)),
    isCurrentWeek: now >= weekStart && now < w.weekEnd,
    daysElapsed: w.daysElapsed,
    totalMinutes: total,
    previousTotalMinutes: prevTotal,
    perDay,
    dayLabels: Array.from({ length: 7 }, (_, i) => dayLabel(addDays(weekStart, i))),
    dailyAverageMinutes: avg,
    dailyAverageDeltaPct: prevAvg > 0 ? (avg - prevAvg) / prevAvg : null,
    appsUsed: apps.length,
    newApps: apps.filter((i) => i.firstSeen >= weekStart).length,
    websites: webs.length,
    topWebsite: topWeb?.name ?? null,
    longestSession: longest,
    counts,
    items: rows,
    summary,
  };
}

export function aggregateItem(
  items: Item[],
  allSpans: Span[],
  itemId: string,
  weekStart: number,
  now: number,
): ItemDetail | null {
  const item = items.find((i) => i.id === itemId);
  if (!item) return null;
  const visible = new Set(items.filter((i) => !i.excluded).map((i) => i.id));
  const w = weekWindow(weekStart, now);
  const prevStart = addDays(weekStart, -7);
  const prevWin = { start: prevStart, end: prevStart + (w.end - w.start) };

  const own = allSpans.filter((s) => s.itemId === itemId);
  const inWeek = clip(own, w);
  const prev = clip(own, prevWin);
  const weekAll = clip(
    allSpans.filter((s) => visible.has(s.itemId)),
    w,
  );

  const perDay = Array(7).fill(0);
  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
  const tod = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const s of inWeek) {
    for (const p of splitByHour(s.start, s.end)) {
      const m = (p.end - p.start) / MINUTE;
      const d = dayIndex(p.start, weekStart);
      const h = new Date(p.start).getHours();
      perDay[d] += m;
      heatmap[d][h] += m;
      tod[bucketOfHour(h)] += m;
    }
  }

  const total = totalMinutes(inWeek);
  const days = Math.max(1, w.daysElapsed);
  const avg = total / days;
  const prevAvg = totalMinutes(prev) / days;
  const sessions = mergeSessions(inWeek);
  const longest = sessions.reduce<SessionInfo | null>((a, b) => (!a || b.minutes > a.minutes ? b : a), null);

  const perDaySessions: number[][] = Array.from({ length: 7 }, () => []);
  for (const s of sessions) perDaySessions[dayIndex(s.start, weekStart)].push(s.minutes);

  const lastUsed = own.filter((s) => s.start <= now).reduce<number | null>((a, s) => Math.max(a ?? 0, Math.min(s.end, now)), null);

  return {
    item,
    weekStart: toISODate(weekStart),
    weekEnd: toISODate(addDays(weekStart, 6)),
    totalMinutes: total,
    shareOfWeek: totalMinutes(weekAll) > 0 ? total / totalMinutes(weekAll) : 0,
    dailyAverageMinutes: avg,
    dailyAverageDeltaPct: prevAvg > 0 ? (avg - prevAvg) / prevAvg : null,
    sessionCount: sessions.length,
    sessionsPerDay: sessions.length / days,
    averageSessionSeconds: sessions.length ? (total * 60) / sessions.length : 0,
    longestSession: longest,
    lastUsed,
    perDay,
    dayLabels: Array.from({ length: 7 }, (_, i) => dayLabel(addDays(weekStart, i))),
    timeOfDay: tod,
    heatmap,
    averageSessionPerDay: perDaySessions.map((a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)),
    recentSessions: [...sessions].sort((a, b) => b.start - a.start).slice(0, 20),
  };
}
