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
  getDNSHealthState,
  getDNSLatencyToneClass,
  getDNSStateLabel,
  parseDNSValues,
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
  onAcceptReference: (record: DNSRecord) => void;
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
  const [historyOpen, setHistoryOpen] = useState(state === "mutation");
  const [resolversOpen, setResolversOpen] = useState(state === "propagating");

  // Reset accordion defaults when switching records
  useEffect(() => {
    const nextState = getDNSHealthState(record);
    setHistoryOpen(nextState === "mutation");
    setResolversOpen(nextState === "propagating");
    setMenuOpen(false);
    setCopiedValues(false);
  }, [record.id]);

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

  const latestDiff = record.latest_change
    ? computeDNSDiff(
        record.latest_change.old_value,
        record.latest_change.new_value,
      )
    : null;

  const expectedDiff =
    state === "mismatch"
      ? computeDNSDiff(expectedValues.join("\n"), values.join("\n"))
      : null;

  const canAcceptReference =
    canEdit && values.length > 0 && record.matches_expected !== true;

  const isTxt = record.record_type === "TXT";
  const hasSpf = isTxt && record.value.includes("v=spf1");
  const hasDmarc = isTxt && record.value.includes("v=DMARC1");

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
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-[2px] animate-in fade-in duration-150"
      onClick={onClose}
    >
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de ${record.record_type} ${record.domain}`}
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-full w-full max-w-[540px] flex-col border-l border-border-base bg-bg-card shadow-2xl animate-in slide-in-from-right duration-200"
      >
        {/* 1. STICKY HEADER */}
        <header className="shrink-0 border-b border-border-base/80 bg-bg-dark/90 px-5 pt-4 pb-3.5 space-y-2.5">
          {/* Row 1: Domain + Status + Nav Arrows + Close */}
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

          {/* Row 2: Technical Subtitle (Registro A · TTL 60 s · resolver 1.1.1.1 · 10 ms) */}
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
                <span className={getDNSLatencyToneClass(record.response_time_ms)}>
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

            {/* Overflow menu ⋯ (solid bg-bg-dark) */}
            {(canEdit || canDelete) && (
              <div ref={menuRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Más acciones del registro"
                  title="Editar o eliminar registro"
                  className={`h-8 w-8 grid place-items-center rounded-full border border-border-base bg-bg-card text-text-muted hover:text-text-main hover:bg-bg-card-hover transition-colors cursor-pointer !min-h-0 !min-w-0 ${
                    menuOpen ? "border-border-accent text-text-main" : ""
                  }`}
                >
                  <MoreHorizontal size={15} />
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-9 z-40 w-48 rounded-xl border border-border-accent/70 bg-bg-dark p-1 shadow-2xl text-xs animate-in fade-in zoom-in-95 duration-100"
                  >
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
                        <Pencil
                          size={13}
                          className="text-text-muted shrink-0"
                        />
                        <span>Editar registro</span>
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
            )}
          </div>
        </header>

        {/* 2. SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5 text-xs">
          {/* Paused linked target suggestion banner */}
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

          {/* Contextual Error / Mismatch / Propagation / Mutation Banner */}
          {state === "error" && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-rose-300">
                <AlertTriangle size={14} className="shrink-0" />
                <span>Error de resolución · {stateLabel}</span>
              </div>
              {record.last_error_message && (
                <p className="text-rose-200/90 font-mono text-[11px] break-words">
                  {record.last_error_message}
                </p>
              )}
              {values.length > 0 && (
                <p className="text-text-dim text-[11px]">
                  Se conserva debajo el último valor válido obtenido anteriormente.
                </p>
              )}
            </div>
          )}

          {state === "mismatch" && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-semibold text-rose-300">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>Fuera de la referencia esperada</span>
                </div>
                {canAcceptReference && (
                  <button
                    type="button"
                    disabled={isAcceptingRef}
                    onClick={() => onAcceptReference(record)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-bg-dark border border-border-accent text-text-main hover:border-accent-green hover:text-accent-green font-semibold disabled:opacity-50 cursor-pointer !min-h-0"
                  >
                    <CheckCircle2 size={12} />
                    <span>Aceptar como referencia</span>
                  </button>
                )}
              </div>
              {expectedDiff && (
                <div className="space-y-1 font-mono text-[11px]">
                  {expectedDiff.removed.map((v, i) => (
                    <div
                      key={`exp-rem-${i}`}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-500/15 text-rose-300 break-all"
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
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-300 break-all"
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
            </div>
          )}

          {state === "propagating" && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                <AlertTriangle size={14} className="shrink-0" />
                <span>Propagación en curso entre resolvers públicos</span>
              </div>
              <p className="text-amber-200/90 text-[11px]">
                Los resolvers consultados devolvieron conjuntos de respuestas
                distintos. Revisa el detalle en Resolvers consultados.
              </p>
            </div>
          )}

          {state === "mutation" && latestDiff && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>Cambio detectado</span>
                  {record.latest_change?.changed_at && (
                    <RelativeTime
                      value={record.latest_change.changed_at}
                      className="font-mono text-[11px] text-amber-200/80 font-normal"
                    />
                  )}
                </div>
                {canAcceptReference && (
                  <button
                    type="button"
                    disabled={isAcceptingRef}
                    onClick={() => onAcceptReference(record)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-bg-dark border border-border-accent text-text-main hover:border-accent-green hover:text-accent-green font-semibold disabled:opacity-50 cursor-pointer !min-h-0"
                  >
                    <CheckCircle2 size={12} />
                    <span>Aceptar como referencia</span>
                  </button>
                )}
              </div>

              <div className="space-y-1 font-mono text-[11px]">
                {latestDiff.removed.map((v, i) => (
                  <div
                    key={`mut-rem-${i}`}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-500/15 text-rose-300 break-all"
                  >
                    <span className="font-bold select-none">−</span>
                    <span>{v}</span>
                  </div>
                ))}
                {latestDiff.added.map((v, i) => (
                  <div
                    key={`mut-add-${i}`}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-300 break-all"
                  >
                    <span className="font-bold select-none">+</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2A. RESOLVED VALUES CARD (immediately visible at top) */}
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

              {/* Stability line (strictly neutral gray, NEVER amber for stable!) */}
              <div className="pt-1.5 flex items-center justify-between text-[11px] text-text-dim">
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

          {/* 2B. REFERENCE BASELINE ROW */}
          <section className="rounded-xl border border-border-base/80 bg-bg-dark/60 p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-text-main">
                Referencia esperada
              </span>
              {expectedValues.length > 0 ? (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                    record.matches_expected
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/35"
                  }`}
                >
                  {record.matches_expected ? "Coincide" : "No coincide"}
                </span>
              ) : (
                <span className="text-text-dim text-[11px]">Sin configurar</span>
              )}
            </div>

            {expectedValues.length > 0 ? (
              <div className="space-y-1">
                {expectedValues.map((ev, i) => (
                  <div
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-bg-card border border-border-base/50 font-mono text-[11px] text-text-muted break-all"
                  >
                    {ev}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] text-text-dim">
                  Fija el valor actual como referencia para recibir alertas solo
                  cuando cambie respecto a lo esperado.
                </span>
                {canAcceptReference && (
                  <button
                    type="button"
                    disabled={isAcceptingRef}
                    onClick={() => onAcceptReference(record)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border-accent bg-bg-card text-text-main hover:border-accent-green hover:text-accent-green font-semibold text-[11px] disabled:opacity-50 transition-colors cursor-pointer !min-h-0"
                  >
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    <span>Aceptar como referencia</span>
                  </button>
                )}
              </div>
            )}
          </section>

          {/* 2C. SPF / DMARC SECURITY CARD (inline for TXT records) */}
          {(hasSpf || hasDmarc) && (
            <section className="rounded-xl border border-border-base/80 bg-bg-dark/60 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-semibold text-text-main">
                  <Shield size={14} className="text-emerald-400 shrink-0" />
                  <span>
                    {hasSpf ? "Política SPF detectada" : "Política DMARC detectada"}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-bg-card border border-border-base font-mono text-[10px] text-emerald-400">
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

          {/* 2D. COLLAPSIBLE CHANGE HISTORY */}
          <section className="rounded-xl border border-border-base/80 bg-bg-dark/60 overflow-hidden">
            {history.length === 0 && !isLoadingHistory ? (
              <div className="flex items-center justify-between px-3.5 py-2.5 text-text-dim">
                <span className="inline-flex items-center gap-2 font-medium text-text-muted">
                  <History size={13} className="text-text-dim shrink-0" />
                  <span>Historial de cambios</span>
                </span>
                <span className="text-[11px]">
                  Sin cambios desde su creación
                </span>
              </div>
            ) : (
              <>
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
                                  <span className="font-bold select-none">
                                    −
                                  </span>
                                  <span>{v}</span>
                                </div>
                              ))}
                              {diff.added.map((v, i) => (
                                <div
                                  key={`h-add-${i}`}
                                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 break-all"
                                >
                                  <span className="font-bold select-none">
                                    +
                                  </span>
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
              </>
            )}
          </section>

          {/* 2E. COLLAPSIBLE PUBLIC RESOLVERS */}
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
                  ? `${resolverResults.length} públicos`
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

        {/* 3. SINGLE-LINE FOOTER (matching Uptime & SSL) */}
        <footer className="shrink-0 border-t border-border-base/80 bg-bg-dark/80 px-5 py-2.5 text-[11px] text-text-dim font-mono flex items-center justify-between">
          <span>
            Último chequeo{" "}
            <RelativeTime
              value={record.last_scanned_at}
              emptyLabel="nunca"
              className="text-text-muted"
            />{" "}
            · origen cloud
          </span>
          {record.resolver && (
            <span className="text-text-dim">via {record.resolver}</span>
          )}
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
