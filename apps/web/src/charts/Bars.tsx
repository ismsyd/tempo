import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { formatMinutes } from "@tempo/shared";
import { EASE_BACK, EASE_OUT, chartViewport } from "../lib/motion";

/** Small "Per day" chart on the overview hero card. */
export function WeekBars({
  perDay,
  labels,
  daysElapsed,
  goal,
}: {
  perDay: number[];
  labels: string[];
  daysElapsed: number;
  goal?: number | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, chartViewport);
  const max = Math.max(1, ...perDay, goal ?? 0);
  const peak = perDay.indexOf(Math.max(...perDay));
  return (
    <div className="week-bars" ref={ref} role="img" aria-label="Screen time per day">
      {goal ? (
        <motion.div
          className="ref-line is-goal"
          style={{ bottom: 24 + (goal / max) * 92, left: 0, right: 0 }}
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.7 }}
          title={`Daily goal: ${formatMinutes(goal)}`}
        >
          <span className="ref-line-label t-data-s">goal</span>
        </motion.div>
      ) : null}
      {perDay.map((m, i) => {
        const future = i >= daysElapsed;
        const h = future ? 4 : Math.max(4, (m / max) * 92);
        return (
          <div className="week-bars-col" key={i} title={future ? labels[i] : `${labels[i]} · ${formatMinutes(m)}`}>
            <div className="week-bars-slot">
              <motion.div
                className={`week-bars-bar ${i === peak && m > 0 ? "is-peak" : ""} ${future ? "is-future" : ""}`}
                style={{ height: h }}
                initial={{ scaleY: 0 }}
                animate={inView ? { scaleY: 1 } : {}}
                transition={{ duration: 0.6, delay: 0.1 + i * 0.06, ease: EASE_BACK }}
              />
            </div>
            <span className="t-data-s c-tertiary">{labels[i].charAt(0)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** "Time spent each day" chart on the detail page. */
export function DailyBars({
  perDay,
  labels,
  average,
  limit,
}: {
  perDay: number[];
  labels: string[];
  average: number;
  limit: number | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, chartViewport);
  const max = Math.max(1, ...perDay, limit ?? 0);
  const peak = perDay.indexOf(Math.max(...perDay));
  const BAR_MAX = 180;
  const y = (m: number) => 24 + (m / max) * BAR_MAX; // bottom offset in px (day label row = 24)
  return (
    <div className="daily-bars" ref={ref} role="img" aria-label="Time spent each day">
      {average > 0 && (
        <motion.div
          className="ref-line is-avg"
          style={{ bottom: y(average) }}
          initial={{ opacity: 0, scaleX: 0.6 }}
          animate={inView ? { opacity: 1, scaleX: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.9, ease: EASE_OUT }}
        >
          <span className="ref-line-label t-data-s">avg</span>
        </motion.div>
      )}
      {limit != null && (
        <motion.div
          className="ref-line is-limit"
          style={{ bottom: y(limit) }}
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 1 }}
        >
          <span className="ref-line-label t-data-s">limit</span>
        </motion.div>
      )}
      {perDay.map((m, i) => (
        <div className="daily-bars-col" key={i}>
          <motion.span
            className={`t-data-s ${i === peak && m > 0 ? "c-primary" : "c-tertiary"}`}
            initial={{ opacity: 0, y: 6 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.35, delay: 0.55 + i * 0.07, ease: EASE_OUT }}
          >
            {m > 0 ? formatMinutes(m) : "–"}
          </motion.span>
          <motion.div
            className={`daily-bars-bar ${i === peak && m > 0 ? "is-peak" : ""}`}
            style={{ height: Math.max(3, (m / max) * BAR_MAX) }}
            initial={{ scaleY: 0 }}
            animate={inView ? { scaleY: 1 } : {}}
            transition={{ duration: 0.7, delay: 0.1 + i * 0.07, ease: EASE_BACK }}
          />
          <span className="t-data-s c-tertiary">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}
