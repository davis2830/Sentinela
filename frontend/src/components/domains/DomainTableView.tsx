import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Link2,
  Lock,
  Unlock,
} from "lucide-react";
import type { DomainInfo, DomainLinkedTarget } from "../../types/domain";
import SelectionCheckbox from "../common/SelectionCheckbox";
import RelativeTime from "../common/connectivity/RelativeTime";
import StatusPill from "../common/connectivity/StatusPill";
import {
  TABLE_CELL,
  TABLE_CHECK_CELL,
  TABLE_HEAD_CELL,
  TABLE_HEAD_ROW,
  getTableRowClass,
} from "../common/connectivity/tableTokens";
import DomainRowActions from "./DomainRowActions";
import {
  DOMAIN_STATE_META,
  formatDomainDate,
  formatDomainExpiredAgo,
  getDomainHealthState,
  getDomainRelatedTargets,
  getDomainRemainingPercent,
  getEffectiveDaysRemaining,
  getEffectiveExpirationIso,
  parseDomainNameServers,
  type DomainDensity,
  type DomainGroup,
  type DomainSortDir,
  type DomainSortKey,
  type DomainThresholds,
} from "./useDomains";

interface DomainTableViewProps {
  groups: DomainGroup[];
  allVisibleDomains: DomainInfo[];
  activeDomainId?: string | null;
  thresholds: DomainThresholds;
  selectedIds: string[];
  onToggleSelect: (domain: DomainInfo) => void;
  onToggleSelectAll: () => void;
  density: DomainDensity;
  sortKey: DomainSortKey;
  sortDir: DomainSortDir;
  onSort: (key: DomainSortKey) => void;
  scanningId: string | null;
  linkingDomainId?: string | null;
  onSelectDomain: (domain: DomainInfo) => void;
  onScan: (domain: DomainInfo) => void;
  onEdit: (domain: DomainInfo) => void;
  onDelete: (domain: DomainInfo) => void;
  onLinkTarget?: (domain: DomainInfo, target: DomainLinkedTarget) => void;
}

export default function DomainTableView({
  groups,
  allVisibleDomains,
  activeDomainId = null,
  thresholds,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  density,
  sortKey,
  sortDir,
  onSort,
  scanningId,
  linkingDomainId = null,
  onSelectDomain,
  onScan,
  onEdit,
  onDelete,
  onLinkTarget,
}: DomainTableViewProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});

  const toggleGroup = (key: string) =>
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const rowHeightClass = getTableRowClass(density);
  const allSelected =
    allVisibleDomains.length > 0 &&
    selectedIds.length === allVisibleDomains.length;

  const SortIcon = ({ col }: { col: DomainSortKey }) => {
    if (sortKey !== col) {
      return <ArrowUpDown size={11} className="text-text-dim/60 shrink-0" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp size={11} className="text-accent-green shrink-0" />
    ) : (
      <ArrowDown size={11} className="text-accent-green shrink-0" />
    );
  };

  const renderRow = (domain: DomainInfo) => {
    const isSelected = selectedIds.includes(domain.id);
    const isActive = activeDomainId === domain.id;
    const state = getDomainHealthState(domain, thresholds);
    const meta = DOMAIN_STATE_META[state];
    const days = getEffectiveDaysRemaining(domain);
    const expIso = getEffectiveExpirationIso(domain);
    const remainingPct = getDomainRemainingPercent(domain);
    const nsList = parseDomainNameServers(domain.name_servers);
    const relatedTargets = getDomainRelatedTargets(domain);
    const primaryTarget = relatedTargets[0];
    const extraTargetsCount = Math.max(0, relatedTargets.length - 1);
    const suggestedTarget = domain.suggested_targets?.[0];
    const nsTooltip =
      domain.ns_health?.servers && domain.ns_health.servers.length > 0
        ? domain.ns_health.servers
            .map((s) =>
              s.responding
                ? `${s.host} (${s.latency_ms ?? "?"} ms)`
                : `${s.host} (sin respuesta)`,
            )
            .join("\n")
        : nsList.length > 0
          ? nsList.join("\n")
          : "Sin servidores de nombres registrados";

    const expiryToneClass =
      state === "expired" || state === "critical"
        ? "text-rose-400 font-semibold"
        : state === "expiring"
          ? "text-amber-400 font-semibold"
          : "text-text-main font-semibold";

    const barColorClass =
      state === "expired" || state === "critical"
        ? "bg-rose-500"
        : state === "expiring"
          ? "bg-amber-400"
          : "bg-emerald-400/80";

    const stateTooltip =
      state === "changed"
        ? "Cambios detectados en registrador, nameservers o bloqueo de transferencia"
        : state === "no_data"
          ? "El registro TLD no expone datos RDAP/WHOIS; puedes agregar fecha de vencimiento manual"
          : state === "expiring" || state === "critical"
            ? `Por expirar (aviso ≤ ${thresholds.warningDays} d · crítico ≤ ${thresholds.criticalDays} d)`
            : meta.label;

    return (
      <tr
        key={domain.id}
        tabIndex={0}
        aria-label={domain.domain}
        onKeyDown={(e) => {
          if (
            e.target === e.currentTarget &&
            (e.key === "Enter" || e.key === " ")
          ) {
            e.preventDefault();
            onSelectDomain(domain);
          }
        }}
        onClick={() => onSelectDomain(domain)}
        className={`group ${rowHeightClass} transition-colors cursor-pointer hover:bg-bg-card-hover/70 focus:outline-none focus-visible:bg-bg-card-hover/80 ${
          isActive
            ? "bg-accent-green/[0.08] ring-1 ring-inset ring-accent-green/35"
            : isSelected
              ? "bg-accent-green/[0.04]"
              : state === "expired" || state === "critical"
                ? "bg-rose-500/[0.025]"
                : state === "expiring" || state === "changed"
                  ? "bg-amber-500/[0.02]"
                  : ""
        }`}
      >
        {/* Checkbox */}
        <td
          className={TABLE_CHECK_CELL}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(domain);
          }}
        >
          <SelectionCheckbox
            checked={isSelected}
            label={`Seleccionar ${domain.domain}`}
            onChange={() => onToggleSelect(domain)}
            className="mr-3"
          />
        </td>

        {/* Estado */}
        <td className={`${TABLE_CELL} whitespace-nowrap`} title={stateTooltip}>
          <StatusPill
            tone={meta.tone}
            shape={meta.shape}
            label={meta.label}
            size="xs"
            title={stateTooltip}
          />
        </td>

        {/* Dominio (flexible w-full max-w-0) + Uptime link chip */}
        <td className={`${TABLE_CELL} w-full max-w-0`}>
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="font-semibold text-text-main group-hover:text-accent-green transition-colors text-[13px] truncate"
              title={domain.domain}
            >
              {domain.domain}
            </span>

            {primaryTarget && (
              <Link
                to={
                  extraTargetsCount > 0
                    ? `/monitoring?search=${encodeURIComponent(domain.domain)}`
                    : `/monitoring?target=${encodeURIComponent(primaryTarget.id)}`
                }
                onClick={(e) => e.stopPropagation()}
                title={
                  extraTargetsCount > 0
                    ? `Targets relacionados: ${relatedTargets
                        .map((t) => `${t.name}${t.enabled ? "" : " (pausado)"}`)
                        .join(" · ")}`
                    : primaryTarget.enabled
                      ? `Vinculado al target ${primaryTarget.name} en Uptime`
                      : `Vinculado a ${primaryTarget.name} (pausado en Uptime)`
                }
                className={`hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[10px] font-medium shrink-0 max-w-[175px] transition-colors ${
                  primaryTarget.enabled
                    ? "bg-bg-dark border-border-base/80 text-text-muted hover:text-accent-green hover:border-accent-green/40"
                    : "bg-amber-500/10 border-amber-500/35 text-amber-300 hover:bg-amber-500/20"
                }`}
              >
                <ArrowUpRight size={10} className="shrink-0" />
                <span className="truncate">
                  {primaryTarget.name}
                  {!primaryTarget.enabled ? " (pausado)" : ""}
                </span>
                {extraTargetsCount > 0 && (
                  <span className="font-mono text-[10px] text-text-dim shrink-0 ml-0.5">
                    +{extraTargetsCount}
                  </span>
                )}
              </Link>
            )}

            {!primaryTarget && suggestedTarget && onLinkTarget && (
              <button
                type="button"
                disabled={linkingDomainId === domain.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onLinkTarget(domain, suggestedTarget);
                }}
                title={`Vincular con el target ${suggestedTarget.name} en Uptime`}
                className="compact-btn hidden xl:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-dashed border-border-accent/80 bg-bg-dark/80 text-[10px] text-text-dim hover:text-accent-green hover:border-accent-green/50 transition-colors shrink-0 max-w-[145px] cursor-pointer"
              >
                <Link2 size={10} className="shrink-0" />
                <span className="truncate">
                  Vincular: {suggestedTarget.name}
                </span>
              </button>
            )}
          </div>
        </td>

        {/* Registrador */}
        <td className={`${TABLE_CELL} max-w-0`}>
          <span
            className="block truncate text-xs text-text-muted"
            title={domain.registrar || "Sin registrador reportado"}
          >
            {domain.registrar || "—"}
          </span>
        </td>

        {/* Bloqueo de transferencia */}
        <td className={`${TABLE_CELL} whitespace-nowrap`}>
          {domain.is_locked === true ? (
            <span
              className="inline-flex items-center gap-1 text-xs text-text-muted"
              title="Bloqueo de transferencia activo: el dominio no puede transferirse sin autorización"
            >
              <Lock size={13} className="text-emerald-400 shrink-0" />
              <span>Bloqueado</span>
            </span>
          ) : domain.is_locked === false ? (
            <span
              className="inline-flex items-center gap-1 text-xs text-amber-300 font-medium"
              title="Sin bloqueo: el dominio podría transferirse a otro registrador"
            >
              <Unlock size={13} className="text-amber-400 shrink-0" />
              <span>Sin bloqueo</span>
            </span>
          ) : (
            <span
              className="text-xs text-text-dim"
              title="El registro no informa el estado del bloqueo de transferencia"
            >
              —
            </span>
          )}
        </td>

        {/* Vence: single-line text + 2px bottom progress bar so row stays 48px */}
        <td
          className={`${TABLE_CELL} relative whitespace-nowrap`}
          title={
            days !== null && remainingPct !== null
              ? `${remainingPct} % restante${
                  !domain.expiration_date && domain.manual_expiration_date
                    ? " (fecha manual)"
                    : ""
                }`
              : undefined
          }
        >
          {days !== null ? (
            <>
              <div className="flex items-center gap-1.5 font-mono text-xs tabular-nums">
                <span className={expiryToneClass}>
                  {days <= 0 ? formatDomainExpiredAgo(days) : `en ${days} d`}
                </span>
                {expIso && days > 0 && (
                  <span className="text-[11px] text-text-dim">
                    · {formatDomainDate(expIso)}
                  </span>
                )}
              </div>
              {remainingPct !== null && (
                <div className="pointer-events-none absolute inset-x-3 bottom-1 h-[2px] rounded-full bg-bg-dark overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColorClass}`}
                    style={{ width: `${Math.max(remainingPct, 3)}%` }}
                  />
                </div>
              )}
            </>
          ) : (
            <span className="text-xs text-text-dim font-mono">Sin fecha</span>
          )}
        </td>

        {/* NS */}
        <td
          className={`${TABLE_CELL} font-mono text-xs text-text-muted whitespace-nowrap tabular-nums`}
          title={nsTooltip}
        >
          {nsList.length > 0 ? `${nsList.length} NS` : "—"}
        </td>

        {/* Revisado */}
        <td
          className={`${TABLE_CELL} text-xs text-text-dim whitespace-nowrap tabular-nums`}
          title="Última consulta RDAP/WHOIS (frecuencia automática: cada 12 h)"
        >
          <RelativeTime
            value={domain.last_scanned_at}
            emptyLabel="Nunca"
            className="font-mono text-[11px]"
          />
        </td>

        {/* Acciones */}
        <td className="pl-1 pr-3 py-0 align-middle text-right whitespace-nowrap">
          <DomainRowActions
            domain={domain}
            variant="table"
            isScanning={scanningId === domain.id}
            onScan={onScan}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </td>
      </tr>
    );
  };

  return (
    <div
      data-testid="connectivity-table"
      className="connectivity-directory-table w-full max-w-[1400px] mx-auto min-w-0 bg-bg-card border border-border-base/80 rounded-2xl overflow-hidden shadow-sm"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] table-fixed text-left text-xs border-collapse">
          <colgroup>
            <col className="w-11" />
            <col className="w-[132px]" />
            <col />
            <col className="w-[200px]" />
            <col className="w-[126px]" />
            <col className="w-[186px]" />
            <col className="w-[74px]" />
            <col className="w-[104px]" />
            <col className="w-[88px]" />
          </colgroup>
          <thead>
            <tr
              className={`${TABLE_HEAD_ROW} border-b border-border-base text-text-dim font-medium bg-bg-dark/80 select-none`}
            >
              <th scope="col" className={TABLE_CHECK_CELL}>
                <SelectionCheckbox
                  checked={allSelected}
                  label="Seleccionar todos los dominios de esta página"
                  onChange={onToggleSelectAll}
                  className="mr-3"
                />
              </th>
              <th scope="col" className={TABLE_HEAD_CELL}>
                <button
                  type="button"
                  onClick={() => onSort("status")}
                  className="compact-btn inline-flex items-center gap-1 hover:text-text-main transition-colors cursor-pointer"
                >
                  <span>Estado</span>
                  <SortIcon col="status" />
                </button>
              </th>
              <th scope="col" className={TABLE_HEAD_CELL}>
                <button
                  type="button"
                  onClick={() => onSort("domain")}
                  className="compact-btn inline-flex items-center gap-1 hover:text-text-main transition-colors cursor-pointer"
                >
                  <span>Dominio</span>
                  <SortIcon col="domain" />
                </button>
              </th>
              <th scope="col" className={TABLE_HEAD_CELL}>
                Registrador
              </th>
              <th scope="col" className={TABLE_HEAD_CELL}>
                Bloqueo
              </th>
              <th scope="col" className={TABLE_HEAD_CELL}>
                <button
                  type="button"
                  onClick={() => onSort("expiry")}
                  className="compact-btn inline-flex items-center gap-1 hover:text-text-main transition-colors cursor-pointer"
                >
                  <span>Vence</span>
                  <SortIcon col="expiry" />
                </button>
              </th>
              <th scope="col" className={TABLE_HEAD_CELL}>
                NS
              </th>
              <th scope="col" className={TABLE_HEAD_CELL}>
                Revisado
              </th>
              <th
                scope="col"
                className="pl-1 pr-3 py-0 align-middle text-right"
              >
                Acciones
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border-base/40">
            {groups.map((group) => {
              const isGrouped = group.key !== "all";
              const isCollapsed = Boolean(collapsedGroups[group.key]);
              return (
                <Fragment key={group.key}>
                  {isGrouped && (
                    <tr className="bg-bg-dark/60 border-t border-border-base/60">
                      <td colSpan={9} className="py-1.5 px-4">
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.key)}
                          className="compact-btn inline-flex items-center gap-1.5 text-[11px] font-semibold text-text-muted hover:text-text-main cursor-pointer"
                        >
                          {isCollapsed ? (
                            <ChevronRight size={13} />
                          ) : (
                            <ChevronDown size={13} />
                          )}
                          <span>{group.label}</span>
                          <span className="px-1.5 py-0.2 rounded-full bg-bg-card border border-border-base text-[10px] font-mono text-text-dim">
                            {group.domains.length}
                          </span>
                        </button>
                      </td>
                    </tr>
                  )}
                  {!isCollapsed && group.domains.map(renderRow)}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
