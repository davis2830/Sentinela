import { Code2, ExternalLink } from "lucide-react";
import type { APICheckTarget } from "../../types/api_checks";
import { apiResponseTone, healthPalette } from "../../utils/healthPresentation";
import SelectionCheckbox from "../common/SelectionCheckbox";
import RelativeTime from "../common/connectivity/RelativeTime";
import { StatusShapeIcon } from "../common/connectivity/StatusPill";
import APICheckRowActions from "./APICheckRowActions";
import {
  API_STATE_META,
  formatApiInterval,
  getAPICheckHealthState,
  getMethodBadgeClass,
  getSchemaFieldCount,
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
  const isUrgent = state === "fail";
  const forceCheckbox = isSelected || hasAnySelection;
  const schemaCount = getSchemaFieldCount(target);
  const latency = target.last_response_time_ms;
  const maxLatency = target.expected_response_time_ms;

  const cardSurfaceClass = isSelected
    ? "border-accent-green bg-accent-green/[0.04] ring-1 ring-accent-green/40"
    : isUrgent
      ? "border-rose-500/40 bg-rose-500/[0.04] hover:border-rose-500/70"
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
        isCompact ? "p-3.5 gap-2.5" : "p-4 gap-3"
      } ${cardSurfaceClass}`}
    >
      {/* Top: Status Icon / In-place Checkbox + Method + Name + Floating Actions */}
      <div className="space-y-1.5 min-w-0">
        <div className="relative flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="relative shrink-0 grid place-items-center w-5 h-5">
              <span
                className={`grid place-items-center transition-opacity duration-150 ${
                  forceCheckbox
                    ? "opacity-0 pointer-events-none"
                    : "opacity-100 group-hover:opacity-0 group-focus-within:opacity-0 [@media(hover:none)]:opacity-0"
                }`}
              >
                <StatusShapeIcon
                  shape={meta.shape}
                  size={isCompact ? 16 : 17}
                  className={meta.textClass}
                  label={meta.label}
                />
              </span>
              <div
                className={`absolute inset-0 grid place-items-center transition-opacity duration-150 ${
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

            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border font-mono shrink-0 ${getMethodBadgeClass(
                target.method,
              )}`}
            >
              {target.method}
            </span>

            <h3
              className={`font-semibold truncate leading-tight min-w-0 ${
                isCompact ? "text-[13px]" : "text-sm"
              } ${
                isUrgent
                  ? "text-rose-300 font-bold"
                  : "text-text-main group-hover:text-accent-green transition-colors"
              }`}
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

        {/* URL */}
        <div className="flex items-center gap-1 text-[11px] font-mono text-text-dim pl-7 min-w-0">
          <span className="truncate" title={target.url}>
            {target.url}
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
            <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-border-base/60 bg-bg-dark/60 px-3 py-2 text-[11px]">
        <div className="min-w-0">
          <div className="text-[10px] text-text-dim">HTTP</div>
          <div className="font-mono font-semibold text-text-main tabular-nums mt-0.5 truncate">
            {target.last_http_status ?? "—"}
            <span className="text-text-dim font-normal">
              /{target.expected_status}
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[10px] text-text-dim">Latencia</div>
          <div className="font-mono font-semibold tabular-nums mt-0.5 truncate">
            {latency !== null && latency !== undefined ? (
              <span className={healthPalette[apiResponseTone(target)].text}>
                {Math.round(latency)} ms
              </span>
            ) : (
              <span className="text-text-dim">—</span>
            )}
            <span className="text-[10px] text-text-dim font-normal">
              {" "}
              /&lt;{maxLatency}
            </span>
          </div>
        </div>

        <div className="min-w-0 text-right">
          <div className="text-[10px] text-text-dim">Schema</div>
          <div className="font-mono mt-0.5 truncate">
            {schemaCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-accent-purple font-semibold">
                <Code2 size={10} />
                {schemaCount}
              </span>
            ) : (
              <span className="text-text-dim">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-base/60 text-[11px] font-mono text-text-dim">
        <span className={meta.textClass}>{meta.label}</span>
        <div className="flex items-center gap-1.5">
          <span>{formatApiInterval(target.check_interval)}</span>
          <span aria-hidden="true">·</span>
          <RelativeTime value={target.last_checked_at} emptyLabel="Nunca" />
        </div>
      </div>
    </div>
  );
}
