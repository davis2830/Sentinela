import AdminButton from "../common/AdminButton";
export { default as TargetSelectionCheckbox } from "../common/SelectionCheckbox";

/** The switch stays 36×20 px inside a transparent 44×44 px hit target. */
export function TargetEnabledSwitch({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: () => void;
}) {
  const label = enabled ? "Pausar monitoreo" : "Activar monitoreo";
  return (
    <AdminButton
      capability="monitoring.update"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      title={label}
      onClick={onChange}
      className="ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-transparent p-0"
    >
      <span
        aria-hidden="true"
        className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${enabled ? "bg-accent-green" : "bg-bg-dark ring-1 ring-inset ring-border-base"}`}
      >
        <span
          className={`h-4 w-4 shrink-0 rounded-full shadow-sm transition-transform motion-reduce:transition-none ${enabled ? "translate-x-4 bg-black" : "translate-x-0 bg-text-dim"}`}
        />
      </span>
    </AdminButton>
  );
}
