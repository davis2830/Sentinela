import PlatformUserDetail, {
  type PlatformAccount,
  platformRoleLabel,
} from "./PlatformUserDetail";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { platformApi } from "../../services/platformApi";
import ModalSurface from "../common/ModalSurface";
import { NOCToolbar } from "../common/noc";
import {
  Building2,
  Users,
  Shield,
  Mail,
  KeyRound,
  SlidersHorizontal,
  ChevronDown,
  ArrowUpRight,
  LockKeyhole,
} from "lucide-react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  ActionButton,
  ActionMenu,
  FilterChips,
  InlineNotice,
} from "./PlatformUI";

type Account = PlatformAccount;
type Action =
  "activate" | "deactivate" | "revoke_sessions" | "make_admin" | "make_viewer";
const labels: Record<Action, string> = {
  activate: "Activar cuenta",
  deactivate: "Desactivar cuenta",
  revoke_sessions: "Cerrar sesiones web",
  make_admin: "Asignar como administrador",
  make_viewer: "Asignar lectura heredada",
};
const outcomes: Record<Action, string> = {
  activate: "Cuenta activada",
  deactivate: "Cuenta desactivada",
  revoke_sessions: "Sesiones web cerradas",
  make_admin: "Rol de administrador asignado",
  make_viewer: "Lectura heredada asignada",
};
const roles = {
  platform: "Superadmin",
  admin: "Administrador",
  viewer: "Lectura heredada",
};
const field =
  "min-w-0 rounded-xl border border-border-base bg-bg-dark px-3 py-2 text-sm text-text-main";

export default function PlatformUsers({
  operatorId,
  onOpenOrganization,
  active = true,
  onAudit,
}: {
  operatorId: string;
  onOpenOrganization: (id: string) => void;
  active?: boolean;
  onAudit?: (email: string) => void;
}) {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const settledSearch = useDebouncedValue(search);
  const [organization, setOrganization] = useState("");
  const settledOrganization = useDebouncedValue(organization);
  const [extra, setExtra] = useState({ role: "", verified: "", mfa: "" });
  const [mode, setMode] = useState("");
  const [ordering, setOrdering] = useState("-created_at");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<{
    account: Account;
    action: Action;
  } | null>(null);
  const [inspected, setInspected] = useState<Account | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const query = useQuery<{
    users: Account[];
    total: number;
    page_size: number;
  }>({
    queryKey: [
      "platform-admin-users",
      operatorId,
      settledSearch,
      status,
      page,
      extra,
      settledOrganization,
      mode,
      ordering,
    ],
    enabled:
      active &&
      search === settledSearch &&
      organization === settledOrganization,
    queryFn: async ({ signal }) =>
      (
        await platformApi.get("platform-admin/users/", {
          params: {
            search: settledSearch,
            organization: settledOrganization || undefined,
            status: status || undefined,
            page,
            role: extra.role || undefined,
            verified: extra.verified || undefined,
            mfa: extra.mfa || undefined,
            authorization_mode: mode || undefined,
            ordering,
          },
          signal,
        })
      ).data.data,
  });
  const mutation = useMutation({
    mutationFn: ({ account, action }: { account: Account; action: Action }) =>
      platformApi.post(`platform-admin/users/${account.id}/action/`, {
        action,
        reason: reason.trim(),
      }),
    onSuccess: async (_, { account, action }) => {
      setNotice(`${outcomes[action]} para ${account.email}.`);
      await client.invalidateQueries({ queryKey: ["platform-admin-users"] });
      void client.invalidateQueries({
        queryKey: ["platform-admin-org-detail"],
      });
      setSelection(null);
    },
  });
  function select(account: Account, action: Action) {
    mutation.reset();
    setReason("");
    setNotice("");
    setSelection({ account, action });
  }
  function close() {
    if (!mutation.isPending) setSelection(null);
  }
  const mutationError = mutation.error as {
    response?: { data?: { message?: string } };
  } | null;
  return (
    <section className="space-y-4" aria-labelledby="platform-users-title">
      <div className="platform-directory-heading flex flex-wrap items-start justify-between gap-3">
        <div className="hidden items-center gap-3 md:flex">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-border-base bg-bg-card text-text-muted"
            aria-hidden="true"
          >
            <Users size={20} />
          </span>
          <div>
            <h2
              id="platform-users-title"
              className="text-lg font-semibold tracking-tight"
            >
              Directorio de usuarios
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Identidad, acceso y seguridad de cada cuenta.
            </p>
          </div>
        </div>
        {query.data && (
          <p className="rounded-lg border border-border-base bg-bg-card px-3 py-2 text-sm text-text-muted">
            <strong className="mr-1 text-text-main">{query.data.total}</strong>{" "}
            cuentas encontradas
          </p>
        )}
      </div>
      <div className="platform-directory-controls space-y-4">
        <NOCToolbar
          className="platform-toolbar"
          statusPills={[
            { id: "", label: "Todas las cuentas" },
            { id: "active", label: "Activas" },
            { id: "inactive", label: "Desactivadas" },
          ]}
          selectedStatus={status}
          onStatusChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          searchTerm={search}
          searchPlaceholder="Buscar por nombre, correo u organización"
          onSearchChange={(value) => {
            setSearch(value.slice(0, 254));
            setPage(1);
          }}
        />
        <div className="min-w-0">
          <details className="rounded-xl border border-border-base bg-bg-dark/50 px-4">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
              <SlidersHorizontal
                size={16}
                aria-hidden="true"
                className="text-text-muted"
              />
              Filtros avanzados
              {organization || status || Object.values(extra).some(Boolean)
                ? " · activos"
                : ""}
            </summary>
            <div className="mt-1 grid gap-4 border-t border-border-base pb-4 pt-4 sm:grid-cols-2">
              <label className="block text-sm">
                Ordenar usuarios
                <select
                  className="platform-field sm:max-w-xs"
                  value={ordering}
                  onChange={(e) => {
                    setOrdering(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="-created_at">Más recientes</option>
                  <option value="created_at">Más antiguos</option>
                  <option value="email">Correo</option>
                  <option value="-last_login">Último inicio de sesión</option>
                </select>
              </label>
              <label className="block text-sm">
                Autorización de operadores
                <select
                  className="platform-field sm:max-w-xs"
                  value={mode}
                  onChange={(e) => {
                    setMode(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Todas</option>
                  <option value="legacy">Lectura heredada</option>
                  <option value="custom">Personalizada</option>
                </select>
              </label>
              <label className="block text-sm">
                Organización por nombre o slug
                <input
                  className="platform-field"
                  value={organization}
                  onChange={(e) => {
                    setOrganization(e.target.value.slice(0, 255));
                    setPage(1);
                  }}
                />
              </label>
              <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
                {(["role", "verified", "mfa"] as const).map((key) => (
                  <label key={key} className="block text-sm">
                    {
                      {
                        role: "Rol",
                        verified: "Correo confirmado",
                        mfa: "2FA",
                      }[key]
                    }
                    <select
                      className="platform-field"
                      value={extra[key]}
                      onChange={(e) => {
                        setExtra({ ...extra, [key]: e.target.value });
                        setPage(1);
                      }}
                    >
                      <option value="">Todos</option>
                      {(key === "role"
                        ? [
                            ["platform", "Superadmin"],
                            ["admin", "Administrador"],
                            ["viewer", "Operadores"],
                          ]
                        : [
                            ["true", "Sí"],
                            ["false", "No"],
                          ]
                      ).map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          </details>
        </div>
        <FilterChips
          onClear={() => {
            setSearch("");
            setOrganization("");
            setStatus("");
            setMode("");
            setOrdering("-created_at");
            setExtra({ role: "", verified: "", mfa: "" });
            setPage(1);
          }}
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
            ...(organization
              ? [
                  {
                    id: "org",
                    label: "Organización: " + organization,
                    remove: () => {
                      setOrganization("");
                      setPage(1);
                    },
                  },
                ]
              : []),
            ...(mode
              ? [
                  {
                    id: "mode",
                    label:
                      mode === "custom"
                        ? "Permisos personalizados"
                        : "Lectura heredada",
                    remove: () => {
                      setMode("");
                      setPage(1);
                    },
                  },
                ]
              : []),
            ...(status
              ? [
                  {
                    id: "status",
                    label: status === "active" ? "Activas" : "Desactivadas",
                    remove: () => {
                      setStatus("");
                      setPage(1);
                    },
                  },
                ]
              : []),
            ...(["role", "verified", "mfa"] as const)
              .filter((key) => extra[key])
              .map((key) => ({
                id: key,
                label:
                  { role: "Rol", verified: "Correo confirmado", mfa: "2FA" }[
                    key
                  ] +
                  ": " +
                  (key === "role"
                    ? roles[extra[key] as keyof typeof roles]
                    : extra[key] === "true"
                      ? "Sí"
                      : "No"),
                remove: () => {
                  setExtra((current) => ({ ...current, [key]: "" }));
                  setPage(1);
                },
              })),
          ]}
        />
      </div>
      {notice && (
        <InlineNotice message={notice} onDismiss={() => setNotice("")} />
      )}
      {query.isPending && <p role="status">Cargando usuarios…</p>}
      {query.isError && (
        <p role="alert">
          No se pudo cargar el directorio.{" "}
          {query.data
            ? "Los datos anteriores pueden estar desactualizados."
            : ""}{" "}
          <button onClick={() => void query.refetch()}>Reintentar</button>
        </p>
      )}
      {query.data && (
        <>
          <div className="platform-user-directory overflow-visible rounded-2xl border border-border-base bg-bg-card/55">
            <div className="flex items-center justify-between gap-3 border-b border-border-base px-4 py-3 text-xs text-text-muted">
              <span className="font-semibold uppercase tracking-[0.12em]">
                Cuentas de plataforma
              </span>
              <span>25 registros por página</span>
            </div>
            <table
              aria-label="Usuarios de la plataforma"
              role="table"
              className="block w-full text-left text-sm lg:table"
            >
              <thead role="rowgroup" className="hidden lg:table-header-group">
                <tr
                  role="row"
                  className="border-b border-border-base bg-bg-dark/70 text-xs uppercase tracking-[0.08em] text-text-muted"
                >
                  {[
                    "Usuario",
                    "Acceso y rol",
                    "Organización",
                    "Verificación",
                    "Último acceso",
                    "Acciones",
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="px-3 py-3 font-semibold"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody
                role="rowgroup"
                className="block divide-y divide-border-base lg:table-row-group"
              >
                {query.data.users.map((account) => {
                  const actions: Action[] = ["revoke_sessions"];
                  if (account.organization_id)
                    actions.push(
                      account.role === "admin" ? "make_viewer" : "make_admin",
                    );
                  if (
                    account.authorization_mode === "custom" &&
                    account.role === "viewer"
                  )
                    actions.push("make_viewer");
                  actions.push(account.is_active ? "deactivate" : "activate");
                  return (
                    <tr
                      key={account.id}
                      role="row"
                      className="grid grid-cols-2 items-start gap-x-4 gap-y-3 px-4 py-4 transition-colors hover:bg-bg-card-hover/60 lg:table-row lg:p-0"
                    >
                      <td
                        role="cell"
                        className="col-span-2 min-w-0 lg:max-w-64 lg:px-3 lg:py-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            aria-hidden="true"
                            className="grid size-10 shrink-0 place-items-center rounded-xl border border-border-base bg-bg-dark text-sm font-semibold text-text-main"
                          >
                            {(account.name || account.email)
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                          <div className="min-w-0 break-words">
                            <p className="font-semibold">
                              {account.name || account.email}
                            </p>
                            {account.name && (
                              <p className="text-xs text-text-muted">
                                {account.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td role="cell" className="space-y-1 lg:px-3 lg:py-3">
                        <p className="mb-1 text-xs font-medium text-text-muted">
                          <Shield
                            size={12}
                            className="mr-1 inline"
                            aria-hidden="true"
                          />
                          {platformRoleLabel(account)}
                        </p>
                        <span
                          className="ui-status"
                          data-tone={account.is_active ? "success" : "danger"}
                        >
                          {account.is_active ? "Activa" : "Desactivada"}
                        </span>
                      </td>

                      <td
                        role="cell"
                        className="min-w-0 lg:max-w-52 lg:px-3 lg:py-3"
                      >
                        {account.organization_id ? (
                          <button
                            type="button"
                            className="inline-flex min-h-11 items-center gap-2 text-left text-sm text-text-muted hover:text-accent-green"
                            style={{ minHeight: 44 }}
                            onClick={() =>
                              onOpenOrganization(account.organization_id!)
                            }
                          >
                            <Building2
                              size={14}
                              className="shrink-0"
                              aria-hidden="true"
                            />
                            <span className="min-w-0 break-words">
                              {account.organization_name || "Ver organización"}
                            </span>
                          </button>
                        ) : (
                          <span className="text-xs text-text-muted">
                            Sin organización
                          </span>
                        )}
                      </td>
                      <td
                        role="cell"
                        className="hidden space-y-2 text-sm lg:table-cell lg:px-3 lg:py-4"
                      >
                        <p
                          className="ui-tone"
                          data-tone={
                            account.email_verified ? "success" : "warning"
                          }
                        >
                          <Mail
                            size={13}
                            className="mr-1.5 inline"
                            aria-hidden="true"
                          />
                          {account.email_verified
                            ? "Correo confirmado"
                            : "Correo sin confirmar"}
                        </p>
                        <p
                          className="ui-tone"
                          data-tone={account.mfa_enabled ? "success" : "muted"}
                        >
                          <KeyRound
                            size={13}
                            className="mr-1.5 inline"
                            aria-hidden="true"
                          />
                          {account.mfa_enabled ? "2FA activo" : "Sin 2FA"}
                        </p>
                      </td>
                      <td
                        role="cell"
                        className="hidden text-sm text-text-muted tabular-nums lg:table-cell lg:px-3 lg:py-4"
                      >
                        <span className="block lg:hidden">Último acceso</span>
                        {account.last_login
                          ? new Date(account.last_login).toLocaleString("es-GT")
                          : "Sin registro"}
                      </td>
                      <td role="cell" className="col-span-2 lg:px-3 lg:py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          <ActionButton
                            tone="tertiary"
                            className="!border-border-base !bg-bg-dark text-text-main"
                            aria-label={"Ver ficha de " + account.email}
                            onClick={() => setInspected(account)}
                          >
                            Ver ficha
                            <ArrowUpRight size={14} aria-hidden="true" />
                          </ActionButton>
                          <ActionMenu
                            key={account.role + "-" + account.is_active}
                            accessibleLabel={"Más acciones de " + account.email}
                          >
                            {onAudit && (
                              <ActionButton
                                tone="tertiary"
                                onClick={() => onAudit(account.email)}
                              >
                                Ver auditoría
                              </ActionButton>
                            )}
                            {account.role !== "platform" &&
                              actions.map((action) => (
                                <ActionButton
                                  key={action}
                                  tone="tertiary"
                                  className={
                                    action === "deactivate"
                                      ? "text-accent-red"
                                      : ""
                                  }
                                  onClick={() => select(account, action)}
                                >
                                  {labels[action]}
                                </ActionButton>
                              ))}
                          </ActionMenu>
                        </div>
                      </td>
                      <td className="col-span-2 lg:hidden">
                        <details>
                          <summary className="flex min-h-11 cursor-pointer items-center justify-between text-sm text-text-muted">
                            Seguridad y último acceso
                            <ChevronDown size={14} aria-hidden="true" />
                          </summary>
                          <p className="py-2 text-sm">
                            {account.email_verified
                              ? "Correo confirmado"
                              : "Correo sin confirmar"}{" "}
                            · {account.mfa_enabled ? "2FA activo" : "Sin 2FA"}
                            <br />
                            Último acceso:{" "}
                            {account.last_login
                              ? new Date(account.last_login).toLocaleString(
                                  "es-GT",
                                )
                              : "Sin registro"}
                          </p>
                        </details>
                      </td>
                    </tr>
                  );
                })}
                {!query.data.users.length && (
                  <tr role="row" className="block lg:table-row">
                    <td
                      role="cell"
                      colSpan={6}
                      className="block px-4 py-12 text-center text-text-muted lg:table-cell"
                    >
                      No hay usuarios para estos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-base bg-bg-dark/40 px-4 py-3 text-sm text-text-muted">
              <span>{query.data.total} usuarios encontrados</span>
              <div className="flex items-center gap-2">
                <ActionButton
                  tone="tertiary"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </ActionButton>
                <span>Página {page}</span>
                <ActionButton
                  tone="tertiary"
                  disabled={page * query.data.page_size >= query.data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Siguiente
                </ActionButton>
              </div>
            </div>
          </div>
        </>
      )}
      {selection &&
        createPortal(
          <div className="platform-console fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <ModalSurface
              label={labels[selection.action]}
              onClose={close}
              className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border-base bg-bg-card p-6"
            >
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  mutation.mutate(selection);
                }}
              >
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                  <LockKeyhole size={14} aria-hidden="true" />
                  Administración de cuenta
                </p>
                <h3 className="text-xl font-semibold">
                  {labels[selection.action]}
                </h3>
                <p className="break-all text-sm text-text-muted">
                  {selection.account.email}
                </p>
                {selection.action === "revoke_sessions" && (
                  <p className="text-sm text-text-muted">
                    El usuario tendrá que iniciar sesión de nuevo. Sus tokens
                    API conservarán sus permisos.
                  </p>
                )}
                {(selection.action === "make_admin" ||
                  selection.action === "make_viewer") && (
                  <p className="text-sm text-text-muted">
                    El cambio se aplica en esta organización y cierra las
                    sesiones web del usuario. Sus tokens API quedan sujetos al
                    rol nuevo. Se establece el modo heredado y se conservan
                    inactivas las asignaciones personalizadas.
                  </p>
                )}
                <label className="block text-sm">
                  Motivo para la auditoría
                  <textarea
                    className={field + " mt-2 block w-full"}
                    required
                    minLength={3}
                    maxLength={500}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
                {mutation.isError && (
                  <p role="alert" className="text-sm text-accent-red">
                    {mutationError?.response?.data?.message ||
                      "No se pudo aplicar la acción. Verifica tu sesión y el motivo."}
                  </p>
                )}
                <div className="flex flex-wrap justify-end gap-3">
                  <ActionButton
                    tone="tertiary"
                    onClick={close}
                    disabled={mutation.isPending}
                  >
                    Cancelar
                  </ActionButton>
                  <button
                    className={
                      "platform-action " +
                      (selection.action === "deactivate"
                        ? "platform-action-danger"
                        : "platform-action-primary")
                    }
                    disabled={reason.trim().length < 3 || mutation.isPending}
                  >
                    {mutation.isPending
                      ? "Aplicando…"
                      : labels[selection.action]}
                  </button>
                </div>
              </form>
            </ModalSurface>
          </div>,
          document.body,
        )}
      {inspected && (
        <PlatformUserDetail
          account={inspected}
          updatedAt={query.dataUpdatedAt}
          onClose={() => setInspected(null)}
          onOrganization={onOpenOrganization}
          onAudit={onAudit}
        />
      )}
    </section>
  );
}
