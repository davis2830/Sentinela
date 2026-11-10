import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  Clock3,
  Fingerprint,
  LifeBuoy,
  Mail,
  MailPlus,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { platformApi } from "../../services/platformApi";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import type {
  BetaAttention,
  BetaDelivery,
  BetaDirectory,
  BetaParticipant,
} from "../../types/platform_beta";
import { betaAttention } from "../../types/platform_beta";
import ModalSurface from "../common/ModalSurface";
import PlatformActionModal from "./PlatformActionModal";
import {
  ActionButton,
  ActionMenu,
  FilterChips,
  InlineNotice,
} from "./PlatformUI";

const statuses: Record<string, string> = {
  invited: "Invitada",
  pending_verification: "Correo pendiente",
  active: "Registrada",
  suspended: "Suspendida",
  revoked: "Revocada",
  rejected: "Rechazada",
  expired: "Vencida",
};
const deliveries: Record<string, string> = {
  queued: "En cola",
  sent: "Aceptado por servidor de correo",
  failed: "Envío fallido",
  expired: "Envío vencido",
};
const actions: Record<string, string> = {
  resend: "Reenviar invitación",
  resend_verification: "Reenviar verificación",
  revoke: "Revocar invitación",
  reject: "Rechazar solicitud",
  suspend: "Suspender acceso",
  resume: "Reactivar acceso",
};
const deliveryLabel = (item: BetaDelivery | null | undefined) =>
  item
    ? (deliveries[item.status] || "Desconocido") +
      " · " +
      item.attempts +
      " intentos"
    : "Sin envío";
const stageTone = (status: string) =>
  status === "active"
    ? "border-accent-green/20 bg-accent-green/10 text-accent-green"
    : ["suspended", "rejected", "revoked"].includes(status)
      ? "border-accent-red/20 bg-accent-red/10 text-accent-red"
      : ["expired", "pending_verification"].includes(status)
        ? "border-accent-yellow/20 bg-accent-yellow/10 text-accent-yellow"
        : "border-border-base bg-white/[.03] text-text-muted";
type Filters = {
  status: string;
  delivery: string;
  attention: string;
  ordering: string;
};

function BetaDialog({
  title,
  description,
  icon: Icon,
  onClose,
  drawer = false,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  onClose: () => void;
  drawer?: boolean;
  children: ReactNode;
}) {
  return createPortal(
    <div
      className={
        "platform-console fixed inset-0 z-50 flex bg-black/75 " +
        (drawer ? "justify-end" : "items-center justify-center p-3 sm:p-6")
      }
      onClick={onClose}
    >
      <ModalSurface
        label={title}
        onClose={onClose}
        className={
          "flex w-full flex-col overflow-hidden border border-border-base bg-bg-card shadow-2xl " +
          (drawer ? "h-full max-w-xl" : "max-h-[92vh] max-w-xl rounded-2xl")
        }
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-border-base p-5 sm:p-6">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent-green/20 bg-accent-green/10 text-accent-green">
            <Icon size={21} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-text-muted">
              Administración de beta
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              {description}
            </p>
          </div>
          <ActionButton
            tone="tertiary"
            aria-label={"Cerrar " + title.toLowerCase()}
            onClick={onClose}
            className="!min-w-11 !px-2"
          >
            <X size={19} aria-hidden="true" />
          </ActionButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {children}
        </div>
      </ModalSurface>
    </div>,
    document.body,
  );
}

export default function BetaAdminPanel({
  active = true,
  seed,
  onOpenOrganization,
}: {
  active?: boolean;
  seed?: { attention: BetaAttention; nonce: number };
  onOpenOrganization?: (id: string) => void;
}) {
  const client = useQueryClient();
  const [email, setEmail] = useState("");
  const [capacity, setCapacity] = useState<number | null>(null);
  const [submission, setSubmission] = useState<string | null>(null);
  const [management, setManagement] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const settled = useDebouncedValue(search);
  const [seedVersion, setSeedVersion] = useState(seed?.nonce);
  const [filters, setFilters] = useState<Filters>({
    status: "",
    delivery: "",
    attention: seed?.attention || "",
    ordering: "-created_at",
  });
  const [page, setPage] = useState(1);
  const [moreFilters, setMoreFilters] = useState(!!seed?.attention);
  const [message, setMessage] = useState("");
  const [dialog, setDialog] = useState<"invite" | "settings" | null>(null);
  const [settingsTab, setSettingsTab] = useState<"capacity" | "feedback">(
    "capacity",
  );
  const [selection, setSelection] = useState<{
    title: string;
    description: string;
    payload: Record<string, string | number | boolean>;
    destructive?: boolean;
  } | null>(null);
  useEffect(() => {
    if (seed) {
      setFilters({
        status: "",
        delivery: "",
        attention: seed.attention,
        ordering: "-created_at",
      });
      setSearch("");
      setPage(1);
      setSeedVersion(seed.nonce);
      setMoreFilters(true);
    }
  }, [seed]);
  useEffect(() => {
    if (!active) {
      setDialog(null);
      setSelection(null);
    }
  }, [active]);
  const query = useQuery<BetaDirectory>({
    queryKey: ["beta-admin", page, settled, filters],
    enabled:
      active && search === settled && (!seed || seedVersion === seed.nonce),
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) =>
      (
        await platformApi.get("platform-admin/beta/", {
          params: { page, search: settled, ...filters },
          signal,
        })
      ).data.data,
  });
  const data = query.data;
  useEffect(() => {
    if (data && page > Math.max(1, Math.ceil(data.total / 25)))
      setPage(Math.max(1, Math.ceil(data.total / 25)));
  }, [data, page]);
  const filter = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  const chooseAction = (inv: BetaParticipant, action: string) =>
    setSelection({
      title: actions[action],
      description:
        inv.email +
        ". " +
        (action === "suspend"
          ? "Bloquea acceso y nuevas comprobaciones; conserva la suscripción."
          : action === "resume"
            ? "Restablece el acceso sin renovar pruebas ni confirmar pagos."
            : "Se aplican vigencia, límites y revocación de enlaces anteriores."),
      payload: { action, invitation_id: inv.id },
      destructive: ["revoke", "reject", "suspend"].includes(action),
    });

  return (
    <section className="beta-directory space-y-5" aria-label="Gestión de beta">
      {query.isPending && <p role="status">Consultando beta…</p>}
      {query.isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-red/30 bg-accent-red/5 p-4 text-sm"
        >
          <p>
            No se pudo consultar la beta.{" "}
            {data ? "Los datos anteriores pueden estar desactualizados." : ""}
          </p>
          <ActionButton onClick={() => void query.refetch()}>
            Reintentar consulta
          </ActionButton>
        </div>
      )}
      {message && (
        <InlineNotice message={message} onDismiss={() => setMessage("")} />
      )}
      {data && (
        <>
          <div className="beta-controlbar flex flex-wrap items-center justify-between gap-4 border-y border-border-base py-4">
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-border-base bg-bg-card text-text-muted">
                  <Users size={19} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs text-text-muted">Admisiones</p>
                  <p
                    className={
                      "mt-0.5 flex items-center gap-2 text-sm font-semibold " +
                      (data.admissions_open
                        ? "text-accent-green"
                        : "text-text-muted")
                    }
                  >
                    <span
                      className={
                        "h-1.5 w-1.5 rounded-full " +
                        (data.admissions_open
                          ? "bg-accent-green"
                          : "bg-text-muted")
                      }
                    />
                    {data.admissions_open ? "Abiertas" : "Cerradas"}
                  </p>
                </div>
              </div>
              <div className="border-l border-border-base pl-4 sm:pl-6">
                <p className="text-xs text-text-muted">Disponibles</p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums">
                  {data.available}
                  <span className="ml-1 text-sm font-normal text-text-muted">
                    / {data.capacity}
                  </span>
                </p>
              </div>
              <div className="text-sm text-text-muted">
                <p>
                  <span className="font-medium tabular-nums text-text-main">
                    {data.reserved}
                  </span>{" "}
                  cupos reservados
                </p>
                <p className="mt-0.5 text-xs">Cupos totales: {data.capacity}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                tone="tertiary"
                onClick={() => setDialog("settings")}
                aria-label="Configuración de beta"
                title="Configuración de beta"
              >
                <Settings2 size={17} aria-hidden="true" />
                <span className="hidden sm:inline">Configuración de beta</span>
              </ActionButton>
              <ActionButton
                tone="primary"
                onClick={() => setDialog("invite")}
                disabled={!data.admissions_open || data.available < 1}
                title={
                  !data.admissions_open
                    ? "Abre admisiones desde Configuración de beta"
                    : data.available < 1
                      ? "No hay cupos disponibles"
                      : undefined
                }
              >
                <MailPlus size={18} aria-hidden="true" />
                Invitar participante
              </ActionButton>
            </div>
          </div>

          <section className="space-y-4" aria-label="Invitaciones y acceso">
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="hidden text-xs font-semibold uppercase tracking-[.14em] text-text-muted sm:block">
                  Directorio de la beta
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">
                  Participantes
                </h2>
                <p className="mt-1 hidden text-sm text-text-muted sm:block">
                  Identifica en qué etapa está cada persona y qué necesita para
                  continuar.
                </p>
              </div>
              <span className="rounded-full border border-border-base px-3 py-1.5 text-sm text-text-muted">
                <strong className="font-semibold tabular-nums text-text-main">
                  {data.total}
                </strong>{" "}
                participantes
              </span>
            </header>
            <div className="beta-directory-toolbar rounded-xl border border-border-base bg-bg-card px-4 py-3">
              <div className="grid grid-cols-2 items-end gap-3 xl:grid-cols-[minmax(230px,1fr)_170px_190px_auto]">
                <label className="relative col-span-2 block xl:col-span-1">
                  <span className="sr-only">Buscar participantes</span>
                  <Search
                    size={18}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                    aria-hidden="true"
                  />
                  <input
                    className="platform-field !mt-0 !pl-10"
                    placeholder="Buscar por correo u organización"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value.slice(0, 254));
                      setPage(1);
                    }}
                  />
                </label>
                <label className="text-xs font-medium text-text-muted">
                  Etapa
                  <select
                    className="platform-field !mt-1 font-normal text-text-main"
                    value={filters.status}
                    onChange={(e) => filter("status", e.target.value)}
                  >
                    <option value="">Todas</option>
                    {Object.entries(statuses).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-text-muted">
                  Último envío
                  <select
                    className="platform-field !mt-1 font-normal text-text-main"
                    value={filters.delivery}
                    onChange={(e) => filter("delivery", e.target.value)}
                  >
                    <option value="">Todos</option>
                    {Object.entries(deliveries).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <ActionButton
                  tone="tertiary"
                  className="col-span-2 justify-self-start xl:col-span-1"
                  aria-expanded={moreFilters}
                  aria-controls="beta-more-filters"
                  onClick={() => setMoreFilters((value) => !value)}
                >
                  <Settings2 size={16} aria-hidden="true" />
                  Más filtros
                  <ChevronDown size={15} aria-hidden="true" />
                </ActionButton>
              </div>
              {moreFilters && (
                <div
                  id="beta-more-filters"
                  className="mt-3 grid gap-3 border-t border-border-base pt-3 sm:grid-cols-2"
                >
                  <label className="text-xs font-medium text-text-muted">
                    Atención
                    <select
                      className="platform-field !mt-1 font-normal text-text-main"
                      value={filters.attention}
                      onChange={(e) => filter("attention", e.target.value)}
                    >
                      <option value="">Todos</option>
                      {Object.entries(betaAttention).map(([id, item]) => (
                        <option key={id} value={id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-text-muted">
                    Ordenar participantes
                    <select
                      className="platform-field !mt-1 font-normal text-text-main"
                      value={filters.ordering}
                      onChange={(e) => filter("ordering", e.target.value)}
                    >
                      <option value="-created_at">Más recientes</option>
                      <option value="created_at">Más antiguos</option>
                      <option value="email">Correo</option>
                    </select>
                  </label>
                </div>
              )}
            </div>
            <FilterChips
              items={[
                ...(search
                  ? [
                      {
                        id: "search",
                        label: "Búsqueda: " + search,
                        remove: () => {
                          setSearch("");
                          setPage(1);
                        },
                      },
                    ]
                  : []),
                ...(["status", "delivery", "attention"] as const)
                  .filter((k) => filters[k])
                  .map((k) => ({
                    id: k,
                    label:
                      k === "status"
                        ? statuses[filters[k]]
                        : k === "delivery"
                          ? deliveries[filters[k]]
                          : betaAttention[filters[k] as BetaAttention]?.label ||
                            filters[k],
                    remove: () => filter(k, ""),
                  })),
              ]}
              onClear={() => {
                setFilters({
                  status: "",
                  delivery: "",
                  attention: "",
                  ordering: "-created_at",
                });
                setSearch("");
                setPage(1);
              }}
            />
            <div className="overflow-hidden rounded-2xl border border-border-base bg-bg-card">
              <div
                aria-hidden="true"
                className="hidden grid-cols-[minmax(180px,1.2fr)_minmax(130px,.7fr)_minmax(180px,1fr)_minmax(145px,.9fr)_176px] gap-4 border-b border-border-base bg-white/[.025] px-5 py-3 text-xs font-semibold uppercase tracking-[.12em] text-text-muted xl:grid"
              >
                <span>Participante</span>
                <span>Etapa</span>
                <span>Correo y verificación</span>
                <span>Organización y acceso</span>
                <span>Próximo paso</span>
              </div>
              <ul className="divide-y divide-border-base">
                {data.invitations.map((inv) => {
                  const expired = Date.parse(inv.expires_at) <= Date.now();
                  const verification =
                    inv.status === "pending_verification" ||
                    (!!inv.user_id && !inv.email_verified);
                  const relevantDelivery = verification
                    ? inv.verification_delivery
                    : inv.invitation_delivery;
                  const recommendedAction =
                    inv.status === "pending_verification" &&
                    data.admissions_open &&
                    !expired &&
                    inv.account_active &&
                    !inv.email_verified &&
                    !inv.user__organization_id
                      ? "resend_verification"
                      : inv.status === "invited" &&
                          !inv.user__organization_id &&
                          data.admissions_open &&
                          (expired ||
                            inv.invitation_delivery?.status === "failed")
                        ? "resend"
                        : null;
                  const availableActions =
                    inv.status === "invited"
                      ? ["resend", "revoke"]
                      : inv.status === "pending_verification"
                        ? ["resend_verification", "reject"]
                        : inv.status === "active"
                          ? ["suspend"]
                          : inv.status === "suspended"
                            ? ["resume"]
                            : [];
                  const accessEnabled =
                    inv.access_status === "active" &&
                    inv.beta_status === "active";
                  const AccessIcon = accessEnabled ? ShieldCheck : ShieldAlert;
                  return (
                    <li
                      key={inv.id}
                      className="beta-participant-row grid gap-3 px-4 py-4 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1.2fr)_minmax(130px,.7fr)_minmax(180px,1fr)_minmax(145px,.9fr)_176px] sm:px-5"
                    >
                      <div className="flex min-w-0 gap-3">
                        <span
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border-base bg-bg-dark text-sm font-semibold uppercase text-text-muted"
                          aria-hidden="true"
                        >
                          {inv.email.slice(0, 2)}
                        </span>
                        <div className="min-w-0">
                          <p className="break-all text-sm font-semibold">
                            {inv.email}
                          </p>
                          <p className="mt-1 text-xs text-text-muted">
                            {inv.organization_name || "Invitación individual"}
                          </p>
                          {["invited", "pending_verification"].includes(
                            inv.status,
                          ) && (
                            <p
                              className={
                                "mt-1 text-xs leading-relaxed " +
                                (expired
                                  ? "text-accent-yellow"
                                  : "text-text-muted")
                              }
                            >
                              {expired
                                ? "Invitación vencida"
                                : "Vigente hasta " +
                                  new Date(inv.expires_at).toLocaleDateString(
                                    "es-GT",
                                  )}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted xl:hidden">
                          Etapa
                        </p>
                        <span
                          className={
                            "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-sm font-medium " +
                            stageTone(inv.status)
                          }
                        >
                          {inv.status === "active" ? (
                            <Building2 size={14} aria-hidden="true" />
                          ) : inv.status === "pending_verification" ? (
                            <Fingerprint size={14} aria-hidden="true" />
                          ) : (
                            <Mail size={14} aria-hidden="true" />
                          )}
                          {statuses[inv.status] || "Desconocida"}
                        </span>
                        {inv.user_id && !inv.account_active && (
                          <p className="mt-1 text-xs text-accent-red">
                            Cuenta desactivada
                          </p>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted xl:hidden">
                          Correo
                        </p>
                        <p
                          className={
                            "flex items-start gap-1.5 text-sm leading-snug " +
                            (relevantDelivery?.status === "failed" &&
                            !inv.email_verified
                              ? "text-accent-red"
                              : "text-text-main")
                          }
                        >
                          {inv.email_verified ? (
                            <Check
                              size={14}
                              className="mt-0.5 shrink-0 text-text-muted"
                              aria-hidden="true"
                            />
                          ) : (
                            <Clock3
                              size={14}
                              className="mt-0.5 shrink-0 text-text-muted"
                              aria-hidden="true"
                            />
                          )}
                          <span>
                            {inv.email_verified
                              ? "Correo confirmado"
                              : (verification
                                  ? "Verificación: "
                                  : "Invitación: ") +
                                (relevantDelivery
                                  ? deliveries[relevantDelivery.status] ||
                                    "Desconocido"
                                  : "Sin envío")}
                          </span>
                        </p>
                        {!inv.email_verified && relevantDelivery && (
                          <p className="mt-1 text-xs text-text-muted">
                            {relevantDelivery.attempts}{" "}
                            {relevantDelivery.attempts === 1
                              ? "intento"
                              : "intentos"}
                          </p>
                        )}
                        <details className="mt-1">
                          <summary className="flex min-h-11 w-fit cursor-pointer items-center gap-1 text-xs text-text-muted">
                            Historial de envío
                            <ChevronDown size={13} aria-hidden="true" />
                          </summary>
                          <div className="space-y-2 border-l border-border-base pl-3 pb-2 text-xs leading-relaxed text-text-muted">
                            <p>
                              <span className="font-medium text-text-main">
                                Invitación:
                              </span>{" "}
                              {deliveryLabel(inv.invitation_delivery)}
                              {inv.invitation_delivery?.last_attempt_at && (
                                <span className="block">
                                  Último intento:{" "}
                                  {new Date(
                                    inv.invitation_delivery.last_attempt_at,
                                  ).toLocaleString("es-GT")}
                                </span>
                              )}
                            </p>
                            {inv.user_id && (
                              <p>
                                <span className="font-medium text-text-main">
                                  Verificación:
                                </span>{" "}
                                {deliveryLabel(inv.verification_delivery)}
                                {inv.verification_delivery?.last_attempt_at && (
                                  <span className="block">
                                    Último intento:{" "}
                                    {new Date(
                                      inv.verification_delivery.last_attempt_at,
                                    ).toLocaleString("es-GT")}
                                  </span>
                                )}
                              </p>
                            )}
                            <p>
                              Aceptado por el servidor no confirma recepción en
                              la bandeja del participante.
                            </p>
                          </div>
                        </details>
                      </div>
                      <div className="min-w-0">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted xl:hidden">
                          Organización y acceso
                        </p>
                        {inv.user__organization_id ? (
                          <>
                            <p
                              className={
                                "flex items-center gap-1.5 text-sm font-medium " +
                                (accessEnabled
                                  ? "text-text-main"
                                  : "text-accent-red")
                              }
                            >
                              <AccessIcon
                                size={14}
                                className="shrink-0"
                                aria-hidden="true"
                              />
                              Acceso{" "}
                              {accessEnabled ? "habilitado" : "bloqueado"}
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-text-muted">
                              {!inv.has_resources
                                ? "Sin recursos configurados"
                                : inv.has_measurements
                                  ? "Medición registrada"
                                  : "Falta primera medición"}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-text-muted">
                            Sin organización
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-start justify-end gap-1 sm:col-start-2 xl:col-auto xl:flex-col xl:items-stretch">
                        {inv.user__organization_id && onOpenOrganization ? (
                          <ActionButton
                            tone="tertiary"
                            className="text-accent-green"
                            onClick={() =>
                              onOpenOrganization(inv.user__organization_id!)
                            }
                          >
                            Ver organización
                            <ArrowRight size={14} aria-hidden="true" />
                          </ActionButton>
                        ) : (
                          recommendedAction && (
                            <ActionButton
                              tone="secondary"
                              className="text-accent-green"
                              disabled={
                                recommendedAction === "resend" &&
                                expired &&
                                data.available < 1
                              }
                              title={
                                recommendedAction === "resend" &&
                                expired &&
                                data.available < 1
                                  ? "No quedan cupos para renovar la invitación."
                                  : undefined
                              }
                              onClick={() =>
                                chooseAction(inv, recommendedAction)
                              }
                            >
                              {actions[recommendedAction]}
                            </ActionButton>
                          )
                        )}
                        {availableActions.some(
                          (action) => action !== recommendedAction,
                        ) && (
                          <ActionMenu
                            label="Acciones"
                            accessibleLabel={"Acciones de " + inv.email}
                          >
                            {availableActions
                              .filter((action) => action !== recommendedAction)
                              .map((action) => (
                                <ActionButton
                                  key={action}
                                  tone="tertiary"
                                  disabled={
                                    action === "resend_verification" &&
                                    (!data.admissions_open ||
                                      expired ||
                                      !inv.account_active ||
                                      inv.email_verified)
                                  }
                                  onClick={() => chooseAction(inv, action)}
                                >
                                  {actions[action]}
                                </ActionButton>
                              ))}
                          </ActionMenu>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {!data.invitations.length && (
                <div className="px-6 py-12 text-center">
                  <Search
                    size={24}
                    className="mx-auto text-text-muted"
                    aria-hidden="true"
                  />
                  <h3 className="mt-3 text-base font-semibold">
                    Sin participantes para estos filtros.
                  </h3>
                  <p className="mt-2 text-sm text-text-muted">
                    Prueba otro correo, cambia la etapa o limpia los filtros
                    aplicados.
                  </p>
                </div>
              )}
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-base bg-white/[.015] px-5 py-3 text-sm">
                <span className="text-text-muted">
                  {data.total} participantes · página {page}
                  <span className="ml-2 hidden text-xs sm:inline">
                    25 por página
                  </span>
                </span>
                <div className="flex gap-2">
                  <ActionButton
                    tone="tertiary"
                    disabled={page === 1 || query.isFetching}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Anterior
                  </ActionButton>
                  <ActionButton
                    tone="tertiary"
                    disabled={!data.has_next || query.isFetching}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguiente
                  </ActionButton>
                </div>
              </footer>
            </div>
          </section>
        </>
      )}

      {active && dialog === "invite" && data && (
        <BetaDialog
          title="Invitar participante"
          description="Envía un acceso personal para registrarse en la beta cerrada."
          icon={MailPlus}
          onClose={() => setDialog(null)}
        >
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              setSelection({
                title: "Enviar invitación",
                description: "Se pondrá en cola un correo para " + email + ".",
                payload: { action: "invite", email },
              });
            }}
          >
            {message && (
              <InlineNotice
                message={message}
                onDismiss={() => setMessage("")}
              />
            )}
            <div className="flex items-center gap-3 text-sm">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-green text-xs font-semibold text-bg-dark">
                1
              </span>
              <span className="font-medium">Destinatario</span>
              <span className="h-px flex-1 bg-border-base" />
              <span className="grid h-7 w-7 place-items-center rounded-full border border-border-base text-xs text-text-muted">
                2
              </span>
              <span className="text-text-muted">Confirmación</span>
            </div>
            <label className="block text-sm font-medium">
              Correo de invitación
              <input
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="platform-field"
                placeholder="persona@empresa.com"
              />
            </label>
            <div className="flex gap-3 rounded-xl bg-bg-dark p-4">
              <Mail
                size={18}
                className="mt-0.5 shrink-0 text-text-muted"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-sm font-medium">
                  Qué recibirá el participante
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">
                  Un enlace para crear su cuenta. Después deberá confirmar su
                  correo para registrar la organización.
                </p>
              </div>
            </div>
            <p className="flex items-center gap-2 text-xs text-text-muted">
              <Users size={15} aria-hidden="true" />
              {data.available} cupos disponibles de {data.capacity}. El envío
              reserva un cupo según las reglas de la beta.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-base pt-4">
              <ActionButton tone="tertiary" onClick={() => setDialog(null)}>
                Volver a participantes
              </ActionButton>
              <ActionButton
                type="submit"
                tone="primary"
                disabled={!data.admissions_open || data.available < 1}
              >
                <Send size={16} aria-hidden="true" />
                Enviar invitación
              </ActionButton>
            </div>
            {(!data.admissions_open || data.available < 1) && (
              <p className="text-sm text-accent-yellow">
                {!data.admissions_open
                  ? "Abre admisiones para invitar."
                  : "Sin cupos disponibles."}
              </p>
            )}
          </form>
        </BetaDialog>
      )}

      {active && dialog === "settings" && data && (
        <BetaDialog
          title="Configuración de beta"
          description="Controla las admisiones y el canal de comentarios sin interrumpir el directorio."
          icon={Settings2}
          drawer
          onClose={() => setDialog(null)}
        >
          <nav
            className="mb-6 flex gap-1 border-b border-border-base"
            aria-label="Configuración de beta"
          >
            <button
              type="button"
              aria-pressed={settingsTab === "capacity"}
              onClick={() => setSettingsTab("capacity")}
              className={
                "min-h-11 flex-1 border-b-2 px-2 text-sm font-medium " +
                (settingsTab === "capacity"
                  ? "border-accent-green text-accent-green"
                  : "border-transparent text-text-muted")
              }
            >
              Cupos y admisiones
            </button>
            <button
              type="button"
              aria-pressed={settingsTab === "feedback"}
              onClick={() => setSettingsTab("feedback")}
              className={
                "min-h-11 flex-1 border-b-2 px-2 text-sm font-medium " +
                (settingsTab === "feedback"
                  ? "border-accent-green text-accent-green"
                  : "border-transparent text-text-muted")
              }
            >
              Comentarios
            </button>
          </nav>
          {message && (
            <div className="mb-5">
              <InlineNotice
                message={message}
                onDismiss={() => setMessage("")}
              />
            </div>
          )}
          {settingsTab === "capacity" ? (
            <div className="space-y-7">
              <section>
                <div className="flex items-center gap-2">
                  <Users
                    size={18}
                    className="text-text-muted"
                    aria-hidden="true"
                  />
                  <h3 className="text-base font-semibold">
                    Configurar cupos y admisiones
                  </h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">
                  Hay {data.reserved} reservas vigentes. Cambiar el límite no
                  cambia el estado de las admisiones.
                </p>
                <label className="mt-5 block text-sm font-medium">
                  Cupos
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={capacity ?? data.capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="platform-field max-w-36"
                  />
                </label>
                <ActionButton
                  className="mt-4"
                  disabled={
                    !Number.isInteger(capacity ?? data.capacity) ||
                    (capacity ?? data.capacity) < Math.max(1, data.reserved) ||
                    (capacity ?? data.capacity) > 100
                  }
                  onClick={() =>
                    setSelection({
                      title: "Guardar cupos",
                      description:
                        "Cupos: " +
                        data.capacity +
                        " → " +
                        (capacity ?? data.capacity) +
                        ". Las admisiones conservan su estado.",
                      payload: {
                        action: "configure",
                        capacity: capacity ?? data.capacity,
                      },
                    })
                  }
                >
                  Guardar cupos
                </ActionButton>
              </section>
              <section className="border-t border-border-base pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">
                      Admisión de participantes
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-text-muted">
                      Cerrar admisiones conserva las cuentas existentes y puede
                      impedir completar nuevas activaciones.
                    </p>
                  </div>
                  <span
                    className={
                      "shrink-0 rounded-md px-2 py-1 text-xs " +
                      (data.admissions_open
                        ? "bg-accent-green/10 text-accent-green"
                        : "bg-white/[.05] text-text-muted")
                    }
                  >
                    {data.admissions_open ? "Abiertas" : "Cerradas"}
                  </span>
                </div>
                <ActionButton
                  className="mt-4"
                  onClick={() =>
                    setSelection({
                      title: data.admissions_open
                        ? "Cerrar admisiones"
                        : "Abrir admisiones",
                      description:
                        "Cerrar admisiones conserva las cuentas existentes y puede impedir completar nuevas activaciones.",
                      payload: {
                        action: "configure",
                        admissions_open: !data.admissions_open,
                      },
                    })
                  }
                >
                  {data.admissions_open
                    ? "Cerrar admisiones"
                    : "Abrir admisiones"}
                </ActionButton>
              </section>
            </div>
          ) : (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                setSelection({
                  title: "Guardar canal de comentarios",
                  description:
                    "El formulario se mostrará a los participantes beta. El enlace de respuestas será exclusivamente administrativo.",
                  payload: {
                    action: "configure_feedback",
                    feedback_submission_url:
                      submission ?? data.feedback_submission_url,
                    feedback_management_url:
                      management ?? data.feedback_management_url,
                  },
                });
              }}
            >
              <div className="flex gap-3">
                <LifeBuoy
                  size={20}
                  className="mt-0.5 shrink-0 text-text-muted"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-base font-semibold">
                    Formulario externo de comentarios
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">
                    Un enlace para participantes y otro, opcional, para revisar
                    respuestas como superadmin.
                  </p>
                </div>
              </div>
              <label className="block text-sm font-medium">
                Enlace del formulario
                <input
                  type="url"
                  pattern="https://.*"
                  maxLength={2048}
                  className="platform-field"
                  value={submission ?? data.feedback_submission_url}
                  onChange={(e) => setSubmission(e.target.value)}
                  placeholder="https://…"
                />
              </label>
              <label className="block text-sm font-medium">
                Enlace de respuestas (sólo superadmins)
                <input
                  type="url"
                  pattern="https://.*"
                  maxLength={2048}
                  className="platform-field"
                  value={management ?? data.feedback_management_url}
                  onChange={(e) => setManagement(e.target.value)}
                  placeholder="https://…"
                />
              </label>
              <p className="rounded-xl bg-bg-dark p-4 text-xs leading-relaxed text-text-muted">
                Recoge error/mejora/duda, módulo, descripción, pasos y
                resultados esperado y obtenido. Sentinel no envía datos del
                cliente al abrir estos enlaces.
              </p>
              <div className="flex flex-wrap gap-2 border-t border-border-base pt-4">
                <ActionButton type="submit">
                  Guardar canal de comentarios
                </ActionButton>
                {data.feedback_submission_url ? (
                  <a
                    className="platform-action platform-action-tertiary"
                    href={data.feedback_submission_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir formulario
                    <ArrowRight size={14} aria-hidden="true" />
                  </a>
                ) : (
                  <span className="flex min-h-11 items-center text-xs text-text-muted">
                    Formulario pendiente de configurar.
                  </span>
                )}
                {data.feedback_management_url && (
                  <a
                    className="platform-action platform-action-tertiary"
                    href={data.feedback_management_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir respuestas
                    <ArrowRight size={14} aria-hidden="true" />
                  </a>
                )}
              </div>
            </form>
          )}
        </BetaDialog>
      )}

      {active && selection && (
        <PlatformActionModal
          title={selection.title}
          description={selection.description}
          destructive={selection.destructive}
          onClose={() => setSelection(null)}
          onSuccess={setMessage}
          onConfirm={async (reason) => {
            await platformApi.post("platform-admin/beta/", {
              ...selection.payload,
              reason,
            });
            if (selection.payload.action === "invite") setEmail("");
            if (selection.payload.action === "configure_feedback") {
              setSubmission(null);
              setManagement(null);
            }
            await client.invalidateQueries({ queryKey: ["beta-admin"] });
            void client.invalidateQueries({ queryKey: ["beta-overview"] });
            void client.invalidateQueries({
              queryKey: ["platform-admin-orgs"],
            });
            void client.invalidateQueries({
              queryKey: ["platform-admin-org-detail"],
            });
          }}
        />
      )}
    </section>
  );
}
