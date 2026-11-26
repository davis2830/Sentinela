import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Download,
  LayoutGrid,
  List,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { DomainInfo } from "../../types/domain";
import {
  type DomainDensity,
  type DomainGroupBy,
  type DomainLockFilter,
  type DomainSummaryMetrics,
  type DomainThresholds,
} from "./useDomains";

interface DomainToolbarProps {
  summary: DomainSummaryMetrics;
  thresholds: DomainThresholds;
  onThresholdsChange: (next: DomainThresholds | null) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  registrarFilter: string;
  onRegistrarFilterChange: (value: string) => void;
  tldFilter: string;
  onTldFilterChange: (value: string) => void;
  lockFilter: DomainLockFilter;
  onLockFilterChange: (value: DomainLockFilter) => void;
  nsFilter: string;
  onNsFilterChange: (value: string) => void;
  facets: {
    registrars: string[];
    tlds: string[];
    nsProviders: string[];
  };
  groupBy: DomainGroupBy;
  onGroupByChange: (value: DomainGroupBy) => void;
  density: DomainDensity;
  onDensityChange: (value: DomainDensity) => void;
  search: string;
  onSearchChange: (value: string) => void;
  viewMode: "grid" | "table";
  onViewModeChange: (value: "grid" | "table") => void;
  onSelectDomain: (domain: DomainInfo) => void;
  onExportCSV: () => void;
  canExport: boolean;
}

export default function DomainToolbar({
  summary,
  thresholds,
  onThresholdsChange,
  statusFilter,
  onStatusFilterChange,
  registrarFilter,
  onRegistrarFilterChange,
  tldFilter,
  onTldFilterChange,
  lockFilter,
  onLockFilterChange,
  nsFilter,
  onNsFilterChange,
  facets,
  groupBy,
  onGroupByChange,
  density,
  onDensityChange,
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onSelectDomain,
  onExportCSV,
  canExport,
}: DomainToolbarProps) {
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
    (registrarFilter !== "all" ? 1 : 0) +
    (tldFilter !== "all" ? 1 : 0) +
    (lockFilter !== "all" ? 1 : 0) +
    (nsFilter !== "all" ? 1 : 0) +
    (groupBy !== "none" ? 1 : 0);

  const handleResetFilters = () => {
    onRegistrarFilterChange("all");
    onTldFilterChange("all");
    onLockFilterChange("all");
    onNsFilterChange("all");
    onGroupByChange("none");
  };

  const nextExp = summary.nextExpiring;
  const nextExpTone =
    !nextExp
      ? "text-text-dim"
      : nextExp.days <= thresholds.criticalDays
        ? "text-rose-400 font-semibold"
        : nextExp.days <= thresholds.warningDays
          ? "text-amber-400 font-semibold"
          : "text-text-main";

  return (
    <div
      data-testid="domain-toolbar"
      className="w-full max-w-[1400px] mx-auto bg-bg-card border border-border-base rounded-2xl px-3 py-2 shadow-lg text-xs select-none"
    >
      <div className="flex items-center justify-between gap-2.5 flex-wrap md:flex-nowrap">
        {/* Left: Search + Clickable Status Chips (0s muted gray) + Next Expiration */}
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto no-scrollbar">
          <div className="relative w-[180px] sm:w-[225px] shrink-0">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim"
            />
            <input
              type="search"
              placeholder="Buscar dominio o registrador..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Buscar dominio o registrador"
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

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => toggleChip("expired")}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap !min-h-0 !min-w-0 ${
                statusFilter === "expired"
                  ? "bg-rose-500 text-white ring-2 ring-rose-500/40"
                  : summary.expiredCount > 0
                    ? "bg-rose-500/15 border border-rose-500/40 text-rose-400 hover:bg-rose-500/25"
                    : "bg-bg-dark border border-border-base text-text-dim hover:text-text-main"
              }`}
              title="Filtrar por dominios vencidos"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  statusFilter === "expired"
                    ? "bg-white"
                    : summary.expiredCount > 0
                      ? "bg-rose-500 animate-pulse"
                      : "bg-slate-600"
                }`}
              />
              <span>
                {summary.expiredCount}{" "}
                {summary.expiredCount === 1 ? "vencido" : "vencidos"}
              </span>
            </button>

            {summary.changedCount > 0 && (
              <button
                type="button"
                onClick={() => toggleChip("changed")}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap !min-h-0 !min-w-0 ${
                  statusFilter === "changed"
                    ? "bg-amber-500 text-black ring-2 ring-amber-500/40"
                    : "bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25"
                }`}
                title="Cambios sin confirmar en registrador, nameservers o bloqueo de transferencia"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    statusFilter === "changed" ? "bg-black" : "bg-amber-400"
                  }`}
                />
                <span>{summary.changedCount} con cambios</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => toggleChip("expiring")}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap !min-h-0 !min-w-0 ${
                statusFilter === "expiring"
                  ? "bg-amber-500 text-black ring-2 ring-amber-500/40"
                  : summary.expiringCount > 0
                    ? "bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25"
                    : "bg-bg-dark border border-border-base text-text-dim hover:text-text-main"
              }`}
              title={`Por expirar: ≤ ${thresholds.warningDays} días (crítico ≤ ${thresholds.criticalDays} d) · configurable en Filtros`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  statusFilter === "expiring"
                    ? "bg-black"
                    : summary.expiringCount > 0
                      ? "bg-amber-400"
                      : "bg-slate-600"
                }`}
              />
              <span>{summary.expiringCount} por expirar</span>
            </button>

            <button
              type="button"
              onClick={() => toggleChip("valid")}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap !min-h-0 !min-w-0 ${
                statusFilter === "valid"
                  ? "bg-emerald-500 text-black ring-2 ring-emerald-500/40"
                  : summary.validCount > 0
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                    : "bg-bg-dark border border-border-base text-text-dim hover:text-text-main"
              }`}
              title={`Dominios vigentes (> ${thresholds.warningDays} días)`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  statusFilter === "valid"
                    ? "bg-black"
                    : summary.validCount > 0
                      ? "bg-emerald-400"
                      : "bg-slate-600"
                }`}
              />
              <span>
                {summary.validCount}{" "}
                {summary.validCount === 1 ? "vigente" : "vigentes"}
              </span>
            </button>

            {summary.noDataCount > 0 && (
              <button
                type="button"
                onClick={() => toggleChip("no_data")}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap !min-h-0 !min-w-0 ${
                  statusFilter === "no_data"
                    ? "bg-slate-400 text-black ring-2 ring-slate-400/40"
                    : "bg-bg-dark border border-border-base text-text-muted hover:text-text-main"
                }`}
                title="TLDs sin datos RDAP/WHOIS; puedes definir fecha de vencimiento manual"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                <span>{summary.noDataCount} sin datos</span>
              </button>
            )}
          </div>

          {nextExp && (
            <div className="hidden lg:flex items-center pl-2.5 ml-1 border-l border-border-base/80 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  if (e.detail > 0) e.currentTarget.blur();
                  onSelectDomain(nextExp.domain);
                }}
                className="group/next inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-[11px] text-text-dim hover:text-text-main hover:bg-white/[0.04] transition-colors whitespace-nowrap cursor-pointer !min-h-0 !min-w-0"
                title={`Abrir detalle del próximo vencimiento: ${nextExp.domain.domain} (en ${nextExp.days} días)`}
              >
                <span>Próximo:</span>
                <span className="font-semibold text-text-main group-hover/next:text-accent-green group-hover/next:underline underline-offset-2 max-w-[170px] truncate">
                  {nextExp.domain.domain}
                </span>
                <span className={nextExpTone}>en {nextExp.days} d</span>
                <ArrowUpRight
                  size={11}
                  className="text-text-dim opacity-60 group-hover/next:opacity-100 group-hover/next:text-accent-green shrink-0"
                />
              </button>
            </div>
          )}
        </div>

        {/* Right: Filtros Popover (solid bg-bg-card) + View Switcher */}
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
              title="Filtrar por registrador, TLD, bloqueo de transferencia, nameservers, umbrales y densidad"
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
                aria-label="Filtros de dominios"
                className="absolute right-0 top-9 z-40 w-80 max-h-[80vh] overflow-y-auto rounded-2xl border border-border-accent/70 bg-bg-card p-3.5 shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="flex items-center justify-between border-b border-border-base/70 pb-2">
                  <span className="text-xs font-semibold text-text-main">
                    Filtros y preferencias
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

                {facets.registrars.length > 0 && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-text-muted">
                      Registrador
                    </label>
                    <select
                      value={registrarFilter}
                      onChange={(e) => onRegistrarFilterChange(e.target.value)}
                      className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer"
                    >
                      <option value="all">Todos los registradores</option>
                      {facets.registrars.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-text-muted">
                      TLD
                    </label>
                    <select
                      value={tldFilter}
                      onChange={(e) => onTldFilterChange(e.target.value)}
                      className="w-full bg-bg-dark border border-border-base rounded-lg px-2 py-1.5 text-xs text-text-main font-mono focus:border-accent-green focus:outline-none cursor-pointer"
                    >
                      <option value="all">Todos</option>
                      {facets.tlds.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-text-muted">
                      Bloqueo
                    </label>
                    <select
                      value={lockFilter}
                      onChange={(e) =>
                        onLockFilterChange(e.target.value as DomainLockFilter)
                      }
                      className="w-full bg-bg-dark border border-border-base rounded-lg px-2 py-1.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer"
                    >
                      <option value="all">Todos</option>
                      <option value="locked">Bloqueado</option>
                      <option value="unlocked">Sin bloqueo</option>
                      <option value="unknown">Sin datos</option>
                    </select>
                  </div>
                </div>

                {facets.nsProviders.length > 0 && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-text-muted">
                      Nameservers
                    </label>
                    <select
                      value={nsFilter}
                      onChange={(e) => onNsFilterChange(e.target.value)}
                      className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main font-mono focus:border-accent-green focus:outline-none cursor-pointer"
                    >
                      <option value="all">Todos</option>
                      {facets.nsProviders.map((ns) => (
                        <option key={ns} value={ns}>
                          {ns}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-text-muted">
                    Agrupar por
                  </label>
                  <select
                    value={groupBy}
                    onChange={(e) =>
                      onGroupByChange(e.target.value as DomainGroupBy)
                    }
                    className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer"
                  >
                    <option value="none">Sin agrupar</option>
                    <option value="registrar">Registrador</option>
                    <option value="tld">TLD</option>
                    <option value="status">Estado</option>
                  </select>
                </div>

                {/* Configurable domain expiry thresholds (60/14 default, 30/7 preset) */}
                <div className="space-y-1.5 pt-2 border-t border-border-base/70">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-text-muted">
                      Umbral de aviso (días)
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onThresholdsChange(null)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer !min-h-0 !min-w-0 ${
                          thresholds.source !== "custom"
                            ? "bg-accent-green/20 text-accent-green font-semibold"
                            : "bg-bg-dark text-text-dim hover:text-text-main"
                        }`}
                        title="Usar los umbrales configurados en Reglas de Alerta (60 · 30 · 14 · 7 d)"
                      >
                        Reglas ({thresholds.warningDays}/{thresholds.criticalDays} d)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onThresholdsChange({
                            warningDays: 30,
                            criticalDays: 7,
                            steps: [30, 14, 7],
                            source: "custom",
                          })
                        }
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer !min-h-0 !min-w-0 ${
                          thresholds.source === "custom" &&
                          thresholds.warningDays === 30 &&
                          thresholds.criticalDays === 7
                            ? "bg-accent-green/20 text-accent-green font-semibold"
                            : "bg-bg-dark text-text-dim hover:text-text-main"
                        }`}
                        title="Vista local: aviso a 30 días, crítico a 7 días"
                      >
                        30 / 7 d
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg bg-bg-dark border border-border-base text-[11px]">
                      <span className="text-amber-300 font-medium">Ámbar ≤</span>
                      <input
                        type="number"
                        min={2}
                        max={180}
                        value={thresholds.warningDays}
                        onChange={(e) => {
                          const w = Math.min(
                            180,
                            Math.max(2, parseInt(e.target.value, 10) || 60),
                          );
                          const c = Math.min(w - 1, thresholds.criticalDays);
                          onThresholdsChange({
                            warningDays: w,
                            criticalDays: c,
                            steps: [w, c],
                            source: "custom",
                          });
                        }}
                        className="w-11 bg-transparent text-right font-mono text-text-main focus:outline-none"
                        aria-label="Días de aviso ámbar"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg bg-bg-dark border border-border-base text-[11px]">
                      <span className="text-rose-400 font-medium">Rojo ≤</span>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, thresholds.warningDays - 1)}
                        value={thresholds.criticalDays}
                        onChange={(e) => {
                          const c = Math.min(
                            thresholds.warningDays - 1,
                            Math.max(1, parseInt(e.target.value, 10) || 14),
                          );
                          onThresholdsChange({
                            warningDays: thresholds.warningDays,
                            criticalDays: c,
                            steps: [thresholds.warningDays, c],
                            source: "custom",
                          });
                        }}
                        className="w-11 bg-transparent text-right font-mono text-text-main focus:outline-none"
                        aria-label="Días críticos rojo"
                      />
                    </label>
                  </div>
                </div>

                {/* Densidad */}
                <div className="space-y-1 pt-2 border-t border-border-base/70">
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

                {/* Exportar CSV */}
                <div className="pt-2 border-t border-border-base/70">
                  <button
                    type="button"
                    disabled={!canExport}
                    onClick={() => {
                      setFiltersOpen(false);
                      onExportCSV();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-border-base bg-bg-dark hover:bg-bg-card-hover text-xs font-medium text-text-main disabled:opacity-40 cursor-pointer transition-colors !min-h-0"
                  >
                    <Download size={13} className="text-accent-green shrink-0" />
                    <span>Exportar CSV</span>
                  </button>
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
              onClick={(e) => {
                if (e.detail > 0) e.currentTarget.blur();
                onViewModeChange("grid");
              }}
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
              onClick={(e) => {
                if (e.detail > 0) e.currentTarget.blur();
                onViewModeChange("table");
              }}
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
