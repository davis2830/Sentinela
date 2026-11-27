import { useState } from "react";
import {
  Check,
  Copy,
  GitBranch,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCapability } from "../../hooks/useCapability";
import type { SSLCertificate } from "../../types/ssl";
import RowActionMenu, {
  type RowActionMenuItem,
} from "../common/connectivity/RowActionMenu";
import { TABLE_ACTION_BTN } from "../common/connectivity/tableTokens";

interface SSLCertificateRowActionsProps {
  cert: SSLCertificate;
  variant?: "table" | "card";
  isScanning: boolean;
  onScan: (cert: SSLCertificate) => void;
  onViewChain: (cert: SSLCertificate) => void;
  onEdit: (cert: SSLCertificate) => void;
  onDelete: (cert: SSLCertificate) => void;
}

/**
 * Compact SSL actions built over shared RowActionMenu:
 * - Direct button: Revalidar ahora (RefreshCw)
 * - Portal overflow menu (⋯): Ver cadena, Copiar huella SHA-256, Editar dominio, Eliminar certificado.
 */
export default function SSLCertificateRowActions({
  cert,
  variant = "table",
  isScanning,
  onScan,
  onViewChain,
  onEdit,
  onDelete,
}: SSLCertificateRowActionsProps) {
  const [copiedFp, setCopiedFp] = useState(false);
  const [closeSignal, setCloseSignal] = useState(0);

  const canScan = useCapability("ssl_monitor.scan");
  const canEdit = useCapability("ssl_monitor.update");
  const canDelete = useCapability("ssl_monitor.delete");

  const handleCopyFp = async () => {
    if (!cert.fingerprint) return;
    try {
      await navigator.clipboard.writeText(cert.fingerprint);
      setCopiedFp(true);
      setTimeout(() => {
        setCopiedFp(false);
        setCloseSignal((n) => n + 1);
      }, 900);
    } catch {
      setCloseSignal((n) => n + 1);
    }
  };

  const items: RowActionMenuItem[] = [
    {
      id: "view-chain",
      label: "Ver cadena",
      icon: <GitBranch size={13} className="text-emerald-400 shrink-0" />,
      onClick: () => onViewChain(cert),
    },
    ...(cert.fingerprint
      ? [
          {
            id: "copy-fp",
            label: copiedFp ? "Huella copiada" : "Copiar huella",
            icon: copiedFp ? (
              <Check size={13} className="text-accent-green shrink-0" />
            ) : (
              <Copy size={13} className="text-sky-400 shrink-0" />
            ),
            keepOpen: true,
            onClick: handleCopyFp,
          },
        ]
      : []),
    ...(canEdit
      ? [
          {
            id: "edit",
            label: "Editar dominio",
            icon: <Pencil size={13} className="text-text-muted shrink-0" />,
            onClick: () => onEdit(cert),
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            id: "delete",
            label: "Eliminar certificado",
            icon: <Trash2 size={13} className="shrink-0" />,
            danger: true,
            dividerBefore: true,
            onClick: () => onDelete(cert),
          },
        ]
      : []),
  ];

  return (
    <RowActionMenu
      resourceLabel={cert.domain}
      variant={variant}
      forceVisible={isScanning}
      triggerTitle="Más acciones (cadena, huella, editar, eliminar)"
      menuWidth={208}
      estimatedHeight={180}
      closeSignal={closeSignal}
      items={items}
      directActions={
        canScan ? (
          <button
            type="button"
            disabled={isScanning}
            onClick={(e) => {
              if (e.detail > 0) e.currentTarget.blur();
              onScan(cert);
            }}
            title="Comprobar certificado ahora"
            aria-label={`Comprobar ${cert.domain} ahora`}
            className={`${TABLE_ACTION_BTN} text-text-dim hover:text-accent-green hover:bg-white/10 disabled:opacity-60`}
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
