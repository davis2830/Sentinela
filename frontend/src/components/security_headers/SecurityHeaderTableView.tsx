import { useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import type { SecurityHeaderTarget } from "../../types/security_headers";
import GradeBadge from "../common/GradeBadge";
import SelectionCheckbox from "../common/SelectionCheckbox";
import RelativeTime from "../common/connectivity/RelativeTime";
import RowActionMenu, {
  type RowActionMenuItem,
} from "../common/connectivity/RowActionMenu";
import StatusPill from "../common/connectivity/StatusPill";
import {
  TABLE_ACTION_BTN,
  TABLE_HEAD_CELL,
  TABLE_HEAD_ROW,
  getTableRowClass,
} from "../common/connectivity/tableTokens";
import { hasMeasurement, securityHealthTone } from "../../utils/healthPresentation";
import {
  SECURITY_STATE_META,
  calculateSecurityGrade,
  getSecurityHeaderDisplayUrl,
  getSecurityHeaderHealthState,
  getSecurityHeaderIssueLabel,
  getSecurityHistorySlotMeta,
  getSecurityLatencyColorClass,
  type SecurityHeaderDensity,
  type SecurityHeaderGroup,
  type SecurityHeaderSortField,
} from "./useSecurityHeaders";

export interface SecurityHeaderTableViewProps {
  targets: SecurityHeaderTarget[];
  groupedTargets: SecurityHeaderGroup[] | null;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  density: SecurityHeaderDensity;
  sortField: SecurityHeaderSortField;
  sortAsc: boolean;
  onSortChange: (field: SecurityHeaderSortField) => void;
  selectedIds: string[];
  onToggleSelect: (target: SecurityHeaderTarget) => void;
  onSelectAll: () => void;
  onSelectTarget: (target: SecurityHeaderTarget) => void;
  onScan: (id: string) => void;
  scanningId: string | null;
  onEdit: (target: SecurityHeaderTarget) => void;
  onToggleEnabled: (target: SecurityHeaderTarget) => void;
  onDelete: (target: SecurityHeaderTarget) => void;
  canScan: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export default function SecurityHeaderTableView({
  targets,
  groupedTargets,
  collapsedGroups,
  onToggleGroup,
  density,
  sortField,
  sortAsc,
  onSortChange,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onSelectTarget,
  onScan,
  scanningId,
  onEdit,
  onToggleEnabled,
  onDelete,
  canScan,
  canUpdate,
  canDelete,
}: SecurityHeaderTableViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const allSelected =
    targets.length > 0 && selectedIds.length === targets.length;
  const rowHeightClass = getTableRowClass(density);
  const paddingY = "py-0 align-middle";

  const copyUrl = async (target: SecurityHeaderTarget) => {
    try {
      await navigator.clipboard.writeText(target.url);
      setCopiedId(target.id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // ignore clipboard errors
    }
  };

  const renderRow = (target: SecurityHeaderTarget) => {
    const state = getSecurityHeaderHealthState(target);
    const meta = SECURITY_STATE_META[state];
    const isSelected = selectedIds.includes(target.id);
    const isScanning = scanningId === target.id;
    const isPaused = state === "paused";
    const isCritical = state === "critical";
    const isWarning = state === "warning";
    const measured = hasMeasurement(target.last_checked_at);
    const grade = target.last_grade || calculateSecurityGrade(target.last_score);
    const issueLabel = getSecurityHeaderIssueLabel(target);
    const displayUrl = getSecurityHeaderDisplayUrl(target.url);

    const recent = target.recent_results || [];
    const paddedSlots = [
      ...Array.from({ length: Math.max(0, 8 - recent.length) }).map(() => null),
      ...recent.slice(-8),
    ];

    const rowBgClass = isSelected
      ? "bg-accent-green/[0.04]"
      : isPaused
        ? "bg-bg-dark/25 opacity-75 hover:opacity-95 hover:bg-white/[0.03]"
        : isCritical
          ? "bg-[#1c1217] border-l-2 border-l-rose-500 hover:bg-[#25161e]"
          : isWarning
            ? "bg-amber-500/[0.04] border-l-2 border-l-amber-400 hover:bg-amber-500/[0.08]"
            : "hover:bg-white/[0.03]";

    const menuItems: RowActionMenuItem[] = [
      ...(canScan
        ? [
            {
              id: "scan",
              label: "Auditar ahora",
              icon: <RefreshCw size={13} className="text-accent-green" />,
              disabled: isScanning || target.scan_availability?.status === "cooldown",
              onClick: () => onScan(target.id),
            },
          ]
        : []),
      ...(canUpdate
        ? [
            {
              id: "edit",
              label: "Editar endpoint",
              icon: <Pencil size={13} className="text-sky-400" />,
              onClick: () => onEdit(target),
            },
            {
              id: "toggle",
              label: target.enabled ? "Pausar escaneo" : "Reanudar escaneo",
              icon: target.enabled ? (
                <Pause size={13} className="text-amber-400" />
              ) : (
                <Play size={13} className="text-emerald-400" />
              ),
              onClick: () => onToggleEnabled(target),
            },
          ]
        : []),
      {
        id: "copy",
        label: copiedId === target.id ? "URL copiada" : "Copiar URL",
        icon:
          copiedId === target.id ? (
            <Check size={13} className="text-accent-green" />
          ) : (
            <Copy size={13} />
          ),
        onClick: () => copyUrl(target),
      },
      ...(canDelete
        ? [
            {
              id: "delete",
              label: "Eliminar endpoint",
              icon: <Trash2 size={13} />,
              danger: true,
              dividerBefore: true,
              onClick: () => onDelete(target),
            },
          ]
        : []),
    ];

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
        className={`group ${rowHeightClass} cursor-pointer transition-colors border-b border-border-base/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-green/60 ${rowBgClass}`}
      >
        {/* 1. Checkbox */}
        <td
          className={`${paddingY} px-3 w-10`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(target);
          }}
        >
          <SelectionCheckbox
            checked={isSelected}
            label={`Seleccionar ${target.name}`}
            onChange={() => onToggleSelect(target)}
          />
        </td>

        {/* 2. Estado + motivo conciso */}
        <td className={`${paddingY} px-3 whitespace-nowrap w-[210px]`}>
          <div className="flex items-center gap-2 min-w-0">
            <StatusPill
              size="xs"
              label={meta.label}
              tone={meta.tone}
              shape={meta.shape}
            />
            {issueLabel && (
              <span
                className={`inline-flex items-center gap-1 truncate font-mono text-[11px] ${
                  isCritical ? "text-rose-300" : "text-amber-300"
                }`}
                title={target.last_error_message || issueLabel}
              >
                {target.info_leak_detected && !target.last_error_message ? (
                  <ShieldAlert size={11} className="shrink-0 text-amber-400" />
                ) : (
                  <AlertTriangle
                    size={11}
                    className={`shrink-0 ${
                      isCritical ? "text-rose-400" : "text-amber-400"
                    }`}
                  />
                )}
                <span className="truncate">{issueLabel}</span>
              </span>
            )}
          </div>
        </td>

        {/* 3. Endpoint (flexible single line: white name + muted display URL without https://) */}
        <td className={`${paddingY} px-3 max-w-0`}>
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`shrink-0 max-w-[46%] truncate font-semibold text-xs transition-colors ${
                isPaused
                  ? "text-slate-400"
                  : "text-text-main group-hover:text-accent-green"
              }`}
              title={target.name}
            >
              {target.name}
            </span>
            <span
              className="truncate font-mono text-[11px] text-text-dim"
              title={target.url}
            >
              {displayUrl}
            </span>
            <a
              href={target.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Abrir URL"
              aria-label={`Abrir ${target.url}`}
              className="shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-text-dim hover:text-accent-green transition-opacity"
            >
              <ExternalLink size={11} />
            </a>
          </div>
        </td>

        {/* 4. Score & Grade */}
        <td className={`${paddingY} px-3 whitespace-nowrap w-[118px]`}>
          {target.last_error_message ? (
            <span className="font-mono text-xs font-semibold text-rose-400">
              Error
            </span>
          ) : measured ? (
            <div className="flex items-center gap-1.5">
              <GradeBadge
                grade={grade}
                score={target.last_score}
                tone={securityHealthTone(target)}
              />
              {target.last_score !== null && (
                <span className="font-mono text-xs text-text-muted">
                  {target.last_score}
                </span>
              )}
            </div>
          ) : (
            <span className="font-mono text-xs text-text-dim">—</span>
          )}
        </td>

        {/* 5. Blindaje Crítico */}
        <td className={`${paddingY} px-3 whitespace-nowrap w-[156px]`}>
          {measured && !target.last_error_message ? (
            <div className="flex items-center gap-1 font-mono text-[10px]">
              <span
                className={`px-1.5 py-0.5 rounded ${
                  target.has_hsts
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold"
                    : "bg-bg-dark border border-border-base/60 text-text-dim"
                }`}
                title={target.has_hsts ? "HSTS presente" : "HSTS ausente"}
              >
                HSTS
              </span>
              <span
                className={`px-1.5 py-0.5 rounded ${
                  target.has_csp
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold"
                    : "bg-bg-dark border border-border-base/60 text-text-dim"
                }`}
                title={target.has_csp ? "CSP presente" : "CSP ausente"}
              >
                CSP
              </span>
              <span
                className={`px-1.5 py-0.5 rounded ${
                  target.has_xfo
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold"
                    : "bg-bg-dark border border-border-base/60 text-text-dim"
                }`}
                title={
                  target.has_xfo
                    ? "X-Frame-Options presente"
                    : "X-Frame-Options ausente"
                }
              >
                XFO
              </span>
            </div>
          ) : (
            <span className="font-mono text-xs text-text-dim">—</span>
          )}
        </td>

        {/* 6. Latencia (own threshold color) */}
        <td className={`${paddingY} px-3 whitespace-nowrap w-[86px]`}>
          {target.last_response_time_ms !== null &&
          target.last_response_time_ms !== undefined ? (
            <span
              className={`font-mono text-xs ${getSecurityLatencyColorClass(
                target.last_response_time_ms,
              )}`}
            >
              {target.last_response_time_ms} ms
            </span>
          ) : (
            <span className="font-mono text-xs text-text-dim">—</span>
          )}
        </td>

        {/* 7. Historial (8 barras reales) */}
        <td className={`${paddingY} px-3 whitespace-nowrap w-[98px]`}>
          <div
            className="flex items-center gap-[3px] h-3 w-20"
            aria-label={`Historial de auditorías de ${target.name}`}
          >
            {paddedSlots.map((slot, idx) => {
              const slotMeta = getSecurityHistorySlotMeta(slot);
              return (
                <div
                  key={slot?.id || idx}
                  title={slotMeta.tooltip}
                  className={`flex-1 h-full rounded-[2px] ${slotMeta.cls}`}
                />
              );
            })}
          </div>
        </td>

        {/* 8. Último análisis */}
        <td className={`${paddingY} px-3 whitespace-nowrap w-[112px]`}>
          <RelativeTime
            value={target.last_checked_at}
            emptyLabel="Sin ejecutar"
            className="text-xs text-text-muted"
          />
        </td>

        {/* 9. Acciones (hover / focus / touch via RowActionMenu) */}
        <td
          className={`${paddingY} px-3 text-right whitespace-nowrap w-[96px]`}
          onClick={(e) => e.stopPropagation()}
        >
          <RowActionMenu
            resourceLabel={target.name}
            variant="table"
            forceVisible={isScanning}
            directActions={
              canScan ? (
                <button
                  type="button"
                  disabled={isScanning}
                  onClick={() => onScan(target.id)}
                  title="Auditar ahora"
                  aria-label={`Auditar ${target.name}`}
                  className={`${TABLE_ACTION_BTN} text-text-muted hover:text-accent-green hover:bg-white/10 disabled:opacity-50`}
                >
                  {isScanning ? (
                    <Loader2 size={14} className="animate-spin text-accent-green" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                </button>
              ) : null
            }
            items={menuItems}
          />
        </td>
      </tr>
    );
  };

  const sortHeader = (
    field: SecurityHeaderSortField,
    label: string,
    title: string,
  ) => (
    <th
      scope="col"
      aria-sort={
        sortField === field ? (sortAsc ? "ascending" : "descending") : "none"
      }
      onClick={() => onSortChange(field)}
      title={title}
      className={`${TABLE_HEAD_CELL} whitespace-nowrap cursor-pointer hover:text-text-main`}
    >
      <div className="inline-flex items-center gap-1">
        <span>{label}</span>
        <ArrowUpDown
          size={11}
          className={
            sortField === field ? "text-accent-green" : "text-text-dim"
          }
        />
      </div>
    </th>
  );

  return (
    <div
      data-testid="connectivity-table"
      className="connectivity-directory-table w-full max-w-[1400px] mx-auto bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-xl font-sans"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1020px] table-fixed text-left text-xs text-text-main border-collapse">
          <colgroup>
            <col className="w-10" />
            <col className="w-[210px]" />
            <col />
            <col className="w-[118px]" />
            <col className="w-[156px]" />
            <col className="w-[86px]" />
            <col className="w-[98px]" />
            <col className="w-[112px]" />
            <col className="w-[96px]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-bg-dark/95 backdrop-blur-md border-b border-border-base">
            <tr
              className={`${TABLE_HEAD_ROW} bg-bg-dark/90 font-semibold text-text-dim select-none`}
            >
              <th scope="col" className="px-3 w-10">
                <SelectionCheckbox
                  checked={allSelected}
                  label="Seleccionar todos los recursos de esta página"
                  onChange={onSelectAll}
                />
              </th>
              {sortHeader("status", "Estado", "Ordenar por estado")}
              {sortHeader("name", "Endpoint", "Ordenar por nombre")}
              {sortHeader("score", "Score", "Ordenar por puntuación")}
              <th scope="col" className={`${TABLE_HEAD_CELL} whitespace-nowrap`}>
                Blindaje
              </th>
              {sortHeader("latency", "Latencia", "Ordenar por latencia HTTP")}
              <th scope="col" className={`${TABLE_HEAD_CELL} whitespace-nowrap`}>
                Historial
              </th>
              {sortHeader("checked", "Último análisis", "Ordenar por fecha")}
              <th
                scope="col"
                className={`${TABLE_HEAD_CELL} text-right whitespace-nowrap`}
              >
                Acciones
              </th>
            </tr>
          </thead>

          {groupedTargets ? (
            groupedTargets.map((group) => {
              const isCollapsed = Boolean(collapsedGroups[group.key]);
              return (
                <tbody
                  key={group.key}
                  className="border-b border-border-base/50"
                >
                  <tr
                    onClick={() => onToggleGroup(group.key)}
                    className="bg-bg-dark/70 hover:bg-bg-dark cursor-pointer transition-colors border-y border-border-base/60 select-none"
                  >
                    <td colSpan={9} className="py-1.5 px-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isCollapsed ? (
                            <ChevronRight size={13} className="text-text-dim" />
                          ) : (
                            <ChevronDown
                              size={13}
                              className="text-accent-green"
                            />
                          )}
                          <span className="font-semibold text-text-main text-xs">
                            {group.label}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-bg-card border border-border-base text-text-muted">
                            {group.targets.length}
                          </span>
                          {group.problemCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400">
                              {group.problemCount} con alerta
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-text-dim">
                          {isCollapsed ? "Expandir" : "Colapsar"}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {!isCollapsed && group.targets.map(renderRow)}
                </tbody>
              );
            })
          ) : (
            <tbody>{targets.map(renderRow)}</tbody>
          )}
        </table>
      </div>
    </div>
  );
}
