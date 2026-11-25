import { useEffect, useRef, useState } from "react";
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
  MoreHorizontal,
  PauseCircle,
  Pencil,
  RefreshCw,
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
  onScan: (target: MonitoringTarget) => void;
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
  onScan,
  onToggle,
  onAlert,
  isScanning = false,
  onClick,
  isSelected = false,
  hasAnySelection = false,
  onSelectToggle,
}: TargetCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

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

  // Latency & Uptime 24h
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
      : "—";
  const uptimeColor =
    uptimePct == null
      ? "text-text-dim"
      : uptimePct >= 99
        ? "text-emerald-400"
        : uptimePct >= 95
          ? "text-amber-400"
          : "text-rose-400";

  // History slots (20 in comfortable, 12 in compact) — strictly gray when paused
  const slotCount = isCompact ? 12 : 20;
  const historySlots = getTargetHistorySlots(target, slotCount);

  // Clean tags (strip Senti9: prefix, limit to 2 visible + "+N")
  const cleanTags = (target.tags || [])
    .map((t) => t.replace(/^Senti9:\s*/i, "").trim())
    .filter(Boolean);
  const visibleTags = cleanTags.slice(0, 2);
  const extraTags = cleanTags.slice(2);

  // Shape-coded Status Icon (accessible beyond color)
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

  // Card surface & left accent border
  const cardSurfaceClass = isSelected
    ? "border-accent-green bg-accent-green/5 ring-2 ring-accent-green/30"
    : isPaused
      ? "bg-bg-card/80 border-border-base/60 border-l-2 border-l-zinc-600 opacity-60 hover:opacity-85 hover:border-border-base"
      : isDown
        ? "bg-[#1c1217] border-rose-500/35 border-l-2 border-l-rose-500 hover:bg-[#25161e] hover:border-rose-400/60"
        : isSlow
          ? "bg-bg-card border-amber-500/30 border-l-2 border-l-amber-400 hover:border-amber-400/60"
          : isUp
            ? "bg-bg-card border-border-base/75 border-l-2 border-l-emerald-500/70 hover:border-accent-green/50"
            : "bg-bg-card border-border-base/75 border-l-2 border-l-zinc-600 hover:border-accent-green/40";

  // Checkbox visibility: show on hover, focus, touch, or while any selection is active
  const checkboxVisibilityClass =
    isSelected || hasAnySelection
      ? "opacity-100"
      : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100";

  // Overflow actions menu visibility: hover, focus, touch, or open
  const actionsVisibilityClass = menuOpen
    ? "opacity-100"
    : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100";

  const renderOverflowMenu = () => (
    <div
      ref={menuRef}
      className="relative"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={`Más acciones para ${target.name}`}
        title="Más acciones"
        className={`grid h-6 w-6 place-items-center rounded-md text-text-muted hover:text-text-main hover:bg-white/10 transition-all cursor-pointer !min-h-0 !min-w-0 ${actionsVisibilityClass}`}
      >
        <MoreHorizontal size={14} />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-7 z-30 w-44 rounded-xl border border-border-base bg-bg-dark/95 backdrop-blur-md p-1 shadow-2xl text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          <button
            type="button"
            role="menuitem"
            disabled={isScanning || isPaused}
            onClick={() => {
              setMenuOpen(false);
              onScan(target);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-text-main hover:bg-bg-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer !min-h-0"
          >
            <RefreshCw
              size={13}
              className={`text-accent-green shrink-0 ${isScanning ? "animate-spin" : ""}`}
            />
            <span>Comprobar ahora</span>
          </button>

          {onAlert && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onAlert(target);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-text-main hover:bg-bg-card-hover transition-colors cursor-pointer !min-h-0"
            >
              <Bell size={13} className="text-amber-400 shrink-0" />
              <span>Vincular alerta</span>
            </button>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onEdit(target);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-text-main hover:bg-bg-card-hover transition-colors cursor-pointer !min-h-0"
          >
            <Pencil size={13} className="text-sky-400 shrink-0" />
            <span>Editar target</span>
          </button>

          <div className="my-1 border-t border-border-base/70" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onDelete(target);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer !min-h-0"
          >
            <Trash2 size={13} className="shrink-0" />
            <span>Eliminar target</span>
          </button>
        </div>
      )}
    </div>
  );

  const renderCheckbox = () => {
    if (!onSelectToggle) return null;
    return (
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
        className={`sentinel-selection grid h-5 w-5 place-items-center rounded bg-transparent p-0 transition-opacity cursor-pointer !min-h-0 !min-w-0 shrink-0 ${checkboxVisibilityClass}`}
      >
        <span
          className={`grid h-4 w-4 place-items-center rounded transition-colors ${
            isSelected
              ? "bg-accent-green text-black ring-1 ring-accent-green/40"
              : "border border-border-base/90 bg-bg-dark/90 text-transparent hover:border-text-muted"
          }`}
        >
          <Check
            size={10}
            strokeWidth={3}
            className={isSelected ? "opacity-100" : "opacity-0"}
          />
        </span>
      </button>
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
          bg = "bg-zinc-700/50";
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

  // =========================================================================
  // COMPACT MODE (~220px "Status Wall" variant)
  // =========================================================================
  if (isCompact) {
    const cardTooltip = [
      `${target.name} (${target.target_type.toUpperCase()})`,
      target.endpoint,
      isDown
        ? `${fullDiagnostic} · ${downSinceText}`
        : isPaused
          ? pausedSinceFull
          : `Latencia: ${latencyValue} · Uptime 24h: ${uptimeDisplay}`,
      cleanTags.length ? `Tags: ${cleanTags.map((t) => `#${t}`).join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return (
      <div
        data-testid="connectivity-card"
        role="button"
        tabIndex={0}
        aria-label={`Ver detalle de ${target.name}`}
        title={cardTooltip}
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
        className={`group relative flex h-full flex-col justify-between gap-2 rounded-xl border p-2.5 cursor-pointer transition-all duration-150 ${cardSurfaceClass}`}
      >
        {/* Row 1: Checkbox + Status Icon + Name + Overflow + Toggle */}
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {renderCheckbox()}
            {renderStatusIcon(15)}
            <h3
              className={`text-xs font-semibold truncate ${
                isDown
                  ? "text-rose-300 font-bold"
                  : isPaused
                    ? "text-text-muted"
                    : "text-text-main group-hover:text-accent-green transition-colors"
              }`}
            >
              {target.name}
            </h3>
          </div>

          <div
            className="flex items-center gap-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {renderOverflowMenu()}
            <TargetEnabledSwitch
              enabled={target.enabled}
              onChange={() => onToggle(target)}
              size="compact"
            />
          </div>
        </div>

        {/* Row 2: Key Metric (Latency / Error / Paused) + Protocol Icon */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0 truncate">
            {isPaused ? (
              <span className="text-[11px] font-mono text-zinc-400 truncate block">
                {pausedSinceShort}
              </span>
            ) : isDown ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-rose-400 truncate">
                <AlertTriangle size={11} className="shrink-0" />
                <span className="truncate">{shortDiagnostic}</span>
              </span>
            ) : (
              <span
                className="ui-tone text-sm font-bold font-mono"
                data-tone={latTone}
              >
                {latencyValue}
              </span>
            )}
          </div>

          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border uppercase shrink-0 ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}
          >
            <ProtocolIcon size={10} className="shrink-0" />
            <span>{target.target_type}</span>
          </span>
        </div>

        {/* Row 3: Slim History Strip */}
        {renderHistoryBars("h-2")}
      </div>
    );
  }

  // =========================================================================
  // COMFORTABLE MODE (Standard ~320px card)
  // =========================================================================
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
      className={`group relative flex h-full flex-col justify-between rounded-xl border p-3.5 cursor-pointer transition-all duration-150 ${cardSurfaceClass}`}
    >
      {/* Top Section: Utility strip + Identity + Optional Error Callout */}
      <div className="space-y-2">
        {/* Utility Strip: Top-left checkbox (+ Senti9 pill if agent) & Top-right overflow + toggle */}
        <div className="flex items-center justify-between gap-2 min-h-[22px]">
          <div className="flex items-center gap-1.5 min-w-0">
            {renderCheckbox()}
            {target.runner_type === "agent" && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border truncate max-w-[140px] ${
                  target.agent_probe_online === false ||
                  target.agent_probe_status === "offline"
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                    : "bg-accent-purple/10 text-accent-purple border-accent-purple/30"
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
                {(target.agent_probe_online === false ||
                  target.agent_probe_status === "offline") && (
                  <span className="font-mono text-[9px]">(Offline)</span>
                )}
              </span>
            )}
          </div>

          <div
            className="flex items-center gap-1.5 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {renderOverflowMenu()}
            <TargetEnabledSwitch
              enabled={target.enabled}
              onChange={() => onToggle(target)}
              size="compact"
            />
          </div>
        </div>

        {/* Identity Row: Status Icon + Single-line Name/URL + Protocol Badge */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <div className="mt-0.5 shrink-0">{renderStatusIcon(18)}</div>
            <div className="min-w-0 flex-1">
              <h3
                className={`font-semibold text-sm leading-tight truncate ${
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
              <p
                className="text-xs text-text-dim font-mono truncate mt-0.5"
                title={target.endpoint}
              >
                {target.endpoint}
              </p>
            </div>
          </div>

          {/* Protocol Badge with Semantic Icon */}
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border uppercase shrink-0 ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}
            title={`Protocolo ${target.target_type.toUpperCase()}`}
          >
            <ProtocolIcon size={11} className="shrink-0" />
            <span>{target.target_type}</span>
          </span>
        </div>

        {/* Failure / Slow Callout (only shown if failing or slow) */}
        {isDown && (
          <div
            title={`${fullDiagnostic} · ${downSinceText}`}
            className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25 px-2 py-1 text-xs font-mono text-rose-300 truncate"
          >
            <AlertTriangle size={12} className="text-rose-400 shrink-0" />
            <span className="truncate">
              {shortDiagnostic} · {downSinceText}
            </span>
          </div>
        )}
        {isSlow && (
          <div
            title={fullDiagnostic}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 px-2 py-1 text-xs font-mono text-amber-300 truncate"
          >
            <AlertTriangle size={12} className="text-amber-400 shrink-0" />
            <span className="truncate">{fullDiagnostic}</span>
          </div>
        )}
      </div>

      {/* Bottom Section: Metrics + 20 Slim Bars + Clean Single-Line Footer */}
      <div className="mt-4 space-y-2.5">
        {/* Primary Metrics Row: Big Latency + Uptime 24h */}
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0 truncate">
            {isPaused ? (
              <span
                className="text-xs font-medium text-zinc-400 font-mono"
                title={pausedSinceFull}
              >
                {pausedSinceFull}
              </span>
            ) : isDown ? (
              <div
                className="flex items-baseline gap-2"
                title={`Servicio caído (${downSinceText}) · Última latencia conocida: ${lastKnownLat || "N/A"}`}
              >
                <span className="text-base font-bold font-mono text-rose-400">
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
                className="ui-tone text-lg font-bold font-mono tracking-tight"
                data-tone={latTone}
                title={`Latencia actual: ${latencyValue}`}
              >
                {latencyValue}
              </span>
            )}
          </div>

          <div
            className="flex items-baseline gap-1.5 text-xs shrink-0"
            title="Disponibilidad calculada sobre comprobaciones recientes"
          >
            <span className="text-text-dim text-[11px]">Uptime 24h</span>
            <span className={`font-mono font-bold ${uptimeColor}`}>
              {uptimeDisplay}
            </span>
          </div>
        </div>

        {/* 20 Slim History Bars */}
        {renderHistoryBars("h-3.5")}

        {/* Uniform Single-Line Footer: Interval + Fixed Max-2 Tags (+N) */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-base/40 text-[11px] min-h-[24px]">
          <span className="text-text-dim shrink-0 font-mono">
            cada {target.interval} s
          </span>

          <div className="flex items-center justify-end gap-1 min-w-0 overflow-hidden">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 rounded bg-bg-dark/80 border border-border-base/70 text-[10px] text-text-muted font-medium truncate max-w-[96px]"
                title={`#${tag}`}
              >
                #{tag}
              </span>
            ))}
            {extraTags.length > 0 && (
              <span
                className="px-1.5 py-0.5 rounded bg-bg-dark border border-border-base text-[10px] font-mono text-text-dim shrink-0"
                title={extraTags.map((t) => `#${t}`).join(", ")}
              >
                +{extraTags.length}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
