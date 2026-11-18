import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  clock,
  dayLabel,
  formatMinutes,
  formatTotal,
  weekRangeLabel,
  type WeekFilter,
  type WeekSort,
} from "@tempo/shared";
import { getWeek } from "../lib/api";
import { useSettings, useWeekParam } from "../lib/hooks";
import { fadeUp, EASE_OUT } from "../lib/motion";
import { CountUp, Logo, Button, SearchField, Segmented, Select, SettingsButton, Skeleton, StatTile } from "../components/ui";
import { UsageRow } from "../components/UsageRow";
import { WeekBars } from "../charts/Bars";

const LIST_LIMIT = 10;

export function Overview() {
  const week = useWeekParam();
  const settings = useSettings();
  const [filter, setFilter] = useState<WeekFilter>("all");
  const [sort, setSort] = useState<WeekSort>("time");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  // Header numbers ignore filter/search so they stay stable while you filter the list
  const summary = useQuery({
    queryKey: ["week", week.iso],
    queryFn: () => getWeek({ weekStart: week.iso, filter: "all", sort: "time", query: "" }),
  });
  const list = useQuery({
    queryKey: ["week", week.iso, filter, sort, query],
    queryFn: () => getWeek({ weekStart: week.iso, filter, sort, query }),
    placeholderData: keepPreviousData,
  });

  const s = summary.data;
  const rows = list.data?.items ?? [];
  const visibleRows = showAll ? rows : rows.slice(0, LIST_LIMIT);

  const delta = s?.dailyAverageDeltaPct;
  const deltaNote =
    delta == null ? "No data for last week" : Math.abs(delta) < 0.02 ? "Same as last week" : `${Math.round(Math.abs(delta) * 100)}% ${delta < 0 ? "less" : "more"} than last week`;

  return (
    <div className="page">
      <motion.header className="topbar" {...fadeUp(0, -8, 0.5)}>
        <Logo />
        <div className="week-switch">
          <button onClick={week.prev} aria-label="Previous week">
            <ChevronLeft size={16} strokeWidth={1.6} />
          </button>
          <span className="t-data-m week-switch-label">{weekRangeLabel(week.weekStart)}</span>
          <button onClick={week.next} disabled={week.isCurrent} aria-label="Next week">
            <ChevronRight size={16} strokeWidth={1.6} />
          </button>
        </div>
        <SettingsButton />
      </motion.header>

      <AnimatePresence mode="wait">
        <motion.div
          key={week.iso}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <section className="hero">
            <motion.div className="hero-text" {...fadeUp(0.12, 18, 0.7)}>
              <span className="t-eyebrow c-accent">{week.isCurrent ? "This week" : `Week of ${weekRangeLabel(week.weekStart).split(" –")[0]}`}</span>
              {s ? (
                <h1 className="t-display-xl">
                  <CountUp value={s.totalMinutes} format={formatTotal} /> <em className="hero-em">on screen.</em>
                </h1>
              ) : (
                <Skeleton h={64} w={420} />
              )}
              <p className="t-body-m c-secondary hero-summary">{s?.summary ?? " "}</p>
            </motion.div>
            <motion.div className="card hero-chart" {...fadeUp(0.25, 18, 0.7)}>
              <div className="card-head-row">
                <span className="t-eyebrow c-tertiary">Per day</span>
                <span className="t-data-s c-secondary">avg {s ? formatMinutes(s.dailyAverageMinutes) : "–"}</span>
              </div>
              {s ? <WeekBars perDay={s.perDay} labels={s.dayLabels} daysElapsed={s.daysElapsed} goal={settings.dailyGoalMinutes} /> : <Skeleton h={116} />}
            </motion.div>
          </section>

          <section className="stats-grid">
            {s
              ? [
                  <StatTile key="avg" label="Daily average" value={<CountUp value={s.dailyAverageMinutes} format={formatMinutes} />} note={deltaNote} />,
                  <StatTile
                    key="apps"
                    label="Apps used"
                    value={<CountUp value={s.appsUsed} format={(n) => String(Math.round(n))} />}
                    note={s.newApps ? `${s.newApps} new this week` : "None new this week"}
                  />,
                  <StatTile
                    key="web"
                    label="Websites"
                    value={<CountUp value={s.websites} format={(n) => String(Math.round(n))} />}
                    note={s.topWebsite ? `${s.topWebsite} most visited` : "None visited yet"}
                  />,
                  <StatTile
                    key="long"
                    label="Longest session"
                    value={<CountUp value={s.longestSession?.minutes ?? 0} format={formatMinutes} />}
                    note={s.longestSession ? `${s.longestSession.itemName} · ${dayLabel(s.longestSession.start)} ${clock(s.longestSession.start)}` : "No sessions yet"}
                  />,
                ].map((tile, i) => (
                  <motion.div key={i} {...fadeUp(0.35 + i * 0.08, 16, 0.55)}>
                    {tile}
                  </motion.div>
                ))
              : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} h={118} r={20} />)}
          </section>

          <motion.section className="list-head" {...fadeUp(0.1, 12, 0.5)}>
            <h2 className="t-display-m">Everything you opened</h2>
            <div className="list-controls">
              <Segmented
                id="kind"
                value={filter}
                onChange={(v) => {
                  setFilter(v);
                  setShowAll(false);
                }}
                options={[
                  { value: "all", label: "All", count: s?.counts.all },
                  { value: "apps", label: "Apps", count: s?.counts.apps },
                  { value: "web", label: "Websites", count: s?.counts.web },
                ]}
              />
              <SearchField value={query} onChange={setQuery} />
              <Select
                label="Sort by"
                value={sort}
                onChange={setSort}
                options={[
                  { value: "time", label: "Most time" },
                  { value: "recent", label: "Recently used" },
                  { value: "name", label: "Name" },
                ]}
              />
            </div>
          </motion.section>

          <motion.section className="card list-card" {...fadeUp(0.15, 20, 0.6)}>
            {list.isPending ? (
              <div style={{ padding: 20, display: "grid", gap: 12 }}>
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} h={44} />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="empty">
                <span className="t-display-m">{query ? "No matches" : "Nothing tracked yet"}</span>
                <span className="t-body-s c-tertiary">
                  {query ? `Nothing called “${query}” this week.` : "Use your computer for a bit — apps and sites will appear here."}
                </span>
              </div>
            ) : (
              <>
                <ul className="usage-list" key={`${filter}-${sort}-${query}`}>
                  {visibleRows.map((r, i) => (
                    <UsageRow key={r.id} row={r} index={i} to={`/item/${r.id}${week.query}`} />
                  ))}
                </ul>
                {rows.length > LIST_LIMIT && (
                  <motion.div className="show-all" layout transition={{ duration: 0.3, ease: EASE_OUT }}>
                    <Button kind="ghost" onClick={() => setShowAll((v) => !v)}>
                      <span className="t-body-s">{showAll ? "Show less ↑" : `Show all ${rows.length} →`}</span>
                    </Button>
                  </motion.div>
                )}
              </>
            )}
          </motion.section>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
