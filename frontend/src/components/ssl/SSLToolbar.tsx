import { ArrowUpRight } from "lucide-react";
import type { SSLCertificate } from "../../types/ssl";
import ConnectivityModuleToolbar, {
  type ToolbarStatusChip,
} from "../common/connectivity/ConnectivityModuleToolbar";
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

  const statusChips: ToolbarStatusChip[] = [
    {
      key: "expired",
      label: `${summary.expiredCount} ${summary.expiredCount === 1 ? "vencido" : "vencidos"}`,
      count: summary.expiredCount,
      tone: "danger",
      pulse: true,
      title: "Filtrar por certificados vencidos",
    },
    {
      key: "problem",
      label: `${summary.problemCount} con problemas`,
      count: summary.problemCount,
      tone: "danger",
      hideWhenZero: true,
      title:
        "Filtrar por certificados con problemas (cadena, autofirmado, TLS antiguo o fallo de conexión)",
    },
    {
      key: "expiring",
      label: `${summary.expiringCount} por expirar`,
      count: summary.expiringCount,
      tone: "warning",
      title: `Por expirar: menos de ${thresholds.warningDays} días (crítico ≤ ${thresholds.criticalDays} d) · configurable en Filtros`,
    },
    {
      key: "valid",
      label: `${summary.validCount} ${summary.validCount === 1 ? "válido" : "válidos"}`,
      count: summary.validCount,
      tone: "success",
      title: `Filtrar por certificados válidos (> ${thresholds.warningDays} días)`,
    },
  ];

  return (
    <ConnectivityModuleToolbar
      testId="ssl-toolbar"
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Buscar dominio, CA o SAN..."
      searchAriaLabel="Buscar dominio, autoridad emisora o SAN"
      statusFilter={statusFilter}
      onStatusFilterChange={onStatusFilterChange}
      statusChips={statusChips}
      filtersDialogLabel="Filtros y umbrales de certificados SSL"
      filtersButtonTitle="Filtrar por CA, TLS, grado, origen, agrupación, densidad y umbrales de aviso"
      activeFiltersCount={activeFiltersCount}
      onResetFilters={handleResetFilters}
      density={density}
      onDensityChange={onDensityChange}
      onExportCSV={onExportCSV}
      canExport={canExport}
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
      leftExtra={
        nextExp ? (
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
        ) : undefined
      }
      filterContent={
        <>
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
              onChange={(e) => onGroupByChange(e.target.value as SSLGroupBy)}
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
        </>
      }
    />
  );
}
