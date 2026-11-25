import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Laptop,
  Plus,
  Terminal,
} from "lucide-react";
import type { AgentProbe } from "../../types/agent_probe";
import RelativeTime, {
  formatExactTime,
} from "../common/connectivity/RelativeTime";
import { StatusShapeIcon } from "../common/connectivity/StatusPill";
import {
  GUARDIAN_QUEUE_WARN_THRESHOLD,
  GUARDIAN_STATE_META,
  getGuardianHealthState,
  getGuardianPlatform,
  getGuardianQueueTotal,
  isGuardianVersionOutdated,
  type GuardianDensity,
} from "./useGuardians";
import type { GuardianActionSection } from "./Senti9TableView";

interface Senti9AgentCardProps {
  probe: AgentProbe;
  density?: GuardianDensity;
  admin: boolean;
  canCreateMonitor: boolean;
  onSelect: (probe: AgentProbe, section?: GuardianActionSection) => void;
  onCreateMonitor: (probeId: string) => void;
}

export default function Senti9AgentCard({
  probe,
  density = "comfortable",
  admin,
  canCreateMonitor,
  onSelect,
  onCreateMonitor,
}: Senti9AgentCardProps) {
  const state = getGuardianHealthState(probe);
  const meta = GUARDIAN_STATE_META[state];
  const platform = getGuardianPlatform(probe);
  const isCompact = density === "compact";
  const isRevoked = state === "revoked";
  const isDisconnected = state === "disconnected";
  const isStale = state === "stale_signal";
  const isPending = state === "pending";
  const outdated = isGuardianVersionOutdated(probe);

  const assigned = probe.assigned_targets_count ?? 0;
  const activeAssigned = probe.active_targets_count ?? assigned;
  const downAssigned = probe.down_targets_count ?? 0;
  const queueTotal = getGuardianQueueTotal(probe);
  const queueWarn = queueTotal >= GUARDIAN_QUEUE_WARN_THRESHOLD;

  const identifier = probe.hostname || probe.id.slice(0, 12);
  const hostLine = probe.ip_address
    ? `${identifier} · ${probe.ip_address}`
    : identifier;

  // Homologated surface & borders (neutral on connected, red on disconnected, amber on stale/pending, slate on revoked)
  const cardSurfaceClass = isRevoked
    ? "bg-bg-card/60 border-border-base/60 hover:bg-bg-card/85 hover:border-border-base"
    : isDisconnected
      ? "bg-[#1c1217] border-rose-500/45 hover:bg-[#25161e] hover:border-rose-400/70"
      : isStale || isPending
        ? "bg-bg-card border-amber-500/40 hover:border-amber-400/70"
        : "bg-bg-card border-border-base/80 hover:border-text-dim/60";

  const iconColorClass =
    meta.tone === "success"
      ? "text-emerald-400"
      : meta.tone === "danger"
        ? "text-rose-400"
        : meta.tone === "warning"
          ? "text-amber-400"
          : "text-slate-400";

  // 16 slim heartbeat status bars (homologated with TargetCard)
  const slotCount = isCompact ? 14 : 16;
  const bars = Array.from({ length: slotCount }).map((_, idx) => {
    if (isRevoked) {
      return { cls: "bg-slate-600/75", title: "Guardián revocado" };
    }
    if (isPending) {
      return {
        cls: "bg-slate-900/50 border border-slate-700/75",
        title: "Esperando primera señal",
      };
    }
    if (isDisconnected) {
      return idx >= slotCount - 5
        ? { cls: "bg-rose-500", title: "Sin latidos (desconectado)" }
        : {
            cls: "bg-slate-900/50 border border-slate-700/75",
            title: "Sin desglose histórico",
          };
    }
    if (isStale) {
      return idx >= slotCount - 2
        ? { cls: "bg-amber-400", title: "Sin señal reciente" }
        : { cls: "bg-emerald-500/80", title: "Latido recibido" };
    }
    return { cls: "bg-emerald-500", title: "Latido activo" };
  });

  return (
    <div
      data-testid="senti9-card"
      role="button"
      tabIndex={0}
      aria-label={`Ver detalle de ${probe.name}`}
      onClick={() => onSelect(probe, "operation")}
      onKeyDown={(e) => {
        if (
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          onSelect(probe, "operation");
        }
      }}
      className={`group relative flex h-full flex-col justify-between rounded-2xl border cursor-pointer transition-all duration-150 ${
        isCompact ? "p-3.5 gap-3" : "p-4 gap-3.5"
      } ${cardSurfaceClass}`}
    >
      {/* Top Block: Status Icon + Name + Non-shifting Floating Hover Actions, Host/IP & Contextual Line */}
      <div className="space-y-1">
        <div className="relative flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <StatusShapeIcon
              shape={meta.shape}
              size={isCompact ? 16 : 18}
              className={iconColorClass}
              label={meta.label}
            />
            <h3
              className={`font-semibold truncate leading-tight min-w-0 ${
                isCompact ? "text-[13px]" : "text-sm"
              } ${
                isDisconnected
                  ? "text-rose-300 font-bold"
                  : isRevoked
                    ? "text-slate-400"
                    : "text-text-main group-hover:text-accent-green transition-colors"
              }`}
              title={`${probe.name} · ${hostLine}`}
            >
              {probe.name}
            </h3>
          </div>

          {/* Floating Hover Actions (never push name) */}
          {!isRevoked && (
            <div
              className="flex items-center gap-0.5 rounded-lg border border-border-base/80 bg-bg-dark/95 backdrop-blur-sm px-0.5 py-0.5 shadow-lg absolute right-0 top-1/2 -translate-y-1/2 z-20 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto [@media(hover:none)]:static [@media(hover:none)]:translate-y-0 [@media(hover:none)]:border-0 [@media(hover:none)]:bg-transparent [@media(hover:none)]:p-0 [@media(hover:none)]:shadow-none [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto transition-opacity duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {canCreateMonitor && (
                <button
                  type="button"
                  onClick={() => onCreateMonitor(probe.id)}
                  title="Agregar monitor LAN"
                  aria-label={`Agregar monitor LAN en ${probe.name}`}
                  className="grid h-6 w-6 place-items-center rounded-md text-text-dim hover:text-accent-green hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
                >
                  <Plus size={13} />
                </button>
              )}
              {admin && (
                <button
                  type="button"
                  onClick={() => onSelect(probe, "install")}
                  title="Instrucciones Docker"
                  aria-label={`Instrucciones Docker de ${probe.name}`}
                  className="grid h-6 w-6 place-items-center rounded-md text-text-dim hover:text-sky-400 hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
                >
                  <Terminal size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={() => onSelect(probe, "operation")}
                title="Abrir detalle"
                aria-label={`Abrir detalle de ${probe.name}`}
                className="grid h-6 w-6 place-items-center rounded-md text-text-dim hover:text-text-main hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
              >
                <Activity size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Line 2: Hostname · IP aligned under Name */}
        <p
          className={`${isCompact ? "pl-[24px] text-[11px]" : "pl-[26px] text-xs"} font-mono truncate ${
            isRevoked ? "text-slate-500" : "text-text-dim"
          }`}
          title={hostLine}
        >
          {hostLine}
        </p>

        {/* Line 3 (Fixed single-line slot): Impact / Pending / Version + Queue */}
        <div
          className={`${isCompact ? "pl-[24px]" : "pl-[26px]"} min-h-[18px] flex items-center gap-1.5 text-[11px] font-mono truncate`}
        >
          {isDisconnected ? (
            <span className="inline-flex items-center gap-1.5 text-rose-300 truncate">
              <AlertTriangle size={11} className="text-rose-400 shrink-0" />
              <span className="truncate">
                {activeAssigned > 0
                  ? `${activeAssigned} ${activeAssigned === 1 ? "monitor afectado" : "monitores afectados"}`
                  : probe.last_heartbeat
                    ? `desconectado desde ${formatExactTime(probe.last_heartbeat)}`
                    : "Desconectado"}
              </span>
            </span>
          ) : isStale ? (
            <span className="inline-flex items-center gap-1.5 text-amber-300 truncate">
              <AlertTriangle size={11} className="text-amber-400 shrink-0" />
              <span className="truncate">
                Sin señal reciente
                {activeAssigned > 0 ? ` · ${activeAssigned} afectados` : ""}
              </span>
            </span>
          ) : isPending ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(probe, "install");
              }}
              className="text-amber-300 hover:underline truncate cursor-pointer !min-h-0"
            >
              Esperando señal · ver instalación
            </button>
          ) : isRevoked ? (
            <span className="text-slate-500 truncate">
              Revocado
              {probe.revocation_reason ? ` · ${probe.revocation_reason}` : ""}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-text-dim truncate">
              {probe.version && (
                <span
                  className="inline-flex items-center gap-1"
                  title={
                    outdated
                      ? `Actualización disponible (v${probe.latest_version || "1.8.0"})`
                      : `v${probe.version}`
                  }
                >
                  <span>v{probe.version}</span>
                  {outdated && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  )}
                </span>
              )}
              {probe.version && <span aria-hidden="true">·</span>}
              <span
                className={queueWarn ? "text-amber-400 font-semibold" : ""}
                title="Mediciones pendientes de enviar a Sentinel"
              >
                Cola {queueTotal}
              </span>
              {downAssigned > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-rose-400 font-semibold">
                    {downAssigned} {downAssigned === 1 ? "caído" : "caídos"}
                  </span>
                </>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Bottom Block: Fixed-height Primary Metric (Monitores) + Platform/Heartbeat & Slim Bars */}
      <div className={isCompact ? "space-y-2" : "space-y-2.5"}>
        <div
          className={`flex items-center justify-between gap-2 ${
            isCompact ? "h-7" : "h-8"
          }`}
        >
          <div
            className="min-w-0 truncate flex items-center"
            onClick={(e) => {
              if (assigned > 0) e.stopPropagation();
            }}
          >
            {isRevoked ? (
              <span className="font-mono text-xs font-medium text-slate-400 leading-none">
                Revocado
              </span>
            ) : assigned > 0 ? (
              <Link
                to={`/monitoring?agent=${probe.id}`}
                title="Ver monitores LAN de este guardián en Uptime"
                className={`font-mono font-bold leading-none hover:underline ${
                  isCompact ? "text-base" : "text-xl"
                } ${isDisconnected ? "text-rose-400" : "text-text-main"}`}
              >
                {assigned} {assigned === 1 ? "monitor" : "monitores"}
              </Link>
            ) : (
              <span className="font-mono text-sm font-medium text-text-dim leading-none">
                0 monitores
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 text-xs">
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-text-muted">
              {platform === "windows" ? (
                <Laptop size={12} className="text-sky-400 shrink-0" />
              ) : (
                <Terminal size={12} className="text-emerald-400 shrink-0" />
              )}
              {isPending ? (
                <RelativeTime
                  value={probe.created_at}
                  className="text-amber-300"
                />
              ) : (
                <RelativeTime
                  value={probe.last_heartbeat}
                  className={
                    isDisconnected
                      ? "text-rose-400"
                      : isStale
                        ? "text-amber-400"
                        : "text-text-muted"
                  }
                />
              )}
            </span>
          </div>
        </div>

        {/* Slim Heartbeat Bars */}
        <div className={`flex items-center gap-[3px] w-full ${isCompact ? "h-1.5" : "h-2"}`}>
          {bars.map((b, idx) => (
            <div
              key={idx}
              title={b.title}
              className={`flex-1 h-full rounded-[2px] ${b.cls}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
