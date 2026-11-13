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
    success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    danger: "border-rose-500/20 bg-rose-500/10 text-rose-300",
    muted: "border-white/10 bg-white/5 text-slate-400",
  };
  return (
    <span className={`senti9-detail-badge ${colors[tone]}`}>
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
      className="senti9-operation-card rounded-xl border border-white/10 bg-bg-card p-5 shadow-sm"
    >
      <div className="senti9-operation-card-heading">
        <h3
          id={heading}
          className="flex min-w-0 items-center gap-2.5 font-semibold text-slate-100"
        >
          <span className="senti9-operation-icon" aria-hidden="true">
            {icon}
          </span>
          {title}
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
    <div className="senti9-detail-stat min-w-0 rounded-lg border border-white/5 bg-black/20 p-3">
      <dt className="text-xs uppercase tracking-wider text-slate-400">
        {label}
      </dt>
      <dd
        className={`font-mono ${compact ? "senti9-detail-timestamp" : "text-2xl font-semibold"} ${warning ? "text-amber-300" : "text-slate-100"}`}
      >
        {children}
      </dd>
    </div>
  );
}

export function DetailTimestamp({ value }: { value?: string | null }) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return <>Sin registro</>;
  return (
    <time dateTime={value!} className="inline-flex flex-col">
      <span>{date.toLocaleDateString()}</span>
      <span className="text-slate-400">
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
    <p className="senti9-detail-note text-xs text-slate-400">
      <Info size={14} className="shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
