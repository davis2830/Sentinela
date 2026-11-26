import { api } from "../services/api";

export interface QueuedScan {
  task_id: string;
  resource_id: string;
  status: "queued";
  submitted_at: string;
  execution_id?: string;
}

export type ScanFeedbackTone = "info" | "success" | "warning" | "danger";

export interface ScanFeedbackPayload {
  message: string;
  tone?: ScanFeedbackTone;
  actionLabel?: string;
  onAction?: () => void;
  /** Auto-dismiss delay in ms. Defaults to 4500ms. */
  durationMs?: number;
}

export interface WaitForFreshScanOptions<T> {
  /** Short target/domain label for in-progress toast (e.g. "gctorque.com"). */
  label?: string;
  /** Formats the completed scan into a concise 1-line summary (e.g. "gctorque.com · 83 ms · Propagando"). */
  formatResult?: (resource: T) => ScanFeedbackPayload | string;
  /** Optional handler invoked when user clicks "Ver" in the completion toast. */
  onView?: (resource: T) => void;
}

export const emitScanFeedback = (detail: string | ScanFeedbackPayload) =>
  window.dispatchEvent(new CustomEvent("sentinel:scan-feedback", { detail }));

const sleep = () => new Promise((resolve) => setTimeout(resolve, 2000));

/** Read-only waiting. Navigation ends this wait; admission is never retried here. */
export async function waitForFreshScan<T>(
  queued: QueuedScan,
  fetchResource: () => Promise<T>,
  getScanTimestamp: (resource: T) => string | null | undefined,
  options?: WaitForFreshScanOptions<T>,
): Promise<T | null> {
  const path = window.location.pathname;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  window.addEventListener("sentinel:screen-left", cancel);
  const deadline = Date.now() + 120_000;

  emitScanFeedback({
    message: options?.label
      ? `Comprobando ${options.label}...`
      : "Comprobación en curso...",
    tone: "info",
    durationMs: 4500,
  });

  try {
    while (
      Date.now() < deadline &&
      path === window.location.pathname &&
      !controller.signal.aborted
    ) {
      await sleep();
      if (
        document.hidden ||
        path !== window.location.pathname ||
        controller.signal.aborted
      )
        continue;
      try {
        if (queued.execution_id) {
          const r = await api.get(`scan-executions/${queued.execution_id}/`, {
            signal: controller.signal,
          });
          const state = r.data.data.state as string;
          if (state === "failed" || state === "expired") {
            emitScanFeedback({
              message: options?.label
                ? `${options.label} · ${state === "failed" ? "no se pudo completar" : "tiempo agotado"}`
                : state === "failed"
                  ? "No se pudo completar la comprobación."
                  : "La comprobación venció sin respuesta.",
              tone: "danger",
              durationMs: 5000,
            });
            return null;
          }
          if (state === "queued" || state === "running") continue;
        }
        const resource = await fetchResource();
        if (controller.signal.aborted || path !== window.location.pathname)
          return null;
        const timestamp = getScanTimestamp(resource);
        if (
          timestamp &&
          Date.parse(timestamp) >= Date.parse(queued.submitted_at)
        ) {
          if (options?.formatResult) {
            const formatted = options.formatResult(resource);
            const payload: ScanFeedbackPayload =
              typeof formatted === "string"
                ? { message: formatted, tone: "success" }
                : formatted;
            emitScanFeedback({
              durationMs: 4500,
              ...payload,
              actionLabel:
                payload.actionLabel ?? (options.onView ? "Ver" : undefined),
              onAction:
                payload.onAction ??
                (options.onView ? () => options.onView?.(resource) : undefined),
            });
          } else {
            emitScanFeedback({
              message: options?.label
                ? `${options.label} · comprobación actualizada`
                : "Comprobación completada.",
              tone: "success",
              actionLabel: options?.onView ? "Ver" : undefined,
              onAction: options?.onView
                ? () => options.onView?.(resource)
                : undefined,
              durationMs: 4500,
            });
          }
          return resource;
        }
      } catch {
        if (controller.signal.aborted) return null;
        emitScanFeedback({
          message: "No se pudo consultar el resultado de la comprobación.",
          tone: "warning",
          durationMs: 4500,
        });
        return null;
      }
    }
  } finally {
    window.removeEventListener("sentinel:screen-left", cancel);
  }
  if (path === window.location.pathname && !controller.signal.aborted) {
    emitScanFeedback({
      message: options?.label
        ? `${options.label} · comprobación aún en curso`
        : "La comprobación sigue en curso.",
      tone: "warning",
      durationMs: 4500,
    });
  }
  return null;
}
