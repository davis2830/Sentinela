import { hasCapability } from "../../hooks/useCapability";
import { useAuthStore } from "../../store/authStore";
import type { ResourceAction } from "./ResourceActions";
import "./resource-controls.css";

/** Direct resource actions with compact visuals and independent pointer targets. */
export default function ResourceActionButtons({
  label,
  actions,
}: {
  label: string;
  actions: ResourceAction[];
}) {
  const user = useAuthStore((state) => state.user);
  const allowed = actions.filter(
    (action) => !action.capability || hasCapability(user, action.capability),
  );
  if (!allowed.length) return null;
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex shrink-0 items-center"
      onClick={(event) => event.stopPropagation()}
    >
      {allowed.map((action) => (
        <button
          key={action.label}
          type="button"
          aria-label={action.label}
          title={action.label}
          disabled={action.disabled}
          data-danger={action.danger || undefined}
          onClick={(event) => {
            event.stopPropagation();
            action.onClick(event);
          }}
          className="resource-action-button grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-transparent p-0 text-text-dim disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-lg transition-colors"
          >
            {action.icon}
          </span>
        </button>
      ))}
    </div>
  );
}
