import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import type { MonitoringTarget } from "../../types/monitoring";
const labels: Record<string, string> = {
  ssl: "SSL",
  dns: "DNS",
  domain: "Dominio",
  api: "API",
  security: "Security Headers",
};
export default function CoverageProgress({ id }: { id: string }) {
  const organization = useAuthStore((s) => s.user?.organization?.id);
  const query = useQuery<MonitoringTarget>({
    queryKey: ["coverage-progress", organization, id],
    queryFn: async ({ signal }) =>
      (await api.get(`monitoring/${id}/`, { signal })).data.data,
    refetchInterval: (q) =>
      q.state.data?.coverage_status?.state === "queued" ? 5000 : false,
    refetchIntervalInBackground: false,
  });
  const status = query.data?.coverage_status;
  return (
    <section className="text-left border border-border-base rounded-xl p-4 text-sm space-y-3">
      <h3 className="font-semibold">Aprovisionamiento por módulo</h3>
      {query.isError ? (
        <p role="alert">
          No se pudo leer el resultado.{" "}
          <button
            className="text-accent-green min-h-11"
            onClick={() => void query.refetch()}
          >
            Reintentar lectura
          </button>
        </p>
      ) : status?.state === "queued" ? (
        <p>
          Preparando los módulos seleccionados. Puedes salir y revisar después.
        </p>
      ) : status?.state === "failed" ? (
        <p className="text-accent-yellow">
          No se pudo admitir el aprovisionamiento. El monitor está guardado;
          revisa sus vínculos para completar la cobertura.
        </p>
      ) : status?.state === "completed" ? (
        <ul className="space-y-2">
          {!status.created?.length &&
            !status.existing?.length &&
            !Object.keys(status.failed || {}).length && (
              <li>Sin módulos adicionales seleccionados.</li>
            )}
          {status.created?.map((m) => (
            <li key={m}>{labels[m] || m}: recurso creado</li>
          ))}
          {status.existing?.map((m) => (
            <li key={m}>{labels[m] || m}: recurso existente vinculado</li>
          ))}
          {Object.keys(status.failed || {}).map((m) => (
            <li key={m} className="text-accent-yellow">
              {labels[m] || m}: pendiente de configurar; revisa permiso y cuota.
            </li>
          ))}
        </ul>
      ) : (
        <p>Resultado de aprovisionamiento sin confirmar.</p>
      )}
      <p className="text-text-muted">
        Registrar recursos no configura avisos automáticamente. Selecciona una
        regla y un canal de notificación.
      </p>
      <div className="flex flex-wrap gap-4">
        <Link
          className="min-h-11 inline-flex items-center text-accent-green"
          to={`/monitoring/${id}`}
        >
          Ver objetivo y cobertura
        </Link>
        <Link
          className="min-h-11 inline-flex items-center text-accent-green"
          to="/alerts"
        >
          Configurar regla de aviso
        </Link>
        <Link
          className="min-h-11 inline-flex items-center text-accent-green"
          to="/notifications"
        >
          Configurar canal
        </Link>
      </div>
    </section>
  );
}
