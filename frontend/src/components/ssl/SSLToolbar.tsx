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
import type { SSLCertificate } from "../../types/ssl";
import {
  DEFAULT_SSL_THRESHOLDS,
  type SSLDensity,
  type SSLGroupBy,
  type SSLOriginFilter,
  type SSLSummaryMetrics,
  type SSLThresholds,
} from "./useSSLCertificates";

interface SSLToolbarProps {
  summary: SSLSummaryMetrics;
  thresholds: SSLThresholds;
  onThresholdsChange: (next: SSLThresholds) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  issuerFilter: string;
  onIssuerFilterChange: (value: string) => void;
  tlsFilter: string;
  onTlsFilterChange: (value: string) => void;
  gradeFilter: string;
  onGradeFilterChange: (value: string) => void;
  originFilter: SSLOriginFilter;
  onOriginFilterChange: (value: SSLOriginFilter) => void;
  facets: {
    issuers: string[];
    tlsVersions: string[];
    grades: string[];
  };
  groupBy: SSLGroupBy;
  onGroupByChange: (value: SSLGroupBy) => void;
  density: SSLDensity;
  onDensityChange: (value: SSLDensity) => void;
  search: string;
  onSearchChange: (value: string) => void;
  viewMode: "grid" | "table";
  onViewModeChange: (value: "grid" | "table") => void;
  onSelectCert: (cert: SSLCertificate) => void;
  onExportCSV: () => void;
  canExport: boolean;
}

export default function SSLToolbar({
  summary,
  thresholds,
  onThresholdsChange,
  statusFilter,
  onStatusFilterChange,
  issuerFilter,
  onIssuerFilterChange,
  tlsFilter,
  onTlsFilterChange,
  gradeFilter,
  onGradeFilterChange,
  originFilter,
  onOriginFilterChange,
  facets,
  groupBy,
  onGroupByChange,
  density,
  onDensityChange,
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onSelectCert,
  onExportCSV,
  canExport,
}: SSLToolbarProps) {
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
    (issuerFilter !== "all" ? 1 : 0) +
    (tlsFilter !== "all" ? 1 : 0) +
    (gradeFilter !== "all" ? 1 : 0) +
    (originFilter !== "all" ? 1 : 0) +
    (groupBy !== "none" ? 1 : 0);

  const handleResetFilters = () => {
    onIssuerFilterChange("all");
    onTlsFilterChange("all");
    onGradeFilterChange("all");
    onOriginFilterChange("all");
    onGroupByChange("none");
  };

  const nextExp = summary.nextExpiring;
  const nextExpToneClass =
    !nextExp
      ? "text-text-dim"
      : nextExp.days <= thresholds.criticalDays
        ? "text-rose-400 font-semibold"
        : nextExp.days <= thresholds.warningDays
          ? "text-amber-400 font-semibold"
          : "text-text-main";

  return (
    <div
      data-testid="ssl-toolbar"
      className="w-full max-w-[1400px] mx-auto bg-bg-card border border-border-base rounded-2xl px-3 py-2 shadow-lg text-xs select-none"
    >
      {/* Strictly Single Row on Desktop */}
      <div className="flex items-center justify-between gap-2.5 flex-wrap md:flex-nowrap">
        {/* Left: Search + Clickable Status Chips (0s muted gray) + Next Expiration */}
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto no-scrollbar">
          {/* Search Input */}
          <div className="relative w-[175px] sm:w-[220px] shrink-0">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim"
            />
            <input
              type="search"
              placeholder="Buscar dominio, CA o SAN..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Buscar dominio, autoridad emisora o SAN"
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

          {/* Clickable Status Chips (0-count stays neutral gray) */}
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
              title="Filtrar por certificados vencidos"
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

            {summary.problemCount > 0 && (
              <button
                type="button"
                onClick={() => toggleChip("problem")}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap !min-h-0 !min-w-0 ${
                  statusFilter === "problem"
                    ? "bg-rose-500 text-white ring-2 ring-rose-500/40"
                    : "bg-rose-500/15 border border-rose-500/40 text-rose-400 hover:bg-rose-500/25"
                }`}
                title="Filtrar por certificados con problemas (cadena, autofirmado, TLS antiguo o fallo de conexión)"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    statusFilter === "problem" ? "bg-white" : "bg-rose-500"
                  }`}
                />
                <span>{summary.problemCount} con problemas</span>
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
              title={`Por expirar: menos de ${thresholds.warningDays} días (crítico ≤ ${thresholds.criticalDays} d) · configurable en Filtros`}
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
              title={`Filtrar por certificados válidos (> ${thresholds.warningDays} días)`}
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
                {summary.validCount === 1 ? "válido" : "válidos"}
              </span>
            </button>
          </div>

          {/* Inline Next Expiration Link (opens that certificate directly) */}
          {nextExp && (
            <div className="hidden lg:flex items-center pl-2.5 ml-1 border-l border-border-base/80 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  if (e.detail > 0) e.currentTarget.blur();
                  onSelectCert(nextExp.cert);
                }}
                className="group/next inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-[11px] text-text-dim hover:text-text-main hover:bg-white/[0.04] transition-colors whitespace-nowrap cursor-pointer !min-h-0 !min-w-0"
                title={`Abrir detalle del próximo vencimiento: ${nextExp.cert.domain} (en ${nextExp.days} días)`}
              >
                <span>Próximo:</span>
                <span className="font-semibold text-text-main group-hover/next:text-accent-green group-hover/next:underline underline-offset-2 max-w-[170px] truncate">
                  {nextExp.cert.domain}
                </span>
                <span className={nextExpToneClass}>en {nextExp.days} d</span>
                <ArrowUpRight
                  size={11}
                  className="text-text-dim opacity-60 group-hover/next:opacity-100 group-hover/next:text-accent-green shrink-0"
                />
              </button>
            </div>
          )}
        </div>

        {/* Right: Filtros Popover (includes Thresholds + Export CSV) + View Switcher */}
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
              title="Filtrar por CA, TLS, grado, origen, agrupación, densidad y umbrales de aviso"
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
                aria-label="Filtros y umbrales de certificados SSL"
                className="absolute right-0 top-9 z-40 w-80 max-h-[80vh] overflow-y-auto rounded-2xl border border-border-base bg-bg-card/98 backdrop-blur-md p-3.5 shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-100"
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

                {/* Emisor (CA) */}
                {facets.issuers.length > 0 && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-text-muted">
                      Emisor (CA)
                    </label>
                    <select
                      value={issuerFilter}
                      onChange={(e) => onIssuerFilterChange(e.target.value)}
                      aria-label="Filtrar por emisor"
                      className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer"
                    >
                      <option value="all">Todos los emisores</option>
                      {facets.issuers.map((iss) => (
                        <option key={iss} value={iss}>
                          {iss}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* TLS & Grado side by side */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-text-muted">
                      Protocolo TLS
                    </label>
                    <select
                      value={tlsFilter}
                      onChange={(e) => onTlsFilterChange(e.target.value)}
                      aria-label="Filtrar por protocolo TLS"
                      className="w-full bg-bg-dark border border-border-base rounded-lg px-2 py-1.5 text-xs text-text-main font-mono focus:border-accent-green focus:outline-none cursor-pointer"
                    >
                      <option value="all">Todos</option>
                      {facets.tlsVersions.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-text-muted">
                      Grado
                    </label>
                    <select
                      value={gradeFilter}
                      onChange={(e) => onGradeFilterChange(e.target.value)}
                      aria-label="Filtrar por grado de seguridad"
                      className="w-full bg-bg-dark border border-border-base rounded-lg px-2 py-1.5 text-xs text-text-main font-mono focus:border-accent-green focus:outline-none cursor-pointer"
                    >
                      <option value="all">Todos</option>
                      {facets.grades.map((g) => (
                        <option key={g} value={g}>
                          Grado {g}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Origen */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-text-muted">
                    Origen
                  </label>
                  <select
                    value={originFilter}
                    onChange={(e) =>
                      onOriginFilterChange(e.target.value as SSLOriginFilter)
                    }
                    aria-label="Filtrar por origen"
                    className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer"
                  >
                    <option value="all">Todos</option>
                    <option value="linked">Vinculados a Uptime</option>
                    <option value="manual">Agregados manualmente</option>
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
                      onGroupByChange(e.target.value as SSLGroupBy)
                    }
                    aria-label="Agrupar certificados"
                    className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer"
                  >
                    <option value="none">Sin agrupar</option>
                    <option value="expiry_bucket">Rango de vencimiento</option>
                    <option value="issuer">Emisor (CA)</option>
                    <option value="tls">Protocolo TLS</option>
                    <option value="origin">Origen (Uptime / Manual)</option>
                  </select>
                </div>

                {/* Umbral configurable de "Por expirar" */}
                <div className="space-y-1.5 pt-2 border-t border-border-base/70">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-text-muted">
                      Umbral de aviso (días)
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onThresholdsChange(DEFAULT_SSL_THRESHOLDS)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer !min-h-0 !min-w-0 ${
                          thresholds.warningDays === 14 &&
                          thresholds.criticalDays === 7
                            ? "bg-accent-green/20 text-accent-green font-semibold"
                            : "bg-bg-dark text-text-dim hover:text-text-main"
                        }`}
                        title="Recomendado para Let's Encrypt (renueva automáticamente ~30 días antes)"
                      >
                        14 / 7 d
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onThresholdsChange({ warningDays: 30, criticalDays: 14 })
                        }
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer !min-h-0 !min-w-0 ${
                          thresholds.warningDays === 30 &&
                          thresholds.criticalDays === 14
                            ? "bg-accent-green/20 text-accent-green font-semibold"
                            : "bg-bg-dark text-text-dim hover:text-text-main"
                        }`}
                        title="Aviso anticipado a 30 días"
                      >
                        30 / 14 d
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg bg-bg-dark border border-border-base text-[11px]">
                      <span className="text-amber-300 font-medium">Ámbar ≤</span>
                      <input
                        type="number"
                        min={2}
                        max={90}
                        value={thresholds.warningDays}
                        onChange={(e) => {
                          const w = Math.min(
                            90,
                            Math.max(2, parseInt(e.target.value, 10) || 14),
                          );
                          const c = Math.min(w - 1, thresholds.criticalDays);
                          onThresholdsChange({ warningDays: w, criticalDays: c });
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
                            Math.max(1, parseInt(e.target.value, 10) || 7),
                          );
                          onThresholdsChange({
                            warningDays: thresholds.warningDays,
                            criticalDays: c,
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
