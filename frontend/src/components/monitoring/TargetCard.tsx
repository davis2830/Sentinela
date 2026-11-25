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
  hideAgentBadge?: boolean;
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
  hideAgentBadge = false,
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
  const pausedLabel = isPaused ? formatPausedSince(target, false) : "";
  const pausedTooltip = isPaused ? formatPausedSince(target, true) : "";

  // Clean display endpoint (strips scheme visually since protocol icon already shows it; full URL in tooltip)
  const displayEndpoint = (target.endpoint || "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");

  // Latency & Threshold Margin (<50% emerald, 50-100% amber, >100% rose)
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
  const latencyLimit =
    finite(target.max_latency_ms) && target.max_latency_ms > 0
      ? target.max_latency_ms
      : 2000;
  const latencyValue =
    lastLatencyNum !== null ? `${formatMetric(lastLatencyNum)} ms` : "—";
  const latTone =
    lastLatencyNum !== null
      ? latencyTone(lastLatencyNum, latencyLimit, target.last_status)
      : "muted";
  const latencyColorClass =
    latTone === "success"
      ? "text-emerald-400"
      : latTone === "warning"
        ? "text-amber-400"
        : latTone === "danger"
          ? "text-rose-400"
          : "text-text-dim";
  const latencyPct =
    lastLatencyNum !== null
      ? Math.round((lastLatencyNum / latencyLimit) * 100)
      : null;

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
  const uptimeColorClass =
    uptimePct == null
      ? "text-text-dim"
      : uptimePct >= 99
        ? "text-emerald-400/90"
        : uptimePct >= 95
          ? "text-amber-400"
          : "text-rose-400";

  // 16 slim bars in comfortable mode (14 in compact)
  const historySlots = getTargetHistorySlots(target, isCompact ? 14 : 16);

  // Neutral border on Online; colored border ONLY on Down (red) and Slow (amber); legible muted look on Paused
  const cardSurfaceClass = isSelected
    ? "border-accent-green bg-accent-green/5 ring-2 ring-accent-green/30"
    : isPaused
      ? "bg-bg-card/60 border-border-base/60 hover:bg-bg-card/85 hover:border-border-base"
      : isDown
        ? "bg-[#1c1217] border-rose-500/45 hover:bg-[#25161e] hover:border-rose-400/70"
        : isSlow
          ? "bg-bg-card border-amber-500/40 hover:border-amber-400/70"
          : "bg-bg-card border-border-base/80 hover:border-text-dim/60";

  const renderStatusIcon = (size: number) => {
    if (isPaused) {
      return (
        <PauseCircle
          size={size}
          className="text-slate-400 shrink-0"
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
        className="text-slate-500 shrink-0"
        aria-label="Desconocido"
      />
    );
  };

  // Visually distinct gray states:
  // - no_data ("Sin medición aún"): hollow outlined slot (bg-slate-900/50 border border-slate-700/75)
  // - paused ("Monitoreo pausado"): solid muted slate bar (bg-slate-600/75)
  const renderHistoryBars = (heightClass: string) => (
    <div
      className={`flex items-center gap-[3px] w-full ${heightClass}`}
      aria-label={`Historial reciente de ${target.name}`}
    >
      {historySlots.map((slot, idx) => {
        let bg = "bg-slate-900/50 border border-slate-700/75";
        let tooltip = "Sin medición aún";

        if (slot.status === "paused") {
          bg = "bg-slate-600/75";
          tooltip = pausedTooltip || "Monitoreo pausado";
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

  const latencyTooltip =
    lastLatencyNum !== null
      ? `Latencia: ${latencyValue} (${latencyPct}% del límite de ${formatMetric(latencyLimit)} ms)${
          uptimeDisplay ? ` · Uptime 24h: ${uptimeDisplay}` : ""
        }`
      : `Sin latencia registrada (límite: ${formatMetric(latencyLimit)} ms)`;

  const showSelectionBox = Boolean(onSelectToggle);
  const forceCheckbox = isSelected || hasAnySelection;

  return (
    <div
      data-testid="connectivity-card"
      role="button"
      tabIndex={0}
      aria-label={`Ver detalle de ${target.name}`}
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
        isCompact ? "p-3.5 gap-3" : "p-4 gap-3.5"
      } ${cardSurfaceClass}`}
    >
      {/* Top Block: Single Left Alignment (Status Icon / In-place Checkbox + Name + Agent, URL & Sub-metric below) */}
      <div className="space-y-1">
        <div className="relative flex items-center justify-between gap-2 min-w-0">
          {/* Left: In-place Status Icon -> Checkbox swap on hover/focus/selection + Name + Agent Pill */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className={`relative shrink-0 grid place-items-center ${
                isCompact ? "w-4 h-4" : "w-[18px] h-[18px]"
              }`}
            >
              {/* Status Icon (fades out when checkbox takes its place) */}
              <span
                className={`grid place-items-center transition-opacity duration-150 ${
                  showSelectionBox
                    ? forceCheckbox
                      ? "opacity-0 pointer-events-none"
                      : "opacity-100 group-hover:opacity-0 group-focus-within:opacity-0 [@media(hover:none)]:opacity-0"
                    : "opacity-100"
                }`}
              >
                {renderStatusIcon(isCompact ? 16 : 18)}
              </span>

              {/* Selection Checkbox inside the card, substituting the status icon */}
              {showSelectionBox && (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-label={`Seleccionar ${target.name}`}
                  title={isSelected ? "Deseleccionar" : "Seleccionar"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectToggle?.(target);
                  }}
                  className={`sentinel-selection absolute inset-0 grid place-items-center rounded-[4px] border transition-all duration-150 cursor-pointer !min-h-0 !min-w-0 ${
                    isSelected
                      ? "border-accent-green bg-accent-green text-black opacity-100"
                      : forceCheckbox
                        ? "border-slate-500 bg-bg-dark text-transparent hover:border-accent-green opacity-100"
                        : "border-slate-500 bg-bg-dark text-transparent hover:border-accent-green opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto"
                  }`}
                >
                  <Check
                    size={11}
                    strokeWidth={3}
                    className={isSelected ? "opacity-100" : "opacity-0"}
                  />
                </button>
              )}
            </div>

            <h3
              className={`font-semibold truncate leading-tight min-w-0 ${
                isCompact ? "text-[13px]" : "text-sm"
              } ${
                isDown
                  ? "text-rose-300 font-bold"
                  : isPaused
                    ? "text-slate-400"
                    : "text-text-main group-hover:text-accent-green transition-colors"
              }`}
              title={`${target.name} · ${target.endpoint}`}
            >
              {target.name}
            </h3>

            {!hideAgentBadge && target.runner_type === "agent" && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium shrink-0 max-w-[82px] ${
                  target.agent_probe_online === false ||
                  target.agent_probe_status === "offline"
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                    : isPaused
                      ? "bg-bg-dark/60 border-border-base/60 text-slate-500"
                      : "bg-bg-dark/80 border-border-base/80 text-text-muted"
                }`}
                title={
                  target.agent_probe_online === false ||
                  target.agent_probe_status === "offline"
                    ? `Guardián Senti9 (${target.agent_probe_name || "LAN"}) desconectado`
                    : `Sondeado por Guardián Senti9: ${target.agent_probe_name || "LAN"}`
                }
              >
                <Server size={10} className="shrink-0" />
                <span className="truncate">
                  {(target.agent_probe_name || "LAN").replace(
                    /^Senti9:\s*/i,
                    "",
                  )}
                </span>
              </span>
            )}
          </div>

          {/* Right: Non-shifting Floating Hover Actions + Always-Visible Toggle */}
          <div
            className="relative flex items-center shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Floating overlay pill on desktop hover/focus (never pushes the name); inline on touch */}
            <div className="flex items-center gap-0.5 rounded-lg border border-border-base/80 bg-bg-dark/95 backdrop-blur-sm px-0.5 py-0.5 shadow-lg absolute right-9 top-1/2 -translate-y-1/2 z-20 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto [@media(hover:none)]:static [@media(hover:none)]:translate-y-0 [@media(hover:none)]:mr-1.5 [@media(hover:none)]:border-0 [@media(hover:none)]:bg-transparent [@media(hover:none)]:p-0 [@media(hover:none)]:shadow-none [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto transition-opacity duration-150">
              {onAlert && (
                <button
                  type="button"
                  onClick={() => onAlert(target)}
                  title="Vincular regla de alerta"
                  aria-label={`Vincular alerta para ${target.name}`}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-text-dim hover:text-amber-400 hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
                >
                  <Bell size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={() => onEdit(target)}
                title="Editar target"
                aria-label={`Editar ${target.name}`}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-text-dim hover:text-accent-green hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(target)}
                title="Eliminar target"
                aria-label={`Eliminar ${target.name}`}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-text-dim hover:text-rose-400 hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
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

        {/* Line 2: Truncated Endpoint URL aligned directly under Name */}
        <p
          className={`${isCompact ? "pl-[24px] text-[11px]" : "pl-[26px] text-xs"} font-mono truncate ${
            isPaused ? "text-slate-500" : "text-text-dim"
          }`}
          title={target.endpoint}
        >
          {displayEndpoint}
        </p>

        {/* Line 3 (Fixed single-line slot across all states): Error / Slow reason OR Online Uptime 24h */}
        <div
          className={`${isCompact ? "pl-[24px]" : "pl-[26px]"} min-h-[18px] flex items-center text-[11px] font-mono truncate`}
        >
          {isDown ? (
            <span
              className="inline-flex items-center gap-1.5 text-rose-300 truncate"
              title={`${fullDiagnostic} · ${downSinceText}`}
            >
              <AlertTriangle size={11} className="text-rose-400 shrink-0" />
              <span className="truncate">
                {shortDiagnostic} · {downSinceText}
              </span>
            </span>
          ) : isSlow ? (
            <span
              className="inline-flex items-center gap-1.5 text-amber-300 truncate"
              title={fullDiagnostic}
            >
              <AlertTriangle size={11} className="text-amber-400 shrink-0" />
              <span className="truncate">{fullDiagnostic}</span>
            </span>
          ) : isUp && uptimeDisplay ? (
            <span
              className="inline-flex items-center gap-1 truncate"
              title="Disponibilidad individual calculada sobre comprobaciones recientes"
            >
              <span className={`font-semibold ${uptimeColorClass}`}>
                {uptimeDisplay}
              </span>
              <span className="text-text-dim">· 24 h</span>
            </span>
          ) : isPaused ? (
            <span className="text-slate-500 truncate">
              cada {target.interval} s · en pausa
            </span>
          ) : (
            <span className="text-text-dim truncate">
              cada {target.interval} s
            </span>
          )}
        </div>
      </div>

      {/* Bottom Block: Fixed-height Metric + Protocol row (uniform vertical alignment) & Slim History Bars */}
      <div className={isCompact ? "space-y-2" : "space-y-2.5"}>
        <div
          className={`flex items-center justify-between gap-2 ${
            isCompact ? "h-7" : "h-8"
          }`}
        >
          {/* Big Latency / Status Metric */}
          <div className="min-w-0 truncate flex items-center">
            {isPaused ? (
              <span
                className={`font-mono font-medium leading-none text-slate-400 ${
                  isCompact ? "text-xs" : "text-sm"
                }`}
                title={pausedTooltip}
              >
                {pausedLabel}
              </span>
            ) : isDown ? (
              <div
                className="flex items-baseline gap-2 leading-none"
                title={`Servicio caído (${downSinceText}) · Última latencia conocida: ${lastKnownLat || "N/A"}`}
              >
                <span
                  className={`font-mono font-bold text-rose-400 ${
                    isCompact ? "text-base" : "text-xl"
                  }`}
                >
                  Caído
                </span>
                {lastKnownLat && (
                  <span className="text-[11px] font-mono text-text-dim">
                    últ. {lastKnownLat}
                  </span>
                )}
              </div>
            ) : (
              <span
                className={`font-mono font-bold leading-none tracking-tight ${latencyColorClass} ${
                  isCompact ? "text-lg" : "text-2xl"
                }`}
                data-tone={latTone}
                title={latencyTooltip}
              >
                {latencyValue}
              </span>
            )}
          </div>

          {/* Right: Clean Protocol Icon + Label (unobstructed) */}
          <span
            className={`inline-flex items-center gap-1 font-mono font-semibold leading-none uppercase shrink-0 ${
              isCompact ? "text-[11px]" : "text-xs"
            } ${isPaused ? "text-slate-400" : typeStyle.text}`}
            title={`Protocolo ${target.target_type.toUpperCase()} · cada ${target.interval} s`}
          >
            <ProtocolIcon size={isCompact ? 12 : 13} className="shrink-0" />
            <span>{target.target_type}</span>
          </span>
        </div>

        {/* Slim History Bars */}
        {renderHistoryBars(isCompact ? "h-1.5" : "h-2")}
      </div>
    </div>
  );
}
