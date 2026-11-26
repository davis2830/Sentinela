import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  X,
  Zap,
} from "lucide-react";
import AdminButton from "../AdminButton";
import ConfigurationDiagnosticNotice from "../ConfigurationDiagnosticNotice";
import ModalSurface from "../ModalSurface";
import type {
  NotificationDestinationSummary,
  QuickCreateDestinationInput,
} from "../../../hooks/useOrgContextForAddModal";

interface ResourceAddModalProps {
  title: string;
  icon: ReactNode;
  headerAction?: ReactNode;
  submitLabel: string;
  submitCapability: string;
  disabledReason?: string;
  testCapability?: string;
  testLabel?: string;
  testingLabel?: string;
  testHint?: string;
  /** Result rendered in the exact same slot as testHint (replacing the idle hint once tested) */
  testResultSlot?: ReactNode;
  canTest?: boolean;
  isTesting?: boolean;
  onTest?: () => void;
  diagnostic?: { notice: string; remaining: number };
  canSubmit: boolean;
  isSubmitting: boolean;
  showAddAnother?: boolean;
  onAddAnother?: () => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
  /** Active notification destinations + inline drawer to add/enable without leaving modal */
  destinations?: NotificationDestinationSummary[];
  allChannels?: NotificationDestinationSummary[];
  isLoadingDestinations?: boolean;
  onQuickCreateDestination?: (
    input: QuickCreateDestinationInput,
  ) => Promise<unknown>;
  isCreatingDestination?: boolean;
  onToggleChannelEnabled?: (args: {
    id: string;
    enabled: boolean;
  }) => Promise<unknown>;
  isTogglingChannel?: boolean;
  /** Optional collapsible "Más opciones" section */
  moreOptionsOpen?: boolean;
  onToggleMoreOptions?: () => void;
  moreOptionsSummary?: string;
  moreOptionsContent?: ReactNode;
  /** Main body (primary input, duplicate/internal notices, link/dependency notices) */
  children: ReactNode;
  focusKey?: string | number;
}

/**
 * Shared base modal for creating/editing connectivity resources (SSL, DNS, Domains).
 * - Single shared slot for test hint -> live test result.
 * - Soft-bordered inline destination strip with in-place channel activation / quick-create
 *   so users never lose unsaved form input.
 * - Clean 3-action footer: [Probar] on left, subtle Cancelar + Split [Agregar | v] on right.
 */
export default function ResourceAddModal({
  title,
  icon,
  headerAction,
  submitLabel,
  submitCapability,
  disabledReason = "Completa el campo requerido",
  testCapability,
  testLabel = "Probar",
  testingLabel = "Probando...",
  testHint,
  testResultSlot,
  canTest = false,
  isTesting = false,
  onTest,
  diagnostic,
  canSubmit,
  isSubmitting,
  showAddAnother = false,
  onAddAnother,
  onSubmit,
  onClose,
  destinations,
  allChannels = [],
  isLoadingDestinations = false,
  onQuickCreateDestination,
  isCreatingDestination = false,
  onToggleChannelEnabled,
  isTogglingChannel = false,
  moreOptionsOpen = false,
  onToggleMoreOptions,
  moreOptionsSummary,
  moreOptionsContent,
  children,
  focusKey,
}: ResourceAddModalProps) {
  const [splitMenuOpen, setSplitMenuOpen] = useState(false);
  const splitRef = useRef<HTMLDivElement | null>(null);

  // Inline destination picker / quick creator (never navigates away and loses form input)
  const [destPanelOpen, setDestPanelOpen] = useState(false);
  const [quickType, setQuickType] = useState<"email" | "webhook">("email");
  const [quickName, setQuickName] = useState("");
  const [quickTarget, setQuickTarget] = useState("");
  const [quickError, setQuickError] = useState("");

  useEffect(() => {
    if (!splitMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (splitRef.current && !splitRef.current.contains(e.target as Node)) {
        setSplitMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSplitMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [splitMenuOpen]);

  const handleSaveQuickDestination = async () => {
    setQuickError("");
    const target = quickTarget.trim();
    if (!target) {
      setQuickError(
        quickType === "email"
          ? "Ingresa un correo válido."
          : "Ingresa una URL de webhook.",
      );
      return;
    }
    if (quickType === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      setQuickError("Formato de correo inválido.");
      return;
    }
    if (quickType === "webhook" && !/^https?:\/\//i.test(target)) {
      setQuickError("La URL debe empezar con https:// o http://.");
      return;
    }
    if (!onQuickCreateDestination) return;
    try {
      await onQuickCreateDestination({
        name: quickName.trim() || target,
        channel_type: quickType,
        targetValue: target,
      });
      setQuickName("");
      setQuickTarget("");
      setDestPanelOpen(false);
    } catch {
      setQuickError("No se pudo guardar el destino. Revisa los permisos o intenta luego.");
    }
  };

  if (typeof document === "undefined") return null;

  const disabledChannels = allChannels.filter((c) => !c.enabled);

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <ModalSurface
        label={title}
        onClose={onClose}
        focusKey={focusKey}
        className="bg-bg-card border border-border-base rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-5 py-4 border-b border-border-base/80">
          <h2 className="text-base font-bold text-text-main flex items-center gap-2 font-sans min-w-0">
            {icon}
            <span className="truncate">{title}</span>
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            {headerAction}
            <button
              type="button"
              onClick={onClose}
              aria-label={`Cerrar ${title}`}
              className="h-7 w-7 grid place-items-center rounded-lg text-text-muted hover:text-text-main hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Form Body + Footer */}
        <form
          onSubmit={onSubmit}
          className="flex flex-col flex-1 min-h-0"
          noValidate
        >
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5 text-xs">
            {children}

            {/* Unified Test Slot: idle 1-line hint before testing -> replaced by live test result */}
            {onTest && (
              <div className="space-y-1.5">
                {testResultSlot ? (
                  testResultSlot
                ) : (
                  testHint && (
                    <p className="text-[11px] text-text-dim px-0.5">
                      {testHint}
                    </p>
                  )
                )}
                {diagnostic?.notice && (
                  <ConfigurationDiagnosticNotice
                    notice={diagnostic.notice}
                    remaining={diagnostic.remaining}
                    hint=""
                  />
                )}
              </div>
            )}

            {/* Notification destination line (subtle border when empty; inline selector/creator so user never leaves modal) */}
            {destinations !== undefined && !isLoadingDestinations && (
              <div className="space-y-2">
                {destinations.length === 0 ? (
                  <div className="rounded-xl border border-amber-500/35 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-amber-300/90 font-medium">
                      <AlertTriangle
                        size={13}
                        className="text-amber-400 shrink-0"
                      />
                      <span>Nadie será notificado</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setDestPanelOpen((prev) => !prev)}
                      className="inline-flex items-center gap-1 text-accent-green hover:underline font-semibold whitespace-nowrap cursor-pointer !min-h-0"
                    >
                      <span>{destPanelOpen ? "Cerrar" : "Agregar destino"}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 text-[11px] text-text-dim px-0.5">
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <Bell size={12} className="text-text-muted shrink-0" />
                      <span className="truncate">
                        Se avisará a{" "}
                        <strong className="text-text-muted font-medium">
                          {destinations.map((d) => d.name).join(", ")}
                        </strong>
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setDestPanelOpen((prev) => !prev)}
                      className="text-text-dim hover:text-accent-green shrink-0 cursor-pointer !min-h-0"
                    >
                      {destPanelOpen ? "Cerrar" : "Cambiar"}
                    </button>
                  </div>
                )}

                {/* In-modal destination selector & quick creator (zero lost form data) */}
                {destPanelOpen && (
                  <div className="rounded-xl border border-border-accent/70 bg-bg-dark p-3 space-y-2.5 animate-in fade-in duration-100">
                    {disabledChannels.length > 0 && onToggleChannelEnabled && (
                      <div className="space-y-1.5">
                        <span className="block text-[11px] font-medium text-text-muted">
                          Activar canal existente
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {disabledChannels.map((ch) => (
                            <button
                              key={ch.id}
                              type="button"
                              disabled={isTogglingChannel}
                              onClick={() =>
                                void onToggleChannelEnabled({
                                  id: ch.id,
                                  enabled: true,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border-base bg-bg-card text-[11px] text-text-main hover:border-accent-green hover:text-accent-green disabled:opacity-50 cursor-pointer !min-h-0"
                            >
                              <Plus size={11} />
                              <span>{ch.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {onQuickCreateDestination && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-text-muted">
                            Destino rápido
                          </span>
                          <div className="inline-flex rounded-lg border border-border-base bg-bg-card p-0.5 text-[10px]">
                            <button
                              type="button"
                              onClick={() => setQuickType("email")}
                              className={`px-2 py-0.5 rounded-md cursor-pointer !min-h-0 ${
                                quickType === "email"
                                  ? "bg-accent-green/20 text-accent-green font-semibold"
                                  : "text-text-dim hover:text-text-main"
                              }`}
                            >
                              Correo
                            </button>
                            <button
                              type="button"
                              onClick={() => setQuickType("webhook")}
                              className={`px-2 py-0.5 rounded-md cursor-pointer !min-h-0 ${
                                quickType === "webhook"
                                  ? "bg-accent-green/20 text-accent-green font-semibold"
                                  : "text-text-dim hover:text-text-main"
                              }`}
                            >
                              Webhook
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5">
                          <input
                            type="text"
                            placeholder="Nombre (ej. Alertas)"
                            value={quickName}
                            onChange={(e) => setQuickName(e.target.value)}
                            className="sm:col-span-2 bg-bg-card border border-border-base rounded-lg px-2.5 py-1.5 text-[11px] text-text-main placeholder:text-text-dim/45 focus:outline-none focus:border-accent-green"
                          />
                          <input
                            type={quickType === "email" ? "email" : "url"}
                            placeholder={
                              quickType === "email"
                                ? "ops@empresa.com"
                                : "https://hooks.slack.com/..."
                            }
                            value={quickTarget}
                            onChange={(e) => {
                              setQuickTarget(e.target.value);
                              setQuickError("");
                            }}
                            className="sm:col-span-3 bg-bg-card border border-border-base rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-text-main placeholder:text-text-dim/45 focus:outline-none focus:border-accent-green"
                          />
                        </div>

                        {quickError && (
                          <p className="text-[11px] text-rose-400">
                            {quickError}
                          </p>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <a
                            href="/notifications"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-text-dim hover:text-accent-green"
                          >
                            <span>Slack, Telegram o Teams</span>
                            <ArrowUpRight size={11} />
                          </a>
                          <button
                            type="button"
                            disabled={isCreatingDestination || !quickTarget.trim()}
                            onClick={() => void handleSaveQuickDestination()}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent-green text-black font-semibold text-[11px] hover:bg-accent-green/90 disabled:opacity-40 cursor-pointer !min-h-0"
                          >
                            {isCreatingDestination ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <Check size={11} />
                            )}
                            <span>Guardar destino</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Optional collapsible "Más opciones" */}
            {moreOptionsContent && onToggleMoreOptions && (
              <div className="rounded-xl border border-border-base/80 bg-bg-dark/40 overflow-hidden">
                <button
                  type="button"
                  onClick={onToggleMoreOptions}
                  aria-expanded={moreOptionsOpen}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-text-muted hover:text-text-main hover:bg-bg-card-hover/40 transition-colors cursor-pointer !min-h-0"
                >
                  <span className="inline-flex items-center gap-1.5">
                    {moreOptionsOpen ? (
                      <ChevronDown size={13} className="text-text-dim" />
                    ) : (
                      <ChevronRight size={13} className="text-text-dim" />
                    )}
                    <span>Más opciones</span>
                  </span>
                  {moreOptionsSummary && (
                    <span className="text-[11px] text-text-dim truncate max-w-[210px]">
                      {moreOptionsSummary}
                    </span>
                  )}
                </button>
                {moreOptionsOpen && (
                  <div className="border-t border-border-base/60 p-3 space-y-3">
                    {moreOptionsContent}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer: [Probar] on left · subtle Cancelar + Split [Agregar | v] on right */}
          <div className="shrink-0 flex items-center justify-between gap-2 px-5 py-3.5 border-t border-border-base/80 bg-bg-dark/60 flex-wrap">
            <div>
              {onTest && testCapability && (
                <AdminButton
                  capability={testCapability}
                  type="button"
                  onClick={onTest}
                  disabled={!canTest || isTesting}
                  title={!canTest ? disabledReason : testHint || testLabel}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-border-accent bg-bg-card text-xs font-semibold text-text-main hover:border-accent-green hover:text-accent-green disabled:opacity-40 disabled:hover:border-border-accent disabled:hover:text-text-main transition-colors cursor-pointer !min-h-0"
                >
                  {isTesting ? (
                    <>
                      <Loader2
                        size={13}
                        className="animate-spin text-accent-green shrink-0"
                      />
                      <span>{testingLabel}</span>
                    </>
                  ) : (
                    <>
                      <Zap size={13} className="text-amber-400 shrink-0" />
                      <span>{testLabel}</span>
                    </>
                  )}
                </AdminButton>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-3 rounded-full text-xs font-medium text-text-muted hover:text-text-main hover:bg-white/5 transition-colors cursor-pointer !min-h-0"
              >
                Cancelar
              </button>

              {showAddAnother && onAddAnother ? (
                <div ref={splitRef} className="relative inline-flex items-stretch">
                  <AdminButton
                    capability={submitCapability}
                    type="submit"
                    disabled={!canSubmit || isSubmitting}
                    title={!canSubmit ? disabledReason : submitLabel}
                    className="h-9 pl-5 pr-3.5 rounded-l-full bg-accent-green text-black font-semibold text-xs hover:bg-accent-green/90 disabled:opacity-40 transition-all inline-flex items-center justify-center gap-1.5 shadow-sm shadow-accent-green/15 cursor-pointer !min-h-0"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin shrink-0" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <span>{submitLabel}</span>
                    )}
                  </AdminButton>
                  <button
                    type="button"
                    disabled={!canSubmit || isSubmitting}
                    aria-haspopup="menu"
                    aria-expanded={splitMenuOpen}
                    aria-label="Más opciones al guardar"
                    title={!canSubmit ? disabledReason : "Agregar y crear otro"}
                    onClick={() => setSplitMenuOpen((prev) => !prev)}
                    className="h-9 px-2.5 rounded-r-full bg-accent-green border-l border-black/20 text-black hover:bg-accent-green/90 disabled:opacity-40 transition-all inline-flex items-center justify-center cursor-pointer !min-h-0 !min-w-0"
                  >
                    <ChevronDown size={14} />
                  </button>

                  {splitMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 bottom-11 z-40 w-48 rounded-xl border border-border-accent/70 bg-bg-dark p-1 shadow-2xl text-xs animate-in fade-in zoom-in-95 duration-100"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setSplitMenuOpen(false);
                          onAddAnother();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-text-main hover:bg-bg-card-hover cursor-pointer !min-h-0"
                      >
                        <Plus size={13} className="text-accent-green shrink-0" />
                        <span>Agregar y crear otro</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <AdminButton
                  capability={submitCapability}
                  type="submit"
                  disabled={!canSubmit || isSubmitting}
                  title={!canSubmit ? disabledReason : submitLabel}
                  className="h-9 px-5 rounded-full bg-accent-green text-black font-semibold text-xs hover:bg-accent-green/90 disabled:opacity-40 transition-all inline-flex items-center justify-center gap-1.5 shadow-sm shadow-accent-green/15 cursor-pointer !min-h-0"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin shrink-0" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>{submitLabel}</span>
                  )}
                </AdminButton>
              )}
            </div>
          </div>
        </form>
      </ModalSurface>
    </div>,
    document.body,
  );
}
