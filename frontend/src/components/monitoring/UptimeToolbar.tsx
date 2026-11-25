import {
  Search,
  X,
  LayoutGrid,
  List,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PauseCircle,
} from "lucide-react";
import type {
  TargetDensity,
  TargetGroupBy,
  TargetSummaryMetrics,
} from "./useTargets";

interface UptimeToolbarProps {
  visibleCount: number;
  summary: TargetSummaryMetrics;
  activeStatusFilter: string;
  onStatusFilterChange: (status: string) => void;
  protocolFilter: string;
  onProtocolFilterChange: (protocol: string) => void;
  tagFilter: string;
  onTagFilterChange: (tag: string) => void;
  availableTags: string[];
  groupBy: TargetGroupBy;
  onGroupByChange: (groupBy: TargetGroupBy) => void;
  density: TargetDensity;
  onDensityChange: (density: TargetDensity) => void;
  search: string;
  onSearchChange: (value: string) => void;
  viewMode: "grid" | "table";
  onViewModeChange: (mode: "grid" | "table") => void;
  /** Optional className override for container styling (e.g., standalone card vs flush table header) */
  standalone?: boolean;
}

export default function UptimeToolbar({
  visibleCount,
  summary,
  activeStatusFilter,
  onStatusFilterChange,
  protocolFilter,
  onProtocolFilterChange,
  tagFilter,
  onTagFilterChange,
  availableTags,
  groupBy,
  onGroupByChange,
  density,
  onDensityChange,
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  standalone = true,
}: UptimeToolbarProps) {
  const handleChipFilter = (filterKey: string) => {
    if (activeStatusFilter === filterKey) {
      onStatusFilterChange("all");
    } else {
      onStatusFilterChange(filterKey);
    }
  };

  const uptimeValue = parseFloat(summary.uptime24h);
  const uptimeToneClass =
    uptimeValue >= 99
      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
      : uptimeValue >= 95
        ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
        : "bg-rose-500/10 border-rose-500/30 text-rose-400";

  return (
    <div
      data-testid="monitoring-toolbar"
      className={`flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2 text-xs select-none ${
        standalone
          ? "w-full max-w-[1400px] mx-auto bg-bg-card border border-border-base rounded-2xl shadow-lg"
          : "border-b border-border-base bg-bg-dark/70"
      }`}
    >
      {/* Left: Search Bar + Clickable Summary Filter Chips + Metrics */}
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        {/* Integrated Search Input */}
        <div className="relative min-w-[150px] max-w-[230px]">
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim"
          />
          <input
            type="search"
            placeholder="Buscar por nombre, URL..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Buscar monitores por nombre o URL"
            className="h-7 w-full rounded-lg border border-border-base bg-bg-dark pl-7 pr-6 text-xs text-text-main placeholder:text-text-dim focus:border-accent-green focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-text-dim hover:text-text-main cursor-pointer !min-h-0 !min-w-0"
              title="Limpiar búsqueda"
              aria-label="Limpiar búsqueda"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Todos Filter Chip */}
        <button
          type="button"
          onClick={() => handleChipFilter("all")}
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all cursor-pointer !min-h-0 !min-w-0 ${
            activeStatusFilter === "all"
              ? "bg-zinc-700 text-white ring-1 ring-zinc-500"
              : "bg-bg-dark border border-border-base text-text-dim hover:text-text-main"
          }`}
          title="Mostrar todos los monitores"
        >
          <span>Todos ({summary.totalCount ?? visibleCount})</span>
        </button>

        {/* Down Filter Chip */}
        <button
          type="button"
          onClick={() => handleChipFilter("down")}
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all cursor-pointer !min-h-0 !min-w-0 ${
            activeStatusFilter === "down"
              ? "bg-rose-500 text-white ring-2 ring-rose-500/50"
              : summary.downCount > 0
                ? "bg-rose-500/15 border border-rose-500/40 text-rose-400 hover:bg-rose-500/25"
                : "bg-bg-dark border border-border-base text-text-dim hover:text-text-main"
          }`}
          title="Filtrar por servicios caídos"
        >
          <XCircle
            size={11}
            className={
              activeStatusFilter === "down"
                ? "text-white shrink-0"
                : summary.downCount > 0
                  ? "text-rose-400 shrink-0"
                  : "text-text-dim shrink-0"
            }
          />
          <span>
            {summary.downCount} {summary.downCount === 1 ? "caído" : "caídos"}
          </span>
        </button>

        {/* Up Filter Chip */}
        <button
          type="button"
          onClick={() => handleChipFilter("up")}
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all cursor-pointer !min-h-0 !min-w-0 ${
            activeStatusFilter === "up"
              ? "bg-emerald-500 text-black ring-2 ring-emerald-500/50"
              : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
          }`}
          title="Filtrar por servicios online"
        >
          <CheckCircle2
            size={11}
            className={
              activeStatusFilter === "up"
                ? "text-black shrink-0"
                : "text-emerald-400 shrink-0"
            }
          />
          <span>{summary.upCount} online</span>
        </button>

        {/* Slow Filter Chip (if any) */}
        {summary.slowCount > 0 && (
          <button
            type="button"
            onClick={() => handleChipFilter("slow")}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all cursor-pointer !min-h-0 !min-w-0 ${
              activeStatusFilter === "slow"
                ? "bg-amber-500 text-black ring-2 ring-amber-500/50"
                : "bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
            }`}
            title="Filtrar por servicios lentos"
          >
            <AlertTriangle
              size={11}
              className={
                activeStatusFilter === "slow"
                  ? "text-black shrink-0"
                  : "text-amber-400 shrink-0"
              }
            />
            <span>
              {summary.slowCount} {summary.slowCount === 1 ? "lento" : "lentos"}
            </span>
          </button>
        )}

        {/* Paused Filter Chip (if any) */}
        {summary.pausedCount > 0 && (
          <button
            type="button"
            onClick={() => handleChipFilter("disabled")}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all cursor-pointer !min-h-0 !min-w-0 ${
              activeStatusFilter === "disabled"
                ? "bg-zinc-600 text-white ring-2 ring-zinc-500"
                : "bg-zinc-800/50 border border-zinc-700/60 text-zinc-400 hover:text-zinc-200"
            }`}
            title="Filtrar por servicios pausados"
          >
            <PauseCircle size={11} className="shrink-0" />
            <span>
              {summary.pausedCount}{" "}
              {summary.pausedCount === 1 ? "pausado" : "pausados"}
            </span>
          </button>
        )}

        {/* Average Latency */}
        {summary.avgLatency !== null && (
          <span className="text-text-dim hidden md:inline font-mono text-[11px]">
            · Lat. prom:{" "}
            <strong className="text-text-main">{summary.avgLatency} ms</strong>
          </span>
        )}

        {/* 24h Uptime Badge with semantic color */}
        <span
          className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-mono font-bold ${uptimeToneClass}`}
          title="Uptime ponderado 24 h (≥99% verde, ≥95% ámbar, <95% rojo)"
        >
          Uptime 24h: {summary.uptime24h}%
        </span>
      </div>

      {/* Right: Protocol, Tag, Group By, Density & View Mode Switcher */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Protocol / Tipo Selector */}
        <select
          value={protocolFilter || "all"}
          onChange={(e) => onProtocolFilterChange(e.target.value)}
          aria-label="Filtrar por tipo o protocolo"
          className="bg-bg-dark border border-border-base rounded-lg px-2 py-0.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer h-7"
        >
          <option value="all">Tipo: Todos</option>
          <option value="https">HTTPS</option>
          <option value="http">HTTP</option>
          <option value="tcp">TCP</option>
          <option value="dns">DNS</option>
          <option value="api">API</option>
          <option value="ssl">SSL</option>
        </select>

        {/* Tag Selector */}
        {availableTags.length > 0 && (
          <select
            value={tagFilter || "all"}
            onChange={(e) => onTagFilterChange(e.target.value)}
            aria-label="Filtrar por etiqueta"
            className="bg-bg-dark border border-border-base rounded-lg px-2 py-0.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer max-w-[120px] h-7"
          >
            <option value="all">Tag: Todos</option>
            {availableTags.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </select>
        )}

        {/* Group By selector */}
        <select
          value={groupBy}
          onChange={(e) => onGroupByChange(e.target.value as TargetGroupBy)}
          aria-label="Agrupar monitores"
          className="bg-bg-dark border border-border-base rounded-lg px-2 py-0.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer h-7"
        >
          <option value="none">Sin agrupar</option>
          <option value="type">Agrupar: Protocolo</option>
          <option value="tag">Agrupar: Etiqueta</option>
          <option value="senti9">Agrupar: Senti9 / Nube</option>
        </select>

        {/* Density toggle buttons (shared by both Table and Card views) */}
        <div
          className="flex items-center border border-border-base rounded-lg p-0.5 bg-bg-dark shrink-0 h-7"
          role="group"
          aria-label="Selector de densidad"
        >
          <button
            type="button"
            onClick={() => onDensityChange("compact")}
            className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer !min-h-0 !min-w-0 ${
              density === "compact"
                ? "bg-accent-green/20 text-accent-green font-semibold"
                : "text-text-dim hover:text-text-main"
            }`}
            title={
              viewMode === "grid"
                ? "Tarjetas compactas (~220 px · pared de estado)"
                : "Filas compactas (~42 px)"
            }
          >
            Compacto
          </button>
          <button
            type="button"
            onClick={() => onDensityChange("comfortable")}
            className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer !min-h-0 !min-w-0 ${
              density === "comfortable"
                ? "bg-accent-green/20 text-accent-green font-semibold"
                : "text-text-dim hover:text-text-main"
            }`}
            title={
              viewMode === "grid"
                ? "Tarjetas cómodas con URL, uptime y 20 barras"
                : "Filas cómodas con diagnóstico expandido"
            }
          >
            Cómodo
          </button>
        </div>

        {/* View Mode Switcher (Grid vs Table) */}
        <div
          className="flex items-center border border-border-base rounded-lg p-0.5 bg-bg-dark shrink-0 h-7"
          role="group"
          aria-label="Cambiar vista"
        >
          <button
            type="button"
            onClick={() => onViewModeChange("grid")}
            className={`p-1 rounded transition-colors cursor-pointer !min-h-0 !min-w-0 ${
              viewMode === "grid"
                ? "bg-accent-green text-bg-dark"
                : "text-text-dim hover:text-text-main"
            }`}
            title="Vista Tarjetas"
            aria-label="Vista Tarjetas"
          >
            <LayoutGrid size={13} />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("table")}
            className={`p-1 rounded transition-colors cursor-pointer !min-h-0 !min-w-0 ${
              viewMode === "table"
                ? "bg-accent-green text-bg-dark"
                : "text-text-dim hover:text-text-main"
            }`}
            title="Vista Lista"
            aria-label="Vista Lista"
          >
            <List size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
