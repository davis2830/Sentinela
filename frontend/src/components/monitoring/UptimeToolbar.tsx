import { useEffect, useRef, useState } from "react";
import {
  Search,
  X,
  LayoutGrid,
  List,
  SlidersHorizontal,
  RotateCcw,
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
}: UptimeToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!filtersOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setFiltersOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [filtersOpen]);

  const handleChipFilter = (filterKey: string) => {
    if (activeStatusFilter === filterKey) {
      onStatusFilterChange("all");
    } else {
      onStatusFilterChange(filterKey);
    }
  };

  const activeFiltersCount =
    (protocolFilter !== "all" ? 1 : 0) +
    (tagFilter !== "all" ? 1 : 0) +
    (groupBy !== "none" ? 1 : 0);

  const handleResetFilters = () => {
    onProtocolFilterChange("all");
    onTagFilterChange("all");
    onGroupByChange("none");
  };

  const uptimeValue =
    summary.uptime24h !== null ? parseFloat(summary.uptime24h) : null;
  const uptimeTextClass =
    uptimeValue === null
      ? "text-text-dim"
      : uptimeValue >= 99
        ? "text-emerald-400"
        : uptimeValue >= 95
          ? "text-amber-400"
          : "text-rose-400";
  const uptimeTooltip =
    uptimeValue === null
      ? "Sin comprobaciones registradas en las últimas 24 h (los huecos sin datos no cuentan como caída)"
      : summary.uptimePartial
        ? `Uptime ponderado sobre mediciones reales de las últimas 24 h (${summary.uptimeCoveragePct}% de cobertura). Los huecos sin datos no cuentan como caída.`
        : `Uptime ponderado 24 h (${summary.uptimeCoveragePct}% cobertura · ≥99% verde, ≥95% ámbar, <95% rojo)`;

  return (
    <div
      data-testid="monitoring-toolbar"
      className="w-full max-w-[1400px] mx-auto bg-bg-card border border-border-base rounded-2xl px-3 py-2 shadow-lg text-xs select-none"
    >
      {/* Strictly Single Row on Desktop */}
      <div className="flex items-center justify-between gap-2.5 flex-wrap md:flex-nowrap">
        {/* Left: Search + Status Chips + Compact Metrics */}
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto no-scrollbar">
          {/* Search Input */}
          <div className="relative w-[170px] sm:w-[210px] shrink-0">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim"
            />
            <input
              type="search"
              placeholder="Buscar nombre, URL..."
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

          <span
            aria-hidden="true"
            className="hidden sm:block h-4 w-px bg-border-base/80 shrink-0"
          />

          {/* Status Summary Chips */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleChipFilter("all")}
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap !min-h-0 !min-w-0 ${
                activeStatusFilter === "all"
                  ? "bg-zinc-700 text-white ring-1 ring-zinc-500"
                  : "bg-bg-dark border border-border-base text-text-dim hover:text-text-main"
              }`}
              title="Mostrar todos los monitores"
            >
              Todos ({summary.totalCount ?? visibleCount})
            </button>

            <button
              type="button"
              onClick={() => handleChipFilter("down")}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap !min-h-0 !min-w-0 ${
                activeStatusFilter === "down"
                  ? "bg-rose-500 text-white ring-2 ring-rose-500/40"
                  : summary.downCount > 0
                    ? "bg-rose-500/15 border border-rose-500/40 text-rose-400 hover:bg-rose-500/25"
                    : "bg-bg-dark border border-border-base text-text-dim hover:text-text-main"
              }`}
              title="Filtrar por servicios caídos"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  activeStatusFilter === "down"
                    ? "bg-white"
                    : summary.downCount > 0
                      ? "bg-rose-500 animate-pulse"
                      : "bg-text-dim"
                }`}
              />
              <span>
                {summary.downCount}{" "}
                {summary.downCount === 1 ? "caído" : "caídos"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleChipFilter("up")}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap !min-h-0 !min-w-0 ${
                activeStatusFilter === "up"
                  ? "bg-emerald-500 text-black ring-2 ring-emerald-500/40"
                  : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
              }`}
              title="Filtrar por servicios online"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  activeStatusFilter === "up" ? "bg-black" : "bg-emerald-400"
                }`}
              />
              <span>{summary.upCount} online</span>
            </button>

            {summary.slowCount > 0 && (
              <button
                type="button"
                onClick={() => handleChipFilter("slow")}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap !min-h-0 !min-w-0 ${
                  activeStatusFilter === "slow"
                    ? "bg-amber-500 text-black ring-2 ring-amber-500/40"
                    : "bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                }`}
                title="Filtrar por servicios lentos"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    activeStatusFilter === "slow" ? "bg-black" : "bg-amber-400"
                  }`}
                />
                <span>
                  {summary.slowCount}{" "}
                  {summary.slowCount === 1 ? "lento" : "lentos"}
                </span>
              </button>
            )}

            {summary.pausedCount > 0 && (
              <button
                type="button"
                onClick={() => handleChipFilter("disabled")}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap !min-h-0 !min-w-0 ${
                  activeStatusFilter === "disabled"
                    ? "bg-zinc-600 text-white ring-2 ring-zinc-500"
                    : "bg-zinc-800/50 border border-zinc-700/60 text-zinc-400 hover:text-zinc-200"
                }`}
                title="Filtrar por servicios pausados"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>
                  {summary.pausedCount}{" "}
                  {summary.pausedCount === 1 ? "pausado" : "pausados"}
                </span>
              </button>
            )}
          </div>

          {/* Compact Inline Metrics */}
          <div className="hidden lg:flex items-center gap-2 pl-2 ml-1 border-l border-border-base/80 font-mono text-[11px] text-text-dim whitespace-nowrap shrink-0">
            {summary.avgLatency !== null && (
              <span title="Promedio de latencia de los monitores online">
                <span className="hidden xl:inline">Latencia prom.</span>
                <span className="xl:hidden">Lat. prom.</span>{" "}
                <strong className="text-text-main">
                  {summary.avgLatency} ms
                </strong>
              </span>
            )}
            {summary.avgLatency !== null && <span aria-hidden="true">·</span>}
            <span title={uptimeTooltip}>
              Uptime{" "}
              <strong className={uptimeTextClass}>
                {summary.uptime24h !== null ? `${summary.uptime24h} %` : "—"}
              </strong>
              {summary.uptime24h !== null && summary.uptimePartial && (
                <span className="ml-1 text-[10px] text-text-dim font-normal">
                  (parcial)
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Right: Filtros Popover Button + View Mode Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Filtros Popover (Tipo, Tag, Agrupar, Densidad) */}
          <div ref={popoverRef} className="relative">
            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              aria-expanded={filtersOpen}
              aria-haspopup="dialog"
              className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer !min-h-0 !min-w-0 ${
                filtersOpen || activeFiltersCount > 0
                  ? "bg-accent-green/10 border-accent-green/50 text-accent-green"
                  : "bg-bg-dark border-border-base text-text-muted hover:text-text-main hover:bg-bg-card-hover"
              }`}
              title="Filtrar por tipo, etiqueta, agrupación y densidad"
            >
              <SlidersHorizontal size={12} className="shrink-0" />
              <span>Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-accent-green text-black font-mono text-[10px] font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {filtersOpen && (
              <div
                role="dialog"
                aria-label="Filtros y opciones de visualización"
                className="absolute right-0 top-9 z-40 w-72 rounded-2xl border border-border-accent/70 bg-bg-card p-3.5 shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="flex items-center justify-between border-b border-border-base/70 pb-2">
                  <span className="text-xs font-semibold text-text-main">
                    Filtros y vista
                  </span>
                  {activeFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-accent-green transition-colors cursor-pointer !min-h-0 !min-w-0"
                    >
                      <RotateCcw size={11} />
                      <span>Restablecer</span>
                    </button>
                  )}
                </div>

                {/* Tipo / Protocolo */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-text-muted">
                    Protocolo
                  </label>
                  <select
                    value={protocolFilter || "all"}
                    onChange={(e) => onProtocolFilterChange(e.target.value)}
                    aria-label="Filtrar por tipo o protocolo"
                    className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer"
                  >
                    <option value="all">Todos los protocolos</option>
                    <option value="https">HTTPS</option>
                    <option value="http">HTTP</option>
                    <option value="tcp">TCP</option>
                    <option value="dns">DNS</option>
                    <option value="api">API</option>
                    <option value="ssl">SSL</option>
                  </select>
                </div>

                {/* Tag */}
                {availableTags.length > 0 && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-text-muted">
                      Etiqueta (Tag)
                    </label>
                    <select
                      value={tagFilter || "all"}
                      onChange={(e) => onTagFilterChange(e.target.value)}
                      aria-label="Filtrar por etiqueta"
                      className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer"
                    >
                      <option value="all">Todas las etiquetas</option>
                      {availableTags.map((t) => (
                        <option key={t} value={t}>
                          #{t}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Agrupar por */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-text-muted">
                    Agrupar por
                  </label>
                  <select
                    value={groupBy}
                    onChange={(e) =>
                      onGroupByChange(e.target.value as TargetGroupBy)
                    }
                    aria-label="Agrupar monitores"
                    className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer"
                  >
                    <option value="none">Sin agrupar</option>
                    <option value="type">Protocolo</option>
                    <option value="tag">Etiqueta (Tag)</option>
                    <option value="senti9">Senti9 / Nube</option>
                  </select>
                </div>

                {/* Densidad */}
                <div className="space-y-1 pt-1 border-t border-border-base/70">
                  <span className="block text-[11px] font-medium text-text-muted">
                    Densidad
                  </span>
                  <div
                    className="grid grid-cols-2 gap-1 border border-border-base rounded-lg p-0.5 bg-bg-dark"
                    role="group"
                    aria-label="Selector de densidad"
                  >
                    <button
                      type="button"
                      onClick={() => onDensityChange("comfortable")}
                      className={`py-1 rounded-md text-[11px] transition-colors cursor-pointer !min-h-0 !min-w-0 ${
                        density === "comfortable"
                          ? "bg-accent-green/20 text-accent-green font-semibold"
                          : "text-text-dim hover:text-text-main"
                      }`}
                    >
                      Cómodo
                    </button>
                    <button
                      type="button"
                      onClick={() => onDensityChange("compact")}
                      className={`py-1 rounded-md text-[11px] transition-colors cursor-pointer !min-h-0 !min-w-0 ${
                        density === "compact"
                          ? "bg-accent-green/20 text-accent-green font-semibold"
                          : "text-text-dim hover:text-text-main"
                      }`}
                    >
                      Compacto
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* View Mode Switcher (Grid vs List) */}
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
              title="Pared de estado (Tarjetas)"
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
              title="Vista Lista (Principal)"
              aria-label="Vista Lista"
            >
              <List size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
