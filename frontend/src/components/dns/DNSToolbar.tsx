import { useEffect, useRef, useState } from "react";
import {
  Download,
  Layers,
  LayoutGrid,
  List,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { DNSRecordType } from "../../types/dns";
import {
  formatDNSLatency,
  formatResolverLabel,
  type DNSDensity,
  type DNSGroupBy,
  type DNSSummaryMetrics,
} from "./useDNSRecords";

const ALL_DNS_TYPES: DNSRecordType[] = [
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "TXT",
  "NS",
  "SOA",
  "SRV",
  "PTR",
  "CAA",
];

interface DNSToolbarProps {
  summary: DNSSummaryMetrics;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  zoneFilter: string;
  onZoneFilterChange: (value: string) => void;
  resolverFilter: string;
  onResolverFilterChange: (value: string) => void;
  facets: {
    types: DNSRecordType[];
    zones: string[];
    resolvers: string[];
  };
  groupBy: DNSGroupBy;
  onGroupByChange: (value: DNSGroupBy) => void;
  density: DNSDensity;
  onDensityChange: (value: DNSDensity) => void;
  search: string;
  onSearchChange: (value: string) => void;
  viewMode: "grid" | "table";
  onViewModeChange: (value: "grid" | "table") => void;
  onExportCSV: () => void;
  canExport: boolean;
}

export default function DNSToolbar({
  summary,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  zoneFilter,
  onZoneFilterChange,
  resolverFilter,
  onResolverFilterChange,
  facets,
  groupBy,
  onGroupByChange,
  density,
  onDensityChange,
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onExportCSV,
  canExport,
}: DNSToolbarProps) {
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
    (typeFilter !== "all" ? 1 : 0) +
    (zoneFilter !== "all" ? 1 : 0) +
    (resolverFilter !== "all" ? 1 : 0) +
    (groupBy !== "none" && groupBy !== "zone" ? 1 : 0);

  const handleResetFilters = () => {
    onTypeFilterChange("all");
    onZoneFilterChange("all");
    onResolverFilterChange("all");
    onGroupByChange("none");
  };

  const typeOptions = facets.types.length > 0 ? facets.types : ALL_DNS_TYPES;

  return (
    <div
      data-testid="dns-toolbar"
      className="w-full max-w-[1400px] mx-auto bg-bg-card border border-border-base rounded-2xl px-3 py-2 shadow-lg text-xs select-none"
    >
      {/* Strictly Single Row on Desktop */}
      <div className="flex items-center justify-between gap-2.5 flex-wrap md:flex-nowrap">
        {/* Left: Search + 4 Unified State Chips + Avg Latency */}
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto no-scrollbar">
          {/* Search Input */}
          <div className="relative w-[170px] sm:w-[210px] shrink-0">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim"
            />
            <input
              type="search"
              placeholder="Buscar dominio, host o IP..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Buscar dominio, host o IP resuelta"
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

          {/* 4 Unified Status Chips (matching row, card, and drawer states exactly) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* 1. Error de resolución */}
            <button
              type="button"
              onClick={() => toggleChip("error")}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap !min-h-0 !min-w-0 ${
                statusFilter === "error"
                  ? "bg-rose-500 text-white ring-2 ring-rose-500/40"
                  : summary.errorCount > 0
                    ? "bg-rose-500/15 border border-rose-500/40 text-rose-400 hover:bg-rose-500/25"
                    : "bg-bg-dark border border-border-base text-text-dim hover:text-text-main"
              }`}
              title="Error de resolución: NXDOMAIN, SERVFAIL o timeout"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  statusFilter === "error"
                    ? "bg-white"
                    : summary.errorCount > 0
                      ? "bg-rose-500 animate-pulse"
                      : "bg-slate-600"
                }`}
              />
              <span>{summary.errorCount} con error</span>
            </button>

            {/* 2. Fuera de referencia */}
            <button
              type="button"
              onClick={() => toggleChip("mismatch")}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap !min-h-0 !min-w-0 ${
                statusFilter === "mismatch"
                  ? "bg-rose-500 text-white ring-2 ring-rose-500/40"
                  : summary.mismatchCount > 0
                    ? "bg-rose-500/15 border border-rose-500/40 text-rose-400 hover:bg-rose-500/25"
                    : "bg-bg-dark border border-border-base text-text-dim hover:text-text-main"
              }`}
              title="Fuera de referencia: persiste un valor distinto a la referencia esperada"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  statusFilter === "mismatch"
                    ? "bg-white"
                    : summary.mismatchCount > 0
                      ? "bg-rose-500"
                      : "bg-slate-600"
                }`}
              />
              <span>{summary.mismatchCount} fuera de referencia</span>
            </button>

            {/* 3. Propagando */}
            <button
              type="button"
              onClick={() => toggleChip("propagating")}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap !min-h-0 !min-w-0 ${
                statusFilter === "propagating"
                  ? "bg-amber-500 text-black ring-2 ring-amber-500/40"
                  : summary.propagatingCount > 0
                    ? "bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25"
                    : "bg-bg-dark border border-border-base text-text-dim hover:text-text-main"
              }`}
              title="Propagando: cambió hace menos de un TTL o los resolvers públicos aún discrepan"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  statusFilter === "propagating"
                    ? "bg-black"
                    : summary.propagatingCount > 0
                      ? "bg-amber-400"
                      : "bg-slate-600"
                }`}
              />
              <span>{summary.propagatingCount} propagando</span>
            </button>

            {/* 3b. Rotando (only shown when provider IP rotation is active) */}
            {summary.rotatingCount > 0 && (
              <button
                type="button"
                onClick={() => toggleChip("rotating")}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap !min-h-0 !min-w-0 ${
                  statusFilter === "rotating"
                    ? "bg-sky-500 text-black ring-2 ring-sky-500/40"
                    : "bg-sky-500/15 border border-sky-500/35 text-sky-300 hover:bg-sky-500/25"
                }`}
                title="Rotando: el proveedor alterna IPs del mismo rango; considera definir referencia por rango /24"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    statusFilter === "rotating" ? "bg-black" : "bg-sky-400"
                  }`}
                />
                <span>{summary.rotatingCount} rotando</span>
              </button>
            )}

            {/* 4. Resuelto */}
            <button
              type="button"
              onClick={() => toggleChip("resolved")}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap !min-h-0 !min-w-0 ${
                statusFilter === "resolved"
                  ? "bg-emerald-500 text-black ring-2 ring-emerald-500/40"
                  : summary.resolvedCount > 0
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                    : "bg-bg-dark border border-border-base text-text-dim hover:text-text-main"
              }`}
              title="Resuelto: coincide con la referencia o responde de forma consistente"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  statusFilter === "resolved"
                    ? "bg-black"
                    : summary.resolvedCount > 0
                      ? "bg-emerald-400"
                      : "bg-slate-600"
                }`}
              />
              <span>
                {summary.resolvedCount}{" "}
                {summary.resolvedCount === 1 ? "resuelto" : "resueltos"}
              </span>
            </button>
          </div>

          {/* Inline Avg Latency (principal resolver average) */}
          {summary.avgLatencyMs != null && (
            <div
              className="hidden xl:flex items-center pl-2.5 ml-1 border-l border-border-base/80 shrink-0 font-mono text-[11px] text-text-dim whitespace-nowrap"
              title="Latencia promedio del resolver principal (1.1.1.1) entre los registros visibles"
            >
              <span>Latencia prom.</span>
              <span className="ml-1.5 font-semibold text-text-main tabular-nums">
                {formatDNSLatency(summary.avgLatencyMs)}
              </span>
            </div>
          )}
        </div>

        {/* Right: Quick Group-by-Zone Toggle + Filtros Popover + View Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Direct Por zona toggle so DNS Zones are first-class */}
          <button
            type="button"
            onClick={(e) => {
              if (e.detail > 0) e.currentTarget.blur();
              onGroupByChange(groupBy === "zone" ? "none" : "zone");
            }}
            aria-pressed={groupBy === "zone"}
            title="Agrupar registros por zona DNS"
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer !min-h-0 !min-w-0 ${
              groupBy === "zone"
                ? "bg-accent-green/10 border-accent-green/50 text-accent-green"
                : "bg-bg-dark border-border-base text-text-muted hover:text-text-main hover:bg-bg-card-hover"
            }`}
          >
            <Layers size={12} className="shrink-0" />
            <span>Por zona</span>
            {facets.zones.length > 0 && (
              <span className="font-mono text-[10px] opacity-80">
                {facets.zones.length}
              </span>
            )}
          </button>

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
              title="Filtrar por tipo de registro, zona DNS, resolver, agrupación y densidad"
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
                aria-label="Filtros de registros DNS"
                className="absolute right-0 top-9 z-40 w-72 max-h-[80vh] overflow-y-auto rounded-2xl border border-border-accent/70 bg-bg-card p-3.5 shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="flex items-center justify-between border-b border-border-base/70 pb-2">
                  <span className="text-xs font-semibold text-text-main">
                    Filtros y preferencias
                  </span>
                  {(activeFiltersCount > 0 || groupBy !== "none") && (
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

                {/* Tipo de registro */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-text-muted">
                    Tipo de registro
                  </label>
                  <select
                    value={typeFilter}
                    onChange={(e) => onTypeFilterChange(e.target.value)}
                    aria-label="Filtrar por tipo de registro DNS"
                    className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main font-mono focus:border-accent-green focus:outline-none cursor-pointer"
                  >
                    <option value="all">Todos los tipos</option>
                    {typeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Zona DNS */}
                {facets.zones.length > 0 && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-text-muted">
                      Zona DNS
                    </label>
                    <select
                      value={zoneFilter}
                      onChange={(e) => onZoneFilterChange(e.target.value)}
                      aria-label="Filtrar por zona DNS"
                      className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main font-mono focus:border-accent-green focus:outline-none cursor-pointer"
                    >
                      <option value="all">Todas las zonas</option>
                      {facets.zones.map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Resolver */}
                {facets.resolvers.length > 0 && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-text-muted">
                      Resolver
                    </label>
                    <select
                      value={resolverFilter}
                      onChange={(e) => onResolverFilterChange(e.target.value)}
                      aria-label="Filtrar por resolver DNS"
                      className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main font-mono focus:border-accent-green focus:outline-none cursor-pointer"
                    >
                      <option value="all">Todos los resolvers</option>
                      {facets.resolvers.map((r) => (
                        <option key={r} value={r}>
                          {formatResolverLabel(r)}
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
                      onGroupByChange(e.target.value as DNSGroupBy)
                    }
                    aria-label="Agrupar registros DNS"
                    className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer"
                  >
                    <option value="none">Sin agrupar</option>
                    <option value="zone">Zona DNS</option>
                    <option value="type">Tipo de registro</option>
                    <option value="status">Estado</option>
                  </select>
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

                {/* Exportar CSV clearly labeled inside Filtros */}
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
