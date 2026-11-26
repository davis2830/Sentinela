import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { DomainInfo } from "../../types/domain";
import DomainCard from "./DomainCard";
import type { DomainGroup, DomainThresholds } from "./useDomains";

interface DomainCardGridViewProps {
  groups: DomainGroup[];
  activeDomainId?: string | null;
  thresholds: DomainThresholds;
  selectedIds: string[];
  scanningId: string | null;
  onToggleSelect: (domain: DomainInfo) => void;
  onSelectDomain: (domain: DomainInfo) => void;
  onScan: (domain: DomainInfo) => void;
  onEdit: (domain: DomainInfo) => void;
  onDelete: (domain: DomainInfo) => void;
}

export default function DomainCardGridView({
  groups,
  activeDomainId = null,
  thresholds,
  selectedIds,
  scanningId,
  onToggleSelect,
  onSelectDomain,
  onScan,
  onEdit,
  onDelete,
}: DomainCardGridViewProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleGroup = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-5">
      {groups.map((group) => {
        const isGrouped = group.key !== "all";
        const isCollapsed = Boolean(collapsed[group.key]);

        return (
          <section key={group.key} className="space-y-2.5">
            {isGrouped && (
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text-main cursor-pointer !min-h-0 !min-w-0"
              >
                {isCollapsed ? (
                  <ChevronRight size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
                <span>{group.label}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-bg-card border border-border-base text-[10px] font-mono text-text-dim">
                  {group.domains.length}
                </span>
              </button>
            )}

            {!isCollapsed && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
                {group.domains.map((domain) => (
                  <DomainCard
                    key={domain.id}
                    domain={domain}
                    thresholds={thresholds}
                    isActive={activeDomainId === domain.id}
                    isSelected={selectedIds.includes(domain.id)}
                    isScanning={scanningId === domain.id}
                    onToggleSelect={onToggleSelect}
                    onSelect={onSelectDomain}
                    onScan={onScan}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
