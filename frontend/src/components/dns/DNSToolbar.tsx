import { Layers } from "lucide-react";
import type { DNSRecordType } from "../../types/dns";
import ConnectivityModuleToolbar, {
  type ToolbarStatusChip,
} from "../common/connectivity/ConnectivityModuleToolbar";
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

  const statusChips: ToolbarStatusChip[] = [
    {
      key: "error",
      label: `${summary.errorCount} con error`,
      count: summary.errorCount,
      tone: "danger",
      pulse: true,
      title: "Error de resolución: NXDOMAIN, SERVFAIL o timeout",
    },
    {
      key: "mismatch",
      label: `${summary.mismatchCount} fuera de referencia`,
      count: summary.mismatchCount,
      tone: "danger",
      title:
        "Fuera de referencia: persiste un valor distinto a la referencia esperada",
    },
    {
      key: "propagating",
      label: `${summary.propagatingCount} propagando`,
      count: summary.propagatingCount,
      tone: "warning",
      title:
        "Propagando: cambió hace menos de un TTL o los resolvers públicos aún discrepan",
    },
    {
      key: "rotating",
      label: `${summary.rotatingCount} rotando`,
      count: summary.rotatingCount,
      tone: "info",
      hideWhenZero: true,
      title:
        "Rotando: el proveedor alterna IPs del mismo rango; considera definir referencia por rango /24",
    },
    {
      key: "resolved",
      label: `${summary.resolvedCount} ${summary.resolvedCount === 1 ? "resuelto" : "resueltos"}`,
      count: summary.resolvedCount,
      tone: "success",
      title:
        "Resuelto: coincide con la referencia o responde de forma consistente",
    },
  ];

  return (
    <ConnectivityModuleToolbar
      testId="dns-toolbar"
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Buscar dominio, host o IP..."
      searchAriaLabel="Buscar dominio, host o IP resuelta"
      statusFilter={statusFilter}
      onStatusFilterChange={onStatusFilterChange}
      statusChips={statusChips}
      filtersDialogLabel="Filtros de registros DNS"
      filtersButtonTitle="Filtrar por tipo de registro, zona DNS, resolver, agrupación y densidad"
      activeFiltersCount={activeFiltersCount}
      onResetFilters={handleResetFilters}
      density={density}
      onDensityChange={onDensityChange}
      onExportCSV={onExportCSV}
      canExport={canExport}
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
      leftExtra={
        summary.avgLatencyMs != null ? (
          <div
            className="hidden xl:flex items-center pl-2.5 ml-1 border-l border-border-base/80 shrink-0 font-mono text-[11px] text-text-dim whitespace-nowrap"
            title="Latencia promedio del resolver principal (1.1.1.1) entre los registros visibles"
          >
            <span>Latencia prom.</span>
            <span className="ml-1.5 font-semibold text-text-main tabular-nums">
              {formatDNSLatency(summary.avgLatencyMs)}
            </span>
          </div>
        ) : undefined
      }
      rightExtra={
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
      }
      filterContent={
        <>
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
              onChange={(e) => onGroupByChange(e.target.value as DNSGroupBy)}
              aria-label="Agrupar registros DNS"
              className="w-full bg-bg-dark border border-border-base rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:border-accent-green focus:outline-none cursor-pointer"
            >
              <option value="none">Sin agrupar</option>
              <option value="zone">Zona DNS</option>
              <option value="type">Tipo de registro</option>
              <option value="status">Estado</option>
            </select>
          </div>
        </>
      }
    />
  );
}
