import { apiFailure } from "../../services/errors";
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import ModalSurface from "../common/ModalSurface";
import { ActionButton } from "./PlatformUI";
import { ShieldAlert, SlidersHorizontal, FileText } from "lucide-react";

export default function PlatformActionModal({
  title,
  description,
  onClose,
  onConfirm,
  children,
  confirmDisabled = false,
  confirmLabel,
  destructive = false,
  onSuccess,
}: {
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<unknown>;
  children?: ReactNode;
  confirmDisabled?: boolean;
  confirmLabel?: string;
  destructive?: boolean;
  onSuccess?: (message: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return createPortal(
    <div className="platform-console fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
      <ModalSurface
        label={title}
        onClose={() => {
          if (!busy) onClose();
        }}
        className="platform-administrative-dialog ui-card max-h-[92vh] w-full max-w-2xl overflow-y-auto p-5 sm:p-7"
      >
        <form
          className="space-y-5"
          onSubmit={async (event) => {
            event.preventDefault();
            if (confirmDisabled || busy || reason.trim().length < 3) return;
            setBusy(true);
            setError("");
            try {
              await onConfirm(reason.trim());
              onSuccess?.(`${confirmLabel || title}: cambio registrado.`);
              onClose();
            } catch (caughtError: unknown) {
              const err = apiFailure(caughtError);
              setError(
                err.response?.data?.message ||
                  "No se pudo aplicar el cambio. Revisa los datos y reintenta.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <header className="flex items-start gap-4">
            <span
              className={
                "grid h-12 w-12 shrink-0 place-items-center rounded-xl border " +
                (destructive
                  ? "border-rose-400/25 bg-rose-400/10 text-rose-300"
                  : "border-accent-green/25 bg-accent-green/10 text-accent-green")
              }
            >
              {destructive ? (
                <ShieldAlert size={23} aria-hidden="true" />
              ) : (
                <SlidersHorizontal size={23} aria-hidden="true" />
              )}
            </span>
            <div>
              <p className="platform-eyebrow">
                {destructive ? "ACCIÓN SENSIBLE" : "CAMBIO ADMINISTRATIVO"}
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">
                {title}
              </h2>
            </div>
          </header>
          <div
            className={
              "border-l-2 py-1 pl-4 " +
              (destructive ? "border-rose-400/60" : "border-accent-green/40")
            }
          >
            <p className="text-sm leading-relaxed whitespace-pre-line text-text-muted">
              {description}
            </p>
          </div>
          {children && (
            <div className="space-y-4 border-y border-border-base py-5">
              {children}
            </div>
          )}
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <FileText
                size={16}
                className="text-text-muted"
                aria-hidden="true"
              />
              Registro del cambio
            </p>
            <label className="block text-sm font-medium">
              Motivo para auditoría
              <textarea
                required
                minLength={3}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="platform-field"
                placeholder="Explica qué necesitas resolver con este cambio…"
              />
            </label>
            <p className="mt-2 text-xs text-text-muted">
              El motivo quedará en el historial administrativo. No incluyas
              contraseñas ni claves.
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-accent-red">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3 border-t border-border-base pt-5">
            <ActionButton tone="tertiary" disabled={busy} onClick={onClose}>
              Cancelar
            </ActionButton>
            <ActionButton
              type="submit"
              tone={destructive ? "danger" : "primary"}
              disabled={confirmDisabled || busy || reason.trim().length < 3}
            >
              {busy ? "Aplicando…" : confirmLabel || title}
            </ActionButton>
          </div>
        </form>
      </ModalSurface>
    </div>,
    document.body,
  );
}
