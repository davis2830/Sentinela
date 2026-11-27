import { Fragment } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Code2,
  ExternalLink,
} from "lucide-react";
import type { APICheckTarget } from "../../types/api_checks";
import { apiResponseTone, healthPalette } from "../../utils/healthPresentation";
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
  getAPICheckHealthState,
  getMethodBadgeClass,
  getSchemaFieldCount,
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
    const schemaCount = getSchemaFieldCount(target);
    const latency = target.last_response_time_ms;
    const maxLatency = target.expected_response_time_ms;
    const isFail = state === "fail";

    const rowBgClass = isSelected
      ? "bg-accent-green/[0.06] hover:bg-accent-green/[0.09]"
      : isFail
        ? "bg-rose-500/[0.04] hover:bg-rose-500/[0.08]"
        : "hover:bg-bg-card-hover/70";

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
        className={`group ${rowHeightClass} cursor-pointer transition-colors border-b border-border-base/60 ${rowBgClass}`}
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

        {/* 2. Estado + HTTP code */}
        <td className={`${TABLE_CELL} whitespace-nowrap`}>
          <div className="flex items-center gap-1.5">
            <StatusPill
              size="xs"
              label={meta.label}
              tone={meta.tone}
              shape={meta.shape}
            />
            {target.last_http_status != null && (
              <span className="font-mono text-[11px] font-semibold text-text-muted tabular-nums">
                {target.last_http_status}
              </span>
            )}
          </div>
        </td>

        {/* 3. Método */}
        <td className={`${TABLE_CELL} whitespace-nowrap`}>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border font-mono ${getMethodBadgeClass(
              target.method,
            )}`}
          >
            {target.method}
          </span>
        </td>

        {/* 4. Nombre y URL */}
        <td className={`${TABLE_CELL} min-w-0`}>
          <div className="min-w-0">
            <div
              className={`font-semibold truncate leading-tight ${
                isFail
                  ? "text-rose-300"
                  : "text-text-main group-hover:text-accent-green transition-colors"
              } ${isCompact ? "text-xs" : "text-[13px]"}`}
              title={target.name}
            >
              {target.name}
            </div>
            <div className="text-[11px] font-mono text-text-dim truncate flex items-center gap-1 mt-0.5">
              <span className="truncate" title={target.url}>
                {target.url}
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
        </td>

        {/* 5. Latencia real vs máx */}
        <td className={`${TABLE_CELL} whitespace-nowrap font-mono`}>
          {latency !== null && latency !== undefined ? (
            <div className="flex items-baseline gap-1 tabular-nums">
              <span
                className={`font-semibold text-xs ${
                  healthPalette[apiResponseTone(target)].text
                }`}
              >
                {Math.round(latency)} ms
              </span>
              <span className="text-[11px] text-text-dim">
                / &lt;{maxLatency}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-text-dim tabular-nums">
              — / &lt;{maxLatency} ms
            </span>
          )}
        </td>

        {/* 6. Schema & Frecuencia */}
        <td className={`${TABLE_CELL} whitespace-nowrap`}>
          <div className="flex items-center gap-1.5">
            {schemaCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-accent-purple/10 text-accent-purple border border-accent-purple/30 font-mono">
                <Code2 size={10} />
                {schemaCount}
              </span>
            ) : (
              <span className="text-[11px] text-text-dim font-mono">—</span>
            )}
            <span className="text-[11px] font-mono text-text-dim">
              · {formatApiInterval(target.check_interval)}
            </span>
          </div>
        </td>

        {/* 7. Último check */}
        <td className={`${TABLE_CELL} whitespace-nowrap font-mono text-[11px] text-text-dim`}>
          <RelativeTime value={target.last_checked_at} emptyLabel="Nunca" />
        </td>

        {/* 8. Acciones */}
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
        <table className="w-full min-w-[920px] table-fixed text-left text-xs text-text-main border-collapse">
          <colgroup>
            <col className="w-11" />
            <col className="w-[148px]" />
            <col className="w-[82px]" />
            <col />
            <col className="w-[140px]" />
            <col className="w-[132px]" />
            <col className="w-[106px]" />
            <col className="w-[88px]" />
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
                Schema · Cadencia
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
                        <td colSpan={8} className="px-3.5 py-2">
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
