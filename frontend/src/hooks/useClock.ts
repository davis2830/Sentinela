import { useSyncExternalStore } from "react";

// One presentation clock for refresh, scan availability and pending progress.
const listeners = new Set<() => void>();
let current = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;
export function subscribeClock(listener: () => void) {
  listeners.add(listener);
  if (!timer)
    timer = setInterval(() => {
      if (document.hidden) return;
      current = Date.now();
      listeners.forEach((fn) => fn());
    }, 1000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}
export function useClock() {
  return useSyncExternalStore(subscribeClock, () => current);
}
