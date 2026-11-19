// Tempo extension — reports the active tab of the focused browser window to the local Tempo app.
// Works in Chromium-based browsers: Chrome, Brave, Edge, Opera, Opera GX, Vivaldi, Chromium, Arc.
// It only ever talks to http://127.0.0.1:4747. Nothing is stored except the pairing code and last status.

const ENDPOINT = "http://127.0.0.1:4747/api/ext/heartbeat";
const HEARTBEAT_MINUTES = 0.5; // minimum alarm period (30 s)

let pending = null;

// Tempo matches this extension to the browser window in front (brave.exe, msedge.exe, opera.exe…).
// Browsers that disguise themselves (Vivaldi, Arc) are matched by focus instead — see "focused" below.
function detectBrowser() {
  if (navigator.brave) return "brave";
  const brands = (navigator.userAgentData?.brands ?? []).map((b) => b.brand);
  const has = (re) => brands.some((b) => re.test(b));
  if (has(/brave/i)) return "brave";
  if (has(/microsoft edge/i)) return "edge";
  if (has(/opera gx/i)) return "opera-gx";
  if (has(/opera/i)) return "opera";
  if (has(/vivaldi/i)) return "vivaldi";
  if (has(/google chrome/i)) return "chrome";
  if (has(/chromium/i)) return "chromium";
  return "chrome";
}
const BROWSER = detectBrowser();

async function focusedTab() {
  const win = await chrome.windows.getLastFocused({ windowTypes: ["normal", "popup", "app"] }).catch(() => null);
  if (!win || !win.focused) return { focused: false, tab: null };
  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  return { focused: true, tab: tab ?? null };
}

async function report() {
  const { token } = await chrome.storage.local.get("token");
  if (!token) {
    await chrome.storage.local.set({ status: { ok: false, error: "Not paired yet", at: Date.now() } });
    return;
  }
  const { focused, tab } = await focusedTab();
  const body = {
    url: tab?.url ?? null,
    audible: !!tab?.audible,
    incognito: !!tab?.incognito,
    browser: BROWSER,
    focused,
  };
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const error = res.ok ? null : res.status === 401 ? "Pairing code doesn't match" : `Tempo answered ${res.status}`;
    await chrome.storage.local.set({ status: { ok: res.ok, error, at: Date.now(), url: body.url } });
  } catch {
    await chrome.storage.local.set({ status: { ok: false, error: "Tempo isn't running", at: Date.now() } });
  }
}

// Coalesce bursts of tab events into one report
function schedule() {
  clearTimeout(pending);
  pending = setTimeout(report, 250);
}

chrome.tabs.onActivated.addListener(schedule);
chrome.tabs.onUpdated.addListener((_id, change, tab) => {
  if (!tab.active) return;
  if (change.url || change.audible !== undefined || change.status === "complete") schedule();
});
chrome.windows.onFocusChanged.addListener(schedule);

chrome.alarms.onAlarm.addListener((a) => a.name === "heartbeat" && report());
const ensureAlarm = () => chrome.alarms.create("heartbeat", { periodInMinutes: HEARTBEAT_MINUTES });
chrome.runtime.onInstalled.addListener(() => {
  ensureAlarm();
  report();
});
chrome.runtime.onStartup.addListener(() => {
  ensureAlarm();
  report();
});

// The popup asks for an immediate report after pairing
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg === "report-now") report().then(() => reply(true));
  return true;
});
