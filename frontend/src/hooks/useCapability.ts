import { useAuthStore } from "../store/authStore";
import type { User } from "../types";

export type Capability = string | readonly string[];
export function hasCapability(user: User | null, capability: Capability) {
  if (!user?.is_active) return false;
  if (user.is_staff || user.is_superuser) return true;
  const required = typeof capability === "string" ? [capability] : capability;
  if (user.authorization_mode !== "custom")
    return required.every((code) => code.endsWith(".read"));
  return required.every(
    (code) => user.effective_permissions?.includes(code) === true,
  );
}
export function useCapability(capability: Capability) {
  return useAuthStore((state) => hasCapability(state.user, capability));
}
