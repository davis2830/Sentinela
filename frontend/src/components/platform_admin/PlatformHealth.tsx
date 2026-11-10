import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Clock3,
  Copy,
  Database,
  HelpCircle,
  Layers3,
  MailWarning,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { platformApi } from "../../services/platformApi";
import { ActionButton } from "./PlatformUI";
import DataConsultationAge from "../common/DataConsultationAge";
import type { PlatformHealth as Health } from "../../types/platform_beta";

const components = {
  database: {
    label: "PostgreSQL",
    description: "Persistencia de organizaciones, usuarios y actividad",
    icon: Database,
  },
  redis_cache: {
    label: "Caché Redis",
    description: "Datos temporales y caché de la aplicación",
    icon: Layers3,
  },
  celery_broker: {
    label: "Broker Celery",
    description: "Entrega de trabajos a los procesos de ejecución",
    icon: Boxes,
  },
  celery_workers: {
    label: "Workers",
    description: "Respuesta de los procesos de ejecución",
    icon: ServerCog,
  },
};
const labels: Record<string, string> = Object.fromEntries(
  Object.entries(components).map(([key, item]) => [key, item.label]),
);
const states: Record<string, string> = {
  healthy: "Saludable",
  unhealthy: "Con fallo",
  degraded: "Degradado",
  unavailable: "No disponible",
};
const queues: Record<string, string> = {
  high_priority: "Prioridad alta",
  monitoring: "Monitoreo",
  background: "Segundo plano",
  celery: "Cola general",
};

export default function PlatformHealth({
  active,
  onMailFailures,
}: {
  active: boolean;
  onMailFailures: () => void;
}) {
  const [copied, setCopied] = useState("");
  const query = useQuery<Health>({
    queryKey: ["platform-health"],
    enabled: active,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: false,
    queryFn: async ({ signal }) =>
      (await platformApi.get("platform-admin/health/", { signal })).data.data,
  });
  const copy = async () => {
    if (!query.data) return;
    const data = query.data;
    const text = [
      "Diagnóstico de Sentinel",
      new Date(data.queried_at).toLocaleString("es-GT"),
      "Estado: " + (states[data.status] || "Desconocido"),
      ...Object.entries(data.components).map(
        ([key, value]) =>
          (labels[key] || key) +
          ": " +
          (states[value.status] || "Desconocido") +
          (typeof value.latency_ms === "number"
            ? " · " + value.latency_ms + " ms"
            : ""),
      ),
      ...data.queues.map(
        (q) =>
          q.name +
          ": " +
          (q.ready === null ? "No disponible" : q.ready + " mensajes listos"),
      ),
      data.scope,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied("Diagnóstico copiado.");
    } catch {
      setCopied("No se pudo copiar. Verifica el permiso del portapapeles.");
    }
  };
  const statusPriority = (value: string) =>
    value === "unhealthy" ? 0 : value === "healthy" ? 2 : 1;
  const componentRows = Object.entries(query.data?.components || {}).sort(
    (a, b) => statusPriority(a[1].status) - statusPriority(b[1].status),
  );
  const issues = [
    ...componentRows
      .filter(([, value]) => value.status !== "healthy")
      .map(([key]) => labels[key] || key),
    ...(query.data?.queues || [])
      .filter((queue) => queue.ready === null)
      .map((queue) => "Cola " + (queues[queue.name] || queue.name)),
  ];
  const status = query.data?.status;
  const healthy = status === "healthy";
  const StatusIcon = !query.data
    ? HelpCircle
    : healthy
      ? ShieldCheck
      : Activity;
  return (
    <section className="space-y-5" aria-label="Diagnóstico operativo">
      <div className="platform-control-masthead flex flex-wrap items-center justify-between gap-5 border-b border-border-base pb-5">
        <div className="flex min-w-0 items-center gap-4">
          <div
            className={
              "grid h-14 w-14 shrink-0 place-items-center rounded-2xl border " +
              (!query.data
                ? "border-border-base bg-bg-card text-text-muted"
                : healthy
                  ? "border-accent-green/25 bg-accent-green/10 text-accent-green"
                  : "border-accent-yellow/30 bg-accent-yellow/10 text-accent-yellow")
            }
          >
            <StatusIcon size={26} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">
              Último diagnóstico
            </p>
            <h2 className="mt-1 text-xl font-semibold text-text-main">
              {!query.data
                ? "Diagnóstico pendiente"
                : healthy
                  ? "Servicios respondiendo"
                  : "Requiere revisión"}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
              {query.data && (
                <span
                  className="ui-status"
                  data-tone={
                    healthy
                      ? "success"
                      : status === "degraded"
                        ? "warning"
                        : "muted"
                  }
                >
                  {states[status || ""] || "Desconocido"}
                </span>
              )}
              <DataConsultationAge
                updatedAt={query.data ? Date.parse(query.data.queried_at) : 0}
              />
              <span className="inline-flex items-center gap-1">
                <ShieldCheck size={13} aria-hidden="true" /> Sólo lectura
              </span>
            </div>
            {issues.length > 0 && (
              <p className="mt-2 max-w-xl text-sm text-text-main">
                Revisar: {issues.join(" · ")}.
              </p>
            )}
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <ActionButton
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
              className={query.isFetching ? "animate-spin" : ""}
            />
            {query.isFetching ? "Consultando…" : "Actualizar diagnóstico"}
          </ActionButton>
          <ActionButton
            tone="tertiary"
            aria-label="Copiar diagnóstico"
            title="Copiar diagnóstico"
            className="min-w-11"
            disabled={!query.data}
            onClick={() => void copy()}
          >
            <Copy size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Copiar diagnóstico</span>
          </ActionButton>
        </div>
      </div>
      {copied && (
        <p
          role="status"
          className="rounded-xl border border-border-base bg-bg-card px-4 py-3 text-sm"
        >
          {copied}
        </p>
      )}
      {query.isPending && (
        <div
          role="status"
          className="flex items-center gap-3 py-10 text-sm text-text-muted"
        >
          <RefreshCw size={20} className="animate-spin" aria-hidden="true" />
          Consultando dependencias…
        </div>
      )}
      {query.isError && (
        <p
          role="alert"
          className="rounded-xl border border-accent-yellow/30 bg-accent-yellow/5 px-4 py-3 text-sm"
        >
          No se pudo consultar la salud de plataforma.{" "}
          {query.data
            ? "Los datos anteriores pueden estar desactualizados."
            : "No hay un diagnóstico disponible."}
        </p>
      )}
      {query.data && (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section
            className="min-w-0 overflow-hidden rounded-2xl border border-border-base bg-bg-card"
            aria-labelledby="platform-dependencies-title"
          >
            <header className="flex items-center justify-between gap-3 border-b border-border-base px-5 py-4">
              <div>
                <h2
                  id="platform-dependencies-title"
                  className="text-base font-semibold"
                >
                  Servicios de plataforma
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  Disponibilidad y duración de la comprobación.
                </p>
              </div>
              <Activity
                size={19}
                className="shrink-0 text-text-muted"
                aria-hidden="true"
              />
            </header>
            <div className="divide-y divide-border-base">
              {componentRows.map(([key, value]) => {
                const component = components[key as keyof typeof components];
                const Icon = component?.icon || ServerCog;
                const ResultIcon =
                  value.status === "healthy"
                    ? CheckCircle2
                    : value.status === "unhealthy"
                      ? XCircle
                      : HelpCircle;
                const tone =
                  value.status === "healthy"
                    ? "success"
                    : value.status === "unhealthy"
                      ? "danger"
                      : "muted";
                return (
                  <div
                    key={key}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border-base bg-bg-dark text-text-muted">
                        <Icon size={19} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-text-main">
                          {component?.label || key}
                        </h3>
                        {component && (
                          <p className="mt-1 text-xs leading-relaxed text-text-muted">
                            {component.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="ml-auto min-w-28 text-right">
                      <span
                        className="ui-tone inline-flex items-center gap-1.5 text-sm font-medium"
                        data-tone={tone}
                      >
                        <ResultIcon size={15} aria-hidden="true" />
                        {states[value.status] || "Desconocido"}
                      </span>
                      <p className="mt-1 flex items-center justify-end gap-1 text-xs tabular-nums text-text-muted">
                        <Clock3 size={12} aria-hidden="true" />
                        {typeof value.latency_ms !== "number"
                          ? "Latencia no disponible"
                          : value.latency_ms + " ms"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <section
            className="min-w-0 overflow-hidden rounded-2xl border border-border-base bg-bg-card"
            aria-labelledby="platform-queues-title"
          >
            <header className="flex items-center justify-between gap-3 border-b border-border-base px-5 py-4">
              <div>
                <h2
                  id="platform-queues-title"
                  className="text-base font-semibold"
                >
                  Colas de trabajo
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  Mensajes listos para su ejecución.
                </p>
              </div>
              <Boxes
                size={19}
                className="shrink-0 text-text-muted"
                aria-hidden="true"
              />
            </header>
            <dl className="divide-y divide-border-base">
              {query.data.queues.map((q) => (
                <div
                  key={q.name}
                  className="flex items-center justify-between gap-3 px-5 py-4"
                >
                  <dt className="min-w-0">
                    <span className="block text-sm font-medium">
                      {queues[q.name] || q.name}
                    </span>
                    <code className="mt-1 block break-all text-xs text-text-muted">
                      {q.name}
                    </code>
                  </dt>
                  <dd className="shrink-0 text-right">
                    <span
                      className={
                        "block tabular-nums " +
                        (q.ready === null
                          ? "text-sm text-text-muted"
                          : "text-xl font-semibold")
                      }
                    >
                      {q.ready === null ? "No disponible" : q.ready + " listos"}
                    </span>
                    <span className="mt-1 block text-xs text-text-muted">
                      {q.ready === null ? "Fuente inaccesible" : "En espera"}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="border-t border-border-base bg-bg-dark/40 px-5 py-3 text-xs leading-relaxed text-text-muted">
              {query.data.scope}
            </p>
          </section>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border-base bg-bg-card/40 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <MailWarning
            size={19}
            className="shrink-0 text-accent-yellow"
            aria-hidden="true"
          />
          <div>
            <h3 className="text-sm font-medium">
              ¿El problema es un correo de invitación?
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              Revisa su etapa y último envío en el directorio de Beta.
            </p>
          </div>
        </div>
        <ActionButton tone="tertiary" onClick={onMailFailures}>
          Revisar fallos de correo en Beta
          <ArrowUpRight size={15} aria-hidden="true" />
        </ActionButton>
      </div>
    </section>
  );
}
