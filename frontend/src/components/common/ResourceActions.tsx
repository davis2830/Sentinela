import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { hasCapability, type Capability } from "../../hooks/useCapability";
import { useAuthStore } from "../../store/authStore";

export interface ResourceAction {
  label: string;
  icon?: ReactNode;
  capability?: Capability;
  danger?: boolean;
  disabled?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

function menuPosition(trigger: HTMLElement, menu: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  const panel = menu.getBoundingClientRect();
  return {
    left: Math.max(
      8,
      Math.min(rect.right - panel.width, window.innerWidth - panel.width - 8),
    ),
    top:
      rect.bottom + panel.height + 8 <= window.innerHeight
        ? rect.bottom + 6
        : Math.max(8, rect.top - panel.height - 6),
  };
}

/** Portalled to avoid clipped menus inside horizontally scrolling tables. */
export default function ResourceActions({
  label,
  actions,
}: {
  label: string;
  actions: ResourceAction[];
}) {
  const user = useAuthStore((state) => state.user);
  const allowed = actions.filter(
    (action) => !action.capability || hasCapability(user, action.capability),
  );
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  };
  useLayoutEffect(() => {
    if (!open || !trigger.current || !menu.current) return;
    setPosition(menuPosition(trigger.current, menu.current));
    (
      menu.current.querySelector<HTMLButtonElement>("button:not(:disabled)") ||
      menu.current
    ).focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        !menu.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    const reposition = (event: Event) => {
      if (
        menu.current &&
        trigger.current &&
        !menu.current.contains(event.target as Node)
      ) {
        setPosition(menuPosition(trigger.current, menu.current));
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);
  if (!allowed.length) return null;
  return (
    <div
      className="inline-flex shrink-0"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="group grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-transparent p-0 text-text-dim"
      >
        <span
          aria-hidden="true"
          className="grid h-8 w-8 place-items-center rounded-lg transition-colors group-hover:bg-bg-card-hover group-hover:text-text-main"
        >
          <MoreHorizontal size={18} />
        </span>
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="menu"
            tabIndex={-1}
            aria-label={label}
            className="fixed z-[100] w-60 max-w-[calc(100vw-16px)] rounded-xl border border-border-accent bg-bg-card p-1.5 shadow-2xl"
            style={position}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node))
                setOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                close(true);
              } else if (event.key === "Tab") close(true);
              else if (
                ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
              ) {
                event.preventDefault();
                const items = Array.from(
                  menu.current?.querySelectorAll<HTMLButtonElement>(
                    "button:not(:disabled)",
                  ) || [],
                );
                const index = items.indexOf(
                  document.activeElement as HTMLButtonElement,
                );
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? items.length - 1
                      : (index +
                          (event.key === "ArrowDown" ? 1 : -1) +
                          items.length) %
                        items.length;
                items[next]?.focus();
              }
            }}
          >
            {allowed.map((action) => (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                disabled={action.disabled}
                onClick={(event) => {
                  close(true);
                  action.onClick(event);
                }}
                className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${action.danger ? "text-accent-red hover:bg-accent-red/10" : "text-text-muted hover:bg-bg-card-hover hover:text-text-main"}`}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
