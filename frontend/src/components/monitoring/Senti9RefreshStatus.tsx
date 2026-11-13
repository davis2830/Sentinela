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
  const age = !updatedAt
    ? "sin consulta"
    : minutes < 1
      ? "hace menos de 1 min"
      : minutes < 60
        ? `hace ${minutes} min`
        : `hace ${Math.floor(minutes / 60)} h`;
  const automatic = ready && !blockedReason;
  const label = fetching
    ? "Consultando datos…"
    : failed
      ? `Error de consulta · ${age}`
      : `${!automatic ? blockedReason || "Auto no disponible" : enabled ? "Auto" : "Pausado"} · ${age}`;
  const active = automatic && enabled && !failed && !!updatedAt;
  return (
    <div
      className="senti9-refresh-status"
      data-testid="senti9-refresh-status"
      aria-busy={fetching}
    >
      <button
        type="button"
        className="senti9-live-indicator"
        disabled={!automatic}
        aria-label={enabled ? "Pausar auto-refresco" : "Activar auto-refresco"}
        aria-pressed={enabled}
        onClick={onToggle}
        title={`${enabled ? `Consulta automática. Próxima lectura en ${formatRefreshCountdown(countdown)}.` : "Consulta automática pausada o no disponible."} ${updatedAt ? `Última lectura: ${new Date(updatedAt).toLocaleString()}.` : "Aún no hay una lectura confirmada."} Consulta resultados guardados; no ejecuta monitores.`}
      >
        <span
          aria-hidden="true"
          className={`h-2 w-2 shrink-0 rounded-full ${failed ? "bg-amber-400" : active ? "bg-emerald-400 motion-safe:animate-pulse" : "bg-slate-500"}`}
        />
        <span aria-live="polite">{label}</span>
      </button>
      <button
        type="button"
        className="senti9-header-icon"
        aria-label="Actualizar datos"
        disabled={fetching}
        onClick={onRefresh}
        title="Actualizar resultados guardados, sin ejecutar monitores"
      >
        <RefreshCw
          size={17}
          aria-hidden="true"
          className={fetching ? "motion-safe:animate-spin" : ""}
        />
      </button>
    </div>
  );
}
