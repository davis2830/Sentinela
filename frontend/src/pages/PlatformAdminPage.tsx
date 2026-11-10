import { useEffect, useState } from "react";
import {
  Building2,
  Users,
  Zap,
  HeartPulse,
  ShieldCheck,
  LayoutDashboard,
  Download,
  Mail,
  ChevronRight,
} from "lucide-react";
import PlatformSectionHeader from "../components/platform_admin/PlatformSectionHeader";
import {
  usePlatformNavigation,
  platformSections,
} from "../components/platform_admin/PlatformNavigation";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import PlatformRefresh from "../components/platform_admin/PlatformRefresh";
import PlatformActionModal from "../components/platform_admin/PlatformActionModal";
import PlatformBetaSummary from "../components/platform_admin/PlatformBetaSummary";
import PlatformHealth from "../components/platform_admin/PlatformHealth";
import EditOrganizationContact from "../components/platform_admin/EditOrganizationContact";
import type { BetaAttention } from "../types/platform_beta";
import {
  ActionButton,
  ActionMenu,
  FilterChips,
  InlineNotice,
} from "../components/platform_admin/PlatformUI";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformApi } from "../services/platformApi";
import type { PlatformOrganization } from "../types/platform_admin";
import { usePlatformSession } from "../services/platformApi";
import { NOCPageHeader, NOCToolbar } from "../components/common/noc";
import ExtendTrialModal from "../components/platform_admin/ExtendTrialModal";
import ChangeTenantPlanModal from "../components/platform_admin/ChangeTenantPlanModal";
import TenantDetailDrawer from "../components/platform_admin/TenantDetailDrawer";
import BetaAdminPanel from "../components/platform_admin/BetaAdminPanel";
import PlatformUserDetail from "../components/platform_admin/PlatformUserDetail";
import PlatformUsers from "../components/platform_admin/PlatformUsers";
import PlatformAudit from "../components/platform_admin/PlatformAudit";
import { subscriptionStates } from "../components/platform_admin/OrganizationDistribution";

export default function PlatformAdminPage() {
  const queryClient = useQueryClient();
  const user = usePlatformSession((state) => state.session?.user);
  const { section, setSection } = usePlatformNavigation();
  const [visited, setVisited] = useState<string[]>([section]);
  useEffect(
    () =>
      setVisited((previous) =>
        previous.includes(section) ? previous : [...previous, section],
      ),
    [section],
  );
  const [inspectedUserId, setInspectedUserId] = useState<string | null>(null);
  const [betaSeed, setBetaSeed] = useState<{
    attention: BetaAttention;
    nonce: number;
  }>();
  const [selectedForContact, setSelectedForContact] =
    useState<PlatformOrganization | null>(null);
  const [accessFilter, setAccessFilter] = useState("all");
  const [betaFilter, setBetaFilter] = useState("");
  const [ordering, setOrdering] = useState("-created_at");
  const [auditSeed, setAuditSeed] = useState<{
    email?: string;
    organization_id?: string;
    nonce: number;
  }>();
  const [action, setAction] = useState<{
    title: string;
    description: string;
    run: (reason: string) => Promise<unknown>;
    destructive?: boolean;
    confirmLabel?: string;
  } | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 10000);
    return () => clearTimeout(timer);
  }, [notice]);
  const [exporting, setExporting] = useState(false);
  const [classification, setClassification] = useState("all");
  const [expiring, setExpiring] = useState(false);
  const [directoryPage, setDirectoryPage] = useState(1);

  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState("");
  const settledSearch = useDebouncedValue(searchTerm);
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals & Drawer State
  const [selectedForTrial, setSelectedForTrial] =
    useState<PlatformOrganization | null>(null);
  const [selectedForPlan, setSelectedForPlan] =
    useState<PlatformOrganization | null>(null);
  const [inspectedOrgId, setInspectedOrgId] = useState<string | null>(null);

  // Shared area clock; only stored data is consulted.

  // Query: Organizations List
  const {
    data: directory,
    isLoading: isLoadingOrgs,
    isError: organizationsError,
    refetch: refreshOrganizations,
  } = useQuery<{
    items: PlatformOrganization[];
    meta: { total: number; has_next: boolean };
  }>({
    queryKey: [
      "platform-admin-orgs",
      user?.id,
      settledSearch,
      planFilter,
      statusFilter,
      directoryPage,
      classification,
      expiring,
      accessFilter,
      betaFilter,
      ordering,
    ],
    enabled: section === "organizaciones" && settledSearch === searchTerm,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.set("page", String(directoryPage));
      params.set("access_status", accessFilter);
      params.set("ordering", ordering);
      if (betaFilter) params.set("beta", betaFilter);
      if (settledSearch) params.set("search", settledSearch);
      params.set("classification", classification);
      if (expiring) params.set("trial_expiring", "true");
      if (planFilter !== "all") params.set("plan_tier", planFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await platformApi.get(
        `/platform-admin/organizations/?${params.toString()}`,
        { signal },
      );
      return { items: res.data?.data || [], meta: res.data?.meta };
    },
  });

  const organizations = directory?.items;

  // Toggle Status Mutation (Suspend/Reactivate)
  const toggleStatusMutation = useMutation({
    mutationFn: async ({
      orgId,
      action,
      reason,
    }: {
      orgId: string;
      action: "suspend" | "reactivate";
      reason: string;
    }) => {
      await platformApi.post(
        `/platform-admin/organizations/${orgId}/toggle-status/`,
        { action, reason },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-admin-orgs"] });
      queryClient.invalidateQueries({ queryKey: ["platform-admin-stats"] });
      queryClient.invalidateQueries({
        queryKey: ["platform-admin-org-detail"],
      });
      void queryClient.invalidateQueries({ queryKey: ["beta-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["beta-admin"] });
    },
  });

  function openDirectory(plan: string, status: string, expiring = false) {
    setPlanFilter(plan);
    setStatusFilter(status);
    setSearchTerm("");
    setDirectoryPage(1);
    setClassification("customers");
    setExpiring(expiring);
    setAccessFilter("all");
    setBetaFilter("");
    setSection("organizaciones");
  }

  const handleExportCSV = async (filtered = false) => {
    setExporting(true);
    setNotice("");
    try {
      const res = await platformApi.get("/platform-admin/export-csv/", {
        responseType: "blob",
        params: filtered
          ? {
              search: settledSearch,
              plan_tier: planFilter,
              status: statusFilter,
              classification,
              trial_expiring: expiring,
              access_status: accessFilter,
              beta: betaFilter || undefined,
              ordering,
            }
          : {},
      });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `sentinel_tenants_${new Date().toISOString().slice(0, 10)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setNotice(
        filtered
          ? "Exportación de resultados filtrados completada."
          : "Exportación de todas las organizaciones completada.",
      );
    } catch {
      setNotice("Error al exportar CSV de clientes.");
    } finally {
      setExporting(false);
    }
  };

  const moduleIcon = {
    resumen: LayoutDashboard,
    beta: Zap,
    organizaciones: Building2,
    usuarios: Users,
    salud: HeartPulse,
    auditoria: ShieldCheck,
  }[section];
  const ModuleIcon = moduleIcon;
  const moduleLabel =
    section === "resumen" || section === "beta"
      ? "BETA CERRADA"
      : section === "salud" || section === "auditoria"
        ? "CONTROL DE PLATAFORMA"
        : "ADMINISTRACIÓN";

  return (
    <div className="platform-workspace space-y-6 pb-8 font-sans">
      {/* 1. TOP HEADER */}

      <div className="platform-page-header">
        <NOCPageHeader
          title={platformSections[section].title}
          badgeText={moduleLabel}
          icon={
            <span className="platform-module-icon">
              <ModuleIcon size={23} aria-hidden="true" />
            </span>
          }
          description={platformSections[section].description}

          actions={
            <>
              {section !== "auditoria" && section !== "salud" && (
                <PlatformRefresh
                  prefix={
                    section === "resumen"
                      ? "beta-overview"
                      : section === "organizaciones"
                        ? "platform-admin-orgs"
                        : section === "usuarios"
                          ? "platform-admin-users"
                          : "beta-admin"
                  }
                />
              )}
            </>
          }
        />
      </div>

      {(visited.includes("beta") || section === "beta") && (
        <div hidden={section !== "beta"}>
          <BetaAdminPanel
            active={section === "beta"}
            seed={betaSeed}
            onOpenOrganization={setInspectedOrgId}
          />
        </div>
      )}
      {(visited.includes("usuarios") || section === "usuarios") && user && (
        <div hidden={section !== "usuarios"}>
          <PlatformUsers
            active={section === "usuarios"}
            operatorId={user.id}
            onOpenOrganization={setInspectedOrgId}
            onAudit={(email) => {
              setAuditSeed({ email, nonce: Date.now() });
              setSection("auditoria");
            }}
          />
        </div>
      )}
      {(visited.includes("auditoria") || section === "auditoria") && user && (
        <div hidden={section !== "auditoria"}>
          <PlatformAudit
            active={section === "auditoria"}
            seed={auditSeed}
            operatorId={user.id}
            onOpenOrganization={setInspectedOrgId}
          />
        </div>
      )}
      {(visited.includes("resumen") || section === "resumen") && (
        <div hidden={section !== "resumen"}>
          <PlatformBetaSummary
            active={section === "resumen"}
            onOpenDirectory={openDirectory}
            onOpenBeta={(attention) => {
              setBetaSeed({ attention, nonce: Date.now() });
              setSection("beta");
            }}
          />
        </div>
      )}
      {(visited.includes("salud") || section === "salud") && (
        <div hidden={section !== "salud"}>
          <PlatformHealth
            active={section === "salud"}
            onMailFailures={() => {
              setBetaSeed({ attention: "failed_delivery", nonce: Date.now() });
              setSection("beta");
            }}
          />
        </div>
      )}

      {section === "organizaciones" && (
        <section
          className="platform-directory space-y-4"
          aria-labelledby="organizations-title"
        >
          <PlatformSectionHeader
            icon={Building2}
            id="organizations-title"
            eyebrow="CLIENTES Y ENTORNOS"
            title="Directorio de organizaciones"
            description={
              <>
                <strong className="font-semibold text-text-main">
                  {directory?.meta?.total ?? "—"}
                </strong>{" "}
                resultados · 25 por página. Abre una ficha para revisar
                contacto, usuarios y recursos.
              </>
            }
            actions={
              <div className="platform-export-control">
                <Download size={16} aria-hidden="true" />
                <ActionMenu label={exporting ? "Exportando…" : "Exportar CSV"}>
                  <ActionButton
                    disabled={exporting}
                    tone="tertiary"
                    onClick={() => void handleExportCSV(true)}
                  >
                    Exportar resultados filtrados
                  </ActionButton>
                  <ActionButton
                    disabled={exporting}
                    tone="tertiary"
                    onClick={() => void handleExportCSV(false)}
                  >
                    Exportar todas
                  </ActionButton>
                </ActionMenu>
              </div>
            }
          />
          {notice && (
            <InlineNotice message={notice} onDismiss={() => setNotice("")} />
          )}
          <NOCToolbar
            className="platform-toolbar"
            searchTerm={searchTerm}
            onSearchChange={(value) => {
              setSearchTerm(value);
              setDirectoryPage(1);
            }}
            searchPlaceholder="Buscar por nombre de empresa, slug o email de facturación..."
            categoryLabel="Plan:"
            categories={[
              { id: "all", label: "Todos" },
              { id: "free", label: "Free" },
              { id: "pro", label: "Pro" },
              { id: "business", label: "Business" },
              { id: "enterprise", label: "Enterprise" },
            ]}
            selectedCategory={planFilter}
            onCategoryChange={(value) => {
              setPlanFilter(value);
              setDirectoryPage(1);
            }}
            statusPills={[
              { id: "all", label: "Todos los estados" },
              ...subscriptionStates,
            ]}
            selectedStatus={statusFilter}
            onStatusChange={(value) => {
              setStatusFilter(value);
              setDirectoryPage(1);
            }}
          />
          <details className="platform-advanced-filters">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm">
              Filtros avanzados
            </summary>
            <div className="grid gap-4 pb-4 pt-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm">
                Acceso
                <select
                  className="platform-field"
                  value={accessFilter}
                  onChange={(e) => {
                    setAccessFilter(e.target.value);
                    setDirectoryPage(1);
                  }}
                >
                  <option value="all">Todos</option>
                  <option value="active">Habilitado</option>
                  <option value="suspended">Suspendido</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </label>
              <label className="text-sm">
                Participación beta
                <select
                  className="platform-field"
                  value={betaFilter}
                  onChange={(e) => {
                    setBetaFilter(e.target.value);
                    setDirectoryPage(1);
                  }}
                >
                  <option value="">Todas</option>
                  <option value="true">Beta</option>
                  <option value="false">Fuera de beta</option>
                </select>
              </label>
              <label className="text-sm">
                Ordenar organizaciones
                <select
                  className="platform-field"
                  value={ordering}
                  onChange={(e) => {
                    setOrdering(e.target.value);
                    setDirectoryPage(1);
                  }}
                >
                  <option value="-created_at">Más recientes</option>
                  <option value="created_at">Más antiguas</option>
                  <option value="name">Nombre A–Z</option>
                  <option value="-name">Nombre Z–A</option>
                </select>
              </label>
              <label className="text-sm">
                Clasificación
                <select
                  className="platform-field"
                  value={classification}
                  onChange={(e) => {
                    setClassification(e.target.value);
                    setDirectoryPage(1);
                  }}
                >
                  <option value="all">Todas</option>
                  <option value="customers">Clientes</option>
                  <option value="tests">Pruebas</option>
                </select>
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={expiring}
                  onChange={(e) => {
                    setExpiring(e.target.checked);
                    setDirectoryPage(1);
                  }}
                />{" "}
                Prueba vence en 7 días
              </label>
            </div>
          </details>
          <FilterChips
            onClear={() => {
              setSearchTerm("");
              setPlanFilter("all");
              setStatusFilter("all");
              setClassification("all");
              setExpiring(false);
              setAccessFilter("all");
              setBetaFilter("");
              setOrdering("-created_at");
              setDirectoryPage(1);
            }}
            items={[
              ...(searchTerm
                ? [
                    {
                      id: "search",
                      label: "Búsqueda: " + searchTerm,
                      remove: () => {
                        setSearchTerm("");
                        setDirectoryPage(1);
                      },
                    },
                  ]
                : []),
              ...(planFilter !== "all"
                ? [
                    {
                      id: "plan",
                      label: "Plan: " + planFilter,
                      remove: () => {
                        setPlanFilter("all");
                        setDirectoryPage(1);
                      },
                    },
                  ]
                : []),
              ...(statusFilter !== "all"
                ? [
                    {
                      id: "status",
                      label:
                        "Suscripción: " +
                        (subscriptionStates.find((i) => i.id === statusFilter)
                          ?.label || statusFilter),
                      remove: () => {
                        setStatusFilter("all");
                        setDirectoryPage(1);
                      },
                    },
                  ]
                : []),
              ...(classification !== "all"
                ? [
                    {
                      id: "class",
                      label:
                        classification === "tests" ? "Pruebas" : "Clientes",
                      remove: () => {
                        setClassification("all");
                        setDirectoryPage(1);
                      },
                    },
                  ]
                : []),
              ...(expiring
                ? [
                    {
                      id: "expiring",
                      label: "Vence en 7 días",
                      remove: () => {
                        setExpiring(false);
                        setDirectoryPage(1);
                      },
                    },
                  ]
                : []),
              ...(accessFilter !== "all"
                ? [
                    {
                      id: "access",
                      label: "Acceso: " + accessFilter,
                      remove: () => {
                        setAccessFilter("all");
                        setDirectoryPage(1);
                      },
                    },
                  ]
                : []),
              ...(betaFilter
                ? [
                    {
                      id: "beta",
                      label: betaFilter === "true" ? "Beta" : "Fuera de beta",
                      remove: () => {
                        setBetaFilter("");
                        setDirectoryPage(1);
                      },
                    },
                  ]
                : []),
            ]}
          />
          {organizationsError && !!organizations?.length && (
            <p role="alert">
              No se pudo actualizar el directorio. Los datos anteriores pueden
              estar desactualizados.
            </p>
          )}
          {organizationsError && !organizations?.length ? (
            <p role="alert">
              No se pudieron cargar las organizaciones.{" "}
              <ActionButton onClick={() => void refreshOrganizations()}>
                Reintentar consulta
              </ActionButton>
            </p>
          ) : isLoadingOrgs ? (
            <p role="status" className="py-8 text-sm text-text-muted">
              Cargando directorio de organizaciones…
            </p>
          ) : !organizations?.length ? (
            <div className="platform-directory-empty">
              <span className="platform-section-icon">
                <Building2 size={24} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">
                Sin resultados en este directorio
              </h3>
              <p className="mt-2 max-w-md text-sm text-text-muted">
                No se encontraron organizaciones coincidentes con los filtros.
              </p>
              <p className="mt-1 text-sm text-text-muted">
                Prueba otro nombre o ajusta los filtros aplicados.
              </p>
            </div>
          ) : (
            <div className="platform-table-surface">
              <table
                className="platform-directory-table platform-organizations-table"
                aria-label="Organizaciones de Sentinel"
              >
                <thead>
                  <tr>
                    {[
                      "Organización",
                      "Acceso y suscripción",
                      "Plan",
                      "Prueba",
                      "Uso del plan",
                      "Registro",
                      "Acciones",
                    ].map((label) => (
                      <th key={label} scope="col">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {organizations.map((org) => {
                    const state = subscriptionStates.find(
                      (item) => item.id === org.subscription_status,
                    );
                    const suspended =
                      org.access_status === "suspended" ||
                      org.beta_status === "suspended";
                    const trial = org.is_in_trial
                      ? org.trial_days_remaining + " días restantes"
                      : "Sin prueba vigente";
                    const details = (
                      <>
                        <span>Plan: {org.plan_tier}</span>
                        <span>{trial}</span>
                        <span>
                          Monitores: {org.targets_count}/{org.max_targets} ·
                          Agentes: {org.probes_count}/{org.max_probes}
                        </span>
                        <span>
                          Registro:{" "}
                          {new Date(org.created_at).toLocaleDateString("es-GT")}
                        </span>
                      </>
                    );
                    return (
                      <tr key={org.id} className="hover:bg-bg-card-hover">
                        <td>
                          <div className="flex items-start gap-3">
                            <span
                              className="platform-org-avatar"
                              aria-hidden="true"
                            >
                              {org.name.trim().slice(0, 2).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold leading-snug text-text-main">
                                {org.name}
                              </p>
                              <p className="mt-1 flex items-start gap-1.5 break-all text-xs text-text-muted">
                                {org.billing_email && (
                                  <Mail
                                    size={12}
                                    className="mt-0.5 shrink-0"
                                    aria-hidden="true"
                                  />
                                )}
                                <span
                                  className="min-w-0 truncate"
                                  title={org.billing_email || org.slug}
                                >
                                  {org.billing_email || org.slug}
                                </span>
                              </p>
                              {org.is_test && (
                                <span className="platform-test-tag mt-2">
                                  Entorno de prueba
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <p
                            className={
                              "platform-access-state " +
                              (suspended ? "is-blocked" : "")
                            }
                          >
                            <span aria-hidden="true" />
                            {org.access_status === "active"
                              ? "Acceso habilitado"
                              : org.access_status === "suspended"
                                ? "Acceso suspendido"
                                : "Acceso cancelado"}
                            {org.beta_managed ? " · Beta" : ""}
                          </p>
                          <span
                            className="ui-status mt-2"
                            title="Estado de la suscripción"
                            data-tone={state?.tone || "muted"}
                          >
                            {state?.label || "Estado desconocido"}
                          </span>
                        </td>
                        <td className="hidden md:table-cell">
                          <span className="platform-plan-label">
                            {org.plan_tier}
                          </span>
                        </td>
                        <td className="hidden md:table-cell text-xs">
                          {trial}
                          {org.is_in_trial && org.trial_ends_at && (
                            <p className="mt-1 text-text-muted">
                              {new Date(org.trial_ends_at).toLocaleDateString(
                                "es-GT",
                              )}
                            </p>
                          )}
                        </td>
                        <td className="hidden md:table-cell text-xs tabular-nums">
                          <p>
                            {org.targets_count}/{org.max_targets} monitores
                          </p>
                          <p className="mt-1 text-text-muted">
                            {org.probes_count}/{org.max_probes} agentes
                          </p>
                        </td>
                        <td className="hidden md:table-cell text-xs text-text-muted">
                          {new Date(org.created_at).toLocaleDateString("es-GT")}
                        </td>
                        <td className="platform-cell-extra">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <ActionButton
                              tone="tertiary"
                              className="platform-open-record"
                              aria-label={"Ver ficha de " + org.name}
                              onClick={() => setInspectedOrgId(org.id)}
                            >
                              Ver ficha{" "}
                              <ChevronRight size={15} aria-hidden="true" />
                            </ActionButton>
                            <ActionMenu
                              compact
                              accessibleLabel={"Más acciones de " + org.name}
                            >
                              <ActionButton
                                tone="tertiary"
                                onClick={() => setSelectedForContact(org)}
                              >
                                Editar contacto
                              </ActionButton>
                              <ActionButton
                                tone="tertiary"
                                onClick={() => setSelectedForPlan(org)}
                              >
                                Cambiar plan
                              </ActionButton>
                              <ActionButton
                                tone="tertiary"
                                onClick={() => setSelectedForTrial(org)}
                              >
                                Extender prueba
                              </ActionButton>
                              <ActionButton
                                tone="tertiary"
                                className={suspended ? "" : "text-accent-red"}
                                disabled={
                                  toggleStatusMutation.isPending ||
                                  org.access_protected
                                }
                                title={
                                  org.access_protected
                                    ? "Organización con superadmins activos protegida"
                                    : undefined
                                }
                                onClick={() =>
                                  setAction({
                                    title: suspended
                                      ? "Reactivar acceso"
                                      : "Suspender acceso",
                                    destructive: !suspended,
                                    description:
                                      org.name +
                                      ". " +
                                      (suspended
                                        ? "Restablece el acceso; conserva la suscripción y las fechas de prueba."
                                        : "Bloquea el acceso y nuevas comprobaciones; invalida sesiones web y conserva datos, plan y suscripción."),
                                    run: (reason) =>
                                      toggleStatusMutation.mutateAsync({
                                        orgId: org.id,
                                        action: suspended
                                          ? "reactivate"
                                          : "suspend",
                                        reason,
                                      }),
                                  })
                                }
                              >
                                {suspended
                                  ? "Reactivar acceso"
                                  : "Suspender acceso"}
                              </ActionButton>
                            </ActionMenu>
                          </div>
                        </td>
                        <td className="platform-cell-extra md:hidden">
                          <details>
                            <summary className="flex min-h-11 cursor-pointer items-center text-sm text-text-muted">
                              Detalles de organización
                            </summary>
                            <div className="grid gap-2 py-2 text-xs text-text-muted">
                              {details}
                            </div>
                          </details>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="platform-pagination">
            <ActionButton
              tone="tertiary"
              disabled={directoryPage === 1 || isLoadingOrgs}
              onClick={() => setDirectoryPage((p) => p - 1)}
            >
              Anterior
            </ActionButton>
            <span className="text-text-muted">
              Página {directoryPage} · {directory?.meta?.total ?? "—"}{" "}
              organizaciones
            </span>
            <ActionButton
              tone="tertiary"
              disabled={isLoadingOrgs || !directory?.meta?.has_next}
              onClick={() => setDirectoryPage((p) => p + 1)}
            >
              Siguiente
            </ActionButton>
          </div>
        </section>
      )}

      {/* Modals & Drawer */}
      {action && (
        <PlatformActionModal
          title={action.title}
          description={action.description}
          onConfirm={action.run}
          destructive={action.destructive}
          confirmLabel={action.confirmLabel}
          onSuccess={setNotice}
          onClose={() => setAction(null)}
        />
      )}
      {inspectedOrgId && (
        <TenantDetailDrawer
          key={"organization:" + inspectedOrgId}
          orgId={inspectedOrgId}
          onOpenUser={setInspectedUserId}
          onEditContact={setSelectedForContact}
          onAccess={(org) => {
            const suspended =
              org.access_status === "suspended" ||
              org.beta_status === "suspended";
            setAction({
              title: suspended ? "Reactivar acceso" : "Suspender acceso",
              description:
                org.name +
                ". " +
                (suspended
                  ? "Restablece acceso sin renovar pruebas ni confirmar pagos."
                  : "Bloquea acceso y nuevas comprobaciones; invalida sesiones y conserva datos, plan y suscripción."),
              destructive: !suspended,
              run: (reason) =>
                toggleStatusMutation.mutateAsync({
                  orgId: org.id,
                  action: suspended ? "reactivate" : "suspend",
                  reason,
                }),
            });
          }}
          notice={notice}
          onDismissNotice={() => setNotice("")}
          onAudit={(id) => {
            setAuditSeed({ organization_id: id, nonce: Date.now() });
            setInspectedOrgId(null);
            setSection("auditoria");
          }}
          onClassify={(org) =>
            setAction({
              title: "Clasificar organización",
              description: `${org.name}: ${org.is_test ? "Prueba → Cliente" : "Cliente → Prueba"}. Las pruebas quedan fuera del resumen comercial. No cambia su plan ni monitoreo.`,
              confirmLabel: org.is_test
                ? "Marcar como cliente"
                : "Marcar como prueba",
              run: async (reason) => {
                await platformApi.post(
                  `platform-admin/organizations/${org.id}/classification/`,
                  { is_test: !org.is_test, reason },
                );
                await Promise.all(
                  [
                    "platform-admin-orgs",
                    "platform-admin-stats",
                    "platform-admin-org-detail",
                  ].map((key) =>
                    queryClient.invalidateQueries({ queryKey: [key] }),
                  ),
                );
              },
            })
          }
          onClose={() => setInspectedOrgId(null)}
          onChangePlan={setSelectedForPlan}
          onExtendTrial={setSelectedForTrial}
        />
      )}

      {selectedForContact && (
        <EditOrganizationContact
          key={"contact:" + selectedForContact.id}
          organization={selectedForContact}
          onClose={() => setSelectedForContact(null)}
          onSuccess={setNotice}
        />
      )}
      {inspectedUserId && (
        <PlatformUserDetail
          account={{ id: inspectedUserId }}
          onClose={() => setInspectedUserId(null)}
          onOrganization={setInspectedOrgId}
          onAudit={(email) => {
            setInspectedUserId(null);
            setInspectedOrgId(null);
            setAuditSeed({ email, nonce: Date.now() });
            setSection("auditoria");
          }}
        />
      )}
      {selectedForTrial && (
        <ExtendTrialModal
          organization={selectedForTrial}
          onSuccess={setNotice}
          onClose={() => setSelectedForTrial(null)}
        />
      )}

      {selectedForPlan && (
        <ChangeTenantPlanModal
          organization={selectedForPlan}
          onSuccess={setNotice}
          onClose={() => setSelectedForPlan(null)}
        />
      )}
    </div>
  );
}
