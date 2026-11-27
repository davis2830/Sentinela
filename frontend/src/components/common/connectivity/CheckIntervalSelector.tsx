import { Lock } from "lucide-react";

export interface CommercialCheckIntervalOption {
  value: number;
  shortLabel: string;
  selectLabel: string;
  planLabel: string;
  recommended?: boolean;
}

/**
 * Single source of truth for commercial check intervals across Uptime, API Checks, and Onboarding.
 * Mirrors backend `organizations/plans.py`:
 * - Starter (`free`): 300 s (5 min)
 * - Pro (`pro`): 60 s (1 min)
 * - Business (`business`): 30 s
 */
export const COMMERCIAL_CHECK_INTERVALS: readonly CommercialCheckIntervalOption[] =
  [
    {
      value: 30,
      shortLabel: "30 s",
      selectLabel: "Cada 30 s",
      planLabel: "Business",
    },
    {
      value: 60,
      shortLabel: "1 min",
      selectLabel: "Cada 1 min",
      planLabel: "Pro",
      recommended: true,
    },
    {
      value: 300,
      shortLabel: "5 min",
      selectLabel: "Cada 5 min",
      planLabel: "Starter",
    },
  ] as const;

export function formatCheckInterval(seconds: number): string {
  if (seconds >= 60 && seconds % 60 === 0) {
    return `${seconds / 60} min`;
  }
  return `${seconds} s`;
}

/**
 * Recommended default commercial interval for a new resource given the org's `min_check_interval_seconds`.
 * Uses 1 min (60 s) for Pro/Business/internal plans and 5 min (300 s) for Starter.
 */
export function getDefaultCheckInterval(minAllowedInterval: number): number {
  if (minAllowedInterval <= 60) return 60;
  return minAllowedInterval;
}

interface CheckIntervalSelectorProps {
  value: number;
  minAllowedInterval: number;
  onChange: (seconds: number) => void;
  variant?: "buttons" | "select" | "cards";
  /** Preserve a legacy/custom saved interval in `<select>` when editing an existing record */
  preserveCustomValue?: boolean;
  /** Optional custom order for cards (e.g. Starter -> Pro -> Business in Quick Start) */
  order?: "fastest-first" | "slowest-first";
  id?: string;
}

export default function CheckIntervalSelector({
  value,
  minAllowedInterval,
  onChange,
  variant = "buttons",
  preserveCustomValue = true,
  order = "fastest-first",
  id,
}: CheckIntervalSelectorProps) {
  const options =
    order === "slowest-first"
      ? [...COMMERCIAL_CHECK_INTERVALS].reverse()
      : COMMERCIAL_CHECK_INTERVALS;

  if (variant === "select") {
    const isCustomValue =
      preserveCustomValue &&
      !COMMERCIAL_CHECK_INTERVALS.some((opt) => opt.value === value);

    return (
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono cursor-pointer"
      >
        {options.map((opt) => {
          const locked = opt.value < minAllowedInterval;
          return (
            <option key={opt.value} value={opt.value} disabled={locked}>
              {locked
                ? `${opt.selectLabel} · ${opt.planLabel}`
                : opt.selectLabel}
            </option>
          );
        })}
        {isCustomValue && (
          <option value={value}>Cada {formatCheckInterval(value)}</option>
        )}
      </select>
    );
  }

  if (variant === "cards") {
    return (
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const locked = opt.value < minAllowedInterval;
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={locked}
              onClick={() => !locked && onChange(opt.value)}
              title={locked ? `Requiere plan ${opt.planLabel}` : ""}
              className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-all text-center relative flex flex-col items-center justify-center min-h-[52px] ${
                locked
                  ? "bg-bg-dark border-border-base/50 text-text-muted cursor-not-allowed"
                  : active
                    ? "bg-accent-green/15 border-accent-green text-accent-green shadow-sm cursor-pointer"
                    : "bg-bg-dark border-border-base text-text-muted hover:border-zinc-700 cursor-pointer"
              }`}
            >
              <span className="font-mono text-xs">{opt.shortLabel}</span>
              {!locked && opt.value === Math.max(30, minAllowedInterval) && (
                <span className="mt-0.5 text-[11px]">
                  Recomendado para tu plan
                </span>
              )}
              {locked && (
                <span className="text-[11px] text-amber-400 font-mono mt-0.5 font-bold">
                  Plan {opt.planLabel}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {options.map((opt) => {
        const locked = opt.value < minAllowedInterval;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={locked}
            onClick={() => !locked && onChange(opt.value)}
            title={
              locked
                ? `Disponible desde plan ${opt.planLabel}`
                : opt.recommended
                  ? "Intervalo recomendado"
                  : `Plan ${opt.planLabel}`
            }
            className={`flex-1 py-1.5 px-2 rounded-lg border text-xs font-medium text-center transition-all ${
              active
                ? "bg-accent-green/15 border-accent-green text-accent-green font-semibold shadow-sm"
                : locked
                  ? "bg-bg-dark/40 border-border-base/50 text-text-dim opacity-50 cursor-not-allowed"
                  : "bg-bg-dark/60 border-border-base text-text-muted hover:text-text-main hover:bg-bg-card-hover cursor-pointer"
            }`}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              {locked && <Lock size={11} className="text-amber-400 shrink-0" />}
              <span>{opt.shortLabel}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
