/** Local HTTP API used by the web app and the Chrome extension. Bound to 127.0.0.1 only. */
import { Hono } from "hono";
import type { Context, Next } from "hono";
import {
  DEFAULT_SETTINGS,
  HOUR,
  aggregateItem,
  aggregateWeek,
  addDays,
  domainOf,
  fromISODate,
  startOfWeek,
} from "@tempo/shared";
import type { Item, Settings, Span, WeekFilter, WeekSort } from "@tempo/shared";
import type { Store } from "./db.ts";
import type { Tracker } from "./tracker.ts";

const VERSION = "0.1.0";

function isLocalHost(host: string | undefined): boolean {
  if (!host) return false;
  const h = host.replace(/:\d+$/, "").toLowerCase();
  return h === "127.0.0.1" || h === "localhost" || h === "[::1]";
}
function isOwnOrigin(origin: string): boolean {
  try {
    return isLocalHost(new URL(origin).host);
  } catch {
    return false;
  }
}

/** Validates a settings patch: only known keys, with the right types. */
function cleanSettings(patch: Record<string, unknown>, current: Settings): Settings {
  const out: Record<string, unknown> = { ...current };
  const nullable = new Set(["dailyGoalMinutes", "weeklySummary", "retentionDays"]);
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in DEFAULT_SETTINGS) || k === "keepDataLocal") continue;
    const def = (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[k];
    if (v === null && nullable.has(k)) out[k] = null;
    else if (k === "weeklySummary" && typeof v === "object" && v) {
      const w = v as { day?: unknown; hour?: unknown };
      if (Number.isInteger(w.day) && Number.isInteger(w.hour)) out[k] = { day: w.day, hour: w.hour };
    } else if (k === "weekStartsOn" && [0, 1, 6].includes(v as number)) out[k] = v;
    else if (def !== null && typeof v === typeof def && k !== "weekStartsOn") out[k] = v;
    else if (def === null && typeof v === "number") out[k] = v;
  }
  return out as unknown as Settings;
}

export function createApi(store: Store, tracker: Tracker) {
  const app = new Hono();

  // --- Security: only this computer, only our own pages or the extension ---
  app.use("/api/*", async (c: Context, next: Next) => {
    if (!isLocalHost(c.req.header("host"))) return c.json({ error: "forbidden host" }, 403);
    const origin = c.req.header("origin");
    const ext = origin?.startsWith("chrome-extension://");
    if (origin && !ext && !isOwnOrigin(origin)) return c.json({ error: "forbidden origin" }, 403);
    if (c.req.path.startsWith("/api/ext/")) {
      const token = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
      if (!token || token.toUpperCase() !== store.pairingToken()) return c.json({ error: "not paired" }, 401);
      if (ext) {
        c.header("Access-Control-Allow-Origin", origin!);
        c.header("Vary", "Origin");
      }
    } else if (ext) {
      return c.json({ error: "forbidden" }, 403); // the extension may only use /api/ext/*
    }
    await next();
    c.header("Cache-Control", "no-store");
  });
  app.options("/api/ext/*", (c) => {
    const origin = c.req.header("origin") ?? "";
    if (!origin.startsWith("chrome-extension://")) return c.body(null, 403);
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Headers", "authorization, content-type");
    c.header("Access-Control-Allow-Methods", "POST, GET");
    return c.body(null, 204);
  });

  const weekStartOf = (iso: string | undefined) => {
    const s = store.getSettings();
    const current = startOfWeek(Date.now(), s.weekStartsOn);
    const ws = iso ? startOfWeek(fromISODate(iso), s.weekStartsOn) : current;
    return Math.min(ws, current);
  };
  const windowSpans = (weekStart: number): Span[] => {
    tracker.flush();
    return store.spansBetween(addDays(weekStart, -7) - HOUR, addDays(weekStart, 7) + HOUR);
  };

  app.get("/api/status", (c) => {
    const s = store.getSettings();
    return c.json({
      ok: true,
      version: VERSION,
      tracking: { apps: s.trackApps, websites: s.trackWebsites },
      extension: {
        connected: tracker.extensionConnected(),
        browsers: tracker.connectedBrowsers(),
        lastSeen: Math.max(0, ...[...tracker.ext.values()].map((e) => e.at)) || null,
      },
      current: tracker.current,
    });
  });

  app.get("/api/week", (c) => {
    const ws = weekStartOf(c.req.query("start"));
    const res = aggregateWeek(store.items(), windowSpans(ws), ws, Date.now(), {
      filter: (c.req.query("filter") as WeekFilter) ?? "all",
      sort: (c.req.query("sort") as WeekSort) ?? "time",
      query: c.req.query("q") ?? "",
    });
    return c.json(res);
  });

  app.get("/api/items", (c) => c.json(store.items().sort((a, b) => a.name.localeCompare(b.name))));

  app.get("/api/items/:id", (c) => {
    const id = c.req.param("id");
    const ws = weekStartOf(c.req.query("week"));
    const spans = windowSpans(ws);
    const latest = store.latestSpan(id);
    if (latest) spans.push(latest); // lets "last used" look beyond the selected week
    const res = aggregateItem(store.items(), spans, id, ws, Date.now());
    return res ? c.json(res) : c.json({ error: "not found" }, 404);
  });

  app.put("/api/items/:id", async (c) => {
    const id = c.req.param("id");
    if (!store.itemById(id)) return c.json({ error: "not found" }, 404);
    const body = (await c.req.json()) as Partial<Item>;
    const patch: Parameters<Store["updateItem"]>[1] = {};
    if (typeof body.excluded === "boolean") patch.excluded = body.excluded;
    if (body.dailyLimitMinutes === null || (typeof body.dailyLimitMinutes === "number" && body.dailyLimitMinutes > 0)) patch.dailyLimitMinutes = body.dailyLimitMinutes;
    if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 60);
    if (typeof body.category === "string" && body.category.trim()) patch.category = body.category.trim().slice(0, 40);
    store.updateItem(id, patch);
    return c.json(store.itemById(id));
  });

  app.get("/api/settings", (c) => c.json(store.getSettings()));
  app.put("/api/settings", async (c) => {
    const next = cleanSettings(await c.req.json(), store.getSettings());
    store.saveSettings(next);
    return c.json(next);
  });

  app.get("/api/pairing", (c) => c.json({ code: store.pairingToken() }));
  app.post("/api/pairing/reset", (c) => c.json({ code: store.pairingToken(true) }));

  app.get("/api/export", (c) => {
    tracker.flush();
    const items = store.items();
    const spans = store.allSpans();
    const date = new Date().toISOString().slice(0, 10);
    if (c.req.query("format") === "csv") {
      const byId = new Map(items.map((i) => [i.id, i]));
      const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
      const lines = ["name,kind,category,start,end,minutes"];
      for (const s of spans) {
        const i = byId.get(s.itemId);
        if (!i) continue;
        lines.push([q(i.name), i.kind, q(i.category), new Date(s.start).toISOString(), new Date(s.end).toISOString(), ((s.end - s.start) / 60000).toFixed(2)].join(","));
      }
      c.header("Content-Disposition", `attachment; filename="tempo-export-${date}.csv"`);
      return c.body(lines.join("\n"), 200, { "Content-Type": "text/csv; charset=utf-8" });
    }
    c.header("Content-Disposition", `attachment; filename="tempo-export-${date}.json"`);
    return c.json({ version: 1, exportedAt: Date.now(), items, spans });
  });

  app.post("/api/import", async (c) => {
    const body = (await c.req.json().catch(() => null)) as { items?: Item[]; spans?: Span[] } | null;
    if (!body || !Array.isArray(body.items) || !Array.isArray(body.spans)) return c.json({ error: "This file isn't a Tempo export." }, 400);
    let added = 0;
    store.transaction(() => {
      const idMap = new Map<string, string>();
      for (const it of body.items!) {
        if (typeof it.id !== "string" || typeof it.key !== "string") continue;
        const existing = store.itemByKey(it.key);
        if (existing) idMap.set(it.id, existing.id);
        else {
          store.insertItem({ ...it, excluded: !!it.excluded, dailyLimitMinutes: it.dailyLimitMinutes ?? null, firstSeen: it.firstSeen ?? Date.now() });
          idMap.set(it.id, it.id);
        }
      }
      for (const s of body.spans!) {
        const itemId = idMap.get(s.itemId);
        if (!itemId || !(s.end > s.start) || store.hasSpan(itemId, s.start)) continue;
        store.insertSpan(itemId, s.start, s.end);
        added++;
      }
    });
    return c.json({ added });
  });

  app.delete("/api/data", (c) => {
    tracker.stop();
    store.deleteEverything();
    tracker.start();
    return c.json({ ok: true });
  });

  // --- Extension ---
  app.post("/api/ext/heartbeat", async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as { url?: string; audible?: boolean; incognito?: boolean; browser?: string };
    const browser = b.browser === "brave" ? "brave" : "chrome"; // older extension versions didn't send this
    tracker.ext.set(browser, { domain: domainOf(b.url), audible: !!b.audible, incognito: !!b.incognito, at: Date.now() });
    return c.json({ ok: true });
  });

  return app;
}
