import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  ExternalLink,
  History,
  Link2,
  Loader2,
  MoreHorizontal,
  Network,
  Pencil,
  RefreshCw,
  Server,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { useCapability } from "../../hooks/useCapability";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import type {
  DNSChangeHistory,
  DNSLinkedTarget,
  DNSRecord,
  DNSReferenceMode,
} from "../../types/dns";
import RelativeTime from "../common/connectivity/RelativeTime";
import StatusPill, { StatusShapeIcon } from "../common/connectivity/StatusPill";
import {
  DNS_STATE_META,
  DNS_TYPE_TOOLTIPS,
  computeDNSDiff,
  formatDNSDateShort,
  formatDNSLatency,
  formatDNSTTL,
  formatResolverLabel,
  getDNSErrorCodeLabel,
  getDNSHealthState,
  getDNSLatencyToneClass,
  getDNSLatencyTooltip,
  getDNSReferenceModeLabel,
  getDNSStateLabel,
  hasIPv4Values,
  parseDNSValues,
  sameProviderSubnetHint,
} from "./useDNSRecords";

interface DNSDetailDrawerProps {
  record: DNSRecord;
  records: DNSRecord[];
  history: DNSChangeHistory[];
  isLoadingHistory: boolean;
  isScanning: boolean;
  isAcceptingRef: boolean;
  isLinking?: boolean;
  onSelectRecord: (record: DNSRecord) => void;
  onScan: (record: DNSRecord) => void;
  onAcceptReference: (record: DNSRecord, mode?: DNSReferenceMode) => void;
  onEdit: (record: DNSRecord) => void;
  onDelete: (record: DNSRecord) => void;
  onLinkTarget?: (record: DNSRecord, target: DNSLinkedTarget) => void;
  onClose: () => void;
}

export default function DNSDetailDrawer({
  record,
  records,
  history,
  isLoadingHistory,
  isScanning,
  isAcceptingRef,
  isLinking = false,
  onSelectRecord,
  onScan,
  onAcceptReference,
  onEdit,
  onDelete,
  onLinkTarget,
  onClose,
}: DNSDetailDrawerProps) {
  const drawerRef = useDialogFocus(true, record.id);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const canScan = useCapability("dns_monitor.scan");
  const canEdit = useCapability("dns_monitor.update");
  const canDelete = useCapability("dns_monitor.delete");

  const state = getDNSHealthState(record);
  const meta = DNS_STATE_META[state];
  const stateLabel = getDNSStateLabel(record, state);

  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedValues, setCopiedValues] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(
    state === "rotating" || state === "propagating",
  );
  // Resolvers accordion strictly collapsed by default; auto-open ONLY when resolvers truly disagree
  const resolversDisagree =
    state === "propagating" && record.propagation_status === "propagating";
  const [resolversOpen, setResolversOpen] = useState(resolversDisagree);

  useEffect(() => {
    const nextState = getDNSHealthState(record);
    setHistoryOpen(nextState === "rotating" || nextState === "propagating");
    setResolversOpen(
      nextState === "propagating" && record.propagation_status === "propagating",
    );
    setMenuOpen(false);
    setCopiedValues(false);
  }, [record.id, record.propagation_status]);

  // Prev / Next navigation across sorted records
  const currentIdx = records.findIndex((r) => r.id === record.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < records.length - 1;
  const goPrev = () => {
    if (hasPrev) onSelectRecord(records[currentIdx - 1]);
  };
  const goNext = () => {
    if (hasNext) onSelectRecord(records[currentIdx + 1]);
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

  const values = parseDNSValues(record.value);
  const expectedValues = record.expected_values || [];
  const resolverResults = record.resolver_results || [];
  const linkedTarget = record.linked_targets?.[0];
  const suggestedTarget = record.suggested_targets?.[0];

  const expectedDiff =
    expectedValues.length > 0 && record.matches_expected === false
      ? computeDNSDiff(expectedValues.join("\n"), values.join("\n"))
      : null;

  const latestDiff = record.latest_change
    ? computeDNSDiff(
        record.latest_change.old_value,
        record.latest_change.new_value,
      )
    : null;

  const activeDiff = expectedDiff || latestDiff;

  const canDefineReference = canEdit && values.length > 0;
  const showRotatingSubnetHint =
    (state === "mismatch" || state === "rotating" || state === "propagating") &&
    (sameProviderSubnetHint(values, expectedValues) ||
      (state === "rotating" && hasIPv4Values(values)));
  const supportsCidr = hasIPv4Values(values);

  const isTxt = record.record_type === "TXT";
  const hasSpf = isTxt && record.value.includes("v=spf1");
  const hasDmarc = isTxt && record.value.includes("v=DMARC1");

  const refDefinedDate = formatDNSDateShort(
    record.reference_updated_at || record.updated_at || record.created_at,
  );

  const handleCopyAll = async () => {
    if (!record.value) return;
    try {
      await navigator.clipboard.writeText(record.value);
      setCopiedValues(true);
      setTimeout(() => setCopiedValues(false), 1500);
    } catch {
      // ignore clipboard error
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-40 flex justify-end">
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="false"
        aria-label={`Detalle de ${record.record_type} ${record.domain}`}
        onClick={(e) => e.stopPropagation()}
        className="pointer-events-auto relative flex h-full w-full max-w-[540px] flex-col border-l border-border-accent/70 bg-bg-card shadow-[-12px_0_40px_rgba(0,0,0,0.55)] animate-in slide-in-from-right duration-200"
      >
        {/* 1. STICKY HEADER */}
        <header className="shrink-0 border-b border-border-base/80 bg-bg-dark/90 px-5 pt-4 pb-3.5 space-y-2.5">
          {/* Row 1: Status shape icon + Domain + Status pill + Nav + Close */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <StatusShapeIcon
                shape={meta.shape}
                size={16}
                className={`shrink-0 ${meta.textClass}`}
              />
              <h2
                className="text-base font-bold text-text-main truncate"
                title={record.domain}
              >
                {record.domain}
              </h2>
              <StatusPill
                tone={meta.tone}
                shape={meta.shape}
                label={stateLabel}
                size="xs"
              />
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                disabled={!hasPrev}
                onClick={goPrev}
                title="Registro anterior (↑)"
                aria-label="Registro anterior"
                className="h-7 w-7 grid place-items-center rounded-lg text-text-dim hover:text-text-main hover:bg-white/10 disabled:opacity-30 cursor-pointer !min-h-0 !min-w-0"
              >
                <ChevronUp size={15} />
              </button>
              <button
                type="button"
                disabled={!hasNext}
                onClick={goNext}
                title="Siguiente registro (↓)"
                aria-label="Siguiente registro"
                className="h-7 w-7 grid place-items-center rounded-lg text-text-dim hover:text-text-main hover:bg-white/10 disabled:opacity-30 cursor-pointer !min-h-0 !min-w-0"
              >
                <ChevronDown size={15} />
              </button>
              <a
                href={`https://${record.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`Abrir ${record.domain} en nueva pestaña`}
                aria-label={`Abrir ${record.domain}`}
                className="h-7 w-7 grid place-items-center rounded-lg text-text-dim hover:text-accent-green hover:bg-white/10 !min-h-0 !min-w-0"
              >
                <ExternalLink size={14} />
              </a>
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

          {/* Row 2: Technical Subtitle (single source of truth for resolver & latency) */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs text-text-muted font-mono">
            <span
              title={
                DNS_TYPE_TOOLTIPS[record.record_type] ||
                `Registro ${record.record_type}`
              }
              className="text-text-main font-semibold"
            >
              Registro {record.record_type}
            </span>
            <span aria-hidden="true" className="text-text-dim">
              ·
            </span>
            <span>TTL {formatDNSTTL(record.ttl)}</span>
            {record.resolver && (
              <>
                <span aria-hidden="true" className="text-text-dim">
                  ·
                </span>
                <span title={formatResolverLabel(record.resolver)}>
                  resolver {record.resolver}
                </span>
              </>
            )}
            {record.response_time_ms != null && (
              <>
                <span aria-hidden="true" className="text-text-dim">
                  ·
                </span>
                <span
                  className={getDNSLatencyToneClass(record.response_time_ms)}
                  title={getDNSLatencyTooltip(record)}
                >
                  {formatDNSLatency(record.response_time_ms)}
                </span>
              </>
            )}
          </div>

          {/* Row 3: Action Strip ([Comprobar ahora] [↗ target] [⋯]) */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              {canScan && (
                <button
                  type="button"
                  disabled={isScanning}
                  onClick={() => onScan(record)}
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
                  title={
                    linkedTarget.enabled
                      ? `Abrir target ${linkedTarget.name} en Uptime`
                      : `Abrir target ${linkedTarget.name} (pausado en Uptime)`
                  }
                  className={`inline-flex items-center gap-1 h-8 px-3 rounded-full border text-xs font-medium transition-colors !min-h-0 ${
                    linkedTarget.enabled
                      ? "bg-bg-card border-border-base text-text-main hover:border-accent-green/50 hover:text-accent-green"
                      : "bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
                  }`}
                >
                  <ArrowUpRight size={13} className="shrink-0" />
                  <span className="truncate max-w-[160px]">
                    {linkedTarget.name}
                    {!linkedTarget.enabled ? " (pausado)" : ""}
                  </span>
                </Link>
              )}

              {!linkedTarget && suggestedTarget && onLinkTarget && (
                <button
                  type="button"
                  disabled={isLinking}
                  onClick={() => onLinkTarget(record, suggestedTarget)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-dashed border-border-accent bg-bg-card text-xs text-text-muted hover:text-accent-green hover:border-accent-green/50 transition-colors cursor-pointer !min-h-0"
                >
                  <Link2 size={12} className="shrink-0" />
                  <span className="truncate max-w-[170px]">
                    Vincular: {suggestedTarget.name}
                  </span>
                </button>
              )}
            </div>

            {/* Overflow menu ⋯ (Definir como referencia, Copiar valores, Editar, Eliminar) */}
            <div ref={menuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Más acciones del registro"
                title="Definir referencia, copiar valores, editar o eliminar"
                className={`h-8 w-8 grid place-items-center rounded-full border border-border-base bg-bg-card text-text-muted hover:text-text-main hover:bg-bg-card-hover transition-colors cursor-pointer !min-h-0 !min-w-0 ${
                  menuOpen ? "border-border-accent text-text-main" : ""
                }`}
              >
                <MoreHorizontal size={15} />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-9 z-40 w-56 rounded-xl border border-border-accent/70 bg-bg-dark p-1 shadow-2xl text-xs animate-in fade-in zoom-in-95 duration-100"
                >
                  {canDefineReference && (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={isAcceptingRef}
                      onClick={() => {
                        setMenuOpen(false);
                        onAcceptReference(record);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text-main hover:bg-bg-card-hover disabled:opacity-50 cursor-pointer !min-h-0"
                    >
                      <CheckCircle2
                        size={13}
                        className="text-emerald-400 shrink-0"
                      />
                      <span>Definir como referencia</span>
                    </button>
                  )}

                  {values.length > 0 && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        void handleCopyAll();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text-main hover:bg-bg-card-hover cursor-pointer !min-h-0"
                    >
                      <Copy size={13} className="text-sky-400 shrink-0" />
                      <span>Copiar valores</span>
                    </button>
                  )}

                  {canEdit && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onEdit(record);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text-main hover:bg-bg-card-hover cursor-pointer !min-h-0"
                    >
                      <Pencil size={13} className="text-text-muted shrink-0" />
                      <span>Editar registro</span>
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
                          onDelete(record);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 cursor-pointer !min-h-0"
                      >
                        <Trash2 size={13} className="shrink-0" />
                        <span>Eliminar registro</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 2. SCROLLABLE BODY (zero repetition) */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-xs">
          {/* Paused linked target suggestion */}
          {linkedTarget &&
            !linkedTarget.enabled &&
            suggestedTarget &&
            onLinkTarget && (
              <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 flex items-center justify-between gap-2">
                <div className="text-amber-200 leading-relaxed">
                  Vinculado a <strong>{linkedTarget.name}</strong> (pausado).
                  Existe el target activo <strong>{suggestedTarget.name}</strong>.
                </div>
                <button
                  type="button"
                  disabled={isLinking}
                  onClick={() => onLinkTarget(record, suggestedTarget)}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 font-semibold cursor-pointer !min-h-0"
                >
                  Vincular activo
                </button>
              </div>
            )}

          {/* Contextual Error / Propagating Banner */}
          {state === "error" && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-rose-300">
                <AlertTriangle size={14} className="shrink-0" />
                <span>
                  Error de resolución · {getDNSErrorCodeLabel(record)}
                </span>
              </div>
              {record.last_error_message && (
                <p className="text-rose-200/90 font-mono text-[11px] break-words">
                  {record.last_error_message}
                </p>
              )}
              {values.length > 0 && (
                <p className="text-text-dim text-[11px]">
                  Debajo se muestra el último valor válido obtenido anteriormente.
                </p>
              )}
            </div>
          )}

          {state === "propagating" && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                <AlertTriangle size={14} className="shrink-0" />
                <span>
                  {record.propagation_status === "propagating"
                    ? "Propagación en curso entre resolvers públicos"
                    : "Cambio reciente dentro de la ventana de TTL"}
                </span>
              </div>
              <p className="text-amber-200/90 text-[11px] leading-relaxed">
                {record.propagation_status === "propagating"
                  ? "Los resolvers consultados aún devuelven conjuntos de respuestas distintos. Revisa Resolvers consultados abajo."
                  : `El registro cambió hace menos de ${formatDNSTTL(record.ttl || 300)}. Pasará a Fuera de referencia solo si persiste tras el TTL.`}
              </p>
              {activeDiff &&
                (activeDiff.removed.length > 0 || activeDiff.added.length > 0) && (
                  <div className="space-y-1 font-mono text-[11px]">
                    {activeDiff.removed.map((v, i) => (
                      <div
                        key={`prop-rem-${i}`}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-500/10 border border-rose-500/25 text-rose-300 break-all"
                      >
                        <span className="font-bold select-none">−</span>
                        <span>{v}</span>
                        <span className="ml-auto text-[10px] font-sans opacity-80 shrink-0">
                          {expectedDiff ? "Esperado" : "Anterior"}
                        </span>
                      </div>
                    ))}
                    {activeDiff.added.map((v, i) => (
                      <div
                        key={`prop-add-${i}`}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 break-all"
                      >
                        <span className="font-bold select-none">+</span>
                        <span>{v}</span>
                        <span className="ml-auto text-[10px] font-sans opacity-80 shrink-0">
                          Actual
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              {canDefineReference && (
                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  <button
                    type="button"
                    disabled={isAcceptingRef}
                    onClick={() => onAcceptReference(record, "exact")}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bg-dark border border-border-accent text-text-main hover:border-accent-green hover:text-accent-green font-semibold text-[11px] disabled:opacity-50 transition-colors cursor-pointer !min-h-0"
                  >
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    <span>Definir como referencia</span>
                  </button>
                  {supportsCidr && (
                    <button
                      type="button"
                      disabled={isAcceptingRef}
                      onClick={() => onAcceptReference(record, "cidr")}
                      title="Guarda los rangos /24 de las IPs actuales para absorber rotaciones del proveedor"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/35 text-sky-300 hover:bg-sky-500/20 font-semibold text-[11px] disabled:opacity-50 transition-colors cursor-pointer !min-h-0"
                    >
                      <Network size={12} />
                      <span>Aceptar como rango /24</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {state === "rotating" && (
            <div className="rounded-xl border border-sky-500/35 bg-sky-500/10 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sky-200 inline-flex items-center gap-1.5">
                  <Network size={14} className="text-sky-400 shrink-0" />
                  <span>Rotación de IPs del proveedor detectada</span>
                </span>
                {(record.changes_last_hour ?? 0) > 0 && (
                  <span className="font-mono text-[10px] text-sky-300/90">
                    {record.changes_last_hour} cambios/h
                  </span>
                )}
              </div>
              <p className="text-sky-200/85 text-[11px] leading-relaxed">
                Las IPs alternan dentro de los mismos rangos{" "}
                <span className="font-mono">/24</span> (comportamiento normal de
                CDN o balanceador). Guarda la referencia en modo{" "}
                <strong>Rango CIDR (/24)</strong> para marcarlo como Resuelto y
                evitar alertas repetitivas.
              </p>
              {activeDiff &&
                (activeDiff.removed.length > 0 || activeDiff.added.length > 0) && (
                  <div className="space-y-1 font-mono text-[11px]">
                    {activeDiff.removed.map((v, i) => (
                      <div
                        key={`rot-rem-${i}`}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-dark/70 border border-border-base/70 text-text-muted break-all"
                      >
                        <span className="font-bold select-none text-rose-300">−</span>
                        <span>{v}</span>
                        <span className="ml-auto text-[10px] font-sans opacity-75 shrink-0">
                          {expectedDiff ? "Ref." : "Anterior"}
                        </span>
                      </div>
                    ))}
                    {activeDiff.added.map((v, i) => (
                      <div
                        key={`rot-add-${i}`}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-dark/70 border border-border-base/70 text-text-main break-all"
                      >
                        <span className="font-bold select-none text-sky-300">+</span>
                        <span>{v}</span>
                        <span className="ml-auto text-[10px] font-sans opacity-75 shrink-0">
                          Actual
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              {canDefineReference && (
                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  {supportsCidr && (
                    <button
                      type="button"
                      disabled={isAcceptingRef}
                      onClick={() => onAcceptReference(record, "cidr")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-green text-black hover:bg-accent-green/90 font-semibold text-[11px] disabled:opacity-50 transition-colors cursor-pointer !min-h-0"
                    >
                      <Network size={12} />
                      <span>Aceptar como rango /24</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isAcceptingRef}
                    onClick={() => onAcceptReference(record, "exact")}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-bg-dark border border-border-base text-text-muted hover:text-text-main hover:border-border-accent font-medium text-[11px] disabled:opacity-50 transition-colors cursor-pointer !min-h-0"
                  >
                    <CheckCircle2 size={12} />
                    <span>Guardar IPs exactas</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 2A. RESOLVED VALUES CARD (shown ONCE at top) */}
          <section className="rounded-xl border border-border-base/80 bg-bg-dark/60 overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-2 border-b border-border-base/60">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text-main">Resuelve a</span>
                {values.length > 1 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-bg-card border border-border-base font-mono text-[10px] text-text-dim">
                    {values.length} valores
                  </span>
                )}
              </div>
              {values.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleCopyAll()}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border-base bg-bg-card text-[11px] text-text-muted hover:text-text-main hover:border-border-accent transition-colors cursor-pointer !min-h-0"
                >
                  {copiedValues ? (
                    <>
                      <Check size={12} className="text-accent-green" />
                      <span className="text-accent-green">Copiado</span>
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

            <div className="p-3 space-y-1.5">
              {values.length > 0 ? (
                values.map((val, idx) => (
                  <div
                    key={idx}
                    className="px-2.5 py-1.5 rounded-lg bg-bg-card border border-border-base/60 font-mono text-xs text-text-main break-all select-all"
                  >
                    {val}
                  </div>
                ))
              ) : (
                <div className="text-text-dim text-xs py-1">
                  Sin valores resueltos actualmente.
                </div>
              )}

              {/* Single neutral stability + consensus summary line */}
              <div className="pt-1.5 flex items-center justify-between gap-2 text-[11px] text-text-dim flex-wrap">
                {record.last_change_at ? (
                  <span>
                    Último cambio{" "}
                    <RelativeTime
                      value={record.last_change_at}
                      className="text-text-muted font-mono"
                    />
                  </span>
                ) : (
                  <span>
                    Sin cambios desde el {formatDNSDateShort(record.created_at)}
                  </span>
                )}
                {record.propagation_status === "consistent" &&
                  resolverResults.length > 1 && (
                    <span className="text-emerald-400/90 font-medium">
                      Consistente en {resolverResults.length} resolvers
                    </span>
                  )}
              </div>
            </div>
          </section>

          {/* 2B. REFERENCE SECTION: 1 compact line when matching; expanded diff ONLY when out of reference */}
          {state === "mismatch" ? (
            <section className="rounded-xl border border-rose-500/40 bg-bg-dark/70 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 font-semibold text-rose-300">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>Fuera de referencia</span>
                  <span className="text-[11px] font-normal text-text-dim">
                    · {getDNSReferenceModeLabel(record.reference_mode)}
                  </span>
                </div>
              </div>

              {/* Rotating provider subnet hint */}
              {showRotatingSubnetHint && (
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-2 text-[11px] text-sky-200 leading-relaxed">
                  Las IPs resueltas pertenecen a los mismos rangos{" "}
                  <span className="font-mono">/24</span> que tu referencia
                  (típico en proveedores con IPs rotativas). Puedes cambiar el
                  modo a <strong>Rango CIDR (/24)</strong> para evitar falsos
                  positivos.
                </div>
              )}

              {/* Colored Diff: Expected (−) vs Resolved (+) */}
              {expectedDiff && (
                <div className="space-y-1 font-mono text-[11px]">
                  {expectedDiff.removed.map((v, i) => (
                    <div
                      key={`exp-rem-${i}`}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-500/10 border border-rose-500/25 text-rose-300 break-all"
                    >
                      <span className="font-bold select-none">−</span>
                      <span>{v}</span>
                      <span className="ml-auto text-[10px] font-sans opacity-80 shrink-0">
                        Esperado
                      </span>
                    </div>
                  ))}
                  {expectedDiff.added.map((v, i) => (
                    <div
                      key={`exp-add-${i}`}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 break-all"
                    >
                      <span className="font-bold select-none">+</span>
                      <span>{v}</span>
                      <span className="ml-auto text-[10px] font-sans opacity-80 shrink-0">
                        Actual
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons: accept exact OR accept as CIDR /24 range */}
              {canDefineReference && (
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    disabled={isAcceptingRef}
                    onClick={() => onAcceptReference(record, "exact")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-card border border-border-accent text-text-main hover:border-accent-green hover:text-accent-green font-semibold text-[11px] disabled:opacity-50 transition-colors cursor-pointer !min-h-0"
                  >
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    <span>Aceptar como referencia</span>
                  </button>

                  {supportsCidr && (
                    <button
                      type="button"
                      disabled={isAcceptingRef}
                      onClick={() => onAcceptReference(record, "cidr")}
                      title="Guarda los rangos /24 de las IPs actuales para tolerar rotaciones dentro del mismo proveedor"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/35 text-sky-300 hover:bg-sky-500/20 font-semibold text-[11px] disabled:opacity-50 transition-colors cursor-pointer !min-h-0"
                    >
                      <Network size={12} />
                      <span>Aceptar como rango /24</span>
                    </button>
                  )}
                </div>
              )}
            </section>
          ) : expectedValues.length > 0 && record.matches_expected ? (
            /* Single compact line when matching — NO duplicated IPs */
            <section className="rounded-xl border border-border-base/80 bg-bg-dark/60 px-3.5 py-2.5 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-text-main">
                <span className="font-semibold">Referencia</span>
                <Check size={13} className="text-emerald-400 shrink-0" />
                <span className="text-emerald-400 font-medium">coincide</span>
                <span className="text-text-dim">
                  · definida el {refDefinedDate}
                </span>
              </div>
              {record.reference_mode && record.reference_mode !== "exact" && (
                <span className="px-2 py-0.5 rounded-full bg-bg-card border border-border-base font-mono text-[10px] text-text-muted">
                  {getDNSReferenceModeLabel(record.reference_mode)}
                </span>
              )}
            </section>
          ) : expectedValues.length > 0 && record.matches_expected === false ? (
            /* Compact 1-row reference summary while Propagando / Rotando (diff already shown above) */
            <section className="rounded-xl border border-border-base/80 bg-bg-dark/60 px-3.5 py-2.5 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 min-w-0 text-text-muted">
                <span className="font-semibold text-text-main shrink-0">
                  Referencia
                </span>
                <span className="font-mono text-[11px] truncate" title={expectedValues.join(", ")}>
                  {expectedValues.join(", ")}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-bg-card border border-border-base font-mono text-[10px] text-text-dim shrink-0">
                {getDNSReferenceModeLabel(record.reference_mode)}
              </span>
            </section>
          ) : (
            /* Compact 1-row prompt when no reference is defined yet */
            <section className="rounded-xl border border-border-base/80 bg-bg-dark/60 px-3.5 py-2.5 flex items-center justify-between gap-2 flex-wrap">
              <span className="text-text-dim">Sin referencia definida</span>
              {canDefineReference && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isAcceptingRef}
                    onClick={() => onAcceptReference(record, "exact")}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border-accent bg-bg-card text-text-main hover:border-accent-green hover:text-accent-green font-semibold text-[11px] disabled:opacity-50 transition-colors cursor-pointer !min-h-0"
                  >
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    <span>Definir como referencia</span>
                  </button>
                  {supportsCidr && (
                    <button
                      type="button"
                      disabled={isAcceptingRef}
                      onClick={() => onAcceptReference(record, "cidr")}
                      title="Guardar como rango CIDR /24 (ideal para CDN o IPs rotativas)"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border-base bg-bg-card text-text-muted hover:text-sky-300 hover:border-sky-500/40 text-[11px] disabled:opacity-50 transition-colors cursor-pointer !min-h-0"
                    >
                      <Network size={11} />
                      <span>/24</span>
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {/* 2C. SPF / DMARC SECURITY CARD (inline for TXT records) */}
          {(hasSpf || hasDmarc) && (
            <section className="rounded-xl border border-border-base/80 bg-bg-dark/60 p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-semibold text-text-main">
                  <Shield size={14} className="text-sky-400 shrink-0" />
                  <span>
                    {hasSpf ? "Política SPF detectada" : "Política DMARC detectada"}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-bg-card border border-border-base font-mono text-[10px] text-text-muted">
                  {hasSpf ? "v=spf1" : "v=DMARC1"}
                </span>
              </div>
              <p className="text-[11px] text-text-dim">
                {hasSpf
                  ? "Define los servidores autorizados a enviar correo en nombre de este dominio."
                  : "Define la política de validación y reporte contra suplantación de correo."}
              </p>
            </section>
          )}

          {/* 2D. COLLAPSIBLE CHANGE HISTORY (rendered ONLY when events exist) */}
          {(history.length > 0 || isLoadingHistory) && (
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
                  {isLoadingHistory ? "..." : `${history.length}`}
                </span>
              </button>

              {historyOpen && (
                <div className="border-t border-border-base/60 p-3 space-y-2.5">
                  {isLoadingHistory ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2
                        size={18}
                        className="animate-spin text-accent-green"
                      />
                    </div>
                  ) : (
                    history.map((item) => {
                      const diff = computeDNSDiff(
                        item.old_value,
                        item.new_value,
                      );
                      return (
                        <div
                          key={item.id}
                          className="rounded-lg border border-border-base/70 bg-bg-card p-2.5 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-[11px] text-text-dim font-mono">
                            <RelativeTime value={item.changed_at} />
                            <span>
                              {new Date(item.changed_at).toLocaleString(
                                "es-ES",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </span>
                          </div>

                          <div className="space-y-1 font-mono text-[11px]">
                            {diff.removed.map((v, i) => (
                              <div
                                key={`h-rem-${i}`}
                                className="flex items-center gap-1.5 px-2 py-1 rounded bg-rose-500/10 border border-rose-500/25 text-rose-300 break-all"
                              >
                                <span className="font-bold select-none">−</span>
                                <span>{v}</span>
                              </div>
                            ))}
                            {diff.added.map((v, i) => (
                              <div
                                key={`h-add-${i}`}
                                className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 break-all"
                              >
                                <span className="font-bold select-none">+</span>
                                <span>{v}</span>
                              </div>
                            ))}
                            {diff.removed.length === 0 &&
                              diff.added.length === 0 && (
                                <div className="text-text-dim break-all">
                                  {item.new_value}
                                </div>
                              )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </section>
          )}

          {/* 2E. COLLAPSIBLE PUBLIC RESOLVERS (collapsed by default; open only on disagreement) */}
          <section className="rounded-xl border border-border-base/80 bg-bg-dark/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setResolversOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-bg-card-hover/50 transition-colors cursor-pointer !min-h-0"
            >
              <span className="inline-flex items-center gap-2 font-medium text-text-main">
                {resolversOpen ? (
                  <ChevronDown size={13} className="text-text-dim" />
                ) : (
                  <ChevronRight size={13} className="text-text-dim" />
                )}
                <Server size={13} className="text-text-muted shrink-0" />
                <span>Resolvers consultados</span>
              </span>
              <span className="font-mono text-[11px] text-text-dim">
                {resolverResults.length > 0
                  ? resolversDisagree
                    ? "En desacuerdo"
                    : resolverResults.map((r) => r.resolver).join(", ")
                  : record.resolver || "Sin datos"}
              </span>
            </button>

            {resolversOpen && (
              <div className="border-t border-border-base/60 p-3 space-y-2">
                {resolverResults.length > 0 ? (
                  resolverResults.map((rr, idx) => (
                    <div
                      key={`${rr.resolver}-${idx}`}
                      className="rounded-lg border border-border-base/70 bg-bg-card p-2.5 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                        <span className="inline-flex items-center gap-1.5 text-text-main font-semibold">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              rr.success ? "bg-emerald-400" : "bg-rose-400"
                            }`}
                          />
                          <span>{rr.resolver}</span>
                          {rr.label && (
                            <span className="text-text-dim font-sans font-normal">
                              ({rr.label})
                            </span>
                          )}
                          {idx === 0 && (
                            <span className="text-[10px] font-sans font-normal text-text-dim">
                              · principal
                            </span>
                          )}
                        </span>
                        <span className="text-text-dim tabular-nums">
                          {(rr.latency_ms ?? rr.response_time_ms) != null
                            ? formatDNSLatency(
                                rr.latency_ms ?? rr.response_time_ms,
                              )
                            : "—"}
                          {rr.ttl != null ? ` · TTL ${formatDNSTTL(rr.ttl)}` : ""}
                        </span>
                      </div>

                      {rr.success && rr.values.length > 0 ? (
                        <div className="font-mono text-[11px] text-text-muted break-all">
                          {rr.values.join(", ")}
                        </div>
                      ) : (
                        <div className="font-mono text-[11px] text-rose-400">
                          {rr.error_type || "ERROR"}
                          {rr.error_message ? ` · ${rr.error_message}` : ""}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-[11px] text-text-dim">
                    Resolver registrado:{" "}
                    <span className="font-mono text-text-muted">
                      {record.resolver || "Pendiente de comprobación"}
                    </span>
                    . Ejecuta <strong>Comprobar ahora</strong> para verificar
                    propagación en 1.1.1.1 y 8.8.8.8.
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* 3. SINGLE-LINE FOOTER (no repeated resolver — already in subtitle) */}
        <footer className="shrink-0 border-t border-border-base/80 bg-bg-dark/80 px-5 py-2.5 text-[11px] text-text-dim font-mono">
          Último chequeo{" "}
          <RelativeTime
            value={record.last_scanned_at}
            emptyLabel="nunca"
            className="text-text-muted"
          />{" "}
          · origen cloud
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
