import type { paths } from "../../types/generated/api";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { errorMessage } from "../../services/errors";
import { useMemberDirectory } from "../../hooks/useMemberDirectory";
import DirectoryPagination from "./DirectoryPagination";

type Permission =
  paths["/api/v1/users/authorization-catalog/"]["get"]["responses"][200]["content"]["application/json"]["data"][number];
type AuthorizationInput = NonNullable<
  paths["/api/v1/users/{user_id}/authorization/"]["put"]["requestBody"]
>["content"]["application/json"];
interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}
type Access =
  paths["/api/v1/users/{user_id}/authorization/"]["get"]["responses"][200]["content"]["application/json"]["data"];

export default function RolesPermissions() {
  const cache = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [name, setName] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [mode, setMode] = useState<"legacy" | "custom">("custom");
  const [reason, setReason] = useState("");
  const [roleReason, setRoleReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState("");
  const directory = useMemberDirectory({ page, search, status: "active" });
  const catalog = useQuery({
    queryKey: ["authorization-catalog"],
    queryFn: async () =>
      (await api.get<{ data: Permission[] }>("users/authorization-catalog/"))
        .data.data,
  });
  const roleList = useQuery({
    queryKey: ["organization-roles"],
    queryFn: async () =>
      (await api.get<{ data: Role[] }>("users/roles/")).data.data,
  });
  const access = useQuery({
    queryKey: ["user-authorization", userId],
    enabled: !!userId,
    queryFn: async ({ signal }) =>
      (
        await api.get<{ data: Access }>(`users/${userId}/authorization/`, {
          signal,
        })
      ).data.data,
  });
  const saveRole = useMutation({
    mutationFn: async () => {
      const body = { name, permission_codes: codes, reason: roleReason };
      return roleId
        ? api.patch(`users/roles/${roleId}/`, body)
        : api.post("users/roles/", body);
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["organization-roles"] });
      void cache.invalidateQueries({ queryKey: ["user-authorization"] });
      setNotice(
        "Rol guardado. Las sesiones con cambios de acceso fueron invalidadas.",
      );
      setRoleReason("");
      setConfirmed(false);
    },
    onError: (e) => setNotice(errorMessage(e)),
  });
  const saveAccess = useMutation({
    mutationFn: () => {
      const body: AuthorizationInput = {
        authorization_mode: mode,
        role_ids: roles,
        reason,
      };
      return api.put(`users/${userId}/authorization/`, body);
    },
    onSuccess: () => {
      void cache.invalidateQueries({
        queryKey: ["user-authorization", userId],
      });
      void cache.invalidateQueries({ queryKey: ["org-members-unified"] });
      setNotice(
        "Autorización actualizada y auditada. El integrante debe volver a iniciar sesión si cambió su acceso.",
      );
      setReason("");
      setConfirmed(false);
    },
    onError: (e) => setNotice(errorMessage(e)),
  });
  const toggle = (values: string[], value: string) =>
    values.includes(value)
      ? values.filter((v) => v !== value)
      : [...values, value];
  const preview =
    mode === "legacy"
      ? catalog.data?.filter((p) => p.code.endsWith(".read")).map((p) => p.code)
      : [
          ...new Set(
            roleList.data
              ?.filter((r) => roles.includes(r.id))
              .flatMap((r) =>
                r.permissions
                  .map((p) => p.code)
                  .filter((code) => catalog.data?.some((p) => p.code === code)),
              ),
          ),
        ];
  return (
    <section className="space-y-5">
      <h2 className="text-lg font-bold">Roles y permisos</h2>
      <p className="text-sm text-text-muted">
        Los roles guardados permanecen inactivos hasta activar permisos
        personalizados por integrante. La administración sigue reservada a
        administradores.
      </p>
      <p role="status" className="text-sm">
        {notice}
      </p>
      {(catalog.isError || roleList.isError || directory.isError) && (
        <button
          className="min-h-11"
          onClick={() => {
            void catalog.refetch();
            void roleList.refetch();
            void directory.refetch();
          }}
        >
          Reintentar carga de permisos
        </button>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <form
          className="space-y-4 p-5 border border-border-base rounded-2xl"
          onSubmit={(e) => {
            e.preventDefault();
            saveRole.mutate();
          }}
        >
          <h3 className="font-semibold">Configurar rol operativo</h3>
          <p className="text-sm text-text-muted">
            Cambiar los permisos de un rol invalida las sesiones de integrantes
            en modo personalizado cuyo acceso cambie.
          </p>
          <label className="block">
            Rol
            <select
              className="block min-h-11 w-full bg-bg-dark"
              value={roleId}
              onChange={(e) => {
                const role = roleList.data?.find(
                  (r) => r.id === e.target.value,
                );
                setRoleId(e.target.value);
                setName(role?.name || "");
                setCodes(
                  role?.permissions
                    .map((p) => p.code)
                    .filter((code) =>
                      catalog.data?.some((p) => p.code === code),
                    ) || [],
                );
              }}
            >
              <option value="">Nuevo rol</option>
              {roleList.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Nombre
            <input
              className="block w-full min-h-11 bg-bg-dark"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="max-h-80 overflow-y-auto">
            {Object.entries(
              (catalog.data || []).reduce<Record<string, Permission[]>>(
                (groups, p) => {
                  (groups[p.module] ||= []).push(p);
                  return groups;
                },
                {},
              ),
            ).map(([module, entries]) => (
              <fieldset className="mb-3" key={module}>
                <legend className="font-semibold">{module}</legend>
                {entries?.map((p) => (
                  <label
                    key={p.code}
                    className="flex min-h-11 items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={codes.includes(p.code)}
                      onChange={() => setCodes(toggle(codes, p.code))}
                    />
                    {p.name}
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
          <label className="block">
            Motivo del cambio
            <input
              className="block w-full min-h-11 bg-bg-dark"
              required
              value={roleReason}
              onChange={(e) => setRoleReason(e.target.value)}
            />
          </label>
          <button
            className="min-h-11 px-4 rounded-xl bg-accent-green text-black disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={
              saveRole.isPending ||
              !catalog.isSuccess ||
              !roleList.isSuccess ||
              !name.trim() ||
              !roleReason.trim()
            }
          >
            {saveRole.isPending ? "Guardando rol…" : "Guardar rol"}
          </button>
        </form>
        <form
          className="space-y-4 p-5 border border-border-base rounded-2xl"
          onSubmit={(e) => {
            e.preventDefault();
            if (confirmed) saveAccess.mutate();
          }}
        >
          <h3 className="font-semibold">Acceso efectivo de un integrante</h3>
          <label className="block">
            Buscar integrante
            <input
              className="block w-full min-h-11 bg-bg-dark"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="block">
            Integrante
            <select
              className="block w-full min-h-11 bg-bg-dark"
              required
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setRoles([]);
                setConfirmed(false);
              }}
            >
              <option value="">Selecciona un integrante</option>
              {directory.data?.data
                .filter((u) => u.role !== "admin" && !u.is_invitation)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
            </select>
          </label>
          <DirectoryPagination meta={directory.data?.meta} onPage={setPage} />
          {access.isLoading && <p>Cargando acceso actual…</p>}
          {access.isError && (
            <p role="alert">
              No se pudo consultar el acceso.{" "}
              <button type="button" onClick={() => void access.refetch()}>
                Reintentar
              </button>
            </p>
          )}
          {access.data && (
            <details>
              <summary>Acceso actual: {access.data.authorization_mode}</summary>
              <p className="text-sm break-words">
                {access.data.effective_permissions.join(", ") ||
                  "Sin permisos operativos"}
              </p>
              <button
                type="button"
                className="min-h-11"
                onClick={() => {
                  setRoles(access.data.role_ids);
                  setMode(access.data.authorization_mode);
                }}
              >
                Editar asignación actual
              </button>
            </details>
          )}
          <label className="block">
            Modo
            <select
              className="block w-full min-h-11 bg-bg-dark"
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as "legacy" | "custom");
                setConfirmed(false);
              }}
            >
              <option value="legacy">Legacy: lectura actual</option>
              <option value="custom">
                Personalizado: sólo permisos asignados
              </option>
            </select>
          </label>
          <fieldset>
            <legend>Roles asignados</legend>
            {roleList.data?.map((r) => (
              <label key={r.id} className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={roles.includes(r.id)}
                  onChange={() => {
                    setRoles(toggle(roles, r.id));
                    setConfirmed(false);
                  }}
                />
                {r.name}
              </label>
            ))}
          </fieldset>
          <details open>
            <summary>Vista previa del acceso resultante</summary>
            <p className="text-sm break-words">
              {preview?.join(", ") || "Sin permisos operativos"}
            </p>
          </details>
          <label className="block">
            Motivo de autorización
            <input
              required
              className="block w-full min-h-11 bg-bg-dark"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Confirmo el acceso de la vista previa y la invalidación de sesiones
            afectadas.
          </label>
          <button
            className="min-h-11 px-4 rounded-xl bg-accent-green text-black disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={
              !catalog.isSuccess ||
              !roleList.isSuccess ||
              !userId ||
              !confirmed ||
              !reason.trim() ||
              saveAccess.isPending ||
              !access.data
            }
          >
            {saveAccess.isPending
              ? "Aplicando autorización…"
              : "Aplicar autorización"}
          </button>
        </form>
      </div>
    </section>
  );
}
