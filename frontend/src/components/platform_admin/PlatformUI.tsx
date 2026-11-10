import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { ChevronDown, MoreHorizontal, X } from "lucide-react";

export type ActionTone = "primary" | "secondary" | "tertiary" | "danger";
export function ActionButton({
  tone = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ActionTone }) {
  return (
    <button
      type="button"
      {...props}
      className={`platform-action platform-action-${tone} ${className}`}
    />
  );
}

/** Native disclosure: Tab traverses actions; Escape/outside click restores trigger focus. */
export function ActionMenu({
  label = "Más acciones",
  accessibleLabel,
  compact = false,
  children,
}: {
  label?: string;
  accessibleLabel?: string;
  compact?: boolean;
  children: ReactNode;
}) {
  const root = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const id = useId();
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (root.current?.open && !root.current.contains(event.target as Node))
        root.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return (
    <details
      ref={root}
      className="platform-action-menu"
      onKeyDown={(event) => {
        if (event.key === "Escape" && root.current?.open) {
          event.stopPropagation();
          root.current.open = false;
          trigger.current?.focus();
        }
      }}
    >
      <summary
        ref={trigger}
        aria-label={accessibleLabel || label}
        aria-controls={id}
        title={accessibleLabel || label}
        className={
          "platform-action platform-action-tertiary cursor-pointer list-none " +
          (compact ? "!min-w-11 !w-11 !px-0" : "")
        }
      >
        {compact ? (
          <MoreHorizontal size={20} aria-hidden="true" />
        ) : (
          <>
            {label}
            <ChevronDown size={15} aria-hidden="true" />
          </>
        )}
      </summary>
      <div
        id={id}
        className="platform-action-list"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button") && root.current) {
            root.current.open = false;
            trigger.current?.focus();
          }
        }}
      >
        {children}
      </div>
    </details>
  );
}

export function FilterChips({
  items,
  onClear,
}: {
  items: { id: string; label: string; remove: () => void }[];
  onClear: () => void;
}) {
  if (!items.length) return null;
  return (
    <div
      aria-label="Filtros aplicados"
      className="flex flex-wrap items-center gap-2 text-xs"
    >
      {items.map((item) => (
        <button
          key={item.id}
          className="platform-filter-chip"
          onClick={item.remove}
          aria-label={`Quitar filtro: ${item.label}`}
        >
          {item.label}
          <X size={13} aria-hidden="true" />
        </button>
      ))}
      <ActionButton tone="tertiary" onClick={onClear}>
        Limpiar filtros
      </ActionButton>
    </div>
  );
}

export function InlineNotice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss.current(), 10000);
    return () => clearTimeout(timer);
  }, [message]);
  if (!message) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-xl border border-border-base bg-bg-card px-4 py-2 text-sm"
    >
      <span>{message}</span>
      <ActionButton
        tone="tertiary"
        aria-label="Descartar mensaje"
        onClick={onDismiss}
      >
        <X size={16} />
      </ActionButton>
    </div>
  );
}
