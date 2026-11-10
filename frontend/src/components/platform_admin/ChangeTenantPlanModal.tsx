import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { platformApi } from "../../services/platformApi";
import type { PlatformOrganization } from "../../types/platform_admin";
import type { PlanPreview } from "../../types/platform_beta";
import PlatformActionModal from "./PlatformActionModal";
import { subscriptionStates } from "./OrganizationDistribution";

export default function ChangeTenantPlanModal({
  organization,
  onClose,
  onSuccess,
}: {
  organization: PlatformOrganization | null;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}) {
  const [plan, setPlan] = useState(organization?.plan_tier || "pro");
  const [status, setStatus] = useState(
    organization?.subscription_status || "active",
  );
  const client = useQueryClient();
  const catalog = useQuery<{
    plans: {
      id: PlatformOrganization["plan_tier"];
      name: string;
      price: number | null;
    }[];
  }>({
    queryKey: ["platform-catalog", organization?.id],
    queryFn: async () =>
      (
        await platformApi.get("platform-admin/catalog/", {
          params: { organization_id: organization?.id },
        })
      ).data.data,
  });
  const preview = useQuery<PlanPreview>({
    queryKey: ["platform-plan-preview", organization?.id, plan, status],
    enabled: !!organization,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) =>
      (
        await platformApi.post(
          "platform-admin/organizations/" + organization?.id + "/plan-preview/",
          { plan_tier: plan, subscription_status: status },
          { signal },
        )
      ).data.data,
  });
  if (!organization) return null;
  const label = (id: string) =>
    subscriptionStates.find((item) => item.id === id)?.label || "Desconocida";
  return (
    <PlatformActionModal
      title="Cambiar plan"
      description={
        organization.name +
        ": " +
        organization.plan_tier.toUpperCase() +
        " / " +
        label(organization.subscription_status) +
        " → " +
        plan.toUpperCase() +
        " / " +
        label(status) +
        ". Asignar un plan no confirma un cobro."
      }
      onClose={onClose}
      onSuccess={onSuccess}
      confirmDisabled={
        !catalog.data ||
        catalog.isError ||
        !preview.data ||
        preview.isFetching ||
        preview.isError
      }
      onConfirm={async (reason) => {
        await platformApi.post(
          "platform-admin/organizations/" + organization.id + "/set-plan/",
          { plan_tier: plan, subscription_status: status, reason },
        );
        await Promise.all(
          [
            "platform-admin-orgs",
            "platform-admin-stats",
            "platform-admin-org-detail",
            "beta-overview",
          ].map((key) => client.invalidateQueries({ queryKey: [key] })),
        );
      }}
    >
      <label className="block text-sm">
        Plan
        <select
          className="platform-field"
          value={plan}
          onChange={(e) =>
            setPlan(e.target.value as PlatformOrganization["plan_tier"])
          }
          disabled={!catalog.data}
        >
          {catalog.data?.plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ·{" "}
              {p.price === null ? "Bajo cotización" : "$" + p.price + "/mes"}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Suscripción
        <select
          className="platform-field"
          value={status}
          onChange={(e) =>
            setStatus(
              e.target.value as PlatformOrganization["subscription_status"],
            )
          }
        >
          {subscriptionStates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {catalog.isError && (
        <p role="alert">
          No se pudo consultar el catálogo.{" "}
          <button type="button" onClick={() => void catalog.refetch()}>
            Reintentar catálogo
          </button>
        </p>
      )}
      {preview.isPending && <p role="status">Calculando impacto…</p>}
      {preview.isError && (
        <p role="alert">
          No se pudo calcular el impacto.{" "}
          <button type="button" onClick={() => void preview.refetch()}>
            Reintentar vista previa
          </button>
        </p>
      )}
      {preview.data && (
        <section
          className="space-y-2 border-t border-border-base pt-3"
          aria-label="Impacto del cambio de plan"
        >
          <h3 className="font-medium">Consumo y límites efectivos</h3>
          <ul className="space-y-1 text-xs">
            {preview.data.consumption.map((row) => (
              <li
                key={row.key}
                className={row.exceeds ? "text-accent-yellow" : ""}
              >
                {row.label}: {row.used} en uso · límite {row.current_limit} →{" "}
                {row.proposed_limit}
                {row.exceeds ? " · supera el nuevo límite" : ""}
              </li>
            ))}
          </ul>
          <p className="text-xs text-text-muted">
            Intervalo mínimo:{" "}
            {String(preview.data.current_limits.min_check_interval_seconds)} →{" "}
            {String(preview.data.proposed_limits.min_check_interval_seconds)} s.
            Retención:{" "}
            {String(preview.data.current_limits.metrics_retention_days)} →{" "}
            {String(preview.data.proposed_limits.metrics_retention_days)} días.
          </p>
          {preview.data.warnings.map((warning) => (
            <p className="text-xs text-accent-yellow" key={warning}>
              {warning}
            </p>
          ))}
          <p className="text-xs text-text-muted">
            Se conservan los recursos; la ejecución y las nuevas altas siguen
            las reglas del plan. El estado de acceso no cambia.
          </p>
        </section>
      )}
    </PlatformActionModal>
  );
}
