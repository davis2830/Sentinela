import { Check } from "lucide-react";
import type { MouseEvent } from "react";
import { hasCapability, type Capability } from "../../hooks/useCapability";
import { useAuthStore } from "../../store/authStore";
import "./resource-controls.css";

/** Compact 16px selection mark inside a 24px target aligned with tableTokens. */
export default function SelectionCheckbox({
  checked,
  label,
  onChange,
  capability,
  className = "",
}: {
  checked: boolean;
  label: string;
  onChange: (event: MouseEvent<HTMLButtonElement>) => void;
  capability?: Capability;
  className?: string;
}) {
  const user = useAuthStore((state) => state.user);
  if (capability && !hasCapability(user, capability)) return null;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={checked ? "Deseleccionar" : "Seleccionar"}
      onClick={(event) => {
        event.stopPropagation();
        onChange(event);
      }}
      className={`sentinel-selection compact-btn grid h-6 w-6 shrink-0 place-items-center rounded bg-transparent p-0 cursor-pointer ${className}`}
    >
      <span
        aria-hidden="true"
        className={`grid h-4 w-4 shrink-0 place-items-center rounded transition-colors ${checked ? "bg-accent-green text-black ring-1 ring-accent-green/40" : "border border-border-base/90 bg-bg-dark/80 text-transparent"}`}
      >
        <Check
          size={10}
          strokeWidth={3}
          className={checked ? "opacity-100" : "opacity-0"}
        />
      </span>
    </button>
  );
}
