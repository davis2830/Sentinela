import { useState } from "react";
import { Check, Copy, GitBranch, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useCapability } from "../../hooks/useCapability";
import type { SSLCertificate } from "../../types/ssl";

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
 * Shared SSL row & card actions (homologated with Uptime & Guardianes):
 * - Revalidar ahora, Ver cadena, Copiar huella SHA-256, Editar dominio, Eliminar
 * - Visible on hover, keyboard focus-within, and always on touch devices
 * - Floating non-shifting overlay pill in cards.
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
  const canScan = useCapability("ssl_monitor.scan");
  const canEdit = useCapability("ssl_monitor.update");
  const canDelete = useCapability("ssl_monitor.delete");

  const handleCopyFp = async () => {
    if (!cert.fingerprint) return;
    try {
      await navigator.clipboard.writeText(cert.fingerprint);
      setCopiedFp(true);
      setTimeout(() => setCopiedFp(false), 1600);
    } catch {
      // ignore clipboard errors
    }
  };

  const visibilityClass = isScanning
    ? "opacity-100 pointer-events-auto"
    : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto transition-opacity duration-150";

  const wrapperClass =
    variant === "card"
      ? `flex items-center gap-0.5 rounded-lg border border-border-base/80 bg-bg-dark/95 backdrop-blur-sm px-0.5 py-0.5 shadow-lg absolute right-0 top-1/2 -translate-y-1/2 z-20 [@media(hover:none)]:static [@media(hover:none)]:translate-y-0 [@media(hover:none)]:border-0 [@media(hover:none)]:bg-transparent [@media(hover:none)]:p-0 [@media(hover:none)]:shadow-none ${visibilityClass}`
      : `flex items-center justify-end gap-0.5 ${visibilityClass}`;

  return (
    <div className={wrapperClass} onClick={(e) => e.stopPropagation()}>
      {canScan && (
        <button
          type="button"
          disabled={isScanning}
          onClick={() => onScan(cert)}
          title="Revalidar certificado ahora"
          aria-label={`Revalidar ${cert.domain}`}
          className="table-action-btn h-6 w-6 grid shrink-0 place-items-center rounded-md text-text-dim hover:text-accent-green hover:bg-white/10 disabled:opacity-60 transition-colors cursor-pointer !min-h-0 !min-w-0"
        >
          <RefreshCw size={13} className={isScanning ? "animate-spin text-accent-green" : ""} />
        </button>
      )}

      <button
        type="button"
        onClick={() => onViewChain(cert)}
        title="Ver cadena de certificación"
        aria-label={`Ver cadena de certificación de ${cert.domain}`}
        className="table-action-btn h-6 w-6 grid shrink-0 place-items-center rounded-md text-text-dim hover:text-emerald-400 hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
      >
        <GitBranch size={13} />
      </button>

      {cert.fingerprint && (
        <button
          type="button"
          onClick={() => void handleCopyFp()}
          title={copiedFp ? "Huella SHA-256 copiada" : "Copiar huella SHA-256"}
          aria-label={`Copiar huella SHA-256 de ${cert.domain}`}
          className="table-action-btn h-6 w-6 grid shrink-0 place-items-center rounded-md text-text-dim hover:text-sky-400 hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
        >
          {copiedFp ? (
            <Check size={13} className="text-accent-green" />
          ) : (
            <Copy size={13} />
          )}
        </button>
      )}

      {canEdit && (
        <button
          type="button"
          onClick={() => onEdit(cert)}
          title="Editar dominio o puerto"
          aria-label={`Editar ${cert.domain}`}
          className="table-action-btn h-6 w-6 grid shrink-0 place-items-center rounded-md text-text-dim hover:text-text-main hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
        >
          <Pencil size={13} />
        </button>
      )}

      {canDelete && (
        <button
          type="button"
          onClick={() => onDelete(cert)}
          title="Eliminar certificado"
          aria-label={`Eliminar ${cert.domain}`}
          className="table-action-btn h-6 w-6 grid shrink-0 place-items-center rounded-md text-text-dim hover:text-rose-400 hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}
