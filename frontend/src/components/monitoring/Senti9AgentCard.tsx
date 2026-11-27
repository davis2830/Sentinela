import { Link } from "react-router-dom";
import { AlertTriangle, Clock } from "lucide-react";
import type { AgentProbe } from "../../types/agent_probe";
import RelativeTime, {
  formatExactTime,
} from "../common/connectivity/RelativeTime";
import { StatusShapeIcon } from "../common/connectivity/StatusPill";
import GuardianRowActions from "./GuardianRowActions";
import {
  GUARDIAN_STATE_META,
  getGuardianDeliverySummary,
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
  onToggle: (probe: AgentProbe) => void;
}

export default function Senti9AgentCard({
  probe,
  density = "comfortable",
  admin,
  canCreateMonitor,
  onSelect,
  onCreateMonitor,
  onToggle,
}: Senti9AgentCardProps) {
  const state = getGuardianHealthState(probe);
  const meta = GUARDIAN_STATE_META[state];
  const isCompact = density === "compact";
  const isRevoked = state === "revoked";
  const isPaused = state === "paused";
  const isMuted = isRevoked || isPaused;
  const isDisconnected = state === "disconnected";
  const isStale = state === "stale_signal";
  const isPending = state === "pending";
  const outdated = isGuardianVersionOutdated(probe);

  const assigned = probe.assigned_targets_count ?? 0;
  const activeAssigned = probe.active_targets_count ?? assigned;
  const downAssigned = probe.down_targets_count ?? 0;
  const queueTotal = getGuardianQueueTotal(probe);

  const identifier = probe.hostname || probe.id.slice(0, 12);
  const ipOrHost = probe.ip_address || identifier;
  const detailTooltip = [
    `Host: ${identifier}`,
    probe.ip_address ? `IP: ${probe.ip_address}` : "",
    probe.version ? `Versión: v${probe.version}` : "",
    !isMuted && !isPending ? `Cola local: ${queueTotal}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  // Homologated card surface (neutral on connected, red on disconnected, amber on stale/pending, slate on paused/revoked)
  const cardSurfaceClass = isMuted
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

  const platform = getGuardianPlatform(probe);
  const deliverySummary = getGuardianDeliverySummary(probe);
  const deliveryToneClass =
    deliverySummary.tone === "danger"
      ? "text-rose-400 font-semibold"
      : deliverySummary.tone === "warning"
        ? "text-amber-400 font-semibold"
        : deliverySummary.tone === "ok"
          ? "text-text-muted"
          : "text-text-dim";

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
      {/* Top Block: Compact 2-line metadata matching Uptime card height (Name + IP/Version) */}
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
                isMuted
                  ? "text-slate-400"
                  : "text-text-main group-hover:text-accent-green transition-colors"
              }`}
              title={`${probe.name} · ${detailTooltip}`}
            >
              {probe.name}
            </h3>
          </div>

          {/* Unified Floating Hover/Focus/Touch Actions + Always-Visible Toggle Switch */}
          <GuardianRowActions
            probe={probe}
            admin={admin}
            canCreateMonitor={canCreateMonitor}
            variant="card"
            onSelect={onSelect}
            onCreateMonitor={onCreateMonitor}
            onToggle={onToggle}
          />
        </div>

        {/* Single Metadata Line: IP · Version (hash & queue live in tooltip and detail drawer) */}
        <div
          className={`${isCompact ? "pl-[24px] text-[11px]" : "pl-[26px] text-xs"} font-mono flex items-center gap-1.5 min-w-0 truncate ${
            isMuted ? "text-slate-500" : "text-text-dim"
          }`}
          title={detailTooltip}
        >
          <span className="truncate">{ipOrHost}</span>
          {probe.version && (
            <>
              <span aria-hidden="true">·</span>
              <span
                className="inline-flex items-center gap-1 shrink-0"
                title={
                  outdated
                    ? `Actualización disponible (v${probe.latest_version || "1.8.0"})`
                    : `Versión v${probe.version}`
                }
              >
                <span>v{probe.version}</span>
                {outdated && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
                    aria-label="Actualización disponible"
                  />
                )}
              </span>
            </>
          )}
        </div>

        {/* Optional Status Alert Line (only on abnormal states so card stays slim like Uptime) */}
        {isDisconnected && (
          <div className={`${isCompact ? "pl-[24px]" : "pl-[26px]"} flex items-center gap-1.5 text-[11px] font-mono text-rose-300 truncate`}>
            <AlertTriangle size={11} className="text-rose-400 shrink-0" />
            <span className="truncate">
              {activeAssigned > 0
                ? `${activeAssigned} ${activeAssigned === 1 ? "monitor afectado" : "monitores afectados"}`
                : probe.last_heartbeat
                  ? `desconectado desde ${formatExactTime(probe.last_heartbeat)}`
                  : "Desconectado"}
            </span>
          </div>
        )}
        {isStale && (
          <div className={`${isCompact ? "pl-[24px]" : "pl-[26px]"} flex items-center gap-1.5 text-[11px] font-mono text-amber-300 truncate`}>
            <AlertTriangle size={11} className="text-amber-400 shrink-0" />
            <span className="truncate">
              Sin señal reciente
              {activeAssigned > 0 ? ` · ${activeAssigned} afectados` : ""}
            </span>
          </div>
        )}
        {isPending && (
          <div className={`${isCompact ? "pl-[24px]" : "pl-[26px]"} flex items-center text-[11px] font-mono truncate`}>
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
          </div>
        )}
      </div>

      {/* Bottom Block: Fixed-height Metric (Monitores) + Clock Heartbeat & Timestamped Slim Bars */}
      <div className={isCompact ? "space-y-2" : "space-y-2.5"}>
        <div
          className={`flex items-center justify-between gap-2 ${
            isCompact ? "h-7" : "h-8"
          }`}
        >
          <div
            className="min-w-0 truncate flex items-center gap-1.5"
            onClick={(e) => {
              if (assigned > 0) e.stopPropagation();
            }}
          >
            {isRevoked ? (
              <span className="font-mono text-xs font-medium text-slate-400 leading-none">
                Revocado
              </span>
            ) : isPaused ? (
              <span className="font-mono text-xs font-medium text-slate-400 leading-none">
                Pausado
                {assigned > 0
                  ? ` · ${assigned} ${assigned === 1 ? "monitor" : "monitores"}`
                  : ""}
              </span>
            ) : assigned > 0 ? (
              <>
                <Link
                  to={`/monitoring?agent=${probe.id}`}
                  onClick={(e) => e.stopPropagation()}
                  title="Ver monitores LAN de este guardián en Uptime"
                  className={`font-mono font-bold leading-none hover:text-accent-green hover:underline transition-colors ${
                    isCompact ? "text-base" : "text-xl"
                  } ${isDisconnected ? "text-rose-400" : "text-text-main"}`}
                >
                  {assigned} {assigned === 1 ? "monitor" : "monitores"}
                </Link>
                {!isDisconnected && downAssigned > 0 && (
                  <span className="text-[11px] font-mono font-semibold text-rose-400 leading-none">
                    · {downAssigned} {downAssigned === 1 ? "caído" : "caídos"}
                  </span>
                )}
              </>
            ) : (
              <span className="font-mono text-sm font-medium text-text-dim leading-none">
                0 monitores
              </span>
            )}
          </div>

          {/* Clock icon next to RelativeTime (never platform >_ icon) */}
          <span className="inline-flex items-center gap-1 text-[11px] font-mono shrink-0">
            <Clock
              size={12}
              className={
                isDisconnected
                  ? "text-rose-400 shrink-0"
                  : isStale || isPending
                    ? "text-amber-400 shrink-0"
                    : "text-text-dim shrink-0"
              }
            />
            {isPending ? (
              <RelativeTime
                value={probe.created_at}
                className="text-amber-300"
              />
            ) : isRevoked ? (
              <RelativeTime
                value={probe.revoked_at}
                emptyLabel="Revocado"
                className="text-slate-500"
              />
            ) : isPaused ? (
              <RelativeTime
                value={probe.last_heartbeat}
                emptyLabel="Pausado"
                className="text-slate-400"
              />
            ) : (
              <RelativeTime
                value={probe.last_heartbeat}
                className={
                  isDisconnected
                    ? "text-rose-400 font-semibold"
                    : isStale
                      ? "text-amber-400 font-semibold"
                      : "text-text-muted"
                }
              />
            )}
          </span>
        </div>

        {/* Honest Footer Metadata: Platform + Real Server Ledger / Queue State */}
        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border-base/50 text-[11px] font-mono">
          <span className="text-text-dim truncate">
            {platform === "windows" ? "Windows" : "Linux"}
          </span>
          <span
            className={`truncate ${deliveryToneClass}`}
            title={deliverySummary.tooltip}
          >
            {deliverySummary.label}
          </span>
        </div>
      </div>
    </div>
  );
}
