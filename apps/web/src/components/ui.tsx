import { useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from "react";
import { Link } from "react-router";
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from "motion/react";
import { ChevronDown, ChevronLeft, Search, Settings as Gear, X } from "lucide-react";
import type { ChartColor } from "@tempo/shared";
import { EASE_OUT, spring } from "../lib/motion";

/* ---------- Brand ---------- */
export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Tempo home">
      <span className="logo-mark" />
      <span className="logo-word">tempo</span>
    </Link>
  );
}

/* ---------- Navigation buttons ---------- */
export function SettingsButton() {
  return (
    <Link to="/settings" className="icon-btn" aria-label="Settings" title="Settings">
      <Gear size={18} strokeWidth={1.5} className="icon-btn-gear" />
    </Link>
  );
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="pill-link">
      <ChevronLeft size={16} strokeWidth={1.6} />
      <span className="t-body-s">{label}</span>
    </Link>
  );
}

/* ---------- Button ---------- */
type ButtonKind = "primary" | "secondary" | "danger" | "ghost";
export function Button({
  kind = "secondary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: ButtonKind }) {
  return <button className={`btn btn-${kind} t-heading-s ${className}`} {...rest} />;
}

/* ---------- Toggle (switch) ---------- */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? "is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <motion.span className="toggle-knob" layout transition={spring} />
    </button>
  );
}

/* ---------- Select (native, styled) ---------- */
export function Select<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <label className="select">
      <span className="sr-only">{label}</span>
      <select
        className="t-body-s"
        value={String(value)}
        onChange={(e) => {
          const opt = options.find((o) => String(o.value) === e.target.value);
          if (opt) onChange(opt.value);
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={16} strokeWidth={1.6} className="select-chevron" />
    </label>
  );
}

/* ---------- Segmented filter with sliding pill ---------- */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  id,
}: {
  value: T;
  options: Array<{ value: T; label: string; count?: number }>;
  onChange: (v: T) => void;
  id: string;
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            className={`segmented-item t-body-s ${active ? "is-active" : ""}`}
            onClick={() => onChange(o.value)}
          >
            {active && <motion.span layoutId={`seg-${id}`} className="segmented-pill" transition={spring} />}
            <span className="segmented-label">
              {o.label}
              {o.count !== undefined && <span className="segmented-count">{o.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Search ---------- */
export function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="search">
      <Search size={16} strokeWidth={1.6} />
      <span className="sr-only">Search</span>
      <input className="t-body-s" placeholder="Search" value={value} onChange={(e) => onChange(e.target.value)} />
      <AnimatePresence>
        {value && (
          <motion.button
            type="button"
            aria-label="Clear search"
            className="search-clear"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            onClick={() => onChange("")}
          >
            <X size={14} strokeWidth={1.8} />
          </motion.button>
        )}
      </AnimatePresence>
    </label>
  );
}

/* ---------- Count-up number (animates when scrolled into view) ---------- */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) return setShown(value);
    const c = animate(0, value, { duration: 0.9, ease: EASE_OUT, onUpdate: setShown });
    return () => c.stop();
  }, [inView, value, reduce]);
  return (
    <span ref={ref} className="tabular">
      {format(shown)}
    </span>
  );
}

/* ---------- Stat tile ---------- */
export function StatTile({ label, value, note }: { label: string; value: ReactNode; note: string }) {
  return (
    <div className="stat card">
      <span className="t-eyebrow c-tertiary">{label}</span>
      <span className="t-data-l">{value}</span>
      <span className="t-body-s c-secondary">{note}</span>
    </div>
  );
}

/* ---------- Monogram tile ---------- */
export function MonoTile({ name, color, size = 40 }: { name: string; color: ChartColor; size?: number }) {
  return (
    <span
      className={`mono-tile ${size > 48 ? "is-large" : ""}`}
      style={{ width: size, height: size, ["--tile" as string]: `var(--chart-${color})` }}
      aria-hidden
    >
      {name.replace(/^www\./, "").charAt(0).toUpperCase()}
    </span>
  );
}

/* ---------- Dialog ---------- */
export function Dialog({
  open,
  onClose,
  title,
  children,
  width = 440,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="dialog-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="dialog card"
            style={{ width }}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
          >
            <div className="dialog-head">
              <h2 className="t-display-m">{title}</h2>
              <button className="dialog-close" aria-label="Close" onClick={onClose}>
                <X size={18} strokeWidth={1.6} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Toast ---------- */
export function Toast({ message }: { message: string | null }) {
  return (
    <div className="toast-region" aria-live="polite">
      <AnimatePresence>
        {message && (
          <motion.div
            key={message}
            className="toast t-body-s"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function useToast(): [string | null, (m: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<number | undefined>(undefined);
  const show = (m: string) => {
    window.clearTimeout(t.current);
    setMsg(m);
    t.current = window.setTimeout(() => setMsg(null), 2200);
  };
  return [msg, show];
}

/* ---------- Skeleton ---------- */
export function Skeleton({ h, w = "100%", r = 12 }: { h: number; w?: number | string; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;
}
