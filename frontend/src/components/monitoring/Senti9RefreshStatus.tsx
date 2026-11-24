import { RefreshCw } from "lucide-react";
import { useClock } from "../../hooks/useClock";
import { formatRefreshCountdown } from "../../hooks/useAutoRefresh";

export default function Senti9RefreshStatus({
  enabled,
  ready,
  blockedReason,
  countdown,
  updatedAt,
  fetching,
  failed,
  onToggle,
  onRefresh,
}: {
  enabled: boolean;
  ready: boolean;
  blockedReason?: string;
  countdown: number;
  updatedAt: number;
  fetching: boolean;
  failed: boolean;
  onToggle: () => void;
  onRefresh: () => void;
}) {
  const now = useClock();
  const minutes = Math.max(0, Math.floor((now - updatedAt) / 60000));
  const age = !updatedAt || minutes < 1
    ? ""
    : minutes < 60
      ? ` · ${minutes}m`
      : ` · ${Math.floor(minutes / 60)}h`;
  const automatic = ready && !blockedReason;
  const label = fetching
    ? "Sincronizando…"
    : failed
      ? "Error de lectura"
      : `${!automatic ? blockedReason || "Pausado" : enabled ? "Auto-sync" : "Pausado"}${age}`;
  const active = automatic && enabled && !failed && !!updatedAt;

  return (
    <div
      className="inline-flex items-center gap-1.5 min-w-0"
      data-testid="senti9-refresh-status"
      aria-busy={fetching}
    >
      <button
        type="button"
        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-text-muted hover:text-text-main hover:bg-white/5 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
        disabled={!automatic}
        aria-label={enabled ? "Pausar auto-refresco" : "Activar auto-refresco"}
        aria-pressed={enabled}
        onClick={onToggle}
        title={`${enabled ? `Sincronización activa. Próxima consulta en ${formatRefreshCountdown(countdown)}.` : "Sincronización pausada."} ${updatedAt ? `Última sincronización: ${new Date(updatedAt).toLocaleTimeString()}.` : ""}`}
      >
        <span
          aria-hidden="true"
          className={`h-2 w-2 shrink-0 rounded-full ${failed ? "bg-amber-400" : active ? "bg-emerald-400 motion-safe:animate-pulse" : "bg-slate-500"}`}
        />
        <span aria-live="polite" className="font-mono text-[11px]">{label}</span>
      </button>
      <button
        type="button"
        className="h-8 w-8 grid place-items-center rounded-lg text-text-muted hover:text-text-main hover:bg-white/5 transition-colors disabled:opacity-50 shrink-0"
        aria-label="Actualizar datos"
        disabled={fetching}
        onClick={onRefresh}
        title="Actualizar datos"
      >
        <RefreshCw
          size={13}
          aria-hidden="true"
          className={fetching ? "motion-safe:animate-spin text-accent-green" : ""}
        />
      </button>
    </div>
  );
}
