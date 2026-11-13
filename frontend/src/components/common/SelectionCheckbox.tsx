import { Check } from "lucide-react";
import type { MouseEvent } from "react";
import { hasCapability, type Capability } from "../../hooks/useCapability";
import { useAuthStore } from "../../store/authStore";
import "./resource-controls.css";

/** One 20 px selection mark inside an unpainted 44 px pointer target. */
export default function SelectionCheckbox({
  checked,
  label,
  onChange,
  capability,
}: {
  checked: boolean;
  label: string;
  onChange: (event: MouseEvent<HTMLButtonElement>) => void;
  capability?: Capability;
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
      className="sentinel-selection grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-transparent p-0"
    >
      <span
        aria-hidden="true"
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md transition-colors ${checked ? "bg-accent-green text-black ring-2 ring-accent-green/40" : "border border-border-base/90 bg-bg-dark/80 text-transparent"}`}
      >
        <Check
          size={12}
          strokeWidth={3}
          className={checked ? "opacity-100" : "opacity-0"}
        />
      </span>
    </button>
  );
}
