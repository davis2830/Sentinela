import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Copy,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCapability } from "../../hooks/useCapability";
import type { DomainInfo } from "../../types/domain";
import { TABLE_ACTION_BTN } from "../common/connectivity/tableTokens";
import { parseDomainNameServers } from "./useDomains";

interface DomainRowActionsProps {
  domain: DomainInfo;
  variant?: "table" | "card";
  isScanning: boolean;
  onScan: (domain: DomainInfo) => void;
  onEdit: (domain: DomainInfo) => void;
  onDelete: (domain: DomainInfo) => void;
}

export default function DomainRowActions({
  domain,
  variant = "table",
  isScanning,
  onScan,
  onEdit,
  onDelete,
}: DomainRowActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedNs, setCopiedNs] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const canScan = useCapability("domain.scan");
  const canEdit = useCapability("domain.update");
  const canDelete = useCapability("domain.delete");
  const nsList = parseDomainNameServers(domain.name_servers);

  const openMenu = () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const menuWidth = 216;
      const estimatedHeight = 160;
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

  const handleCopyNs = async () => {
    if (nsList.length === 0) return;
    try {
      await navigator.clipboard.writeText(nsList.join("\n"));
      setCopiedNs(true);
      setTimeout(() => {
        setCopiedNs(false);
        setMenuOpen(false);
      }, 900);
    } catch {
      setMenuOpen(false);
    }
  };

  const visibilityClass =
    isScanning || menuOpen
      ? "opacity-100 pointer-events-auto"
      : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto transition-opacity duration-100";

  const wrapperClass =
    variant === "card"
      ? `flex items-center gap-0.5 rounded-lg border border-border-base/80 bg-bg-dark px-0.5 py-0.5 shadow-lg absolute right-0 top-1/2 -translate-y-1/2 z-20 [@media(hover:none)]:static [@media(hover:none)]:translate-y-0 [@media(hover:none)]:border-0 [@media(hover:none)]:bg-transparent [@media(hover:none)]:p-0 [@media(hover:none)]:shadow-none ${visibilityClass}`
      : `flex items-center justify-end gap-0.5 ${visibilityClass}`;

  return (
    <div className={wrapperClass} onClick={(e) => e.stopPropagation()}>
      {canScan && (
        <button
          type="button"
          disabled={isScanning}
          onClick={(e) => {
            if (e.detail > 0) e.currentTarget.blur();
            onScan(domain);
          }}
          title="Comprobar ahora"
          aria-label={`Comprobar ${domain.domain} ahora`}
          className={`${TABLE_ACTION_BTN} text-text-muted hover:text-accent-green hover:bg-white/10 disabled:opacity-60`}
        >
          <RefreshCw
            size={16}
            className={isScanning ? "animate-spin text-accent-green" : ""}
          />
        </button>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          if (e.detail > 0) e.currentTarget.blur();
          openMenu();
        }}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={`Más acciones para ${domain.domain}`}
        title="Más acciones (copiar nameservers, editar, eliminar)"
        className={`${TABLE_ACTION_BTN} text-text-muted hover:text-text-main hover:bg-white/10 ${
          menuOpen ? "bg-white/10 text-text-main" : ""
        }`}
      >
        <MoreHorizontal size={16} />
      </button>

      {menuOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Acciones de ${domain.domain}`}
            style={{ top: menuPos.top, left: menuPos.left }}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-[70] w-52 rounded-xl border border-border-accent/70 bg-bg-dark p-1 shadow-2xl text-xs text-left animate-in fade-in zoom-in-95 duration-100"
          >
            {canScan && (
              <button
                type="button"
                role="menuitem"
                disabled={isScanning}
                onClick={() => {
                  setMenuOpen(false);
                  onScan(domain);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text-main hover:bg-bg-card-hover disabled:opacity-50 cursor-pointer !min-h-0"
              >
                <RefreshCw
                  size={13}
                  className={`text-accent-green shrink-0 ${isScanning ? "animate-spin" : ""}`}
                />
                <span>{isScanning ? "Comprobando..." : "Comprobar ahora"}</span>
              </button>
            )}

            {nsList.length > 0 && (
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleCopyNs()}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text-main hover:bg-bg-card-hover cursor-pointer !min-h-0"
              >
                {copiedNs ? (
                  <Check size={13} className="text-accent-green shrink-0" />
                ) : (
                  <Copy size={13} className="text-sky-400 shrink-0" />
                )}
                <span>
                  {copiedNs ? "Nameservers copiados" : "Copiar nameservers"}
                </span>
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
          </div>,
          document.body,
        )}
    </div>
  );
}
