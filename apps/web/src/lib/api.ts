/**
 * Data access for the web app — talks to the local Tempo agent at /api
 * (same origin in production; proxied by Vite during development).
 */
import type { Item, ItemDetail, Settings, WeekFilter, WeekSort, WeekSummary } from "@tempo/shared";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: init.body && typeof init.body === "string" ? { "content-type": "application/json", ...init.headers } : init.headers,
    });
  } catch {
    throw new ApiError(0, "Tempo's tracker isn't running");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export interface WeekQuery {
  weekStart: string;
  filter: WeekFilter;
  sort: WeekSort;
  query: string;
}

export interface Status {
  ok: boolean;
  version: string;
  tracking: { apps: boolean; websites: boolean };
  extension: { connected: boolean; lastSeen: number | null };
  current: { itemId: string; name: string } | null;
}

export const getStatus = () => call<Status>("/api/status");

export function getWeek(q: WeekQuery): Promise<WeekSummary> {
  const p = new URLSearchParams({ start: q.weekStart, filter: q.filter, sort: q.sort, q: q.query.trim() });
  return call(`/api/week?${p}`);
}

export async function getItem(id: string, weekStart: string): Promise<ItemDetail | null> {
  try {
    return await call(`/api/items/${encodeURIComponent(id)}?week=${weekStart}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export const getItems = () => call<Item[]>("/api/items");

export const updateItem = (id: string, patch: Partial<Pick<Item, "excluded" | "dailyLimitMinutes">>) =>
  call<Item>(`/api/items/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(patch) });

export const getSettings = () => call<Settings>("/api/settings");

export const saveSettings = (patch: Partial<Settings>) => call<Settings>("/api/settings", { method: "PUT", body: JSON.stringify(patch) });

export const getPairing = () => call<{ code: string }>("/api/pairing");
export const resetPairing = () => call<{ code: string }>("/api/pairing/reset", { method: "POST" });

/** The browser downloads the file directly from the agent. */
export function exportUrl(format: "json" | "csv") {
  return `/api/export?format=${format}`;
}

export async function importData(file: File): Promise<number> {
  const text = await file.text();
  try {
    JSON.parse(text);
  } catch {
    throw new Error("This file isn't a Tempo export.");
  }
  const res = await call<{ added: number }>("/api/import", { method: "POST", body: text });
  return res.added;
}

export const deleteAllData = () => call<{ ok: true }>("/api/data", { method: "DELETE" });
