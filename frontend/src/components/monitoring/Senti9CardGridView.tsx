import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import type { AgentProbe } from "../../types/agent_probe";
import Senti9AgentCard from "./Senti9AgentCard";
import type { GuardianActionSection } from "./Senti9TableView";
import {
  getGuardianHealthState,
  type GuardianDensity,
  type GuardianGroup,
} from "./useGuardians";

interface Senti9CardGridViewProps {
  sortedProbes: AgentProbe[];
  groupedProbes: GuardianGroup[] | null;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  density: GuardianDensity;
  hasFilters: boolean;
  admin: boolean;
  canCreateMonitor: boolean;
  onSelectProbe: (probe: AgentProbe, section?: GuardianActionSection) => void;
  onCreateMonitor: (probeId: string) => void;
  onToggleProbe: (probe: AgentProbe) => void;
}

export default function Senti9CardGridView({
  sortedProbes,
  groupedProbes,
  collapsedGroups,
  onToggleGroup,
  density,
  hasFilters,
  admin,
  canCreateMonitor,
  onSelectProbe,
  onCreateMonitor,
  onToggleProbe,
}: Senti9CardGridViewProps) {
  const gridClass =
    density === "compact"
      ? "grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5"
      : "grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-4";

  const renderCard = (probe: AgentProbe) => (
    <Senti9AgentCard
      key={probe.id}
      probe={probe}
      density={density}
      admin={admin}
      canCreateMonitor={canCreateMonitor}
      onSelect={onSelectProbe}
      onCreateMonitor={onCreateMonitor}
      onToggle={onToggleProbe}
    />
  );

  // Conditional companion card: shown ONLY when 1+ active guardians have 0 monitors (max 1 card total, never repeated per guardian)
  const emptyGuardians =
    !groupedProbes && !hasFilters && canCreateMonitor
      ? sortedProbes.filter(
          (p) =>
            (p.assigned_targets_count ?? 0) === 0 &&
            getGuardianHealthState(p) !== "revoked" &&
            getGuardianHealthState(p) !== "paused",
        )
      : [];
  const primaryEmptyGuardian = emptyGuardians[0] ?? null;

  if (groupedProbes) {
    return (
      <div className="w-full max-w-[1400px] mx-auto space-y-5">
        {groupedProbes.map((group) => {
          const isCollapsed = Boolean(collapsedGroups[group.key]);
          const GroupIcon = group.icon;

          return (
            <section key={group.key} className="space-y-3">
              <button
                type="button"
                onClick={() => onToggleGroup(group.key)}
                aria-expanded={!isCollapsed}
                className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-bg-card border border-border-base/80 hover:bg-bg-card-hover transition-colors cursor-pointer select-none !min-h-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isCollapsed ? (
                    <ChevronRight size={14} className="text-text-dim shrink-0" />
                  ) : (
                    <ChevronDown
                      size={14}
                      className="text-accent-green shrink-0"
                    />
                  )}
                  <GroupIcon size={14} className="text-sky-400 shrink-0" />
                  <span className="font-semibold text-text-main text-xs truncate">
                    {group.label}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-bg-dark border border-border-base text-text-muted shrink-0">
                    {group.probes.length}{" "}
                    {group.probes.length === 1 ? "guardián" : "guardianes"}
                  </span>
                  {group.problemCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400 shrink-0">
                      {group.problemCount} con alerta
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-text-dim shrink-0">
                  {isCollapsed ? "Expandir" : "Colapsar"}
                </span>
              </button>

              {!isCollapsed && (
                <div className={gridClass}>{group.probes.map(renderCard)}</div>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`w-full max-w-[1400px] mx-auto ${gridClass}`}>
      {sortedProbes.map(renderCard)}

      {primaryEmptyGuardian && (
        <div className="flex h-full flex-col justify-between rounded-2xl border border-dashed border-border-base/80 bg-bg-card/35 hover:bg-bg-card/60 hover:border-accent-green/45 p-4 gap-3 transition-all">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-text-main">
              {emptyGuardians.length === 1
                ? `${primaryEmptyGuardian.name} no tiene monitores`
                : `${emptyGuardians.length} guardianes sin monitores`}
            </p>
            <p className="text-xs text-text-muted leading-relaxed">
              {emptyGuardians.length === 1
                ? "Agrega bases de datos, APIs internas o puertos TCP privados para supervisarlos desde este guardián."
                : `${emptyGuardians
                    .slice(0, 2)
                    .map((g) => g.name)
                    .join(", ")}${emptyGuardians.length > 2 ? " y otros" : ""} están listos para supervisar servicios dentro de tu red.`}
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => onCreateMonitor(primaryEmptyGuardian.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-accent-green/15 hover:bg-accent-green text-accent-green hover:text-black border border-accent-green/35 transition-colors cursor-pointer !min-h-0"
            >
              <Plus size={14} />
              <span>Crear primer monitor</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
