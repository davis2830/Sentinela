import { ChevronDown, ChevronRight } from "lucide-react";
import TargetCard from "./TargetCard";
import type { TargetDensity, TargetGroup } from "./useTargets";
import type { MonitoringTarget } from "../../types/monitoring";

interface TargetCardGridViewProps {
  sortedTargets: MonitoringTarget[];
  groupedTargets: TargetGroup[] | null;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  density: TargetDensity;
  selectedIds: string[];
  onSelectToggle: (target: MonitoringTarget) => void;
  onEdit: (target: MonitoringTarget) => void;
  onDelete: (target: MonitoringTarget) => void;
  onScan: (target: MonitoringTarget) => void;
  onToggle: (target: MonitoringTarget) => void;
  onAlert?: (target: MonitoringTarget) => void;
  scanningId: string | null;
  onClick: (target: MonitoringTarget) => void;
}

export default function TargetCardGridView({
  sortedTargets,
  groupedTargets,
  collapsedGroups,
  onToggleGroup,
  density,
  selectedIds,
  onSelectToggle,
  onEdit,
  onDelete,
  onScan,
  onToggle,
  onAlert,
  scanningId,
  onClick,
}: TargetCardGridViewProps) {
  const hasAnySelection = selectedIds.length > 0;
  const gridClass =
    density === "compact"
      ? "grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3"
      : "grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-4";

  const renderCard = (target: MonitoringTarget) => (
    <TargetCard
      key={target.id}
      target={target}
      density={density}
      onEdit={onEdit}
      onDelete={onDelete}
      onScan={onScan}
      onToggle={onToggle}
      onAlert={onAlert}
      isScanning={scanningId === target.id}
      onClick={onClick}
      isSelected={selectedIds.includes(target.id)}
      hasAnySelection={hasAnySelection}
      onSelectToggle={onSelectToggle}
    />
  );

  if (groupedTargets) {
    return (
      <div className="w-full max-w-[1400px] mx-auto space-y-5">
        {groupedTargets.map((group) => {
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
                  <GroupIcon
                    size={14}
                    className={
                      group.isAgent
                        ? "text-accent-purple shrink-0"
                        : "text-sky-400 shrink-0"
                    }
                  />
                  <span className="font-semibold text-text-main text-xs truncate">
                    {group.label}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-bg-dark border border-border-base text-text-muted shrink-0">
                    {group.targets.length}{" "}
                    {group.targets.length === 1 ? "monitor" : "monitores"}
                  </span>
                  {group.downCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400 shrink-0">
                      {group.downCount}{" "}
                      {group.downCount === 1 ? "caído" : "caídos"}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-text-dim shrink-0">
                  {isCollapsed ? "Expandir" : "Colapsar"}
                </span>
              </button>

              {!isCollapsed && (
                <div className={gridClass}>{group.targets.map(renderCard)}</div>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`w-full max-w-[1400px] mx-auto ${gridClass}`}>
      {sortedTargets.map(renderCard)}
    </div>
  );
}
