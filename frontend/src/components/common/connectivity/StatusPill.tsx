import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  HelpCircle,
  PauseCircle,
  XCircle,
} from "lucide-react";

export type StatusTone = "success" | "warning" | "danger" | "neutral" | "muted";
export type StatusIconShape =
  | "check"
  | "alert"
  | "error"
  | "clock"
  | "pause"
  | "revoked"
  | "unknown";

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  danger: "bg-rose-500/15 text-rose-400 border-rose-500/40",
  neutral: "bg-zinc-800/80 text-slate-300 border-zinc-700",
  muted: "bg-zinc-800/50 text-slate-400 border-zinc-700/70",
};

export function StatusShapeIcon({
  shape,
  size = 13,
  className = "",
  label,
}: {
  shape: StatusIconShape;
  size?: number;
  className?: string;
  label?: string;
}) {
  switch (shape) {
    case "check":
      return (
        <CheckCircle2
          size={size}
          className={`shrink-0 ${className}`}
          aria-label={label}
        />
      );
    case "alert":
      return (
        <AlertTriangle
          size={size}
          className={`shrink-0 ${className}`}
          aria-label={label}
        />
      );
    case "error":
      return (
        <XCircle
          size={size}
          className={`shrink-0 ${className}`}
          aria-label={label}
        />
      );
    case "clock":
      return (
        <Clock
          size={size}
          className={`shrink-0 ${className}`}
          aria-label={label}
        />
      );
    case "pause":
      return (
        <PauseCircle
          size={size}
          className={`shrink-0 ${className}`}
          aria-label={label}
        />
      );
    case "revoked":
      return (
        <Ban
          size={size}
          className={`shrink-0 ${className}`}
          aria-label={label}
        />
      );
    default:
      return (
        <HelpCircle
          size={size}
          className={`shrink-0 ${className}`}
          aria-label={label}
        />
      );
  }
}

export default function StatusPill({
  label,
  tone,
  shape,
  title,
  size = "sm",
}: {
  label: string;
  tone: StatusTone;
  shape: StatusIconShape;
  title?: string;
  size?: "xs" | "sm";
}) {
  return (
    <span
      title={title || label}
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap shrink-0 ${
        size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs"
      } ${TONE_CLASSES[tone]}`}
    >
      <StatusShapeIcon shape={shape} size={size === "xs" ? 11 : 12} />
      <span>{label}</span>
    </span>
  );
}
