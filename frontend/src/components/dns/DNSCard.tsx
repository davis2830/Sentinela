import { Link } from "react-router-dom";
import { ArrowUpRight, Clock, Link2 } from "lucide-react";
import type { DNSLinkedTarget, DNSRecord } from "../../types/dns";
import SelectionCheckbox from "../common/SelectionCheckbox";
import RelativeTime from "../common/connectivity/RelativeTime";
import StatusPill, { StatusShapeIcon } from "../common/connectivity/StatusPill";
import DNSRowActions from "./DNSRowActions";
import {
  DNS_STATE_META,
  DNS_TYPE_TOOLTIPS,
  computeDNSDiff,
  formatDNSLatency,
  formatDNSTTL,
  getDNSHealthState,
  getDNSLatencyToneClass,
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
  onAcceptReference: (record: DNSRecord) => void;
  onEdit: (record: DNSRecord) => void;
  onDelete: (record: DNSRecord) => void;
  onLinkTarget?: (record: DNSRecord, target: DNSLinkedTarget) => void;
}

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
  const firstValue = values[0] || "";
  const extraCount = values.length > 1 ? values.length - 1 : 0;

  const latestDiff = record.latest_change
    ? computeDNSDiff(
        record.latest_change.old_value,
        record.latest_change.new_value,
      )
    : null;

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
      className={`group relative flex flex-col justify-between rounded-2xl border bg-bg-card p-3.5 transition-all cursor-pointer hover:border-accent-green/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/60 shadow-sm ${
        isSelected
          ? "border-accent-green bg-accent-green/[0.03] ring-1 ring-accent-green/40"
          : meta.borderClass
      }`}
    >
      {/* Top section */}
      <div className="space-y-2">
        {/* Line 1: In-place status/checkbox swap + Domain + Status pill / floating hover actions */}
        <div className="relative flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Status icon <-> SelectionCheckbox in-place swap */}
            <div
              data-card-selection
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(record);
              }}
              className="relative h-5 w-5 shrink-0 flex items-center justify-center"
            >
              <span
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

          <div className="shrink-0">
            <StatusPill
              tone={meta.tone}
              shape={meta.shape}
              label={stateLabel}
              size="xs"
            />
          </div>

          {/* Non-shifting hover actions overlay */}
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

        {/* Line 2: Type · TTL · Uptime Link */}
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

        {/* Main Resolved Value */}
        <div
          className="rounded-xl border border-border-base/60 bg-bg-dark/70 px-2.5 py-2 font-mono text-xs"
          title={values.join("\n") || undefined}
        >
          {firstValue ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-text-main truncate">
                {firstValue}
              </span>
              {extraCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-bg-card border border-border-base text-[10px] font-semibold text-text-dim shrink-0">
                  +{extraCount}
                </span>
              )}
              {isSpf && (
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold shrink-0">
                  SPF
                </span>
              )}
              {isDmarc && (
                <span className="px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30 text-[10px] font-bold shrink-0">
                  DMARC
                </span>
              )}
            </div>
          ) : (
            <span className={state === "error" ? "text-rose-400" : "text-text-dim"}>
              {state === "error"
                ? record.last_error_message || stateLabel
                : "Sin medición registrada"}
            </span>
          )}
        </div>

        {/* Contextual alert / mutation diff line */}
        {state === "mutation" && latestDiff?.summary && (
          <div className="flex items-center justify-between gap-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 py-1 font-mono">
            <span className="truncate" title={latestDiff.summary}>
              {latestDiff.summary}
            </span>
            {record.latest_change?.changed_at && (
              <RelativeTime
                value={record.latest_change.changed_at}
                className="text-[10px] text-amber-200/80 shrink-0"
              />
            )}
          </div>
        )}

        {state === "propagating" && (
          <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 py-1 truncate">
            Resolvers con respuestas distintas (propagando)
          </div>
        )}

        {state === "mismatch" && (
          <div className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-2 py-1 font-mono truncate">
            Esperado: {(record.expected_values || []).join(", ")}
          </div>
        )}
      </div>

      {/* Footer: Latency + Checked RelativeTime */}
      <div className="mt-3 pt-2 border-t border-border-base/50 flex items-center justify-between gap-2 text-[11px] font-mono">
        <span
          className={`tabular-nums ${getDNSLatencyToneClass(record.response_time_ms)}`}
          title={
            record.resolver ? `Consultado vía ${record.resolver}` : undefined
          }
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
