import AdminButton from "../common/AdminButton";
export { default as TargetSelectionCheckbox } from "../common/SelectionCheckbox";

export function TargetEnabledSwitch({
  enabled,
  onChange,
  size = "compact",
  activeLabel = "Pausar monitoreo",
  inactiveLabel = "Activar monitoreo",
}: {
  enabled: boolean;
  onChange: () => void;
  size?: "normal" | "compact";
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  const label = enabled ? activeLabel : inactiveLabel;
  const isCompact = size === "compact";

  return (
    <AdminButton
      capability="monitoring.update"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      title={label}
      onClick={onChange}
      className={`shrink-0 place-items-center rounded bg-transparent p-0 cursor-pointer !min-h-0 !min-w-0 ${
        isCompact ? "grid h-6 w-8" : "ml-2 grid h-11 w-11"
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-flex shrink-0 items-center rounded-full transition-colors ${
          isCompact
            ? `h-4 w-7 p-0.5 ${enabled ? "bg-accent-green" : "bg-bg-dark ring-1 ring-inset ring-border-base"}`
            : `h-5 w-9 p-0.5 ${enabled ? "bg-accent-green" : "bg-bg-dark ring-1 ring-inset ring-border-base"}`
        }`}
      >
        <span
          className={`shrink-0 rounded-full shadow-sm transition-transform motion-reduce:transition-none ${
            isCompact
              ? `h-3 w-3 ${enabled ? "translate-x-3 bg-black" : "translate-x-0 bg-text-dim"}`
              : `h-4 w-4 ${enabled ? "translate-x-4 bg-black" : "translate-x-0 bg-text-dim"}`
          }`}
        />
      </span>
    </AdminButton>
  );
}
