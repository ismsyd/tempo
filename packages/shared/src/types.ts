export type ItemKind = "app" | "web";

/** Muted chart palette tokens (match Figma variables chart/*). */
export type ChartColor = "sage" | "clay" | "slate" | "sand" | "mauve";

export interface Item {
  id: string;
  kind: ItemKind;
  /** exe path for apps, domain for websites */
  key: string;
  name: string;
  category: string;
  color: ChartColor;
  excluded: boolean;
  dailyLimitMinutes: number | null;
  firstSeen: number;
}

/** A continuous stretch of activity on one item. Times are epoch ms. */
export interface Span {
  itemId: string;
  start: number;
  end: number;
}

export type WeekFilter = "all" | "apps" | "web";
export type WeekSort = "time" | "name" | "recent";

export interface WeekItemRow {
  id: string;
  kind: ItemKind;
  name: string;
  category: string;
  color: ChartColor;
  minutes: number;
  /** 0..1 relative to the top item of the (unfiltered) week */
  share: number;
  lastUsed: number;
}

export interface WeekSummary {
  weekStart: string; // YYYY-MM-DD (local)
  weekEnd: string; // YYYY-MM-DD (local, inclusive)
  isCurrentWeek: boolean;
  daysElapsed: number;
  totalMinutes: number;
  previousTotalMinutes: number;
  /** minutes per day, index 0 = first day of the week */
  perDay: number[];
  dayLabels: string[];
  dailyAverageMinutes: number;
  dailyAverageDeltaPct: number | null;
  appsUsed: number;
  newApps: number;
  websites: number;
  topWebsite: string | null;
  longestSession: { minutes: number; itemName: string; start: number } | null;
  counts: { all: number; apps: number; web: number };
  items: WeekItemRow[];
  summary: string;
}

export interface SessionInfo {
  start: number;
  end: number;
  minutes: number;
}

export interface ItemDetail {
  item: Item;
  weekStart: string;
  weekEnd: string;
  totalMinutes: number;
  shareOfWeek: number;
  dailyAverageMinutes: number;
  dailyAverageDeltaPct: number | null;
  sessionCount: number;
  sessionsPerDay: number;
  averageSessionSeconds: number;
  longestSession: SessionInfo | null;
  lastUsed: number | null;
  perDay: number[];
  dayLabels: string[];
  timeOfDay: { morning: number; afternoon: number; evening: number; night: number };
  /** [day][hour] minutes 0..60 */
  heatmap: number[][];
  /** average session length in minutes per day (0 when no sessions) */
  averageSessionPerDay: number[];
  recentSessions: SessionInfo[];
}

export interface Settings {
  trackApps: boolean;
  trackWebsites: boolean;
  idleTimeoutMinutes: number;
  ignorePrivateWindows: boolean;
  dailyGoalMinutes: number | null;
  limitReminders: boolean;
  weeklySummary: { day: number; hour: number } | null; // day 0=Sunday
  weekStartsOn: 0 | 1 | 6; // Sunday, Monday, Saturday
  reduceMotion: boolean;
  keepDataLocal: true;
  retentionDays: number | null; // null = forever
}

export const DEFAULT_SETTINGS: Settings = {
  trackApps: true,
  trackWebsites: true,
  idleTimeoutMinutes: 5,
  ignorePrivateWindows: true,
  dailyGoalMinutes: 360,
  limitReminders: true,
  weeklySummary: { day: 1, hour: 9 },
  weekStartsOn: 1,
  reduceMotion: false,
  keepDataLocal: true,
  retentionDays: 90,
};
