import { ArrowUpRight } from "lucide-react";
import type { DomainInfo } from "../../types/domain";
import ConnectivityModuleToolbar, {
  type ToolbarStatusChip,
} from "../common/connectivity/ConnectivityModuleToolbar";
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

  const statusChips: ToolbarStatusChip[] = [
    {
      key: "expired",
      label: `${summary.expiredCount} ${summary.expiredCount === 1 ? "vencido" : "vencidos"}`,
      count: summary.expiredCount,
      tone: "danger",
      pulse: true,
      title: "Filtrar por dominios vencidos",
    },
    {
      key: "changed",
      label: `${summary.changedCount} con cambios`,
      count: summary.changedCount,
      tone: "warning",
      hideWhenZero: true,
      title:
        "Cambios sin confirmar en registrador, nameservers o bloqueo de transferencia",
    },
    {
      key: "expiring",
      label: `${summary.expiringCount} por expirar`,
      count: summary.expiringCount,
      tone: "warning",
      title: `Por expirar: ≤ ${thresholds.warningDays} días (crítico ≤ ${thresholds.criticalDays} d) · configurable en Filtros`,
    },
    {
      key: "valid",
      label: `${summary.validCount} ${summary.validCount === 1 ? "vigente" : "vigentes"}`,
      count: summary.validCount,
      tone: "success",
      title: `Dominios vigentes (> ${thresholds.warningDays} días)`,
    },
    {
      key: "no_data",
      label: `${summary.noDataCount} sin datos`,
      count: summary.noDataCount,
      tone: "neutral",
      hideWhenZero: true,
      title:
        "TLDs sin datos RDAP/WHOIS; puedes definir fecha de vencimiento manual",
    },
  ];

  return (
    <ConnectivityModuleToolbar
      testId="domain-toolbar"
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Buscar dominio o registrador..."
      searchAriaLabel="Buscar dominio o registrador"
      statusFilter={statusFilter}
      onStatusFilterChange={onStatusFilterChange}
      statusChips={statusChips}
      filtersDialogLabel="Filtros de dominios"
      filtersButtonTitle="Filtrar por registrador, TLD, bloqueo de transferencia, nameservers, umbrales y densidad"
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
        ) : undefined
      }
      filterContent={
        <>
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
        </>
      }
    />
  );
}
