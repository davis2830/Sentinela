import { ChevronDown, ChevronRight } from "lucide-react";
import type { SSLCertificate } from "../../types/ssl";
import SSLCertificateCard from "./SSLCertificateCard";
import type { SSLDrawerSection } from "./SSLCertificateTableView";
import type {
  SSLDensity,
  SSLGroup,
  SSLThresholds,
} from "./useSSLCertificates";

interface SSLCertificateCardGridViewProps {
  sortedCertificates: SSLCertificate[];
  groupedCertificates: SSLGroup[] | null;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  thresholds: SSLThresholds;
  density: SSLDensity;
  selectedIds: string[];
  scanningId: string | null;
  onToggleSelect: (cert: SSLCertificate) => void;
  onSelectCert: (cert: SSLCertificate, section?: SSLDrawerSection) => void;
  onScan: (cert: SSLCertificate) => void;
  onEdit: (cert: SSLCertificate) => void;
  onDelete: (cert: SSLCertificate) => void;
}

export default function SSLCertificateCardGridView({
  sortedCertificates,
  groupedCertificates,
  collapsedGroups,
  onToggleGroup,
  thresholds,
  density,
  selectedIds,
  scanningId,
  onToggleSelect,
  onSelectCert,
  onScan,
  onEdit,
  onDelete,
}: SSLCertificateCardGridViewProps) {
  const hasAnySelection = selectedIds.length > 0;
  const gridClass =
    density === "compact"
      ? "grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5"
      : "grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4";

  const renderCard = (cert: SSLCertificate) => (
    <SSLCertificateCard
      key={cert.id}
      cert={cert}
      thresholds={thresholds}
      density={density}
      isSelected={selectedIds.includes(cert.id)}
      hasAnySelection={hasAnySelection}
      isScanning={scanningId === cert.id}
      onSelectToggle={onToggleSelect}
      onSelectCert={onSelectCert}
      onScan={onScan}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );

  if (groupedCertificates) {
    return (
      <div className="w-full max-w-[1400px] mx-auto space-y-5">
        {groupedCertificates.map((group) => {
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
                    {group.certs.length}{" "}
                    {group.certs.length === 1 ? "certificado" : "certificados"}
                  </span>
                  {group.urgentCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400 shrink-0">
                      {group.urgentCount} urgente
                      {group.urgentCount === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-text-dim shrink-0">
                  {isCollapsed ? "Expandir" : "Colapsar"}
                </span>
              </button>

              {!isCollapsed && (
                <div className={gridClass}>{group.certs.map(renderCard)}</div>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`w-full max-w-[1400px] mx-auto ${gridClass}`}>
      {sortedCertificates.map(renderCard)}
    </div>
  );
}
