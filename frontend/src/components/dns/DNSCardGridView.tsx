import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { DNSLinkedTarget, DNSRecord } from "../../types/dns";
import DNSCard from "./DNSCard";
import type { DNSRecordGroup } from "./useDNSRecords";

interface DNSCardGridViewProps {
  groups: DNSRecordGroup[];
  selectedIds: string[];
  scanningId: string | null;
  acceptingRefId: string | null;
  linkingRecordId?: string | null;
  onToggleSelect: (record: DNSRecord) => void;
  onSelectRecord: (record: DNSRecord) => void;
  onScan: (record: DNSRecord) => void;
  onAcceptReference: (record: DNSRecord) => void;
  onEdit: (record: DNSRecord) => void;
  onDelete: (record: DNSRecord) => void;
  onLinkTarget?: (record: DNSRecord, target: DNSLinkedTarget) => void;
}

export default function DNSCardGridView({
  groups,
  selectedIds,
  scanningId,
  acceptingRefId,
  linkingRecordId = null,
  onToggleSelect,
  onSelectRecord,
  onScan,
  onAcceptReference,
  onEdit,
  onDelete,
  onLinkTarget,
}: DNSCardGridViewProps) {
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
                <span className="font-mono">{group.label}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-bg-card border border-border-base text-[10px] font-mono text-text-dim">
                  {group.records.length}
                </span>
              </button>
            )}

            {!isCollapsed && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
                {group.records.map((record) => (
                  <DNSCard
                    key={record.id}
                    record={record}
                    isSelected={selectedIds.includes(record.id)}
                    isScanning={scanningId === record.id}
                    isAcceptingRef={acceptingRefId === record.id}
                    isLinking={linkingRecordId === record.id}
                    onToggleSelect={onToggleSelect}
                    onSelect={onSelectRecord}
                    onScan={onScan}
                    onAcceptReference={onAcceptReference}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onLinkTarget={onLinkTarget}
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
