/**
 * Which browser a program is, and which extension report belongs to the browser in front.
 * Pure functions (no Windows calls) so they can be unit-tested.
 */

export interface ExtensionState {
  domain: string | null;
  audible: boolean;
  incognito: boolean;
  /** true when the extension's browser has a focused window */
  focused: boolean;
  at: number;
}

export const EXT_FRESH_MS = 75_000; // reports older than this are ignored

export const BROWSER_NAMES: Record<string, string> = {
  chrome: "Chrome",
  brave: "Brave",
  edge: "Edge",
  opera: "Opera",
  "opera-gx": "Opera GX",
  vivaldi: "Vivaldi",
  chromium: "Chromium",
  arc: "Arc",
};

/** Browser id for a program path, or null if it isn't a supported browser. */
export function browserOf(exePath: string | null): string | null {
  if (!exePath) return null;
  const p = exePath.toLowerCase().replace(/\//g, "\\");
  const exe = p.split("\\").pop()!;
  switch (exe) {
    case "brave.exe":
      return "brave";
    case "msedge.exe":
      return "edge";
    case "vivaldi.exe":
      return "vivaldi";
    case "arc.exe":
      return "arc";
    case "opera.exe":
      return p.includes("opera gx") ? "opera-gx" : "opera";
    case "chrome.exe":
      return p.includes("\\chromium\\") ? "chromium" : "chrome";
    default:
      return null;
  }
}

/** Distinct item key per browser (Opera and Opera GX share opera.exe; Chrome and Chromium share chrome.exe). */
export function browserItemKey(browser: string): string | null {
  if (browser === "opera-gx") return "opera gx.exe";
  if (browser === "chromium") return "chromium.exe";
  return null;
}

/**
 * Picks the extension report for the browser in front.
 * 1. The report from that exact browser, if fresh.
 * 2. Otherwise the freshest report that says its window is focused. This covers browsers
 *    that disguise themselves as Chrome (e.g. Vivaldi). A browser *without* the extension never
 *    claims focus, so its time isn't wrongly given to another browser's tab.
 */
export function pickReport(browser: string, reports: Map<string, ExtensionState>, now: number): ExtensionState | null {
  const fresh = (s: ExtensionState | undefined) => !!s && now - s.at < EXT_FRESH_MS;
  const exact = reports.get(browser);
  if (fresh(exact)) return exact!;
  let best: ExtensionState | null = null;
  for (const s of reports.values()) {
    if (fresh(s) && s.focused && (!best || s.at > best.at)) best = s;
  }
  return best;
}
