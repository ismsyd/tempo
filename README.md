# Tempo

A private, local screen-time tracker for Windows. It records which apps you use and (with the browser extension, for Chromium-based browsers) which websites you visit, and shows it in a calm web app at **http://127.0.0.1:4747**.

Everything stays on this computer: no accounts, no cloud, no sync.

## First-time setup

You need Node.js 22.18 or newer (this PC has Node 26), and a Chromium-based browser (Chrome, Brave, Edge, Opera, Opera GX, Vivaldi…) for website tracking.

```bash
npm install
npm run build
npm start
```

Open http://127.0.0.1:4747. Leave the terminal open while you want tracking. To have Tempo start with Windows instead, run the autostart script (below).

### Connect your browser (to see websites)

Works in **Chrome, Brave, Edge, Opera, Opera GX, Vivaldi, Chromium and Arc**. You can use several at once; do these steps in each one.

| Browser | Extensions page |
|---|---|
| Chrome / Chromium | `chrome://extensions` |
| Brave | `brave://extensions` |
| Edge | `edge://extensions` |
| Opera / Opera GX | `opera://extensions` |
| Vivaldi | `vivaldi://extensions` |

1. Open the extensions page and switch on **Developer mode**.
2. Click **Load unpacked** and choose the folder `apps\extension`.
3. In Tempo, open **Settings → Tracking → Browser extension → Connect** and copy the code.
4. Click the Tempo icon in the toolbar (pin it from the puzzle-piece menu), paste the code and press **Save**. The status turns to *Connected*.

### Start with Windows

```bash
npm run autostart:install
```

This builds the app and registers a **Task Scheduler** task named *Tempo* that starts at every login (also on battery). A small hidden watcher relaunches Tempo within seconds if it ever stops unexpectedly. To undo:

```bash
npm run autostart:remove
```

Start or stop it by hand (it starts again at your next login):

```bash
npm run autostart:start
npm run autostart:stop
```

## Where your data lives

`C:\Users\<you>\.tempo\tempo.sqlite`, a single SQLite file. Every save is forced to disk (`synchronous=FULL`) and the current session is saved every 10 seconds, so a power cut or empty battery loses at most about 10 seconds. Settings → Privacy & data lets you export it (CSV or JSON), import a JSON export, set how long history is kept, or delete everything.

> Why not AppData? Windows can silently redirect AppData writes for programs started from inside packaged apps, which can make the same PC see two different databases.

## How time is counted

- The foreground window is checked every second. Consecutive seconds on the same app or site become one span.
- After the **idle timeout** (default 5 min) with no keyboard or mouse input, counting stops. Exception: a browser tab playing audio or video keeps counting.
- When a browser with the extension is in front, time goes to the **website**, not to the browser, so nothing is counted twice. The browser's own pages (new tab, settings) count as the browser.
- Private/incognito windows aren't visible to the extension, so that time is recorded as the browser, without any site names.
- The lock screen, sleep and hibernate stop counting.
- Only domains are stored (e.g. `github.com`), never full URLs or page titles.

## Development

```bash
npm run dev        # agent on :4748 (real tracking) + UI with hot reload on :4747
npm run dev:demo   # same, but with sample data in ./.demo-data and no tracking
npm run demo       # production build with sample data on :4749
npm test           # unit tests for the time calculations
npm run typecheck
```

Project layout:

| Folder | What |
|---|---|
| `apps/agent` | Tracker (Windows APIs via koffi), SQLite storage, local API, reminders |
| `apps/web` | The React web app (design from Figma) |
| `apps/extension` | Browser extension for Chromium-based browsers (Manifest V3) |
| `packages/shared` | Types, time math and aggregation shared by all parts |

## Known limitations

- Windows only (app tracking). Websites: Chromium-based browsers only. Firefox isn't supported yet, and Safari doesn't exist on Windows.
- Vivaldi and Arc don't identify themselves, so they're matched by which browser window is focused. This works fine unless two such browsers are open side by side.
- Programs running as administrator may show as "Unknown app (admin)".
- Microsoft Store apps (Settings, Calculator…) are named from their window title.
