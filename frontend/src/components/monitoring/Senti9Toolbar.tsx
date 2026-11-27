import ConnectivityModuleToolbar, {
  type ToolbarStatusChip,
} from "../common/connectivity/ConnectivityModuleToolbar";
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

  const statusChips: ToolbarStatusChip[] = [
    {
      key: "connected",
      label: `${summary.connectedCount} ${summary.connectedCount === 1 ? "conectado" : "conectados"}`,
      count: summary.connectedCount,
      tone: "success",
      title: "Filtrar por guardianes conectados",
    },
    {
      key: "stale_signal",
      label: `${summary.staleCount} sin señal`,
      count: summary.staleCount,
      tone: "warning",
      pulse: true,
      hideWhenZero: true,
      title: "Filtrar por guardianes sin señal reciente (46 s a 2 min)",
    },
    {
      key: "disconnected",
      label: `${summary.disconnectedCount} ${summary.disconnectedCount === 1 ? "desconectado" : "desconectados"}`,
      count: summary.disconnectedCount,
      tone: "danger",
      pulse: true,
      title: "Filtrar por guardianes desconectados",
    },
    {
      key: "pending",
      label: `${summary.pendingCount} esperando`,
      count: summary.pendingCount,
      tone: "warning",
      title: "Filtrar por guardianes esperando primera señal",
    },
    {
      key: "paused",
      label: `${summary.pausedCount} ${summary.pausedCount === 1 ? "pausado" : "pausados"}`,
      count: summary.pausedCount,
      tone: "neutral",
      hideWhenZero: true,
      title: "Filtrar por guardianes pausados",
    },
    {
      key: "revoked",
      label: `${summary.revokedCount} ${summary.revokedCount === 1 ? "revocado" : "revocados"}`,
      count: summary.revokedCount,
      tone: "neutral",
      title: "Filtrar por guardianes revocados",
    },
  ];

  const leftExtra = (
    <div className="hidden lg:flex items-center gap-2 pl-2 ml-1 border-l border-border-base/80 font-mono text-[11px] text-text-dim whitespace-nowrap shrink-0">
      <span title="Mediciones pendientes de enviar a Sentinel en todos los guardianes activos">
        Cola total{" "}
        <strong className={queueWarn ? "text-amber-400" : "text-text-main"}>
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
  );

  const filterContent = (
    <>
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

      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-text-muted">
          Última señal
        </label>
        <select
          value={signalRangeFilter}
          onChange={(e) =>
            onSignalRangeFilterChange(e.target.value as GuardianSignalRange)
          }
          aria-label="Filtrar por rango de última señal"
          className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer"
        >
          <option value="all">Cualquier momento</option>
          <option value="5m">Últimos 5 minutos</option>
          <option value="1h">Última hora</option>
          <option value="24h">Últimas 24 horas</option>
          <option value="stale">Atrasada (&gt; 45 s)</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-text-muted">
          Agrupar por
        </label>
        <select
          value={groupBy}
          onChange={(e) => onGroupByChange(e.target.value as GuardianGroupBy)}
          aria-label="Agrupar guardianes"
          className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer"
        >
          <option value="none">Sin agrupar</option>
          <option value="platform">Plataforma</option>
          <option value="version">Versión</option>
        </select>
      </div>
    </>
  );

  return (
    <ConnectivityModuleToolbar
      testId="senti9-toolbar"
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Buscar guardián..."
      searchAriaLabel="Buscar guardián por nombre, host, IP o versión"
      statusFilter={statusFilter}
      onStatusFilterChange={onStatusFilterChange}
      statusChips={statusChips}
      leftExtra={leftExtra}
      filtersDialogLabel="Filtros de guardianes Senti9"
      filtersButtonTitle="Filtrar por plataforma, versión, última señal, agrupación y densidad"
      activeFiltersCount={activeFiltersCount}
      onResetFilters={handleResetFilters}
      filterContent={filterContent}
      density={density}
      onDensityChange={onDensityChange}
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
    />
  );
}
