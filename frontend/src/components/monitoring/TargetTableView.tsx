import { useEffect, useState, useMemo } from "react";
import TargetLatency, {
  formatShortDiagnostic,
} from "./TargetLatency";
import { TargetEnabledSwitch } from "./TargetTableControls";
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
  Check,
  AlertTriangle,
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
  activeStatusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  protocolFilter?: string;
  onProtocolFilterChange?: (protocol: string) => void;
  tagFilter?: string;
  onTagFilterChange?: (tag: string) => void;
  availableTags?: string[];
  totalOrgSummary?: Record<string, number>;
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
  activeStatusFilter = "all",
  onStatusFilterChange,
  protocolFilter = "all",
  onProtocolFilterChange,
  tagFilter = "all",
  onTagFilterChange,
  availableTags = [],
  totalOrgSummary,
}: TargetTableViewProps) {
  const allSelected =
    targets.length > 0 && selectedIds.length === targets.length;
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );

  // Density: 'compact' (~40-44px) vs 'comfortable' (~64px)
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

  // Grouping: 'none' | 'senti9' | 'type'
  const [groupBy, setGroupBy] = useState<"none" | "senti9" | "type">("none");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
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

  // 2. Metrics summary & Uptime 24h
  const summary = useMemo(() => {
    const totalCount = totalOrgSummary?.total ?? targets.length;
    const downCount =
      totalOrgSummary?.down ??
      targets.filter(
        (t) => t.enabled && (t.last_status === "down" || t.last_status === "error"),
      ).length;
    const slowCount =
      totalOrgSummary?.slow ??
      targets.filter((t) => t.enabled && t.last_status === "slow").length;
    const upCount =
      totalOrgSummary?.up ??
      targets.filter((t) => t.enabled && t.last_status === "up").length;
    const pausedCount =
      totalOrgSummary?.paused ?? targets.filter((t) => !t.enabled).length;

    const activeLatencies = targets
      .filter((t) => t.enabled && typeof t.last_latency === "number" && t.last_latency >= 0)
      .map((t) => t.last_latency as number);
    const avgLatency = activeLatencies.length
      ? Math.round(activeLatencies.reduce((a, b) => a + b, 0) / activeLatencies.length)
      : null;

    // Calculate Uptime percentage from recent checks
    let totalChecks = 0;
    let upChecks = 0;
    for (const t of targets) {
      if (t.enabled && t.recent_checks?.length) {
        for (const c of t.recent_checks) {
          totalChecks++;
          if (c.status === "up") upChecks++;
        }
      }
    }
    const uptime24h = totalChecks > 0 ? ((upChecks / totalChecks) * 100).toFixed(1) : "100.0";

    return { totalCount, downCount, slowCount, upCount, pausedCount, avgLatency, uptime24h };
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
        const label = `Protocolo ${t.target_type.toUpperCase()}`;
        if (!groups[key]) {
          groups[key] = { label, isAgent: false, icon: typeIcons[t.target_type] || Globe, targets: [] };
        }
        groups[key].targets.push(t);
      }
    }
    return groups;
  }, [sortedTargets, groupBy]);

  const handleChipFilter = (filterKey: string) => {
    if (!onStatusFilterChange) return;
    if (activeStatusFilter === filterKey) {
      onStatusFilterChange("all");
    } else {
      onStatusFilterChange(filterKey);
    }
  };

  const renderStatus = (target: MonitoringTarget) => {
    if (!target.enabled) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
          Pausado
        </span>
      );
    }
    if (target.last_status === "up") {
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
    if (target.last_status === "slow") {
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
    if (target.last_status === "down" || target.last_status === "error") {
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
    const typeStyle = typeColors[target.target_type] || {
      bg: "bg-accent-green/10",
      text: "text-accent-green",
      border: "border-accent-green/30",
    };

    const recentChecks =
      target.recent_checks && target.recent_checks.length > 0
        ? target.recent_checks
        : Array.from({ length: 8 }).map(() => ({
            status: target.enabled ? (target.last_status || "unknown") : "disabled",
            latency: target.last_latency,
            checked_at: new Date().toISOString(),
            diagnostic: null as string | null,
          }));

    const isCompact = density === "compact";
    const paddingY = isCompact ? "py-2" : "py-3";
    const isDown = target.enabled && (target.last_status === "down" || target.last_status === "error");
    const isOnline = target.enabled && target.last_status === "up";

    const lastCheck = target.recent_checks?.length
      ? target.recent_checks[target.recent_checks.length - 1]
      : null;
    const fullDiagnostic = lastCheck?.diagnostic || (target.last_status === "slow" ? "Respuesta lenta registrada" : "Comprobación fallida");
    const shortDiagnostic = formatShortDiagnostic(fullDiagnostic, target.expected_status);

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
        className={`group cursor-pointer transition-colors border-b border-border-base/40 ${
          isSelected
            ? "bg-accent-green/5"
            : isDown
            ? "bg-rose-500/[0.04] border-l-2 border-l-rose-500 hover:bg-rose-500/[0.08]"
            : isOnline
            ? "opacity-85 hover:opacity-100 hover:bg-bg-dark/40"
            : "hover:bg-bg-dark/50"
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

        {/* 2. Estado (Fixed 100px width) */}
        <td className={`${paddingY} px-2.5 whitespace-nowrap w-[100px]`}>
          {renderStatus(target)}
        </td>

        {/* 3. Target & Endpoint - w-full max-w-0 absorbs excess space */}
        <td className={`${paddingY} px-3 w-full max-w-0`}>
          <div className="flex min-w-0 items-center gap-2">
            {/* Type Badge inline with fixed width */}
            <span
              className={`inline-block w-14 shrink-0 text-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border uppercase ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}
              title={`Protocolo ${target.target_type.toUpperCase()} • Intervalo: cada ${target.interval}s`}
            >
              {target.target_type}
            </span>

            {/* Target Name */}
            <span
              className={`shrink-0 font-semibold text-xs transition-colors ${
                isDown ? "text-rose-300 font-bold" : "text-text-main group-hover:text-accent-green"
              }`}
              title={target.name}
            >
              {target.name}
            </span>

            {/* Endpoint URL (Takes all remaining width, truncates cleanly) */}
            <span
              className="min-w-0 flex-1 truncate font-mono text-xs text-text-dim"
              title={target.endpoint}
            >
              {target.endpoint}
            </span>

            {/* Senti9 Agent Pill without 'Senti9:' */}
            {target.runner_type === "agent" && (
              <span
                className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${
                  target.agent_probe_online === false ||
                  target.agent_probe_status === "offline"
                    ? "bg-accent-red/10 text-accent-red border-accent-red/30"
                    : "bg-accent-purple/10 text-accent-purple border-accent-purple/30"
                }`}
                title={`Sondeado por Guardián Senti9: ${target.agent_probe_name || "LAN"}`}
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

            {/* In compact mode, show error inline at the end */}
            {isCompact && isDown && (
              <span
                title={fullDiagnostic}
                className="shrink-0 text-xs text-rose-300 font-mono inline-flex items-center gap-1"
              >
                <AlertTriangle size={12} className="text-rose-400 shrink-0" />
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

        {/* 4. Latencia (Single Line Clean, or downSince if down) */}
        <td className={`${paddingY} px-2.5 whitespace-nowrap w-[105px]`}>
          <TargetLatency target={target} compact={isCompact} />
        </td>

        {/* 5. Historial Reciente (8 Slim Bars with Rich Tooltip) */}
        <td className={`${paddingY} px-2.5 whitespace-nowrap w-[90px]`}>
          <div className="flex items-center gap-1 h-3 w-20">
            {recentChecks.slice(-8).map((c, idx) => {
              let bg = "bg-zinc-700";
              const isUp = c.status === "up";
              const isSlow = c.status === "slow";
              if (isUp) bg = "bg-emerald-500";
              else if (isSlow) bg = "bg-amber-400";
              else if (c.status === "down" || c.status === "error")
                bg = "bg-rose-500";

              const timeStr = c.checked_at
                ? new Date(c.checked_at).toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "Sin hora";
              const statusName = isUp
                ? "Online"
                : isSlow
                ? "Lento"
                : "Caído";
              const latStr =
                typeof c.latency === "number" && c.latency >= 0
                  ? `${c.latency} ms`
                  : "—";
              const tooltip = `${timeStr} • ${statusName} (${latStr})${
                c.diagnostic ? `\n${c.diagnostic}` : ""
              }`;

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
          className={`${paddingY} px-2.5 text-right whitespace-nowrap w-[110px] bg-inherit`}
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
      className="connectivity-directory-table min-w-0 max-w-full bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-xl font-sans"
    >
      {/* Interactive KPI Micro-Strip (Clickable to Filter) & Density / Grouping Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2 border-b border-border-base bg-bg-dark/70 text-xs select-none">
        {/* Left: Clickable Quick Filters */}
        <div className="flex items-center gap-2 text-text-muted flex-wrap">
          {/* Todos Filter Chip */}
          <button
            type="button"
            onClick={() => handleChipFilter("all")}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all cursor-pointer !min-h-0 !min-w-0 ${
              activeStatusFilter === "all"
                ? "bg-zinc-700 text-white ring-1 ring-zinc-500"
                : "bg-bg-dark border border-border-base text-text-dim hover:text-text-main"
            }`}
            title="Mostrar todos los monitores"
          >
            <span>Todos ({targets.length})</span>
          </button>

          {/* Down Filter Chip */}
          <button
            type="button"
            onClick={() => handleChipFilter("down")}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all cursor-pointer !min-h-0 !min-w-0 ${
              activeStatusFilter === "down"
                ? "bg-rose-500 text-white ring-2 ring-rose-500/50"
                : summary.downCount > 0
                ? "bg-rose-500/15 border border-rose-500/40 text-rose-400 hover:bg-rose-500/25"
                : "bg-bg-dark border border-border-base text-text-dim hover:text-text-main"
            }`}
            title="Filtrar por servicios caídos"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                summary.downCount > 0 ? "bg-rose-500 animate-pulse" : "bg-text-dim"
              }`}
            />
            <span>
              {summary.downCount} {summary.downCount === 1 ? "caído" : "caídos"}
            </span>
          </button>

          {/* Up Filter Chip */}
          <button
            type="button"
            onClick={() => handleChipFilter("up")}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all cursor-pointer !min-h-0 !min-w-0 ${
              activeStatusFilter === "up"
                ? "bg-emerald-500 text-black ring-2 ring-emerald-500/50"
                : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
            }`}
            title="Filtrar por servicios online"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>{summary.upCount} online</span>
          </button>

          {/* Slow Filter Chip (if any) */}
          {summary.slowCount > 0 && (
            <button
              type="button"
              onClick={() => handleChipFilter("slow")}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all cursor-pointer !min-h-0 !min-w-0 ${
                activeStatusFilter === "slow"
                  ? "bg-amber-500 text-black ring-2 ring-amber-500/50"
                  : "bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
              }`}
              title="Filtrar por servicios lentos"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>{summary.slowCount} lentos</span>
            </button>
          )}

          {/* Paused Filter Chip (if any) */}
          {summary.pausedCount > 0 && (
            <button
              type="button"
              onClick={() => handleChipFilter("disabled")}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all cursor-pointer !min-h-0 !min-w-0 ${
                activeStatusFilter === "disabled"
                  ? "bg-zinc-700 text-white ring-2 ring-zinc-500"
                  : "bg-zinc-800/40 border border-zinc-700/50 text-zinc-400 hover:text-zinc-200"
              }`}
              title="Filtrar por servicios pausados"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
              <span>{summary.pausedCount} pausados</span>
            </button>
          )}

          {/* Average Latency */}
          {summary.avgLatency !== null && (
            <span className="text-text-dim hidden md:inline font-mono">
              • Latencia prom:{" "}
              <strong className="text-text-main">
                {summary.avgLatency} ms
              </strong>
            </span>
          )}

          {/* 24h Uptime Badge with semantic color: ≥99% green, ≥95% amber, <95% red */}
          <span
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-mono font-bold hidden sm:inline-flex ${
              parseFloat(summary.uptime24h) >= 99
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : parseFloat(summary.uptime24h) >= 95
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-400"
            }`}
            title="Uptime ponderado 24h (≥99% verde, ≥95% ámbar, <95% rojo)"
          >
            Uptime 24h: {summary.uptime24h}%
          </span>
        </div>

        {/* Right: Tipo, Tag, Group By & Density Toggle */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Protocol / Tipo Selector */}
          {onProtocolFilterChange && (
            <div className="flex items-center gap-1 text-text-dim">
              <span className="hidden xl:inline text-[11px]">Tipo:</span>
              <select
                value={protocolFilter || "all"}
                onChange={(e) => onProtocolFilterChange(e.target.value)}
                aria-label="Filtrar por tipo o protocolo"
                className="bg-bg-dark border border-border-base rounded-lg px-2 py-0.5 text-xs text-text-main focus:border-accent-green cursor-pointer"
              >
                <option value="all">Tipo: Todos</option>
                <option value="https">HTTPS</option>
                <option value="http">HTTP</option>
                <option value="tcp">TCP</option>
                <option value="dns">DNS</option>
                <option value="api">API</option>
                <option value="ssl">SSL</option>
              </select>
            </div>
          )}

          {/* Tag Selector */}
          {onTagFilterChange && availableTags && availableTags.length > 0 && (
            <div className="flex items-center gap-1 text-text-dim">
              <span className="hidden xl:inline text-[11px]">Tag:</span>
              <select
                value={tagFilter || "all"}
                onChange={(e) => onTagFilterChange(e.target.value)}
                aria-label="Filtrar por etiqueta"
                className="bg-bg-dark border border-border-base rounded-lg px-2 py-0.5 text-xs text-text-main focus:border-accent-green cursor-pointer max-w-[120px]"
              >
                <option value="all">Tag: Todos</option>
                {availableTags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Group By selector */}
          <div className="flex items-center gap-1 text-text-dim">
            <span className="hidden xl:inline text-[11px]">Agrupar:</span>
            <select
              value={groupBy}
              onChange={(e) =>
                setGroupBy(e.target.value as "none" | "senti9" | "type")
              }
              aria-label="Agrupar monitores"
              className="bg-bg-dark border border-border-base rounded-lg px-2 py-0.5 text-xs text-text-main focus:border-accent-green cursor-pointer"
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
              className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer !min-h-0 !min-w-0 ${
                density === "compact"
                  ? "bg-accent-green/20 text-accent-green font-semibold"
                  : "text-text-dim hover:text-text-main"
              }`}
              title="Vista Compacta (~40-44px por fila)"
            >
              Compacto
            </button>
            <button
              type="button"
              onClick={() => handleDensityChange("comfortable")}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer !min-h-0 !min-w-0 ${
                density === "comfortable"
                  ? "bg-accent-green/20 text-accent-green font-semibold"
                  : "text-text-dim hover:text-text-main"
              }`}
              title="Vista Cómoda (espaciado holgado)"
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
            <thead>
              <tr className="border-b border-border-base bg-bg-dark/80 font-semibold text-text-dim select-none">
                <th scope="col" className="py-2 px-2.5 w-8 text-center">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={allSelected}
                    aria-label="Seleccionar todos los recursos"
                    title={allSelected ? "Deseleccionar todos" : "Seleccionar todos"}
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
                  className="py-2 px-2.5 cursor-pointer hover:text-text-main w-[100px]"
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
                  className="py-2 px-2.5 cursor-pointer hover:text-text-main w-[105px]"
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
                <th scope="col" className="py-2 px-2.5 text-right w-[110px] bg-inherit">
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
                        <td colSpan={6} className="py-1.5 px-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isCollapsed ? (
                                <ChevronRight size={13} className="text-text-dim" />
                              ) : (
                                <ChevronDown size={13} className="text-accent-green" />
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
                              <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-bg-card border border-border-base text-text-muted">
                                {group.targets.length}{" "}
                                {group.targets.length === 1
                                  ? "monitor"
                                  : "monitores"}
                              </span>
                              {groupDownCount > 0 && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400">
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
