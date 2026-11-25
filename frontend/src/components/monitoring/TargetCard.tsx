import { TargetEnabledSwitch } from "./TargetTableControls";
import {
  formatPausedSince,
  formatShortDiagnostic,
  getDownSinceText,
  latestTargetCheck,
} from "./TargetLatency";
import {
  TARGET_TYPE_COLORS,
  TARGET_TYPE_ICONS,
  getTargetHistorySlots,
  getTargetStatusKind,
  getTargetUptimePct,
  type TargetDensity,
} from "./useTargets";
import {
  finite,
  formatMetric,
  latencyTone,
} from "../../utils/endpointPresentation";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Globe,
  HelpCircle,
  PauseCircle,
  Pencil,
  Server,
  Trash2,
  XCircle,
} from "lucide-react";
import type { MonitoringTarget } from "../../types/monitoring";

interface TargetCardProps {
  target: MonitoringTarget;
  density?: TargetDensity;
  onEdit: (target: MonitoringTarget) => void;
  onDelete: (target: MonitoringTarget) => void;
  onScan?: (target: MonitoringTarget) => void;
  onToggle: (target: MonitoringTarget) => void;
  onAlert?: (target: MonitoringTarget) => void;
  isScanning?: boolean;
  onClick: (target: MonitoringTarget) => void;
  isSelected?: boolean;
  hasAnySelection?: boolean;
  onSelectToggle?: (target: MonitoringTarget) => void;
}

export default function TargetCard({
  target,
  density = "comfortable",
  onEdit,
  onDelete,
  onToggle,
  onAlert,
  onClick,
  isSelected = false,
  hasAnySelection = false,
  onSelectToggle,
}: TargetCardProps) {
  const statusKind = getTargetStatusKind(target);
  const isPaused = statusKind === "paused";
  const isDown = statusKind === "down";
  const isSlow = statusKind === "slow";
  const isUp = statusKind === "up";
  const isCompact = density === "compact";

  const ProtocolIcon = TARGET_TYPE_ICONS[target.target_type] || Globe;
  const typeStyle = TARGET_TYPE_COLORS[target.target_type] || {
    bg: "bg-accent-green/10",
    text: "text-accent-green",
    border: "border-accent-green/30",
  };

  // Diagnostics & Timing
  const latestCheck =
    latestTargetCheck(target) ||
    (target.recent_checks?.length
      ? target.recent_checks[target.recent_checks.length - 1]
      : null);
  const fullDiagnostic =
    latestCheck?.diagnostic ||
    (isSlow ? "Respuesta lenta registrada" : "Comprobación fallida");
  const shortDiagnostic = formatShortDiagnostic(
    fullDiagnostic,
    target.expected_status,
  );
  const downSinceText = isDown ? getDownSinceText(target) : "";
  const pausedSinceFull = isPaused ? formatPausedSince(target, false) : "";
  const pausedSinceShort = isPaused ? formatPausedSince(target, true) : "";

  // Latency & Uptime
  const measured = Boolean(
    target.last_checked_at && Number.isFinite(Date.parse(target.last_checked_at)),
  );
  const lastLatencyNum =
    !isPaused &&
    !isDown &&
    measured &&
    finite(target.last_latency) &&
    target.last_latency >= 0
      ? target.last_latency
      : null;
  const latencyValue =
    lastLatencyNum !== null ? `${formatMetric(lastLatencyNum)} ms` : "—";
  const latTone =
    lastLatencyNum !== null
      ? latencyTone(lastLatencyNum, target.max_latency_ms, target.last_status)
      : "muted";

  const lastUpCheck = isDown
    ? [...(target.recent_checks || [])]
        .reverse()
        .find((c) => c.status === "up" && finite(c.latency))
    : null;
  const lastKnownLat = lastUpCheck?.latency
    ? `${formatMetric(lastUpCheck.latency)} ms`
    : null;

  const uptimePct = getTargetUptimePct(target);
  const uptimeDisplay =
    uptimePct != null
      ? `${uptimePct === 100 ? "100" : uptimePct.toFixed(1)} %`
      : null;

  // 16 slim bars in status-wall mode (12 in compact) — strictly gray when paused
  const historySlots = getTargetHistorySlots(target, isCompact ? 12 : 16);

  // Neutral border on Online! Only Down (red) and Slow (amber) have colored borders; Paused is dimmed.
  const cardSurfaceClass = isSelected
    ? "border-accent-green bg-accent-green/5 ring-2 ring-accent-green/30"
    : isPaused
      ? "bg-bg-card/80 border-border-base/60 opacity-55 hover:opacity-80 hover:border-border-base"
      : isDown
        ? "bg-[#1c1217] border-rose-500/45 hover:bg-[#25161e] hover:border-rose-400/70"
        : isSlow
          ? "bg-bg-card border-amber-500/40 hover:border-amber-400/70"
          : "bg-bg-card border-border-base/80 hover:border-text-dim/60";

  // Floating checkbox in top-left corner so left-alignment of Status + Name + URL never shifts
  const checkboxVisibilityClass =
    isSelected || hasAnySelection
      ? "opacity-100 scale-100"
      : "opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100";

  const renderStatusIcon = (size: number) => {
    if (isPaused) {
      return (
        <PauseCircle
          size={size}
          className="text-zinc-400 shrink-0"
          aria-label="Pausado"
        />
      );
    }
    if (isDown) {
      return (
        <XCircle
          size={size}
          className="text-rose-400 shrink-0"
          aria-label="Caído"
        />
      );
    }
    if (isSlow) {
      return (
        <AlertTriangle
          size={size}
          className="text-amber-400 shrink-0"
          aria-label="Lento"
        />
      );
    }
    if (isUp) {
      return (
        <CheckCircle2
          size={size}
          className="text-emerald-400 shrink-0"
          aria-label="Online"
        />
      );
    }
    return (
      <HelpCircle
        size={size}
        className="text-zinc-500 shrink-0"
        aria-label="Desconocido"
      />
    );
  };

  const renderHistoryBars = (heightClass: string) => (
    <div
      className={`flex items-center gap-[3px] w-full ${heightClass}`}
      aria-label={`Historial reciente de ${target.name}`}
    >
      {historySlots.map((slot, idx) => {
        let bg = "bg-bg-card-hover/65";
        let tooltip = "Sin medición aún";

        if (slot.status === "paused") {
          bg = "bg-zinc-700/45";
          tooltip = "Monitoreo pausado";
        } else if (slot.status !== "no_data") {
          if (slot.status === "up") bg = "bg-emerald-500 hover:bg-emerald-400";
          else if (slot.status === "slow") bg = "bg-amber-400 hover:bg-amber-300";
          else if (slot.status === "down") bg = "bg-rose-500 hover:bg-rose-400";

          const timeStr = slot.checked_at
            ? new Date(slot.checked_at).toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : "Sin hora";
          const statusName =
            slot.status === "up"
              ? "Online"
              : slot.status === "slow"
                ? "Lento"
                : "Caído";
          const latStr =
            typeof slot.latency === "number" && slot.latency >= 0
              ? `${Math.round(slot.latency)} ms`
              : "—";
          tooltip = `${timeStr} · ${statusName} (${latStr})${
            slot.diagnostic ? `\n${slot.diagnostic}` : ""
          }`;
        }

        return (
          <div
            key={idx}
            title={tooltip}
            className={`flex-1 h-full rounded-[2px] transition-transform hover:scale-y-125 ${bg}`}
          />
        );
      })}
    </div>
  );

  const cardTooltip = [
    `${target.name} (${target.target_type.toUpperCase()} · cada ${target.interval} s)`,
    target.endpoint,
    target.runner_type === "agent"
      ? `Guardián Senti9: ${target.agent_probe_name || "LAN"}`
      : "Ejecutor: Nube Sentinel",
    uptimeDisplay ? `Uptime 24h: ${uptimeDisplay}` : "",
    isDown ? `${fullDiagnostic} · ${downSinceText}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div
      data-testid="connectivity-card"
      role="button"
      tabIndex={0}
      aria-label={`Ver detalle de ${target.name}`}
      title={isCompact ? cardTooltip : undefined}
      onClick={() => onClick(target)}
      onKeyDown={(e) => {
        if (
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          onClick(target);
        }
      }}
      className={`group relative flex h-full flex-col justify-between rounded-2xl border cursor-pointer transition-all duration-150 ${
        isCompact ? "p-3 gap-2.5" : "p-4 gap-4"
      } ${cardSurfaceClass}`}
    >
      {/* Top-Left Floating Selection Checkbox (never shifts content alignment) */}
      {onSelectToggle && (
        <button
          type="button"
          role="checkbox"
          aria-checked={isSelected}
          aria-label={`Seleccionar ${target.name}`}
          title={isSelected ? "Deseleccionar" : "Seleccionar"}
          onClick={(e) => {
            e.stopPropagation();
            onSelectToggle(target);
          }}
          className={`sentinel-selection absolute -top-2 -left-2 z-10 grid h-5 w-5 place-items-center rounded-md bg-bg-dark border shadow-md transition-all cursor-pointer !min-h-0 !min-w-0 ${
            isSelected
              ? "border-accent-green bg-accent-green text-black"
              : "border-border-base text-transparent hover:border-text-muted"
          } ${checkboxVisibilityClass}`}
        >
          <Check
            size={11}
            strokeWidth={3}
            className={isSelected ? "opacity-100" : "opacity-0"}
          />
        </button>
      )}

      {/* Top Block: Single Left Alignment (Status Icon + Name, URL below) & Hover Actions + Toggle on Right */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2 min-w-0">
          {/* Status Icon + Name */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {renderStatusIcon(isCompact ? 16 : 18)}
            <h3
              className={`font-semibold truncate leading-tight ${
                isCompact ? "text-xs" : "text-sm"
              } ${
                isDown
                  ? "text-rose-300 font-bold"
                  : isPaused
                    ? "text-text-muted"
                    : "text-text-main group-hover:text-accent-green transition-colors"
              }`}
              title={target.name}
            >
              {target.name}
            </h3>
          </div>

          {/* Right: Hover Actions (Bell, Pencil, Trash2) + Always-Visible Toggle */}
          <div
            className="flex items-center gap-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
              {onAlert && (
                <button
                  type="button"
                  onClick={() => onAlert(target)}
                  title="Vincular regla de alerta"
                  aria-label={`Vincular alerta para ${target.name}`}
                  className="grid h-6 w-6 place-items-center rounded-md text-text-dim hover:text-amber-400 hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
                >
                  <Bell size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={() => onEdit(target)}
                title="Editar target"
                aria-label={`Editar ${target.name}`}
                className="grid h-6 w-6 place-items-center rounded-md text-text-dim hover:text-accent-green hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(target)}
                title="Eliminar target"
                aria-label={`Eliminar ${target.name}`}
                className="grid h-6 w-6 place-items-center rounded-md text-text-dim hover:text-rose-400 hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <TargetEnabledSwitch
              enabled={target.enabled}
              onChange={() => onToggle(target)}
              size="compact"
            />
          </div>
        </div>

        {/* URL aligned directly under the Name (hidden in compact mode) */}
        {!isCompact && (
          <p
            className="pl-[26px] text-xs text-text-dim font-mono truncate"
            title={target.endpoint}
          >
            {target.endpoint}
          </p>
        )}

        {/* Inline Failure Detail (only when Down or Slow, aligned under Name) */}
        {isDown && (
          <div
            className={`${isCompact ? "pl-[24px]" : "pl-[26px]"} pt-0.5 flex items-center gap-1.5 text-[11px] font-mono text-rose-300 truncate`}
            title={`${fullDiagnostic} · ${downSinceText}`}
          >
            <AlertTriangle size={11} className="text-rose-400 shrink-0" />
            <span className="truncate">
              {shortDiagnostic}
              {!isCompact && ` · ${downSinceText}`}
            </span>
          </div>
        )}
        {!isCompact && isSlow && (
          <div
            className="pl-[26px] pt-0.5 flex items-center gap-1.5 text-[11px] font-mono text-amber-300 truncate"
            title={fullDiagnostic}
          >
            <AlertTriangle size={11} className="text-amber-400 shrink-0" />
            <span className="truncate">{fullDiagnostic}</span>
          </div>
        )}
      </div>

      {/* Bottom Block: Big Latency + Protocol on same baseline, Slim History Bars below */}
      <div className={isCompact ? "space-y-2" : "space-y-2.5"}>
        <div className="flex items-baseline justify-between gap-2">
          {/* Big Latency / Status Metric */}
          <div className="min-w-0 truncate">
            {isPaused ? (
              <span
                className={`font-mono font-medium text-zinc-400 ${
                  isCompact ? "text-xs" : "text-sm"
                }`}
                title={pausedSinceFull}
              >
                {isCompact ? pausedSinceShort : pausedSinceFull}
              </span>
            ) : isDown ? (
              <div
                className="flex items-baseline gap-2"
                title={`Servicio caído (${downSinceText}) · Última latencia conocida: ${lastKnownLat || "N/A"}`}
              >
                <span
                  className={`font-mono font-bold text-rose-400 ${
                    isCompact ? "text-base" : "text-xl"
                  }`}
                >
                  Caído
                </span>
                {!isCompact && lastKnownLat && (
                  <span className="text-[11px] font-mono text-text-dim">
                    últ. {lastKnownLat}
                  </span>
                )}
              </div>
            ) : (
              <span
                className={`ui-tone font-mono font-bold tracking-tight ${
                  isCompact ? "text-base" : "text-2xl"
                }`}
                data-tone={latTone}
                title={
                  uptimeDisplay
                    ? `Latencia: ${latencyValue} · Uptime 24h: ${uptimeDisplay}`
                    : `Latencia: ${latencyValue}`
                }
              >
                {latencyValue}
              </span>
            )}
          </div>

          {/* Right: Clean Protocol Icon + Label (plus subtle Senti9 dot if private agent) */}
          <div className="flex items-center gap-2 shrink-0">
            {!isCompact && target.runner_type === "agent" && (
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                  target.agent_probe_online === false ||
                  target.agent_probe_status === "offline"
                    ? "text-rose-400"
                    : "text-text-dim"
                }`}
                title={
                  target.agent_probe_online === false ||
                  target.agent_probe_status === "offline"
                    ? `Guardián Senti9 (${target.agent_probe_name || "LAN"}) desconectado`
                    : `Sondeado por Guardián Senti9: ${target.agent_probe_name || "LAN"}`
                }
              >
                <Server size={11} className="shrink-0" />
                <span className="truncate max-w-[70px]">
                  {(target.agent_probe_name || "LAN").replace(
                    /^Senti9:\s*/i,
                    "",
                  )}
                </span>
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 font-mono font-semibold uppercase ${
                isCompact ? "text-[10px]" : "text-xs"
              } ${typeStyle.text}`}
              title={`Protocolo ${target.target_type.toUpperCase()} · cada ${target.interval} s`}
            >
              <ProtocolIcon size={isCompact ? 11 : 13} className="shrink-0" />
              <span>{target.target_type}</span>
            </span>
          </div>
        </div>

        {/* Slim History Bars */}
        {renderHistoryBars(isCompact ? "h-1.5" : "h-2")}
      </div>
    </div>
  );
}
