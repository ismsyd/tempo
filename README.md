# Tempo

A private, local screen-time tracker for Windows. It records which apps you use and (with the Chrome extension) which websites you visit, and shows it in a calm web app at **http://127.0.0.1:4747**.

Everything stays on this computer: no accounts, no cloud, no sync.

## First-time setup

You need Node.js 22.18 or newer (this PC has Node 26) and Google Chrome.

```bash
npm install
npm run build
npm start
```

Open http://127.0.0.1:4747. Leave the terminal open while you want tracking. To have Tempo start with Windows instead, run the autostart script (below).

### Connect Chrome (to see websites)

1. Open `chrome://extensions` and switch on **Developer mode** (top right).
2. Click **Load unpacked** and choose the folder `apps\extension`.
3. In Tempo, open **Settings → Tracking → Chrome extension → Connect** and copy the code.
4. Click the Tempo icon in Chrome's toolbar, paste the code and press **Save**. The status turns to *Connected*.

### Start with Windows

```bash
npm run autostart:install
```

This builds the app, starts Tempo in the background (no window) and adds it to your Startup folder. To undo:

```bash
npm run autostart:remove
```

## Where your data lives

`%LOCALAPPDATA%\Tempo\tempo.sqlite`, a single SQLite file. Settings → Privacy & data lets you export it (CSV or JSON), import a JSON export, set how long history is kept, or delete everything.

## How time is counted

- The foreground window is checked every second. Consecutive seconds on the same app or site become one span.
- After the **idle timeout** (default 5 min) with no keyboard or mouse input, counting stops. Exception: a Chrome tab playing audio or video keeps counting.
- When Chrome is in front and the extension is connected, time goes to the **website**, not to Chrome, so nothing is counted twice. Chrome's own pages (new tab, settings) count as "Google Chrome".
- Incognito windows aren't visible to the extension, so incognito time is recorded as "Google Chrome" without any site names.
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
| `apps/extension` | Chrome extension (Manifest V3) |
| `packages/shared` | Types, time math and aggregation shared by all parts |

## Known limitations

- Windows only (app tracking); Chrome only (websites).
- Programs running as administrator may show as "Unknown app (admin)".
- Microsoft Store apps (Settings, Calculator…) are named from their window title.
