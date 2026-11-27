import ConnectivityModuleToolbar, {
  type ToolbarStatusChip,
} from "../common/connectivity/ConnectivityModuleToolbar";
import type { SecurityHeaderStats } from "../../types/security_headers";
import type {
  SecurityHeaderDensity,
  SecurityHeaderGroupBy,
  SecurityHeaderLeakFilter,
  SecurityHeaderProtectionFilter,
  SecurityHeaderSummary,
} from "./useSecurityHeaders";

export type SecurityHeaderStatusFilter =
  | "all"
  | "healthy"
  | "warning"
  | "critical"
  | "unmeasured"
  | "paused";

interface SecurityHeaderToolbarProps {
  stats?: SecurityHeaderStats;
  summary: SecurityHeaderSummary;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: SecurityHeaderStatusFilter;
  onStatusFilterChange: (value: SecurityHeaderStatusFilter) => void;
  leakFilter: SecurityHeaderLeakFilter;
  onLeakFilterChange: (value: SecurityHeaderLeakFilter) => void;
  protectionFilter: SecurityHeaderProtectionFilter;
  onProtectionFilterChange: (value: SecurityHeaderProtectionFilter) => void;
  hostFilter: string;
  onHostFilterChange: (value: string) => void;
  availableHosts: string[];
  groupBy: SecurityHeaderGroupBy;
  onGroupByChange: (value: SecurityHeaderGroupBy) => void;
  density: SecurityHeaderDensity;
  onDensityChange: (value: SecurityHeaderDensity) => void;
  viewMode: "grid" | "table";
  onViewModeChange: (value: "grid" | "table") => void;
  onExportCSV: () => void;
  canExport: boolean;
}

export default function SecurityHeaderToolbar({
  stats,
  summary,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  leakFilter,
  onLeakFilterChange,
  protectionFilter,
  onProtectionFilterChange,
  hostFilter,
  onHostFilterChange,
  availableHosts,
  groupBy,
  onGroupByChange,
  density,
  onDensityChange,
  viewMode,
  onViewModeChange,
  onExportCSV,
  canExport,
}: SecurityHeaderToolbarProps) {
  const criticalCount = stats?.critical ?? summary.criticalCount;
  const warningCount = stats?.warning ?? summary.warningCount;
  const healthyCount = stats?.healthy ?? summary.healthyCount;
  const unmeasuredCount = stats?.unmeasured ?? summary.unmeasuredCount;
  const pausedCount = stats?.paused ?? summary.pausedCount;
  const leaksCount = stats?.info_leaks_count ?? summary.leaksCount;
  const avgScore =
    stats?.avg_score !== undefined && (stats?.total ?? 0) > 0
      ? Math.round(stats.avg_score)
      : summary.avgScore;

  const activeFiltersCount =
    (leakFilter !== "all" ? 1 : 0) +
    (protectionFilter !== "all" ? 1 : 0) +
    (hostFilter !== "all" ? 1 : 0) +
    (groupBy !== "none" ? 1 : 0);

  const handleResetFilters = () => {
    onLeakFilterChange("all");
    onProtectionFilterChange("all");
    onHostFilterChange("all");
    onGroupByChange("none");
  };

  const statusChips: ToolbarStatusChip[] = [
    {
      key: "critical",
      label: `${criticalCount} ${criticalCount === 1 ? "crítico" : "críticos"}`,
      count: criticalCount,
      tone: "danger",
      pulse: true,
      title: "Score < 50 o error de conexión",
    },
    {
      key: "warning",
      label: `${warningCount} ${warningCount === 1 ? "advertencia" : "advertencias"}`,
      count: warningCount,
      tone: "warning",
      title: "Score 50–69 o fuga de tecnología",
    },
    {
      key: "healthy",
      label: `${healthyCount} ${healthyCount === 1 ? "saludable" : "saludables"}`,
      count: healthyCount,
      tone: "success",
      title: "Score ≥ 70 sin fugas detectadas",
    },
    {
      key: "unmeasured",
      label: `${unmeasuredCount} sin medir`,
      count: unmeasuredCount,
      tone: "neutral",
      hideWhenZero: true,
      title: "Endpoints pendientes de primera auditoría",
    },
    {
      key: "paused",
      label: `${pausedCount} ${pausedCount === 1 ? "pausado" : "pausados"}`,
      count: pausedCount,
      tone: "neutral",
      hideWhenZero: true,
      title: "Endpoints con escaneo periódico pausado",
    },
  ];

  const leftExtra = (
    <div className="hidden lg:flex items-center gap-2 pl-2 ml-1 border-l border-border-base/80 font-mono text-[11px] text-text-dim whitespace-nowrap shrink-0">
      {avgScore !== null && (
        <span title="Puntuación promedio de seguridad de los endpoints evaluados">
          Score prom.{" "}
          <strong
            className={
              avgScore >= 70
                ? "text-emerald-400"
                : avgScore >= 50
                  ? "text-amber-300"
                  : "text-rose-400"
            }
          >
            {avgScore}/100
          </strong>
        </span>
      )}
      {leaksCount > 0 && (
        <>
          {avgScore !== null && <span aria-hidden="true">·</span>}
          <span
            className="text-amber-400 font-semibold"
            title="Endpoints que exponen versiones de Server o X-Powered-By"
          >
            {leaksCount} {leaksCount === 1 ? "fuga" : "fugas"}
          </span>
        </>
      )}
    </div>
  );

  const filterContent = (
    <>
      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-text-muted">
          Fugas de tecnología
        </label>
        <select
          value={leakFilter}
          onChange={(e) =>
            onLeakFilterChange(e.target.value as SecurityHeaderLeakFilter)
          }
          aria-label="Filtrar por fugas de tecnología"
          className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer"
        >
          <option value="all">Todos</option>
          <option value="with_leaks">Con fuga detectada (Server / X-Powered-By)</option>
          <option value="clean">Sin fugas detectadas</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-text-muted">
          Blindaje faltante
        </label>
        <select
          value={protectionFilter}
          onChange={(e) =>
            onProtectionFilterChange(
              e.target.value as SecurityHeaderProtectionFilter,
            )
          }
          aria-label="Filtrar por protección faltante"
          className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer"
        >
          <option value="all">Cualquiera</option>
          <option value="missing_hsts">Sin HSTS</option>
          <option value="missing_csp">Sin CSP</option>
          <option value="missing_xfo">Sin X-Frame-Options</option>
        </select>
      </div>

      {availableHosts.length > 1 && (
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-text-muted">
            Host
          </label>
          <select
            value={hostFilter}
            onChange={(e) => onHostFilterChange(e.target.value)}
            aria-label="Filtrar por host"
            className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main font-mono focus:border-accent-green focus:outline-none cursor-pointer"
          >
            <option value="all">Todos los hosts</option>
            {availableHosts.map((h) => (
              <option key={h} value={h}>
                {h}
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
            onGroupByChange(e.target.value as SecurityHeaderGroupBy)
          }
          aria-label="Agrupar endpoints"
          className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer"
        >
          <option value="none">Sin agrupar</option>
          <option value="grade">Calificación</option>
          <option value="host">Host</option>
        </select>
      </div>
    </>
  );

  return (
    <ConnectivityModuleToolbar
      testId="security-headers-toolbar"
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Buscar por nombre, host o servidor..."
      searchAriaLabel="Buscar endpoint de cabeceras por nombre, URL o software de servidor"
      statusFilter={statusFilter}
      onStatusFilterChange={(next) =>
        onStatusFilterChange(next as SecurityHeaderStatusFilter)
      }
      statusChips={statusChips}
      leftExtra={leftExtra}
      filtersDialogLabel="Filtros de cabeceras de seguridad"
      filtersButtonTitle="Filtrar por fugas, blindaje, host, agrupación y densidad"
      activeFiltersCount={activeFiltersCount}
      onResetFilters={handleResetFilters}
      filterContent={filterContent}
      density={density}
      onDensityChange={onDensityChange}
      onExportCSV={onExportCSV}
      canExport={canExport}
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
    />
  );
}
