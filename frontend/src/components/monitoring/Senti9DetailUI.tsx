import { useId, type ReactNode } from "react";
import { Info } from "lucide-react";

export function DetailBadge({
  children,
  tone = "muted",
  pulse = false,
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "danger" | "muted";
  pulse?: boolean;
}) {
  const colors = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    danger: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    muted: "border-white/10 bg-white/5 text-slate-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colors[tone]}`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full bg-current ${pulse ? "motion-safe:animate-pulse" : ""}`}
      />
      {children}
    </span>
  );
}

export function DetailCard({
  title,
  icon,
  badge,
  children,
}: {
  title: string;
  icon: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const heading = useId();
  return (
    <section
      aria-labelledby={heading}
      className="rounded-2xl border border-white/10 bg-bg-card p-5 shadow-sm space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3
          id={heading}
          className="flex min-w-0 items-center gap-2.5 text-sm font-semibold text-text-main"
        >
          <span className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-accent-green" aria-hidden="true">
            {icon}
          </span>
          <span>{title}</span>
        </h3>
        {badge}
      </div>
      {children}
    </section>
  );
}

export function DetailStat({
  label,
  children,
  compact = false,
  warning = false,
}: {
  label: string;
  children: ReactNode;
  compact?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/5 bg-bg-dark/60 p-3.5">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
        {label}
      </dt>
      <dd
        className={`font-mono ${compact ? "text-xs font-medium" : "text-xl font-bold"} ${warning ? "text-amber-400" : "text-text-main"}`}
      >
        {children}
      </dd>
    </div>
  );
}

export function DetailTimestamp({ value }: { value?: string | null }) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return <span className="text-text-muted">Sin registro</span>;
  return (
    <time dateTime={value!} className="inline-flex flex-col">
      <span className="text-text-main font-medium">{date.toLocaleDateString()}</span>
      <span className="text-text-muted text-[11px]">
        {date.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        })}
      </span>
    </time>
  );
}

export function DetailNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-text-muted">
      <Info size={14} className="text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}
