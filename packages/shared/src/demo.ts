/**
 * Deterministic sample data shaped like the Figma design.
 * Used for the web app until the local agent is running, and by the seed script later.
 */
import type { ChartColor, Item, ItemKind, Span } from "./types.ts";
import { HOUR, MINUTE, addDays, startOfWeek } from "./time.ts";

type Profile = "work" | "evening" | "mixed";

interface DemoDef {
  name: string;
  kind: ItemKind;
  category: string;
  color: ChartColor;
  weeklyMinutes: number;
  profile: Profile;
}

const DEFS: DemoDef[] = [
  { name: "Figma", kind: "app", category: "Design", color: "sage", weeklyMinutes: 580, profile: "work" },
  { name: "VS Code", kind: "app", category: "Development", color: "slate", weeklyMinutes: 492, profile: "work" },
  { name: "github.com", kind: "web", category: "Development", color: "slate", weeklyMinutes: 245, profile: "work" },
  { name: "Notion", kind: "app", category: "Productivity", color: "clay", weeklyMinutes: 228, profile: "mixed" },
  { name: "youtube.com", kind: "web", category: "Entertainment", color: "mauve", weeklyMinutes: 190, profile: "evening" },
  { name: "Slack", kind: "app", category: "Communication", color: "sand", weeklyMinutes: 174, profile: "work" },
  { name: "Spotify", kind: "app", category: "Music", color: "mauve", weeklyMinutes: 140, profile: "mixed" },
  { name: "docs.google.com", kind: "web", category: "Productivity", color: "clay", weeklyMinutes: 106, profile: "work" },
  { name: "Terminal", kind: "app", category: "Development", color: "slate", weeklyMinutes: 75, profile: "work" },
  { name: "reddit.com", kind: "web", category: "Social", color: "sand", weeklyMinutes: 62, profile: "evening" },
  // the long tail
  { name: "Outlook", kind: "app", category: "Communication", color: "sand", weeklyMinutes: 48, profile: "work" },
  { name: "stackoverflow.com", kind: "web", category: "Development", color: "slate", weeklyMinutes: 44, profile: "work" },
  { name: "File Explorer", kind: "app", category: "Utilities", color: "sage", weeklyMinutes: 38, profile: "mixed" },
  { name: "mail.google.com", kind: "web", category: "Communication", color: "sand", weeklyMinutes: 36, profile: "mixed" },
  { name: "developer.mozilla.org", kind: "web", category: "Development", color: "slate", weeklyMinutes: 31, profile: "work" },
  { name: "WhatsApp", kind: "app", category: "Communication", color: "sage", weeklyMinutes: 29, profile: "evening" },
  { name: "news.ycombinator.com", kind: "web", category: "News", color: "clay", weeklyMinutes: 27, profile: "evening" },
  { name: "Excel", kind: "app", category: "Productivity", color: "sage", weeklyMinutes: 24, profile: "work" },
  { name: "figma.com", kind: "web", category: "Design", color: "sage", weeklyMinutes: 22, profile: "work" },
  { name: "linkedin.com", kind: "web", category: "Social", color: "slate", weeklyMinutes: 20, profile: "mixed" },
  { name: "Calculator", kind: "app", category: "Utilities", color: "sand", weeklyMinutes: 6, profile: "mixed" },
  { name: "chat.openai.com", kind: "web", category: "Productivity", color: "mauve", weeklyMinutes: 18, profile: "work" },
  { name: "claude.ai", kind: "web", category: "Productivity", color: "clay", weeklyMinutes: 34, profile: "work" },
  { name: "wikipedia.org", kind: "web", category: "Reference", color: "sand", weeklyMinutes: 16, profile: "evening" },
  { name: "Photos", kind: "app", category: "Media", color: "mauve", weeklyMinutes: 12, profile: "evening" },
  { name: "amazon.com", kind: "web", category: "Shopping", color: "clay", weeklyMinutes: 15, profile: "evening" },
  { name: "netflix.com", kind: "web", category: "Entertainment", color: "mauve", weeklyMinutes: 55, profile: "evening" },
  { name: "dribbble.com", kind: "web", category: "Design", color: "sage", weeklyMinutes: 14, profile: "work" },
  { name: "Settings", kind: "app", category: "Utilities", color: "slate", weeklyMinutes: 5, profile: "mixed" },
  { name: "x.com", kind: "web", category: "Social", color: "slate", weeklyMinutes: 13, profile: "evening" },
  { name: "maps.google.com", kind: "web", category: "Reference", color: "sage", weeklyMinutes: 8, profile: "mixed" },
  { name: "npmjs.com", kind: "web", category: "Development", color: "clay", weeklyMinutes: 11, profile: "work" },
  { name: "Discord", kind: "app", category: "Communication", color: "mauve", weeklyMinutes: 21, profile: "evening" },
  { name: "medium.com", kind: "web", category: "Reading", color: "sand", weeklyMinutes: 10, profile: "evening" },
  { name: "calendar.google.com", kind: "web", category: "Productivity", color: "sage", weeklyMinutes: 9, profile: "work" },
  { name: "vercel.com", kind: "web", category: "Development", color: "slate", weeklyMinutes: 7, profile: "work" },
  { name: "Snipping Tool", kind: "app", category: "Utilities", color: "sand", weeklyMinutes: 4, profile: "work" },
  { name: "twitch.tv", kind: "web", category: "Entertainment", color: "mauve", weeklyMinutes: 12, profile: "evening" },
  { name: "bbc.com", kind: "web", category: "News", color: "clay", weeklyMinutes: 9, profile: "mixed" },
  { name: "unsplash.com", kind: "web", category: "Design", color: "sage", weeklyMinutes: 6, profile: "work" },
  { name: "translate.google.com", kind: "web", category: "Reference", color: "slate", weeklyMinutes: 5, profile: "mixed" },
  { name: "drive.google.com", kind: "web", category: "Productivity", color: "sand", weeklyMinutes: 8, profile: "work" },
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Relative day weights (Mon..Sun) per profile
const DAY_WEIGHTS: Record<Profile, number[]> = {
  work: [1, 1.1, 1.45, 0.85, 1.2, 0.25, 0.15],
  evening: [0.8, 0.7, 0.9, 1, 1.2, 1.6, 1.5],
  mixed: [1, 1, 1.1, 0.9, 1, 1, 0.9],
};
// Hour windows sessions are drawn from (weighted)
const HOURS: Record<Profile, number[]> = {
  work: [9, 9, 10, 10, 10, 11, 11, 13, 14, 14, 15, 15, 16, 16, 17, 20, 21],
  evening: [12, 13, 19, 19, 20, 20, 21, 21, 22, 22, 23, 15, 16],
  mixed: [8, 9, 11, 12, 13, 15, 17, 18, 19, 20, 21],
};

export interface DemoData {
  items: Item[];
  spans: Span[];
}

/** Generates `weeks` full weeks of history up to `now` (Monday-based weeks). */
export function generateDemoData(now: number, weeks = 5): DemoData {
  const rand = mulberry32(20261118);
  const firstWeek = addDays(startOfWeek(now, 1), -7 * (weeks - 1));
  const items: Item[] = DEFS.map((d, i) => ({
    id: slug(d.name),
    kind: d.kind,
    key: d.kind === "web" ? d.name : `C:\\Program Files\\${d.name}\\${slug(d.name)}.exe`,
    name: d.name,
    category: d.category,
    color: d.color,
    excluded: false,
    dailyLimitMinutes: null,
    // a few apps are "new" in the current week
    firstSeen: i === 15 || i === 24 || i === 32 ? addDays(startOfWeek(now, 1), 1) : firstWeek,
  }));

  const spans: Span[] = [];
  for (let w = 0; w < weeks; w++) {
    const weekStart = addDays(firstWeek, w * 7);
    const weekScale = 0.9 + rand() * 0.2;
    DEFS.forEach((def, idx) => {
      const item = items[idx];
      if (item.firstSeen > addDays(weekStart, 6)) return;
      const weights = DAY_WEIGHTS[def.profile];
      const wsum = weights.reduce((a, b) => a + b, 0);
      for (let d = 0; d < 7; d++) {
        const dayStart = addDays(weekStart, d);
        if (dayStart < item.firstSeen && item.firstSeen > firstWeek) continue;
        let remaining = (def.weeklyMinutes * weekScale * weights[d]) / wsum * (0.75 + rand() * 0.5);
        const maxLen = def.weeklyMinutes > 200 ? 75 : def.weeklyMinutes > 60 ? 35 : 15;
        let guard = 0;
        while (remaining > 1 && guard++ < 40) {
          const len = Math.min(remaining, 2 + rand() * maxLen);
          const hours = HOURS[def.profile];
          const h = hours[Math.floor(rand() * hours.length)];
          const start = dayStart + h * HOUR + Math.floor(rand() * 50) * MINUTE;
          const end = start + len * MINUTE;
          if (start < now) spans.push({ itemId: item.id, start, end: Math.min(end, now) });
          remaining -= len;
        }
      }
    });
  }
  spans.sort((a, b) => a.start - b.start);
  return { items, spans };
}
