# Tempo — Implementation Plan

Status: **draft, waiting for your approval**. Nothing gets built until you approve.
Design source: the Figma file "Screen Time Tracker — Web App" (light theme, 3 screens, motion, prototype links).
Hover states and the dark theme aren't in Figma yet. They're handled in Phase 7 below.

---

## 💰 Costs at a glance (read this first)

| Item | Cost | Needed? |
|---|---|---|
| Everything needed to build and run Tempo on your own PC (Node.js, libraries, fonts, icons, browser extension loaded locally) | **FREE** | Yes |
| Hosting / servers / database | **FREE**. Tempo runs entirely on your computer, with no cloud. | — |
| Figma | **FREE** for this build. I already know every color, size and font in the file because I built it, so I won't need more Figma tool calls. | — |
| ⚠️ **Figma paid plan** (Professional or higher) | **PAID, monthly per editor.** See figma.com/pricing. | **Only** if you want me to finish hover states and dark mode *in Figma* before your free allowance resets. Not needed to build the app. |
| ⚠️ **Chrome Web Store developer account** | **PAID: one-time US$5 registration fee** | **Only** if you want to publish the extension publicly. For personal use you load it yourself for free ("Load unpacked"). |
| ⚠️ **Code-signing certificate** for a Windows installer | **PAID: usually about US$100–400 per year** from a certificate authority | **Only** if you share an installer with other people (it stops Windows' "unknown publisher" warning). Not needed for your own PC. |
| ⚠️ **Cloud sync across devices** (not in this plan) | Would add **PAID** hosting/database costs past free tiers | Out of scope. Tempo stays local and private. |

**Bottom line: the full app as planned costs $0.** The ⚠️ items are optional extras for later.

---

## 1. How the tracking works (key architecture decision)

A normal website **cannot** see which desktop apps you use or which sites you visit in other tabs, because browsers block that for privacy. So Tempo has three small parts that work together, all on your PC:

```
┌──────────────────────────┐      ┌───────────────────────────────┐
│ Tempo Agent (Node.js)    │      │ Tempo Browser Extension       │
│ • watches which window   │◄─────│ (Chrome, Manifest V3)         │
│   is in front (every 1s) │ HTTP │ • reports the active tab's     │
│ • detects idle time      │ 127. │   website + whether it plays   │
│ • stores everything in   │ 0.0.1│   audio                        │
│   a local SQLite file    │      └───────────────────────────────┘
│ • serves the web app +   │
│   a private local API    │◄──── Tempo Web App (React), opened at
└──────────────────────────┘      http://localhost:4747 in your browser
```

- **Agent**: a background program that starts with Windows. It records which app is in the foreground and stops counting when you're idle.
- **Extension**: tells the agent which website you're on, which a desktop program can't reliably see.
- **Web app**: the interface from the Figma file. It reads data from the agent.
- **Privacy**: the agent only accepts connections from your own computer (127.0.0.1) and the extension authenticates with a secret pairing token. Nothing is sent to the internet.

**Alternative I considered:** ActivityWatch, a free, open-source tracker, used as the data backend instead of writing our own agent and extension. It's less work for tracking, but adds an outside dependency, its data model doesn't match the design as well, and you'd have to run its own installer. **I recommend building our own lightweight agent** (described above). If you'd rather use ActivityWatch, say so before approving.

---

## 2. Tech stack (all free and open source)

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** everywhere | One language for the agent, extension and UI; fewer bugs |
| Runtime | **Node.js 26** (✅ already installed) | Runs the agent |
| Package manager | **npm workspaces** (✅ already installed) | No extra install needed |
| UI framework | **React 19 + Vite** | Fast, modern and smooth |
| Routing | **React Router** | `/`, `/item/:id`, `/settings` |
| Data loading | **TanStack Query** | Caching and background refresh without flicker |
| Styling | **Plain CSS with design tokens (CSS variables)** taken from the Figma variables | Matches the design exactly, and dark mode later is just a second set of variables |
| Animation | **Motion** (formerly Framer Motion) | Scroll-triggered chart animations, staggered fade-ups, page transitions and the spring on the toggles |
| Charts | **Custom SVG components** (no chart library) | Pixel-match the Figma bars, donut, heatmap and line chart, and animate them exactly as designed |
| Fonts | **Instrument Serif**, **Geist**, **Geist Mono** via `@fontsource` packages | Free (SIL Open Font License), bundled locally so no Google requests |
| Icons | **Lucide** (chevrons, gear, search) | Free (ISC license), same line style as the Figma icons |
| Database | **SQLite via Node's built-in `node:sqlite`** | No native compiling, a single file on disk |
| Windows window and idle detection | **koffi** (lets JavaScript call Windows' own functions) calling `GetForegroundWindow`, `GetWindowThreadProcessId`, `QueryFullProcessImageNameW`, `GetLastInputInfo` | No C++ build tools needed |
| API server | **Hono** on Node | Small and fast; also serves the built web app |
| Windows notifications | **node-notifier** | Limit reminders and the weekly summary as Windows notifications |
| Extension | **Chrome Manifest V3** (TypeScript, built with Vite) | Works in Chrome (✅ installed); Edge can load the same extension |
| Tests | **Vitest** (logic) + **Playwright** (UI end-to-end) | Catches regressions in calculations and screens |

**Prerequisites check on your PC:** Node 26 ✅, npm ✅, Git ✅, VS Code ✅, Chrome ✅. Edge isn't installed, which is fine. Nothing else to install manually; the project's packages download automatically with `npm install` (free).

---

## 3. Project structure

```
C:\Users\sayed\Claude_Projects\tempo\
├─ package.json              (npm workspaces root + shared scripts)
├─ packages/
│  └─ shared/                types, category rules, time/format helpers used by all parts
├─ apps/
│  ├─ agent/                 tracker + database + API server
│  │  ├─ src/tracker/        foreground-window + idle polling (Windows)
│  │  ├─ src/db/             schema, migrations, queries
│  │  ├─ src/api/            HTTP routes
│  │  ├─ src/jobs/           retention cleanup, reminders, weekly summary
│  │  └─ src/server.ts
│  ├─ web/                   the React web app (the Figma screens)
│  │  ├─ src/styles/tokens.css
│  │  ├─ src/components/     StatTile, UsageRow, Toggle, Select, Button, IconButton, SettingRow…
│  │  ├─ src/charts/         WeekBars, DailyBars, Donut, Heatmap, LineChart
│  │  └─ src/pages/          Overview, ItemDetail, Settings
│  └─ extension/             Chrome MV3 extension (background service worker + popup for pairing)
├─ scripts/
│  ├─ seed-demo-data.ts      fills the DB with the exact sample week from Figma
│  └─ install-autostart.ps1  adds Tempo to Windows startup
└─ README.md                 how to run, pair the extension, uninstall
```

The project will be a Git repository with commits per phase. Nothing is pushed anywhere unless you ask.

---

## 4. Data model (SQLite)

- **`items`**: one row per app or website
  `id, kind ('app'|'web'), key (exe path or domain), display_name, category, color_token, excluded (bool), daily_limit_minutes, first_seen`
- **`spans`**: continuous stretches of activity
  `id, item_id, start_ts, end_ts, source ('window'|'extension'), title (optional, off by default for privacy)`
  New activity extends the open span while it continues ("heartbeat merging").
- **`settings`**: key/value pairs for every option on the Settings screen
- **`meta`**: schema version, pairing token, install date

**Built-in category rules** (editable later): e.g. `figma.exe → Design`, `code.exe → Development`, `github.com → Development`, `youtube.com → Entertainment`. Anything unknown → "Other".

**Display names:** the app's file description from Windows (e.g. "Visual Studio Code") for apps, and the domain (e.g. `github.com`) for websites.

**Icons:** the monogram tiles from the design (first letter on a soft colored tile), with colors assigned consistently from the muted chart palette. No brand logos, which also avoids trademark issues.

---

## 5. Tracking rules (the details that make numbers correct)

1. **Sampling**: the agent checks the foreground window **every 1 second** and merges consecutive samples into spans.
2. **Idle**: if there's no keyboard or mouse input for the **Idle timeout** setting (default 5 min), the span ends at the last input time. **Exception:** if the extension reports the active tab is playing audio or video (e.g. YouTube), it keeps counting.
3. **Browser vs websites (no double counting)**: time in Chrome is broken down into websites from the extension. The weekly total counts each second once. In the list, websites replace the browser entry, and any leftover browser time (e.g. settings pages, new tab) shows as "Chrome (other)".
4. **Private windows**: the extension ignores incognito tabs (and Chrome doesn't run extensions in incognito by default). This is controlled by "Ignore private windows".
5. **Track apps / Track websites toggles**: pause each source immediately.
6. **Excluded apps & sites**: never stored, and existing data for them is hidden.
7. **Lock screen / sleep**: tracking stops when Windows is locked or asleep, and spans are closed cleanly.
8. **Midnight and hour boundaries**: spans are split at day and hour edges, so daily bars and the heatmap are exact.
9. **Time zone and DST**: everything is stored in UTC and grouped in your local time zone.
10. **Week start**: defaults to Monday and is changeable in Settings.
11. **Crash safety**: the open span is saved every 15 s, so a crash loses at most 15 s.
12. **Sessions** (for "Sessions" and "Average session"): spans of the same item with gaps under 2 minutes count as one session.

---

## 6. API (agent ↔ web app), local only

| Method | Path | Used by |
|---|---|---|
| GET | `/api/status` | Header badge: agent OK? extension connected? |
| GET | `/api/week?start=YYYY-MM-DD&filter=all|apps|web&q=&sort=time|name` | Overview: total, delta vs last week, per-day totals, 4 stat tiles, item list with share bars |
| GET | `/api/items/:id?week=YYYY-MM-DD` | Detail: total, daily avg, sessions, avg/longest session, daily bars, time-of-day split, 7×24 heatmap, avg session per day, recent sessions |
| GET / PUT | `/api/settings` | Settings page |
| PUT | `/api/items/:id` | Set daily limit, exclude/include, rename, change category |
| GET | `/api/export?format=csv|json` | Export data |
| POST | `/api/import` | Import data (validates the file, skips duplicates) |
| DELETE | `/api/data` | Delete all data (requires typing "delete" to confirm in the UI) |
| POST | `/api/ext/heartbeat` | Extension → agent (requires the pairing token) |

Exact metric definitions (so every number on screen is unambiguous):
- **Daily average** = week total ÷ number of days elapsed in that week (7 for past weeks).
- **Delta vs last week** = this week vs the same days of last week, so a partial week stays fair.
- **Share bar** in each row = item time ÷ the top item's time (as in the design).
- **Time of day** = Morning 06–12, Afternoon 12–18, Evening 18–24, Night 00–06.
- **Heatmap cell** = minutes the item was in use in that hour (0–60), shown in 5 shade levels as in Figma.

---

## 7. Screens: what gets built (from Figma)

### 7.1 Weekly Overview (`/`)
- Top bar: **tempo** logo, week switcher (‹ Nov 10 – 16, 2026 ›; "next" disabled for the current week), Settings gear button → `/settings`.
- Hero: "THIS WEEK" label, **"38h 12m _on screen._"** (serif with an italic grey ending), one-sentence summary generated from the data (e.g. "About two hours less than last week…").
- "Per day" mini bar chart with the busiest day highlighted in green and the average in the corner.
- 4 stat tiles: Daily average, Apps used, Websites, Longest session.
- "Everything you opened": All / Apps / Websites filter with counts, search, sort menu (Most time / Name / Recently used).
- Usage list: monogram tile, name, "App · Category", share bar, time in mono font, chevron. **The whole row is clickable** → detail page. Shows the top 10, with "Show all N →" expanding the list.

### 7.2 Item Detail (`/item/:id`)
- Back pill "‹ This week", week label, gear.
- Identity: large monogram tile, "APP · DESIGN" label, name in large serif, "Opened 46 times this week · last used today at 16:40", **"Set a daily limit"** button (opens a small dialog with presets).
- 4 stat tiles: Total this week (+ % of screen time), Daily average (+ vs last week), Sessions (+ per day), Average session (+ longest).
- **Bar chart** "Time spent each day": value labels, busiest day in green, dashed average line, plus the daily limit line if one is set.
- **Donut** "When you use it": 4 time-of-day segments, center % for the top segment, legend with ranges and times.
- **Heatmap** "Hours it was open": 7 days × 24 hours, 5 shades, hour axis 00/06/12/18/23, tooltip on hover ("Wed 10:00 – 45 min").
- **Line chart** "Average session length": smooth curve with soft area fill and points, tooltip on hover.
- **Recent sessions**: last 5, with "Show more".

### 7.3 Settings (`/settings`)
- Back pill, logo, "PREFERENCES" + **Settings** + subtitle.
- Left menu (Tracking / Goals & limits / Appearance / Privacy & data) that scrolls to each section and highlights the current one while you scroll.
- **Tracking**: Track apps, Track websites, Idle timeout (1/2/5/10/15 min), Ignore private windows, Excluded apps & sites (dialog listing everything seen, searchable, with checkboxes).
- **Goals & limits**: Daily screen-time goal (off / 2–10 h), Limit reminders, Weekly summary (off / day + time).
- **Appearance**: Week starts on, Reduce motion. (Theme option removed; dark mode postponed.)
- **Privacy & data**: Keep data on this device (always on in this version, shown for clarity), Keep history for (30 / 90 / 365 days / forever), Export (CSV or JSON), Import, Delete all data (red outline button → confirm dialog).
- Every change saves instantly, with a quiet "Saved" message. No save button.

### 7.4 States that aren't in Figma (I'll design them in the same style)
- **First run / onboarding**: three short steps. 1) The agent is running ✅, 2) install the extension, 3) pair it with a code shown in the extension popup.
- **Empty week** ("Nothing tracked yet this week"), **loading skeletons** (soft shimmering placeholder blocks), **agent offline** banner, **extension not connected** hint in Settings.
- **Hover and focus states**: subtle background on rows (light beige), slight row nudge, darker chevron, button background shift. These follow the plan approved for Figma, built directly in code. Visible keyboard focus rings for accessibility.

---

## 8. Motion and smoothness (from the Figma animation spec)

- **Scroll-triggered**: every card and chart animates **when it scrolls into view**, not just on page load. (Figma could only fake this; the code does it properly.)
  - Page entrance: top bar → headline → cards fade up in sequence (0.5–0.7 s, ease-out, 60–120 ms stagger).
  - Bars grow up from the bottom with a slight overshoot; value labels fade in after.
  - Donut segments draw in one after another around the ring; center label scales in.
  - Heatmap fills in hour by hour, like a wave.
  - Line chart draws left to right; points pop in; the area fill fades in.
  - List rows cascade in; share bars fill from the left.
- **Page transitions**: a soft crossfade and slide between Overview ↔ Detail ↔ Settings.
- **Micro-interactions**: toggle knob spring, hover transitions (~200 ms), switching filters slides the white pill.
- **Numbers**: large values count up when they first appear.
- **Smoothness rules**: animate only `transform` and `opacity` (bars use `scaleY`, not height), so the browser stays at 60 fps. Each animation runs once per page visit. Avoid layout shifts by reserving space before the data arrives.
- **Reduce motion**: the setting **and** Windows' "show animations" preference both turn animations into instant fades.

---

## 9. Build phases (each ends with something you can see)

| Phase | What | Done when |
|---|---|---|
| **1. Foundation** | Repo, workspaces, TypeScript, lint/format, design tokens (colors, type, spacing, radii, shadow) as CSS variables, fonts, base components (StatTile, UsageRow, Toggle, Select, Button, IconButton, SettingRow, Segmented, BackLink) | A component gallery page matches the Figma Components page |
| **2. Screens with demo data** | All three pages + custom charts using the exact sample week from Figma; routing and transitions | Side-by-side with Figma screenshots, layouts match |
| **3. Motion** | Every animation from section 8, plus hover/focus states and reduced motion | Smooth at 60 fps in Chrome's performance panel |
| **4. Agent** | Window and idle tracking, SQLite, span merging, all rules in section 5, API, demo-data seed script | Using the PC for 10 minutes shows correct data via the API |
| **5. Extension** | MV3 extension: active tab domain, audio detection, incognito skip, pairing popup, offline buffering | Browsing shows websites in the list with no double counting |
| **6. Wire-up and Settings** | Web app reads live data; every setting works; export/import/delete; retention job; reminders and weekly summary notifications; autostart script; onboarding | Every control on the Settings page does what it says |
| **7. Polish** | Accessibility pass (contrast, keyboard, screen-reader labels), empty/error states. *(Dark theme postponed.)* | Keyboard-only use works; all states look right |
| **8. Testing and docs** | Vitest for aggregation math (midnight splits, DST, idle, overlaps), Playwright for page flows, README with run, pair, uninstall | All tests pass; fresh setup from the README works |

I'll pause and show you after **Phase 2** (looks) and **Phase 6** (fully working) so you can redirect early.

---

## 10. How you'll run it (when done)

1. `npm install` (once): downloads packages, free.
2. `npm run dev`: starts the agent + web app; open http://localhost:4747.
3. Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → `apps/extension/dist` → click the Tempo icon → enter the pairing code.
4. Optional: `npm run autostart:install` so Tempo starts with Windows (and `autostart:remove` to undo).

---

## 11. Known limitations (honest list)

- **Windows only** for app tracking in this version (macOS/Linux would need a different watcher).
- **Chrome (and Edge) only** for websites. Firefox needs a small port later (free).
- **One device**: data isn't synced between computers (by design, for privacy).
- **Elevated (admin) app windows**: Windows may hide their process name from a normal program. Those show as "Unknown app" unless the agent runs as admin, which I don't recommend.
- **Website titles/URLs**: only the **domain** is stored, never full URLs or page titles, unless you later choose otherwise.

---

## 12. Approved decisions (2026-11-18)

1. **Own tracker** (no ActivityWatch).
2. **Project location**: `C:\Users\sayed\Claude_Projects\tempo`.
3. **Chrome only** for now.
4. **Port 4747**.
5. **No dark mode for now.** Light theme only; the Theme option is left out of Settings. Colors stay as CSS variables, so dark can be added later.
6. **Personal use only**: no accounts, no sync, everything saved locally.
