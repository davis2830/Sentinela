import type { APICheckStats } from "../../types/api_checks";
import ConnectivityModuleToolbar, {
  type ToolbarStatusChip,
} from "../common/connectivity/ConnectivityModuleToolbar";
import {
  ALL_HTTP_METHODS,
  type APICheckDensity,
  type APICheckGroupBy,
  type APICheckSchemaFilter,
  type APICheckSummaryMetrics,
} from "./useAPIChecks";

interface APICheckToolbarProps {
  stats?: APICheckStats;
  summary: APICheckSummaryMetrics;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  methodFilter: string;
  onMethodFilterChange: (value: string) => void;
  hostFilter: string;
  onHostFilterChange: (value: string) => void;
  schemaFilter: APICheckSchemaFilter;
  onSchemaFilterChange: (value: APICheckSchemaFilter) => void;
  facets: {
    hosts: string[];
  };
  groupBy: APICheckGroupBy;
  onGroupByChange: (value: APICheckGroupBy) => void;
  density: APICheckDensity;
  onDensityChange: (value: APICheckDensity) => void;
  search: string;
  onSearchChange: (value: string) => void;
  viewMode: "grid" | "table";
  onViewModeChange: (value: "grid" | "table") => void;
  onExportCSV: () => void;
  canExport: boolean;
}

export default function APICheckToolbar({
  stats,
  summary,
  statusFilter,
  onStatusFilterChange,
  methodFilter,
  onMethodFilterChange,
  hostFilter,
  onHostFilterChange,
  schemaFilter,
  onSchemaFilterChange,
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
}: APICheckToolbarProps) {
  const activeFiltersCount =
    (methodFilter !== "all" ? 1 : 0) +
    (hostFilter !== "all" ? 1 : 0) +
    (schemaFilter !== "all" ? 1 : 0) +
    (groupBy !== "none" ? 1 : 0);

  const handleResetFilters = () => {
    onMethodFilterChange("all");
    onHostFilterChange("all");
    onSchemaFilterChange("all");
    onGroupByChange("none");
  };

  const failCount = stats?.fail_count ?? summary.failCount;
  const rateLimitedCount =
    stats?.rate_limited_count ?? summary.rateLimitedCount;
  const slowCount = stats?.slow_count ?? summary.slowCount;
  const passCount = stats?.pass_count ?? summary.passCount;
  const pausedCount = stats?.paused_count ?? summary.pausedCount;
  const pendingCount = stats?.pending_count ?? summary.pendingCount;
  const avgLatency =
    stats?.avg_latency !== null && stats?.avg_latency !== undefined
      ? Math.round(stats.avg_latency)
      : summary.avgLatencyMs;

  const statusChips: ToolbarStatusChip[] = [
    {
      key: "fail",
      label: `${failCount} ${failCount === 1 ? "con fallo" : "con fallos"}`,
      count: failCount,
      tone: "danger",
      pulse: true,
      title: "Endpoints con error de conexión, código inesperado o contrato roto",
    },
    {
      key: "rate_limited",
      label: `${rateLimitedCount} ${rateLimitedCount === 1 ? "limitado" : "limitados"}`,
      count: rateLimitedCount,
      tone: "warning",
      hideWhenZero: true,
      title: "Respuestas HTTP 429 (límite de velocidad del servidor, no es una caída)",
    },
    {
      key: "slow",
      label: `${slowCount} ${slowCount === 1 ? "lento" : "lentos"}`,
      count: slowCount,
      tone: "warning",
      title: "Endpoints cuya latencia superó su límite configurado",
    },
    {
      key: "pass",
      label: `${passCount} ${passCount === 1 ? "correcto" : "correctos"}`,
      count: passCount,
      tone: "success",
      title: "Endpoints que cumplen código, latencia y contrato",
    },
    {
      key: "paused",
      label: `${pausedCount} ${pausedCount === 1 ? "pausado" : "pausados"}`,
      count: pausedCount,
      tone: "neutral",
      hideWhenZero: true,
      title: "Endpoints con monitoreo pausado",
    },
    {
      key: "pending",
      label: `${pendingCount} ${pendingCount === 1 ? "pendiente" : "pendientes"}`,
      count: pendingCount,
      tone: "neutral",
      hideWhenZero: true,
      title: "Endpoints sin ejecución registrada todavía",
    },
  ];

  return (
    <ConnectivityModuleToolbar
      testId="api-checks-toolbar"
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Buscar por nombre, host o ruta..."
      searchAriaLabel="Buscar por nombre de API, host o ruta"
      statusFilter={statusFilter}
      onStatusFilterChange={onStatusFilterChange}
      statusChips={statusChips}
      filtersDialogLabel="Filtros de API Endpoints"
      filtersButtonTitle="Filtrar por método HTTP, host, schema, agrupación y densidad"
      activeFiltersCount={activeFiltersCount}
      onResetFilters={handleResetFilters}
      density={density}
      onDensityChange={onDensityChange}
      onExportCSV={onExportCSV}
      canExport={canExport}
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
      leftExtra={
        avgLatency != null ? (
          <div
            className="hidden xl:flex items-center pl-2.5 ml-1 border-l border-border-base/80 shrink-0 font-mono text-[11px] text-text-dim whitespace-nowrap"
            title="Latencia promedio de los endpoints activos"
          >
            <span>Latencia prom.</span>
            <span className="ml-1.5 font-semibold text-text-main tabular-nums">
              {avgLatency} ms
            </span>
          </div>
        ) : undefined
      }
      filterContent={
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-text-muted">
                Método HTTP
              </label>
              <select
                value={methodFilter}
                onChange={(e) => onMethodFilterChange(e.target.value)}
                aria-label="Filtrar por método HTTP"
                className="w-full bg-bg-dark border border-border-base rounded-lg px-2 py-1.5 text-xs text-text-main font-mono focus:border-accent-green focus:outline-none cursor-pointer"
              >
                <option value="all">Todos</option>
                {ALL_HTTP_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-text-muted">
                Contrato Schema
              </label>
              <select
                value={schemaFilter}
                onChange={(e) =>
                  onSchemaFilterChange(e.target.value as APICheckSchemaFilter)
                }
                aria-label="Filtrar por contrato Schema"
                className="w-full bg-bg-dark border border-border-base rounded-lg px-2 py-1.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer"
              >
                <option value="all">Todos</option>
                <option value="with_schema">Con contrato</option>
                <option value="without_schema">Sin contrato</option>
              </select>
            </div>
          </div>

          {facets.hosts.length > 0 && (
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
                {facets.hosts.map((h) => (
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
                onGroupByChange(e.target.value as APICheckGroupBy)
              }
              aria-label="Agrupar API endpoints"
              className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer"
            >
              <option value="none">Sin agrupar</option>
              <option value="status">Estado</option>
              <option value="method">Método HTTP</option>
              <option value="host">Host</option>
            </select>
          </div>
        </>
      }
    />
  );
}
