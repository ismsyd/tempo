import { useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { formatMinutes } from "@tempo/shared";
import { EASE_OUT, chartViewport } from "../lib/motion";

/** 5 shade levels, as in the Figma heatmap. */
function level(min: number): number {
  if (min < 1) return 0;
  if (min < 8) return 0.22;
  if (min < 20) return 0.45;
  if (min < 40) return 0.7;
  return 1;
}

const pad = (h: number) => String(h).padStart(2, "0");

/** 7 × 24 grid that ripples in hour by hour when scrolled into view. */
export function Heatmap({ data, labels }: { data: number[][]; labels: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, chartViewport);
  const [tip, setTip] = useState<{ d: number; h: number; x: number; y: number } | null>(null);

  return (
    <div className="heatmap" ref={ref} onMouseLeave={() => setTip(null)}>
      {data.map((row, d) => (
        <div className="heatmap-row" key={d}>
          <span className="t-data-s c-tertiary heatmap-day">{labels[d]}</span>
          {row.map((m, h) => {
            const lv = level(m);
            return (
              <motion.span
                key={h}
                className={`heatmap-cell ${lv ? "is-on" : ""}`}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={inView ? { opacity: lv || 1, scale: 1 } : {}}
                transition={{ duration: 0.35, delay: 0.1 + h * 0.03 + d * 0.02, ease: EASE_OUT }}
                onMouseEnter={(e) => {
                  const host = ref.current!.getBoundingClientRect();
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setTip({ d, h, x: r.left - host.left + r.width / 2, y: r.top - host.top });
                }}
              />
            );
          })}
        </div>
      ))}
      <div className="heatmap-axis t-data-s c-tertiary">
        {["00", "06", "12", "18", "23"].map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <AnimatePresence>
        {tip && (
          <motion.div
            className="chart-tip t-data-s"
            style={{ left: tip.x, top: tip.y }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            {labels[tip.d]} {pad(tip.h)}:00 · {data[tip.d][tip.h] >= 1 ? formatMinutes(data[tip.d][tip.h]) : "not used"}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
