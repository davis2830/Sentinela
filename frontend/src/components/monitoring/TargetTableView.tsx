import { useEffect, useState } from "react";
import TargetLatency, { formatShortDiagnostic } from "./TargetLatency";
import { TargetEnabledSwitch } from "./TargetTableControls";
import {
  TARGET_TYPE_COLORS,
  TARGET_TYPE_ICONS,
  getTargetHistorySlots,
  getTargetStatusKind,
  isTargetGuardianOffline,
  isTargetGuardianPaused,
  type TargetDensity,
  type TargetGroup,
  type TargetSortField,
} from "./useTargets";
import {
  Globe,
  Server,
  Bell,
  Pencil,
  Trash2,
  ArrowUpDown,
  Layers,
  ChevronDown,
  ChevronRight,
  Check,
  AlertTriangle,
} from "lucide-react";
import type { MonitoringTarget } from "../../types/monitoring";

interface TargetTableViewProps {
  sortedTargets: MonitoringTarget[];
  groupedTargets: TargetGroup[] | null;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  density: TargetDensity;
  selectedIds: string[];
  onSelectToggle: (target: MonitoringTarget) => void;
  onSelectAllToggle: () => void;
  onEdit: (target: MonitoringTarget) => void;
  onDelete: (target: MonitoringTarget) => void;
  onToggle: (target: MonitoringTarget) => void;
  onAlert?: (target: MonitoringTarget) => void;
  onClick: (target: MonitoringTarget) => void;
  sortField: TargetSortField;
  sortAsc: boolean;
  onSortChange: (field: TargetSortField) => void;
}

export default function TargetTableView({
  sortedTargets,
  groupedTargets,
  collapsedGroups,
  onToggleGroup,
  density,
  selectedIds,
  onSelectToggle,
  onSelectAllToggle,
  onEdit,
  onDelete,
  onToggle,
  onAlert,
  onClick,
  sortField,
  sortAsc,
  onSortChange,
}: TargetTableViewProps) {
  const allSelected =
    sortedTargets.length > 0 && selectedIds.length === sortedTargets.length;
  const [mobile, setMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const renderStatus = (target: MonitoringTarget) => {
    const kind = getTargetStatusKind(target);
    if (isTargetGuardianOffline(target)) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 shrink-0"
          title={`Sin datos: guardián Senti9 (${target.agent_probe_name || "LAN"}) desconectado`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Sin datos
        </span>
      );
    }
    if (kind === "paused") {
      const byGuardian = isTargetGuardianPaused(target);
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 shrink-0"
          title={
            byGuardian
              ? `Pausado: guardián detenido (${target.agent_probe_name || "LAN"})`
              : "Monitoreo pausado"
          }
        >
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
          Pausado
        </span>
      );
    }
    if (kind === "up") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          Online
        </span>
      );
    }
    if (kind === "slow") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
          </span>
          Lento
        </span>
      );
    }
    if (kind === "down") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/40 shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
          </span>
          Caído
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
        Desconocido
      </span>
    );
  };

  const renderRow = (target: MonitoringTarget) => {
    const isSelected = selectedIds.includes(target.id);
    const TypeIcon = TARGET_TYPE_ICONS[target.target_type] || Globe;
    const typeStyle = TARGET_TYPE_COLORS[target.target_type] || {
      bg: "bg-accent-green/10",
      text: "text-accent-green",
      border: "border-accent-green/30",
    };

    const historySlots = getTargetHistorySlots(target, 8);
    const statusKind = getTargetStatusKind(target);
    const isCompact = density === "compact";
    const paddingY = isCompact ? "py-2" : "py-3";
    const isDown = statusKind === "down";
    const isOnline = statusKind === "up";
    const isPaused = statusKind === "paused";

    const lastCheck = target.recent_checks?.length
      ? target.recent_checks[target.recent_checks.length - 1]
      : null;
    const fullDiagnostic =
      lastCheck?.diagnostic ||
      (target.last_status === "slow"
        ? "Respuesta lenta registrada"
        : "Comprobación fallida");
    const shortDiagnostic = formatShortDiagnostic(
      fullDiagnostic,
      target.expected_status,
    );

    return (
      <tr
        key={target.id}
        onClick={() => onClick(target)}
        tabIndex={0}
        aria-label={target.name}
        onKeyDown={(e) => {
          if (
            e.target === e.currentTarget &&
            (e.key === "Enter" || e.key === " ")
          ) {
            e.preventDefault();
            onClick(target);
          }
        }}
        className={`group cursor-pointer transition-colors border-b border-border-base/70 ${
          isSelected
            ? "bg-accent-green/5"
            : isPaused
              ? "bg-bg-dark/25 hover:bg-white/[0.03]"
              : isDown
                ? "bg-[#1c1217] border-l-2 border-l-rose-500 hover:bg-[#25161e]"
                : isOnline
                  ? "opacity-90 hover:opacity-100 hover:bg-white/[0.03]"
                  : "hover:bg-white/[0.03]"
        }`}
      >
        {/* 1. Selection Checkbox */}
        <td
          className={`${paddingY} px-2.5 w-8 text-center`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="checkbox"
            aria-checked={isSelected}
            aria-label={`Seleccionar ${target.name}`}
            title={isSelected ? "Deseleccionar" : "Seleccionar"}
            onClick={() => onSelectToggle(target)}
            className="sentinel-selection grid h-6 w-6 place-items-center rounded bg-transparent p-0 cursor-pointer !min-h-0 !min-w-0"
          >
            <span
              className={`grid h-4 w-4 place-items-center rounded transition-colors ${
                isSelected
                  ? "bg-accent-green text-black ring-1 ring-accent-green/40"
                  : "border border-border-base/90 bg-bg-dark/80 text-transparent"
              }`}
            >
              <Check
                size={10}
                strokeWidth={3}
                className={isSelected ? "opacity-100" : "opacity-0"}
              />
            </span>
          </button>
        </td>

        {/* 2. Estado (Fixed 105px width) */}
        <td className={`${paddingY} px-2.5 whitespace-nowrap w-[105px]`}>
          {renderStatus(target)}
        </td>

        {/* 3. Target & Endpoint - w-full max-w-0 absorbs excess space */}
        <td className={`${paddingY} px-3 w-full max-w-0`}>
          <div className="flex min-w-0 items-center gap-2">
            {/* Type Badge inline with fixed width and protocol icon */}
            <span
              className={`inline-flex items-center justify-center gap-1 w-[72px] shrink-0 text-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border uppercase ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}
              title={`Protocolo ${target.target_type.toUpperCase()} · Intervalo: cada ${target.interval}s`}
            >
              <TypeIcon size={11} className="shrink-0" />
              <span>{target.target_type}</span>
            </span>

            {/* Target Name */}
            <span
              className={`shrink-0 font-semibold text-xs transition-colors ${
                isDown
                  ? "text-rose-300 font-bold"
                  : isPaused
                    ? "text-slate-400"
                    : "text-text-main group-hover:text-accent-green"
              }`}
              title={target.name}
            >
              {target.name}
            </span>

            {/* Endpoint URL (Non-stretching, naturally clustered with name) */}
            <span
              className="shrink truncate max-w-[260px] lg:max-w-[380px] font-mono text-xs text-text-dim"
              title={target.endpoint}
            >
              {target.endpoint}
            </span>

            {/* Senti9 Agent Pill without 'Senti9:' */}
            {target.runner_type === "agent" && (
              <span
                className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${
                  isTargetGuardianPaused(target)
                    ? "bg-slate-500/10 text-slate-400 border-slate-500/30"
                    : target.agent_probe_online === false ||
                        target.agent_probe_status === "offline"
                      ? "bg-accent-red/10 text-accent-red border-accent-red/30"
                      : "bg-accent-purple/10 text-accent-purple border-accent-purple/30"
                }`}
                title={
                  isTargetGuardianPaused(target)
                    ? `Guardián Senti9 (${target.agent_probe_name || "LAN"}) pausado`
                    : `Sondeado por Guardián Senti9: ${target.agent_probe_name || "LAN"}`
                }
              >
                <Server size={9} className="shrink-0" />
                <span className="truncate max-w-[80px]">
                  {(target.agent_probe_name || "LAN").replace(/^Senti9:\s*/i, "")}
                </span>
              </span>
            )}

            {/* Team Pill */}
            {target.owner_team_name && (
              <span
                className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold border"
                style={{
                  backgroundColor: `${target.owner_team_color || "#8B5CF6"}15`,
                  borderColor: `${target.owner_team_color || "#8B5CF6"}40`,
                  color: target.owner_team_color || "#A78BFA",
                }}
              >
                <Layers size={9} className="shrink-0" />
                <span className="truncate max-w-[70px]">
                  {target.owner_team_name}
                </span>
              </span>
            )}

            {/* Guardian paused callout */}
            {isTargetGuardianPaused(target) && (
              <span
                title={`El guardián Senti9 (${target.agent_probe_name || "LAN"}) está pausado; el monitor no se reporta como caído.`}
                className="shrink-0 text-[11px] text-slate-300 font-mono inline-flex items-center gap-1 bg-slate-500/15 px-1.5 py-0.5 rounded border border-slate-500/30"
              >
                <Server size={10} className="text-slate-400 shrink-0" />
                <span>Pausado: guardián detenido</span>
              </span>
            )}

            {/* Guardian offline callout (so it doesn't look like a service outage) */}
            {isTargetGuardianOffline(target) && (
              <span
                title={`El guardián Senti9 (${target.agent_probe_name || "LAN"}) está desconectado; no se reporta como caída del servicio.`}
                className="shrink-0 text-[11px] text-amber-300 font-mono inline-flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/25"
              >
                <Server size={10} className="text-amber-400 shrink-0" />
                <span>guardián desconectado</span>
              </span>
            )}

            {/* In compact mode, show error inline at the end with explicit tooltip */}
            {isCompact && isDown && (
              <span
                title={`${fullDiagnostic} · esperado ${target.expected_status || 200}`}
                className="shrink-0 text-xs text-rose-300 font-mono inline-flex items-center gap-1 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20"
              >
                <AlertTriangle size={11} className="text-rose-400 shrink-0" />
                <span>{shortDiagnostic}</span>
              </span>
            )}
          </div>

          {/* In comfortable mode, error diagnostic on second line */}
          {!isCompact && isDown && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-rose-400 font-mono truncate">
              <AlertTriangle size={12} className="shrink-0 text-rose-400" />
              <span>{fullDiagnostic}</span>
            </div>
          )}
        </td>

        {/* 4. Latencia (Single Line Clean, or Paused / Caído) */}
        <td className={`${paddingY} px-2.5 whitespace-nowrap w-[135px]`}>
          <TargetLatency target={target} compact />
        </td>

        {/* 5. Historial Reciente (8 Slim Bars — gray if paused) */}
        <td className={`${paddingY} px-2.5 whitespace-nowrap w-[90px]`}>
          <div className="flex items-center gap-1 h-3 w-20">
            {historySlots.map((slot, idx) => {
              let bg = "bg-slate-900/50 border border-slate-700/75";
              let tooltip = "Sin medición aún";

              if (slot.status === "paused") {
                bg = "bg-slate-600/75";
                tooltip = "Monitoreo pausado";
              } else if (slot.status !== "no_data") {
                if (slot.status === "up") bg = "bg-emerald-500";
                else if (slot.status === "slow") bg = "bg-amber-400";
                else if (slot.status === "down") bg = "bg-rose-500";

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
                  className={`flex-1 h-full rounded-xs transition-transform hover:scale-125 cursor-pointer ${bg}`}
                />
              );
            })}
          </div>
        </td>

        {/* 6. Acciones - Fade in on hover, background matches row */}
        <td
          className={`${paddingY} px-2.5 text-right whitespace-nowrap w-[110px] ${
            isDown ? "bg-[#1c1217]" : "bg-transparent"
          } group-hover:bg-white/[0.03] transition-colors`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-end gap-1.5">
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
              {onAlert && (
                <button
                  type="button"
                  onClick={() => onAlert(target)}
                  title="Vincular regla de alerta"
                  className="table-action-btn p-1 rounded text-text-dim hover:text-accent-yellow hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0 h-6 w-6 grid place-items-center"
                >
                  <Bell size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={() => onEdit(target)}
                title="Editar target"
                className="table-action-btn p-1 rounded text-text-dim hover:text-accent-green hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0 h-6 w-6 grid place-items-center"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(target)}
                title="Eliminar target"
                className="table-action-btn p-1 rounded text-text-dim hover:text-accent-red hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0 h-6 w-6 grid place-items-center"
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
        </td>
      </tr>
    );
  };

  return (
    <div
      data-testid="connectivity-table"
      className="connectivity-directory-table w-full max-w-[1400px] mx-auto bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-xl font-sans"
    >
      {/* Main Table / Mobile View */}
      {mobile ? (
        <div
          className="divide-y divide-border-base"
          data-testid="monitoring-mobile-list"
        >
          <details className="p-3">
            <summary className="flex items-center text-xs text-text-muted cursor-pointer">
              Orden y selección
            </summary>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <label className="text-xs text-text-muted">
                Ordenar por
                <select
                  aria-label="Ordenar targets"
                  className="ml-2 bg-bg-dark border border-border-base rounded-lg p-1.5 text-xs text-text-main"
                  value={sortField}
                  onChange={(e) =>
                    onSortChange(e.target.value as TargetSortField)
                  }
                >
                  <option value="status">Estado (Caídos primero)</option>
                  <option value="name">Nombre</option>
                  <option value="latency">Latencia</option>
                </select>
              </label>
              <button
                type="button"
                className="text-xs text-accent-green hover:underline cursor-pointer"
                onClick={() => onSortChange(sortField)}
                aria-label="Invertir orden"
              >
                {sortAsc ? "Ascendente" : "Descendente"}
              </button>
            </div>
          </details>

          {sortedTargets.map((target) => (
            <article
              key={target.id}
              className={`min-w-0 p-3 space-y-2 ${!target.enabled ? "opacity-60" : ""}`}
            >
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selectedIds.includes(target.id)}
                  onClick={() => onSelectToggle(target)}
                  className="grid h-6 w-6 place-items-center rounded bg-transparent p-0 shrink-0"
                >
                  <span
                    className={`grid h-4 w-4 place-items-center rounded transition-colors ${
                      selectedIds.includes(target.id)
                        ? "bg-accent-green text-black"
                        : "border border-border-base bg-bg-dark"
                    }`}
                  >
                    <Check
                      size={10}
                      strokeWidth={3}
                      className={
                        selectedIds.includes(target.id)
                          ? "opacity-100"
                          : "opacity-0"
                      }
                    />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onClick(target)}
                  aria-label={`Ver detalle de ${target.name}`}
                  className="min-w-0 flex-1 text-left cursor-pointer"
                >
                  <span className="block font-semibold text-text-main break-words">
                    {target.name}
                  </span>
                  <span className="block text-xs text-text-muted break-all">
                    {target.endpoint}
                  </span>
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                {renderStatus(target)}
                <span>
                  {target.target_type.toUpperCase()} · cada {target.interval}s
                </span>
                <TargetLatency target={target} compact />
              </div>
              <div className="flex items-center justify-end gap-1.5 pt-1">
                {onAlert && (
                  <button
                    type="button"
                    onClick={() => onAlert(target)}
                    className="p-1.5 text-text-dim hover:text-accent-yellow"
                    title="Vincular alerta"
                  >
                    <Bell size={15} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onEdit(target)}
                  className="p-1.5 text-text-dim hover:text-accent-green"
                  title="Editar"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(target)}
                  className="p-1.5 text-text-dim hover:text-accent-red"
                  title="Eliminar"
                >
                  <Trash2 size={15} />
                </button>
                <TargetEnabledSwitch
                  enabled={target.enabled}
                  onChange={() => onToggle(target)}
                  size="compact"
                />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="w-full">
          <table className="w-full text-left text-xs text-text-main border-collapse">
            <thead className="sticky top-0 z-10 bg-bg-dark/95 backdrop-blur-md shadow-sm border-b border-border-base">
              <tr className="bg-bg-dark/90 font-semibold text-text-dim select-none">
                <th scope="col" className="py-2 px-2.5 w-8 text-center">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={allSelected}
                    aria-label="Seleccionar todos los recursos"
                    title={
                      allSelected ? "Deseleccionar todos" : "Seleccionar todos"
                    }
                    onClick={onSelectAllToggle}
                    className="sentinel-selection grid h-6 w-6 place-items-center rounded bg-transparent p-0 cursor-pointer !min-h-0 !min-w-0"
                  >
                    <span
                      className={`grid h-4 w-4 place-items-center rounded transition-colors ${
                        allSelected
                          ? "bg-accent-green text-black ring-1 ring-accent-green/40"
                          : "border border-border-base/90 bg-bg-dark/80 text-transparent"
                      }`}
                    >
                      <Check
                        size={10}
                        strokeWidth={3}
                        className={allSelected ? "opacity-100" : "opacity-0"}
                      />
                    </span>
                  </button>
                </th>
                <th
                  scope="col"
                  className="py-2 px-2.5 cursor-pointer hover:text-text-main w-[105px]"
                  onClick={() => onSortChange("status")}
                  title="Ordenar por estado (Caídos primero)"
                >
                  <div className="flex items-center gap-1">
                    <span>Estado</span>
                    <ArrowUpDown
                      size={11}
                      className={
                        sortField === "status"
                          ? "text-accent-green"
                          : "text-text-dim"
                      }
                    />
                  </div>
                </th>
                <th
                  scope="col"
                  className="py-2 px-3 cursor-pointer hover:text-text-main w-full"
                  onClick={() => onSortChange("name")}
                  title="Ordenar por nombre"
                >
                  <div className="flex items-center gap-1">
                    <span>Target & Endpoint</span>
                    <ArrowUpDown
                      size={11}
                      className={
                        sortField === "name"
                          ? "text-accent-green"
                          : "text-text-dim"
                      }
                    />
                  </div>
                </th>
                <th
                  scope="col"
                  className="py-2 px-2.5 cursor-pointer hover:text-text-main w-[135px]"
                  onClick={() => onSortChange("latency")}
                  title="Ordenar por latencia"
                >
                  <div className="flex items-center gap-1">
                    <span>Latencia</span>
                    <ArrowUpDown
                      size={11}
                      className={
                        sortField === "latency"
                          ? "text-accent-green"
                          : "text-text-dim"
                      }
                    />
                  </div>
                </th>
                <th scope="col" className="py-2 px-2.5 w-[90px]">
                  Historial (8)
                </th>
                <th
                  scope="col"
                  className="py-2 px-2.5 text-right w-[110px] bg-inherit"
                >
                  Acciones
                </th>
              </tr>
            </thead>
            {groupedTargets ? (
              groupedTargets.map((group) => {
                const isCollapsed = Boolean(collapsedGroups[group.key]);
                const GroupIcon = group.icon;

                return (
                  <tbody
                    key={group.key}
                    className="border-b border-border-base/50"
                  >
                    {/* Collapsible Group Header Row */}
                    <tr
                      onClick={() => onToggleGroup(group.key)}
                      className="bg-bg-dark/70 hover:bg-bg-dark cursor-pointer transition-colors border-y border-border-base/60 select-none"
                    >
                      <td colSpan={6} className="py-1.5 px-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isCollapsed ? (
                              <ChevronRight
                                size={13}
                                className="text-text-dim"
                              />
                            ) : (
                              <ChevronDown
                                size={13}
                                className="text-accent-green"
                              />
                            )}
                            <GroupIcon
                              size={13}
                              className={
                                group.isAgent
                                  ? "text-accent-purple"
                                  : "text-sky-400"
                              }
                            />
                            <span className="font-semibold text-text-main text-xs">
                              {group.label}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-bg-card border border-border-base text-text-muted">
                              {group.targets.length}{" "}
                              {group.targets.length === 1
                                ? "monitor"
                                : "monitores"}
                            </span>
                            {group.downCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400">
                                {group.downCount}{" "}
                                {group.downCount === 1 ? "caído" : "caídos"}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-text-dim">
                            {isCollapsed ? "Expandir" : "Colapsar"}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {!isCollapsed && group.targets.map(renderRow)}
                  </tbody>
                );
              })
            ) : (
              <tbody>{sortedTargets.map(renderRow)}</tbody>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
