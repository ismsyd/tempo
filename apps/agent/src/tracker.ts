/**
 * The tracking loop: once per second, decide what (if anything) is being used
 * and extend or start a span. See plan §5 for the rules implemented here.
 */
import { basename } from "node:path";
import { categorize, colorFor, slug } from "@tempo/shared";
import type { Item } from "@tempo/shared";
import type { Store } from "./db.ts";
import { getForeground, getIdleSeconds } from "./win32.ts";
import { fallbackName, fileDescription } from "./names.ts";

const TICK_MS = 1000;
const FLUSH_MS = 15_000; // crash safety: open span written at least this often
const CONTINUE_GAP_MS = 3_000; // same item within this gap extends the span
const SLEEP_GAP_MS = 15_000; // a longer gap between ticks means the PC slept
const EXT_FRESH_MS = 75_000; // extension reports older than this are ignored
const MIN_SPAN_MS = 1_000;

const BROWSERS = new Set(["chrome.exe"]);
const IGNORED = new Set(["lockapp.exe", "searchhost.exe", "shellexperiencehost.exe", "startmenuexperiencehost.exe", "screenclippinghost.exe"]);

export interface ExtensionState {
  domain: string | null;
  audible: boolean;
  incognito: boolean;
  at: number;
}

interface OpenSpan {
  id: number;
  itemId: string;
  start: number;
  end: number;
  flushedAt: number;
}

export class Tracker {
  store: Store;
  ext: ExtensionState | null = null;
  current: { itemId: string; name: string } | null = null;
  private open: OpenSpan | null = null;
  private lastTick = 0;
  private timer: NodeJS.Timeout | null = null;
  private naming = new Set<string>();

  constructor(store: Store) {
    this.store = store;
  }

  start() {
    this.timer = setInterval(() => {
      try {
        this.tick(Date.now());
      } catch (e) {
        console.error("[tracker]", e);
      }
    }, TICK_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.close(this.open?.end ?? Date.now());
  }

  /** Writes the open span's latest end so API reads include the current second. */
  flush() {
    if (this.open) {
      this.store.setSpanEnd(this.open.id, this.open.end);
      this.open.flushedAt = Date.now();
    }
  }

  extensionConnected(now = Date.now()): boolean {
    return !!this.ext && now - this.ext.at < EXT_FRESH_MS;
  }

  tick(now: number) {
    // Sleep / hibernate: close at the last tick we saw
    if (this.lastTick && now - this.lastTick > SLEEP_GAP_MS) this.close(this.lastTick);
    this.lastTick = now;

    const s = this.store.getSettings();
    const fg = getForeground();
    const exe = fg?.exePath ? basename(fg.exePath).toLowerCase() : null;
    const extFresh = this.extensionConnected(now);
    const isBrowser = !!exe && BROWSERS.has(exe);
    const mediaPlaying = isBrowser && extFresh && !!this.ext?.audible;

    const idle = getIdleSeconds();
    if (idle >= s.idleTimeoutMinutes * 60 && !mediaPlaying) {
      return this.close(Math.max(this.open?.start ?? 0, now - idle * 1000));
    }
    if (!fg || (exe && IGNORED.has(exe))) return this.close(now);

    let item: Item | null = null;
    if (isBrowser && s.trackWebsites && extFresh) {
      if (this.ext!.incognito && s.ignorePrivateWindows) return this.close(now);
      if (this.ext!.domain) item = this.ensureWeb(this.ext!.domain, now);
      else if (s.trackApps) item = this.ensureApp(fg.exePath, fg.title, now);
    } else if (s.trackApps) {
      item = this.ensureApp(fg.exePath, fg.title, now);
    }
    if (!item || item.excluded) return this.close(now);

    this.current = { itemId: item.id, name: item.name };
    const o = this.open;
    if (o && o.itemId === item.id && now - o.end <= CONTINUE_GAP_MS) {
      o.end = now;
      if (now - o.flushedAt >= FLUSH_MS) this.flush();
      return;
    }
    this.close(o?.end ?? now);
    const start = now - TICK_MS;
    this.open = { id: this.store.insertSpan(item.id, start, now), itemId: item.id, start, end: now, flushedAt: now };
  }

  private close(end: number) {
    const o = this.open;
    this.current = null;
    if (!o) return;
    this.open = null;
    const e = Math.max(o.start, Math.min(end, o.end + TICK_MS));
    if (e - o.start < MIN_SPAN_MS) this.store.deleteSpan(o.id);
    else this.store.setSpanEnd(o.id, e);
  }

  private ensureWeb(domain: string, now: number): Item {
    const key = domain;
    const found = this.store.itemByKey(key);
    if (found) return found;
    const id = `w-${slug(domain)}`;
    const item: Item = {
      id, kind: "web", key, name: domain, category: categorize("web", domain), color: colorFor(id),
      excluded: false, dailyLimitMinutes: null, firstSeen: now,
    };
    this.store.insertItem(item);
    return this.store.itemByKey(key)!;
  }

  private ensureApp(exePath: string | null, title: string, now: number): Item {
    let key: string;
    let name: string;
    if (!exePath) {
      key = "unknown";
      name = "Unknown app (admin)";
    } else if (basename(exePath).toLowerCase() === "applicationframehost.exe") {
      // Microsoft Store apps (Settings, Calculator…) all live inside this host; use the window title
      const t = title.split(" - ").pop()!.trim() || "Windows app";
      key = `uwp:${t.toLowerCase()}`;
      name = t;
    } else {
      key = basename(exePath).toLowerCase();
      name = fallbackName(exePath);
    }
    const found = this.store.itemByKey(key);
    if (found) return found;
    const id = `a-${slug(key.replace(/\.exe$/, "").replace(/^uwp:/, ""))}`;
    const item: Item = {
      id, kind: "app", key, name, category: categorize("app", key), color: colorFor(id),
      excluded: false, dailyLimitMinutes: null, firstSeen: now,
    };
    this.store.insertItem(item);
    // Look up the nicer name in the background
    if (exePath && !key.startsWith("uwp:") && !this.naming.has(key)) {
      this.naming.add(key);
      fileDescription(exePath).then((n) => n && n !== name && this.store.updateItem(id, { name: n }));
    }
    return this.store.itemByKey(key)!;
  }
}
