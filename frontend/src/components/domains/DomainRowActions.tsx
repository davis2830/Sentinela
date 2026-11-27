import { useState } from "react";
import { Check, Copy, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useCapability } from "../../hooks/useCapability";
import type { DomainInfo } from "../../types/domain";
import RowActionMenu, {
  type RowActionMenuItem,
} from "../common/connectivity/RowActionMenu";
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

/**
 * Compact Domain actions built over shared RowActionMenu:
 * - Direct button: Comprobar ahora (RefreshCw)
 * - Portal overflow menu (⋯): Comprobar ahora, Copiar nameservers, Editar dominio, Eliminar dominio.
 */
export default function DomainRowActions({
  domain,
  variant = "table",
  isScanning,
  onScan,
  onEdit,
  onDelete,
}: DomainRowActionsProps) {
  const [copiedNs, setCopiedNs] = useState(false);
  const [closeSignal, setCloseSignal] = useState(0);

  const canScan = useCapability("domain.scan");
  const canEdit = useCapability("domain.update");
  const canDelete = useCapability("domain.delete");
  const nsList = parseDomainNameServers(domain.name_servers);

  const handleCopyNs = async () => {
    if (nsList.length === 0) return;
    try {
      await navigator.clipboard.writeText(nsList.join("\n"));
      setCopiedNs(true);
      setTimeout(() => {
        setCopiedNs(false);
        setCloseSignal((n) => n + 1);
      }, 900);
    } catch {
      setCloseSignal((n) => n + 1);
    }
  };

  const items: RowActionMenuItem[] = [
    ...(canScan
      ? [
          {
            id: "scan",
            label: isScanning ? "Comprobando..." : "Comprobar ahora",
            icon: (
              <RefreshCw
                size={13}
                className={`text-accent-green shrink-0 ${isScanning ? "animate-spin" : ""}`}
              />
            ),
            disabled: isScanning,
            onClick: () => onScan(domain),
          },
        ]
      : []),
    ...(nsList.length > 0
      ? [
          {
            id: "copy-ns",
            label: copiedNs ? "Nameservers copiados" : "Copiar nameservers",
            icon: copiedNs ? (
              <Check size={13} className="text-accent-green shrink-0" />
            ) : (
              <Copy size={13} className="text-sky-400 shrink-0" />
            ),
            keepOpen: true,
            onClick: handleCopyNs,
          },
        ]
      : []),
    ...(canEdit
      ? [
          {
            id: "edit",
            label: "Editar dominio",
            icon: <Pencil size={13} className="text-text-muted shrink-0" />,
            onClick: () => onEdit(domain),
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            id: "delete",
            label: "Eliminar dominio",
            icon: <Trash2 size={13} className="shrink-0" />,
            danger: true,
            dividerBefore: true,
            onClick: () => onDelete(domain),
          },
        ]
      : []),
  ];

  return (
    <RowActionMenu
      resourceLabel={domain.domain}
      variant={variant}
      forceVisible={isScanning}
      triggerTitle="Más acciones (copiar nameservers, editar, eliminar)"
      menuWidth={216}
      estimatedHeight={160}
      closeSignal={closeSignal}
      items={items}
      directActions={
        canScan ? (
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
        ) : undefined
      }
    />
  );
}
