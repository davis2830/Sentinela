import type { FormEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  ChevronDown,
  ChevronRight,
  Loader2,
  X,
  Zap,
} from "lucide-react";
import AdminButton from "../AdminButton";
import ConfigurationDiagnosticNotice from "../ConfigurationDiagnosticNotice";
import ModalSurface from "../ModalSurface";
import type { NotificationDestinationSummary } from "../../../hooks/useOrgContextForAddModal";

interface ResourceAddModalProps {
  title: string;
  icon: ReactNode;
  submitLabel: string;
  submitCapability: string;
  testCapability?: string;
  testLabel?: string;
  testingLabel?: string;
  testHint?: string;
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
  /** Notification destinations for the inline "Nadie será notificado" / destination strip */
  destinations?: NotificationDestinationSummary[];
  isLoadingDestinations?: boolean;
  /** Optional collapsible "Más opciones" section */
  moreOptionsOpen?: boolean;
  onToggleMoreOptions?: () => void;
  moreOptionsSummary?: string;
  moreOptionsContent?: ReactNode;
  /** Main body (primary input, test result line, link/dependency notices) */
  children: ReactNode;
  focusKey?: string | number;
}

/**
 * Shared base modal for creating/editing connectivity resources (SSL, DNS, Domains).
 * Guarantees consistent layout, keyboard focus on the primary input (no outer focus ring),
 * secondary bordered Test button, notification visibility, and weighted footer actions.
 */
export default function ResourceAddModal({
  title,
  icon,
  submitLabel,
  submitCapability,
  testCapability,
  testLabel = "Probar",
  testingLabel = "Probando...",
  testHint,
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
  isLoadingDestinations = false,
  moreOptionsOpen = false,
  onToggleMoreOptions,
  moreOptionsSummary,
  moreOptionsContent,
  children,
  focusKey,
}: ResourceAddModalProps) {
  if (typeof document === "undefined") return null;

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
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-border-base/80">
          <h2 className="text-base font-bold text-text-main flex items-center gap-2 font-sans">
            {icon}
            <span>{title}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Cerrar ${title}`}
            className="h-7 w-7 grid place-items-center rounded-lg text-text-muted hover:text-text-main hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
          >
            <X size={17} />
          </button>
        </div>

        {/* Form Body + Footer */}
        <form
          onSubmit={onSubmit}
          className="flex flex-col flex-1 min-h-0"
          noValidate
        >
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5 text-xs">
            {children}

            {/* Diagnostic hint / cooldown notice */}
            {onTest && (testHint || diagnostic?.notice) && (
              <ConfigurationDiagnosticNotice
                notice={diagnostic?.notice || ""}
                remaining={diagnostic?.remaining || 0}
                hint={testHint}
              />
            )}

            {/* Notification destination line (so user knows upfront who will be alerted) */}
            {destinations !== undefined && !isLoadingDestinations && (
              destinations.length === 0 ? (
                <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-amber-200 font-medium">
                    <AlertTriangle
                      size={13}
                      className="text-amber-400 shrink-0"
                    />
                    <span>Nadie será notificado</span>
                  </span>
                  <Link
                    to="/notifications"
                    onClick={onClose}
                    className="inline-flex items-center gap-1 text-accent-green hover:underline font-semibold whitespace-nowrap"
                  >
                    <span>Agregar destino</span>
                    <ArrowRight size={12} />
                  </Link>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 text-[11px] text-text-dim px-0.5">
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <Bell size={12} className="text-text-muted shrink-0" />
                    <span className="truncate">
                      Avisos a:{" "}
                      <strong className="text-text-muted font-medium">
                        {destinations.map((d) => d.name).join(", ")}
                      </strong>
                    </span>
                  </span>
                  <Link
                    to="/notifications"
                    onClick={onClose}
                    className="text-text-dim hover:text-accent-green shrink-0"
                  >
                    Editar
                  </Link>
                </div>
              )
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
                    <span className="text-[11px] text-text-dim truncate max-w-[200px]">
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

          {/* Footer: [Probar] on left, subtle Cancelar + optional +Otro + primary Agregar on right */}
          <div className="shrink-0 flex items-center justify-between gap-2 px-5 py-3.5 border-t border-border-base/80 bg-bg-dark/60 flex-wrap">
            <div>
              {onTest && testCapability && (
                <AdminButton
                  capability={testCapability}
                  type="button"
                  onClick={onTest}
                  disabled={!canTest || isTesting}
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

              {showAddAnother && onAddAnother && (
                <AdminButton
                  capability={submitCapability}
                  type="button"
                  disabled={!canSubmit || isSubmitting}
                  onClick={onAddAnother}
                  title="Guardar y limpiar el formulario para agregar otro"
                  className="h-9 px-3 rounded-full border border-border-base bg-bg-card text-xs font-medium text-text-main hover:border-accent-green/60 hover:text-accent-green disabled:opacity-40 transition-colors cursor-pointer !min-h-0"
                >
                  + Otro
                </AdminButton>
              )}

              <AdminButton
                capability={submitCapability}
                type="submit"
                disabled={!canSubmit || isSubmitting}
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
            </div>
          </div>
        </form>
      </ModalSurface>
    </div>,
    document.body,
  );
}
