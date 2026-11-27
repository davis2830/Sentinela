import { useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCapability } from "../../hooks/useCapability";
import type { APICheckTarget } from "../../types/api_checks";
import RowActionMenu, {
  type RowActionMenuItem,
} from "../common/connectivity/RowActionMenu";
import { TABLE_ACTION_BTN } from "../common/connectivity/tableTokens";
import { buildSafeCurl } from "./useAPIChecks";

interface APICheckRowActionsProps {
  target: APICheckTarget;
  variant?: "table" | "card";
  isScanning: boolean;
  onScan: (target: APICheckTarget) => void;
  onEdit: (target: APICheckTarget) => void;
  onDelete: (target: APICheckTarget) => void;
}

/**
 * Compact API Check actions built over shared RowActionMenu:
 * - Direct button: Comprobar ahora (RefreshCw)
 * - Portal overflow menu (⋯): Copiar cURL seguro, Abrir URL, Editar endpoint, Eliminar endpoint.
 */
export default function APICheckRowActions({
  target,
  variant = "table",
  isScanning,
  onScan,
  onEdit,
  onDelete,
}: APICheckRowActionsProps) {
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [closeSignal, setCloseSignal] = useState(0);

  const canScan = useCapability("api_checks.scan");
  const canEdit = useCapability("api_checks.update");
  const canDelete = useCapability("api_checks.delete");

  const handleCopyCurl = async () => {
    try {
      await navigator.clipboard.writeText(buildSafeCurl(target));
      setCopiedCurl(true);
      setTimeout(() => {
        setCopiedCurl(false);
        setCloseSignal((n) => n + 1);
      }, 900);
    } catch {
      setCloseSignal((n) => n + 1);
    }
  };

  const items: RowActionMenuItem[] = [
    {
      id: "copy-curl",
      label: copiedCurl ? "cURL copiado" : "Copiar cURL",
      icon: copiedCurl ? (
        <Check size={13} className="text-accent-green shrink-0" />
      ) : (
        <Copy size={13} className="text-sky-400 shrink-0" />
      ),
      keepOpen: true,
      onClick: handleCopyCurl,
    },
    {
      id: "open-url",
      label: "Abrir URL",
      icon: <ExternalLink size={13} className="text-text-muted shrink-0" />,
      onClick: () => {
        window.open(target.url, "_blank", "noopener,noreferrer");
      },
    },
    ...(canEdit
      ? [
          {
            id: "edit",
            label: "Editar endpoint",
            icon: <Pencil size={13} className="text-text-muted shrink-0" />,
            onClick: () => onEdit(target),
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            id: "delete",
            label: "Eliminar endpoint",
            icon: <Trash2 size={13} className="shrink-0" />,
            danger: true,
            dividerBefore: true,
            onClick: () => onDelete(target),
          },
        ]
      : []),
  ];

  return (
    <RowActionMenu
      resourceLabel={target.name}
      variant={variant}
      forceVisible={isScanning}
      triggerTitle="Más acciones (copiar cURL, abrir URL, editar, eliminar)"
      menuWidth={212}
      estimatedHeight={175}
      closeSignal={closeSignal}
      items={items}
      directActions={
        canScan ? (
          <button
            type="button"
            disabled={isScanning}
            onClick={(e) => {
              if (e.detail > 0) e.currentTarget.blur();
              onScan(target);
            }}
            title="Comprobar endpoint ahora"
            aria-label={`Comprobar ${target.name} ahora`}
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
