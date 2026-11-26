import { Link } from "react-router-dom";
import { ArrowUpRight, Clock, Lock, Unlock } from "lucide-react";
import type { DomainInfo } from "../../types/domain";
import SelectionCheckbox from "../common/SelectionCheckbox";
import RelativeTime from "../common/connectivity/RelativeTime";
import { StatusShapeIcon } from "../common/connectivity/StatusPill";
import DomainRowActions from "./DomainRowActions";
import {
  DOMAIN_STATE_META,
  formatDomainDate,
  formatDomainExpiredAgo,
  getDomainHealthState,
  getDomainRemainingPercent,
  getEffectiveDaysRemaining,
  getEffectiveExpirationIso,
  type DomainThresholds,
} from "./useDomains";

interface DomainCardProps {
  domain: DomainInfo;
  thresholds: DomainThresholds;
  isActive?: boolean;
  isSelected: boolean;
  isScanning: boolean;
  onToggleSelect: (domain: DomainInfo) => void;
  onSelect: (domain: DomainInfo) => void;
  onScan: (domain: DomainInfo) => void;
  onEdit: (domain: DomainInfo) => void;
  onDelete: (domain: DomainInfo) => void;
}

/**
 * Compact Domain status card (homologated with SSL Certificates):
 * - Header: in-place status icon <-> checkbox swap + domain + non-valid label + floating hover actions
 * - Big remaining countdown ("159 días") + remaining-time bar ("44 % restante") + "Vence 4 may 2027"
 * - Footer: Registrar + transfer lock indicator + Revisado
 */
export default function DomainCard({
  domain,
  thresholds,
  isActive = false,
  isSelected,
  isScanning,
  onToggleSelect,
  onSelect,
  onScan,
  onEdit,
  onDelete,
}: DomainCardProps) {
  const state = getDomainHealthState(domain, thresholds);
  const meta = DOMAIN_STATE_META[state];
  const days = getEffectiveDaysRemaining(domain);
  const expIso = getEffectiveExpirationIso(domain);
  const remainingPct = getDomainRemainingPercent(domain);
  const linkedTarget = domain.linked_targets?.[0];

  const barColor =
    state === "expired" || state === "critical"
      ? "bg-rose-500"
      : state === "expiring"
        ? "bg-amber-400"
        : "bg-emerald-400";

  const countColor =
    state === "expired" || state === "critical"
      ? "text-rose-400"
      : state === "expiring"
        ? "text-amber-400"
        : "text-text-main";

  return (
    <div
      data-testid="connectivity-card"
      tabIndex={0}
      aria-label={domain.domain}
      onClick={() => onSelect(domain)}
      onKeyDown={(e) => {
        if (
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          onSelect(domain);
        }
      }}
      className={`group relative flex flex-col justify-between rounded-2xl border bg-bg-card px-3.5 py-3 transition-all cursor-pointer hover:border-accent-green/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/60 shadow-sm ${
        isActive
          ? "border-accent-green bg-accent-green/[0.06] ring-1 ring-accent-green/50"
          : isSelected
            ? "border-accent-green bg-accent-green/[0.03] ring-1 ring-accent-green/40"
            : meta.borderClass
      }`}
    >
      <div className="space-y-2">
        {/* Line 1: Status icon <-> checkbox + Domain + non-valid label + floating actions */}
        <div className="relative flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              data-card-selection
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(domain);
              }}
              className="relative h-5 w-5 shrink-0 flex items-center justify-center"
            >
              <span
                title={meta.label}
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
                  label={`Seleccionar ${domain.domain}`}
                  onChange={() => onToggleSelect(domain)}
                />
              </span>
            </div>

            <h3
              className="font-semibold text-text-main text-sm truncate group-hover:text-accent-green transition-colors"
              title={domain.domain}
            >
              {domain.domain}
            </h3>
          </div>

          {state !== "valid" && (
            <span
              className={`text-[11px] font-medium whitespace-nowrap shrink-0 ${meta.textClass}`}
            >
              {meta.label}
            </span>
          )}

          <DomainRowActions
            domain={domain}
            variant="card"
            isScanning={isScanning}
            onScan={onScan}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>

        {/* Remaining countdown + remaining bar + unambiguous expiry date */}
        {days !== null ? (
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={`text-xl font-bold font-mono tabular-nums tracking-tight ${countColor}`}
              >
                {days <= 0 ? formatDomainExpiredAgo(days) : `${days} días`}
              </span>
              {remainingPct !== null && (
                <span className="text-[11px] font-mono text-text-dim tabular-nums">
                  {remainingPct} % restante
                </span>
              )}
            </div>

            {remainingPct !== null && (
              <div className="h-1.5 w-full rounded-full bg-bg-dark overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.max(remainingPct, 3)}%` }}
                />
              </div>
            )}

            <div className="flex items-center justify-between gap-2 text-[11px] text-text-dim">
              <span className="font-mono">
                {days <= 0
                  ? `Venció ${formatDomainDate(expIso)}`
                  : `Vence ${formatDomainDate(expIso)}`}
              </span>
              {linkedTarget && (
                <Link
                  to={`/monitoring?target=${encodeURIComponent(linkedTarget.id)}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-0.5 text-text-muted hover:text-accent-green truncate max-w-[125px]"
                  title={`Vinculado a ${linkedTarget.name} en Uptime`}
                >
                  <ArrowUpRight size={10} className="shrink-0" />
                  <span className="truncate">{linkedTarget.name}</span>
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border-base/60 bg-bg-dark/60 px-2.5 py-2 text-[11px] text-text-dim">
            Sin datos del registro. Abre el panel para definir fecha manual.
          </div>
        )}
      </div>

      {/* Footer: Registrar · Bloqueo · Revisado */}
      <div className="mt-2.5 pt-2 border-t border-border-base/50 flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-text-muted truncate max-w-[120px]"
            title={domain.registrar || "Sin registrador"}
          >
            {domain.registrar || "Sin registrador"}
          </span>
          {domain.is_locked === true ? (
            <span
              className="inline-flex items-center gap-0.5 text-emerald-400/90 shrink-0"
              title="Bloqueo de transferencia activo"
            >
              <Lock size={11} />
            </span>
          ) : domain.is_locked === false ? (
            <span
              className="inline-flex items-center gap-0.5 text-amber-400 shrink-0"
              title="Sin bloqueo: el dominio podría transferirse"
            >
              <Unlock size={11} />
            </span>
          ) : null}
        </div>

        <span className="inline-flex items-center gap-1 text-text-dim font-mono shrink-0">
          <Clock size={11} />
          <RelativeTime
            value={domain.last_scanned_at}
            emptyLabel="nunca"
            className="text-text-muted"
          />
        </span>
      </div>
    </div>
  );
}
