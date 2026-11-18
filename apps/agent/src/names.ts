/** Friendly names for programs, from the exe's "File description" (e.g. code.exe -> "Visual Studio Code"). */
import { execFile } from "node:child_process";
import { basename } from "node:path";

const OVERRIDES: Record<string, string> = {
  "code.exe": "VS Code",
  "explorer.exe": "File Explorer",
  "windowsterminal.exe": "Terminal",
  "chrome.exe": "Google Chrome",
  "brave.exe": "Brave",
  "msedge.exe": "Microsoft Edge",
  "winword.exe": "Word",
  "powerpnt.exe": "PowerPoint",
  "olk.exe": "Outlook",
  "ms-teams.exe": "Microsoft Teams",
};

export function fallbackName(exePath: string): string {
  const exe = basename(exePath).toLowerCase();
  if (OVERRIDES[exe]) return OVERRIDES[exe];
  const raw = basename(exePath).replace(/\.exe$/i, "");
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Asks Windows for the file description. Resolves null if unavailable. */
export function fileDescription(exePath: string): Promise<string | null> {
  const exe = basename(exePath).toLowerCase();
  if (OVERRIDES[exe]) return Promise.resolve(OVERRIDES[exe]);
  const ps = `(Get-Item -LiteralPath '${exePath.replace(/'/g, "''")}').VersionInfo.FileDescription`;
  return new Promise((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], { windowsHide: true, timeout: 8000 }, (err, out) => {
      const name = (out ?? "").trim();
      // Some programs ship junk descriptions; keep them short and human
      resolve(!err && name && name.length <= 40 && !/\.exe$/i.test(name) ? name : null);
    });
  });
}
