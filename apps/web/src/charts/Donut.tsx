import { useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { formatMinutes } from "@tempo/shared";
import { EASE_OUT, chartViewport } from "../lib/motion";

export interface DonutSegment {
  key: string;
  label: string;
  range: string;
  minutes: number;
  color: string; // css color / var
}

const SIZE = 184;
const C = SIZE / 2;
const R = 78;
const STROKE = 16;
const GAP_DEG = 3;

function arc(a0: number, a1: number) {
  const rad = (a: number) => ((a - 90) * Math.PI) / 180;
  const x0 = C + R * Math.cos(rad(a0));
  const y0 = C + R * Math.sin(rad(a0));
  const x1 = C + R * Math.cos(rad(a1));
  const y1 = C + R * Math.sin(rad(a1));
  return `M ${x0} ${y0} A ${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

/** Donut that draws itself segment by segment when scrolled into view. */
export function Donut({ segments }: { segments: DonutSegment[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, chartViewport);
  const [hover, setHover] = useState<string | null>(null);
  const total = segments.reduce((t, s) => t + s.minutes, 0);
  const visible = segments.filter((s) => s.minutes > 0);
  const gap = visible.length > 1 ? GAP_DEG : 0;

  let angle = 0;
  let delay = 0.15;
  const arcs = visible.map((s) => {
    const sweep = (s.minutes / total) * 360;
    const a0 = angle + gap / 2;
    const a1 = Math.max(a0 + 0.5, angle + sweep - gap / 2);
    angle += sweep;
    const dur = 0.2 + 0.9 * (s.minutes / total);
    const res = { s, d: sweep >= 359.9 ? null : arc(a0, a1), delay, dur };
    delay += dur;
    return res;
  });

  const top = visible.reduce<DonutSegment | null>((a, b) => (!a || b.minutes > a.minutes ? b : a), null);
  const focus = visible.find((s) => s.key === hover) ?? top;

  return (
    <div className="donut" ref={ref}>
      <div className="donut-figure" role="img" aria-label="Time of day distribution">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle cx={C} cy={C} r={R} fill="none" stroke="var(--chart-track)" strokeWidth={STROKE} />
          {arcs.map(({ s, d, delay, dur }) =>
            d ? (
              <motion.path
                key={s.key}
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={hover === s.key ? STROKE + 4 : STROKE}
                initial={{ pathLength: 0 }}
                animate={inView ? { pathLength: 1 } : {}}
                transition={{ pathLength: { duration: dur, delay, ease: "linear" } }}
                style={{ transition: "stroke-width 180ms ease", cursor: "default" }}
                onMouseEnter={() => setHover(s.key)}
                onMouseLeave={() => setHover(null)}
              />
            ) : (
              <motion.circle
                key={s.key}
                cx={C}
                cy={C}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={STROKE}
                initial={{ pathLength: 0 }}
                animate={inView ? { pathLength: 1 } : {}}
                transition={{ duration: 1, delay: 0.15 }}
                style={{ rotate: -90, transformOrigin: "50% 50%" }}
              />
            ),
          )}
        </svg>
        <motion.div
          className="donut-center"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.9, ease: EASE_OUT }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={focus?.key ?? "none"}
              className="donut-center-inner"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
            >
              <span className="t-display-m">{focus && total ? `${Math.round((focus.minutes / total) * 100)}%` : "—"}</span>
              <span className="t-body-s c-tertiary">{focus?.label ?? "No data"}</span>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
      <ul className="legend">
        {segments.map((s, i) => (
          <motion.li
            key={s.key}
            className={`legend-row ${hover === s.key ? "is-hover" : ""}`}
            onMouseEnter={() => s.minutes > 0 && setHover(s.key)}
            onMouseLeave={() => setHover(null)}
            initial={{ opacity: 0, y: 8 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.5 + i * 0.07, ease: EASE_OUT }}
          >
            <span className="legend-dot" style={{ background: s.color }} />
            <span className="t-body-s legend-label">{s.label}</span>
            <span className="t-data-s c-tertiary">{s.range}</span>
            <span className="t-data-s c-secondary legend-value">{formatMinutes(s.minutes)}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
