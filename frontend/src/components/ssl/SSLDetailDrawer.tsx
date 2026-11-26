import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  ExternalLink,
  Globe,
  Link2,
  Lock,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useCapability } from "../../hooks/useCapability";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import type { SSLCertificate } from "../../types/ssl";
import {
  healthPalette,
  hasMeasurement,
  sslGradeTone,
} from "../../utils/healthPresentation";
import MeasurementStatus from "../common/MeasurementStatus";
import RelativeTime from "../common/connectivity/RelativeTime";
import StatusPill, { StatusShapeIcon } from "../common/connectivity/StatusPill";
import type { SSLDrawerSection } from "./SSLCertificateTableView";
import {
  SSL_STATE_META,
  formatSSLDate,
  formatShortFingerprint,
  formatTLSVersion,
  getCertRemainingPercent,
  getCertificateChainSteps,
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
  onClose,
}: SSLDetailDrawerProps) {
  const drawerRef = useDialogFocus(true, cert.id);
  const canScan = useCapability("ssl_monitor.scan");
  const canEdit = useCapability("ssl_monitor.update");
  const canDelete = useCapability("ssl_monitor.delete");

  const [copiedFp, setCopiedFp] = useState(false);
  const [sanSearch, setSanSearch] = useState("");

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
        onClose();
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

  const state = getSSLHealthState(cert, thresholds);
  const meta = SSL_STATE_META[state];
  const problemReason = state === "problem" ? getSSLProblemReason(cert) : null;
  const issuerClean = parseIssuerOrganization(cert.issuer);
  const tlsClean = formatTLSVersion(cert.tls_version);
  const days = cert.days_remaining;
  const remainingPct = getCertRemainingPercent(cert);
  const chain = getCertificateChainSteps(cert);
  const sans = cert.san_domains && cert.san_domains.length > 0 ? cert.san_domains : [cert.domain];
  const filteredSans = sans.filter(
    (s) => !sanSearch || s.toLowerCase().includes(sanSearch.toLowerCase()),
  );
  const linked = cert.linked_targets || [];

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
          ? "text-emerald-400"
          : "text-text-dim";

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
        {/* 1. Sticky Compact Header (same skeleton as Uptime & Guardianes) */}
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

          {/* Line 2: Metadata single line */}
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
                  className={`px-1.5 py-0.2 rounded border font-bold ${healthPalette[gradeTone].badge}`}
                  title={getSSLGradeTooltip(cert)}
                >
                  Grado {cert.security_grade}
                </span>
              </>
            )}
            <span>·</span>
            <span>
              {sans.length} {sans.length === 1 ? "SAN" : "SANs"}
            </span>
          </div>

          {/* Line 3: Primary CTA (Revalidar ahora) + Edit & Delete */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
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
                  <span>{isScanning ? "Revalidando..." : "Revalidar ahora"}</span>
                </button>
              )}
              {linked.length > 0 && (
                <Link
                  to={`/monitoring?target=${linked[0].id}`}
                  onClick={onClose}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-bg-card border border-border-base text-text-muted hover:text-accent-green hover:border-accent-green/40 transition-colors"
                >
                  <Link2 size={12} />
                  <span className="truncate max-w-[140px]">
                    {linked[0].name}
                  </span>
                </Link>
              )}
            </div>

            <div className="flex items-center gap-1">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(cert)}
                  title="Editar dominio o puerto"
                  aria-label={`Editar ${cert.domain}`}
                  className="h-7 w-7 grid place-items-center rounded-lg border border-border-base bg-bg-card text-text-muted hover:text-text-main hover:bg-bg-card-hover transition-colors cursor-pointer !min-h-0 !min-w-0"
                >
                  <Pencil size={13} />
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(cert)}
                  title="Eliminar certificado"
                  aria-label={`Eliminar ${cert.domain}`}
                  className="h-7 w-7 grid place-items-center rounded-lg border border-border-base bg-bg-card text-text-muted hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          <MeasurementStatus snapshot={cert.scan_availability} />

          {/* Problem / Expired Alert Banner */}
          {(state === "problem" || state === "expired") && (
            <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 p-3.5 space-y-1 text-rose-200">
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

          {/* Vigencia & Remaining-Time Progress Bar */}
          <section className="rounded-xl border border-border-base bg-bg-dark/60 p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono">
              <span className={`text-sm font-bold ${expiryTextClass}`}>
                {days !== null && days !== undefined
                  ? days <= 0
                    ? `Vencido hace ${Math.abs(days)} d`
                    : `Vence en ${days} ${days === 1 ? "día" : "días"}`
                  : "Vigencia sin medir"}
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

            <div className="flex items-center justify-between text-[11px] text-text-dim font-mono">
              <span>
                {remainingPct !== null
                  ? `${remainingPct} % de vigencia restante`
                  : "Pendiente de medición"}
              </span>
              <span>
                Umbral: ≤ {thresholds.warningDays} d / crítico ≤{" "}
                {thresholds.criticalDays} d
              </span>
            </div>
          </section>

          {/* Cadena de Confianza */}
          <section className="rounded-xl border border-border-base bg-bg-dark/50 p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-text-main inline-flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-accent-green shrink-0" />
                <span>Cadena de confianza</span>
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-mono ${
                  chain.complete ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {chain.complete ? (
                  <>
                    <CheckCircle2 size={12} />
                    <span>completa</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={12} />
                    <span>{state === "pending" ? "sin verificar" : "con fallo"}</span>
                  </>
                )}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-text-main pt-0.5">
              {chain.steps.map((step, idx) => (
                <span key={`${step}-${idx}`} className="inline-flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-md border ${
                      idx === 0
                        ? "bg-bg-card border-border-base text-text-main font-semibold"
                        : "bg-bg-card/60 border-border-base/70 text-text-muted"
                    }`}
                  >
                    {step}
                  </span>
                  {idx < chain.steps.length - 1 && (
                    <ArrowRight size={11} className="text-text-dim shrink-0" />
                  )}
                </span>
              ))}
            </div>
          </section>

          {/* Huella SHA-256 & Criptografía */}
          <section className="rounded-xl border border-border-base bg-bg-dark/50 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[11px] text-text-dim block">
                  Huella SHA-256
                </span>
                <span
                  className="font-mono text-xs text-text-main"
                  title={cert.fingerprint || "Sin huella registrada"}
                >
                  {formatShortFingerprint(cert.fingerprint)}
                </span>
              </div>
              {cert.fingerprint && (
                <button
                  type="button"
                  onClick={() => void handleCopyFp()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-bg-card border border-border-base text-text-main hover:border-accent-green hover:text-accent-green transition-colors text-[11px] font-medium cursor-pointer shrink-0 !min-h-0"
                >
                  {copiedFp ? (
                    <>
                      <Check size={12} className="text-accent-green" />
                      <span>Copiada</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-base/60 text-[11px] font-mono">
              <div>
                <span className="text-text-dim font-sans block">Firma / Algoritmo</span>
                <span className="text-text-main font-semibold">
                  {cert.algorithm || "—"}
                </span>
              </div>
              <div>
                <span className="text-text-dim font-sans block">Protocolo y puerto</span>
                <span className="text-text-main font-semibold">
                  {tlsClean || "—"} · :{cert.port || 443}
                </span>
              </div>
            </div>
          </section>

          {/* SANs Section (expanded automatically if opened from SANs button) */}
          <details
            className="group rounded-xl border border-border-base bg-bg-dark/40 overflow-hidden"
            open={initialSection === "sans" || sans.length <= 4}
          >
            <summary className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer select-none font-semibold text-text-main hover:bg-white/[0.02]">
              <span className="inline-flex items-center gap-2">
                <ChevronRight
                  size={14}
                  className="text-text-dim group-open:rotate-90 transition-transform"
                />
                <Globe size={13} className="text-sky-400" />
                <span>SANs ({sans.length})</span>
              </span>
              <span className="text-[11px] font-mono font-normal text-text-dim">
                Dominios cubiertos
              </span>
            </summary>
            <div className="px-3.5 pb-3.5 pt-1 border-t border-border-base/50 space-y-2.5">
              {sans.length > 5 && (
                <div className="relative">
                  <Search
                    size={12}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim"
                  />
                  <input
                    type="text"
                    value={sanSearch}
                    onChange={(e) => setSanSearch(e.target.value)}
                    placeholder="Filtrar dominios SAN..."
                    className="w-full h-7 rounded-lg bg-bg-dark border border-border-base pl-7 pr-2.5 text-xs text-text-main placeholder:text-text-dim focus:border-accent-green focus:outline-none"
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto">
                {filteredSans.map((san, idx) => {
                  const isWildcard = san.startsWith("*.");
                  return (
                    <span
                      key={`${san}-${idx}`}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[11px] border ${
                        isWildcard
                          ? "bg-accent-purple/10 border-accent-purple/30 text-accent-purple"
                          : "bg-bg-card border-border-base/70 text-text-main"
                      }`}
                    >
                      <Lock
                        size={10}
                        className={
                          isWildcard ? "text-accent-purple" : "text-emerald-400"
                        }
                      />
                      <span>{san}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </details>

          {/* Collapsible: Alertas de vencimiento */}
          <details className="group rounded-xl border border-border-base bg-bg-dark/40 overflow-hidden">
            <summary className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer select-none font-semibold text-text-main hover:bg-white/[0.02]">
              <span className="inline-flex items-center gap-2">
                <ChevronRight
                  size={14}
                  className="text-text-dim group-open:rotate-90 transition-transform"
                />
                <Bell size={13} className="text-amber-400" />
                <span>
                  Alertas ({thresholds.warningDays} / {thresholds.criticalDays}{" "}
                  días)
                </span>
              </span>
              <span className="text-[11px] font-normal text-text-dim">
                Reglas de aviso
              </span>
            </summary>
            <div className="px-3.5 pb-3.5 pt-2 border-t border-border-base/50 space-y-2 text-text-muted">
              <p className="text-[11px] leading-relaxed">
                Los umbrales visuales actuales marcan aviso en ámbar a los{" "}
                <strong className="text-text-main">
                  {thresholds.warningDays} días
                </strong>{" "}
                y crítico en rojo a los{" "}
                <strong className="text-text-main">
                  {thresholds.criticalDays} días
                </strong>
                . Puedes configurar notificaciones automáticas por correo, Slack
                o webhook desde el módulo de Alertas.
              </p>
              <Link
                to="/alerts"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-green hover:underline"
              >
                <span>Configurar reglas de alerta SSL</span>
                <ExternalLink size={12} />
              </Link>
            </div>
          </details>

          {/* Collapsible: Detalles técnicos completos (DN) */}
          <details className="group rounded-xl border border-border-base bg-bg-dark/40 overflow-hidden">
            <summary className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer select-none font-semibold text-text-main hover:bg-white/[0.02]">
              <span className="inline-flex items-center gap-2">
                <ChevronRight
                  size={14}
                  className="text-text-dim group-open:rotate-90 transition-transform"
                />
                <span>Emisor y sujeto completos (DN)</span>
              </span>
            </summary>
            <div className="px-3.5 pb-3.5 pt-2 border-t border-border-base/50 space-y-2 font-mono text-[11px]">
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
              <p className="font-sans text-[11px] text-text-dim pt-1">
                {getSSLGradeTooltip(cert)}
              </p>
            </div>
          </details>

          {/* Footer metadata: Last check + Linked Uptime targets */}
          <footer className="pt-2 border-t border-border-base/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-dim">
            <span>
              Último chequeo:{" "}
              <RelativeTime
                value={cert.last_scanned_at}
                emptyLabel="Nunca"
                className="text-text-muted"
              />
            </span>
            {linked.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <span>Vinculado a:</span>
                {linked.map((t, idx) => (
                  <span key={t.id} className="inline-flex items-center gap-1">
                    <Link
                      to={`/monitoring?target=${t.id}`}
                      onClick={onClose}
                      className="text-accent-green hover:underline font-medium"
                    >
                      {t.name}
                    </Link>
                    {idx < linked.length - 1 && <span>,</span>}
                  </span>
                ))}
              </span>
            )}
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  );
}
