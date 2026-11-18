import { useState } from "react";
import { useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  clock,
  dayLabel,
  formatMinutes,
  formatSeconds,
  pct,
  relativeDayLabel,
  weekRangeLabel,
} from "@tempo/shared";
import { getItem, updateItem } from "../lib/api";
import { useWeekParam } from "../lib/hooks";
import { fadeUp } from "../lib/motion";
import { BackLink, Button, CountUp, Dialog, MonoTile, SettingsButton, Skeleton, StatTile } from "../components/ui";
import { DailyBars } from "../charts/Bars";
import { Donut } from "../charts/Donut";
import { Heatmap } from "../charts/Heatmap";
import { LineChart } from "../charts/LineChart";

const LIMITS: Array<{ v: number | null; label: string }> = [
  { v: null, label: "No limit" },
  { v: 30, label: "30m" },
  { v: 60, label: "1h" },
  { v: 90, label: "1h 30m" },
  { v: 120, label: "2h" },
  { v: 180, label: "3h" },
];

export function ItemDetail() {
  const { id = "" } = useParams();
  const week = useWeekParam();
  const qc = useQueryClient();
  const [limitOpen, setLimitOpen] = useState(false);
  const [moreSessions, setMoreSessions] = useState(false);
  const q = useQuery({ queryKey: ["item", id, week.iso], queryFn: () => getItem(id, week.iso) });
  const setLimit = useMutation({
    mutationFn: (v: number | null) => updateItem(id, { dailyLimitMinutes: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["item", id] }),
  });

  const back = <BackLink to={`/${week.query}`} label={week.isCurrent ? "This week" : "Back to week"} />;

  if (q.isPending) {
    return (
      <div className="page">
        <header className="topbar">
          {back}
          <SettingsButton />
        </header>
        <div style={{ display: "grid", gap: 16, marginTop: 56 }}>
          <Skeleton h={72} w={360} />
          <Skeleton h={118} r={20} />
          <Skeleton h={340} r={20} />
        </div>
      </div>
    );
  }

  const d = q.data;
  if (!d) {
    return (
      <div className="page">
        <header className="topbar">
          {back}
          <SettingsButton />
        </header>
        <div className="card empty" style={{ marginTop: 56 }}>
          <span className="t-display-m">Not found</span>
          <span className="t-body-s c-tertiary">This app or website isn’t in your history any more.</span>
        </div>
      </div>
    );
  }

  const { item } = d;
  const tod = d.timeOfDay;
  const delta = d.dailyAverageDeltaPct;
  const sessions = moreSessions ? d.recentSessions : d.recentSessions.slice(0, 5);
  const last = d.lastUsed ? `last used ${relativeDayLabel(d.lastUsed, Date.now()).toLowerCase()} at ${clock(d.lastUsed)}` : "not used yet";

  return (
    <div className="page">
      <motion.header className="topbar" {...fadeUp(0, -8, 0.5)}>
        {back}
        <span className="t-data-m c-tertiary">{weekRangeLabel(week.weekStart)}</span>
        <SettingsButton />
      </motion.header>

      <motion.section className="identity" {...fadeUp(0.1, 18, 0.65)}>
        <MonoTile name={item.name} color={item.color} size={72} />
        <div className="identity-text">
          <span className="t-eyebrow c-accent">
            {item.kind === "app" ? "App" : "Website"} · {item.category}
          </span>
          <h1 className="t-display-l">{item.name}</h1>
          <span className="t-body-s c-secondary">
            Opened {d.sessionCount} {d.sessionCount === 1 ? "time" : "times"} {week.isCurrent ? "this week" : "that week"} · {last}
          </span>
        </div>
        <Button kind="secondary" onClick={() => setLimitOpen(true)}>
          {item.dailyLimitMinutes ? `Limit: ${formatMinutes(item.dailyLimitMinutes)} a day` : "Set a daily limit"}
        </Button>
      </motion.section>

      <section className="stats-grid">
        {[
          <StatTile key="t" label="Total this week" value={<CountUp value={d.totalMinutes} format={formatMinutes} />} note={`${pct(d.shareOfWeek)} of your screen time`} />,
          <StatTile
            key="a"
            label="Daily average"
            value={<CountUp value={d.dailyAverageMinutes} format={formatMinutes} />}
            note={delta == null ? "No data for last week" : `${Math.round(Math.abs(delta) * 100)}% ${delta < 0 ? "less" : "more"} than last week`}
          />,
          <StatTile
            key="s"
            label="Sessions"
            value={<CountUp value={d.sessionCount} format={(n) => String(Math.round(n))} />}
            note={`About ${d.sessionsPerDay < 1 ? d.sessionsPerDay.toFixed(1) : Math.round(d.sessionsPerDay)} per day`}
          />,
          <StatTile
            key="l"
            label="Average session"
            value={<CountUp value={d.averageSessionSeconds} format={formatSeconds} />}
            note={d.longestSession ? `Longest: ${formatMinutes(d.longestSession.minutes)} on ${dayLabel(d.longestSession.start)}` : "No sessions yet"}
          />,
        ].map((tile, i) => (
          <motion.div key={i} {...fadeUp(0.25 + i * 0.07, 16, 0.55)}>
            {tile}
          </motion.div>
        ))}
      </section>

      <section className="detail-grid">
        <motion.article className="card chart-card span-2" {...fadeUp(0, 20, 0.6)}>
          <CardHead eyebrow="Usage" title="Time spent each day" right={`avg ${formatMinutes(d.dailyAverageMinutes)}`} />
          <DailyBars perDay={d.perDay} labels={d.dayLabels} average={d.dailyAverageMinutes} limit={item.dailyLimitMinutes} />
        </motion.article>

        <motion.article className="card chart-card" {...fadeUp(0.08, 20, 0.6)}>
          <CardHead eyebrow="Distribution" title="When you use it" />
          <Donut
            segments={[
              { key: "morning", label: "Morning", range: "06–12", minutes: tod.morning, color: "var(--chart-sage)" },
              { key: "afternoon", label: "Afternoon", range: "12–18", minutes: tod.afternoon, color: "var(--accent)" },
              { key: "evening", label: "Evening", range: "18–24", minutes: tod.evening, color: "var(--chart-clay)" },
              { key: "night", label: "Night", range: "00–06", minutes: tod.night, color: "var(--chart-sand)" },
            ]}
          />
        </motion.article>

        <motion.article className="card chart-card span-3" {...fadeUp(0, 20, 0.6)}>
          <CardHead eyebrow="Activity" title="Hours it was open" right="Darker = more minutes" />
          <Heatmap data={d.heatmap} labels={d.dayLabels} />
        </motion.article>

        <motion.article className="card chart-card span-2" {...fadeUp(0, 20, 0.6)}>
          <CardHead eyebrow="Focus" title="Average session length" right="per day" />
          <LineChart values={d.averageSessionPerDay} labels={d.dayLabels} />
        </motion.article>

        <motion.article className="card chart-card sessions-card" {...fadeUp(0.08, 20, 0.6)}>
          <CardHead eyebrow="Log" title="Recent sessions" />
          {sessions.length === 0 ? (
            <p className="t-body-s c-tertiary">No sessions this week.</p>
          ) : (
            <ul className="sessions">
              {sessions.map((s, i) => (
                <motion.li
                  key={s.start}
                  className="session-row"
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: Math.min(i, 6) * 0.07 }}
                >
                  <span className="session-when">
                    <span className="t-heading-s">{relativeDayLabel(s.start, Date.now())}</span>
                    <span className="t-data-s c-tertiary">
                      {clock(s.start)} – {clock(s.end)}
                    </span>
                  </span>
                  <span className="t-data-m tabular">{formatMinutes(s.minutes)}</span>
                </motion.li>
              ))}
            </ul>
          )}
          {d.recentSessions.length > 5 && (
            <Button kind="ghost" className="sessions-more" onClick={() => setMoreSessions((v) => !v)}>
              <span className="t-body-s">{moreSessions ? "Show fewer" : `Show ${d.recentSessions.length - 5} more`}</span>
            </Button>
          )}
        </motion.article>
      </section>

      <Dialog open={limitOpen} onClose={() => setLimitOpen(false)} title="Daily limit">
        <p className="t-body-s c-secondary">
          Get a gentle reminder when {item.name} passes this much time in a day. It never blocks anything.
        </p>
        <div className="choice-grid">
          {LIMITS.map((l) => (
            <button
              key={l.label}
              className={`choice t-body-s ${item.dailyLimitMinutes === l.v ? "is-active" : ""}`}
              onClick={() => {
                setLimit.mutate(l.v);
                setLimitOpen(false);
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
      </Dialog>
    </div>
  );
}

function CardHead({ eyebrow, title, right }: { eyebrow: string; title: string; right?: string }) {
  return (
    <div className="chart-head">
      <div className="chart-head-titles">
        <span className="t-eyebrow c-tertiary">{eyebrow}</span>
        <h2 className="t-heading-m">{title}</h2>
      </div>
      {right && <span className="t-data-s c-secondary">{right}</span>}
    </div>
  );
}
