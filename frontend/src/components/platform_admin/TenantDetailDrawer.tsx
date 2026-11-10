import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  Globe,
  History,
  Mail,
  Phone,
  Server,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { platformApi } from "../../services/platformApi";
import type {
  PlatformOrganization,
  PlatformOrganizationDetail,
} from "../../types/platform_admin";
import type { ResourcePage } from "../../types/platform_beta";
import ModalSurface from "../common/ModalSurface";
import { ActionButton, InlineNotice } from "./PlatformUI";
import { subscriptionStates } from "./OrganizationDistribution";

type Tab = "general" | "users" | "infrastructure" | "audit";
interface Props {
  orgId: string | null;
  onClose: () => void;
  onChangePlan: (org: PlatformOrganization) => void;
  onExtendTrial: (org: PlatformOrganization) => void;
  onClassify?: (org: PlatformOrganization) => void;
  onAudit?: (id: string) => void;
  onOpenUser?: (id: string) => void;
  onAccess?: (org: PlatformOrganization) => void;
  onEditContact?: (org: PlatformOrganization) => void;
  notice?: string;
  onDismissNotice?: () => void;
}
const date = (value: string | null) =>
  value ? new Date(value).toLocaleString("es-GT") : "Sin registro";
const resourceState: Record<string, string> = {
  up: "Operacional",
  down: "Caído",
  slow: "Lento",
  error: "Error",
  pass: "Correcto",
  fail: "Fallido",
  True: "Válido",
  False: "Inválido",
  online: "Conectado",
  offline: "Desconectado",
};

const moduleIcons: Record<string, typeof Activity> = {
  monitoring: Activity,
  ssl: ShieldCheck,
  dns: Globe,
  domain: Globe,
  api: Activity,
  security: Shield,
  agents: Server,
};
const tabIcons: Record<Tab, typeof Activity> = {
  general: Building2,
  users: Users,
  infrastructure: Server,
  audit: History,
};

export default function TenantDetailDrawer({
  orgId,
  onClose,
  onChangePlan,
  onExtendTrial,
  onClassify,
  onAudit,
  onOpenUser,
  onEditContact,
  onAccess,
  notice,
  onDismissNotice,
}: Props) {
  const [tab, setTab] = useState<Tab>("general");
  const [pages, setPages] = useState<Record<string, number>>({});
  const [module, setModule] = useState<string | null>(null);
  const page =
    pages[module && tab === "infrastructure" ? "resource-" + module : tab] || 1;
  const query = useQuery<PlatformOrganizationDetail>({
    queryKey: ["platform-admin-org-detail", orgId, "general"],
    enabled: !!orgId,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) =>
      (
        await platformApi.get("platform-admin/organizations/" + orgId + "/", {
          params: { section: "general" },
          signal,
        })
      ).data.data,
  });
  const section = useQuery<PlatformOrganizationDetail>({
    queryKey: ["platform-admin-org-detail", orgId, tab, page],
    enabled: !!orgId && ["users", "audit"].includes(tab),
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) =>
      (
        await platformApi.get("platform-admin/organizations/" + orgId + "/", {
          params: { section: tab, page },
          signal,
        })
      ).data.data,
  });
  const resources = useQuery<ResourcePage>({
    queryKey: ["platform-admin-org-resources", orgId, module, page],
    enabled: !!orgId && tab === "infrastructure" && !!module,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) =>
      (
        await platformApi.get(
          "platform-admin/organizations/" + orgId + "/resources/",
          { params: { module, page }, signal },
        )
      ).data.data,
  });
  if (!orgId) return null;
  const data = query.data;
  const state = subscriptionStates.find(
    (item) => item.id === data?.subscription_status,
  );
  const setPage = (value: number) =>
    setPages((current) => ({
      ...current,
      [module && tab === "infrastructure" ? "resource-" + module : tab]: value,
    }));
  const hasNext =
    tab === "infrastructure"
      ? resources.data?.has_next
      : section.data?.has_next;
  return createPortal(
    <div className="platform-console fixed inset-0 z-50 flex justify-end overflow-hidden bg-black/75">
      <ModalSurface
        label="Ficha de organización"
        onClose={onClose}
        className="platform-organization-dossier flex h-full w-full max-w-5xl flex-col border-l border-border-base bg-bg-dark shadow-2xl"
      >
        <header className="shrink-0 border-b border-border-base bg-bg-card p-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <span
                aria-hidden="true"
                className="grid size-12 shrink-0 place-items-center rounded-2xl border border-accent-green/25 bg-accent-green/10 text-accent-green"
              >
                <Building2 size={25} />
              </span>
              <div className="min-w-0">
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                  Organización
                  {data ? " · Plan " + data.plan_tier.toUpperCase() : ""}
                </p>
                <h2 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">
                  {data?.name ||
                    (query.isError
                      ? "Organización no disponible"
                      : "Cargando organización…")}
                </h2>
                {data && (
                  <p className="mt-1 break-all text-sm text-text-muted">
                    {data.billing_email || "Sin contacto de facturación"}
                  </p>
                )}
              </div>
            </div>
            <ActionButton
              tone="tertiary"
              aria-label="Cerrar ficha de organización"
              onClick={onClose}
              className="!min-w-11 !px-2"
            >
              <X size={20} aria-hidden="true" />
            </ActionButton>
          </div>
          {data && (
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border-base pt-4 sm:grid-cols-4">
              <div>
                <dt className="mb-1.5 text-xs text-text-muted">
                  Acceso de organización
                </dt>
                <dd>
                  <span
                    className="ui-status gap-1.5"
                    data-tone={
                      data.access_status === "active"
                        ? "success"
                        : data.access_status === "suspended"
                          ? "danger"
                          : "muted"
                    }
                  >
                    <span
                      aria-hidden="true"
                      className="size-1.5 rounded-full bg-current"
                    />
                    {data.access_status === "active"
                      ? "Acceso habilitado"
                      : data.access_status === "suspended"
                        ? "Acceso suspendido"
                        : "Acceso cancelado"}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="mb-1.5 text-xs text-text-muted">Suscripción</dt>
                <dd>
                  <span
                    className="ui-status"
                    data-tone={state?.tone || "muted"}
                  >
                    {state?.label || "Suscripción desconocida"}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="mb-1.5 text-xs text-text-muted">
                  Participación beta
                </dt>
                <dd className="pt-1 text-sm font-medium">
                  {data.beta_managed
                    ? "Beta: " +
                      (data.beta_status === "active"
                        ? "habilitada"
                        : "suspendida")
                    : "Fuera de beta"}
                </dd>
              </div>
              <div>
                <dt className="mb-1.5 text-xs text-text-muted">
                  Clasificación
                </dt>
                <dd className="pt-1 text-sm font-medium">
                  {data.is_test ? "Organización de prueba" : "Cliente"}
                </dd>
              </div>
            </dl>
          )}
        </header>
        <nav
          aria-label="Secciones de la organización"
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-border-base bg-bg-card/50 px-3 sm:px-5"
        >
          {(
            [
              ["general", "General y contacto"],
              ["users", "Usuarios"],
              ["infrastructure", "Recursos y límites"],
              ["audit", "Historial administrativo"],
            ] as [Tab, string][]
          ).map(([id, label]) => {
            const Icon = tabIcons[id];
            return (
              <ActionButton
                tone="tertiary"
                key={id}
                aria-pressed={tab === id}
                className={
                  "shrink-0 !rounded-none !border-b-2 !px-3 !py-3 " +
                  (tab === id
                    ? "!border-b-accent-green !bg-accent-green/5 !text-accent-green"
                    : "text-text-muted")
                }
                onClick={() => setTab(id)}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
                {id === "users" && data?.counts
                  ? " (" + data.counts.users + ")"
                  : ""}
              </ActionButton>
            );
          })}
        </nav>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
          {notice && (
            <InlineNotice
              message={notice}
              onDismiss={onDismissNotice || (() => {})}
            />
          )}
          {query.isPending && (
            <p role="status" className="text-sm text-text-muted">
              Consultando organización…
            </p>
          )}
          {query.isError && (
            <div
              role="alert"
              className="rounded-xl border border-accent-red/25 bg-accent-red/5 p-4 text-sm"
            >
              No se pudo cargar la organización.{" "}
              {data ? "Los datos anteriores pueden estar desactualizados." : ""}{" "}
              <ActionButton onClick={() => void query.refetch()}>
                Reintentar ficha
              </ActionButton>
            </div>
          )}
          {data && tab === "general" && (
            <>
              <section aria-labelledby="organization-contact-heading">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3
                      id="organization-contact-heading"
                      className="flex items-center gap-2 text-lg font-semibold"
                    >
                      <Building2
                        size={18}
                        className="text-text-muted"
                        aria-hidden="true"
                      />
                      Contacto y registro
                    </h3>
                    <p className="mt-1 text-sm text-text-muted">
                      Datos de referencia para atender a esta organización.
                    </p>
                  </div>
                  {onEditContact && (
                    <ActionButton
                      disabled={query.isFetching || query.isError}
                      onClick={() => onEditContact(data)}
                    >
                      Editar contacto
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </ActionButton>
                  )}
                </div>
                <dl className="grid gap-x-6 sm:grid-cols-2">
                  {[
                    [
                      "Correo de facturación",
                      data.billing_email || "No registrado",
                      Mail,
                    ],
                    ["Teléfono", data.contact_phone || "No registrado", Phone],
                    [
                      "Identificación fiscal",
                      data.tax_id || "No registrada",
                      FileText,
                    ],
                    ["Sitio web", data.website || "No registrado", Globe],
                  ].map(([label, value, icon]) => {
                    const Icon = icon as typeof Activity;
                    return (
                      <div
                        key={String(label)}
                        className="flex items-start gap-3 border-t border-border-base py-4"
                      >
                        <Icon
                          size={17}
                          className="mt-0.5 shrink-0 text-text-muted"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <dt className="text-xs text-text-muted">
                            {String(label)}
                          </dt>
                          <dd className="mt-1.5 break-words text-sm font-medium">
                            {String(value)}
                          </dd>
                        </div>
                      </div>
                    );
                  })}
                </dl>
                <div className="mt-2 grid gap-4 rounded-xl border border-border-base bg-bg-card/65 p-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <Clock
                      size={18}
                      className="mt-0.5 shrink-0 text-text-muted"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-xs text-text-muted">
                        Período de prueba
                      </p>
                      <p className="mt-1.5 text-sm font-medium">
                        {data.is_in_trial
                          ? data.trial_days_remaining +
                            " días restantes · " +
                            date(data.trial_ends_at)
                          : data.trial_ends_at
                            ? "Sin prueba vigente · fecha registrada: " +
                              date(data.trial_ends_at)
                            : "Sin prueba vigente"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CalendarDays
                      size={18}
                      className="mt-0.5 shrink-0 text-text-muted"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-xs text-text-muted">
                        Fecha de registro
                      </p>
                      <p className="mt-1.5 text-sm font-medium">
                        {date(data.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
                {data.subscription_status === "suspended" && (
                  <p className="mt-3 border-l-2 border-accent-yellow/70 pl-3 text-sm text-accent-yellow">
                    La suscripción figura suspendida. Este estado es
                    independiente del bloqueo completo de acceso.
                  </p>
                )}
              </section>
              <section
                className="rounded-2xl border border-border-base bg-bg-card"
                aria-labelledby="organization-admin-heading"
              >
                <div className="border-b border-border-base px-4 py-4 sm:px-5">
                  <h3
                    id="organization-admin-heading"
                    className="flex items-center gap-2 text-base font-semibold"
                  >
                    <SlidersHorizontal
                      size={17}
                      className="text-text-muted"
                      aria-hidden="true"
                    />
                    Administración de la organización
                  </h3>
                  <p className="mt-1 text-sm text-text-muted">
                    Los cambios requieren motivo y quedan registrados en el
                    historial.
                  </p>
                </div>
                <fieldset
                  disabled={query.isFetching || query.isError}
                  className="space-y-4 p-4 sm:p-5"
                >
                  <div className="flex flex-wrap gap-2">
                    <ActionButton onClick={() => onChangePlan(data)}>
                      <CreditCard size={16} aria-hidden="true" />
                      Cambiar plan
                    </ActionButton>
                    <ActionButton onClick={() => onExtendTrial(data)}>
                      <Clock size={16} aria-hidden="true" />
                      Extender prueba
                    </ActionButton>
                    {onClassify && (
                      <ActionButton
                        tone="tertiary"
                        onClick={() => onClassify(data)}
                      >
                        {data.is_test
                          ? "Marcar como cliente"
                          : "Marcar como prueba"}
                      </ActionButton>
                    )}
                  </div>
                  {onAccess && (
                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border-base pt-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          Acceso a la organización
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-text-muted">
                          Suspender bloquea nuevos accesos y comprobaciones.
                          Conserva los datos y la suscripción.
                        </p>
                      </div>
                      <ActionButton
                        tone={
                          data.access_status === "suspended"
                            ? "secondary"
                            : "danger"
                        }
                        disabled={data.access_protected}
                        title={
                          data.access_protected
                            ? "Organización con superadmins activos protegida"
                            : undefined
                        }
                        onClick={() => onAccess(data)}
                      >
                        <Shield size={16} aria-hidden="true" />
                        {data.access_status === "suspended" ||
                        data.beta_status === "suspended"
                          ? "Reactivar acceso"
                          : "Suspender acceso"}
                      </ActionButton>
                    </div>
                  )}
                </fieldset>
              </section>
              {onAudit && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-base pt-3">
                  <p className="text-sm text-text-muted">
                    Investiga las acciones y los cambios de este cliente.
                  </p>
                  <ActionButton
                    tone="tertiary"
                    onClick={() => onAudit(data.id)}
                  >
                    Preparar consulta de auditoría
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </ActionButton>
                </div>
              )}
            </>
          )}
          {data && tab === "infrastructure" && (
            <>
              <section aria-labelledby="organization-resources-heading">
                <h3
                  id="organization-resources-heading"
                  className="text-lg font-semibold"
                >
                  Consumo y límites efectivos
                </h3>
                <p className="mt-1 text-sm text-text-muted">
                  Selecciona un módulo para ver sus recursos y últimas
                  mediciones.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-3">
                  {data.resource_usage?.map((row) => {
                    const Icon = moduleIcons[row.module] || Server;
                    const exceeds = row.total > row.limit;
                    const percent =
                      row.limit > 0
                        ? Math.min(100, (row.total / row.limit) * 100)
                        : row.total > 0
                          ? 100
                          : 0;
                    return (
                      <button
                        key={row.module}
                        type="button"
                        aria-pressed={module === row.module}
                        onClick={() => setModule(row.module)}
                        className={
                          "min-w-0 rounded-xl border p-3 text-left transition-colors " +
                          (module === row.module
                            ? "border-accent-green/60 bg-accent-green/5"
                            : "border-border-base bg-bg-card/60 hover:bg-bg-card-hover")
                        }
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                            <Icon
                              size={16}
                              className={
                                module === row.module
                                  ? "shrink-0 text-accent-green"
                                  : "shrink-0 text-text-muted"
                              }
                              aria-hidden="true"
                            />
                            <span>{row.label}</span>
                          </span>
                          {module === row.module && (
                            <ChevronRight
                              size={14}
                              className="shrink-0 text-accent-green"
                              aria-hidden="true"
                            />
                          )}
                        </span>
                        <span
                          className={
                            "mt-3 block text-lg font-semibold tabular-nums " +
                            (exceeds ? "text-accent-yellow" : "")
                          }
                        >
                          {row.total}
                          <span className="ml-1 text-xs font-normal text-text-muted">
                            / {row.limit}
                          </span>
                        </span>
                        <span
                          className="mt-2 block h-1 overflow-hidden rounded-full bg-white/5"
                          aria-hidden="true"
                        >
                          <span
                            className={
                              "block h-full rounded-full " +
                              (exceeds
                                ? "bg-accent-yellow"
                                : module === row.module
                                  ? "bg-accent-green"
                                  : "bg-slate-500")
                            }
                            style={{ width: percent + "%" }}
                          />
                        </span>
                        <span className="mt-2 block text-xs text-text-muted">
                          {row.measured}{" "}
                          {row.module === "agents"
                            ? "con heartbeat registrado"
                            : "con medición registrada"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
              {!module && (
                <div className="flex items-center gap-3 border-t border-border-base py-5 text-sm text-text-muted">
                  <Server size={20} aria-hidden="true" />
                  Selecciona un módulo para consultar sus recursos. Cada listado
                  muestra 25 registros por página.
                </div>
              )}
              {module && resources.isPending && (
                <p role="status" className="text-sm text-text-muted">
                  Consultando recursos…
                </p>
              )}
              {module && resources.isError && (
                <div
                  role="alert"
                  className="rounded-xl border border-accent-red/25 bg-accent-red/5 p-4 text-sm"
                >
                  No se pudieron consultar los recursos.{" "}
                  <ActionButton onClick={() => void resources.refetch()}>
                    Reintentar recursos
                  </ActionButton>
                </div>
              )}
              {module && resources.data && (
                <section className="overflow-hidden rounded-xl border border-border-base bg-bg-card/50">
                  <div className="border-b border-border-base px-4 py-4">
                    <h3 className="text-base font-semibold">
                      {resources.data.label} · {resources.data.total} registros
                    </h3>
                    <p className="mt-1 text-xs text-text-muted">
                      Recursos registrados · 25 por página
                    </p>
                  </div>
                  <ul className="divide-y divide-border-base">
                    {resources.data.items.map((row) => (
                      <li key={row.id} className="px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold">
                              {row.name}
                            </p>
                            <p className="mt-1 break-all text-xs text-text-muted">
                              {row.destination || "Sin destino público"}
                            </p>
                          </div>
                          <span
                            className="ui-status"
                            data-tone={
                              row.measured_at &&
                              [
                                "down",
                                "error",
                                "fail",
                                "False",
                                "offline",
                              ].includes(row.state || "")
                                ? "danger"
                                : "muted"
                            }
                          >
                            {row.measured_at
                              ? resourceState[row.state || ""] ||
                                row.state ||
                                "Estado no disponible"
                              : "Sin medición"}
                          </span>
                        </div>
                        <details className="mt-2">
                          <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-text-muted">
                            Detalles del recurso
                            <ChevronDown size={13} aria-hidden="true" />
                          </summary>
                          <p className="break-all pb-1 text-xs leading-relaxed text-text-muted">
                            ID: {row.id}
                            <br />
                            Última medición: {date(row.measured_at)}
                          </p>
                        </details>
                      </li>
                    ))}
                  </ul>
                  {!resources.data.items.length && (
                    <p className="px-4 py-8 text-center text-sm text-text-muted">
                      Sin recursos en este módulo.
                    </p>
                  )}
                </section>
              )}
            </>
          )}
          {data && ["users", "audit"].includes(tab) && (
            <>
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  {tab === "users" ? (
                    <Users size={18} aria-hidden="true" />
                  ) : (
                    <History size={18} aria-hidden="true" />
                  )}
                  {tab === "users"
                    ? "Integrantes de la organización"
                    : "Historial de cambios"}
                </h3>
                <p className="mt-1 text-sm text-text-muted">
                  {tab === "users"
                    ? "Revisa cada cuenta, su seguridad y autorización efectiva."
                    : "Cambios administrativos registrados para este cliente."}
                </p>
              </div>
              {section.isPending && (
                <p role="status" className="text-sm text-text-muted">
                  Consultando sección…
                </p>
              )}
              {section.isError && (
                <p role="alert" className="text-sm">
                  No se pudo cargar la sección.{" "}
                  <ActionButton onClick={() => void section.refetch()}>
                    Reintentar sección
                  </ActionButton>
                </p>
              )}
              {section.data && tab === "users" && (
                <ul className="divide-y divide-border-base rounded-xl border border-border-base bg-bg-card/50">
                  {section.data.users.map((user) => (
                    <li
                      key={user.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-4"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span
                          aria-hidden="true"
                          className="grid size-10 shrink-0 place-items-center rounded-xl bg-bg-dark text-xs font-semibold text-text-muted"
                        >
                          {user.email.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="break-all text-sm font-semibold">
                            {user.email}
                          </p>
                          <p className="mt-1 text-xs text-text-muted">
                            <span
                              className="mr-1.5 inline-block size-1.5 rounded-full bg-current"
                              aria-hidden="true"
                            />
                            {user.is_active
                              ? "Cuenta activa"
                              : "Cuenta desactivada"}{" "}
                            · Último acceso: {date(user.last_login)}
                          </p>
                        </div>
                      </div>
                      {onOpenUser && (
                        <ActionButton
                          tone="tertiary"
                          onClick={() => onOpenUser(user.id)}
                        >
                          Ver ficha de usuario
                          <ArrowUpRight size={14} aria-hidden="true" />
                        </ActionButton>
                      )}
                    </li>
                  ))}
                  {!section.data.users.length && (
                    <li className="p-8 text-center text-sm text-text-muted">
                      Sin usuarios en esta página.
                    </li>
                  )}
                </ul>
              )}
              {section.data && tab === "audit" && (
                <>
                  <ul className="divide-y divide-border-base">
                    {section.data.recent_audits.map((event) => (
                      <li key={event.id} className="flex gap-3 py-4">
                        <span
                          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-border-base bg-bg-card text-text-muted"
                          aria-hidden="true"
                        >
                          <History size={14} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm leading-relaxed">
                            {event.description}
                          </p>
                          <p className="mt-2 break-all text-xs text-text-muted">
                            {event.user_email} · {date(event.created_at)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {!section.data.recent_audits.length && (
                    <p className="border-t border-border-base py-8 text-center text-sm text-text-muted">
                      Sin eventos en esta página.
                    </p>
                  )}
                  {onAudit && (
                    <ActionButton
                      tone="tertiary"
                      onClick={() => onAudit(data.id)}
                    >
                      Consultar auditoría con filtros
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </ActionButton>
                  )}
                </>
              )}
            </>
          )}
        </div>
        {(tab === "users" ||
          tab === "audit" ||
          (tab === "infrastructure" && module)) && (
          <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border-base bg-bg-card px-4 py-3 text-sm sm:px-6">
            <ActionButton
              tone="tertiary"
              disabled={
                page === 1 || section.isFetching || resources.isFetching
              }
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </ActionButton>
            <span className="text-text-muted">Página {page}</span>
            <ActionButton
              tone="tertiary"
              disabled={!hasNext || section.isFetching || resources.isFetching}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </ActionButton>
          </footer>
        )}
      </ModalSurface>
    </div>,
    document.body,
  );
}
