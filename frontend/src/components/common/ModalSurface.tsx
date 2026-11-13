import type { ReactNode } from "react";
import { useDialogFocus } from "../../hooks/useDialogFocus";

export default function ModalSurface({
  label,
  onClose,
  className,
  children,
  focusKey,
}: {
  label: string;
  onClose: () => void;
  className: string;
  children: ReactNode;
  focusKey?: string | number;
}) {
  const ref = useDialogFocus(true, focusKey);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      className={className}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      {children}
    </div>
  );
}
