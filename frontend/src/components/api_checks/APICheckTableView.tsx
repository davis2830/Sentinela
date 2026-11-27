import { Fragment } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import type { APICheckRecentResult, APICheckTarget } from "../../types/api_checks";
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
import APICheckRowActions from "./APICheckRowActions";
import {
  API_STATE_META,
  formatApiInterval,
  formatResultStatusEs,
  getAPICheckHealthState,
  getApiFailureReason,
  getLatencyOwnColor,
  getMethodBadgeClass,
  getSchemaContractSummary,
  stripProtocol,
  type APICheckDensity,
  type APICheckGroup,
  type APICheckSortField,
} from "./useAPIChecks";

export interface APICheckTableViewProps {
  targets: APICheckTarget[];
  groups: APICheckGroup[] | null;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  density: APICheckDensity;
  sortField: APICheckSortField;
  sortAsc: boolean;
  onSort: (field: APICheckSortField) => void;
  selectedIds: string[];
  onToggleSelect: (target: APICheckTarget) => void;
  onSelectAll: () => void;
  onSelectTarget: (target: APICheckTarget) => void;
  onScan: (target: APICheckTarget) => void;
  scanningId: string | null;
  onEdit: (target: APICheckTarget) => void;
  onDelete: (target: APICheckTarget) => void;
}

function getBarColorClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "pass") return "bg-emerald-400";
  if (s === "slow" || s === "rate_limited") return "bg-amber-400";
  if (s === "fail" || s === "error") return "bg-rose-500";
  return "bg-zinc-700";
}

function formatBarTooltip(item: APICheckRecentResult): string {
  const time = item.checked_at
    ? new Date(item.checked_at).toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "";
  const parts = [formatResultStatusEs(item.status)];
  if (item.http_status != null) parts.push(`HTTP ${item.http_status}`);
  if (item.response_time_ms != null) {
    parts.push(`${Math.round(item.response_time_ms)} ms`);
  }
  if (item.reason) parts.push(item.reason);
  if (time) parts.push(time);
  return parts.join(" · ");
}

export default function APICheckTableView({
  targets,
  groups,
  collapsedGroups,
  onToggleGroup,
  density,
  sortField,
  sortAsc,
  onSort,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onSelectTarget,
  onScan,
  scanningId,
  onEdit,
  onDelete,
}: APICheckTableViewProps) {
  const allSelected =
    targets.length > 0 && selectedIds.length === targets.length;
  const rowHeightClass = getTableRowClass(density);
  const isCompact = density === "compact";

  const renderRow = (target: APICheckTarget) => {
    const isSelected = selectedIds.includes(target.id);
    const state = getAPICheckHealthState(target);
    const meta = API_STATE_META[state];
    const failureReason = getApiFailureReason(target);
    const schemaSummary = getSchemaContractSummary(target);
    const latency = target.last_response_time_ms;
    const maxLatency = target.expected_response_time_ms;
    const cleanUrl = stripProtocol(target.url);
    const historyBars = (target.recent_results || []).slice(-8);
    const emptySlots = Math.max(0, 8 - historyBars.length);

    const isFail = state === "fail";
    const isWarn = state === "slow" || state === "rate_limited";

    const rowBgClass = isSelected
      ? "bg-accent-green/[0.06] hover:bg-accent-green/[0.09]"
      : "hover:bg-bg-card-hover/70";

    const accentBorderClass = isFail
      ? "border-l-2 border-l-rose-500/85"
      : isWarn
        ? "border-l-2 border-l-amber-400/75"
        : "border-l-2 border-l-transparent";

    return (
      <tr
        key={target.id}
        onClick={() => onSelectTarget(target)}
        tabIndex={0}
        aria-label={target.name}
        onKeyDown={(e) => {
          if (
            e.target === e.currentTarget &&
            (e.key === "Enter" || e.key === " ")
          ) {
            e.preventDefault();
            onSelectTarget(target);
          }
        }}
        className={`group ${rowHeightClass} cursor-pointer transition-colors border-b border-border-base/60 ${accentBorderClass} ${rowBgClass}`}
      >
        {/* 1. Checkbox */}
        <td
          className={TABLE_CHECK_CELL}
          onClick={(e) => e.stopPropagation()}
        >
          <SelectionCheckbox
            checked={isSelected}
            label={`Seleccionar ${target.name}`}
            onChange={() => onToggleSelect(target)}
          />
        </td>

        {/* 2. Estado + Causa explícita (no "Con fallo 200") */}
        <td className={`${TABLE_CELL} min-w-0`}>
          <div className="flex items-center gap-1.5 min-w-0">
            <StatusPill
              size="xs"
              label={meta.label}
              tone={meta.tone}
              shape={meta.shape}
            />
            {failureReason ? (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-mono truncate ${
                  isFail ? "text-rose-300/90" : "text-amber-300/90"
                }`}
                title={failureReason}
              >
                <AlertTriangle size={11} className="shrink-0 opacity-80" />
                <span className="truncate">{failureReason}</span>
              </span>
            ) : target.last_http_status != null && state === "pass" ? (
              <span className="font-mono text-[11px] text-text-dim tabular-nums">
                {target.last_http_status}
              </span>
            ) : null}
          </div>
        </td>

        {/* 3. Método (neutro no semántico) */}
        <td className={`${TABLE_CELL} whitespace-nowrap`}>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border font-mono ${getMethodBadgeClass()}`}
          >
            {target.method}
          </span>
        </td>

        {/* 4. Endpoint (nombre en blanco + host/ruta gris en 1 línea compacta, sin https://) */}
        <td className={`${TABLE_CELL} min-w-0`}>
          {isCompact ? (
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="font-semibold text-xs text-text-main group-hover:text-accent-green transition-colors truncate shrink-0 max-w-[48%]"
                title={target.name}
              >
                {target.name}
              </span>
              <span
                className="text-[11px] font-mono text-text-dim truncate min-w-0"
                title={target.url}
              >
                {cleanUrl}
              </span>
              <a
                href={target.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-text-dim hover:text-accent-green shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                title="Abrir URL"
                aria-label={`Abrir ${target.url}`}
              >
                <ExternalLink size={10} />
              </a>
            </div>
          ) : (
            <div className="min-w-0">
              <div
                className="font-semibold text-[13px] text-text-main group-hover:text-accent-green transition-colors truncate leading-tight"
                title={target.name}
              >
                {target.name}
              </div>
              <div className="text-[11px] font-mono text-text-dim truncate flex items-center gap-1 mt-0.5">
                <span className="truncate" title={target.url}>
                  {cleanUrl}
                </span>
                <a
                  href={target.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-text-dim hover:text-accent-green shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  title="Abrir URL"
                  aria-label={`Abrir ${target.url}`}
                >
                  <ExternalLink size={10} />
                </a>
              </div>
            </div>
          )}
        </td>

        {/* 5. Latencia (coloreada solo por su propio umbral, límite en tooltip) */}
        <td
          className={`${TABLE_CELL} whitespace-nowrap font-mono tabular-nums`}
          title={`Límite: ${maxLatency} ms · ${formatApiInterval(target.check_interval)}`}
        >
          {latency !== null && latency !== undefined ? (
            <div>
              <span
                className={`text-xs ${getLatencyOwnColor(latency, maxLatency)}`}
              >
                {Math.round(latency)} ms
              </span>
              {!isCompact && (
                <div className="text-[10px] text-text-dim">
                  límite {maxLatency} ms
                </div>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-text-dim" />
          )}
        </td>

        {/* 6. Contrato Schema (vacío si no hay schema) */}
        <td className={`${TABLE_CELL} whitespace-nowrap font-mono text-[11px]`}>
          {schemaSummary ? (
            <span
              className={
                schemaSummary.valid === true
                  ? "text-emerald-400"
                  : schemaSummary.valid === false
                    ? "text-rose-400 font-semibold"
                    : "text-text-muted"
              }
              title={
                schemaSummary.valid === false &&
                target.last_schema_failures?.length
                  ? target.last_schema_failures
                      .map((f) => `${f.field}: esperado ${f.expected}, recibido ${f.received}`)
                      .join("\n")
                  : `${schemaSummary.total} campos en contrato JSON`
              }
            >
              {schemaSummary.label}
            </span>
          ) : null}
        </td>

        {/* 7. Historial (8 barras finas con tooltip) */}
        <td className={`${TABLE_CELL} whitespace-nowrap`}>
          <div
            className="inline-flex items-center gap-[3px] h-4"
            aria-label="Historial reciente de verificaciones"
          >
            {Array.from({ length: emptySlots }).map((_, idx) => (
              <span
                key={`empty-${idx}`}
                className="w-[4px] h-3 rounded-full bg-zinc-800/90"
                title="Sin ejecución"
              />
            ))}
            {historyBars.map((bar) => (
              <span
                key={bar.id}
                className={`w-[4px] h-3.5 rounded-full transition-transform hover:scale-y-110 ${getBarColorClass(
                  bar.status,
                )}`}
                title={formatBarTooltip(bar)}
              />
            ))}
          </div>
        </td>

        {/* 8. Último check */}
        <td
          className={`${TABLE_CELL} whitespace-nowrap font-mono text-[11px] text-text-dim`}
          title={formatApiInterval(target.check_interval)}
        >
          <RelativeTime
            value={target.last_checked_at}
            emptyLabel="Sin ejecutar"
          />
        </td>

        {/* 9. Acciones (hover / focus-within / touch) */}
        <td
          className={`${TABLE_CELL} text-right whitespace-nowrap bg-transparent`}
          onClick={(e) => e.stopPropagation()}
        >
          <APICheckRowActions
            target={target}
            variant="table"
            isScanning={scanningId === target.id}
            onScan={onScan}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </td>
      </tr>
    );
  };

  const sortAria = (field: APICheckSortField) =>
    sortField === field ? (sortAsc ? "ascending" : "descending") : "none";

  return (
    <div
      data-testid="connectivity-table"
      className="connectivity-directory-table w-full max-w-[1400px] mx-auto bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-xl font-sans"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] table-fixed text-left text-xs text-text-main border-collapse">
          <colgroup>
            <col className="w-11" />
            <col className="w-[248px]" />
            <col className="w-[68px]" />
            <col />
            <col className="w-[92px]" />
            <col className="w-[104px]" />
            <col className="w-[74px]" />
            <col className="w-[104px]" />
            <col className="w-[82px]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-bg-dark/95 backdrop-blur-md border-b border-border-base">
            <tr
              className={`${TABLE_HEAD_ROW} bg-bg-dark/90 font-semibold text-text-dim select-none`}
            >
              <th scope="col" className={TABLE_CHECK_CELL}>
                <SelectionCheckbox
                  checked={allSelected}
                  label="Seleccionar todos los endpoints de esta página"
                  onChange={onSelectAll}
                />
              </th>
              <th
                scope="col"
                aria-sort={sortAria("status")}
                onClick={() => onSort("status")}
                className={`${TABLE_HEAD_CELL} whitespace-nowrap cursor-pointer hover:text-text-main`}
              >
                <span className="inline-flex items-center gap-1">
                  Estado
                  <ArrowUpDown size={11} className="opacity-60" />
                </span>
              </th>
              <th
                scope="col"
                aria-sort={sortAria("method")}
                onClick={() => onSort("method")}
                className={`${TABLE_HEAD_CELL} whitespace-nowrap cursor-pointer hover:text-text-main`}
              >
                <span className="inline-flex items-center gap-1">
                  Método
                  <ArrowUpDown size={11} className="opacity-60" />
                </span>
              </th>
              <th
                scope="col"
                aria-sort={sortAria("name")}
                onClick={() => onSort("name")}
                className={`${TABLE_HEAD_CELL} whitespace-nowrap cursor-pointer hover:text-text-main`}
              >
                <span className="inline-flex items-center gap-1">
                  Endpoint
                  <ArrowUpDown size={11} className="opacity-60" />
                </span>
              </th>
              <th
                scope="col"
                aria-sort={sortAria("latency")}
                onClick={() => onSort("latency")}
                className={`${TABLE_HEAD_CELL} whitespace-nowrap cursor-pointer hover:text-text-main`}
              >
                <span className="inline-flex items-center gap-1">
                  Latencia
                  <ArrowUpDown size={11} className="opacity-60" />
                </span>
              </th>
              <th scope="col" className={`${TABLE_HEAD_CELL} whitespace-nowrap`}>
                Contrato
              </th>
              <th scope="col" className={`${TABLE_HEAD_CELL} whitespace-nowrap`}>
                Historial
              </th>
              <th
                scope="col"
                aria-sort={sortAria("last_checked")}
                onClick={() => onSort("last_checked")}
                className={`${TABLE_HEAD_CELL} whitespace-nowrap cursor-pointer hover:text-text-main`}
              >
                <span className="inline-flex items-center gap-1">
                  Último check
                  <ArrowUpDown size={11} className="opacity-60" />
                </span>
              </th>
              <th
                scope="col"
                className={`${TABLE_HEAD_CELL} text-right whitespace-nowrap`}
              >
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {groups
              ? groups.map((group) => {
                  const isCollapsed = Boolean(collapsedGroups[group.key]);
                  const Icon = group.icon;
                  return (
                    <Fragment key={group.key}>
                      <tr className="bg-bg-dark/60 border-b border-border-base/70">
                        <td colSpan={9} className="px-3.5 py-2">
                          <button
                            type="button"
                            onClick={() => onToggleGroup(group.key)}
                            className="flex items-center gap-2 text-xs font-semibold text-text-main hover:text-accent-green transition-colors cursor-pointer !min-h-0"
                          >
                            {isCollapsed ? (
                              <ChevronRight
                                size={14}
                                className="text-text-dim"
                              />
                            ) : (
                              <ChevronDown
                                size={14}
                                className="text-text-dim"
                              />
                            )}
                            <Icon size={13} className="text-text-muted" />
                            <span>{group.label}</span>
                            <span className="font-mono text-[11px] text-text-dim">
                              ({group.targets.length})
                            </span>
                            {group.problemCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-mono text-[10px]">
                                {group.problemCount}
                              </span>
                            )}
                          </button>
                        </td>
                      </tr>
                      {!isCollapsed && group.targets.map(renderRow)}
                    </Fragment>
                  );
                })
              : targets.map(renderRow)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
