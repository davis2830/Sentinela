import { Activity, Plus, Terminal } from "lucide-react";
import type { AgentProbe } from "../../types/agent_probe";
import { TargetEnabledSwitch } from "./TargetTableControls";
import { getGuardianHealthState } from "./useGuardians";
import type { GuardianActionSection } from "./Senti9TableView";

interface GuardianRowActionsProps {
  probe: AgentProbe;
  admin: boolean;
  canCreateMonitor: boolean;
  variant?: "table" | "card";
  onSelect: (probe: AgentProbe, section?: GuardianActionSection) => void;
  onCreateMonitor: (probeId: string) => void;
  onToggle: (probe: AgentProbe) => void;
}

/**
 * Unified Guardian actions component (homologated 1-to-1 with Uptime & Latency):
 * - Hover/focus/touch direct icons: + Monitor, Telemetría (Activity), Consola (Terminal)
 * - Always-visible Activar / Desactivar switch (TargetEnabledSwitch, compact)
 * - Never shifts the Guardian name in cards (floating overlay pill left of the switch).
 */
export default function GuardianRowActions({
  probe,
  admin,
  canCreateMonitor,
  variant = "table",
  onSelect,
  onCreateMonitor,
  onToggle,
}: GuardianRowActionsProps) {
  const state = getGuardianHealthState(probe);
  const isRevoked = state === "revoked";
  const isEnabled = probe.enabled !== false && !isRevoked;

  const hoverVisibilityClass =
    "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto transition-opacity duration-150";

  const iconButtons = !isRevoked ? (
    <>
      {canCreateMonitor && (
        <button
          type="button"
          onClick={() => onCreateMonitor(probe.id)}
          title="Agregar monitor LAN en este guardián"
          aria-label={`Agregar monitor LAN en ${probe.name}`}
          className="table-action-btn h-6 w-6 grid shrink-0 place-items-center rounded-md text-text-dim hover:text-accent-green hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
        >
          <Plus size={13} />
        </button>
      )}
      <button
        type="button"
        onClick={() => onSelect(probe, "operation")}
        title="Ver telemetría y detalle operativo"
        aria-label={`Ver telemetría de ${probe.name}`}
        className="table-action-btn h-6 w-6 grid shrink-0 place-items-center rounded-md text-text-dim hover:text-emerald-400 hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
      >
        <Activity size={13} />
      </button>
      {admin && (
        <button
          type="button"
          onClick={() => onSelect(probe, "install")}
          title="Consola: comandos de despliegue Docker"
          aria-label={`Consola de despliegue Docker de ${probe.name}`}
          className="table-action-btn h-6 w-6 grid shrink-0 place-items-center rounded-md text-text-dim hover:text-sky-400 hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
        >
          <Terminal size={13} />
        </button>
      )}
    </>
  ) : (
    <button
      type="button"
      onClick={() => onSelect(probe, "security")}
      title="Ver auditoría de retiro"
      aria-label={`Ver auditoría de retiro de ${probe.name}`}
      className="table-action-btn h-6 w-6 grid shrink-0 place-items-center rounded-md text-text-dim hover:text-text-main hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
    >
      <Activity size={13} />
    </button>
  );

  if (variant === "card") {
    return (
      <div
        className="relative flex items-center shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating overlay pill on desktop hover/focus (never pushes the name); inline on touch */}
        <div
          className={`flex items-center gap-0.5 rounded-lg border border-border-base/80 bg-bg-dark/95 backdrop-blur-sm px-0.5 py-0.5 shadow-lg absolute ${
            isRevoked ? "right-0" : "right-9"
          } top-1/2 -translate-y-1/2 z-20 [@media(hover:none)]:static [@media(hover:none)]:translate-y-0 [@media(hover:none)]:mr-1.5 [@media(hover:none)]:border-0 [@media(hover:none)]:bg-transparent [@media(hover:none)]:p-0 [@media(hover:none)]:shadow-none ${hoverVisibilityClass}`}
        >
          {iconButtons}
        </div>

        {!isRevoked && (
          <TargetEnabledSwitch
            enabled={isEnabled}
            onChange={() => onToggle(probe)}
            size="compact"
            activeLabel="Pausar guardián"
            inactiveLabel="Activar guardián"
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-end gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className={`flex items-center gap-0.5 ${hoverVisibilityClass}`}>
        {iconButtons}
      </div>

      {!isRevoked && (
        <TargetEnabledSwitch
          enabled={isEnabled}
          onChange={() => onToggle(probe)}
          size="compact"
          activeLabel="Pausar guardián"
          inactiveLabel="Activar guardián"
        />
      )}
    </div>
  );
}
