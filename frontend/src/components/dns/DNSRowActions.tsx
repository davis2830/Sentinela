import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCapability } from "../../hooks/useCapability";
import type { DNSRecord, DNSReferenceMode } from "../../types/dns";
import RowActionMenu, {
  type RowActionMenuItem,
} from "../common/connectivity/RowActionMenu";
import { TABLE_ACTION_BTN } from "../common/connectivity/tableTokens";

interface DNSRowActionsProps {
  record: DNSRecord;
  variant?: "table" | "card";
  isScanning: boolean;
  isAcceptingRef?: boolean;
  onScan: (record: DNSRecord) => void;
  onAcceptReference: (record: DNSRecord, mode?: DNSReferenceMode) => void;
  onEdit: (record: DNSRecord) => void;
  onDelete: (record: DNSRecord) => void;
}

/**
 * Compact DNS actions built over shared RowActionMenu:
 * - Direct buttons: Comprobar ahora (RefreshCw) + Definir como referencia (when out of ref / unset)
 * - Portal overflow menu (⋯): Definir como referencia, Copiar valores, Editar registro, Eliminar registro.
 */
export default function DNSRowActions({
  record,
  variant = "table",
  isScanning,
  isAcceptingRef = false,
  onScan,
  onAcceptReference,
  onEdit,
  onDelete,
}: DNSRowActionsProps) {
  const [copiedValue, setCopiedValue] = useState(false);
  const [closeSignal, setCloseSignal] = useState(0);

  const canScan = useCapability("dns_monitor.scan");
  const canEdit = useCapability("dns_monitor.update");
  const canDelete = useCapability("dns_monitor.delete");

  const hasValues = Boolean(record.value && record.value.trim().length > 0);
  const canDefineReference = canEdit && hasValues;
  const needsReferenceAction =
    canDefineReference && record.matches_expected !== true;

  const handleCopyValue = async () => {
    if (!record.value) return;
    try {
      await navigator.clipboard.writeText(record.value);
      setCopiedValue(true);
      setTimeout(() => {
        setCopiedValue(false);
        setCloseSignal((n) => n + 1);
      }, 900);
    } catch {
      setCloseSignal((n) => n + 1);
    }
  };

  const items: RowActionMenuItem[] = [
    ...(canDefineReference
      ? [
          {
            id: "define-ref",
            label: "Definir como referencia",
            icon: (
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
            ),
            disabled: isAcceptingRef,
            onClick: () => onAcceptReference(record),
          },
        ]
      : []),
    ...(hasValues
      ? [
          {
            id: "copy-val",
            label: copiedValue ? "Valores copiados" : "Copiar valores",
            icon: copiedValue ? (
              <Check size={13} className="text-accent-green shrink-0" />
            ) : (
              <Copy size={13} className="text-sky-400 shrink-0" />
            ),
            keepOpen: true,
            onClick: handleCopyValue,
          },
        ]
      : []),
    ...(canEdit
      ? [
          {
            id: "edit",
            label: "Editar registro",
            icon: <Pencil size={13} className="text-text-muted shrink-0" />,
            onClick: () => onEdit(record),
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            id: "delete",
            label: "Eliminar registro",
            icon: <Trash2 size={13} className="shrink-0" />,
            danger: true,
            dividerBefore: true,
            onClick: () => onDelete(record),
          },
        ]
      : []),
  ];

  return (
    <RowActionMenu
      resourceLabel={`${record.record_type} ${record.domain}`}
      variant={variant}
      forceVisible={isScanning}
      triggerTitle="Más acciones (definir referencia, copiar valores, editar, eliminar)"
      menuWidth={224}
      estimatedHeight={195}
      closeSignal={closeSignal}
      items={items}
      directActions={
        <>
          {canScan && (
            <button
              type="button"
              disabled={isScanning}
              onClick={(e) => {
                if (e.detail > 0) e.currentTarget.blur();
                onScan(record);
              }}
              title="Comprobar ahora"
              aria-label={`Comprobar ${record.record_type} ${record.domain} ahora`}
              className={`${TABLE_ACTION_BTN} text-text-muted hover:text-accent-green hover:bg-white/10 disabled:opacity-60`}
            >
              <RefreshCw
                size={16}
                className={isScanning ? "animate-spin text-accent-green" : ""}
              />
            </button>
          )}
          {needsReferenceAction && (
            <button
              type="button"
              disabled={isAcceptingRef}
              onClick={(e) => {
                if (e.detail > 0) e.currentTarget.blur();
                onAcceptReference(record);
              }}
              title="Definir como referencia"
              aria-label={`Definir valor actual de ${record.domain} como referencia`}
              className={`${TABLE_ACTION_BTN} text-text-muted hover:text-emerald-400 hover:bg-white/10 disabled:opacity-60`}
            >
              <CheckCircle2 size={16} />
            </button>
          )}
        </>
      }
    />
  );
}
