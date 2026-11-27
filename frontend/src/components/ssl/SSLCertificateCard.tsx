import { Link } from "react-router-dom";
import { AlertTriangle, Clock, Layers, Link2 } from "lucide-react";
import type { SSLCertificate, SSLLinkedTarget } from "../../types/ssl";
import {
  healthPalette,
  hasMeasurement,
  sslGradeTone,
} from "../../utils/healthPresentation";
import SelectionCheckbox from "../common/SelectionCheckbox";
import RelativeTime, {
  formatExactDate,
} from "../common/connectivity/RelativeTime";
import { StatusShapeIcon } from "../common/connectivity/StatusPill";
import SSLCertificateRowActions from "./SSLCertificateRowActions";
import type { SSLDrawerSection } from "./SSLCertificateTableView";
import {
  SSL_STATE_META,
  formatExpiredAgo,
  formatSSLDate,
  formatTLSVersion,
  getCertRemainingPercent,
  getSSLGradeTooltip,
  getSSLHealthState,
  getSSLProblemReason,
  parseIssuerOrganization,
  type SSLDensity,
  type SSLThresholds,
} from "./useSSLCertificates";

interface SSLCertificateCardProps {
  cert: SSLCertificate;
  thresholds: SSLThresholds;
  density?: SSLDensity;
  isSelected: boolean;
  hasAnySelection: boolean;
  isScanning: boolean;
  onSelectToggle: (cert: SSLCertificate) => void;
  onSelectCert: (cert: SSLCertificate, section?: SSLDrawerSection) => void;
  onScan: (cert: SSLCertificate) => void;
  onEdit: (cert: SSLCertificate) => void;
  onDelete: (cert: SSLCertificate) => void;
  onLinkTarget?: (cert: SSLCertificate, target: SSLLinkedTarget) => void;
  isLinking?: boolean;
}

export default function SSLCertificateCard({
  cert,
  thresholds,
  density = "comfortable",
  isSelected,
  hasAnySelection,
  isScanning,
  onSelectToggle,
  onSelectCert,
  onScan,
  onEdit,
  onDelete,
  onLinkTarget,
  isLinking = false,
}: SSLCertificateCardProps) {
  const state = getSSLHealthState(cert, thresholds);
  const meta = SSL_STATE_META[state];
  const isCompact = density === "compact";
  const problemReason = state === "problem" ? getSSLProblemReason(cert) : null;
  const issuerClean = parseIssuerOrganization(cert.issuer);
  const tlsClean = formatTLSVersion(cert.tls_version);
  const days = cert.days_remaining;
  const sanCount = cert.san_domains?.length || 1;
  const remainingPct = getCertRemainingPercent(cert);
  const linked = cert.linked_targets || [];
  const suggested = cert.suggested_targets || [];

  const gradeMeasured =
    hasMeasurement(cert.last_scanned_at) && !cert.error_message && cert.is_valid;
  const gradeTone = sslGradeTone(cert.security_grade, gradeMeasured);

  const isUrgent =
    state === "expired" || state === "problem" || state === "critical";
  const isWarning = state === "expiring";

  // Neutral border on valid; amber on expiring; rose on expired / critical / problem
  const cardSurfaceClass = isSelected
    ? "border-accent-green bg-accent-green/5 ring-2 ring-accent-green/30"
    : isUrgent
      ? "bg-[#1c1217] border-rose-500/45 hover:bg-[#25161e] hover:border-rose-400/70"
      : isWarning
        ? "bg-bg-card border-amber-500/40 hover:border-amber-400/70"
        : "bg-bg-card border-border-base/80 hover:border-text-dim/60";

  const iconColorClass =
    meta.tone === "success"
      ? "text-emerald-400"
      : meta.tone === "danger"
        ? "text-rose-400"
        : meta.tone === "warning"
          ? "text-amber-400"
          : "text-slate-400";

  // Neutral metric text when healthy; reserve color strictly for warning (amber) & critical/expired/problem (rose)
  const metricColorClass =
    state === "expired" || state === "problem" || state === "critical"
      ? "text-rose-400"
      : state === "expiring"
        ? "text-amber-400"
        : state === "valid"
          ? "text-text-main"
          : "text-text-dim";

  const barFillClass =
    state === "expired" || state === "problem" || state === "critical"
      ? "bg-rose-500"
      : state === "expiring"
        ? "bg-amber-400"
        : "bg-emerald-500";

  const forceCheckbox = isSelected || hasAnySelection;

  return (
    <div
      data-testid="connectivity-card"
      role="button"
      tabIndex={0}
      aria-label={`Ver detalle de ${cert.domain}`}
      onClick={() => onSelectCert(cert, "overview")}
      onKeyDown={(e) => {
        if (
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          onSelectCert(cert, "overview");
        }
      }}
      className={`group relative flex h-full flex-col justify-between rounded-2xl border cursor-pointer transition-all duration-150 ${
        isCompact ? "p-3.5 gap-2.5" : "p-4 gap-3"
      } ${cardSurfaceClass}`}
    >
      {/* Top Block: Single left alignment (Status Icon / In-place Checkbox + Domain + Floating Actions) */}
      <div className="space-y-1">
        <div className="relative flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* In-place Status Shape Icon -> Selection Checkbox swap (top-left, like Uptime) */}
            <div
              className={`relative shrink-0 grid place-items-center ${
                isCompact ? "w-4 h-4" : "w-[18px] h-[18px]"
              }`}
            >
              <span
                className={`grid place-items-center transition-opacity duration-150 ${
                  forceCheckbox
                    ? "opacity-0 pointer-events-none"
                    : "opacity-100 group-hover:opacity-0 group-focus-within:opacity-0 [@media(hover:none)]:opacity-0"
                }`}
              >
                <StatusShapeIcon
                  shape={meta.shape}
                  size={isCompact ? 16 : 18}
                  className={iconColorClass}
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
                  label={`Seleccionar ${cert.domain}`}
                  onChange={() => onSelectToggle(cert)}
                />
              </div>
            </div>

            <h3
              className={`font-semibold truncate leading-tight min-w-0 ${
                isCompact ? "text-[13px]" : "text-sm"
              } ${
                isUrgent
                  ? "text-rose-300 font-bold"
                  : "text-text-main group-hover:text-accent-green transition-colors"
              }`}
              title={`${cert.domain}${cert.port && cert.port !== 443 ? `:${cert.port}` : ""}`}
            >
              {cert.domain}
              {cert.port && cert.port !== 443 && (
                <span className="ml-1 font-mono text-[11px] font-normal text-sky-400">
                  :{cert.port}
                </span>
              )}
            </h3>

            {/* Inline linked / suggested Uptime pill beside domain (keeps card height compact like Uptime) */}
            {linked.length > 0 && (() => {
              const primary = linked[0];
              const isPausedTarget = primary.enabled === false;
              return (
                <Link
                  to={`/monitoring?target=${primary.id}`}
                  onClick={(e) => e.stopPropagation()}
                  title={
                    isPausedTarget
                      ? `Vinculado al target ${primary.name} (pausado en Uptime)`
                      : `Vinculado al target ${linked.map((t) => t.name).join(", ")}`
                  }
                  className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border transition-colors max-w-[115px] ${
                    isPausedTarget
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:border-amber-400/60"
                      : "bg-bg-dark/80 border-border-base/80 text-text-muted hover:text-accent-green hover:border-accent-green/40"
                  }`}
                >
                  <Link2
                    size={9}
                    className={`shrink-0 ${
                      isPausedTarget ? "text-amber-400" : "text-accent-green/80"
                    }`}
                  />
                  <span className="truncate">
                    {primary.name}
                    {isPausedTarget ? " (pausado)" : ""}
                  </span>
                </Link>
              );
            })()}
            {linked.length === 0 && suggested.length > 0 && onLinkTarget && (
              <button
                type="button"
                disabled={isLinking}
                onClick={(e) => {
                  e.stopPropagation();
                  onLinkTarget(cert, suggested[0]);
                }}
                title={`Target activo coincidente en Uptime: ${suggested[0].name}. Haz clic para vincularlo.`}
                className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border border-dashed border-border-base text-text-dim hover:text-accent-green hover:border-accent-green/50 transition-colors max-w-[110px] cursor-pointer disabled:opacity-50 !min-h-0 !min-w-0"
              >
                <Link2 size={9} className="shrink-0" />
                <span className="truncate">
                  {isLinking ? "..." : suggested[0].name}
                </span>
              </button>
            )}
          </div>

          {/* Non-shifting Floating Hover Actions */}
          <SSLCertificateRowActions
            cert={cert}
            variant="card"
            isScanning={isScanning}
            onScan={onScan}
            onViewChain={(c) => onSelectCert(c, "chain")}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>

        {/* Line 2: Issuer · Grade (rounded pill with tooltip) · TLS — clean & compact */}
        <div
          className={`${isCompact ? "pl-[24px] text-[11px]" : "pl-[26px] text-xs"} flex items-center gap-1.5 min-w-0 text-text-dim`}
        >
          <span className="truncate" title={cert.issuer || undefined}>
            {issuerClean}
          </span>
          {cert.security_grade && gradeMeasured && (
            <>
              <span aria-hidden="true">·</span>
              <span
                className={`shrink-0 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border leading-none ${healthPalette[gradeTone].badge}`}
                title={getSSLGradeTooltip(cert)}
              >
                {cert.security_grade}
              </span>
            </>
          )}
          {tlsClean && (
            <>
              <span aria-hidden="true">·</span>
              <span className="shrink-0 font-mono text-[11px]">{tlsClean}</span>
            </>
          )}
        </div>

        {/* Optional Problem Diagnostic ONLY on abnormal certs (no extra line on healthy certs) */}
        {problemReason && (
          <div
            className={`${isCompact ? "pl-[24px]" : "pl-[26px]"} flex items-center gap-1.5 text-[11px] font-mono text-rose-300 truncate`}
            title={cert.error_message || problemReason}
          >
            <AlertTriangle size={11} className="text-rose-400 shrink-0" />
            <span className="truncate">{problemReason}</span>
          </div>
        )}
      </div>

      {/* Bottom Block: Big Days Remaining + SANs + Remaining-Time Bar + Unambiguous Date */}
      <div className={isCompact ? "space-y-1.5" : "space-y-2"}>
        <div
          className={`flex items-center justify-between gap-2 ${
            isCompact ? "h-7" : "h-8"
          }`}
        >
          <div className="min-w-0 truncate flex items-baseline gap-1.5">
            {state === "problem" ? (
              <span
                className={`font-mono font-bold leading-none ${metricColorClass} ${
                  isCompact ? "text-sm" : "text-base"
                }`}
              >
                Con problemas
              </span>
            ) : days !== null && days !== undefined ? (
              <span
                className={`font-mono font-bold leading-none ${metricColorClass} ${
                  isCompact ? "text-lg" : "text-2xl"
                }`}
              >
                {days <= 0
                  ? "Vencido"
                  : `${days} ${days === 1 ? "día" : "días"}`}
              </span>
            ) : (
              <span className="font-mono text-sm font-medium text-text-dim leading-none">
                Sin datos
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectCert(cert, "sans");
            }}
            title={
              cert.san_domains && cert.san_domains.length > 0
                ? `Ver SANs: ${cert.san_domains.slice(0, 6).join(", ")}`
                : "Ver dominios SAN"
            }
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[11px] bg-bg-dark/80 border border-border-base/80 text-text-muted hover:text-accent-green hover:border-accent-green/40 transition-colors shrink-0 cursor-pointer !min-h-0 !min-w-0"
          >
            <Layers size={10} className="text-sky-400 shrink-0" />
            <span>
              {sanCount} {sanCount === 1 ? "SAN" : "SANs"}
            </span>
          </button>
        </div>

        {/* Remaining Lifetime Progress Bar (drains toward 0% as expiry nears) */}
        <div
          className={`w-full bg-bg-dark border border-border-base/70 rounded-full overflow-hidden ${
            isCompact ? "h-1.5" : "h-2"
          }`}
          title={
            remainingPct !== null
              ? `${remainingPct} % de vigencia restante${
                  cert.issued_at
                    ? ` · emitido ${formatSSLDate(cert.issued_at)}`
                    : ""
                }`
              : "Sin datos de vigencia"
          }
        >
          {remainingPct !== null && state !== "pending" && (
            <div
              className={`h-full rounded-full transition-all ${barFillClass}`}
              style={{ width: `${remainingPct}%` }}
            />
          )}
        </div>

        {/* Footer: Unambiguous Expiry Date + Explicit "Revisado hace X" */}
        <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-text-dim">
          <span
            className={`truncate ${
              days !== null && days !== undefined && days <= 0
                ? "text-rose-400 font-medium"
                : ""
            }`}
          >
            {days !== null && days !== undefined && days <= 0
              ? formatExpiredAgo(days)
              : cert.expiration_date
                ? `Vence ${formatSSLDate(cert.expiration_date)}`
                : "Sin datos de vigencia"}
          </span>
          <span
            className="inline-flex items-center gap-1 text-[10px] text-text-dim shrink-0"
            title={
              cert.last_scanned_at
                ? `Última comprobación real: ${formatExactDate(cert.last_scanned_at)}`
                : "Sin comprobación todavía"
            }
          >
            <Clock size={10} className="shrink-0 opacity-75" />
            <RelativeTime
              value={cert.last_scanned_at}
              prefix="Revisado"
              emptyLabel="Sin revisar"
              className="text-[10px] text-text-dim"
            />
          </span>
        </div>
      </div>
    </div>
  );
}
