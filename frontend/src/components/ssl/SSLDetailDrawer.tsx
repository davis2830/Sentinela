import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  ExternalLink,
  History,
  Info,
  Link2,
  Lock,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useCapability } from "../../hooks/useCapability";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import type { SSLCertificate, SSLLinkedTarget } from "../../types/ssl";
import {
  healthPalette,
  hasMeasurement,
  sslGradeTone,
} from "../../utils/healthPresentation";
import RelativeTime from "../common/connectivity/RelativeTime";
import StatusPill, { StatusShapeIcon } from "../common/connectivity/StatusPill";
import type { SSLDrawerSection } from "./SSLCertificateTableView";
import {
  SSL_STATE_META,
  formatExpiredAgo,
  formatSSLDate,
  formatShortFingerprint,
  formatTLSVersion,
  getCertRemainingPercent,
  getCertificateChainSteps,
  getExpectedRenewalInfo,
  getSSLGradeTooltip,
  getSSLHealthState,
  getSSLProblemReason,
  parseIssuerOrganization,
  type SSLThresholds,
} from "./useSSLCertificates";

interface SSLDetailDrawerProps {
  cert: SSLCertificate;
  certificates: SSLCertificate[];
  initialSection?: SSLDrawerSection;
  thresholds: SSLThresholds;
  isScanning: boolean;
  onSelectCert: (cert: SSLCertificate) => void;
  onScan: (cert: SSLCertificate) => void;
  onEdit: (cert: SSLCertificate) => void;
  onDelete: (cert: SSLCertificate) => void;
  onLinkTarget?: (cert: SSLCertificate, target: SSLLinkedTarget) => void;
  isLinking?: boolean;
  onClose: () => void;
}

export default function SSLDetailDrawer({
  cert,
  certificates,
  initialSection = "overview",
  thresholds,
  isScanning,
  onSelectCert,
  onScan,
  onEdit,
  onDelete,
  onLinkTarget,
  isLinking = false,
  onClose,
}: SSLDetailDrawerProps) {
  const drawerRef = useDialogFocus(true, cert.id);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const canScan = useCapability("ssl_monitor.scan");
  const canEdit = useCapability("ssl_monitor.update");
  const canDelete = useCapability("ssl_monitor.delete");

  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedFp, setCopiedFp] = useState(false);
  const [sanSearch, setSanSearch] = useState("");
  const [showAllSans, setShowAllSans] = useState(initialSection === "sans");

  // Prev/Next navigation across sorted certificates
  const currentIdx = certificates.findIndex((c) => c.id === cert.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < certificates.length - 1;
  const goPrev = () => {
    if (hasPrev) onSelectCert(certificates[currentIdx - 1]);
  };
  const goNext = () => {
    if (hasNext) onSelectCert(certificates[currentIdx + 1]);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (menuOpen) setMenuOpen(false);
        else onClose();
      } else if (
        e.key === "ArrowUp" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement)?.tagName,
        )
      ) {
        e.preventDefault();
        goPrev();
      } else if (
        e.key === "ArrowDown" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement)?.tagName,
        )
      ) {
        e.preventDefault();
        goNext();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen]);

  const state = getSSLHealthState(cert, thresholds);
  const meta = SSL_STATE_META[state];
  const problemReason = state === "problem" ? getSSLProblemReason(cert) : null;
  const issuerClean = parseIssuerOrganization(cert.issuer);
  const tlsClean = formatTLSVersion(cert.tls_version);
  const days = cert.days_remaining;
  const remainingPct = getCertRemainingPercent(cert);
  const chain = getCertificateChainSteps(cert);
  const renewalInfo = getExpectedRenewalInfo(cert);
  const sans =
    cert.san_domains && cert.san_domains.length > 0
      ? cert.san_domains
      : [cert.domain];
  const filteredSans = sans.filter(
    (s) => !sanSearch || s.toLowerCase().includes(sanSearch.toLowerCase()),
  );
  const visibleSans =
    showAllSans || filteredSans.length <= 6
      ? filteredSans
      : filteredSans.slice(0, 6);

  const linked = cert.linked_targets || [];
  const suggested = cert.suggested_targets || [];

  const gradeMeasured =
    hasMeasurement(cert.last_scanned_at) && !cert.error_message && cert.is_valid;
  const gradeTone = sslGradeTone(cert.security_grade, gradeMeasured);

  const barFillClass =
    state === "expired" || state === "problem" || state === "critical"
      ? "bg-rose-500"
      : state === "expiring"
        ? "bg-amber-400"
        : "bg-emerald-500";

  const expiryTextClass =
    state === "expired" || state === "problem" || state === "critical"
      ? "text-rose-400"
      : state === "expiring"
        ? "text-amber-400"
        : state === "valid"
          ? "text-text-main"
          : "text-text-dim";

  // Real Alertas summary from backend (or explicit "Nadie será notificado")
  const alertRules = cert.alert_summary?.rules || [];
  const alertDestinations = cert.alert_summary?.destinations || [];
  const hasRealNotifications =
    alertRules.length > 0 && alertDestinations.length > 0;

  // Issuance history (fallback to current observation if backend list not yet populated)
  const historyEntries =
    cert.issuance_history && cert.issuance_history.length > 0
      ? cert.issuance_history
      : cert.fingerprint
        ? [
            {
              fingerprint: cert.fingerprint,
              issuer: cert.issuer || "",
              issued_at: cert.issued_at || null,
              expiration_date: cert.expiration_date || null,
              key_info: cert.key_info || "",
              detected_at: cert.last_successful_at || cert.last_scanned_at,
            },
          ]
        : [];

  const handleCopyFp = async () => {
    if (!cert.fingerprint) return;
    try {
      await navigator.clipboard.writeText(cert.fingerprint);
      setCopiedFp(true);
      setTimeout(() => setCopiedFp(false), 1800);
    } catch {
      // ignore
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de certificado ${cert.domain}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[540px] h-full bg-bg-card border-l border-border-base shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
      >
        {/* 1. Sticky Compact Header */}
        <header className="sticky top-0 z-20 bg-bg-dark/95 backdrop-blur-md border-b border-border-base p-4 space-y-2">
          {/* Line 1: Icon + Domain + StatusPill | Prev/Next + Open + Close */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <StatusShapeIcon
                shape={meta.shape}
                size={18}
                className={
                  meta.tone === "success"
                    ? "text-emerald-400"
                    : meta.tone === "danger"
                      ? "text-rose-400"
                      : meta.tone === "warning"
                        ? "text-amber-400"
                        : "text-slate-400"
                }
              />
              <h2
                className="text-base font-bold text-text-main truncate"
                title={cert.domain}
              >
                {cert.domain}
                {cert.port && cert.port !== 443 && (
                  <span className="ml-1 font-mono text-xs font-normal text-sky-400">
                    :{cert.port}
                  </span>
                )}
              </h2>
              <StatusPill
                size="xs"
                label={meta.label}
                tone={meta.tone}
                shape={meta.shape}
              />
            </div>

            <div className="flex items-center gap-1 shrink-0 text-text-muted">
              <button
                type="button"
                onClick={goPrev}
                disabled={!hasPrev}
                title="Certificado anterior (↑)"
                aria-label="Certificado anterior"
                className="p-1.5 rounded-lg hover:bg-bg-card-hover hover:text-text-main transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer !min-h-0 !min-w-0"
              >
                <ChevronUp size={16} />
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!hasNext}
                title="Certificado siguiente (↓)"
                aria-label="Certificado siguiente"
                className="p-1.5 rounded-lg hover:bg-bg-card-hover hover:text-text-main transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer !min-h-0 !min-w-0"
              >
                <ChevronDown size={16} />
              </button>
              <a
                href={`https://${cert.domain}${cert.port && cert.port !== 443 ? `:${cert.port}` : ""}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir sitio HTTPS en nueva pestaña"
                aria-label={`Abrir ${cert.domain}`}
                className="p-1.5 rounded-lg hover:bg-bg-card-hover hover:text-text-main transition-colors"
              >
                <ExternalLink size={15} />
              </a>
              <button
                type="button"
                onClick={onClose}
                title="Cerrar (Esc)"
                aria-label="Cerrar panel"
                className="p-1.5 rounded-lg hover:bg-bg-card-hover hover:text-text-main transition-colors cursor-pointer !min-h-0 !min-w-0"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Line 2: Metadata single line with Grade ⓘ tooltip */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-text-muted">
            <span>{issuerClean}</span>
            {tlsClean && (
              <>
                <span>·</span>
                <span>{tlsClean}</span>
              </>
            )}
            {cert.security_grade && gradeMeasured && (
              <>
                <span>·</span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-bold leading-none cursor-help ${healthPalette[gradeTone].badge}`}
                  title={getSSLGradeTooltip(cert)}
                >
                  <span>{cert.security_grade}</span>
                  <Info size={10} className="opacity-75 shrink-0" />
                </span>
              </>
            )}
            <span>·</span>
            <span>
              {sans.length} {sans.length === 1 ? "SAN" : "SANs"}
            </span>
          </div>

          {/* Line 3: Primary CTA (Comprobar ahora) + Linked Uptime chip (↗) | Overflow ⋯ (Edit / Delete) */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              {canScan && (
                <button
                  type="button"
                  disabled={isScanning}
                  onClick={() => onScan(cert)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent-green hover:bg-accent-green/90 text-black transition-colors disabled:opacity-60 cursor-pointer !min-h-0"
                >
                  <RefreshCw
                    size={13}
                    className={isScanning ? "animate-spin" : ""}
                  />
                  <span>{isScanning ? "Comprobando..." : "Comprobar ahora"}</span>
                </button>
              )}

              {linked.length > 0 &&
                (() => {
                  const primary = linked[0];
                  const isPausedTarget = primary.enabled === false;
                  return (
                    <Link
                      to={`/monitoring?target=${primary.id}`}
                      onClick={onClose}
                      title={
                        isPausedTarget
                          ? `Abrir target ${primary.name} en Uptime (pausado)`
                          : `Abrir target ${primary.name} en Uptime`
                      }
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        isPausedTarget
                          ? "bg-amber-500/10 border-amber-500/35 text-amber-300 hover:border-amber-400/60"
                          : "bg-bg-card border-border-base text-text-muted hover:text-accent-green hover:border-accent-green/40"
                      }`}
                    >
                      <ArrowUpRight size={12} className="shrink-0" />
                      <span className="truncate max-w-[160px]">
                        {primary.name}
                        {isPausedTarget ? " (pausado)" : ""}
                      </span>
                    </Link>
                  );
                })()}

              {suggested.length > 0 && onLinkTarget && (
                <button
                  type="button"
                  disabled={isLinking}
                  onClick={() => onLinkTarget(cert, suggested[0])}
                  title={`Vincular con el target activo ${suggested[0].name} en Uptime`}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-bg-card border border-dashed border-border-base text-text-muted hover:text-accent-green hover:border-accent-green/50 transition-colors cursor-pointer disabled:opacity-50 !min-h-0"
                >
                  <Link2 size={12} />
                  <span className="truncate max-w-[160px]">
                    {isLinking
                      ? "Vinculando..."
                      : `Vincular: ${suggested[0].name}`}
                  </span>
                </button>
              )}
            </div>

            {/* Secondary actions moved cleanly into ⋯ menu */}
            {(canEdit || canDelete) && (
              <div ref={menuRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Más acciones del certificado"
                  title="Más acciones"
                  className="h-7 w-7 grid place-items-center rounded-lg border border-border-base bg-bg-card text-text-muted hover:text-text-main hover:bg-bg-card-hover transition-colors cursor-pointer !min-h-0 !min-w-0"
                >
                  <MoreHorizontal size={14} />
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-8 z-30 w-48 rounded-xl border border-border-base bg-bg-dark/98 backdrop-blur-md p-1 shadow-2xl text-xs"
                  >
                    {canEdit && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onEdit(cert);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text-main hover:bg-bg-card-hover cursor-pointer !min-h-0"
                      >
                        <Pencil size={13} className="text-text-muted shrink-0" />
                        <span>Editar dominio</span>
                      </button>
                    )}
                    {canDelete && (
                      <>
                        {canEdit && (
                          <div className="my-1 border-t border-border-base/70" />
                        )}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuOpen(false);
                            onDelete(cert);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 cursor-pointer !min-h-0"
                        >
                          <Trash2 size={13} className="shrink-0" />
                          <span>Eliminar certificado</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Scrollable Body (fits on 1 screen by default with collapsed secondary accordions) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          {/* Problem / Expired Banner */}
          {(state === "problem" || state === "expired") && (
            <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 p-3 space-y-1 text-rose-200">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={14} className="text-rose-400 shrink-0" />
                <span>
                  {state === "expired"
                    ? "Certificado vencido"
                    : problemReason || "Problema detectado en la validación TLS"}
                </span>
              </div>
              {cert.error_message && (
                <p className="text-[11px] font-mono opacity-90 pl-5">
                  {cert.error_message}
                </p>
              )}
            </div>
          )}

          {/* 2. Vigencia & Remaining-Time Progress Bar + Expected Auto-Renewal */}
          <section className="rounded-xl border border-border-base bg-bg-dark/60 p-3.5 space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono">
              <span className={`text-sm font-bold ${expiryTextClass}`}>
                {days !== null && days !== undefined
                  ? days <= 0
                    ? formatExpiredAgo(days)
                    : `Vence en ${days} ${days === 1 ? "día" : "días"}`
                  : "Sin datos de vigencia"}
              </span>
              <span className="text-[11px] text-text-muted">
                {cert.expiration_date ? formatSSLDate(cert.expiration_date) : "—"}
                {cert.issued_at
                  ? ` · emitido ${formatSSLDate(cert.issued_at)}`
                  : ""}
              </span>
            </div>

            <div
              className="w-full h-2 rounded-full bg-bg-card border border-border-base/80 overflow-hidden"
              title={
                remainingPct !== null
                  ? `${remainingPct} % de tiempo restante`
                  : "Sin datos"
              }
            >
              {remainingPct !== null && state !== "pending" && (
                <div
                  className={`h-full rounded-full transition-all ${barFillClass}`}
                  style={{ width: `${remainingPct}%` }}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-dim font-mono">
              <span>
                {remainingPct !== null
                  ? `${remainingPct} % restante`
                  : "Pendiente de medición"}
              </span>
              {renewalInfo && (
                <span
                  className="text-text-muted cursor-help"
                  title={renewalInfo.tooltip}
                >
                  {renewalInfo.label}
                </span>
              )}
            </div>
          </section>

          {/* 3. Unified Technical Spec Card: Cadena · Huella · Clave · SANs (inline, zero accordion bloat) */}
          <section
            className={`rounded-xl border bg-bg-dark/50 divide-y divide-border-base/60 ${
              initialSection === "chain"
                ? "border-accent-green/60 ring-1 ring-accent-green/30"
                : "border-border-base"
            }`}
          >
            {/* Row A: Cadena de confianza with per-node tooltips */}
            <div className="p-3 flex items-start gap-3">
              <div className="w-[72px] shrink-0 pt-0.5 flex items-center gap-1 text-[11px] text-text-dim font-medium">
                <span>Cadena</span>
                {chain.complete ? (
                  <CheckCircle2
                    size={12}
                    className="text-emerald-400 shrink-0"
                    aria-label="Cadena completa"
                  />
                ) : (
                  <AlertTriangle
                    size={12}
                    className="text-rose-400 shrink-0"
                    aria-label="Cadena con fallo"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1 font-mono text-[11px]">
                {chain.steps.map((step, idx) => (
                  <span
                    key={`${step.label}-${idx}`}
                    className="inline-flex items-center gap-1"
                  >
                    <span
                      title={step.tooltip}
                      className={`px-2 py-0.5 rounded-full border cursor-help max-w-[160px] truncate ${
                        idx === 0
                          ? "bg-bg-card border-border-base text-text-main font-semibold"
                          : "bg-bg-card/60 border-border-base/70 text-text-muted"
                      }`}
                    >
                      {step.label}
                    </span>
                    {idx < chain.steps.length - 1 && (
                      <ArrowRight
                        size={10}
                        className="text-text-dim shrink-0"
                      />
                    )}
                  </span>
                ))}
              </div>
            </div>

            {/* Row B: Huella SHA-256 (full value in tooltip + Copy) */}
            <div className="p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-[72px] shrink-0 text-[11px] text-text-dim font-medium">
                  Huella
                </span>
                <span
                  className="font-mono text-xs text-text-main truncate cursor-help"
                  title={
                    cert.fingerprint
                      ? `SHA-256: ${cert.fingerprint}`
                      : "Sin huella registrada"
                  }
                >
                  {formatShortFingerprint(cert.fingerprint)}
                </span>
              </div>
              {cert.fingerprint && (
                <button
                  type="button"
                  onClick={() => void handleCopyFp()}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-card border border-border-base text-text-main hover:border-accent-green hover:text-accent-green transition-colors text-[11px] font-medium cursor-pointer shrink-0 !min-h-0"
                >
                  {copiedFp ? (
                    <>
                      <Check size={11} className="text-accent-green" />
                      <span>Copiada</span>
                    </>
                  ) : (
                    <>
                      <Copy size={11} />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Row C: Clave + Firma + Puerto */}
            <div className="p-3 flex items-center gap-3">
              <span className="w-[72px] shrink-0 text-[11px] text-text-dim font-medium">
                Clave
              </span>
              <span className="font-mono text-xs text-text-main truncate">
                {cert.key_info ? `${cert.key_info} · ` : ""}
                {cert.algorithm || "SHA-256"} · :{cert.port || 443}
              </span>
            </div>

            {/* Row D: SANs inline (no accordion needed!) */}
            <div className="p-3 flex items-start gap-3">
              <span className="w-[72px] shrink-0 pt-0.5 text-[11px] text-text-dim font-medium">
                SANs ({sans.length})
              </span>
              <div className="flex-1 min-w-0 space-y-2">
                {sans.length > 6 && showAllSans && (
                  <div className="relative">
                    <Search
                      size={12}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim"
                    />
                    <input
                      type="text"
                      value={sanSearch}
                      onChange={(e) => setSanSearch(e.target.value)}
                      placeholder="Filtrar SANs..."
                      className="w-full h-7 rounded-lg bg-bg-dark border border-border-base pl-7 pr-2.5 text-xs text-text-main placeholder:text-text-dim focus:border-accent-green focus:outline-none"
                    />
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {visibleSans.map((san, idx) => {
                    const isWildcard = san.startsWith("*.");
                    return (
                      <span
                        key={`${san}-${idx}`}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[11px] border ${
                          isWildcard
                            ? "bg-accent-purple/10 border-accent-purple/30 text-accent-purple"
                            : "bg-bg-card border-border-base/70 text-text-main"
                        }`}
                      >
                        <Lock
                          size={9}
                          className={
                            isWildcard
                              ? "text-accent-purple"
                              : "text-emerald-400"
                          }
                        />
                        <span>{san}</span>
                      </span>
                    );
                  })}
                  {sans.length > 6 && !showAllSans && (
                    <button
                      type="button"
                      onClick={() => setShowAllSans(true)}
                      className="px-2 py-0.5 rounded-full font-mono text-[11px] border border-border-base bg-bg-card text-accent-green hover:border-accent-green/50 cursor-pointer !min-h-0"
                    >
                      +{sans.length - 6} más
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 4. Collapsed Secondary Accordions (Alertas, Historial de emisiones, DN) */}
          <div className="space-y-2">
            {/* Alertas: real state + destinations or "Nadie será notificado" */}
            <details className="group rounded-xl border border-border-base bg-bg-dark/40 overflow-hidden">
              <summary className="flex items-center justify-between gap-2 px-3.5 py-2.5 cursor-pointer select-none hover:bg-white/[0.02]">
                <span className="inline-flex items-center gap-2 min-w-0 font-semibold text-text-main">
                  <ChevronRight
                    size={14}
                    className="text-text-dim group-open:rotate-90 transition-transform shrink-0"
                  />
                  <Bell size={13} className="text-amber-400 shrink-0" />
                  <span className="shrink-0">Alertas</span>
                  <span className="font-mono font-normal text-[11px] text-text-dim truncate">
                    · aviso {thresholds.warningDays} d · crítico{" "}
                    {thresholds.criticalDays} d
                  </span>
                </span>
                <span
                  className={`font-mono text-[11px] shrink-0 ${
                    hasRealNotifications ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {hasRealNotifications
                    ? `${alertDestinations.length} ${
                        alertDestinations.length === 1 ? "destino" : "destinos"
                      }`
                    : "Nadie será notificado"}
                </span>
              </summary>

              <div className="px-3.5 pb-3 pt-2 border-t border-border-base/50 space-y-2.5 text-[11px]">
                {hasRealNotifications ? (
                  <>
                    <div className="flex flex-wrap items-center gap-1.5 text-text-muted">
                      <span>Destinos activos:</span>
                      {alertDestinations.map((ch) => (
                        <span
                          key={ch.id}
                          className="px-2 py-0.5 rounded-full bg-bg-card border border-border-base font-mono text-text-main"
                        >
                          {ch.name}
                        </span>
                      ))}
                    </div>
                    <ul className="space-y-1 font-mono text-text-muted">
                      {alertRules.map((rule) => (
                        <li
                          key={rule.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="truncate text-text-main">
                            {rule.name}
                          </span>
                          <span className="text-text-dim shrink-0">
                            {rule.condition === "ssl_expiring"
                              ? `≤ ${Math.round(rule.threshold)} d`
                              : rule.condition}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-amber-300/90">
                    {alertRules.length === 0 && alertDestinations.length === 0
                      ? "Nadie será notificado: aún no hay reglas SSL ni canales de notificación activos."
                      : alertRules.length === 0
                        ? "Nadie será notificado: no hay reglas de alerta SSL activas."
                        : "Nadie será notificado: no hay canales de notificación habilitados."}
                  </p>
                )}

                <div className="flex items-center gap-3 pt-0.5">
                  <Link
                    to="/alerts"
                    onClick={onClose}
                    className="inline-flex items-center gap-1 font-semibold text-accent-green hover:underline"
                  >
                    <span>Configurar reglas</span>
                    <ArrowRight size={11} />
                  </Link>
                  {alertDestinations.length === 0 && (
                    <Link
                      to="/notifications"
                      onClick={onClose}
                      className="inline-flex items-center gap-1 font-semibold text-text-muted hover:text-text-main hover:underline"
                    >
                      <span>Configurar canales</span>
                      <ArrowRight size={11} />
                    </Link>
                  )}
                </div>
              </div>
            </details>

            {/* Historial de emisiones / renovaciones */}
            <details className="group rounded-xl border border-border-base bg-bg-dark/40 overflow-hidden">
              <summary className="flex items-center justify-between gap-2 px-3.5 py-2.5 cursor-pointer select-none font-semibold text-text-main hover:bg-white/[0.02]">
                <span className="inline-flex items-center gap-2">
                  <ChevronRight
                    size={14}
                    className="text-text-dim group-open:rotate-90 transition-transform"
                  />
                  <History size={13} className="text-sky-400" />
                  <span>Historial de emisiones ({historyEntries.length})</span>
                </span>
                <span className="text-[11px] font-mono font-normal text-text-dim">
                  {historyEntries.length > 1 ? "Renovaciones detectadas" : "Actual"}
                </span>
              </summary>
              <div className="px-3.5 pb-3 pt-2 border-t border-border-base/50">
                {historyEntries.length > 0 ? (
                  <ul className="space-y-2">
                    {historyEntries.map((entry, idx) => {
                      const prev = historyEntries[idx + 1];
                      const entryOrg = parseIssuerOrganization(entry.issuer);
                      const prevOrg = prev
                        ? parseIssuerOrganization(prev.issuer)
                        : null;
                      const issuerChanged = Boolean(
                        prevOrg && entryOrg !== prevOrg,
                      );
                      const fpChanged = Boolean(
                        prev && entry.fingerprint !== prev.fingerprint,
                      );

                      return (
                        <li
                          key={`${entry.fingerprint}-${idx}`}
                          className="rounded-lg border border-border-base/60 bg-bg-card/60 p-2.5 space-y-1 font-mono text-[11px]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-text-main font-semibold">
                              {entry.issued_at
                                ? `Emitido ${formatSSLDate(entry.issued_at)}`
                                : entry.detected_at
                                  ? `Detectado ${formatSSLDate(entry.detected_at)}`
                                  : "Emisión registrada"}
                            </span>
                            <div className="flex items-center gap-1">
                              {idx === 0 && (
                                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px]">
                                  actual
                                </span>
                              )}
                              {issuerChanged && (
                                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[10px]">
                                  cambió CA
                                </span>
                              )}
                              {fpChanged && !issuerChanged && (
                                <span className="px-1.5 py-0.2 rounded-full bg-sky-500/15 border border-sky-500/35 text-sky-300 text-[10px]">
                                  renovado
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-text-dim">
                            <span>{entryOrg}</span>
                            {entry.key_info && (
                              <>
                                <span>·</span>
                                <span>{entry.key_info}</span>
                              </>
                            )}
                            <span>·</span>
                            <span title={entry.fingerprint}>
                              {formatShortFingerprint(entry.fingerprint)}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-[11px] text-text-dim">
                    Aún no hay emisiones registradas. Se guardará cada cambio de
                    huella o autoridad emisora automáticamente.
                  </p>
                )}
              </div>
            </details>

            {/* Emisor y sujeto (DN) — collapsed by default, purely technical */}
            <details className="group rounded-xl border border-border-base bg-bg-dark/40 overflow-hidden">
              <summary className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer select-none font-semibold text-text-main hover:bg-white/[0.02]">
                <span className="inline-flex items-center gap-2">
                  <ChevronRight
                    size={14}
                    className="text-text-dim group-open:rotate-90 transition-transform"
                  />
                  <span>Emisor y sujeto (DN)</span>
                </span>
              </summary>
              <div className="px-3.5 pb-3 pt-2 border-t border-border-base/50 space-y-2 font-mono text-[11px]">
                <div>
                  <span className="text-text-dim font-sans block mb-0.5">
                    Emisor (Issuer DN):
                  </span>
                  <p className="text-text-main break-all bg-bg-card p-2 rounded-lg border border-border-base/60">
                    {cert.issuer || "Desconocido"}
                  </p>
                </div>
                <div>
                  <span className="text-text-dim font-sans block mb-0.5">
                    Sujeto (Subject DN):
                  </span>
                  <p className="text-text-main break-all bg-bg-card p-2 rounded-lg border border-border-base/60">
                    {cert.subject || "Sin medición"}
                  </p>
                </div>
              </div>
            </details>
          </div>

          {/* 5. Single-line footer replacing the MeasurementStatus card */}
          <footer className="pt-2 border-t border-border-base/60 flex items-center justify-between gap-2 text-[11px] font-mono text-text-dim">
            <span>
              Último chequeo{" "}
              <RelativeTime
                value={cert.last_scanned_at}
                emptyLabel="sin registro"
                className="text-text-muted"
              />{" "}
              · origen cloud
            </span>
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  );
}
