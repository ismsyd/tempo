import { useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { formatMinutes } from "@tempo/shared";
import { EASE_BACK, EASE_IN_OUT, chartViewport } from "../lib/motion";

const W = 556;
const H = 200;
const PAD_X = 10;
const PAD_TOP = 14;
const PAD_BOTTOM = 10;

/** Smooth line + soft area; draws left to right when scrolled into view. */
export function LineChart({ values, labels }: { values: number[]; labels: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, chartViewport);
  const [hover, setHover] = useState<number | null>(null);

  const top = Math.max(10, Math.ceil(Math.max(...values) / 5) * 5);
  const x = (i: number) => PAD_X + (i * (W - PAD_X * 2)) / (values.length - 1);
  const y = (v: number) => PAD_TOP + (1 - v / top) * (H - PAD_TOP - PAD_BOTTOM);

  let d = `M ${x(0)} ${y(values[0])}`;
  for (let i = 1; i < values.length; i++) {
    const xm = (x(i - 1) + x(i)) / 2;
    d += ` C ${xm} ${y(values[i - 1])} ${xm} ${y(values[i])} ${x(i)} ${y(values[i])}`;
  }
  const area = `${d} L ${x(values.length - 1)} ${H} L ${x(0)} ${H} Z`;
  const grid = [0.25, 0.5, 0.75, 1].map((f) => top * f);

  return (
    <div className="line-chart" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Average session length per day" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="lc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--chart-sage)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--chart-sage)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {grid.map((g) => (
          <g key={g}>
            <line x1={0} x2={W} y1={y(g)} y2={y(g)} stroke="var(--border-subtle)" />
            <text x={W} y={y(g) - 5} textAnchor="end" className="line-chart-tick">
              {g}m
            </text>
          </g>
        ))}
        <motion.path
          d={area}
          fill="url(#lc-area)"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.7 }}
        />
        <motion.path
          d={d}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={inView ? { pathLength: 1 } : {}}
          transition={{ duration: 1.2, delay: 0.15, ease: EASE_IN_OUT }}
        />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD_TOP} y2={H} stroke="var(--border-strong)" strokeDasharray="3 3" />}
        {values.map((v, i) => (
          <motion.circle
            key={i}
            cx={x(i)}
            cy={y(v)}
            r={hover === i ? 5.5 : 4}
            fill="var(--bg-surface)"
            stroke="var(--accent)"
            strokeWidth={2}
            initial={{ scale: 0, opacity: 0 }}
            animate={inView ? { scale: 1, opacity: 1 } : {}}
            transition={{ duration: 0.3, delay: 0.15 + i * 0.17, ease: EASE_BACK }}
            style={{ transformOrigin: `${x(i)}px ${y(v)}px`, transition: "r 160ms ease" }}
          />
        ))}
        {values.map((_, i) => (
          <rect
            key={`hit-${i}`}
            x={x(i) - (W - PAD_X * 2) / (values.length - 1) / 2}
            y={0}
            width={(W - PAD_X * 2) / (values.length - 1)}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {hover !== null && (
        <div className="chart-tip t-data-s" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(values[hover]) / H) * 100}%` }}>
          {labels[hover]} · {values[hover] ? `${formatMinutes(values[hover])} avg` : "no sessions"}
        </div>
      )}
      <div className="line-chart-axis t-data-s c-tertiary">
        {labels.map((l, i) => (
          <span key={l} style={{ left: `${(x(i) / W) * 100}%` }}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
