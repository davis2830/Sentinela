import { api } from "../services/api";

export interface QueuedScan {
  task_id: string;
  resource_id: string;
  status: "queued";
  submitted_at: string;
  execution_id?: string;
}
const notify = (message: string) =>
  window.dispatchEvent(
    new CustomEvent("sentinel:scan-feedback", { detail: message }),
  );
const sleep = () => new Promise((resolve) => setTimeout(resolve, 2000));

/** Read-only waiting. Navigation ends this wait; admission is never retried here. */
export async function waitForFreshScan<T>(
  queued: QueuedScan,
  fetchResource: () => Promise<T>,
  getScanTimestamp: (resource: T) => string | null | undefined,
): Promise<T | null> {
  const path = window.location.pathname;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  window.addEventListener("sentinel:screen-left", cancel);
  const deadline = Date.now() + 120_000;
  notify(
    "Comprobación aceptada. Esperando ejecución; no es todavía un resultado del servicio.",
  );
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
            notify(
              state === "failed"
                ? "No se pudo completar la medición. El estado del servicio no está confirmado. Revisa el detalle antes de reintentar."
                : "La ejecución venció sin resultado confirmado. No se repetirá automáticamente.",
            );
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
          notify(
            "Medición registrada. Revisa su resultado y fecha en la ficha.",
          );
          return resource;
        }
      } catch {
        if (controller.signal.aborted) return null;
        notify(
          "No se pudo leer el progreso. La comprobación puede continuar; actualizar los datos no la repetirá.",
        );
        return null;
      }
    }
  } finally {
    window.removeEventListener("sentinel:screen-left", cancel);
  }
  if (path === window.location.pathname && !controller.signal.aborted)
    notify(
      "La medición sigue sin confirmar. Puedes salir y consultar su estado en la ficha; no se ha repetido.",
    );
  return null;
}
