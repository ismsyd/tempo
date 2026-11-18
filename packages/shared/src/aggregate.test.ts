import { describe, expect, it } from "vitest";
import { aggregateItem, aggregateWeek, mergeSessions } from "./aggregate.ts";
import { HOUR, MINUTE, addDays, splitByHour, startOfWeek } from "./time.ts";
import { generateDemoData } from "./demo.ts";
import type { Item } from "./types.ts";

const monday = new Date(2026, 10, 16).getTime(); // Mon Nov 16 2026
const item = (id: string, kind: "app" | "web" = "app"): Item => ({
  id, kind, key: id, name: id, category: "Dev", color: "sage", excluded: false, dailyLimitMinutes: null, firstSeen: 0,
});

describe("time helpers", () => {
  it("splits spans on hour boundaries", () => {
    const s = monday + 9 * HOUR + 50 * MINUTE;
    const parts = splitByHour(s, s + 20 * MINUTE);
    expect(parts).toHaveLength(2);
    expect((parts[0].end - parts[0].start) / MINUTE).toBe(10);
  });
  it("finds the week start for Monday and Sunday weeks", () => {
    const wed = monday + 2 * 24 * HOUR + 5 * HOUR;
    expect(startOfWeek(wed, 1)).toBe(monday);
    expect(startOfWeek(wed, 0)).toBe(addDays(monday, -1));
  });
});

describe("sessions", () => {
  it("merges spans with gaps under 2 minutes", () => {
    const a = { itemId: "x", start: 0, end: 10 * MINUTE };
    const b = { itemId: "x", start: 11 * MINUTE, end: 20 * MINUTE };
    const c = { itemId: "x", start: 30 * MINUTE, end: 35 * MINUTE };
    const out = mergeSessions([c, a, b]);
    expect(out).toHaveLength(2);
    expect(out[0].minutes).toBe(19);
  });
});

describe("aggregateWeek", () => {
  it("splits a span crossing midnight into two days", () => {
    const start = monday + 23 * HOUR + 30 * MINUTE;
    const res = aggregateWeek([item("a")], [{ itemId: "a", start, end: start + HOUR }], monday, addDays(monday, 8));
    expect(res.perDay[0]).toBeCloseTo(30);
    expect(res.perDay[1]).toBeCloseTo(30);
    expect(res.totalMinutes).toBeCloseTo(60);
    expect(res.daysElapsed).toBe(7);
  });
  it("uses elapsed days for the average in the current week", () => {
    const now = monday + 2 * 24 * HOUR + 12 * HOUR; // Wed noon
    const res = aggregateWeek([item("a")], [{ itemId: "a", start: monday + 10 * HOUR, end: monday + 13 * HOUR }], monday, now);
    expect(res.daysElapsed).toBe(3);
    expect(res.dailyAverageMinutes).toBeCloseTo(60);
    expect(res.isCurrentWeek).toBe(true);
  });
  it("ignores excluded items and data after now", () => {
    const ex = { ...item("b"), excluded: true };
    const now = monday + 12 * HOUR;
    const res = aggregateWeek(
      [item("a"), ex],
      [
        { itemId: "a", start: monday + 11 * HOUR, end: monday + 14 * HOUR },
        { itemId: "b", start: monday + 9 * HOUR, end: monday + 10 * HOUR },
      ],
      monday,
      now,
    );
    expect(res.totalMinutes).toBeCloseTo(60);
    expect(res.items.map((r) => r.id)).toEqual(["a"]);
  });
  it("filters and counts apps vs websites", () => {
    const res = aggregateWeek(
      [item("a"), item("w", "web")],
      [
        { itemId: "a", start: monday + HOUR, end: monday + 2 * HOUR },
        { itemId: "w", start: monday + 3 * HOUR, end: monday + 4 * HOUR },
      ],
      monday,
      addDays(monday, 7),
      { filter: "web" },
    );
    expect(res.counts).toEqual({ all: 2, apps: 1, web: 1 });
    expect(res.items.map((r) => r.id)).toEqual(["w"]);
  });
});

describe("aggregateItem", () => {
  it("builds heatmap and time-of-day buckets", () => {
    const res = aggregateItem([item("a")], [{ itemId: "a", start: monday + 10 * HOUR, end: monday + 11 * HOUR + 30 * MINUTE }], "a", monday, addDays(monday, 7))!;
    expect(res.heatmap[0][10]).toBeCloseTo(60);
    expect(res.heatmap[0][11]).toBeCloseTo(30);
    expect(res.timeOfDay.morning).toBeCloseTo(90);
    expect(res.sessionCount).toBe(1);
    expect(res.averageSessionSeconds).toBeCloseTo(90 * 60);
  });
});

describe("demo data", () => {
  it("is deterministic and non-empty", () => {
    const now = monday + 2 * 24 * HOUR + 16 * HOUR;
    const a = generateDemoData(now);
    const b = generateDemoData(now);
    expect(a.spans.length).toBe(b.spans.length);
    expect(a.items).toHaveLength(42);
    const week = aggregateWeek(a.items, a.spans, addDays(monday, -7), now);
    expect(week.totalMinutes).toBeGreaterThan(1500);
    expect(week.items[0].name).toBe("Figma");
  });
});
