import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowUpCircle,
  Check,
  Copy,
  MoreHorizontal,
  Plus,
  RotateCw,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { api } from "../../services/api";
import type { AgentProbe } from "../../types/agent_probe";
import {
  getGuardianHealthState,
  getGuardianPlatform,
  isGuardianVersionOutdated,
} from "./useGuardians";
import type { GuardianActionSection } from "./Senti9TableView";

interface GuardianRowActionsProps {
  probe: AgentProbe;
  admin: boolean;
  canCreateMonitor: boolean;
  variant?: "table" | "card";
  onSelect: (probe: AgentProbe, section?: GuardianActionSection) => void;
  onCreateMonitor: (probeId: string) => void;
}

/**
 * Shared Guardian actions component used identically in List rows and Cards:
 * - Direct icons (desktop sm+): + Monitor, Telemetría (Activity), Consola (Terminal)
 * - Always includes ⋯ overflow menu: Actualizar, Copiar comando de registro, Rotar token, Revocar (red)
 * - Visible on hover, keyboard focus-within, and always on touch devices; collapses cleanly to ⋯ on mobile.
 */
export default function GuardianRowActions({
  probe,
  admin,
  canCreateMonitor,
  variant = "table",
  onSelect,
  onCreateMonitor,
}: GuardianRowActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copyingCmd, setCopyingCmd] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  const state = getGuardianHealthState(probe);
  const isRevoked = state === "revoked";
  const outdated = isGuardianVersionOutdated(probe);

  const handleCopyInstallCommand = async () => {
    setCopyingCmd(true);
    try {
      let command = probe.installation?.command || probe.docker_command || "";
      if (!command) {
        const platform = getGuardianPlatform(probe);
        const res = await api.get(`agent-probes/${probe.id}/installation/`, {
          params: { platform },
        });
        command = res.data?.data?.command || "";
      }
      if (command) {
        await navigator.clipboard.writeText(command);
        setCopiedCmd(true);
        setTimeout(() => {
          setCopiedCmd(false);
          setMenuOpen(false);
        }, 1200);
      } else {
        setMenuOpen(false);
        onSelect(probe, "install");
      }
    } catch {
      setMenuOpen(false);
      onSelect(probe, "install");
    } finally {
      setCopyingCmd(false);
    }
  };

  const visibilityClass = menuOpen
    ? "opacity-100 pointer-events-auto"
    : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto";

  const wrapperClass =
    variant === "card"
      ? `flex items-center gap-0.5 rounded-lg border border-border-base/80 bg-bg-dark/95 backdrop-blur-sm px-0.5 py-0.5 shadow-lg absolute right-0 top-1/2 -translate-y-1/2 z-20 [@media(hover:none)]:static [@media(hover:none)]:translate-y-0 [@media(hover:none)]:border-0 [@media(hover:none)]:bg-transparent [@media(hover:none)]:p-0 [@media(hover:none)]:shadow-none transition-opacity duration-150 ${visibilityClass}`
      : `flex items-center justify-end gap-0.5 transition-opacity duration-150 ${visibilityClass}`;

  return (
    <div
      ref={menuRef}
      className={wrapperClass}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Direct icon buttons (desktop sm+; mobile uses the ⋯ menu cleanly) */}
      {!isRevoked && (
        <div className="hidden sm:flex items-center gap-0.5">
          {canCreateMonitor && (
            <button
              type="button"
              onClick={() => onCreateMonitor(probe.id)}
              title="Agregar monitor LAN en este guardián"
              aria-label={`Agregar monitor LAN en ${probe.name}`}
              className="table-action-btn h-6 w-6 grid place-items-center rounded-md text-text-dim hover:text-accent-green hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
            >
              <Plus size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onSelect(probe, "operation")}
            title="Ver telemetría y detalle operativo"
            aria-label={`Ver telemetría de ${probe.name}`}
            className="table-action-btn h-6 w-6 grid place-items-center rounded-md text-text-dim hover:text-emerald-400 hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
          >
            <Activity size={13} />
          </button>
          {admin && (
            <button
              type="button"
              onClick={() => onSelect(probe, "install")}
              title="Consola: comandos de despliegue Docker"
              aria-label={`Consola de despliegue Docker de ${probe.name}`}
              className="table-action-btn h-6 w-6 grid place-items-center rounded-md text-text-dim hover:text-sky-400 hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
            >
              <Terminal size={13} />
            </button>
          )}
        </div>
      )}

      {/* Overflow ⋯ menu button (always present in both List and Card) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Más acciones para ${probe.name}`}
          title="Más acciones"
          className={`table-action-btn h-6 w-6 grid place-items-center rounded-md text-text-dim hover:text-text-main hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0 ${
            menuOpen ? "bg-white/10 text-text-main" : ""
          }`}
        >
          <MoreHorizontal size={14} />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-7 z-40 w-52 rounded-xl border border-border-base bg-bg-dark/98 backdrop-blur-md p-1 shadow-2xl text-xs text-left animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Primary actions repeated on mobile (< sm) where inline icons collapse to ⋯ */}
            {!isRevoked && (
              <div className="sm:hidden pb-1 mb-1 border-b border-border-base/70 space-y-0.5">
                {canCreateMonitor && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onCreateMonitor(probe.id);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text-main hover:bg-bg-card-hover cursor-pointer !min-h-0"
                  >
                    <Plus size={13} className="text-accent-green shrink-0" />
                    <span>Agregar monitor</span>
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onSelect(probe, "operation");
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text-main hover:bg-bg-card-hover cursor-pointer !min-h-0"
                >
                  <Activity size={13} className="text-emerald-400 shrink-0" />
                  <span>Telemetría y detalle</span>
                </button>
                {admin && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onSelect(probe, "install");
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text-main hover:bg-bg-card-hover cursor-pointer !min-h-0"
                  >
                    <Terminal size={13} className="text-sky-400 shrink-0" />
                    <span>Consola Docker</span>
                  </button>
                )}
              </div>
            )}

            {/* Less frequent actions */}
            {!isRevoked && admin && outdated && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onSelect(probe, "install");
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-amber-300 hover:bg-amber-500/15 cursor-pointer !min-h-0"
              >
                <ArrowUpCircle size={13} className="shrink-0" />
                <span>Actualizar guardián</span>
              </button>
            )}

            {!isRevoked && admin && (
              <button
                type="button"
                role="menuitem"
                disabled={copyingCmd}
                onClick={() => void handleCopyInstallCommand()}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text-main hover:bg-bg-card-hover disabled:opacity-50 cursor-pointer !min-h-0"
              >
                {copiedCmd ? (
                  <Check size={13} className="text-accent-green shrink-0" />
                ) : (
                  <Copy size={13} className="text-text-muted shrink-0" />
                )}
                <span>
                  {copiedCmd
                    ? "Comando copiado"
                    : "Copiar comando de registro"}
                </span>
              </button>
            )}

            {!isRevoked && admin && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onSelect(probe, "security");
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text-main hover:bg-bg-card-hover cursor-pointer !min-h-0"
              >
                <RotateCw size={13} className="text-amber-400 shrink-0" />
                <span>Rotar token</span>
              </button>
            )}

            {!isRevoked && admin && (
              <>
                <div className="my-1 border-t border-border-base/70" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onSelect(probe, "revoke");
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 cursor-pointer !min-h-0"
                >
                  <ShieldAlert size={13} className="shrink-0" />
                  <span>Revocar guardián</span>
                </button>
              </>
            )}

            {isRevoked && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onSelect(probe, "security");
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text-main hover:bg-bg-card-hover cursor-pointer !min-h-0"
              >
                <Activity size={13} className="text-slate-400 shrink-0" />
                <span>Ver auditoría de retiro</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
