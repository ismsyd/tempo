import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import type { Settings as SettingsT } from "@tempo/shared";
import { deleteAllData, exportUrl, getItems, getPairing, importData, resetPairing, updateItem } from "../lib/api";
import { useSaveSettings, useSettings, useStatus } from "../lib/hooks";
import { EASE_OUT, fadeUp } from "../lib/motion";
import { BackLink, Button, Dialog, Logo, MonoTile, SearchField, Select, Toast, Toggle, useToast } from "../components/ui";

const SECTIONS = [
  { id: "tracking", label: "Tracking" },
  { id: "goals", label: "Goals & limits" },
  { id: "appearance", label: "Appearance" },
  { id: "privacy", label: "Privacy & data" },
] as const;

const HOURS = (n: number) => `${n} hour${n === 1 ? "" : "s"}`;
const DAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

export function Settings() {
  const s = useSettings();
  const save = useSaveSettings();
  const qc = useQueryClient();
  const [toast, showToast] = useToast();
  const [active, setActive] = useState<string>("tracking");
  const [excludedOpen, setExcludedOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<SettingsT>) => save.mutate(patch, { onSuccess: () => showToast("Saved") });

  // Deep links like /settings#tracking scroll to that section after the page fades in
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 450);
    return () => window.clearTimeout(t);
  }, []);

  // Scroll-spy: highlight the section currently in view
  useEffect(() => {
    const els = SECTIONS.map((x) => document.getElementById(x.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const status = useStatus();
  const [pairOpen, setPairOpen] = useState(false);
  const extConnected = !!status.data?.extension.connected;
  const connectedNames = (status.data?.extension.browsers ?? [])
    .map((b) => (b === "brave" ? "Brave" : "Chrome"))
    .join(" and ");

  const doExport = (format: "json" | "csv") => {
    const a = document.createElement("a");
    a.href = exportUrl(format);
    a.download = "";
    a.click();
    setExportOpen(false);
    showToast(`Exporting as ${format.toUpperCase()}…`);
  };

  const doImport = async (file: File) => {
    try {
      const n = await importData(file);
      await qc.invalidateQueries();
      showToast(n ? `Imported ${n} records` : "Nothing new to import");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Import failed");
    }
  };

  return (
    <div className="page">
      <motion.header className="topbar" {...fadeUp(0, -8, 0.5)}>
        <BackLink to="/" label="This week" />
        <Logo />
        <span className="topbar-balance" />
      </motion.header>

      <motion.section className="settings-heading" {...fadeUp(0.1, 18, 0.65)}>
        <span className="t-eyebrow c-accent">Preferences</span>
        <h1 className="t-display-xl">Settings</h1>
        <p className="t-body-m c-secondary">Decide what gets tracked, how it’s shown, and what happens to your data.</p>
      </motion.section>

      <div className="settings-body">
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.map((x, i) => (
            <motion.a
              key={x.id}
              href={`#${x.id}`}
              className={`settings-nav-item t-body-s ${active === x.id ? "is-active" : ""}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.06, ease: EASE_OUT }}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(x.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                setActive(x.id);
              }}
            >
              {active === x.id && <motion.span layoutId="nav-active" className="settings-nav-bg" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
              <span className="settings-nav-indicator" />
              <span className="settings-nav-label">{x.label}</span>
            </motion.a>
          ))}
          <p className="t-body-s c-tertiary settings-nav-note">All data stays on this device unless you export it.</p>
        </nav>

        <div className="settings-content">
          <Group id="tracking" title="Tracking" desc="What Tempo measures while you work." delay={0.35}>
            <Row title="Track apps" desc="Measure time spent in desktop applications.">
              <Toggle label="Track apps" checked={s.trackApps} onChange={(v) => set({ trackApps: v })} />
            </Row>
            <Row title="Track websites" desc="Record time on sites in Chrome or Brave (needs the Tempo extension).">
              <Toggle label="Track websites" checked={s.trackWebsites} onChange={(v) => set({ trackWebsites: v })} />
            </Row>
            <Row
              title="Browser extension"
              desc={
                status.isError
                  ? "Tempo's tracker isn't running."
                  : extConnected
                    ? `Connected in ${connectedNames} — websites are being recorded.`
                    : "Not connected. Pair the extension in Chrome or Brave to see which websites you visit."
              }
            >
              <span className={`ext-pill t-data-s ${extConnected ? "is-on" : ""}`}>{extConnected ? "Connected" : "Offline"}</span>
              <Button onClick={() => setPairOpen(true)}>{extConnected ? "Pairing code" : "Connect"}</Button>
            </Row>
            <Row title="Idle timeout" desc="Stop counting after a stretch with no keyboard or mouse activity.">
              <Select
                label="Idle timeout"
                value={s.idleTimeoutMinutes}
                onChange={(v) => set({ idleTimeoutMinutes: v })}
                options={[1, 2, 5, 10, 15].map((m) => ({ value: m, label: `${m} minute${m === 1 ? "" : "s"}` }))}
              />
            </Row>
            <Row title="Ignore private windows" desc="Incognito browsing is never recorded.">
              <Toggle label="Ignore private windows" checked={s.ignorePrivateWindows} onChange={(v) => set({ ignorePrivateWindows: v })} />
            </Row>
            <Row title="Excluded apps & sites" desc="Anything on this list is invisible to Tempo." last>
              <Button onClick={() => setExcludedOpen(true)}>Manage list</Button>
            </Row>
          </Group>

          <Group id="goals" title="Goals & limits" desc="Gentle guardrails, never hard blocks.">
            <Row title="Daily screen-time goal" desc="Shown as a reference on your charts.">
              <Select
                label="Daily goal"
                value={s.dailyGoalMinutes ?? 0}
                onChange={(v) => set({ dailyGoalMinutes: v || null })}
                options={[{ value: 0, label: "No goal" }, ...[2, 3, 4, 5, 6, 7, 8, 10].map((h) => ({ value: h * 60, label: HOURS(h) }))]}
              />
            </Row>
            <Row title="Limit reminders" desc="A quiet Windows notification when an app passes its daily limit.">
              <Toggle label="Limit reminders" checked={s.limitReminders} onChange={(v) => set({ limitReminders: v })} />
            </Row>
            <Row title="Weekly summary" desc="A short recap of your week, delivered once as a notification." last>
              <Select
                label="Weekly summary"
                value={s.weeklySummary ? `${s.weeklySummary.day}-${s.weeklySummary.hour}` : "off"}
                onChange={(v) => {
                  if (v === "off") return set({ weeklySummary: null });
                  const [day, hour] = v.split("-").map(Number);
                  set({ weeklySummary: { day, hour } });
                }}
                options={[
                  { value: "off", label: "Off" },
                  { value: "1-9", label: "Mondays, 09:00" },
                  { value: "0-18", label: "Sundays, 18:00" },
                  { value: "5-17", label: "Fridays, 17:00" },
                ].concat(
                  s.weeklySummary && !["1-9", "0-18", "5-17"].includes(`${s.weeklySummary.day}-${s.weeklySummary.hour}`)
                    ? [{ value: `${s.weeklySummary.day}-${s.weeklySummary.hour}`, label: `${DAYS[s.weeklySummary.day]}, ${String(s.weeklySummary.hour).padStart(2, "0")}:00` }]
                    : [],
                )}
              />
            </Row>
          </Group>

          <Group id="appearance" title="Appearance" desc="Make it feel like yours.">
            <Row title="Week starts on" desc="Changes how weeks are grouped in every view.">
              <Select
                label="Week starts on"
                value={s.weekStartsOn}
                onChange={(v) => set({ weekStartsOn: v })}
                options={[
                  { value: 1 as const, label: "Monday" },
                  { value: 0 as const, label: "Sunday" },
                  { value: 6 as const, label: "Saturday" },
                ]}
              />
            </Row>
            <Row title="Reduce motion" desc="Turn off chart and page animations." last>
              <Toggle label="Reduce motion" checked={s.reduceMotion} onChange={(v) => set({ reduceMotion: v })} />
            </Row>
          </Group>

          <Group id="privacy" title="Privacy & data" desc="Your history, your call.">
            <Row title="Keep data on this device" desc="Nothing is synced or uploaded. Tempo has no accounts and no cloud.">
              <Toggle label="Keep data on this device" checked onChange={() => showToast("Tempo is local-only by design")} />
            </Row>
            <Row title="Keep history for" desc="Older records are cleared automatically.">
              <Select
                label="Keep history for"
                value={s.retentionDays ?? 0}
                onChange={(v) => set({ retentionDays: v || null })}
                options={[
                  { value: 30, label: "30 days" },
                  { value: 90, label: "90 days" },
                  { value: 365, label: "1 year" },
                  { value: 0, label: "Forever" },
                ]}
              />
            </Row>
            <Row title="Export data" desc="Download everything as CSV or JSON.">
              <Button onClick={() => setExportOpen(true)}>Export</Button>
            </Row>
            <Row title="Import data" desc="Bring in history from a previous Tempo JSON export.">
              <Button onClick={() => fileRef.current?.click()}>Import</Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) doImport(f);
                  e.target.value = "";
                }}
              />
            </Row>
            <Row title="Delete all data" desc="Permanently removes your entire history. This can’t be undone." last>
              <Button kind="danger" onClick={() => setDeleteOpen(true)}>
                Delete everything
              </Button>
            </Row>
          </Group>
        </div>
      </div>

      <PairingDialog open={pairOpen} onClose={() => setPairOpen(false)} connected={extConnected} onCopied={() => showToast("Code copied")} />

      <ExcludedDialog open={excludedOpen} onClose={() => setExcludedOpen(false)} onChanged={() => showToast("Saved")} />

      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} title="Export data" width={400}>
        <p className="t-body-s c-secondary">CSV opens in Excel. JSON can be imported back into Tempo later.</p>
        <div className="dialog-actions">
          <Button onClick={() => doExport("csv")}>Download CSV</Button>
          <Button kind="primary" onClick={() => doExport("json")}>
            Download JSON
          </Button>
        </div>
      </Dialog>

      <DeleteDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deleteAllData();
          await qc.invalidateQueries();
          setDeleteOpen(false);
          showToast("All data deleted");
        }}
      />

      <Toast message={toast} />
    </div>
  );
}

function Group({ id, title, desc, children, delay = 0 }: { id: string; title: string; desc: string; children: ReactNode; delay?: number }) {
  return (
    <motion.section id={id} className="card settings-group" {...fadeUp(delay, 22, 0.65)}>
      <div className="settings-group-head">
        <h2 className="t-display-m">{title}</h2>
        <p className="t-body-s c-tertiary">{desc}</p>
      </div>
      {children}
    </motion.section>
  );
}

function Row({ title, desc, children, last }: { title: string; desc: string; children: ReactNode; last?: boolean }) {
  return (
    <div className={`setting-row ${last ? "is-last" : ""}`}>
      <div className="setting-text">
        <span className="t-heading-s">{title}</span>
        <span className="t-body-s c-secondary">{desc}</span>
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

function ExcludedDialog({ open, onClose, onChanged }: { open: boolean; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const items = useQuery({ queryKey: ["items"], queryFn: getItems, enabled: open });
  const toggle = useMutation({
    mutationFn: ({ id, excluded }: { id: string; excluded: boolean }) => updateItem(id, { excluded }),
    onSuccess: () => {
      qc.invalidateQueries();
      onChanged();
    },
  });
  const list = (items.data ?? []).filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Dialog open={open} onClose={onClose} title="Excluded apps & sites" width={480}>
      <p className="t-body-s c-secondary">Switch something off to hide it everywhere and stop recording it.</p>
      <div style={{ margin: "14px 0 6px" }}>
        <SearchField value={q} onChange={setQ} />
      </div>
      <ul className="exclude-list">
        {list.map((i) => (
          <li key={i.id} className="exclude-row">
            <MonoTile name={i.name} color={i.color} size={32} />
            <span className="exclude-name">
              <span className="t-heading-s">{i.name}</span>
              <span className="t-body-s c-tertiary">{i.kind === "app" ? "App" : "Website"}</span>
            </span>
            <Toggle label={`Track ${i.name}`} checked={!i.excluded} onChange={(v) => toggle.mutate({ id: i.id, excluded: !v })} />
          </li>
        ))}
        {list.length === 0 && <li className="t-body-s c-tertiary" style={{ padding: 12 }}>Nothing found.</li>}
      </ul>
    </Dialog>
  );
}

function PairingDialog({ open, onClose, connected, onCopied }: { open: boolean; onClose: () => void; connected: boolean; onCopied: () => void }) {
  const qc = useQueryClient();
  const code = useQuery({ queryKey: ["pairing"], queryFn: getPairing, enabled: open });
  const reset = useMutation({ mutationFn: resetPairing, onSuccess: (d) => qc.setQueryData(["pairing"], d) });
  return (
    <Dialog open={open} onClose={onClose} title="Connect your browser" width={520}>
      <ol className="pair-steps t-body-s c-secondary">
        <li>
          Open <span className="t-data-s c-primary">brave://extensions</span> in Brave or <span className="t-data-s c-primary">chrome://extensions</span> in
          Chrome, and switch on <strong>Developer mode</strong>.
        </li>
        <li>
          Click <strong>Load unpacked</strong> and choose the folder <span className="t-data-s c-primary">tempo\apps\extension</span>.
        </li>
        <li>Click the Tempo icon in the toolbar (pin it from the puzzle-piece menu) and enter this code:</li>
      </ol>
      <div className="pair-code">
        <span className="t-data-l">{code.data?.code ?? "········"}</span>
        <Button
          onClick={() => {
            if (code.data) navigator.clipboard?.writeText(code.data.code).then(onCopied, () => {});
          }}
        >
          Copy
        </Button>
      </div>
      <div className="pair-foot">
        <span className={`ext-pill t-data-s ${connected ? "is-on" : ""}`}>{connected ? "Connected" : "Waiting for the extension…"}</span>
        <Button kind="ghost" onClick={() => reset.mutate()}>
          <span className="t-body-s">New code</span>
        </Button>
      </div>
    </Dialog>
  );
}

function DeleteDialog({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!open) setText("");
  }, [open]);
  return (
    <Dialog open={open} onClose={onClose} title="Delete all data?" width={420}>
      <p className="t-body-s c-secondary">
        This permanently removes every app, website and session Tempo has recorded. It can’t be undone. Type <strong>delete</strong> to confirm.
      </p>
      <input className="text-input t-body-s" value={text} onChange={(e) => setText(e.target.value)} placeholder="delete" aria-label="Type delete to confirm" />
      <div className="dialog-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button kind="danger" disabled={text.trim().toLowerCase() !== "delete"} onClick={onConfirm}>
          Delete everything
        </Button>
      </div>
    </Dialog>
  );
}
