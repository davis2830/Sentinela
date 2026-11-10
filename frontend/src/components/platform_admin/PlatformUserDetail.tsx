import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  KeyRound,
  Mail,
  RefreshCw,
  Shield,
  UserRound,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { platformApi } from "../../services/platformApi";
import ModalSurface from "../common/ModalSurface";
import { ActionButton } from "./PlatformUI";

export type PlatformAccount = {
  id: string;
  email: string;
  name: string;
  organization_id: string | null;
  organization_name: string | null;
  role: "platform" | "admin" | "viewer";
  authorization_mode?: "legacy" | "custom";
  is_active: boolean;
  email_verified: boolean;
  mfa_enabled: boolean;
  last_login: string | null;
};
type Detail = PlatformAccount & {
  effective_permissions: string[];
  roles: { id: string; name: string }[];
  created_at: string;
};
export const platformRoles = {
  platform: "Superadmin",
  admin: "Administrador",
  viewer: "Lectura heredada",
};
export const platformRoleLabel = (account: PlatformAccount) =>
  account.role === "viewer" && account.authorization_mode === "custom"
    ? "Operador personalizado"
    : platformRoles[account.role];

export default function PlatformUserDetail({
  account,
  onClose,
  onOrganization,
  onAudit,
}: {
  account: Pick<PlatformAccount, "id">;
  updatedAt?: number;
  onClose: () => void;
  onOrganization: (id: string) => void;
  onAudit?: (email: string) => void;
}) {
  const query = useQuery<Detail>({
    queryKey: ["platform-user-detail", account.id],
    queryFn: async ({ signal }) =>
      (
        await platformApi.get("platform-admin/users/" + account.id + "/", {
          signal,
        })
      ).data.data,
    refetchOnWindowFocus: false,
  });
  const data = query.data;
  return createPortal(
    <div className="platform-console fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-6">
      <ModalSurface
        label="Ficha de usuario"
        onClose={onClose}
        className="platform-user-dossier flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border-base bg-bg-card shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border-base bg-bg-dark/70 p-5 sm:p-6">
          <div className="flex min-w-0 items-start gap-4">
            <div
              aria-hidden="true"
              className="grid size-12 shrink-0 place-items-center rounded-2xl border border-accent-green/25 bg-accent-green/10 text-accent-green"
            >
              <UserRound size={24} />
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                Ficha de usuario
              </p>
              <h2 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">
                {data?.name || data?.email || "Cuenta de plataforma"}
              </h2>
              {data && (
                <p className="mt-1 break-all text-sm text-text-muted">
                  {data.email}
                </p>
              )}
              {data && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className="ui-status gap-1.5"
                    data-tone={data.is_active ? "success" : "danger"}
                  >
                    <span
                      aria-hidden="true"
                      className="size-1.5 rounded-full bg-current"
                    />
                    {data.is_active ? "Cuenta activa" : "Cuenta desactivada"}
                  </span>
                  <span className="ui-status gap-1.5">
                    <Shield size={13} aria-hidden="true" />
                    {platformRoleLabel(data)}
                  </span>
                </div>
              )}
            </div>
          </div>
          <ActionButton
            tone="tertiary"
            aria-label="Cerrar ficha de usuario"
            onClick={onClose}
            className="!min-w-11 !px-2"
          >
            <X size={20} aria-hidden="true" />
          </ActionButton>
        </header>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
          {query.isPending && (
            <p role="status" className="text-sm text-text-muted">
              Consultando cuenta y autorización…
            </p>
          )}
          {query.isError && (
            <div
              role="alert"
              className="rounded-xl border border-accent-red/25 bg-accent-red/5 p-4 text-sm"
            >
              No se pudo consultar el usuario.{" "}
              {query.data
                ? "Los datos anteriores pueden estar desactualizados."
                : ""}{" "}
              <ActionButton onClick={() => void query.refetch()}>
                Reintentar ficha
              </ActionButton>
            </div>
          )}
          {data && (
            <>
              <section aria-labelledby="user-security-heading">
                <div className="mb-3 flex items-center gap-2">
                  <Shield
                    size={17}
                    className="text-accent-green"
                    aria-hidden="true"
                  />
                  <h3
                    id="user-security-heading"
                    className="text-base font-semibold"
                  >
                    Seguridad de acceso
                  </h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-start gap-3 rounded-xl border border-border-base bg-bg-dark/55 p-4">
                    <Mail
                      size={19}
                      className="mt-0.5 shrink-0 text-text-muted"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-xs text-text-muted">
                        Verificación de correo
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {data.email_verified
                          ? "Correo confirmado"
                          : "Correo sin confirmar"}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        {data.email_verified
                          ? "La cuenta confirmó su dirección."
                          : "La cuenta aún no confirmó su dirección."}
                      </p>
                    </div>
                    {data.email_verified && (
                      <CheckCircle2
                        size={17}
                        className="ml-auto shrink-0 text-accent-green"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-border-base bg-bg-dark/55 p-4">
                    <KeyRound
                      size={19}
                      className="mt-0.5 shrink-0 text-text-muted"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-xs text-text-muted">
                        Autenticación en dos pasos
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {data.mfa_enabled ? "2FA activo" : "Sin configurar"}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        {data.mfa_enabled
                          ? "La cuenta tiene un segundo factor."
                          : "La cuenta no tiene un segundo factor activo."}
                      </p>
                    </div>
                    {data.mfa_enabled && (
                      <CheckCircle2
                        size={17}
                        className="ml-auto shrink-0 text-accent-green"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </div>
              </section>
              <dl className="grid gap-5 border-y border-border-base py-5 sm:grid-cols-2">
                <div>
                  <dt className="flex items-center gap-2 text-xs text-text-muted">
                    <Building2 size={15} aria-hidden="true" />
                    Organización
                  </dt>
                  <dd className="mt-2 break-words text-sm font-medium">
                    {data.organization_name || "Sin organización"}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-2 text-xs text-text-muted">
                    <Clock size={15} aria-hidden="true" />
                    Último inicio de sesión
                  </dt>
                  <dd className="mt-2 text-sm font-medium">
                    {data.last_login
                      ? new Date(data.last_login).toLocaleString("es-GT")
                      : "Sin registro"}
                  </dd>
                </div>
              </dl>
              <section aria-labelledby="user-permissions-heading">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3
                    id="user-permissions-heading"
                    className="text-base font-semibold"
                  >
                    Roles y permisos efectivos
                  </h3>
                  <span className="rounded-md border border-border-base px-2.5 py-1 text-xs text-text-muted">
                    {data.authorization_mode === "custom"
                      ? "Autorización personalizada"
                      : "Autorización heredada"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.roles.length ? (
                    data.roles.map((role) => (
                      <span
                        key={role.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm"
                      >
                        <Shield size={14} aria-hidden="true" />
                        {role.name}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-text-muted">
                      Sin roles personalizados asignados.
                    </p>
                  )}
                </div>
                {data.authorization_mode !== "custom" && (
                  <p className="mt-3 text-sm text-text-muted">
                    Los roles personalizados están inactivos en el modo
                    heredado. Los administradores conservan sus facultades
                    administrativas.
                  </p>
                )}
                <details className="mt-4 rounded-xl border border-border-base bg-bg-dark/40 px-4">
                  <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-medium">
                    Consultar permisos efectivos (
                    {data.effective_permissions.length})
                    <Shield
                      size={15}
                      aria-hidden="true"
                      className="text-text-muted"
                    />
                  </summary>
                  <ul className="grid gap-2 pb-4 pt-2 text-xs sm:grid-cols-2">
                    {data.effective_permissions.map((code) => (
                      <li
                        className="break-all rounded-md border border-border-base bg-bg-dark px-2.5 py-2 font-mono text-text-muted"
                        key={code}
                      >
                        {code}
                      </li>
                    ))}
                  </ul>
                  {!data.effective_permissions.length && (
                    <p className="pb-4 text-sm text-text-muted">
                      Sin permisos operativos efectivos.
                    </p>
                  )}
                </details>
                <p className="mt-3 text-xs leading-relaxed text-text-muted">
                  La edición de roles personalizados corresponde al flujo
                  administrativo de la organización.
                </p>
              </section>
              {(data.organization_id || onAudit) && (
                <div className="flex flex-wrap gap-2 border-t border-border-base pt-4">
                  {data.organization_id && (
                    <ActionButton
                      onClick={() => {
                        onClose();
                        onOrganization(data.organization_id!);
                      }}
                    >
                      <Building2 size={16} aria-hidden="true" />
                      Ver organización
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </ActionButton>
                  )}
                  {onAudit && (
                    <ActionButton
                      tone="tertiary"
                      onClick={() => {
                        onClose();
                        onAudit(data.email);
                      }}
                    >
                      Ver auditoría
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </ActionButton>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border-base bg-bg-dark/50 px-5 py-3 sm:px-6">
          <p className="text-xs text-text-muted">
            {data
              ? "Consultado el " +
                new Date(query.dataUpdatedAt).toLocaleString("es-GT")
              : "Información de cuenta bajo demanda"}
          </p>
          <div className="flex gap-2">
            <ActionButton
              tone="tertiary"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              <RefreshCw size={15} aria-hidden="true" />
              {query.isFetching ? "Actualizando ficha…" : "Actualizar ficha"}
            </ActionButton>
            <ActionButton onClick={onClose}>Cerrar ficha</ActionButton>
          </div>
        </footer>
      </ModalSurface>
    </div>,
    document.body,
  );
}
