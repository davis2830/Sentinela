import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ModalSurface from "../components/common/ModalSurface";

export function useConfirmation() {
  const [message, setMessage] = useState<string | null>(null);
  const pending = useRef<((accepted: boolean) => void) | null>(null);
  const settle = (accepted: boolean) => {
    pending.current?.(accepted);
    pending.current = null;
    setMessage(null);
  };
  useEffect(
    () => () => {
      pending.current?.(false);
    },
    [],
  );
  return {
    ask: (text: string) =>
      new Promise<boolean>((resolve) => {
        pending.current?.(false);
        pending.current = resolve;
        setMessage(text);
      }),
    dialog: message
      ? createPortal(
          <div className="fixed inset-0 z-[90] grid place-items-center bg-black/75 p-4">
            <ModalSurface
              label="Eliminar selección"
              onClose={() => settle(false)}
              className="ui-card w-full max-w-md p-6"
            >
              <h2 className="text-xl font-semibold">Eliminar selección</h2>
              <p className="my-4 text-sm text-text-muted">
                {message} La eliminación no se puede deshacer.
              </p>
              <div className="flex justify-end gap-3">
                <button className="ui-button" onClick={() => settle(false)}>
                  Cancelar
                </button>
                <button
                  className="ui-button bg-accent-red text-white"
                  onClick={() => settle(true)}
                >
                  Eliminar selección
                </button>
              </div>
            </ModalSurface>
          </div>,
          document.body,
        )
      : null,
  };
}
