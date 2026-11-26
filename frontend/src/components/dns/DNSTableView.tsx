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
} from "lucide-react";
import type {
  DNSLinkedTarget,
  DNSRecord,
  DNSReferenceMode,
} from "../../types/dns";
import SelectionCheckbox from "../common/SelectionCheckbox";
import RelativeTime from "../common/connectivity/RelativeTime";
import StatusPill from "../common/connectivity/StatusPill";
import {
  TABLE_CELL,
  TABLE_CHECK_CELL,
  TABLE_HEAD_CELL,
  TABLE_HEAD_ROW,
  TABLE_PILL,
  getTableRowClass,
} from "../common/connectivity/tableTokens";
import DNSRowActions from "./DNSRowActions";
import {
  DNS_STATE_META,
  DNS_TYPE_TOOLTIPS,
  computeDNSDiff,
  formatDNSLatency,
  formatDNSTTL,
  getDNSErrorCodeLabel,
  getDNSHealthState,
  getDNSLatencyToneClass,
  getDNSLatencyTooltip,
  getDNSStateLabel,
  getTypeBadgeClass,
  parseDNSValues,
  type DNSDensity,
  type DNSRecordGroup,
  type DNSSortDir,
  type DNSSortKey,
} from "./useDNSRecords";

interface DNSTableViewProps {
  groups: DNSRecordGroup[];
  allVisibleRecords: DNSRecord[];
  selectedIds: string[];
  onToggleSelect: (record: DNSRecord) => void;
  onToggleSelectAll: () => void;
  density: DNSDensity;
  sortKey: DNSSortKey;
  sortDir: DNSSortDir;
  onSort: (key: DNSSortKey) => void;
  scanningId: string | null;
  acceptingRefId: string | null;
  linkingRecordId?: string | null;
  onSelectRecord: (record: DNSRecord) => void;
  onScan: (record: DNSRecord) => void;
  onAcceptReference: (record: DNSRecord, mode?: DNSReferenceMode) => void;
  onEdit: (record: DNSRecord) => void;
  onDelete: (record: DNSRecord) => void;
  onLinkTarget?: (record: DNSRecord, target: DNSLinkedTarget) => void;
}

export default function DNSTableView({
  groups,
  allVisibleRecords,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  density,
  sortKey,
  sortDir,
  onSort,
  scanningId,
  acceptingRefId,
  linkingRecordId = null,
  onSelectRecord,
  onScan,
  onAcceptReference,
  onEdit,
  onDelete,
  onLinkTarget,
}: DNSTableViewProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});

  const toggleGroup = (key: string) =>
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const rowHeightClass = getTableRowClass(density);
  const allSelected =
    allVisibleRecords.length > 0 &&
    selectedIds.length === allVisibleRecords.length;

  const SortIcon = ({ col }: { col: DNSSortKey }) => {
    if (sortKey !== col) {
      return <ArrowUpDown size={11} className="text-text-dim/60 shrink-0" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp size={11} className="text-accent-green shrink-0" />
    ) : (
      <ArrowDown size={11} className="text-accent-green shrink-0" />
    );
  };

  const renderRow = (record: DNSRecord) => {
    const isSelected = selectedIds.includes(record.id);
    const state = getDNSHealthState(record);
    const meta = DNS_STATE_META[state];
    const stateLabel = getDNSStateLabel(record, state);
    const values = parseDNSValues(record.value);
    const expectedValues = record.expected_values || [];
    const expectedSet = new Set(expectedValues.map((v) => v.toLowerCase()));

    const isTxt = record.record_type === "TXT";
    const isSpf = isTxt && record.value.includes("v=spf1");
    const isDmarc = isTxt && record.value.includes("v=DMARC1");

    const latestDiff = record.latest_change
      ? computeDNSDiff(
          record.latest_change.old_value,
          record.latest_change.new_value,
        )
      : null;

    const linkedTarget = record.linked_targets?.[0];
    const suggestedTarget = record.suggested_targets?.[0];

    const stateTooltipParts: string[] = [];
    if (state === "error") {
      stateTooltipParts.push(
        `${getDNSErrorCodeLabel(record)}${
          record.last_error_message ? `: ${record.last_error_message}` : ""
        }`,
      );
    } else if (state === "mismatch") {
      stateTooltipParts.push(`Esperado: ${expectedValues.join(", ")}`);
    } else if (state === "propagating") {
      const rrSummary = (record.resolver_results || [])
        .map(
          (r) =>
            `${r.resolver}: ${r.success ? r.values.join(", ") : r.error_type || "error"}`,
        )
        .join(" | ");
      stateTooltipParts.push(
        rrSummary ||
          "Cambio reciente dentro de la ventana de TTL o propagación entre resolvers",
      );
    } else if (record.resolver) {
      stateTooltipParts.push(`Resuelto vía ${record.resolver}`);
    }

    const valueTooltip = [
      ...values,
      state === "mismatch" && expectedValues.length > 0
        ? `Referencia esperada: ${expectedValues.join(", ")}`
        : null,
      latestDiff?.summary && state === "propagating"
        ? `Cambio reciente: ${latestDiff.summary}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    return (
      <tr
        key={record.id}
        tabIndex={0}
        aria-label={`${record.record_type} ${record.domain}`}
        onKeyDown={(e) => {
          if (
            e.target === e.currentTarget &&
            (e.key === "Enter" || e.key === " ")
          ) {
            e.preventDefault();
            onSelectRecord(record);
          }
        }}
        onClick={() => onSelectRecord(record)}
        className={`group ${rowHeightClass} transition-colors cursor-pointer hover:bg-bg-card-hover/70 focus:outline-none focus-visible:bg-bg-card-hover/80 ${
          isSelected
            ? "bg-accent-green/[0.04]"
            : state === "error" || state === "mismatch"
              ? "bg-rose-500/[0.025]"
              : state === "propagating"
                ? "bg-amber-500/[0.02]"
                : ""
        }`}
      >
        {/* Checkbox with mr-3 spacing before Estado */}
        <td
          className={TABLE_CHECK_CELL}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(record);
          }}
        >
          <SelectionCheckbox
            checked={isSelected}
            label={`Seleccionar ${record.record_type} ${record.domain}`}
            onChange={() => onToggleSelect(record)}
            className="mr-3"
          />
        </td>

        {/* Estado (full unified label, shape icon) */}
        <td
          className={`${TABLE_CELL} whitespace-nowrap`}
          title={stateTooltipParts.join(" · ") || undefined}
        >
          <StatusPill
            tone={meta.tone}
            shape={meta.shape}
            label={stateLabel}
            size="xs"
            title={stateTooltipParts.join(" · ") || stateLabel}
          />
        </td>

        {/* Tipo (neutral compact badge matching Uptime protocol pill scale) */}
        <td className={`${TABLE_CELL} whitespace-nowrap`}>
          <span
            title={
              DNS_TYPE_TOOLTIPS[record.record_type] ||
              `Registro ${record.record_type}`
            }
            className={`inline-flex items-center justify-center min-w-[32px] ${TABLE_PILL} rounded font-mono font-bold border ${getTypeBadgeClass(
              record.record_type,
            )}`}
          >
            {record.record_type}
          </span>
        </td>

        {/* Dominio (fixed sensible width with truncate) */}
        <td className={`${TABLE_CELL} max-w-0`}>
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="font-semibold text-text-main group-hover:text-accent-green transition-colors text-[13px] truncate"
              title={record.domain}
            >
              {record.domain}
            </span>

            {linkedTarget && (
              <Link
                to={`/monitoring?target=${encodeURIComponent(linkedTarget.id)}`}
                onClick={(e) => e.stopPropagation()}
                title={
                  linkedTarget.enabled
                    ? `Vinculado al target ${linkedTarget.name} en Uptime`
                    : `Vinculado a ${linkedTarget.name} (target pausado en Uptime)`
                }
                className={`hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[10px] font-medium shrink-0 max-w-[130px] transition-colors ${
                  linkedTarget.enabled
                    ? "bg-bg-dark border-border-base/80 text-text-muted hover:text-accent-green hover:border-accent-green/40"
                    : "bg-amber-500/10 border-amber-500/35 text-amber-300 hover:bg-amber-500/20"
                }`}
              >
                <ArrowUpRight size={10} className="shrink-0" />
                <span className="truncate">
                  {linkedTarget.name}
                  {!linkedTarget.enabled ? " (pausado)" : ""}
                </span>
              </Link>
            )}

            {!linkedTarget && suggestedTarget && onLinkTarget && (
              <button
                type="button"
                disabled={linkingRecordId === record.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onLinkTarget(record, suggestedTarget);
                }}
                title={`Vincular con el target ${suggestedTarget.name} en Uptime`}
                className="compact-btn hidden xl:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-dashed border-border-accent/80 bg-bg-dark/80 text-[10px] text-text-dim hover:text-accent-green hover:border-accent-green/50 transition-colors shrink-0 max-w-[140px] cursor-pointer"
              >
                <Link2 size={10} className="shrink-0" />
                <span className="truncate">Vincular: {suggestedTarget.name}</span>
              </button>
            )}
          </div>
        </td>

        {/* Resuelve a (absorbs flexible width) */}
        <td className={`${TABLE_CELL} w-full max-w-0`}>
          {values.length > 0 ? (
            <div
              className="flex items-center gap-1.5 min-w-0 font-mono text-xs"
              title={valueTooltip}
            >
              {state === "mismatch" && values.length <= 4 ? (
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  {values.map((val, idx) => {
                    const isUnexpected =
                      expectedSet.size > 0 &&
                      !expectedSet.has(val.toLowerCase());
                    return (
                      <span
                        key={idx}
                        className={`truncate ${
                          isUnexpected
                            ? "text-rose-300 bg-rose-500/15 px-1 rounded"
                            : "text-text-muted"
                        }`}
                      >
                        {val}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <>
                  <span className="text-text-muted truncate">
                    {values.length <= 2 ? values.join(", ") : values[0]}
                  </span>
                  {values.length > 2 && (
                    <span className="px-1.5 py-0.2 rounded bg-bg-dark border border-border-base text-[10px] font-semibold text-text-dim shrink-0">
                      +{values.length - 1}
                    </span>
                  )}
                </>
              )}
              {isSpf && (
                <span className="px-1.5 py-0.2 rounded bg-slate-700/60 text-slate-200 border border-slate-600/80 text-[10px] font-bold shrink-0">
                  SPF
                </span>
              )}
              {isDmarc && (
                <span className="px-1.5 py-0.2 rounded bg-violet-500/15 text-violet-300 border border-violet-500/35 text-[10px] font-bold shrink-0">
                  DMARC
                </span>
              )}
            </div>
          ) : (
            <span
              className={`text-xs font-mono ${
                state === "error" ? "text-rose-400" : "text-text-dim"
              }`}
              title={record.last_error_message || undefined}
            >
              {state === "error"
                ? getDNSErrorCodeLabel(record)
                : "Pendiente"}
            </span>
          )}
        </td>

        {/* TTL */}
        <td className={`${TABLE_CELL} font-mono text-xs text-text-muted whitespace-nowrap tabular-nums`}>
          {formatDNSTTL(record.ttl)}
        </td>

        {/* Latencia (clarified tooltip: principal resolver vs secondary resolvers) */}
        <td
          className={`${TABLE_CELL} font-mono text-xs whitespace-nowrap tabular-nums text-right ${getDNSLatencyToneClass(
            record.response_time_ms,
          )}`}
          title={getDNSLatencyTooltip(record)}
        >
          {formatDNSLatency(record.response_time_ms)}
        </td>

        {/* Revisado */}
        <td className={`${TABLE_CELL} text-xs text-text-dim whitespace-nowrap tabular-nums`}>
          <RelativeTime
            value={record.last_scanned_at}
            emptyLabel="Nunca"
            className="font-mono text-[11px]"
          />
        </td>

        {/* Acciones (hover / keyboard focus-within / touch) */}
        <td className="pl-1 pr-3 py-0 align-middle text-right whitespace-nowrap">
          <DNSRowActions
            record={record}
            variant="table"
            isScanning={scanningId === record.id}
            isAcceptingRef={acceptingRefId === record.id}
            onScan={onScan}
            onAcceptReference={onAcceptReference}
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
        <table className="w-full table-fixed text-left text-xs border-collapse">
          <colgroup>
            <col className="w-11" />
            <col className="w-[172px]" />
            <col className="w-[64px]" />
            <col className="w-[270px]" />
            <col className="w-full" />
            <col className="w-[72px]" />
            <col className="w-[82px]" />
            <col className="w-[104px]" />
            <col className="w-[116px]" />
          </colgroup>
          <thead>
            <tr
              className={`${TABLE_HEAD_ROW} border-b border-border-base text-text-dim font-medium bg-bg-dark/80 select-none`}
            >
              <th scope="col" className={TABLE_CHECK_CELL}>
                <SelectionCheckbox
                  checked={allSelected}
                  label="Seleccionar todos los registros de esta página"
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
                Tipo
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
                Resuelve a
              </th>
              <th scope="col" className={TABLE_HEAD_CELL}>
                TTL
              </th>
              <th
                scope="col"
                className={`${TABLE_HEAD_CELL} text-right`}
                title="Latencia del resolver principal (1.1.1.1)"
              >
                <button
                  type="button"
                  onClick={() => onSort("latency")}
                  className="compact-btn inline-flex items-center justify-end gap-1 hover:text-text-main transition-colors cursor-pointer"
                >
                  <span>Latencia</span>
                  <SortIcon col="latency" />
                </button>
              </th>
              <th scope="col" className={TABLE_HEAD_CELL}>
                <button
                  type="button"
                  onClick={() => onSort("checked")}
                  className="compact-btn inline-flex items-center gap-1 hover:text-text-main transition-colors cursor-pointer"
                >
                  <span>Revisado</span>
                  <SortIcon col="checked" />
                </button>
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
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-text-muted hover:text-text-main cursor-pointer !min-h-0 !min-w-0"
                        >
                          {isCollapsed ? (
                            <ChevronRight size={13} />
                          ) : (
                            <ChevronDown size={13} />
                          )}
                          <span className="font-mono">{group.label}</span>
                          <span className="px-1.5 py-0.2 rounded-full bg-bg-card border border-border-base text-[10px] font-mono text-text-dim">
                            {group.records.length}
                          </span>
                        </button>
                      </td>
                    </tr>
                  )}
                  {!isCollapsed && group.records.map(renderRow)}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
