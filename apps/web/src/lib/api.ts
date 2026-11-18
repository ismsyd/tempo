/**
 * Data access for the web app.
 *
 * Phase 2: everything is computed in the browser from deterministic sample data,
 * using the same aggregation code the local agent will use.
 * Phase 6 swaps these functions for fetch() calls to http://127.0.0.1:4747/api.
 */
import {
  DEFAULT_SETTINGS,
  aggregateItem,
  aggregateWeek,
  fromISODate,
  generateDemoData,
  type Item,
  type ItemDetail,
  type Settings,
  type WeekFilter,
  type WeekSort,
  type WeekSummary,
} from "@tempo/shared";

let demo = generateDemoData(Date.now());

const wait = (ms = 140) => new Promise((r) => setTimeout(r, ms));

export interface WeekQuery {
  weekStart: string;
  filter: WeekFilter;
  sort: WeekSort;
  query: string;
}

export async function getWeek(q: WeekQuery): Promise<WeekSummary> {
  await wait();
  return aggregateWeek(demo.items, demo.spans, fromISODate(q.weekStart), Date.now(), {
    filter: q.filter,
    sort: q.sort,
    query: q.query.trim(),
  });
}

export async function getItem(id: string, weekStart: string): Promise<ItemDetail | null> {
  await wait();
  return aggregateItem(demo.items, demo.spans, id, fromISODate(weekStart), Date.now());
}

export async function getItems(): Promise<Item[]> {
  await wait(60);
  return [...demo.items].sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateItem(id: string, patch: Partial<Pick<Item, "excluded" | "dailyLimitMinutes">>): Promise<Item> {
  await wait(80);
  const item = demo.items.find((i) => i.id === id);
  if (!item) throw new Error("Item not found");
  Object.assign(item, patch);
  return item;
}

// Settings — kept in memory + localStorage until the agent owns them (Phase 6).
const SETTINGS_KEY = "tempo.settings";
function readSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable */
  }
  return { ...DEFAULT_SETTINGS };
}
let settings = readSettings();

export async function getSettings(): Promise<Settings> {
  return settings;
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  await wait(80);
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable */
  }
  return settings;
}

export async function exportData(format: "json" | "csv"): Promise<Blob> {
  await wait(80);
  const byId = new Map(demo.items.map((i) => [i.id, i]));
  if (format === "json") {
    return new Blob([JSON.stringify({ version: 1, items: demo.items, spans: demo.spans }, null, 2)], {
      type: "application/json",
    });
  }
  const lines = ["name,kind,category,start,end,minutes"];
  for (const s of demo.spans) {
    const i = byId.get(s.itemId)!;
    lines.push(
      [JSON.stringify(i.name), i.kind, JSON.stringify(i.category), new Date(s.start).toISOString(), new Date(s.end).toISOString(), ((s.end - s.start) / 60000).toFixed(2)].join(","),
    );
  }
  return new Blob([lines.join("\n")], { type: "text/csv" });
}

export async function importData(file: File): Promise<number> {
  const parsed = JSON.parse(await file.text());
  if (!parsed || !Array.isArray(parsed.items) || !Array.isArray(parsed.spans)) {
    throw new Error("This file isn't a Tempo export.");
  }
  const known = new Set(demo.items.map((i) => i.id));
  for (const it of parsed.items as Item[]) if (!known.has(it.id)) demo.items.push(it);
  const seen = new Set(demo.spans.map((s) => `${s.itemId}|${s.start}`));
  let added = 0;
  for (const s of parsed.spans) {
    if (!seen.has(`${s.itemId}|${s.start}`)) {
      demo.spans.push(s);
      added++;
    }
  }
  return added;
}

export async function deleteAllData(): Promise<void> {
  await wait(120);
  demo = { items: [], spans: [] };
}
