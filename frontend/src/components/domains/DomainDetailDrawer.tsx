import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Calendar,
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
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Shield,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { useCapability } from "../../hooks/useCapability";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import type {
  DomainChangeHistoryItem,
  DomainInfo,
  DomainLinkedTarget,
} from "../../types/domain";
import RelativeTime from "../common/connectivity/RelativeTime";
import StatusPill, { StatusShapeIcon } from "../common/connectivity/StatusPill";
import {
  DOMAIN_STATE_META,
  formatChangeFieldLabel,
  formatDataSourceLabel,
  formatDomainDate,
  formatDomainExpiredAgo,
  formatEPPStatusHuman,
  getDomainHealthState,
  getDomainRemainingPercent,
  getEffectiveDaysRemaining,
  getEffectiveExpirationIso,
  getRegistrarPortalInfo,
  parseDomainNameServers,
  parseDomainStatuses,
  type DomainThresholds,
} from "./useDomains";

interface DomainDetailDrawerProps {
  domain: DomainInfo;
  domains: DomainInfo[];
  thresholds: DomainThresholds;
  isScanning: boolean;
  isAcknowledging?: boolean;
  isSavingManualDate?: boolean;
  isSavingAutoRenew?: boolean;
  isLinking?: boolean;
  onSelectDomain: (domain: DomainInfo) => void;
  onScan: (domain: DomainInfo) => void;
  onAcknowledgeChanges: (domain: DomainInfo) => void;
  onSaveManualExpiration: (domain: DomainInfo, dateStr: string | null) => void;
  onSetAutoRenew?: (domain: DomainInfo, autoRenew: boolean | null) => void;
  onEdit: (domain: DomainInfo) => void;
  onDelete: (domain: DomainInfo) => void;
  onLinkTarget?: (domain: DomainInfo, target: DomainLinkedTarget) => void;
  onClose: () => void;
}

export default function DomainDetailDrawer({
  domain,
  domains,
  thresholds,
  isScanning,
  isAcknowledging = false,
  isSavingManualDate = false,
  isSavingAutoRenew = false,
  isLinking = false,
  onSelectDomain,
  onScan,
  onAcknowledgeChanges,
  onSaveManualExpiration,
  onSetAutoRenew,
  onEdit,
  onDelete,
  onLinkTarget,
  onClose,
}: DomainDetailDrawerProps) {
  const drawerRef = useDialogFocus(true, domain.id);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const canScan = useCapability("domain.scan");
  const canEdit = useCapability("domain.update");
  const canDelete = useCapability("domain.delete");

  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedNs, setCopiedNs] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [eppOpen, setEppOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(
    Boolean(domain.has_unacknowledged_changes),
  );
  const [manualDateInput, setManualDateInput] = useState(
    domain.manual_expiration_date || "",
  );

  useEffect(() => {
    setMenuOpen(false);
    setCopiedNs(false);
    setAlertsOpen(false);
    setEppOpen(false);
    setHistoryOpen(Boolean(domain.has_unacknowledged_changes));
    setManualDateInput(domain.manual_expiration_date || "");
  }, [domain.id, domain.manual_expiration_date, domain.has_unacknowledged_changes]);

  const currentIdx = domains.findIndex((d) => d.id === domain.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < domains.length - 1;
  const goPrev = () => {
    if (hasPrev) onSelectDomain(domains[currentIdx - 1]);
  };
  const goNext = () => {
    if (hasNext) onSelectDomain(domains[currentIdx + 1]);
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

  const state = getDomainHealthState(domain, thresholds);
  const meta = DOMAIN_STATE_META[state];
  const days = getEffectiveDaysRemaining(domain);
  const expIso = getEffectiveExpirationIso(domain);
  const remainingPct = getDomainRemainingPercent(domain);
  const nsList = parseDomainNameServers(domain.name_servers);
  const eppStatuses = parseDomainStatuses(domain.status);
  const changes: DomainChangeHistoryItem[] = domain.recent_changes || [];
  const linkedTarget = domain.linked_targets?.[0];
  const suggestedTarget = domain.suggested_targets?.[0];
  const deps = domain.dependencies;
  const portal = getRegistrarPortalInfo(domain.registrar, domain.source_url);

  const destinations = domain.alert_summary?.destinations || [];
  const alertRules = domain.alert_summary?.rules || [];
  const alertSteps =
    thresholds.steps && thresholds.steps.length > 0
      ? thresholds.steps
      : [thresholds.warningDays, thresholds.criticalDays];
  const nsHealth = domain.ns_health;
  const nsServerMap = new Map(
    (nsHealth?.servers || []).map((s) => [s.host.toLowerCase(), s]),
  );

  const transferLockCode =
    eppStatuses.find((s) =>
      s.toLowerCase().replace(/\s+/g, "").includes("transferprohibited"),
    ) || "clientTransferProhibited";

  const dnssecLow = (domain.dnssec || "").toLowerCase();
  const dnssecSigned =
    Boolean(dnssecLow) &&
    dnssecLow.includes("signed") &&
    !dnssecLow.includes("unsigned");

  const expiringSoon =
    days !== null && days <= thresholds.warningDays && days > 0;

  const nsHealthTotal = nsHealth?.total_count ?? 0;
  const nsHealthResponding = nsHealth?.responding_count ?? 0;
  const nsHealthAllOk =
    nsHealthTotal > 0 &&
    nsHealthResponding === nsHealthTotal &&
    nsHealth?.soa_consistent !== false &&
    nsHealth?.delegation_consistent !== false;

  const nsHealthTooltip = nsHealth?.servers?.length
    ? nsHealth.servers
        .map((s) => {
          if (!s.responding) return `${s.host}: sin respuesta`;
          const parts = [
            s.latency_ms != null ? `${s.latency_ms} ms` : null,
            s.authoritative ? "autoritativo (AA)" : "no autoritativo",
            s.soa_serial != null ? `SOA ${s.soa_serial}` : null,
          ].filter(Boolean);
          return `${s.host}: ${parts.join(" · ")}`;
        })
        .join("\n")
    : undefined;

  const barColor =
    state === "expired" || state === "critical"
      ? "bg-rose-500"
      : state === "expiring"
        ? "bg-amber-400"
        : "bg-emerald-400";

  const expiryTextTone =
    state === "expired" || state === "critical"
      ? "text-rose-400"
      : state === "expiring"
        ? "text-amber-400"
        : "text-text-main";

  const handleCopyNs = async () => {
    if (nsList.length === 0) return;
    try {
      await navigator.clipboard.writeText(nsList.join("\n"));
      setCopiedNs(true);
      setTimeout(() => setCopiedNs(false), 1500);
    } catch {
      // ignore
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-40 flex justify-end">
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="false"
        aria-label={`Detalle del dominio ${domain.domain}`}
        onClick={(e) => e.stopPropagation()}
        className={`pointer-events-auto relative flex h-full w-full flex-col border-l border-border-accent/70 bg-bg-card shadow-[-12px_0_40px_rgba(0,0,0,0.55)] animate-in slide-in-from-right duration-200 transition-[max-width] ${
          expanded ? "max-w-[700px]" : "max-w-[540px]"
        }`}
      >
        {/* 1. STICKY HEADER */}
        <header className="shrink-0 border-b border-border-base/80 bg-bg-dark/90 px-5 pt-4 pb-3.5 space-y-2.5">
          {/* Row 1: Domain + StatusPill + Prev/Next/Expand/Close */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <StatusShapeIcon
                shape={meta.shape}
                size={16}
                className={`shrink-0 ${meta.textClass}`}
              />
              <h2
                className="text-base font-bold text-text-main truncate"
                title={domain.domain}
              >
                {domain.domain}
              </h2>
              <StatusPill
                tone={meta.tone}
                shape={meta.shape}
                label={meta.label}
                size="xs"
              />
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                disabled={!hasPrev}
                onClick={goPrev}
                title="Dominio anterior (↑)"
                aria-label="Dominio anterior"
                className="h-7 w-7 grid place-items-center rounded-lg text-text-dim hover:text-text-main hover:bg-white/10 disabled:opacity-30 cursor-pointer !min-h-0 !min-w-0"
              >
                <ChevronUp size={15} />
              </button>
              <button
                type="button"
                disabled={!hasNext}
                onClick={goNext}
                title="Siguiente dominio (↓)"
                aria-label="Siguiente dominio"
                className="h-7 w-7 grid place-items-center rounded-lg text-text-dim hover:text-text-main hover:bg-white/10 disabled:opacity-30 cursor-pointer !min-h-0 !min-w-0"
              >
                <ChevronDown size={15} />
              </button>
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                title={expanded ? "Ancho compacto" : "Expandir panel"}
                aria-label={expanded ? "Ancho compacto" : "Expandir panel"}
                className="hidden sm:grid h-7 w-7 place-items-center rounded-lg text-text-dim hover:text-text-main hover:bg-white/10 cursor-pointer !min-h-0 !min-w-0"
              >
                {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button
                type="button"
                onClick={onClose}
                title="Cerrar panel (Esc)"
                aria-label="Cerrar panel"
                className="h-7 w-7 grid place-items-center rounded-lg text-text-dim hover:text-text-main hover:bg-white/10 cursor-pointer !min-h-0 !min-w-0"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Row 2: Registrar ↗ · registrado 4 may 2026 (single source of truth, no duplicate table) */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs text-text-muted">
            {portal ? (
              <a
                href={portal.url}
                target="_blank"
                rel="noopener noreferrer"
                title={portal.label}
                className="inline-flex items-center gap-1 text-text-main hover:text-accent-green transition-colors rounded focus-visible:outline-2"
              >
                <span>{domain.registrar || "Registro público"}</span>
                <ExternalLink size={11} className="text-text-dim shrink-0" />
              </a>
            ) : (
              <span>{domain.registrar || "Sin registrador reportado"}</span>
            )}
            {domain.creation_date && (
              <>
                <span aria-hidden="true" className="text-text-dim">
                  ·
                </span>
                <span className="font-mono text-text-dim">
                  registrado {formatDomainDate(domain.creation_date)}
                </span>
              </>
            )}
          </div>

          {/* Row 3: Actions ([Comprobar ahora] [↗ target] [⋯]) */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              {canScan && (
                <button
                  type="button"
                  disabled={isScanning}
                  onClick={() => onScan(domain)}
                  className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-accent-green text-black font-semibold text-xs hover:bg-accent-green/90 disabled:opacity-60 transition-colors cursor-pointer !min-h-0"
                >
                  <RefreshCw
                    size={13}
                    className={isScanning ? "animate-spin" : ""}
                  />
                  <span>
                    {isScanning ? "Comprobando..." : "Comprobar ahora"}
                  </span>
                </button>
              )}

              {linkedTarget && (
                <Link
                  to={`/monitoring?target=${encodeURIComponent(linkedTarget.id)}`}
                  className={`inline-flex items-center gap-1 h-8 px-3 rounded-full border text-xs font-medium transition-colors !min-h-0 ${
                    linkedTarget.enabled
                      ? "bg-bg-card border-border-base text-text-main hover:border-accent-green/50 hover:text-accent-green"
                      : "bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
                  }`}
                >
                  <ArrowUpRight size={13} className="shrink-0" />
                  <span className="truncate max-w-[165px]">
                    {linkedTarget.name}
                    {!linkedTarget.enabled ? " (pausado)" : ""}
                  </span>
                </Link>
              )}

              {!linkedTarget && suggestedTarget && onLinkTarget && (
                <button
                  type="button"
                  disabled={isLinking}
                  onClick={() => onLinkTarget(domain, suggestedTarget)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-dashed border-border-accent bg-bg-card text-xs text-text-muted hover:text-accent-green hover:border-accent-green/50 transition-colors cursor-pointer !min-h-0"
                >
                  <Link2 size={12} className="shrink-0" />
                  <span className="truncate max-w-[175px]">
                    Vincular: {suggestedTarget.name}
                  </span>
                </button>
              )}
            </div>

            {/* Overflow menu ⋯ (solid bg-bg-dark) */}
            <div ref={menuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Más acciones del dominio"
                title="Copiar nameservers, editar o eliminar dominio"
                className={`h-8 w-8 grid place-items-center rounded-full border border-border-base bg-bg-card text-text-muted hover:text-text-main hover:bg-bg-card-hover transition-colors cursor-pointer !min-h-0 !min-w-0 ${
                  menuOpen ? "border-border-accent text-text-main" : ""
                }`}
              >
                <MoreHorizontal size={15} />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-9 z-40 w-52 rounded-xl border border-border-accent/70 bg-bg-dark p-1 shadow-2xl text-xs animate-in fade-in zoom-in-95 duration-100"
                >
                  {nsList.length > 0 && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        void handleCopyNs();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text-main hover:bg-bg-card-hover cursor-pointer !min-h-0"
                    >
                      <Copy size={13} className="text-sky-400 shrink-0" />
                      <span>Copiar nameservers</span>
                    </button>
                  )}

                  {canEdit && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onEdit(domain);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text-main hover:bg-bg-card-hover cursor-pointer !min-h-0"
                    >
                      <Pencil size={13} className="text-text-muted shrink-0" />
                      <span>Editar dominio</span>
                    </button>
                  )}

                  {canDelete && (
                    <>
                      <div className="my-1 border-t border-border-base/70" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete(domain);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 cursor-pointer !min-h-0"
                      >
                        <Trash2 size={13} className="shrink-0" />
                        <span>Eliminar dominio</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 2. SCROLLABLE BODY (zero repetition, zero hidden tabs) */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-xs">
          {/* Unacknowledged security changes banner (NS / Registrar / Lock) */}
          {domain.has_unacknowledged_changes && (
            <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>Cambios detectados en el registro</span>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    disabled={isAcknowledging}
                    onClick={() => onAcknowledgeChanges(domain)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-bg-dark border border-border-accent text-text-main hover:border-accent-green hover:text-accent-green font-semibold text-[11px] disabled:opacity-50 cursor-pointer !min-h-0"
                  >
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    <span>Confirmar cambios</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Un cambio inesperado de nameservers, registrador o bloqueo de
                transferencia puede indicar un secuestro de dominio.
              </p>
              {changes.slice(0, 3).map((ch) => (
                <div
                  key={ch.id}
                  className="rounded-lg bg-bg-dark/70 border border-amber-500/25 p-2 space-y-1 font-mono text-[11px]"
                >
                  <div className="font-sans font-semibold text-amber-200">
                    {formatChangeFieldLabel(ch.field_name)}
                  </div>
                  {ch.old_value && (
                    <div className="text-rose-300 break-all">− {ch.old_value}</div>
                  )}
                  {ch.new_value && (
                    <div className="text-emerald-300 break-all">
                      + {ch.new_value}
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* 2A. EXPIRATION & REMAINING BAR (empties toward expiry) OR Manual Date Fallback */}
          {days !== null ? (
            <section className="rounded-xl border border-border-base/80 bg-bg-dark/60 p-3.5 space-y-2">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <span className={`text-sm font-bold ${expiryTextTone}`}>
                  {days <= 0
                    ? `Venció ${formatDomainExpiredAgo(days).replace("venció ", "")}`
                    : `Vence en ${days} días`}
                </span>
                <span className="font-mono text-xs text-text-muted">
                  {formatDomainDate(expIso)}
                  {!domain.expiration_date && domain.manual_expiration_date
                    ? " · manual"
                    : ""}
                </span>
              </div>

              {remainingPct !== null && (
                <>
                  <div className="h-2 w-full rounded-full bg-bg-card overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.max(remainingPct, 3)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-text-dim">
                    <span>{remainingPct} % restante</span>
                    <span
                      title={`Aviso ≤ ${thresholds.warningDays} d · crítico ≤ ${thresholds.criticalDays} d`}
                    >
                      alertas: {alertSteps.join(" · ")} d
                    </span>
                  </div>
                </>
              )}

              {/* Renovación automática (estado manual: RDAP/WHOIS no lo expone) */}
              <div
                className={`pt-2 mt-1 border-t border-border-base/50 flex items-center justify-between gap-2 flex-wrap text-[11px] ${
                  expiringSoon && domain.auto_renew !== true
                    ? "text-amber-300"
                    : "text-text-dim"
                }`}
              >
                <span
                  className="inline-flex items-center gap-1.5"
                  title="RDAP/WHOIS no publica si la renovación automática está activa; confírmala tras revisar tu registrador."
                >
                  {domain.auto_renew === true ? (
                    <>
                      <Check size={12} className="text-emerald-400 shrink-0" />
                      <span>
                        Renovación automática:{" "}
                        <strong className="text-emerald-300 font-medium">
                          activa
                        </strong>
                      </span>
                    </>
                  ) : domain.auto_renew === false ? (
                    <>
                      <AlertTriangle
                        size={12}
                        className="text-amber-400 shrink-0"
                      />
                      <span>
                        Renovación automática:{" "}
                        <strong className="text-amber-300 font-medium">
                          desactivada
                        </strong>
                      </span>
                    </>
                  ) : (
                    <span>
                      Renovación automática:{" "}
                      <strong
                        className={
                          expiringSoon
                            ? "text-amber-200 font-medium"
                            : "text-text-muted font-medium"
                        }
                      >
                        sin confirmar
                      </strong>
                    </span>
                  )}
                </span>

                {canEdit && onSetAutoRenew && (
                  <button
                    type="button"
                    disabled={isSavingAutoRenew}
                    onClick={() =>
                      onSetAutoRenew(
                        domain,
                        domain.auto_renew === true ? false : true,
                      )
                    }
                    className="px-2 py-0.5 rounded-md border border-border-base bg-bg-card text-[11px] text-text-muted hover:text-accent-green hover:border-accent-green/50 disabled:opacity-50 transition-colors cursor-pointer !min-h-0"
                  >
                    {isSavingAutoRenew
                      ? "Guardando..."
                      : domain.auto_renew === true
                        ? "Marcar desactivada"
                        : "Marcar como activa"}
                  </button>
                )}
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-border-base/80 bg-bg-dark/60 p-3.5 space-y-2.5">
              <div className="flex items-center gap-1.5 font-semibold text-text-main">
                <Calendar size={14} className="text-sky-400 shrink-0" />
                <span>Sin datos de vencimiento del registro</span>
              </div>
              <p className="text-[11px] text-text-dim leading-relaxed">
                Algunos TLD (por ejemplo dominios de país como{" "}
                <span className="font-mono">.gt</span>) no publican fecha de
                expiración en RDAP/WHOIS. Define la fecha manualmente para
                recibir alertas antes de la renovación.
              </p>
              {canEdit && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={manualDateInput}
                    onChange={(e) => setManualDateInput(e.target.value)}
                    aria-label="Fecha manual de vencimiento"
                    className="flex-1 bg-bg-card border border-border-base rounded-lg px-2.5 py-1.5 text-xs font-mono text-text-main focus:border-accent-green focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={!manualDateInput || isSavingManualDate}
                    onClick={() =>
                      onSaveManualExpiration(domain, manualDateInput)
                    }
                    className="px-3 py-1.5 rounded-lg bg-accent-green text-black font-semibold text-xs hover:bg-accent-green/90 disabled:opacity-50 cursor-pointer !min-h-0"
                  >
                    {isSavingManualDate ? "Guardando..." : "Guardar fecha"}
                  </button>
                </div>
              )}
            </section>
          )}

          {/* 2B. SECURITY, PRIVACY & AUTHORITATIVE NAMESERVERS (compact, zero repetition) */}
          <section className="rounded-xl border border-border-base/80 bg-bg-dark/60 divide-y divide-border-base/50">
            {/* Row 1: Transfer Lock + DNSSEC in one line */}
            <div className="px-3.5 py-2.5 flex items-center justify-between gap-3 flex-wrap">
              {domain.is_locked === true ? (
                <span
                  className="inline-flex items-center gap-1.5 text-text-main font-medium"
                  title={`Código EPP: ${transferLockCode}. Impide transferencias no autorizadas; no certifica la seguridad general del dominio.`}
                >
                  <Lock size={13} className="text-emerald-400 shrink-0" />
                  <span>Transferencia bloqueada</span>
                </span>
              ) : domain.is_locked === false ? (
                <span
                  className="inline-flex items-center gap-1.5 text-amber-300 font-medium"
                  title="Activa el bloqueo de transferencia en tu registrador para prevenir transferencias no autorizadas."
                >
                  <Unlock size={13} className="text-amber-400 shrink-0" />
                  <span>Sin bloqueo: podría transferirse</span>
                </span>
              ) : (
                <span className="text-text-dim">
                  Bloqueo: sin datos del registro
                </span>
              )}

              <span
                className={`inline-flex items-center gap-1 text-[11px] ${
                  dnssecSigned ? "text-emerald-300" : "text-text-dim"
                }`}
                title={
                  dnssecSigned
                    ? "DNSSEC activo. Verifica que el registro DS del registrador coincida con la zona para evitar fallas de resolución."
                    : "Firma tus registros DNS para evitar suplantación."
                }
              >
                <span>
                  DNSSEC:{" "}
                  <strong
                    className={
                      dnssecSigned
                        ? "text-emerald-300 font-medium"
                        : "text-text-muted font-medium"
                    }
                  >
                    {dnssecSigned ? "activado" : "no activado"}
                  </strong>
                </span>
                <Info size={12} className="shrink-0 opacity-75" />
              </span>
            </div>

            {/* Row 2: Titular (privacy redaction) + Last updated */}
            <div className="px-3.5 py-2.5 flex items-center justify-between gap-3 flex-wrap text-[11px]">
              <span className="text-text-dim">
                Titular:{" "}
                <span className="text-text-muted">
                  {domain.registrant_country
                    ? domain.registrant_country
                    : "oculto por privacidad"}
                </span>
              </span>
              {domain.last_updated && (
                <span
                  className="font-mono text-text-dim"
                  title="Última modificación publicada en el registro"
                >
                  modificado {formatDomainDate(domain.last_updated)}
                </span>
              )}
            </div>

            {/* Row 3: Authoritative Nameservers + Live Health + Delegation Check + DNS link */}
            <div className="px-3.5 py-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-text-dim font-medium">Nameservers</span>
                  {nsHealthTotal > 0 && (
                    <span
                      title={nsHealthTooltip}
                      className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                        nsHealthAllOk ? "text-emerald-400" : "text-amber-300"
                      }`}
                    >
                      {nsHealthAllOk ? (
                        <>
                          <Check size={12} className="shrink-0" />
                          <span>
                            {nsHealthResponding} de {nsHealthTotal} responden
                          </span>
                        </>
                      ) : nsHealthResponding < nsHealthTotal ? (
                        <>
                          <AlertTriangle size={12} className="shrink-0" />
                          <span>
                            {nsHealthResponding} de {nsHealthTotal} responden
                          </span>
                        </>
                      ) : nsHealth?.soa_consistent === false ? (
                        <>
                          <AlertTriangle size={12} className="shrink-0" />
                          <span>SOA distinto entre NS</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={12} className="shrink-0" />
                          <span>Delegación inconsistente</span>
                        </>
                      )}
                    </span>
                  )}
                </div>

                {nsList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleCopyNs()}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-border-base bg-bg-card text-[11px] text-text-muted hover:text-text-main hover:border-border-accent shrink-0 cursor-pointer !min-h-0"
                    title="Copiar nameservers"
                  >
                    {copiedNs ? (
                      <>
                        <Check size={11} className="text-accent-green" />
                        <span className="text-accent-green">Copiado</span>
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

              {nsList.length > 0 ? (
                <div className="font-mono text-[11px] text-text-main leading-relaxed break-all">
                  {nsList.map((ns, idx) => {
                    const srv = nsServerMap.get(ns.toLowerCase());
                    const srvTitle = srv
                      ? srv.responding
                        ? `${ns} (${srv.ip || "IP"}) · ${srv.latency_ms ?? "?"} ms${srv.authoritative ? " · autoritativo" : ""}${srv.soa_serial != null ? ` · SOA ${srv.soa_serial}` : ""}`
                        : `${ns}: sin respuesta${srv.error ? ` (${srv.error})` : ""}`
                      : ns;
                    return (
                      <span key={ns} title={srvTitle}>
                        {idx > 0 && (
                          <span
                            aria-hidden="true"
                            className="mx-1.5 text-text-dim"
                          >
                            ·
                          </span>
                        )}
                        <span
                          className={
                            srv && !srv.responding
                              ? "text-amber-300 underline decoration-dotted"
                              : "text-text-main"
                          }
                        >
                          {ns}
                        </span>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="text-text-dim">Sin nameservers reportados</div>
              )}

              {nsHealth?.delegation_consistent === false &&
                nsHealth.zone_ns &&
                nsHealth.zone_ns.length > 0 && (
                  <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200 leading-relaxed">
                    Delegación inconsistente: los NS de la zona (
                    <span className="font-mono">
                      {nsHealth.zone_ns.join(", ")}
                    </span>
                    ) no coinciden con los del registro.
                  </div>
                )}

              <div className="pt-0.5">
                <Link
                  to={`/dns?search=${encodeURIComponent(domain.domain)}`}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-accent-green hover:underline"
                >
                  <span>Ver registros de {domain.domain}</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </section>

          {/* 2C. ACTIONABLE NOTIFICATION WARNING (outside accordion when 0 destinations) */}
          {destinations.length === 0 && (
            <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-2.5 flex items-center justify-between gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-amber-200 font-medium">
                <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                <span>Nadie será notificado cuando venza</span>
              </span>
              <Link
                to="/notifications"
                className="inline-flex items-center gap-1 text-accent-green hover:underline font-semibold whitespace-nowrap"
              >
                <span>Agregar destino</span>
                <ArrowRight size={12} />
              </Link>
            </div>
          )}

          {/* 2D. CROSS-MODULE DEPENDENCIES (blast radius if domain expires) */}
          {deps &&
            (deps.targets_count > 0 ||
              deps.dns_count > 0 ||
              deps.ssl_count > 0) && (
              <section className="rounded-xl border border-border-base/80 bg-bg-dark/60 px-3.5 py-2.5 space-y-1.5">
                <div className="text-[11px] font-medium text-text-muted">
                  Dependen de este dominio
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {deps.targets_count > 0 && (
                    <Link
                      to={`/monitoring?search=${encodeURIComponent(domain.domain)}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-card border border-border-base text-text-main hover:border-accent-green/50 hover:text-accent-green transition-colors"
                    >
                      <span>
                        {deps.targets_count}{" "}
                        {deps.targets_count === 1 ? "target" : "targets"}
                      </span>
                      <ArrowUpRight size={11} className="shrink-0 opacity-75" />
                    </Link>
                  )}
                  {deps.dns_count > 0 && (
                    <Link
                      to={`/dns?search=${encodeURIComponent(domain.domain)}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-card border border-border-base text-text-main hover:border-accent-green/50 hover:text-accent-green transition-colors"
                    >
                      <span>
                        {deps.dns_count}{" "}
                        {deps.dns_count === 1
                          ? "registro DNS"
                          : "registros DNS"}
                      </span>
                      <ArrowUpRight size={11} className="shrink-0 opacity-75" />
                    </Link>
                  )}
                  {deps.ssl_count > 0 && (
                    <Link
                      to={`/ssl?search=${encodeURIComponent(domain.domain)}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-card border border-border-base text-text-main hover:border-accent-green/50 hover:text-accent-green transition-colors"
                    >
                      <span>
                        {deps.ssl_count}{" "}
                        {deps.ssl_count === 1 ? "certificado" : "certificados"}
                      </span>
                      <ArrowUpRight size={11} className="shrink-0 opacity-75" />
                    </Link>
                  )}
                </div>
              </section>
            )}

          {/* 2E. COLLAPSIBLE: Alertas (collapsed by default; zero duplicate warning copy) */}
          <section className="rounded-xl border border-border-base/80 bg-bg-dark/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setAlertsOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-bg-card-hover/50 transition-colors cursor-pointer !min-h-0"
            >
              <span className="inline-flex items-center gap-2 font-medium text-text-main">
                {alertsOpen ? (
                  <ChevronDown size={13} className="text-text-dim" />
                ) : (
                  <ChevronRight size={13} className="text-text-dim" />
                )}
                <Bell size={13} className="text-amber-400 shrink-0" />
                <span>Alertas</span>
              </span>
              <span className="text-[11px] font-mono text-text-dim truncate max-w-[180px]">
                {destinations.length > 0
                  ? destinations.map((d) => d.name).join(", ")
                  : alertRules.length > 0
                    ? `${alertRules.length} ${alertRules.length === 1 ? "regla" : "reglas"}`
                    : ""}
              </span>
            </button>

            {alertsOpen && (
              <div className="border-t border-border-base/60 p-3 space-y-2 text-[11px]">
                {destinations.length > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-text-dim">Canales activos</span>
                      <Link
                        to="/notifications"
                        className="text-accent-green hover:underline font-medium"
                      >
                        Gestionar canales
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {destinations.map((ch) => (
                        <span
                          key={ch.id}
                          className="px-2 py-0.5 rounded-md bg-bg-card border border-border-base text-text-main"
                        >
                          {ch.name}
                        </span>
                      ))}
                    </div>
                  </>
                )}

                <div
                  className={`${destinations.length > 0 ? "pt-1.5 border-t border-border-base/50" : ""} flex items-center justify-between`}
                >
                  <span className="text-text-dim">
                    Reglas activas ({alertRules.length})
                  </span>
                  <Link
                    to="/alerts"
                    className="text-accent-green hover:underline font-medium"
                  >
                    Configurar reglas
                  </Link>
                </div>
                {alertRules.length > 0 ? (
                  <div className="space-y-1">
                    {alertRules.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between px-2 py-1 rounded bg-bg-card border border-border-base/60"
                      >
                        <span className="text-text-main truncate">
                          {r.name}
                        </span>
                        <span className="font-mono text-text-dim shrink-0">
                          {r.condition === "domain_expiring"
                            ? `≤ ${Math.round(r.threshold)} d`
                            : "Desbloqueo"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-dim">
                    Sin reglas específicas de dominio configuradas.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* 2F. COLLAPSIBLE: Estados del dominio (EPP) */}
          {eppStatuses.length > 0 && (
            <section className="rounded-xl border border-border-base/80 bg-bg-dark/60 overflow-hidden">
              <button
                type="button"
                onClick={() => setEppOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-bg-card-hover/50 transition-colors cursor-pointer !min-h-0"
              >
                <span className="inline-flex items-center gap-2 font-medium text-text-main">
                  {eppOpen ? (
                    <ChevronDown size={13} className="text-text-dim" />
                  ) : (
                    <ChevronRight size={13} className="text-text-dim" />
                  )}
                  <Shield size={13} className="text-sky-400 shrink-0" />
                  <span>Estados del dominio (EPP)</span>
                </span>
                <span className="font-mono text-[11px] text-text-dim">
                  {eppStatuses.length}
                </span>
              </button>

              {eppOpen && (
                <div className="border-t border-border-base/60 p-3 flex flex-wrap gap-1.5">
                  {eppStatuses.map((raw, idx) => {
                    const info = formatEPPStatusHuman(raw);
                    return (
                      <span
                        key={idx}
                        title={
                          info.scope === "registry"
                            ? `${info.raw} · Protegido a nivel de registro TLD`
                            : info.scope === "registrar"
                              ? `${info.raw} · Protegido por el registrador`
                              : info.raw
                        }
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] ${
                          info.scope === "registry"
                            ? "bg-sky-500/10 border-sky-500/40 text-sky-200"
                            : info.protective
                              ? "bg-bg-card border-emerald-500/30 text-text-main"
                              : "bg-bg-card border-border-base/70 text-text-muted"
                        }`}
                      >
                        <span>{info.label}</span>
                        {info.scopeLabel && (
                          <span
                            className={`px-1.5 py-px rounded text-[10px] font-mono ${
                              info.scope === "registry"
                                ? "bg-sky-500/20 text-sky-300"
                                : "bg-bg-dark text-text-dim"
                            }`}
                          >
                            {info.scopeLabel}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* 2G. Historial de cambios (single quiet line when 0; collapsible accordion when >0) */}
          {changes.length === 0 ? (
            <div className="px-1 py-1 flex items-center gap-1.5 text-[11px] text-text-dim">
              <History size={12} className="shrink-0 opacity-75" />
              <span>Sin cambios registrados</span>
            </div>
          ) : (
            <section className="rounded-xl border border-border-base/80 bg-bg-dark/60 overflow-hidden">
              <button
                type="button"
                onClick={() => setHistoryOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-bg-card-hover/50 transition-colors cursor-pointer !min-h-0"
              >
                <span className="inline-flex items-center gap-2 font-medium text-text-main">
                  {historyOpen ? (
                    <ChevronDown size={13} className="text-text-dim" />
                  ) : (
                    <ChevronRight size={13} className="text-text-dim" />
                  )}
                  <History size={13} className="text-sky-400 shrink-0" />
                  <span>Historial de cambios</span>
                </span>
                <span className="font-mono text-[11px] text-text-dim">
                  {changes.length}
                </span>
              </button>

              {historyOpen && (
                <div className="border-t border-border-base/60 p-3 space-y-2">
                  {changes.map((ch) => (
                    <div
                      key={ch.id}
                      className="rounded-lg bg-bg-card border border-border-base/70 p-2.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-text-main">
                          {formatChangeFieldLabel(ch.field_name)}
                        </span>
                        <RelativeTime
                          value={ch.changed_at}
                          className="font-mono text-text-dim"
                        />
                      </div>
                      <div className="space-y-1 font-mono text-[11px]">
                        {ch.old_value && (
                          <div className="px-2 py-1 rounded bg-rose-500/10 border border-rose-500/25 text-rose-300 break-all">
                            − {ch.old_value}
                          </div>
                        )}
                        {ch.new_value && (
                          <div className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 break-all">
                            + {ch.new_value}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* 3. SINGLE-LINE FOOTER (clear RDAP cadence: automatic every 12 h) */}
        <footer className="shrink-0 border-t border-border-base/80 bg-bg-dark/80 px-5 py-2.5 text-[11px] text-text-dim font-mono">
          Última consulta{" "}
          <RelativeTime
            value={domain.last_scanned_at}
            emptyLabel="nunca"
            className="text-text-muted"
          />{" "}
          · {formatDataSourceLabel(domain)} · automático cada 12 h
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
