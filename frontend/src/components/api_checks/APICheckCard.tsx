import { AlertTriangle, ExternalLink } from "lucide-react";
import type { APICheckRecentResult, APICheckTarget } from "../../types/api_checks";
import SelectionCheckbox from "../common/SelectionCheckbox";
import RelativeTime from "../common/connectivity/RelativeTime";
import { StatusShapeIcon } from "../common/connectivity/StatusPill";
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
} from "./useAPIChecks";

export interface APICheckCardProps {
  target: APICheckTarget;
  density?: APICheckDensity;
  isSelected: boolean;
  hasAnySelection: boolean;
  isScanning: boolean;
  onToggleSelect: (target: APICheckTarget) => void;
  onSelect: (target: APICheckTarget) => void;
  onScan: (target: APICheckTarget) => void;
  onEdit: (target: APICheckTarget) => void;
  onDelete: (target: APICheckTarget) => void;
}

function getBarColor(status: string): string {
  const s = status.toLowerCase();
  if (s === "pass") return "bg-emerald-400";
  if (s === "slow" || s === "rate_limited") return "bg-amber-400";
  if (s === "fail" || s === "error") return "bg-rose-500";
  return "bg-zinc-800";
}

function formatMiniTooltip(item: APICheckRecentResult): string {
  const parts = [formatResultStatusEs(item.status)];
  if (item.http_status != null) parts.push(`HTTP ${item.http_status}`);
  if (item.response_time_ms != null) {
    parts.push(`${Math.round(item.response_time_ms)} ms`);
  }
  if (item.reason) parts.push(item.reason);
  return parts.join(" · ");
}

/**
 * Compact ~165px API Check card aligned with Uptime cards:
 * - Row 1: Status icon <-> Checkbox + crisp white Name + hover/focus RowActionMenu
 * - Row 2: Neutral METHOD + host/path (no https://) + external link
 * - Row 3: Failure cause (only when failing/degraded) OR schema contract summary
 * - Row 4: Latency (own threshold color) + 12-bar history strip
 * - Footer: cadence (left) · relative last check (right)
 */
export default function APICheckCard({
  target,
  density = "comfortable",
  isSelected,
  hasAnySelection,
  isScanning,
  onToggleSelect,
  onSelect,
  onScan,
  onEdit,
  onDelete,
}: APICheckCardProps) {
  const isCompact = density === "compact";
  const state = getAPICheckHealthState(target);
  const meta = API_STATE_META[state];
  const isFail = state === "fail";
  const isWarn = state === "slow" || state === "rate_limited";
  const forceCheckbox = isSelected || hasAnySelection;

  const failureReason = getApiFailureReason(target);
  const schemaSummary = getSchemaContractSummary(target);
  const consecutive = target.consecutive_failures || 0;
  const latency = target.last_response_time_ms;
  const maxLatency = target.expected_response_time_ms;
  const cleanUrl = stripProtocol(target.url);

  const historyBars = (target.recent_results || []).slice(-12);
  const emptySlots = Math.max(0, 12 - historyBars.length);

  const cardSurfaceClass = isSelected
    ? "border-accent-green bg-accent-green/[0.04] ring-1 ring-accent-green/40"
    : isFail
      ? "border-border-base/80 border-l-2 border-l-rose-500/85 bg-bg-card hover:border-rose-500/60"
      : isWarn
        ? "border-border-base/80 border-l-2 border-l-amber-400/75 bg-bg-card hover:border-amber-400/60"
        : "border-border-base/80 bg-bg-card hover:border-accent-green/50";

  return (
    <div
      data-testid="connectivity-card"
      role="button"
      tabIndex={0}
      aria-label={`Ver detalle de ${target.name}`}
      onClick={() => onSelect(target)}
      onKeyDown={(e) => {
        if (
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          onSelect(target);
        }
      }}
      className={`group relative flex h-full flex-col justify-between rounded-2xl border cursor-pointer transition-all duration-150 ${
        isCompact ? "p-3 gap-2" : "p-3.5 gap-2.5"
      } ${cardSurfaceClass}`}
    >
      {/* Top: Icon/Checkbox + Name + Floating Actions + Method/URL */}
      <div className="space-y-1 min-w-0">
        <div className="relative flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="relative shrink-0 grid place-items-center w-5 h-5">
              <span
                className={`grid place-items-center transition-opacity duration-100 ${
                  forceCheckbox
                    ? "opacity-0 pointer-events-none"
                    : "opacity-100 group-hover:opacity-0 group-focus-within:opacity-0 [@media(hover:none)]:opacity-0"
                }`}
              >
                <StatusShapeIcon
                  shape={meta.shape}
                  size={16}
                  className={meta.textClass}
                  label={meta.label}
                />
              </span>
              <div
                className={`absolute inset-0 grid place-items-center transition-opacity duration-100 ${
                  forceCheckbox
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto"
                }`}
              >
                <SelectionCheckbox
                  checked={isSelected}
                  label={`Seleccionar ${target.name}`}
                  onChange={() => onToggleSelect(target)}
                />
              </div>
            </div>

            <h3
              className="font-semibold text-[13px] text-text-main group-hover:text-accent-green transition-colors truncate leading-tight min-w-0"
              title={target.name}
            >
              {target.name}
            </h3>
          </div>

          <APICheckRowActions
            target={target}
            variant="card"
            isScanning={isScanning}
            onScan={onScan}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>

        {/* Neutral METHOD + stripped host/path */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-text-dim pl-7 min-w-0">
          <span
            className={`px-1 py-0 rounded text-[10px] font-semibold border shrink-0 leading-4 ${getMethodBadgeClass()}`}
          >
            {target.method}
          </span>
          <span className="truncate" title={target.url}>
            {cleanUrl}
          </span>
          <a
            href={target.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-text-dim hover:text-accent-green shrink-0"
            title="Abrir URL"
            aria-label={`Abrir ${target.url}`}
          >
            <ExternalLink size={10} />
          </a>
        </div>
      </div>

      {/* Middle: Failure reason OR Contract summary (single compact line) */}
      <div className="min-h-[18px] flex items-center text-[11px] font-mono">
        {failureReason ? (
          <span
            className={`inline-flex items-center gap-1 truncate ${
              isFail ? "text-rose-300" : "text-amber-300"
            }`}
            title={failureReason}
          >
            <AlertTriangle size={11} className="shrink-0" />
            <span className="truncate">
              {failureReason}
              {consecutive >= 2 ? ` · ${consecutive} seguidos` : ""}
            </span>
          </span>
        ) : schemaSummary ? (
          <span
            className={
              schemaSummary.valid === true
                ? "text-emerald-400"
                : schemaSummary.valid === false
                  ? "text-rose-400"
                  : "text-text-muted"
            }
          >
            {schemaSummary.label}
          </span>
        ) : (
          <span className="text-text-dim text-[11px] font-sans">
            {state === "paused"
              ? "Monitoreo en pausa"
              : state === "pending"
                ? "Esperando primera ejecución"
                : `HTTP ${target.last_http_status ?? target.expected_status}`}
          </span>
        )}
      </div>

      {/* Latency + 12-bar History strip */}
      <div className="flex items-center justify-between gap-3">
        <span
          className={`font-mono text-xs tabular-nums ${getLatencyOwnColor(
            latency,
            maxLatency,
          )}`}
          title={`Límite: ${maxLatency} ms`}
        >
          {latency !== null && latency !== undefined
            ? `${Math.round(latency)} ms`
            : "—"}
        </span>

        <div
          className="inline-flex items-center gap-[3px] h-4"
          aria-label="Historial reciente"
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
              className={`w-[4px] h-3.5 rounded-full ${getBarColor(bar.status)}`}
              title={formatMiniTooltip(bar)}
            />
          ))}
        </div>
      </div>

      {/* Footer: Cadence left · Relative time right (no redundant status text) */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-base/60 text-[11px] font-mono text-text-dim">
        <span>{formatApiInterval(target.check_interval)}</span>
        <RelativeTime
          value={target.last_checked_at}
          emptyLabel="Sin ejecutar"
        />
      </div>
    </div>
  );
}
