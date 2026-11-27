import { useState } from "react";
import {
  AlertTriangle,
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
import RelativeTime from "../common/connectivity/RelativeTime";
import RowActionMenu, {
  type RowActionMenuItem,
} from "../common/connectivity/RowActionMenu";
import { StatusShapeIcon } from "../common/connectivity/StatusPill";
import { TABLE_ACTION_BTN } from "../common/connectivity/tableTokens";
import SelectionCheckbox from "../common/SelectionCheckbox";
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
} from "./useSecurityHeaders";

interface SecurityHeaderCardGridViewProps {
  targets: SecurityHeaderTarget[];
  groupedTargets: SecurityHeaderGroup[] | null;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  density: SecurityHeaderDensity;
  selectedIds: string[];
  onToggleSelect: (target: SecurityHeaderTarget) => void;
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

export default function SecurityHeaderCardGridView({
  targets,
  groupedTargets,
  collapsedGroups,
  onToggleGroup,
  density,
  selectedIds,
  onToggleSelect,
  onSelectTarget,
  onScan,
  scanningId,
  onEdit,
  onToggleEnabled,
  onDelete,
  canScan,
  canUpdate,
  canDelete,
}: SecurityHeaderCardGridViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const isCompact = density === "compact";

  const copyUrl = async (target: SecurityHeaderTarget) => {
    try {
      await navigator.clipboard.writeText(target.url);
      setCopiedId(target.id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // ignore clipboard errors
    }
  };

  const renderCard = (target: SecurityHeaderTarget) => {
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
    const slotCount = 12;
    const paddedSlots = [
      ...Array.from({ length: Math.max(0, slotCount - recent.length) }).map(
        () => null,
      ),
      ...recent.slice(-slotCount),
    ];

    const surfaceClass = isSelected
      ? "bg-accent-green/[0.03] border-accent-green ring-1 ring-accent-green/40"
      : isPaused
        ? "bg-bg-card/60 border-border-base/60 opacity-80 hover:opacity-100"
        : isCritical
          ? "bg-[#1c1217] border-rose-500/45 hover:bg-[#25161e] hover:border-rose-400/70"
          : isWarning
            ? "bg-bg-card border-amber-500/40 hover:border-amber-400/70"
            : "bg-bg-card border-border-base/80 hover:border-text-dim/60";

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
      <div
        key={target.id}
        data-testid="connectivity-card"
        role="button"
        tabIndex={0}
        aria-label={`Ver detalle de ${target.name}`}
        onClick={() => onSelectTarget(target)}
        onKeyDown={(e) => {
          if (
            e.target === e.currentTarget &&
            (e.key === "Enter" || e.key === " ")
          ) {
            e.preventDefault();
            onSelectTarget(target);
          }
        }}
        className={`group relative flex h-full flex-col justify-between rounded-2xl border cursor-pointer transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/60 ${
          isCompact ? "p-3.5 gap-2.5" : "p-4 gap-3"
        } ${surfaceClass}`}
      >
        {/* Top block: Status icon + Name + Grade + Hover actions */}
        <div className="space-y-1">
          <div className="relative flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div
                onClick={(e) => e.stopPropagation()}
                className={`shrink-0 ${
                  isSelected
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
                }`}
              >
                <SelectionCheckbox
                  checked={isSelected}
                  label={`Seleccionar ${target.name}`}
                  onChange={() => onToggleSelect(target)}
                />
              </div>
              <StatusShapeIcon
                shape={meta.shape}
                size={15}
                className={`shrink-0 ${meta.iconClassName}`}
                label={meta.label}
              />
              <h3
                className={`font-semibold truncate leading-tight min-w-0 ${
                  isCompact ? "text-[13px]" : "text-sm"
                } ${
                  isPaused
                    ? "text-slate-400"
                    : "text-text-main group-hover:text-accent-green transition-colors"
                }`}
                title={target.name}
              >
                {target.name}
              </h3>
            </div>

            <div className="shrink-0 group-hover:opacity-0 group-focus-within:opacity-0 transition-opacity">
              {!target.last_error_message && (
                <GradeBadge
                  grade={grade}
                  score={target.last_score}
                  tone={securityHealthTone(target)}
                />
              )}
            </div>

            <RowActionMenu
              resourceLabel={target.name}
              variant="card"
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
          </div>

          {/* URL line without https:// */}
          <div className="pl-6 flex items-center gap-1.5 text-[11px] font-mono text-text-dim min-w-0">
            <span className="truncate" title={target.url}>
              {displayUrl}
            </span>
            <a
              href={target.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Abrir URL"
              aria-label={`Abrir ${target.url}`}
              className="shrink-0 text-text-dim hover:text-accent-green"
            >
              <ExternalLink size={10} />
            </a>
          </div>

          {/* Diagnostic issue line OR critical protections summary */}
          <div className="pl-6 pt-0.5 min-h-[18px] flex items-center">
            {issueLabel ? (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-mono truncate ${
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
            ) : measured && !isPaused ? (
              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                <span
                  className={
                    target.has_hsts
                      ? "text-emerald-400 font-semibold"
                      : "text-text-dim"
                  }
                >
                  HSTS {target.has_hsts ? "✓" : "✗"}
                </span>
                <span className="text-text-dim">·</span>
                <span
                  className={
                    target.has_csp
                      ? "text-emerald-400 font-semibold"
                      : "text-text-dim"
                  }
                >
                  CSP {target.has_csp ? "✓" : "✗"}
                </span>
                <span className="text-text-dim">·</span>
                <span
                  className={
                    target.has_xfo
                      ? "text-emerald-400 font-semibold"
                      : "text-text-dim"
                  }
                >
                  XFO {target.has_xfo ? "✓" : "✗"}
                </span>
              </div>
            ) : (
              <span className="text-[11px] font-mono text-text-dim">
                {isPaused ? "Escaneo pausado" : "Pendiente de auditoría"}
              </span>
            )}
          </div>
        </div>

        {/* Bottom block: Score + Latency + History bars + RelativeTime */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2 font-mono">
              <span className="text-sm font-bold text-text-main">
                {target.last_error_message
                  ? "Error"
                  : target.last_score !== null
                    ? `${target.last_score}/100`
                    : "—"}
              </span>
              {target.last_response_time_ms !== null &&
                target.last_response_time_ms !== undefined && (
                  <span
                    className={`text-[11px] ${getSecurityLatencyColorClass(
                      target.last_response_time_ms,
                    )}`}
                  >
                    {target.last_response_time_ms} ms
                  </span>
                )}
            </div>

            <div
              className="flex items-center gap-[3px] h-2.5 w-24 shrink-0"
              aria-label={`Historial reciente de ${target.name}`}
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
          </div>

          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border-base/50 text-[11px] font-mono text-text-dim">
            <span>
              {target.headers_found_count !== null &&
              target.headers_found_count !== undefined
                ? `${target.headers_found_count}/8 cabeceras`
                : "8 cabeceras estándar"}
            </span>
            <RelativeTime
              value={target.last_checked_at}
              emptyLabel="Sin ejecutar"
              className="text-[11px] text-text-muted"
            />
          </div>
        </div>
      </div>
    );
  };

  const gridClass =
    density === "compact"
      ? "grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5"
      : "grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-4";

  if (groupedTargets) {
    return (
      <div className="w-full max-w-[1400px] mx-auto space-y-5">
        {groupedTargets.map((group) => {
          const isCollapsed = Boolean(collapsedGroups[group.key]);
          return (
            <section key={group.key} className="space-y-3">
              <button
                type="button"
                onClick={() => onToggleGroup(group.key)}
                aria-expanded={!isCollapsed}
                className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-bg-card border border-border-base/80 hover:bg-bg-card-hover transition-colors cursor-pointer select-none !min-h-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isCollapsed ? (
                    <ChevronRight size={14} className="text-text-dim shrink-0" />
                  ) : (
                    <ChevronDown size={14} className="text-accent-green shrink-0" />
                  )}
                  <span className="font-semibold text-text-main text-xs truncate">
                    {group.label}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-bg-dark border border-border-base text-text-muted shrink-0">
                    {group.targets.length}
                  </span>
                  {group.problemCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400 shrink-0">
                      {group.problemCount} con alerta
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-text-dim shrink-0">
                  {isCollapsed ? "Expandir" : "Colapsar"}
                </span>
              </button>
              {!isCollapsed && (
                <div className={gridClass}>{group.targets.map(renderCard)}</div>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`w-full max-w-[1400px] mx-auto ${gridClass}`}>
      {targets.map(renderCard)}
    </div>
  );
}
