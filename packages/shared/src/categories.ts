import type { ChartColor } from "./types.ts";

/** Built-in category rules. Keys are lower-case exe names (apps) or domains (websites). */
const APP_RULES: Record<string, string> = {
  "figma.exe": "Design",
  "photoshop.exe": "Design",
  "illustrator.exe": "Design",
  "code.exe": "Development",
  "cursor.exe": "Development",
  "windowsterminal.exe": "Development",
  "wt.exe": "Development",
  "powershell.exe": "Development",
  "pwsh.exe": "Development",
  "cmd.exe": "Development",
  "devenv.exe": "Development",
  "idea64.exe": "Development",
  "pycharm64.exe": "Development",
  "postman.exe": "Development",
  "github desktop.exe": "Development",
  "githubdesktop.exe": "Development",
  "notion.exe": "Productivity",
  "obsidian.exe": "Productivity",
  "winword.exe": "Productivity",
  "excel.exe": "Productivity",
  "powerpnt.exe": "Productivity",
  "onenote.exe": "Productivity",
  "notepad.exe": "Productivity",
  "acrobat.exe": "Productivity",
  "slack.exe": "Communication",
  "teams.exe": "Communication",
  "ms-teams.exe": "Communication",
  "outlook.exe": "Communication",
  "olk.exe": "Communication",
  "discord.exe": "Communication",
  "whatsapp.exe": "Communication",
  "telegram.exe": "Communication",
  "zoom.exe": "Communication",
  "spotify.exe": "Music",
  "vlc.exe": "Media",
  "steam.exe": "Games",
  "explorer.exe": "Utilities",
  "chrome.exe": "Browsing",
  "brave.exe": "Browsing",
  "opera.exe": "Browsing",
  "opera gx.exe": "Browsing",
  "vivaldi.exe": "Browsing",
  "chromium.exe": "Browsing",
  "arc.exe": "Browsing",
  "msedge.exe": "Browsing",
  "firefox.exe": "Browsing",
  "claude.exe": "Productivity",
};

const WEB_RULES: Array<[RegExp, string]> = [
  [/(^|\.)github\.com$|(^|\.)gitlab\.com$|stackoverflow\.com$|developer\.mozilla\.org$|npmjs\.com$|vercel\.com$|localhost$|127\.0\.0\.1$/, "Development"],
  [/(^|\.)youtube\.com$|netflix\.com$|twitch\.tv$|primevideo\.com$|disneyplus\.com$/, "Entertainment"],
  [/reddit\.com$|(^|\.)x\.com$|twitter\.com$|facebook\.com$|instagram\.com$|linkedin\.com$|tiktok\.com$/, "Social"],
  [/docs\.google\.com$|drive\.google\.com$|calendar\.google\.com$|notion\.so$|claude\.ai$|chatgpt\.com$|chat\.openai\.com$|office\.com$/, "Productivity"],
  [/mail\.google\.com$|outlook\.(live|office)\.com$|slack\.com$|web\.whatsapp\.com$/, "Communication"],
  [/figma\.com$|dribbble\.com$|behance\.net$|unsplash\.com$/, "Design"],
  [/news\.ycombinator\.com$|bbc\.(com|co\.uk)$|cnn\.com$|nytimes\.com$|theguardian\.com$|aljazeera\.(com|net)$/, "News"],
  [/wikipedia\.org$|translate\.google\.com$|maps\.google\.com$/, "Reference"],
  [/amazon\.|ebay\.|aliexpress\./, "Shopping"],
  [/spotify\.com$|soundcloud\.com$/, "Music"],
  [/medium\.com$|substack\.com$/, "Reading"],
];

export function categorize(kind: "app" | "web", key: string): string {
  if (kind === "app") {
    const exe = key.split(/[\\/]/).pop()!.toLowerCase();
    return APP_RULES[exe] ?? "Other";
  }
  const host = key.toLowerCase();
  for (const [re, cat] of WEB_RULES) if (re.test(host)) return cat;
  return "Other";
}

const PALETTE: ChartColor[] = ["sage", "slate", "clay", "mauve", "sand"];

/** Stable color per item, so an app keeps its tint forever. */
export function colorFor(id: string): ChartColor {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** "https://www.github.com/x" -> "github.com"; returns null for non-web pages. */
export function domainOf(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.replace(/^www\./, "").toLowerCase() || null;
  } catch {
    return null;
  }
}
