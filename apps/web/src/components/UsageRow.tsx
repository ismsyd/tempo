import { Link } from "react-router";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { formatMinutes, type WeekItemRow } from "@tempo/shared";
import { MonoTile } from "./ui";
import { EASE_IN_OUT, EASE_OUT } from "../lib/motion";

export function UsageRow({ row, index, to }: { row: WeekItemRow; index: number; to: string }) {
  const delay = Math.min(index, 12) * 0.05;
  return (
    <motion.li
      className="usage-row-wrap"
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -20px 0px" }}
      transition={{ duration: 0.45, delay, ease: EASE_OUT }}
    >
      <Link to={to} className="usage-row">
        <span className="usage-row-inner">
          <MonoTile name={row.name} color={row.color} />
          <span className="usage-info">
            <span className="t-heading-s usage-name">{row.name}</span>
            <span className="t-body-s c-tertiary">
              {row.kind === "app" ? "App" : "Website"} · {row.category}
            </span>
          </span>
        </span>
        <span className="usage-bar" aria-hidden>
          <motion.span
            className="usage-bar-fill"
            style={{ background: `var(--chart-${row.color})`, width: `${Math.max(3, row.share * 100)}%` }}
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: delay + 0.15, ease: EASE_IN_OUT }}
          />
        </span>
        <span className="t-data-m usage-time tabular">{formatMinutes(row.minutes)}</span>
        <ChevronRight size={18} strokeWidth={1.6} className="usage-chevron" />
      </Link>
    </motion.li>
  );
}
