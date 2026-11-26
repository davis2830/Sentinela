import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Copy,
  GitBranch,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCapability } from "../../hooks/useCapability";
import type { SSLCertificate } from "../../types/ssl";

interface SSLCertificateRowActionsProps {
  cert: SSLCertificate;
  variant?: "table" | "card";
  isScanning: boolean;
  onScan: (cert: SSLCertificate) => void;
  onViewChain: (cert: SSLCertificate) => void;
  onEdit: (cert: SSLCertificate) => void;
  onDelete: (cert: SSLCertificate) => void;
}

/**
 * Compact SSL actions component (homologated for low noise):
 * - Direct button: Revalidar ahora (RefreshCw)
 * - Overflow menu (⋯) rendered in a document.body Portal so it is never clipped by table overflow:
 *   Ver cadena de certificación, Copiar huella SHA-256, Editar dominio, Eliminar certificado (red).
 * - Visible on hover, keyboard focus-within, and always on touch devices.
 */
export default function SSLCertificateRowActions({
  cert,
  variant = "table",
  isScanning,
  onScan,
  onViewChain,
  onEdit,
  onDelete,
}: SSLCertificateRowActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedFp, setCopiedFp] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const canScan = useCapability("ssl_monitor.scan");
  const canEdit = useCapability("ssl_monitor.update");
  const canDelete = useCapability("ssl_monitor.delete");

  const openMenu = () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const menuWidth = 208;
      const estimatedHeight = 180;
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

  const handleCopyFp = async () => {
    if (!cert.fingerprint) return;
    try {
      await navigator.clipboard.writeText(cert.fingerprint);
      setCopiedFp(true);
      setTimeout(() => {
        setCopiedFp(false);
        setMenuOpen(false);
      }, 900);
    } catch {
      setMenuOpen(false);
    }
  };

  const visibilityClass =
    isScanning || menuOpen
      ? "opacity-100 pointer-events-auto"
      : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto transition-opacity duration-150";

  const wrapperClass =
    variant === "card"
      ? `flex items-center gap-0.5 rounded-lg border border-border-base/80 bg-bg-dark/95 backdrop-blur-sm px-0.5 py-0.5 shadow-lg absolute right-0 top-1/2 -translate-y-1/2 z-20 [@media(hover:none)]:static [@media(hover:none)]:translate-y-0 [@media(hover:none)]:border-0 [@media(hover:none)]:bg-transparent [@media(hover:none)]:p-0 [@media(hover:none)]:shadow-none ${visibilityClass}`
      : `flex items-center justify-end gap-0.5 ${visibilityClass}`;

  return (
    <div className={wrapperClass} onClick={(e) => e.stopPropagation()}>
      {canScan && (
        <button
          type="button"
          disabled={isScanning}
          onClick={(e) => {
            if (e.detail > 0) e.currentTarget.blur();
            onScan(cert);
          }}
          title="Comprobar certificado ahora"
          aria-label={`Comprobar ${cert.domain} ahora`}
          className="table-action-btn h-6 w-6 grid shrink-0 place-items-center rounded-md text-text-dim hover:text-accent-green hover:bg-white/10 disabled:opacity-60 transition-colors cursor-pointer !min-h-0 !min-w-0"
        >
          <RefreshCw
            size={13}
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
        aria-label={`Más acciones para ${cert.domain}`}
        title="Más acciones (cadena, huella, editar, eliminar)"
        className={`table-action-btn h-6 w-6 grid shrink-0 place-items-center rounded-md text-text-dim hover:text-text-main hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0 ${
          menuOpen ? "bg-white/10 text-text-main" : ""
        }`}
      >
        <MoreHorizontal size={14} />
      </button>

      {menuOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Acciones de ${cert.domain}`}
            style={{ top: menuPos.top, left: menuPos.left }}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-[70] w-52 rounded-xl border border-border-base bg-bg-dark/98 backdrop-blur-md p-1 shadow-2xl text-xs text-left animate-in fade-in zoom-in-95 duration-100"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onViewChain(cert);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text-main hover:bg-bg-card-hover cursor-pointer !min-h-0"
            >
              <GitBranch size={13} className="text-emerald-400 shrink-0" />
              <span>Ver cadena</span>
            </button>

            {cert.fingerprint && (
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleCopyFp()}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text-main hover:bg-bg-card-hover cursor-pointer !min-h-0"
              >
                {copiedFp ? (
                  <Check size={13} className="text-accent-green shrink-0" />
                ) : (
                  <Copy size={13} className="text-sky-400 shrink-0" />
                )}
                <span>{copiedFp ? "Huella copiada" : "Copiar huella"}</span>
              </button>
            )}

            {canEdit && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit(cert);
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
                    onDelete(cert);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 cursor-pointer !min-h-0"
                >
                  <Trash2 size={13} className="shrink-0" />
                  <span>Eliminar certificado</span>
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
