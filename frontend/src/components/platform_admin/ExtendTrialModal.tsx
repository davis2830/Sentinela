import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { platformApi } from "../../services/platformApi";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import type { PlatformOrganization } from "../../types/platform_admin";
import PlatformActionModal from "./PlatformActionModal";
import { subscriptionStates } from "./OrganizationDistribution";

type Preview = {
  current_subscription: string;
  proposed_subscription: string;
  current_end: string | null;
  proposed_end: string;
  days: number;
  queried_at: string;
};
export default function ExtendTrialModal({
  organization,
  onClose,
  onSuccess,
}: {
  organization: PlatformOrganization | null;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}) {
  const [days, setDays] = useState(14);
  const settled = useDebouncedValue(days);
  const client = useQueryClient();
  const valid = Number.isInteger(settled) && settled >= 1 && settled <= 365;
  const preview = useQuery<Preview>({
    queryKey: ["platform-trial-preview", organization?.id, settled],
    enabled: !!organization && valid && settled === days,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) =>
      (
        await platformApi.post(
          "platform-admin/organizations/" +
            organization?.id +
            "/trial-preview/",
          { days: settled },
          { signal },
        )
      ).data.data,
  });
  if (!organization) return null;
  const state =
    subscriptionStates.find(
      (item) => item.id === organization.subscription_status,
    )?.label || "Desconocida";
  return (
    <PlatformActionModal
      title="Extender prueba"
      description={
        organization.name +
        ". La suscripción pasará de " +
        state +
        " a En prueba; se conserva el estado de acceso."
      }
      onClose={onClose}
      onSuccess={onSuccess}
      confirmDisabled={
        !valid ||
        settled !== days ||
        !preview.data ||
        preview.isFetching ||
        preview.isError
      }
      onConfirm={async (reason) => {
        await platformApi.post(
          "platform-admin/organizations/" + organization.id + "/extend-trial/",
          { days, reason },
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
        Días de extensión
        <input
          className="platform-field"
          required
          type="number"
          min={1}
          max={365}
          value={Number.isFinite(days) ? days : ""}
          onChange={(e) => setDays(Number(e.target.value))}
        />
      </label>
      {preview.isPending && (
        <p role="status">Consultando fechas de la prueba…</p>
      )}
      {preview.isError && (
        <p role="alert">
          No se pudo calcular la nueva fecha.{" "}
          <button type="button" onClick={() => void preview.refetch()}>
            Reintentar vista previa
          </button>
        </p>
      )}
      {preview.data && (
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-text-muted">Fin actual</dt>
            <dd>
              {preview.data.current_end
                ? new Date(preview.data.current_end).toLocaleString("es-GT")
                : "Sin prueba"}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">
              Nuevo fin estimado por el servidor
            </dt>
            <dd>
              {new Date(preview.data.proposed_end).toLocaleString("es-GT")}
            </dd>
          </div>
        </dl>
      )}
    </PlatformActionModal>
  );
}
