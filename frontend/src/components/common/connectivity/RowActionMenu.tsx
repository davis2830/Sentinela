import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { TABLE_ACTION_BTN } from "./tableTokens";

export interface RowActionMenuItem {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void | Promise<void>;
  danger?: boolean;
  dividerBefore?: boolean;
  disabled?: boolean;
  /** Keep menu open after click (e.g. for temporary "Copied" feedback that closes itself) */
  keepOpen?: boolean;
}

export interface RowActionMenuProps {
  /** Resource name used for accessible labels */
  resourceLabel: string;
  /** Table row vs floating overlay pill on cards */
  variant?: "table" | "card";
  /** Keep action buttons visible even when not hovered (e.g. while scanning) */
  forceVisible?: boolean;
  /** Tooltip for the overflow trigger button */
  triggerTitle?: string;
  /** Direct action buttons rendered before the overflow menu trigger */
  directActions?: ReactNode;
  /** Overflow menu items rendered inside a document.body portal */
  items: RowActionMenuItem[];
  /** Menu width in px (used for viewport collision clamping) */
  menuWidth?: number;
  /** Estimated menu height in px (used for flip above/below calculation) */
  estimatedHeight?: number;
  /** Optional external close signal (increment or toggle to close) */
  closeSignal?: number;
}

/**
 * Shared row/card action container + Portal overflow menu (⋯) for Sentinel connectivity modules.
 * - Hover / keyboard focus-within / always visible on touch devices.
 * - Renders menu in document.body Portal so table overflow-hidden never clips it.
 * - Automatically flips above trigger when near bottom of viewport and closes on outside click, Escape, scroll, or resize.
 */
export default function RowActionMenu({
  resourceLabel,
  variant = "table",
  forceVisible = false,
  triggerTitle = "Más acciones",
  directActions,
  items,
  menuWidth = 216,
  estimatedHeight = 180,
  closeSignal,
}: RowActionMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (closeSignal !== undefined && closeSignal > 0) {
      setMenuOpen(false);
    }
  }, [closeSignal]);

  const toggleMenu = () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const openAbove =
        window.innerHeight - rect.bottom < estimatedHeight &&
        rect.top > estimatedHeight;
      const top = openAbove
        ? Math.max(8, rect.top - estimatedHeight - 4)
        : rect.bottom + 4;
      const left = Math.max(
        8,
        Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8),
      );
      setMenuPos({ top, left });
    }
    setMenuOpen(true);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const handleScrollOrResize = () => setMenuOpen(false);

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [menuOpen]);

  const visibilityClass =
    forceVisible || menuOpen
      ? "opacity-100 pointer-events-auto"
      : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto transition-opacity duration-100";

  const wrapperClass =
    variant === "card"
      ? `flex items-center gap-0.5 rounded-lg border border-border-base/80 bg-bg-dark px-0.5 py-0.5 shadow-lg absolute right-0 top-1/2 -translate-y-1/2 z-20 [@media(hover:none)]:static [@media(hover:none)]:translate-y-0 [@media(hover:none)]:border-0 [@media(hover:none)]:bg-transparent [@media(hover:none)]:p-0 [@media(hover:none)]:shadow-none ${visibilityClass}`
      : `flex items-center justify-end gap-0.5 ${visibilityClass}`;

  return (
    <div className={wrapperClass} onClick={(e) => e.stopPropagation()}>
      {directActions}

      {items.length > 0 && (
        <button
          ref={triggerRef}
          type="button"
          onClick={(e) => {
            if (e.detail > 0) e.currentTarget.blur();
            toggleMenu();
          }}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Más acciones para ${resourceLabel}`}
          title={triggerTitle}
          className={`${TABLE_ACTION_BTN} text-text-muted hover:text-text-main hover:bg-white/10 ${
            menuOpen ? "bg-white/10 text-text-main" : ""
          }`}
        >
          <MoreHorizontal size={16} />
        </button>
      )}

      {menuOpen &&
        items.length > 0 &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Acciones de ${resourceLabel}`}
            style={{ top: menuPos.top, left: menuPos.left, width: menuWidth }}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-[70] rounded-xl border border-border-accent/70 bg-bg-dark p-1 shadow-2xl text-xs text-left animate-in fade-in zoom-in-95 duration-100"
          >
            {items.map((item) => (
              <div key={item.id}>
                {item.dividerBefore && (
                  <div className="my-1 border-t border-border-base/70" />
                )}
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    if (!item.keepOpen) setMenuOpen(false);
                    void item.onClick();
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer disabled:opacity-50 !min-h-0 ${
                    item.danger
                      ? "text-rose-400 hover:bg-rose-500/15"
                      : "text-text-main hover:bg-bg-card-hover"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
