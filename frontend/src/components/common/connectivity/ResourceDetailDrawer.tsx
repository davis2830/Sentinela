import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Maximize2, Minimize2, X } from "lucide-react";
import { useDialogFocus } from "../../../hooks/useDialogFocus";
import StatusPill, {
  StatusShapeIcon,
  type StatusIconShape,
  type StatusTone,
} from "./StatusPill";

export interface ResourceDetailDrawerProps {
  /** Unique identifier of the currently selected resource (resets focus on change) */
  focusKey: string;
  /** Accessible label for the dialog */
  ariaLabel: string;
  /** Main title shown in the sticky header */
  title: string;
  /** Optional small badge next to the title */
  titleBadge?: ReactNode;
  /** Health status pill metadata */
  status: {
    label: string;
    tone: StatusTone;
    shape: StatusIconShape;
    iconClassName?: string;
  };
  /** Prev/Next keyboard & button navigation */
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  prevLabel?: string;
  nextLabel?: string;
  /** Optional expand/collapse toggle (540px <-> 700px) */
  expandable?: boolean;
  /** Optional secondary header rows (subtitle, quick actions bar, etc.) */
  headerExtra?: ReactNode;
  /** Main scrollable body */
  children: ReactNode;
  /** Optional sticky footer */
  footer?: ReactNode;
  /** Called when pressing Escape; return true if handled by an inner popover/menu */
  onEscapeIntercept?: () => boolean;
  onClose: () => void;
}

/**
 * Shared non-modal slide-over detail drawer for Sentinel connectivity modules
 * (Uptime, Senti9, SSL, DNS, Domains, API Checks, Security Headers).
 * - Renders via document.body Portal without dimming/blocking the table behind it.
 * - Supports Escape to close, ArrowUp/ArrowDown to step through rows, and 540px/700px width toggle.
 */
export default function ResourceDetailDrawer({
  focusKey,
  ariaLabel,
  title,
  titleBadge,
  status,
  hasPrev = false,
  hasNext = false,
  onPrev,
  onNext,
  prevLabel = "Elemento anterior",
  nextLabel = "Siguiente elemento",
  expandable = true,
  headerExtra,
  children,
  footer,
  onEscapeIntercept,
  onClose,
}: ResourceDetailDrawerProps) {
  const drawerRef = useDialogFocus(true, focusKey);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (onEscapeIntercept?.()) return;
        onClose();
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if (e.key === "ArrowUp" && hasPrev && onPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowDown" && hasNext && onNext) {
        e.preventDefault();
        onNext();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hasPrev, hasNext, onPrev, onNext, onEscapeIntercept, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-40 flex justify-end">
      <aside
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="false"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
        className={`pointer-events-auto relative flex h-full w-full flex-col border-l border-border-accent/70 bg-bg-card shadow-[-12px_0_40px_rgba(0,0,0,0.55)] animate-in slide-in-from-right duration-200 transition-[max-width] focus:outline-none ${
          expanded ? "max-w-[700px]" : "max-w-[540px]"
        }`}
      >
        {/* 1. STICKY HEADER */}
        <header className="shrink-0 border-b border-border-base/80 bg-bg-dark/90 px-5 pt-4 pb-3.5 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <StatusShapeIcon
                shape={status.shape}
                size={16}
                className={`shrink-0 ${status.iconClassName || ""}`}
              />
              <h2
                className="text-base font-bold text-text-main truncate"
                title={title}
              >
                {title}
              </h2>
              {titleBadge}
              <StatusPill
                tone={status.tone}
                shape={status.shape}
                label={status.label}
                size="xs"
              />
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {onPrev && (
                <button
                  type="button"
                  disabled={!hasPrev}
                  onClick={(e) => {
                    if (e.detail > 0) e.currentTarget.blur();
                    onPrev();
                  }}
                  title={`${prevLabel} (↑)`}
                  aria-label={prevLabel}
                  className="h-7 w-7 grid place-items-center rounded-lg text-text-dim hover:text-text-main hover:bg-white/10 disabled:opacity-30 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/60 !min-h-0 !min-w-0"
                >
                  <ChevronUp size={15} />
                </button>
              )}
              {onNext && (
                <button
                  type="button"
                  disabled={!hasNext}
                  onClick={(e) => {
                    if (e.detail > 0) e.currentTarget.blur();
                    onNext();
                  }}
                  title={`${nextLabel} (↓)`}
                  aria-label={nextLabel}
                  className="h-7 w-7 grid place-items-center rounded-lg text-text-dim hover:text-text-main hover:bg-white/10 disabled:opacity-30 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/60 !min-h-0 !min-w-0"
                >
                  <ChevronDown size={15} />
                </button>
              )}
              {expandable && (
                <button
                  type="button"
                  onClick={(e) => {
                    if (e.detail > 0) e.currentTarget.blur();
                    setExpanded((prev) => !prev);
                  }}
                  title={expanded ? "Contraer panel" : "Expandir panel"}
                  aria-label={expanded ? "Contraer panel" : "Expandir panel"}
                  className="hidden sm:grid h-7 w-7 place-items-center rounded-lg text-text-dim hover:text-text-main hover:bg-white/10 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/60 !min-h-0 !min-w-0"
                >
                  {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  if (e.detail > 0) e.currentTarget.blur();
                  onClose();
                }}
                title="Cerrar panel (Esc)"
                aria-label="Cerrar panel"
                className="h-7 w-7 grid place-items-center rounded-lg text-text-dim hover:text-text-main hover:bg-white/10 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/60 !min-h-0 !min-w-0"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {headerExtra}
        </header>

        {/* 2. SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {children}
        </div>

        {/* 3. STICKY FOOTER */}
        {footer && (
          <footer className="shrink-0 border-t border-border-base/80 bg-bg-dark/80 px-5 py-2.5 text-[11px] text-text-dim font-mono">
            {footer}
          </footer>
        )}
      </aside>
    </div>,
    document.body,
  );
}
