/** Identity generation is independent of React, Axios and either query client. */
let generation = 0;
let controller = new AbortController();
const listeners = new Set<() => void>();

export const sessionGeneration = () => generation;
export const sessionSignal = () => controller.signal;
export function advanceSession() {
  generation += 1;
  controller.abort();
  controller = new AbortController();
  listeners.forEach((listener) => listener());
}
export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
let identity = "";
export const identityKey = (
  user: { id?: string; organization?: { id?: string } } | null | undefined,
  sessionId?: string | null,
) =>
  JSON.stringify([
    user?.id || null,
    user?.organization?.id || null,
    sessionId || null,
  ]);
export const sessionIdentity = () => identity;
export function bindIdentity(value: string) {
  identity = value;
}
export function storedIdentity() {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem("auth-storage") || "{}",
    );
    if (typeof value !== "object" || !value || !("state" in value))
      return identityKey(null);
    const state = value.state as {
      user?: { id?: string; organization?: { id?: string } };
      sessionId?: string;
    };
    return identityKey(state.user, state.sessionId);
  } catch {
    return identityKey(null);
  }
}
