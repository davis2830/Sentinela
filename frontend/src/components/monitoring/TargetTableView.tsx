import { useEffect, useState, useMemo } from "react";
import SelectionCheckbox from "../common/SelectionCheckbox";
import TargetLatency, { TargetDiagnostic } from "./TargetLatency";
import {
  TargetEnabledSwitch,
  TargetSelectionCheckbox,
} from "./TargetTableControls";
import {
  Globe,
  Server,
  Plug,
  Lock,
  Bell,
  Pencil,
  Trash2,
  ArrowUpDown,
  Layers,
  ChevronDown,
  ChevronRight,
  Cloud,
} from "lucide-react";
import type { MonitoringTarget } from "../../types/monitoring";

const typeIcons: Record<string, typeof Globe> = {
  http: Globe,
  https: Globe,
  tcp: Server,
  dns: Globe,
  api: Plug,
  ssl: Lock,
};

const typeColors: Record<string, { bg: string; text: string; border: string }> =
  {
    https: {
      bg: "bg-sky-500/10",
      text: "text-sky-400",
      border: "border-sky-500/30",
    },
    http: {
      bg: "bg-blue-500/10",
      text: "text-blue-400",
      border: "border-blue-500/30",
    },
    tcp: {
      bg: "bg-purple-500/10",
      text: "text-purple-400",
      border: "border-purple-500/30",
    },
    dns: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/30",
    },
    api: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/30",
    },
    ssl: {
      bg: "bg-rose-500/10",
      text: "text-rose-400",
      border: "border-rose-500/30",
    },
  };

interface TargetTableViewProps {
  targets: MonitoringTarget[];
  selectedIds: string[];
  onSelectToggle: (target: MonitoringTarget) => void;
  onSelectAllToggle: () => void;
  onEdit: (target: MonitoringTarget) => void;
  onDelete: (target: MonitoringTarget) => void;
  onScan: (target: MonitoringTarget) => void;
  onToggle: (target: MonitoringTarget) => void;
  onAlert?: (target: MonitoringTarget) => void;
  scanningId: string | null;
  onClick: (target: MonitoringTarget) => void;
  sortField: "name" | "latency" | "status";
  sortAsc: boolean;
  onSortChange: (field: "name" | "latency" | "status") => void;
}

export default function TargetTableView({
  targets,
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
    targets.length > 0 && selectedIds.length === targets.length;
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 767px)").matches,
  );

  // Density mode: 'compact' (~44px row) vs 'comfortable' (~64px row)
  const [density, setDensity] = useState<"compact" | "comfortable">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sentinel_monitoring_density");
      if (saved === "comfortable" || saved === "compact") return saved;
    }
    return "compact";
  });

  const handleDensityChange = (d: "compact" | "comfortable") => {
    setDensity(d);
    localStorage.setItem("sentinel_monitoring_density", d);
  };

  // Grouping mode: 'none' | 'senti9' | 'type'
  const [groupBy, setGroupBy] = useState<"none" | "senti9" | "type">("none");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  // 1. Sort targets: Down/Error first by default when sorting by status
  const sortedTargets = useMemo(() => {
    const list = [...targets];
    const statusPriority: Record<string, number> = {
      down: 0,
      error: 0,
      slow: 1,
      unknown: 2,
      up: 3,
      disabled: 4,
    };

    list.sort((a, b) => {
      if (sortField === "status") {
        const aWeight = a.enabled
          ? (statusPriority[a.last_status || "unknown"] ?? 2)
          : 4;
        const bWeight = b.enabled
          ? (statusPriority[b.last_status || "unknown"] ?? 2)
          : 4;
        if (aWeight !== bWeight) {
          return sortAsc ? aWeight - bWeight : bWeight - aWeight;
        }
        return a.name.localeCompare(b.name);
      }
      if (sortField === "name") {
        return sortAsc
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      if (sortField === "latency") {
        const aLat = a.last_latency ?? -1;
        const bLat = b.last_latency ?? -1;
        return sortAsc ? aLat - bLat : bLat - aLat;
      }
      return 0;
    });
    return list;
  }, [targets, sortField, sortAsc]);

  // 2. Metrics summary
  const summary = useMemo(() => {
    const downCount = targets.filter(
      (t) => t.enabled && (t.last_status === "down" || t.last_status === "error"),
    ).length;
    const slowCount = targets.filter((t) => t.enabled && t.last_status === "slow").length;
    const upCount = targets.filter((t) => t.enabled && t.last_status === "up").length;
    const activeLatencies = targets
      .filter((t) => t.enabled && typeof t.last_latency === "number" && t.last_latency >= 0)
      .map((t) => t.last_latency as number);
    const avgLatency = activeLatencies.length
      ? Math.round(activeLatencies.reduce((a, b) => a + b, 0) / activeLatencies.length)
      : null;

    return { downCount, slowCount, upCount, avgLatency };
  }, [targets]);

  // 3. Group targets if requested
  const groupedTargets = useMemo(() => {
    if (groupBy === "none") return null;
    const groups: Record<
      string,
      { label: string; isAgent: boolean; icon: typeof Server; targets: MonitoringTarget[] }
    > = {};

    for (const t of sortedTargets) {
      if (groupBy === "senti9") {
        const isAgent = t.runner_type === "agent";
        const key = isAgent ? t.agent_probe_name || "Senti9 LAN" : "cloud";
        const label = isAgent
          ? `Guardián Senti9: ${t.agent_probe_name || "LAN"}`
          : "Monitoreo Nube Directa";
        if (!groups[key]) {
          groups[key] = { label, isAgent, icon: isAgent ? Server : Cloud, targets: [] };
        }
        groups[key].targets.push(t);
      } else if (groupBy === "type") {
        const key = t.target_type;
        const label = `Tipo: ${t.target_type.toUpperCase()}`;
        if (!groups[key]) {
          groups[key] = { label, isAgent: false, icon: typeIcons[t.target_type] || Globe, targets: [] };
        }
        groups[key].targets.push(t);
      }
    }
    return groups;
  }, [sortedTargets, groupBy]);

  const renderStatus = (target: MonitoringTarget) => {
    if (!target.enabled) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
          Pausado
        </span>
      );
    }
    if (target.last_status === "up") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          Online
        </span>
      );
    }
    if (target.last_status === "slow") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
          </span>
          Lento
        </span>
      );
    }
    if (target.last_status === "down" || target.last_status === "error") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30 shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
          </span>
          Caído
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
        Desconocido
      </span>
    );
  };

  const renderRow = (target: MonitoringTarget) => {
    const isSelected = selectedIds.includes(target.id);
    const Icon = typeIcons[target.target_type] || Globe;
    const typeStyle = typeColors[target.target_type] || {
      bg: "bg-accent-green/10",
      text: "text-accent-green",
      border: "border-accent-green/30",
    };

    const recentChecks =
      target.recent_checks && target.recent_checks.length > 0
        ? target.recent_checks
        : Array.from({ length: 8 }).map(() => ({
            status: target.enabled ? target.last_status || "unknown" : "disabled",
            latency: target.last_latency,
          }));

    const isCompact = density === "compact";
    const paddingY = isCompact ? "py-2" : "py-3.5";

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
        className={`group hover:bg-bg-dark/50 cursor-pointer transition-colors border-b border-border-base/40 ${
          isSelected ? "bg-accent-green/5" : ""
        }`}
      >
        {/* 1. Selection Checkbox */}
        <td
          className={`${paddingY} px-3 w-10 text-center`}
          onClick={(e) => e.stopPropagation()}
        >
          <TargetSelectionCheckbox
            checked={isSelected}
            label={`Seleccionar ${target.name}`}
            onChange={() => onSelectToggle(target)}
          />
        </td>

        {/* 2. Estado + Error Diagnostic Badge */}
        <td className={`${paddingY} px-3 whitespace-nowrap`}>
          <div className="flex items-center gap-2">
            {renderStatus(target)}
            {target.enabled &&
              ["down", "error", "slow"].includes(target.last_status || "") && (
                <TargetDiagnostic target={target} compact />
              )}
          </div>
        </td>

        {/* 3. Target Name + Endpoint (Single Line) */}
        <td className={`${paddingY} px-3 min-w-0 max-w-[380px]`}>
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-6 h-6 rounded-md ${typeStyle.bg} border ${typeStyle.border} flex items-center justify-center shrink-0`}
            >
              <Icon className={typeStyle.text} size={13} />
            </div>
            <span
              className="font-semibold text-text-main text-xs truncate max-w-[160px] group-hover:text-accent-green transition-colors"
              title={target.name}
            >
              {target.name}
            </span>
            <span
              className="text-[11px] text-text-dim font-mono truncate max-w-[180px]"
              title={target.endpoint}
            >
              {target.endpoint}
            </span>

            {/* Senti9 Agent Pill */}
            {target.runner_type === "agent" && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${
                  target.agent_probe_online === false ||
                  target.agent_probe_status === "offline"
                    ? "bg-accent-red/10 text-accent-red border-accent-red/30"
                    : "bg-accent-purple/10 text-accent-purple border-accent-purple/30"
                }`}
                title={`Sondeado por Senti9: ${target.agent_probe_name || "LAN"}`}
              >
                <Server size={8} className="shrink-0" />
                <span className="truncate max-w-[70px]">
                  {target.agent_probe_name || "LAN"}
                </span>
              </span>
            )}

            {/* Team Pill */}
            {target.owner_team_name && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0"
                style={{
                  backgroundColor: `${target.owner_team_color || "#8B5CF6"}15`,
                  borderColor: `${target.owner_team_color || "#8B5CF6"}40`,
                  color: target.owner_team_color || "#A78BFA",
                }}
              >
                <Layers size={8} className="shrink-0" />
                <span className="truncate max-w-[60px]">
                  {target.owner_team_name}
                </span>
              </span>
            )}
          </div>
        </td>

        {/* 4. Tipo + Interval Tooltip */}
        <td className={`${paddingY} px-3 whitespace-nowrap`}>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}
            title={`Protocolo ${target.target_type.toUpperCase()} • Intervalo: cada ${target.interval}s`}
          >
            {target.target_type.toUpperCase()}
          </span>
        </td>

        {/* 5. Latencia (Single Line) */}
        <td className={`${paddingY} px-3 whitespace-nowrap`}>
          <TargetLatency target={target} compact />
        </td>

        {/* 6. Historial Reciente (8 Slim Bars) */}
        <td className={`${paddingY} px-3 whitespace-nowrap`}>
          <div
            className="flex items-center gap-1 h-3 w-20"
            title="Historial de los últimos chequeos"
          >
            {recentChecks.slice(-8).map((c, idx) => {
              let bg = "bg-zinc-700";
              if (c.status === "up") bg = "bg-emerald-500";
              else if (c.status === "slow") bg = "bg-amber-400";
              else if (c.status === "down" || c.status === "error")
                bg = "bg-rose-500";
              return (
                <div
                  key={idx}
                  className={`flex-1 h-full rounded-xs transition-transform hover:scale-125 ${bg}`}
                />
              );
            })}
          </div>
        </td>

        {/* 7. Acciones Compactas (Hover + Toggle) */}
        <td
          className={`${paddingY} px-3 text-right whitespace-nowrap`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-end gap-1.5">
            {/* Action buttons visible on row hover */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onAlert && (
                <button
                  type="button"
                  onClick={() => onAlert(target)}
                  title="Vincular regla de alerta"
                  className="p-1 rounded text-text-dim hover:text-accent-yellow hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <Bell size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={() => onEdit(target)}
                title="Editar target"
                className="p-1 rounded text-text-dim hover:text-accent-green hover:bg-white/5 transition-colors cursor-pointer"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(target)}
                title="Eliminar target"
                className="p-1 rounded text-text-dim hover:text-accent-red hover:bg-white/5 transition-colors cursor-pointer"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <TargetEnabledSwitch
              enabled={target.enabled}
              onChange={() => onToggle(target)}
            />
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div
      data-testid="connectivity-table"
      className="connectivity-directory-table min-w-0 max-w-full bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-xl font-sans"
    >
      {/* KPI Micro-Strip & Density / Grouping Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-border-base bg-bg-dark/60 text-xs">
        {/* Left: Quick Health Summary */}
        <div className="flex items-center gap-3 text-text-muted flex-wrap">
          {summary.downCount > 0 ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              {summary.downCount} {summary.downCount === 1 ? "caído" : "caídos"}
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              0 caídos
            </span>
          )}

          <span className="flex items-center gap-1 text-text-dim">
            <span className="text-emerald-400 font-semibold font-mono">
              {summary.upCount}
            </span>{" "}
            online
          </span>

          {summary.slowCount > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <span className="font-semibold font-mono">{summary.slowCount}</span>{" "}
              lentos
            </span>
          )}

          {summary.avgLatency !== null && (
            <span className="text-text-dim hidden sm:inline">
              • Latencia prom:{" "}
              <strong className="text-text-main font-mono">
                {summary.avgLatency} ms
              </strong>
            </span>
          )}
        </div>

        {/* Right: Group By & Density Toggle */}
        <div className="flex items-center gap-3">
          {/* Group By selector */}
          <div className="flex items-center gap-1.5 text-text-dim">
            <span className="hidden md:inline">Agrupar:</span>
            <select
              value={groupBy}
              onChange={(e) =>
                setGroupBy(e.target.value as "none" | "senti9" | "type")
              }
              aria-label="Agrupar monitores"
              className="bg-bg-dark border border-border-base rounded-lg px-2.5 py-1 text-xs text-text-main focus:border-accent-green cursor-pointer"
            >
              <option value="none">Sin agrupar</option>
              <option value="senti9">Por Senti9 / Nube</option>
              <option value="type">Por Protocolo</option>
            </select>
          </div>

          {/* Density toggle buttons */}
          <div
            className="flex items-center border border-border-base rounded-lg p-0.5 bg-bg-dark shrink-0"
            role="group"
            aria-label="Selector de densidad de filas"
          >
            <button
              type="button"
              onClick={() => handleDensityChange("compact")}
              className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                density === "compact"
                  ? "bg-accent-green/20 text-accent-green font-semibold"
                  : "text-text-dim hover:text-text-main"
              }`}
              title="Vista Compacta (~44px por fila de alta densidad)"
            >
              Compacto
            </button>
            <button
              type="button"
              onClick={() => handleDensityChange("comfortable")}
              className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                density === "comfortable"
                  ? "bg-accent-green/20 text-accent-green font-semibold"
                  : "text-text-dim hover:text-text-main"
              }`}
              title="Vista Cómoda (espaciado estándar)"
            >
              Cómodo
            </button>
          </div>
        </div>
      </div>

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
              <SelectionCheckbox
                checked={allSelected}
                label="Seleccionar todos los recursos"
                onChange={onSelectAllToggle}
              />
              <label className="text-xs text-text-muted">
                Ordenar por
                <select
                  aria-label="Ordenar targets"
                  className="ml-2 bg-bg-dark border border-border-base rounded-lg p-1.5 text-xs text-text-main"
                  value={sortField}
                  onChange={(e) =>
                    onSortChange(
                      e.target.value as "name" | "latency" | "status",
                    )
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
            <article key={target.id} className="min-w-0 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <SelectionCheckbox
                  checked={selectedIds.includes(target.id)}
                  label={`Seleccionar ${target.name}`}
                  onChange={() => onSelectToggle(target)}
                />
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
                />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="w-full">
          <table className="w-full text-left text-xs text-text-main border-collapse">
            <thead>
              <tr className="border-b border-border-base bg-bg-dark/80 font-semibold text-text-dim">
                <th scope="col" className="py-2.5 px-3 w-10 text-center">
                  <TargetSelectionCheckbox
                    checked={allSelected}
                    label="Seleccionar todos los recursos"
                    onChange={onSelectAllToggle}
                  />
                </th>
                <th
                  scope="col"
                  className="py-2.5 px-3 cursor-pointer hover:text-text-main w-[160px]"
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
                  className="py-2.5 px-3 cursor-pointer hover:text-text-main min-w-[240px]"
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
                <th scope="col" className="py-2.5 px-3 w-[70px]">
                  Tipo
                </th>
                <th
                  scope="col"
                  className="py-2.5 px-3 cursor-pointer hover:text-text-main w-[85px]"
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
                <th scope="col" className="py-2.5 px-3 w-[95px]">
                  Historial (8)
                </th>
                <th scope="col" className="py-2.5 px-3 text-right w-[110px]">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {groupedTargets ? (
                Object.entries(groupedTargets).map(([key, group]) => {
                  const isCollapsed = collapsedGroups[key];
                  const GroupIcon = group.icon;
                  const groupDownCount = group.targets.filter(
                    (t) =>
                      t.enabled &&
                      (t.last_status === "down" || t.last_status === "error"),
                  ).length;

                  return (
                    <tbody key={key} className="border-b border-border-base/50">
                      {/* Collapsible Group Header Row */}
                      <tr
                        onClick={() => toggleGroup(key)}
                        className="bg-bg-dark/70 hover:bg-bg-dark cursor-pointer transition-colors border-y border-border-base/60 select-none"
                      >
                        <td colSpan={7} className="py-2 px-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isCollapsed ? (
                                <ChevronRight size={14} className="text-text-dim" />
                              ) : (
                                <ChevronDown size={14} className="text-accent-green" />
                              )}
                              <GroupIcon
                                size={14}
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
                              {groupDownCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400">
                                  {groupDownCount} caído
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
                sortedTargets.map(renderRow)
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
