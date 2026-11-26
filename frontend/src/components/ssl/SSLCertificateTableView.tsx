import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Layers,
  Link2,
} from "lucide-react";
import type { SSLCertificate, SSLLinkedTarget } from "../../types/ssl";
import {
  healthPalette,
  hasMeasurement,
  sslGradeTone,
} from "../../utils/healthPresentation";
import {
  formatExactDate,
  formatRelativeAgo,
} from "../common/connectivity/RelativeTime";
import StatusPill from "../common/connectivity/StatusPill";
import SSLCertificateRowActions from "./SSLCertificateRowActions";
import {
  SSL_STATE_META,
  formatExpiredAgo,
  formatSSLDate,
  formatTLSVersion,
  getSSLGradeTooltip,
  getSSLHealthState,
  getSSLProblemReason,
  parseIssuerOrganization,
  type SSLDensity,
  type SSLGroup,
  type SSLSortField,
  type SSLThresholds,
} from "./useSSLCertificates";

export type SSLDrawerSection = "overview" | "chain" | "sans";

export interface SSLCertificateTableViewProps {
  sortedCertificates: SSLCertificate[];
  groupedCertificates: SSLGroup[] | null;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  thresholds: SSLThresholds;
  density: SSLDensity;
  sortField: SSLSortField;
  sortAsc: boolean;
  onSortChange: (field: SSLSortField) => void;
  selectedIds: string[];
  onToggleSelect: (cert: SSLCertificate) => void;
  onSelectAll: () => void;
  onSelectCert: (cert: SSLCertificate, section?: SSLDrawerSection) => void;
  onScan: (cert: SSLCertificate) => void;
  scanningId: string | null;
  onEdit: (cert: SSLCertificate) => void;
  onDelete: (cert: SSLCertificate) => void;
  onLinkTarget?: (cert: SSLCertificate, target: SSLLinkedTarget) => void;
  linkingCertId?: string | null;
}

export default function SSLCertificateTableView({
  sortedCertificates,
  groupedCertificates,
  collapsedGroups,
  onToggleGroup,
  thresholds,
  density,
  sortField,
  sortAsc,
  onSortChange,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onSelectCert,
  onScan,
  scanningId,
  onEdit,
  onDelete,
  onLinkTarget,
  linkingCertId,
}: SSLCertificateTableViewProps) {
  const allSelected =
    sortedCertificates.length > 0 &&
    selectedIds.length === sortedCertificates.length;
  const isCompact = density === "compact";
  const paddingY = isCompact ? "py-2" : "py-3";

  const renderRow = (cert: SSLCertificate) => {
    const isSelected = selectedIds.includes(cert.id);
    const state = getSSLHealthState(cert, thresholds);
    const meta = SSL_STATE_META[state];
    const problemReason = state === "problem" ? getSSLProblemReason(cert) : null;
    const issuerClean = parseIssuerOrganization(cert.issuer);
    const tlsClean = formatTLSVersion(cert.tls_version);
    const days = cert.days_remaining;
    const sanCount = cert.san_domains?.length || 1;
    const linked = cert.linked_targets || [];
    const suggested = cert.suggested_targets || [];
    const gradeMeasured =
      hasMeasurement(cert.last_scanned_at) && !cert.error_message && cert.is_valid;
    const gradeTone = sslGradeTone(cert.security_grade, gradeMeasured);

    const isUrgent = state === "expired" || state === "problem" || state === "critical";
    const isWarning = state === "expiring";

    const rowBgClass = isSelected
      ? "bg-accent-green/5"
      : isUrgent
        ? "bg-[#1c1217] border-l-2 border-l-rose-500 hover:bg-[#25161e]"
        : isWarning
          ? "bg-amber-500/[0.04] border-l-2 border-l-amber-400 hover:bg-amber-500/[0.08]"
          : "hover:bg-white/[0.03]";

    // Neutral text when healthy; reserve color strictly for warning (amber) & critical/expired/problem (rose)
    const expiryTextClass =
      state === "expired" || state === "critical" || state === "problem"
        ? "text-rose-400 font-semibold"
        : state === "expiring"
          ? "text-amber-400 font-semibold"
          : state === "valid"
            ? "text-text-main font-semibold"
            : "text-text-dim";

    const lastCheckedTooltip = cert.last_scanned_at
      ? `Revisado ${formatRelativeAgo(cert.last_scanned_at)} (${formatExactDate(cert.last_scanned_at)})`
      : "Sin comprobación todavía";

    return (
      <tr
        key={cert.id}
        onClick={() => onSelectCert(cert, "overview")}
        tabIndex={0}
        aria-label={cert.domain}
        onKeyDown={(e) => {
          if (
            e.target === e.currentTarget &&
            (e.key === "Enter" || e.key === " ")
          ) {
            e.preventDefault();
            onSelectCert(cert, "overview");
          }
        }}
        className={`group cursor-pointer transition-colors border-b border-border-base/60 ${rowBgClass}`}
      >
        {/* 1. Checkbox */}
        <td
          className={`${paddingY} px-2.5 text-center`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="checkbox"
            aria-checked={isSelected}
            aria-label={`Seleccionar ${cert.domain}`}
            title={isSelected ? "Deseleccionar" : "Seleccionar"}
            onClick={() => onToggleSelect(cert)}
            className="sentinel-selection grid h-6 w-6 place-items-center rounded bg-transparent p-0 cursor-pointer !min-h-0 !min-w-0"
          >
            <span
              className={`grid h-4 w-4 place-items-center rounded transition-colors ${
                isSelected
                  ? "bg-accent-green text-black ring-1 ring-accent-green/40"
                  : "border border-border-base/90 bg-bg-dark/80 text-transparent"
              }`}
            >
              <Check
                size={10}
                strokeWidth={3}
                className={isSelected ? "opacity-100" : "opacity-0"}
              />
            </span>
          </button>
        </td>

        {/* 2. Estado (shape + pill, never static padlock) */}
        <td className={`${paddingY} px-2.5 whitespace-nowrap`}>
          <StatusPill
            size="xs"
            label={meta.label}
            tone={meta.tone}
            shape={meta.shape}
            title={
              problemReason
                ? `Con problemas: ${problemReason}`
                : state === "expiring" || state === "critical"
                  ? `Por expirar (umbral: ≤ ${thresholds.warningDays} d / crítico ≤ ${thresholds.criticalDays} d)`
                  : meta.label
            }
          />
        </td>

        {/* 3. Dominio (absorbs horizontal space, with linked Uptime badge & inline problem diagnostic) */}
        <td className={`${paddingY} px-3 max-w-0`}>
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`truncate font-semibold text-xs transition-colors ${
                isUrgent
                  ? "text-rose-300 font-bold"
                  : "text-text-main group-hover:text-accent-green"
              }`}
              title={`${cert.domain}${cert.port && cert.port !== 443 ? `:${cert.port}` : ""}`}
            >
              {cert.domain}
            </span>

            {cert.port && cert.port !== 443 && (
              <span className="shrink-0 font-mono text-[10px] px-1.5 py-0.5 bg-bg-dark border border-border-base rounded text-sky-400">
                :{cert.port}
              </span>
            )}

            <a
              href={`https://${cert.domain}${cert.port && cert.port !== 443 ? `:${cert.port}` : ""}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 text-text-dim hover:text-accent-green transition-opacity"
              title="Abrir sitio HTTPS en nueva pestaña"
              aria-label={`Abrir ${cert.domain} en nueva pestaña`}
            >
              <ExternalLink size={11} />
            </a>

            {linked.length > 0 ? (
              <Link
                to={`/monitoring?target=${linked[0].id}`}
                onClick={(e) => e.stopPropagation()}
                title={`Vinculado al target ${linked.map((t) => t.name).join(", ")}`}
                className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-dark border border-border-base text-text-muted hover:text-accent-green hover:border-accent-green/40 transition-colors max-w-[160px]"
              >
                <Link2 size={10} className="shrink-0 text-accent-green/80" />
                <span className="truncate">{linked[0].name}</span>
              </Link>
            ) : suggested.length > 0 && onLinkTarget ? (
              <button
                type="button"
                disabled={linkingCertId === cert.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onLinkTarget(cert, suggested[0]);
                }}
                title={`Target coincidente encontrado en Uptime: ${suggested[0].name}. Haz clic para vincularlo.`}
                className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-transparent border border-dashed border-border-base text-text-dim hover:text-accent-green hover:border-accent-green/50 transition-colors max-w-[175px] cursor-pointer disabled:opacity-50 !min-h-0 !min-w-0"
              >
                <Link2 size={10} className="shrink-0" />
                <span className="truncate">
                  {linkingCertId === cert.id
                    ? "Vinculando..."
                    : `Vincular: ${suggested[0].name}`}
                </span>
              </button>
            ) : null}

            {problemReason && (
              <span
                title={cert.error_message || problemReason}
                className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-rose-500/10 border border-rose-500/25 text-rose-300"
              >
                <AlertTriangle size={10} className="text-rose-400 shrink-0" />
                <span>{problemReason}</span>
              </span>
            )}
          </div>
        </td>

        {/* 4. Emisor (CA) */}
        <td className={`${paddingY} px-3 whitespace-nowrap`}>
          <span
            className="block truncate text-xs text-text-muted"
            title={cert.issuer || "Sin emisor"}
          >
            {issuerClean}
          </span>
        </td>

        {/* 5. Seguridad (Grado ordenable + TLS) */}
        <td className={`${paddingY} px-3 whitespace-nowrap`}>
          <div className="flex items-center gap-1.5 min-w-0 text-xs">
            {cert.security_grade && gradeMeasured ? (
              <span
                className={`shrink-0 font-mono text-[10px] font-bold px-1.5 py-0.2 rounded border ${healthPalette[gradeTone].badge}`}
                title={getSSLGradeTooltip(cert)}
              >
                {cert.security_grade}
              </span>
            ) : (
              <span className="font-mono text-[11px] text-text-dim">—</span>
            )}
            {tlsClean && (
              <span
                className="shrink-0 font-mono text-[11px] text-text-dim"
                title={`Protocolo negociado: ${tlsClean}`}
              >
                {tlsClean}
              </span>
            )}
          </div>
        </td>

        {/* 6. Vence (single consolidated column: "en 30 d · 26 dic 2026" or "venció hace 3 d") */}
        <td className={`${paddingY} px-3 whitespace-nowrap`}>
          {days !== null && days !== undefined ? (
            <div
              className="flex items-center gap-1.5 font-mono text-xs"
              title={`${
                cert.expiration_date
                  ? `Expira el ${formatSSLDate(cert.expiration_date)}`
                  : "Fecha de expiración sin registrar"
              }${
                cert.issued_at
                  ? ` · Emitido el ${formatSSLDate(cert.issued_at)}`
                  : ""
              }\n${lastCheckedTooltip}`}
            >
              <span className={expiryTextClass}>
                {days <= 0 ? formatExpiredAgo(days, true) : `en ${days} d`}
              </span>
              {cert.expiration_date && days > 0 && (
                <span className="text-[11px] text-text-dim">
                  · {formatSSLDate(cert.expiration_date)}
                </span>
              )}
            </div>
          ) : (
            <span
              className="font-mono text-[11px] text-text-dim"
              title={lastCheckedTooltip}
            >
              Sin datos
            </span>
          )}
        </td>

        {/* 7. SANs (clickable -> opens SANs section in drawer) */}
        <td
          className={`${paddingY} px-2.5 whitespace-nowrap`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onSelectCert(cert, "sans")}
            title={
              cert.san_domains && cert.san_domains.length > 0
                ? `Ver SANs (${cert.san_domains.length}): ${cert.san_domains.slice(0, 6).join(", ")}${cert.san_domains.length > 6 ? "…" : ""}`
                : "Ver dominios SAN"
            }
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-mono text-[11px] bg-bg-dark/80 border border-border-base/80 text-text-muted hover:text-accent-green hover:border-accent-green/40 transition-colors cursor-pointer !min-h-0 !min-w-0"
          >
            <Layers size={10} className="text-sky-400 shrink-0" />
            <span>
              {sanCount} {sanCount === 1 ? "SAN" : "SANs"}
            </span>
          </button>
        </td>

        {/* 8. Acciones (transparent bg matching row, visible on hover/focus/touch) */}
        <td
          className={`${paddingY} px-3 text-right whitespace-nowrap bg-transparent`}
          onClick={(e) => e.stopPropagation()}
        >
          <SSLCertificateRowActions
            cert={cert}
            variant="table"
            isScanning={scanningId === cert.id}
            onScan={onScan}
            onViewChain={(c) => onSelectCert(c, "chain")}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </td>
      </tr>
    );
  };

  return (
    <div
      data-testid="connectivity-table"
      className="connectivity-directory-table w-full max-w-[1400px] mx-auto bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-xl font-sans"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] table-fixed text-left text-xs text-text-main border-collapse">
          <colgroup>
            <col className="w-[38px]" />
            <col className="w-[138px]" />
            <col />
            <col className="w-[148px]" />
            <col className="w-[120px]" />
            <col className="w-[168px]" />
            <col className="w-[84px]" />
            <col className="w-[148px]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-bg-dark/95 backdrop-blur-md border-b border-border-base">
            <tr className="bg-bg-dark/90 font-semibold text-text-dim select-none">
              <th scope="col" className="py-2 px-2.5 text-center">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={allSelected}
                  aria-label="Seleccionar todos los certificados de esta página"
                  onClick={onSelectAll}
                  className="sentinel-selection grid h-6 w-6 place-items-center rounded bg-transparent p-0 cursor-pointer !min-h-0 !min-w-0"
                >
                  <span
                    className={`grid h-4 w-4 place-items-center rounded transition-colors ${
                      allSelected
                        ? "bg-accent-green text-black ring-1 ring-accent-green/40"
                        : "border border-border-base/90 bg-bg-dark/80 text-transparent"
                    }`}
                  >
                    <Check
                      size={10}
                      strokeWidth={3}
                      className={allSelected ? "opacity-100" : "opacity-0"}
                    />
                  </span>
                </button>
              </th>
              <th
                scope="col"
                aria-sort={
                  sortField === "status"
                    ? sortAsc
                      ? "ascending"
                      : "descending"
                    : "none"
                }
                className="py-2 px-2.5 whitespace-nowrap cursor-pointer hover:text-text-main"
                onClick={() => onSortChange("status")}
                title="Ordenar por estado (problemas y vencidos primero)"
              >
                <div className="inline-flex items-center gap-1 whitespace-nowrap">
                  <span>Estado</span>
                  <ArrowUpDown
                    size={11}
                    className={
                      sortField === "status"
                        ? "text-accent-green"
                        : "text-text-dim"
                    }
                  />
                </div>
              </th>
              <th
                scope="col"
                aria-sort={
                  sortField === "domain"
                    ? sortAsc
                      ? "ascending"
                      : "descending"
                    : "none"
                }
                className="py-2 px-3 whitespace-nowrap cursor-pointer hover:text-text-main"
                onClick={() => onSortChange("domain")}
                title="Ordenar por dominio"
              >
                <div className="inline-flex items-center gap-1 whitespace-nowrap">
                  <span>Dominio</span>
                  <ArrowUpDown
                    size={11}
                    className={
                      sortField === "domain"
                        ? "text-accent-green"
                        : "text-text-dim"
                    }
                  />
                </div>
              </th>
              <th scope="col" className="py-2 px-3 whitespace-nowrap">
                Emisor
              </th>
              <th
                scope="col"
                aria-sort={
                  sortField === "grade"
                    ? sortAsc
                      ? "ascending"
                      : "descending"
                    : "none"
                }
                className="py-2 px-3 whitespace-nowrap cursor-pointer hover:text-text-main"
                onClick={() => onSortChange("grade")}
                title="Ordenar por grado de seguridad TLS"
              >
                <div className="inline-flex items-center gap-1 whitespace-nowrap">
                  <span>Seguridad</span>
                  <ArrowUpDown
                    size={11}
                    className={
                      sortField === "grade"
                        ? "text-accent-green"
                        : "text-text-dim"
                    }
                  />
                </div>
              </th>
              <th
                scope="col"
                aria-sort={
                  sortField === "expiry"
                    ? sortAsc
                      ? "ascending"
                      : "descending"
                    : "none"
                }
                className="py-2 px-3 whitespace-nowrap cursor-pointer hover:text-text-main"
                onClick={() => onSortChange("expiry")}
                title="Ordenar por vencimiento más próximo"
              >
                <div className="inline-flex items-center gap-1 whitespace-nowrap">
                  <span>Vence</span>
                  <ArrowUpDown
                    size={11}
                    className={
                      sortField === "expiry"
                        ? "text-accent-green"
                        : "text-text-dim"
                    }
                  />
                </div>
              </th>
              <th scope="col" className="py-2 px-2.5 whitespace-nowrap">
                SANs
              </th>
              <th
                scope="col"
                className="py-2 px-3 text-right whitespace-nowrap bg-transparent"
              >
                Acciones
              </th>
            </tr>
          </thead>

          {groupedCertificates ? (
            groupedCertificates.map((group) => {
              const isCollapsed = Boolean(collapsedGroups[group.key]);
              const GroupIcon = group.icon;

              return (
                <tbody
                  key={group.key}
                  className="border-b border-border-base/50"
                >
                  <tr
                    onClick={() => onToggleGroup(group.key)}
                    className="bg-bg-dark/70 hover:bg-bg-dark cursor-pointer transition-colors border-y border-border-base/60 select-none"
                  >
                    <td colSpan={8} className="py-1.5 px-3">
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
                          <GroupIcon
                            size={13}
                            className="text-sky-400 shrink-0"
                          />
                          <span className="font-semibold text-text-main text-xs">
                            {group.label}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-bg-card border border-border-base text-text-muted">
                            {group.certs.length}{" "}
                            {group.certs.length === 1
                              ? "certificado"
                              : "certificados"}
                          </span>
                          {group.urgentCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400">
                              {group.urgentCount} urgente
                              {group.urgentCount === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-text-dim">
                          {isCollapsed ? "Expandir" : "Colapsar"}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {!isCollapsed && group.certs.map(renderRow)}
                </tbody>
              );
            })
          ) : (
            <tbody>{sortedCertificates.map(renderRow)}</tbody>
          )}
        </table>
      </div>
    </div>
  );
}
