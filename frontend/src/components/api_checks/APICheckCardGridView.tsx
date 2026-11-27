import { ChevronDown, ChevronRight } from "lucide-react";
import type { APICheckTarget } from "../../types/api_checks";
import APICheckCard from "./APICheckCard";
import type { APICheckDensity, APICheckGroup } from "./useAPIChecks";

interface APICheckCardGridViewProps {
  targets: APICheckTarget[];
  groups: APICheckGroup[] | null;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  density: APICheckDensity;
  selectedIds: string[];
  onToggleSelect: (target: APICheckTarget) => void;
  onSelectTarget: (target: APICheckTarget) => void;
  onScan: (target: APICheckTarget) => void;
  scanningId: string | null;
  onEdit: (target: APICheckTarget) => void;
  onDelete: (target: APICheckTarget) => void;
}

export default function APICheckCardGridView({
  targets,
  groups,
  collapsedGroups,
  onToggleGroup,
  density,
  selectedIds,
  onToggleSelect,
  onSelectTarget,
  onScan,
  scanningId,
  onEdit,
  onDelete,
}: APICheckCardGridViewProps) {
  const hasAnySelection = selectedIds.length > 0;
  const gridClass =
    density === "compact"
      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
      : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";

  const renderCards = (items: APICheckTarget[]) => (
    <div className={gridClass}>
      {items.map((target) => (
        <APICheckCard
          key={target.id}
          target={target}
          density={density}
          isSelected={selectedIds.includes(target.id)}
          hasAnySelection={hasAnySelection}
          isScanning={scanningId === target.id}
          onToggleSelect={onToggleSelect}
          onSelect={onSelectTarget}
          onScan={onScan}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );

  if (!groups) {
    return (
      <div className="w-full max-w-[1400px] mx-auto">{renderCards(targets)}</div>
    );
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-5">
      {groups.map((group) => {
        const isCollapsed = Boolean(collapsedGroups[group.key]);
        const Icon = group.icon;
        return (
          <section key={group.key} className="space-y-2.5">
            <button
              type="button"
              onClick={() => onToggleGroup(group.key)}
              className="flex items-center gap-2 text-xs font-semibold text-text-main hover:text-accent-green transition-colors cursor-pointer !min-h-0"
            >
              {isCollapsed ? (
                <ChevronRight size={14} className="text-text-dim" />
              ) : (
                <ChevronDown size={14} className="text-text-dim" />
              )}
              <Icon size={13} className="text-text-muted" />
              <span>{group.label}</span>
              <span className="font-mono text-[11px] text-text-dim">
                ({group.targets.length})
              </span>
              {group.problemCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-mono text-[10px] font-semibold">
                  {group.problemCount}{" "}
                  {group.problemCount === 1 ? "alerta" : "alertas"}
                </span>
              )}
            </button>
            {!isCollapsed && renderCards(group.targets)}
          </section>
        );
      })}
    </div>
  );
}
