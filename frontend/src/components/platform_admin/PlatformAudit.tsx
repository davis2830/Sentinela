import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Filter,
  Fingerprint,
  History,
  Info,
  Search,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import ModalSurface from "../common/ModalSurface";
import EmptyState from "../common/EmptyState";
import { ActionButton } from "./PlatformUI";
import DataConsultationAge from "../common/DataConsultationAge";
import { platformApi } from "../../services/platformApi";

type Event = {
  id: string;
  timestamp: string;
  user_email: string;
  description: string;
  module: string;
  action: string;
  organization_id: string | null;
  result: string;
};
const empty = {
  email: "",
  organization: "",
  action: "",
  module: "",
  result: "",
  since: "",
  until: "",
  organization_id: "",
};
const date = (value: string) => new Date(value).toLocaleString("es-GT");
const resultLabel = (value: string) =>
  value === "failure"
    ? "Fallido"
    : value === "success"
      ? "Correcto"
      : "Sin resultado confirmado";

export default function PlatformAudit({
  operatorId,
  onOpenOrganization,
  active = true,
  seed,
}: {
  active?: boolean;
  seed?: { email?: string; organization_id?: string; nonce: number };
  operatorId: string;
  onOpenOrganization: (id: string) => void;
}) {
  const [draft, setDraft] = useState(empty);
  const [applied, setApplied] = useState<typeof empty | null>(null);
  const [page, setPage] = useState(1);
  useEffect(() => {
    if (seed) {
      setDraft({
        ...empty,
        email: seed.email || "",
        organization_id: seed.organization_id || "",
      });
      setApplied(null);
      setPage(1);
    }
  }, [seed]);
  const options = useQuery<{
    actions: { id: string; label: string }[];
    modules: { id: string; label: string }[];
  }>({
    queryKey: ["platform-audit-options"],
    enabled: active,
    queryFn: async () =>
      (await platformApi.get("platform-admin/audit-options/")).data.data,
  });
  const [eventId, setEventId] = useState<string | null>(null);
  const eventDetail = useQuery<Event>({
    queryKey: ["platform-audit-detail", eventId],
    enabled: !!eventId && active,
    queryFn: async ({ signal }) =>
      (
        await platformApi.get("platform-admin/audit-logs/" + eventId + "/", {
          signal,
        })
      ).data.data,
  });
  function quickRange(days: number) {
    const end = new Date();
    const start = new Date();
    end.setMinutes(end.getMinutes() + 1, 0, 0);
    if (days === 0) start.setHours(0, 0, 0, 0);
    else start.setDate(start.getDate() - days);
    const local = (value: Date) =>
      new Date(value.getTime() - value.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    setDraft((d) => ({ ...d, since: local(start), until: local(end) }));
  }
  const invalidRange =
    !!draft.since && !!draft.until && draft.since >= draft.until;
  const query = useQuery<{ events: Event[]; has_next: boolean }>({
    enabled: !!applied,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    queryKey: ["platform-admin-audit", operatorId, applied, page],
    queryFn: async ({ signal }) => {
      const params: Record<string, string | number> = { page };
      for (const [key, value] of Object.entries(applied || {})) {
        if (value.trim())
          params[key] =
            key === "since" || key === "until"
              ? new Date(value).toISOString()
              : value.trim();
      }
      return (
        await platformApi.get("platform-admin/audit-logs/", { params, signal })
      ).data.data;
    },
  });
  const actionLabel = (value: string) =>
    options.data?.actions.find((item) => item.id === value)?.label || value;
  const moduleLabel = (value: string) =>
    options.data?.modules.find((item) => item.id === value)?.label || value;
  const labelFor = (key: string, value: string) => {
    if (key === "since" || key === "until")
      return (key === "since" ? "Desde: " : "Hasta: ") + date(value);
    if (key === "organization_id") return "Organización seleccionada";
    if (key === "action") return "Acción: " + actionLabel(value);
    if (key === "module") return "Módulo: " + moduleLabel(value);
    if (key === "result") return resultLabel(value);
    return (key === "email" ? "Usuario: " : "Organización: ") + value;
  };
  const changed = applied && JSON.stringify(applied) !== JSON.stringify(draft);
  const advancedCount = [draft.action, draft.module, draft.result].filter(
    Boolean,
  ).length;
  return (
    <section className="space-y-5" aria-labelledby="platform-audit-title">
      <h2 id="platform-audit-title" className="sr-only">
        Eventos de auditoría
      </h2>
      <form
        className="platform-control-query overflow-hidden rounded-2xl border border-border-base bg-bg-card"
        onSubmit={(event) => {
          event.preventDefault();
          if (invalidRange) return;
          if (page === 1 && JSON.stringify(applied) === JSON.stringify(draft))
            void query.refetch();
          else {
            setApplied({ ...draft });
            setPage(1);
          }
        }}
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-base px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center gap-3">
            <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-green/10 text-accent-green sm:grid">
              <Fingerprint size={21} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold">
                Alcance de la consulta
              </h2>
              <p className="mt-1 hidden text-sm text-text-muted sm:block">
                Encuentra quién hizo un cambio y en qué contexto.
              </p>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-base bg-bg-dark px-3 py-1.5 text-xs font-medium text-text-muted">
              <ShieldCheck size={13} aria-hidden="true" /> Consulta manual
            </span>
            <ActionButton
              type="submit"
              tone="primary"
              disabled={invalidRange || query.isFetching}
            >
              <Search size={16} aria-hidden="true" />
              Consultar auditoría
            </ActionButton>
          </div>
        </header>
        <div className="space-y-4 p-4 sm:space-y-5 sm:p-5">
          {draft.organization_id && (
            <div className="flex items-start gap-2 rounded-xl border border-accent-green/20 bg-accent-green/5 px-3 py-3 text-sm">
              <Building2
                size={17}
                className="mt-0.5 shrink-0 text-accent-green"
                aria-hidden="true"
              />
              <p>
                Organización seleccionada desde la ficha. Limpiar filtros
                elimina esta selección.
              </p>
            </div>
          )}
          <div className="grid gap-5 xl:grid-cols-2">
            <fieldset className="min-w-0">
              <legend className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
                <UserRound size={14} aria-hidden="true" /> Identidad
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="min-w-0 text-sm font-medium">
                  Correo del usuario
                  <input
                    className="platform-field font-normal"
                    type="text"
                    maxLength={255}
                    placeholder="persona@empresa.com"
                    value={draft.email}
                    onChange={(e) =>
                      setDraft({ ...draft, email: e.target.value })
                    }
                  />
                </label>
                <label className="min-w-0 text-sm font-medium">
                  Organización (nombre o slug)
                  <input
                    className="platform-field font-normal"
                    type="text"
                    maxLength={255}
                    placeholder="Buscar organización"
                    value={draft.organization}
                    onChange={(e) =>
                      setDraft({ ...draft, organization: e.target.value })
                    }
                  />
                </label>
              </div>
            </fieldset>
            <fieldset className="min-w-0">
              <legend className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
                <CalendarDays size={14} aria-hidden="true" /> Período
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["since", "Desde"],
                    ["until", "Hasta (exclusivo)"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="min-w-0 text-sm font-medium">
                    {label}
                    <input
                      className="platform-field font-normal"
                      type="datetime-local"
                      maxLength={255}
                      value={draft[key]}
                      onChange={(e) =>
                        setDraft({ ...draft, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <span className="mr-2 text-xs text-text-muted">
                  Período rápido
                </span>
                {[
                  [0, "Hoy"],
                  [7, "7 días"],
                  [30, "30 días"],
                ].map(([days, label]) => (
                  <ActionButton
                    key={days}
                    tone="tertiary"
                    onClick={() => quickRange(Number(days))}
                  >
                    {label}
                  </ActionButton>
                ))}
              </div>
            </fieldset>
          </div>
          <details className="border-t border-border-base pt-1">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium">
              <SlidersHorizontal
                size={16}
                className="text-text-muted"
                aria-hidden="true"
              />
              Filtros avanzados
              {advancedCount > 0 && (
                <span className="rounded-full bg-accent-green/10 px-2 py-0.5 text-xs text-accent-green">
                  {advancedCount} seleccionados
                </span>
              )}
              <ChevronDown
                size={15}
                className="ml-auto text-text-muted"
                aria-hidden="true"
              />
            </summary>
            <div className="grid gap-3 py-3 sm:grid-cols-3">
              {(["action", "module"] as const).map((key) => (
                <label key={key} className="text-sm font-medium">
                  {key === "action" ? "Acción" : "Módulo"}
                  <select
                    className="platform-field font-normal"
                    value={draft[key]}
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: e.target.value })
                    }
                  >
                    <option value="">Todos</option>
                    {(key === "action"
                      ? options.data?.actions
                      : options.data?.modules
                    )?.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label} ({item.id})
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="text-sm font-medium">
                Resultado
                <select
                  className="platform-field font-normal"
                  value={draft.result}
                  onChange={(e) =>
                    setDraft({ ...draft, result: e.target.value })
                  }
                >
                  <option value="">Todos</option>
                  <option value="success">Correcto</option>
                  <option value="failure">Fallido</option>
                </select>
              </label>
            </div>
            {options.isError && (
              <p role="alert" className="text-sm">
                No se pudieron consultar las opciones.{" "}
                <ActionButton
                  tone="tertiary"
                  onClick={() => void options.refetch()}
                >
                  Reintentar opciones
                </ActionButton>
              </p>
            )}
          </details>
          {invalidRange && (
            <p
              role="alert"
              className="flex items-center gap-2 text-sm text-accent-red"
            >
              <XCircle size={16} aria-hidden="true" />
              Desde debe ser anterior a Hasta.
            </p>
          )}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-base bg-bg-dark/40 px-5 py-3">
          <p className="flex items-center gap-2 text-xs text-text-muted">
            <Info size={14} className="shrink-0" aria-hidden="true" />
            Fechas del navegador; inicio incluido y fin excluido.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton tone="tertiary" onClick={() => setDraft(empty)}>
              Limpiar filtros
            </ActionButton>
          </div>
        </footer>
      </form>
      {!applied && (
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-border-base px-4 py-4">
          <ScrollText
            size={21}
            className="mt-0.5 shrink-0 text-text-muted"
            aria-hidden="true"
          />
          <div>
            <h3 className="text-sm font-semibold">Sin consulta realizada</h3>
            <p className="mt-1 text-sm leading-relaxed text-text-muted">
              Los eventos se consultan únicamente al solicitarlos.
            </p>
          </div>
        </div>
      )}
      {applied && (
        <section aria-label="Consulta aplicada" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">
                Consulta aplicada
              </p>
              <h2 className="mt-1 text-lg font-semibold">
                Actividad consultada
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                Resultados: 25 eventos por página · más recientes primero
              </p>
            </div>
            {query.dataUpdatedAt > 0 && (
              <DataConsultationAge updatedAt={query.dataUpdatedAt} />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(applied)
              .filter(([, value]) => value.trim())
              .map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex min-w-0 items-center gap-1.5 break-all rounded-lg border border-border-base bg-bg-card px-3 py-2 text-xs"
                >
                  <Filter
                    size={12}
                    className="shrink-0 text-text-muted"
                    aria-hidden="true"
                  />
                  {labelFor(key, value)}
                </span>
              ))}
            {!Object.values(applied).some(Boolean) && (
              <span className="rounded-lg border border-border-base bg-bg-card px-3 py-2 text-xs text-text-muted">
                Actividad global · sin filtros
              </span>
            )}
          </div>
          {changed && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-xl border border-accent-yellow/25 bg-accent-yellow/5 px-4 py-3 text-sm"
            >
              <Info
                size={17}
                className="mt-0.5 shrink-0 text-accent-yellow"
                aria-hidden="true"
              />
              Filtros modificados. Pulsa Consultar auditoría para aplicarlos;
              los resultados conservan la consulta anterior.
            </p>
          )}
        </section>
      )}
      {query.isFetching && (
        <p role="status" className="flex items-center gap-2 py-3 text-sm">
          <History size={17} aria-hidden="true" />
          Cargando auditoría…
        </p>
      )}
      {query.isError && (
        <p
          role="alert"
          className="rounded-xl border border-accent-red/25 bg-accent-red/5 px-4 py-3 text-sm"
        >
          No se pudo cargar la auditoría.{" "}
          {query.data && "Se conservan los datos de la consulta anterior."}
          <ActionButton onClick={() => void query.refetch()}>
            Reintentar consulta
          </ActionButton>
        </p>
      )}
      {query.data?.events.length === 0 && (
        <EmptyState
          title="Sin eventos"
          description="No hay eventos para los filtros consultados."
        />
      )}
      {!!query.data?.events.length && (
        <ul className="overflow-hidden rounded-2xl border border-border-base bg-bg-card">
          {query.data.events.map((event) => {
            const failed = event.result === "failure";
            const ResultIcon = failed
              ? XCircle
              : event.result === "success"
                ? CheckCircle2
                : History;
            return (
              <li
                key={event.id}
                className="flex gap-3 border-b border-border-base p-4 last:border-b-0 sm:gap-4 sm:p-5"
              >
                <div
                  className={
                    "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border " +
                    (failed
                      ? "border-accent-red/25 bg-accent-red/10 text-accent-red"
                      : "border-border-base bg-bg-dark text-text-muted")
                  }
                >
                  <ResultIcon size={17} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">
                          {actionLabel(event.action)}
                        </h3>
                        <span
                          className="ui-status"
                          data-tone={
                            failed
                              ? "danger"
                              : event.result === "success"
                                ? "success"
                                : "muted"
                          }
                        >
                          {resultLabel(event.result)}
                        </span>
                      </div>
                      <p className="mt-1 break-all text-sm text-text-main">
                        {event.user_email || "Sistema"}
                      </p>
                    </div>
                    <time
                      className="inline-flex items-center gap-1.5 text-xs text-text-muted"
                      dateTime={event.timestamp}
                    >
                      <Clock3 size={12} aria-hidden="true" />
                      {date(event.timestamp)}
                    </time>
                  </div>
                  <p className="line-clamp-2 break-words text-sm leading-relaxed text-text-muted">
                    {event.description}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                      <span className="rounded-md border border-border-base px-2 py-1">
                        {moduleLabel(event.module)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Building2 size={12} aria-hidden="true" />
                        {event.organization_id
                          ? "Organización " + event.organization_id.slice(0, 8)
                          : "Evento de plataforma"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {event.organization_id && (
                        <ActionButton
                          tone="tertiary"
                          onClick={() =>
                            onOpenOrganization(event.organization_id!)
                          }
                        >
                          Ver organización
                        </ActionButton>
                      )}
                      <ActionButton
                        tone="tertiary"
                        className="text-accent-green"
                        onClick={() => setEventId(event.id)}
                      >
                        Ver evento
                        <ArrowRight size={14} aria-hidden="true" />
                      </ActionButton>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {applied && (
        <div className="flex items-center justify-between gap-3 border-t border-border-base pt-3 text-sm">
          <ActionButton
            tone="tertiary"
            disabled={page === 1 || query.isFetching}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </ActionButton>
          <span className="text-text-muted">Página {page}</span>
          <ActionButton
            tone="tertiary"
            disabled={
              !query.data?.has_next || query.isFetching || query.isError
            }
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </ActionButton>
        </div>
      )}
      {eventId &&
        createPortal(
          <div className="platform-console fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
            <ModalSurface
              label="Detalle del evento"
              onClose={() => setEventId(null)}
              className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border-base bg-bg-card shadow-2xl"
            >
              <header className="flex items-center justify-between gap-3 border-b border-border-base px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-bg-dark text-text-muted">
                    <ScrollText size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-text-muted">
                      Registro administrativo
                    </p>
                    <h3 className="mt-1 text-lg font-semibold">
                      Detalle del evento
                    </h3>
                  </div>
                </div>
                <ActionButton
                  tone="tertiary"
                  aria-label="Cerrar detalle del evento"
                  onClick={() => setEventId(null)}
                >
                  <X size={18} aria-hidden="true" />
                </ActionButton>
              </header>
              <div className="max-h-[65vh] overflow-y-auto p-5">
                {eventDetail.isPending && (
                  <p role="status">Consultando evento…</p>
                )}
                {eventDetail.isError && (
                  <p role="alert">
                    No se pudo cargar.
                    <ActionButton onClick={() => void eventDetail.refetch()}>
                      Reintentar detalle
                    </ActionButton>
                  </p>
                )}
                {eventDetail.data && (
                  <dl className="grid gap-x-5 gap-y-4 break-words text-sm sm:grid-cols-2">
                    {(
                      [
                        "timestamp",
                        "user_email",
                        "organization_id",
                        "action",
                        "module",
                        "result",
                        "description",
                        "id",
                      ] as const
                    ).map((key) => (
                      <div
                        key={key}
                        className={
                          key === "description" || key === "id"
                            ? "sm:col-span-2"
                            : ""
                        }
                      >
                        <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
                          {
                            {
                              id: "Evento",
                              user_email: "Usuario",
                              organization_id: "Organización",
                              timestamp: "Fecha",
                              action: "Acción",
                              module: "Módulo",
                              result: "Resultado",
                              description: "Descripción",
                            }[key]
                          }
                        </dt>
                        <dd
                          className={
                            "mt-1 whitespace-pre-wrap " +
                            (key === "id" || key === "organization_id"
                              ? "break-all font-mono text-xs"
                              : "")
                          }
                        >
                          {eventDetail.data?.[key] === null
                            ? "Sin registro"
                            : key === "timestamp"
                              ? date(eventDetail.data![key])
                              : key === "action"
                                ? actionLabel(eventDetail.data![key])
                                : key === "module"
                                  ? moduleLabel(eventDetail.data![key])
                                  : key === "result"
                                    ? resultLabel(eventDetail.data![key])
                                    : String(
                                        eventDetail.data?.[key] ??
                                          "Sin registro",
                                      )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
              <footer className="flex justify-end border-t border-border-base px-5 py-3">
                <ActionButton onClick={() => setEventId(null)}>
                  Cerrar detalle
                </ActionButton>
              </footer>
            </ModalSurface>
          </div>,
          document.body,
        )}
    </section>
  );
}
