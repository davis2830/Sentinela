import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Radio } from "lucide-react";
import { api } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import type { AgentProbe } from "../../types/agent_probe";

export default function ProbeConnectionCheck({
  id,
  expanded = false,
}: {
  id: string;
  expanded?: boolean;
}) {
  const [open, setOpen] = useState(expanded);
  const organization = useAuthStore((s) => s.user?.organization?.id);
  const query = useQuery<AgentProbe>({
    queryKey: ["agent-probe-detail", organization, id],
    enabled: open,
    queryFn: async ({ signal }) =>
      (await api.get(`agent-probes/${id}/detail/`, { signal })).data.data,
    staleTime: 0,
    refetchInterval: open ? 15000 : false,
    refetchIntervalInBackground: false,
  });
  const probe = query.data;

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-border-base bg-bg-dark/40 text-text-muted hover:text-text-main hover:bg-white/5 transition-colors disabled:opacity-50"
        aria-expanded={open}
        disabled={open && query.isFetching}
        onClick={() => (open ? void query.refetch() : setOpen(true))}
      >
        <Radio size={14} className={open && query.isFetching ? "animate-spin" : ""} />
        {open && query.isFetching ? "Consultando…" : "Consultar estado del agente"}
      </button>
      {open && (
        <section
          className="rounded-xl border border-border-base bg-bg-dark/60 p-4 space-y-3 text-sm"
          aria-live="polite"
        >
          {query.isError ? (
            <p className="text-accent-red">No se pudo consultar Sentinel. Vuelve a intentarlo.</p>
          ) : !probe ? (
            <p className="text-text-muted">Consultando el registro de señales…</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <strong className="text-text-main">
                  {probe.name} ·{" "}
                  <span
                    className={
                      probe.revoked_at
                        ? "text-accent-red"
                        : !probe.last_heartbeat
                          ? "text-accent-yellow"
                          : probe.is_online
                            ? "text-accent-green"
                            : "text-text-muted"
                    }
                  >
                    {probe.revoked_at
                      ? "Acceso revocado"
                      : !probe.last_heartbeat
                        ? "Esperando la primera señal"
                        : probe.is_online
                          ? "Conectado"
                          : "Sin señal reciente"}
                  </span>
                </strong>
              </div>
              <dl className="grid gap-2 sm:grid-cols-2 text-xs">
                <div className="p-2.5 rounded-lg bg-black/20 border border-white/5">
                  <dt className="text-text-muted">Última señal</dt>
                  <dd className="font-mono text-text-main mt-0.5">
                    {probe.last_heartbeat
                      ? new Date(probe.last_heartbeat).toLocaleString()
                      : "Ninguna recibida"}
                  </dd>
                </div>
                <div className="p-2.5 rounded-lg bg-black/20 border border-white/5">
                  <dt className="text-text-muted">Última entrega de resultados</dt>
                  <dd className="font-mono text-text-main mt-0.5">
                    {probe.delivery?.last_received_at
                      ? new Date(probe.delivery.last_received_at).toLocaleString()
                      : "Sin entrega registrada"}
                  </dd>
                </div>
              </dl>
              {!probe.revoked_at && !probe.is_online && (
                <details className="text-xs text-text-muted bg-black/30 border border-white/5 rounded-lg p-3">
                  <summary className="cursor-pointer text-accent-green font-medium">
                    Comprobar la instalación en la VM
                  </summary>
                  <p className="my-2">
                    Ejecuta el diagnóstico dentro del contenedor. Revisa el acceso al token y la
                    conexión HTTPS con Sentinel.
                  </p>
                  <code className="block p-2 rounded bg-black/50 text-slate-200 font-mono overflow-x-auto text-[11px]">
                    docker exec senti9-{probe.id.slice(0, 8)} python -m diagnostics
                  </code>
                </details>
              )}
              <p className="text-[11px] text-text-muted">
                Consultado a las {new Date(query.dataUpdatedAt).toLocaleTimeString()}
              </p>
            </>
          )}
          {!expanded && (
            <button
              type="button"
              className="text-xs text-accent-green hover:underline inline-flex items-center gap-1 font-medium"
              onClick={() => setOpen(false)}
            >
              Cerrar consulta
            </button>
          )}
        </section>
      )}
    </div>
  );
}
