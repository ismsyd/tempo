/** Local SQLite storage (Node's built-in node:sqlite — no native build). */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { DEFAULT_SETTINGS } from "@tempo/shared";
import type { ChartColor, Item, ItemKind, Settings, Span } from "@tempo/shared";

interface ItemRow {
  id: string;
  kind: string;
  key: string;
  name: string;
  category: string;
  color: string;
  excluded: number;
  daily_limit: number | null;
  first_seen: number;
}

function toItem(r: ItemRow): Item {
  return {
    id: r.id,
    kind: r.kind as ItemKind,
    key: r.key,
    name: r.name,
    category: r.category,
    color: r.color as ChartColor,
    excluded: !!r.excluded,
    dailyLimitMinutes: r.daily_limit,
    firstSeen: r.first_seen,
  };
}

export class Store {
  db: DatabaseSync;
  path: string;

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.path = join(dataDir, "tempo.sqlite");
    this.db = new DatabaseSync(this.path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        color TEXT NOT NULL,
        excluded INTEGER NOT NULL DEFAULT 0,
        daily_limit INTEGER,
        first_seen INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS spans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id TEXT NOT NULL,
        start INTEGER NOT NULL,
        end INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS spans_start ON spans(start);
      CREATE INDEX IF NOT EXISTS spans_item_end ON spans(item_id, end);
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    if (!this.getKV("schema")) this.setKV("schema", "1");
  }

  // ---------- key/value ----------
  getKV(key: string): string | null {
    const r = this.db.prepare("SELECT value FROM kv WHERE key = ?").get(key) as { value: string } | undefined;
    return r?.value ?? null;
  }
  setKV(key: string, value: string) {
    this.db.prepare("INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
  }

  // ---------- settings ----------
  getSettings(): Settings {
    const raw = this.getKV("settings");
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  }
  saveSettings(s: Settings) {
    this.setKV("settings", JSON.stringify(s));
  }

  /** Secret the Chrome extension must send; created on first run. */
  pairingToken(reset = false): string {
    let t = this.getKV("pairing");
    if (!t || reset) {
      t = randomBytes(4).toString("hex").toUpperCase(); // short enough to type, e.g. "9F3A1C2B"
      this.setKV("pairing", t);
    }
    return t;
  }

  // ---------- items ----------
  items(): Item[] {
    return (this.db.prepare("SELECT * FROM items").all() as unknown as ItemRow[]).map(toItem);
  }
  itemByKey(key: string): Item | null {
    const r = this.db.prepare("SELECT * FROM items WHERE key = ?").get(key) as ItemRow | undefined;
    return r ? toItem(r) : null;
  }
  itemById(id: string): Item | null {
    const r = this.db.prepare("SELECT * FROM items WHERE id = ?").get(id) as ItemRow | undefined;
    return r ? toItem(r) : null;
  }
  insertItem(i: Item) {
    this.db
      .prepare("INSERT OR IGNORE INTO items(id, kind, key, name, category, color, excluded, daily_limit, first_seen) VALUES(?,?,?,?,?,?,?,?,?)")
      .run(i.id, i.kind, i.key, i.name, i.category, i.color, i.excluded ? 1 : 0, i.dailyLimitMinutes, i.firstSeen);
  }
  updateItem(id: string, patch: Partial<Pick<Item, "name" | "category" | "excluded" | "dailyLimitMinutes">>) {
    if (patch.name !== undefined) this.db.prepare("UPDATE items SET name = ? WHERE id = ?").run(patch.name, id);
    if (patch.category !== undefined) this.db.prepare("UPDATE items SET category = ? WHERE id = ?").run(patch.category, id);
    if (patch.excluded !== undefined) this.db.prepare("UPDATE items SET excluded = ? WHERE id = ?").run(patch.excluded ? 1 : 0, id);
    if (patch.dailyLimitMinutes !== undefined) this.db.prepare("UPDATE items SET daily_limit = ? WHERE id = ?").run(patch.dailyLimitMinutes, id);
  }

  // ---------- spans ----------
  insertSpan(itemId: string, start: number, end: number): number {
    const r = this.db.prepare("INSERT INTO spans(item_id, start, end) VALUES(?,?,?)").run(itemId, start, end);
    return Number(r.lastInsertRowid);
  }
  setSpanEnd(id: number, end: number) {
    this.db.prepare("UPDATE spans SET end = ? WHERE id = ?").run(end, id);
  }
  deleteSpan(id: number) {
    this.db.prepare("DELETE FROM spans WHERE id = ?").run(id);
  }
  /** Spans overlapping [from, to). */
  spansBetween(from: number, to: number): Span[] {
    return (this.db.prepare("SELECT item_id, start, end FROM spans WHERE end > ? AND start < ? ORDER BY start").all(from, to) as unknown as Array<{ item_id: string; start: number; end: number }>).map(
      (r) => ({ itemId: r.item_id, start: r.start, end: r.end }),
    );
  }
  latestSpan(itemId: string): Span | null {
    const r = this.db.prepare("SELECT start, end FROM spans WHERE item_id = ? ORDER BY end DESC LIMIT 1").get(itemId) as { start: number; end: number } | undefined;
    return r ? { itemId, start: r.start, end: r.end } : null;
  }
  allSpans(): Span[] {
    return this.spansBetween(0, Number.MAX_SAFE_INTEGER);
  }
  hasSpan(itemId: string, start: number): boolean {
    return !!this.db.prepare("SELECT 1 FROM spans WHERE item_id = ? AND start = ?").get(itemId, start);
  }
  deleteBefore(ts: number): number {
    return Number(this.db.prepare("DELETE FROM spans WHERE end < ?").run(ts).changes);
  }
  deleteEverything() {
    this.db.exec("DELETE FROM spans; DELETE FROM items; DELETE FROM kv WHERE key LIKE 'notified:%' OR key LIKE 'weekly:%';");
  }
  transaction(fn: () => void) {
    this.db.exec("BEGIN");
    try {
      fn();
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
}
