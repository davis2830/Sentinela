import { useEffect, useRef, useState } from "react";
import {
  Search,
  X,
  LayoutGrid,
  List,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";
import {
  GUARDIAN_QUEUE_WARN_THRESHOLD,
  type GuardianDensity,
  type GuardianGroupBy,
  type GuardianSignalRange,
  type GuardianSummaryMetrics,
} from "./useGuardians";

interface Senti9ToolbarProps {
  summary: GuardianSummaryMetrics;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  platformFilter: string;
  onPlatformFilterChange: (value: string) => void;
  versionFilter: string;
  onVersionFilterChange: (value: string) => void;
  availableVersions: string[];
  signalRangeFilter: GuardianSignalRange;
  onSignalRangeFilterChange: (value: GuardianSignalRange) => void;
  groupBy: GuardianGroupBy;
  onGroupByChange: (value: GuardianGroupBy) => void;
  density: GuardianDensity;
  onDensityChange: (value: GuardianDensity) => void;
  search: string;
  onSearchChange: (value: string) => void;
  viewMode: "grid" | "table";
  onViewModeChange: (value: "grid" | "table") => void;
}

export default function Senti9Toolbar({
  summary,
  statusFilter,
  onStatusFilterChange,
  platformFilter,
  onPlatformFilterChange,
  versionFilter,
  onVersionFilterChange,
  availableVersions,
  signalRangeFilter,
  onSignalRangeFilterChange,
  groupBy,
  onGroupByChange,
  density,
  onDensityChange,
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
}: Senti9ToolbarProps) {
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

  const toggleChip = (key: string) => {
    onStatusFilterChange(statusFilter === key ? "all" : key);
  };

  const activeFiltersCount =
    (platformFilter !== "all" ? 1 : 0) +
    (versionFilter !== "all" ? 1 : 0) +
    (signalRangeFilter !== "all" ? 1 : 0) +
    (groupBy !== "none" ? 1 : 0);

  const handleResetFilters = () => {
    onPlatformFilterChange("all");
    onVersionFilterChange("all");
    onSignalRangeFilterChange("all");
    onGroupByChange("none");
  };

  const queueWarn = summary.totalQueue >= GUARDIAN_QUEUE_WARN_THRESHOLD;

  return (
    <div
      data-testid="senti9-toolbar"
      className="w-full max-w-[1400px] mx-auto bg-bg-card border border-border-base rounded-2xl px-3 py-2 shadow-lg text-xs select-none"
    >
      {/* Strictly Single Row on Desktop */}
      <div className="flex items-center justify-between gap-2.5 flex-wrap md:flex-nowrap">
        {/* Left: Search + Clickable Status Chips + Queue Metric */}
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto no-scrollbar">
          {/* Search Input */}
          <div className="relative w-[170px] sm:w-[210px] shrink-0">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim"
            />
            <input
              type="search"
              placeholder="Buscar guardián..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Buscar guardián por nombre, host, IP o versión"
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

          {/* Clickable Status Chips (0-count chips stay muted gray; clicking active chip resets filter) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => toggleChip("connected")}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap !min-h-0 !min-w-0 ${
                statusFilter === "connected"
                  ? "bg-emerald-500 text-black ring-2 ring-emerald-500/40"
                  : summary.connectedCount > 0
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                    : "bg-bg-dark border border-border-base text-text-dim hover:text-text-main"
              }`}
              title="Filtrar por guardianes conectados"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  statusFilter === "connected"
                    ? "bg-black"
                    : summary.connectedCount > 0
                      ? "bg-emerald-400"
                      : "bg-slate-600"
                }`}
              />
              <span>
                {summary.connectedCount}{" "}
                {summary.connectedCount === 1 ? "conectado" : "conectados"}
              </span>
            </button>

            {summary.staleCount > 0 && (
              <button
                type="button"
                onClick={() => toggleChip("stale_signal")}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap !min-h-0 !min-w-0 ${
                  statusFilter === "stale_signal"
                    ? "bg-amber-500 text-black ring-2 ring-amber-500/40"
                    : "bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500/25"
                }`}
                title="Filtrar por guardianes sin señal reciente (2 a 5 intervalos)"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    statusFilter === "stale_signal"
                      ? "bg-black"
                      : "bg-amber-400 animate-pulse"
                  }`}
                />
                <span>{summary.staleCount} sin señal</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => toggleChip("disconnected")}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap !min-h-0 !min-w-0 ${
                statusFilter === "disconnected"
                  ? "bg-rose-500 text-white ring-2 ring-rose-500/40"
                  : summary.disconnectedCount > 0
                    ? "bg-rose-500/15 border border-rose-500/40 text-rose-400 hover:bg-rose-500/25"
                    : "bg-bg-dark border border-border-base text-text-dim hover:text-text-main"
              }`}
              title="Filtrar por guardianes desconectados"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  statusFilter === "disconnected"
                    ? "bg-white"
                    : summary.disconnectedCount > 0
                      ? "bg-rose-500 animate-pulse"
                      : "bg-slate-600"
                }`}
              />
              <span>
                {summary.disconnectedCount}{" "}
                {summary.disconnectedCount === 1
                  ? "desconectado"
                  : "desconectados"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => toggleChip("pending")}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap !min-h-0 !min-w-0 ${
                statusFilter === "pending"
                  ? "bg-amber-500 text-black ring-2 ring-amber-500/40"
                  : summary.pendingCount > 0
                    ? "bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                    : "bg-bg-dark border border-border-base text-text-dim hover:text-text-main"
              }`}
              title="Filtrar por guardianes esperando primera señal"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  statusFilter === "pending"
                    ? "bg-black"
                    : summary.pendingCount > 0
                      ? "bg-amber-400"
                      : "bg-slate-600"
                }`}
              />
              <span>{summary.pendingCount} esperando</span>
            </button>

            <button
              type="button"
              onClick={() => toggleChip("revoked")}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap !min-h-0 !min-w-0 ${
                statusFilter === "revoked"
                  ? "bg-zinc-600 text-white ring-2 ring-zinc-500"
                  : "bg-bg-dark border border-border-base text-text-dim hover:text-text-main"
              }`}
              title="Filtrar por guardianes revocados"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
              <span>
                {summary.revokedCount}{" "}
                {summary.revokedCount === 1 ? "revocado" : "revocados"}
              </span>
            </button>
          </div>

          {/* Inline Queue Metric */}
          <div className="hidden lg:flex items-center gap-2 pl-2 ml-1 border-l border-border-base/80 font-mono text-[11px] text-text-dim whitespace-nowrap shrink-0">
            <span title="Mediciones pendientes de enviar a Sentinel en todos los guardianes activos">
              Cola total{" "}
              <strong
                className={queueWarn ? "text-amber-400" : "text-text-main"}
              >
                {summary.totalQueue}
              </strong>
            </span>
            {summary.impactedMonitors > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span
                  className="text-rose-400 font-semibold"
                  title="Monitores LAN activos cuyo guardián no está enviando señal"
                >
                  {summary.impactedMonitors}{" "}
                  {summary.impactedMonitors === 1
                    ? "monitor afectado"
                    : "monitores afectados"}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Filtros Popover + View Switcher */}
        <div className="flex items-center gap-2 shrink-0">
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
              title="Filtrar por plataforma, versión, última señal, agrupación y densidad"
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
                aria-label="Filtros de guardianes Senti9"
                className="absolute right-0 top-9 z-40 w-72 rounded-2xl border border-border-base bg-bg-card/98 backdrop-blur-md p-3.5 shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-100"
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

                {/* Plataforma */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-text-muted">
                    Plataforma
                  </label>
                  <select
                    value={platformFilter}
                    onChange={(e) => onPlatformFilterChange(e.target.value)}
                    aria-label="Filtrar por plataforma"
                    className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer"
                  >
                    <option value="all">Todas las plataformas</option>
                    <option value="linux">Linux</option>
                    <option value="windows">Windows</option>
                  </select>
                </div>

                {/* Versión */}
                {availableVersions.length > 0 && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-text-muted">
                      Versión
                    </label>
                    <select
                      value={versionFilter}
                      onChange={(e) => onVersionFilterChange(e.target.value)}
                      aria-label="Filtrar por versión"
                      className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main font-mono focus:border-accent-green focus:outline-none cursor-pointer"
                    >
                      <option value="all">Todas las versiones</option>
                      {availableVersions.map((v) => (
                        <option key={v} value={v}>
                          v{v}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Rango de última señal */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-text-muted">
                    Última señal
                  </label>
                  <select
                    value={signalRangeFilter}
                    onChange={(e) =>
                      onSignalRangeFilterChange(
                        e.target.value as GuardianSignalRange,
                      )
                    }
                    aria-label="Filtrar por rango de última señal"
                    className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer"
                  >
                    <option value="all">Cualquier momento</option>
                    <option value="5m">Últimos 5 minutos</option>
                    <option value="1h">Última hora</option>
                    <option value="24h">Últimas 24 horas</option>
                    <option value="stale">Atrasada (&gt; 1 min)</option>
                  </select>
                </div>

                {/* Agrupar por */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-text-muted">
                    Agrupar por
                  </label>
                  <select
                    value={groupBy}
                    onChange={(e) =>
                      onGroupByChange(e.target.value as GuardianGroupBy)
                    }
                    aria-label="Agrupar guardianes"
                    className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer"
                  >
                    <option value="none">Sin agrupar</option>
                    <option value="platform">Plataforma</option>
                    <option value="version">Versión</option>
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

          {/* View Switcher */}
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
    </div>
  );
}
