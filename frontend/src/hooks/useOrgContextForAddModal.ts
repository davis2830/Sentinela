import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import type { MonitoringTarget } from "../types/monitoring";

export interface NotificationDestinationSummary {
  id: string;
  name: string;
  channel_type: string;
  enabled: boolean;
}

/**
 * Shared read-only organization context used inside Add/Edit modals
 * (SSL, DNS, Domains) to surface:
 * - Active notification destinations (or "Nadie será notificado" warning)
 * - Existing Uptime monitoring targets (for auto-link suggestion & dependency count)
 */
export function useOrgContextForAddModal(enabled: boolean) {
  const organizationId = useAuthStore((state) => state.user?.organization?.id);

  const channelsQuery = useQuery<NotificationDestinationSummary[]>({
    queryKey: ["modal-notification-channels", organizationId],
    queryFn: async () => {
      try {
        const res = await api.get("notifications/channels/");
        const raw = res.data?.data ?? res.data?.results ?? res.data ?? [];
        const list = Array.isArray(raw) ? raw : [];
        return list
          .filter((ch: { enabled?: boolean }) => ch.enabled !== false)
          .map(
            (ch: {
              id: string;
              name: string;
              channel_type?: string;
              enabled?: boolean;
            }) => ({
              id: String(ch.id),
              name: ch.name || ch.channel_type || "Canal",
              channel_type: ch.channel_type || "channel",
              enabled: ch.enabled !== false,
            }),
          );
      } catch {
        return [];
      }
    },
    enabled: Boolean(enabled && organizationId),
    staleTime: 60_000,
  });

  const targetsQuery = useQuery<MonitoringTarget[]>({
    queryKey: ["modal-monitoring-targets", organizationId],
    queryFn: async () => {
      try {
        const res = await api.get("monitoring/?page_size=200");
        const raw =
          res.data?.data?.results ??
          res.data?.data ??
          res.data?.results ??
          [];
        return Array.isArray(raw) ? (raw as MonitoringTarget[]) : [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(enabled && organizationId),
    staleTime: 60_000,
  });

  return {
    destinations: channelsQuery.data || [],
    isLoadingDestinations: channelsQuery.isLoading,
    targets: targetsQuery.data || [],
  };
}
