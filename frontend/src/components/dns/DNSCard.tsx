import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Clock, Link2 } from "lucide-react";
import type {
  DNSLinkedTarget,
  DNSRecord,
  DNSReferenceMode,
} from "../../types/dns";
import SelectionCheckbox from "../common/SelectionCheckbox";
import RelativeTime from "../common/connectivity/RelativeTime";
import { StatusShapeIcon } from "../common/connectivity/StatusPill";
import DNSRowActions from "./DNSRowActions";
import {
  DNS_STATE_META,
  DNS_TYPE_TOOLTIPS,
  formatDNSLatency,
  formatDNSTTL,
  getDNSErrorCodeLabel,
  getDNSHealthState,
  getDNSLatencyToneClass,
  getDNSLatencyTooltip,
  getDNSReferenceModeLabel,
  getDNSStateLabel,
  getTypeBadgeClass,
  parseDNSValues,
} from "./useDNSRecords";

interface DNSCardProps {
  record: DNSRecord;
  isSelected: boolean;
  isScanning: boolean;
  isAcceptingRef: boolean;
  isLinking?: boolean;
  onToggleSelect: (record: DNSRecord) => void;
  onSelect: (record: DNSRecord) => void;
  onScan: (record: DNSRecord) => void;
  onAcceptReference: (record: DNSRecord, mode?: DNSReferenceMode) => void;
  onEdit: (record: DNSRecord) => void;
  onDelete: (record: DNSRecord) => void;
  onLinkTarget?: (record: DNSRecord, target: DNSLinkedTarget) => void;
}

/**
 * Compact DNS status card (~165px, aligned with Uptime & SSL):
 * - Top-left status shape icon swaps in-place with selection checkbox (no redundant pill on resolved).
 * - Non-resolved cards show concise status text on top-right; hover actions float cleanly without shifting.
 * - Mismatch cards keep red ONLY on card border, icon, and differing IPs inside a neutral box (showing BOTH full resolved & expected values).
 * - Resolved cards use the same reference row to show "Referencia coincide" so both cards stay balanced.
 */
export default function DNSCard({
  record,
  isSelected,
  isScanning,
  isAcceptingRef,
  isLinking = false,
  onToggleSelect,
  onSelect,
  onScan,
  onAcceptReference,
  onEdit,
  onDelete,
  onLinkTarget,
}: DNSCardProps) {
  const state = getDNSHealthState(record);
  const meta = DNS_STATE_META[state];
  const stateLabel = getDNSStateLabel(record, state);
  const values = parseDNSValues(record.value);
  const expectedValues = record.expected_values || [];
  const expectedLower = new Set(expectedValues.map((v) => v.toLowerCase()));
  const resolvedLower = new Set(values.map((v) => v.toLowerCase()));

  const linkedTarget = record.linked_targets?.[0];
  const suggestedTarget = record.suggested_targets?.[0];

  const isTxt = record.record_type === "TXT";
  const isSpf = isTxt && record.value.includes("v=spf1");
  const isDmarc = isTxt && record.value.includes("v=DMARC1");

  return (
    <div
      data-testid="connectivity-card"
      tabIndex={0}
      aria-label={`${record.record_type} ${record.domain}`}
      onClick={() => onSelect(record)}
      onKeyDown={(e) => {
        if (
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          onSelect(record);
        }
      }}
      className={`group relative flex flex-col justify-between rounded-2xl border bg-bg-card px-3.5 py-3 transition-all cursor-pointer hover:border-accent-green/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/60 shadow-sm ${
        isSelected
          ? "border-accent-green bg-accent-green/[0.03] ring-1 ring-accent-green/40"
          : meta.borderClass
      }`}
    >
      <div className="space-y-1.5">
        {/* Line 1: In-place status icon <-> checkbox + Domain + concise non-resolved label + floating actions */}
        <div className="relative flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              data-card-selection
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(record);
              }}
              className="relative h-5 w-5 shrink-0 flex items-center justify-center"
            >
              <span
                title={stateLabel}
                className={`transition-opacity ${
                  isSelected
                    ? "opacity-0 pointer-events-none"
                    : "opacity-100 group-hover:opacity-0 group-focus-within:opacity-0"
                }`}
              >
                <StatusShapeIcon
                  shape={meta.shape}
                  size={15}
                  className={meta.textClass}
                />
              </span>
              <span
                className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                  isSelected
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                }`}
              >
                <SelectionCheckbox
                  checked={isSelected}
                  label={`Seleccionar ${record.record_type} ${record.domain}`}
                  onChange={() => onToggleSelect(record)}
                />
              </span>
            </div>

            <h3
              className="font-semibold text-text-main text-sm truncate group-hover:text-accent-green transition-colors"
              title={record.domain}
            >
              {record.domain}
            </h3>
          </div>

          {/* Only show state label when NOT resolved (avoids icon + pill duplication) */}
          {state !== "resolved" && (
            <span
              className={`text-[11px] font-medium whitespace-nowrap shrink-0 ${meta.textClass}`}
            >
              {stateLabel}
            </span>
          )}

          {/* Floating non-shifting hover/focus/touch actions */}
          <DNSRowActions
            record={record}
            variant="card"
            isScanning={isScanning}
            isAcceptingRef={isAcceptingRef}
            onScan={onScan}
            onAcceptReference={onAcceptReference}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>

        {/* Line 2: Neutral Type badge · TTL · Uptime Link */}
        <div className="flex items-center gap-1.5 text-[11px] text-text-dim min-w-0 flex-wrap">
          <span
            title={
              DNS_TYPE_TOOLTIPS[record.record_type] ||
              `Registro ${record.record_type}`
            }
            className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold border shrink-0 ${getTypeBadgeClass(
              record.record_type,
            )}`}
          >
            {record.record_type}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums shrink-0">
            TTL {formatDNSTTL(record.ttl)}
          </span>

          {linkedTarget && (
            <>
              <span aria-hidden="true">·</span>
              <Link
                to={`/monitoring?target=${encodeURIComponent(linkedTarget.id)}`}
                onClick={(e) => e.stopPropagation()}
                title={
                  linkedTarget.enabled
                    ? `Vinculado al target ${linkedTarget.name} en Uptime`
                    : `Vinculado a ${linkedTarget.name} (pausado en Uptime)`
                }
                className={`inline-flex items-center gap-0.5 truncate max-w-[130px] transition-colors ${
                  linkedTarget.enabled
                    ? "text-text-muted hover:text-accent-green"
                    : "text-amber-300 hover:text-amber-200"
                }`}
              >
                <ArrowUpRight size={10} className="shrink-0" />
                <span className="truncate">
                  {linkedTarget.name}
                  {!linkedTarget.enabled ? " (pausado)" : ""}
                </span>
              </Link>
            </>
          )}

          {!linkedTarget && suggestedTarget && onLinkTarget && (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                disabled={isLinking}
                onClick={(e) => {
                  e.stopPropagation();
                  onLinkTarget(record, suggestedTarget);
                }}
                title={`Vincular con ${suggestedTarget.name} en Uptime`}
                className="inline-flex items-center gap-0.5 text-text-dim hover:text-accent-green transition-colors truncate max-w-[140px] cursor-pointer !min-h-0 !min-w-0"
              >
                <Link2 size={10} className="shrink-0" />
                <span className="truncate">Vincular: {suggestedTarget.name}</span>
              </button>
            </>
          )}
        </div>

        {/* Neutral Value & Reference Box (highlights only differing IPs on mismatch) */}
        <div
          className="rounded-xl border border-border-base/70 bg-bg-dark/70 px-2.5 py-2 font-mono text-[11px] space-y-1"
          title={values.join("\n") || undefined}
        >
          {state === "mismatch" ? (
            <>
              {/* Full resolved values with differing IPs highlighted */}
              <div className="flex items-start gap-1.5 min-w-0">
                <span className="text-text-dim font-sans shrink-0 w-12">
                  Actual
                </span>
                <div className="flex flex-wrap gap-1 min-w-0">
                  {values.map((v, i) => {
                    const differs = !expectedLower.has(v.toLowerCase());
                    return (
                      <span
                        key={i}
                        className={`break-all ${
                          differs
                            ? "text-rose-300 bg-rose-500/15 px-1 rounded font-semibold"
                            : "text-text-main"
                        }`}
                      >
                        {v}
                      </span>
                    );
                  })}
                </div>
              </div>
              {/* Full expected values so user sees exactly what differs */}
              <div className="flex items-start gap-1.5 min-w-0 pt-1 border-t border-border-base/50">
                <span className="text-text-dim font-sans shrink-0 w-12">
                  Ref.
                </span>
                <div className="flex flex-wrap gap-1 min-w-0">
                  {expectedValues.map((ev, i) => {
                    const missing = !resolvedLower.has(ev.toLowerCase());
                    return (
                      <span
                        key={i}
                        className={`break-all ${
                          missing
                            ? "text-text-muted underline decoration-rose-400/70 decoration-dotted underline-offset-2"
                            : "text-text-dim"
                        }`}
                      >
                        {ev}
                      </span>
                    );
                  })}
                </div>
              </div>
            </>
          ) : state === "error" ? (
            <div className="space-y-0.5">
              <div className="text-rose-400 font-semibold">
                {getDNSErrorCodeLabel(record)}
              </div>
              {record.last_error_message && (
                <div className="text-text-dim font-sans truncate">
                  {record.last_error_message}
                </div>
              )}
            </div>
          ) : values.length > 0 ? (
            <>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-text-main truncate">
                  {values.length <= 2 ? values.join(", ") : values[0]}
                </span>
                {values.length > 2 && (
                  <span className="px-1.5 py-0.2 rounded bg-bg-card border border-border-base text-[10px] font-semibold text-text-dim shrink-0">
                    +{values.length - 1}
                  </span>
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

              {/* Balanced reference / propagation line (same visual slot as mismatch Ref.) */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-border-base/45 font-sans text-[11px]">
                {state === "propagating" ? (
                  <span className="text-amber-300 truncate">
                    {record.propagation_status === "propagating"
                      ? "Resolvers en desacuerdo (propagando)"
                      : "Cambio reciente (dentro del TTL)"}
                  </span>
                ) : expectedValues.length > 0 && record.matches_expected ? (
                  <span className="inline-flex items-center gap-1 text-text-muted truncate">
                    <span>Referencia</span>
                    <Check size={11} className="text-emerald-400 shrink-0" />
                    <span className="text-emerald-400/90">coincide</span>
                    {record.reference_mode &&
                      record.reference_mode !== "exact" && (
                        <span className="text-text-dim">
                          · {getDNSReferenceModeLabel(record.reference_mode)}
                        </span>
                      )}
                  </span>
                ) : (
                  <span className="text-text-dim truncate">
                    Sin referencia configurada
                  </span>
                )}
              </div>
            </>
          ) : (
            <span className="text-text-dim font-sans">
              Sin medición registrada
            </span>
          )}
        </div>
      </div>

      {/* Footer: Latency (with clear resolver tooltip) + Revisado */}
      <div className="mt-2.5 pt-2 border-t border-border-base/50 flex items-center justify-between gap-2 text-[11px] font-mono">
        <span
          className={`tabular-nums ${getDNSLatencyToneClass(record.response_time_ms)}`}
          title={getDNSLatencyTooltip(record)}
        >
          {formatDNSLatency(record.response_time_ms)}
        </span>

        <span className="inline-flex items-center gap-1 text-text-dim">
          <Clock size={11} className="shrink-0" />
          <span>Revisado</span>
          <RelativeTime
            value={record.last_scanned_at}
            emptyLabel="nunca"
            className="text-text-muted"
          />
        </span>
      </div>
    </div>
  );
}
