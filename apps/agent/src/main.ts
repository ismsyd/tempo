/**
 * Tempo agent — tracks the foreground app, stores it locally and serves the web app.
 *
 *   node apps/agent/src/main.ts            real tracking, port 4747
 *   node apps/agent/src/main.ts --port 4748 (used by `npm run dev`; Vite serves the UI on 4747)
 *   node apps/agent/src/main.ts --demo     sample data in ./.demo-data, no tracking
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { generateDemoData } from "@tempo/shared";
import { Store } from "./db.ts";
import { Tracker } from "./tracker.ts";
import { createApi } from "./api.ts";
import { startJobs } from "./jobs.ts";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../..");
const demo = flag("demo");
const port = Number(opt("port") ?? process.env.TEMPO_PORT ?? 4747);
const dataDir = demo
  ? join(repo, ".demo-data")
  : (process.env.TEMPO_DATA_DIR ?? join(process.env.LOCALAPPDATA ?? join(process.env.HOME ?? ".", ".local", "share"), "Tempo"));

const store = new Store(dataDir);
if (demo && store.items().length === 0) {
  const d = generateDemoData(Date.now());
  store.transaction(() => {
    d.items.forEach((i) => store.insertItem(i));
    d.spans.forEach((s) => store.insertSpan(s.itemId, s.start, s.end));
  });
  console.log(`[demo] seeded ${d.items.length} items and ${d.spans.length} spans`);
}

const tracker = new Tracker(store);
if (!demo) tracker.start();
startJobs(store, tracker);

const app = createApi(store, tracker);

// Serve the built web app (apps/web/dist) with a single-page-app fallback
const dist = join(repo, "apps", "web", "dist");
const relDist = "./" + join("apps", "web", "dist").replace(/\\/g, "/");
if (existsSync(dist)) {
  process.chdir(repo);
  app.use("/assets/*", serveStatic({ root: relDist }));
  app.use("/favicon.svg", serveStatic({ root: relDist }));
  const index = readFileSync(join(dist, "index.html"), "utf8");
  app.get("*", (c) => (c.req.path.startsWith("/api/") ? c.json({ error: "not found" }, 404) : c.html(index)));
} else {
  app.get("/", (c) => c.text("Tempo agent is running. Build the web app with `npm run build`, or use `npm run dev`."));
}

const server = serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, (info) => {
  console.log(`Tempo ${demo ? "(demo) " : ""}running at http://127.0.0.1:${info.port}  ·  data: ${store.path}`);
});
server.on("error", (e: NodeJS.ErrnoException) => {
  if (e.code === "EADDRINUSE") console.error(`Port ${port} is already in use — is Tempo already running?`);
  else console.error(e);
  process.exit(1);
});

const shutdown = () => {
  tracker.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("SIGBREAK", shutdown);
