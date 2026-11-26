import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import type { MonitoringTarget } from "../types/monitoring";

export interface NotificationDestinationSummary {
  id: string;
  name: string;
  channel_type: string;
  enabled: boolean;
}

export interface QuickCreateDestinationInput {
  name: string;
  channel_type: "email" | "webhook";
  targetValue: string;
}

/**
 * Shared organization context used inside Add/Edit modals (SSL, DNS, Domains):
 * - Notification channels (active & paused) + inline enable/quick-create without leaving the modal
 * - Existing targets, SSL certificates, DNS records, and watched domains for
 *   auto-link, live dependencies, and "Ya vigilado" detection in "Vigilar también".
 */
export function useOrgContextForAddModal(enabled: boolean) {
  const organizationId = useAuthStore((state) => state.user?.organization?.id);
  const queryClient = useQueryClient();

  const channelsQuery = useQuery<NotificationDestinationSummary[]>({
    queryKey: ["modal-notification-channels", organizationId],
    queryFn: async () => {
      try {
        const res = await api.get("notifications/channels/");
        const raw = res.data?.data ?? res.data?.results ?? res.data ?? [];
        const list = Array.isArray(raw) ? raw : [];
        return list.map(
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

  const sslQuery = useQuery<{ domain: string; port: number }[]>({
    queryKey: ["modal-ssl-domains", organizationId],
    queryFn: async () => {
      try {
        const res = await api.get("ssl-certificates/?page_size=200");
        const raw =
          res.data?.data?.results ?? res.data?.data ?? res.data?.results ?? [];
        return Array.isArray(raw)
          ? raw.map((c: { domain?: string; port?: number }) => ({
              domain: String(c.domain || "").toLowerCase(),
              port: Number(c.port || 443),
            }))
          : [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(enabled && organizationId),
    staleTime: 60_000,
  });

  const dnsQuery = useQuery<{ domain: string; record_type: string }[]>({
    queryKey: ["modal-dns-domains", organizationId],
    queryFn: async () => {
      try {
        const res = await api.get("dns-records/?page_size=200");
        const raw =
          res.data?.data?.results ?? res.data?.data ?? res.data?.results ?? [];
        return Array.isArray(raw)
          ? raw.map((r: { domain?: string; record_type?: string }) => ({
              domain: String(r.domain || "").toLowerCase(),
              record_type: String(r.record_type || "A").toUpperCase(),
            }))
          : [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(enabled && organizationId),
    staleTime: 60_000,
  });

  const domainsQuery = useQuery<string[]>({
    queryKey: ["modal-watched-domains", organizationId],
    queryFn: async () => {
      try {
        const res = await api.get("domains/?page_size=200");
        const raw =
          res.data?.data?.results ?? res.data?.data ?? res.data?.results ?? [];
        return Array.isArray(raw)
          ? raw.map((d: { domain?: string }) =>
              String(d.domain || "").toLowerCase(),
            )
          : [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(enabled && organizationId),
    staleTime: 60_000,
  });

  const invalidateChannels = () => {
    void queryClient.invalidateQueries({
      queryKey: ["modal-notification-channels", organizationId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["notification-channels", organizationId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["domains", organizationId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["ssl-certificates", organizationId],
    });
  };

  const quickCreateDestinationMutation = useMutation({
    mutationFn: async (input: QuickCreateDestinationInput) => {
      const config =
        input.channel_type === "email"
          ? { recipients: [input.targetValue.trim()] }
          : { url: input.targetValue.trim() };
      const res = await api.post("notifications/channels/", {
        name: input.name.trim(),
        channel_type: input.channel_type,
        config,
        enabled: true,
      });
      return res.data?.data;
    },
    onSuccess: invalidateChannels,
  });

  const toggleChannelEnabledMutation = useMutation({
    mutationFn: async ({ id, enabled: nextEnabled }: { id: string; enabled: boolean }) => {
      const res = await api.patch(`notifications/channels/${id}/`, {
        enabled: nextEnabled,
      });
      return res.data?.data;
    },
    onSuccess: invalidateChannels,
  });

  const allChannels = channelsQuery.data || [];
  const activeDestinations = allChannels.filter((c) => c.enabled);

  return {
    allChannels,
    destinations: activeDestinations,
    isLoadingDestinations: channelsQuery.isLoading,
    targets: targetsQuery.data || [],
    sslItems: sslQuery.data || [],
    dnsItems: dnsQuery.data || [],
    watchedDomains: domainsQuery.data || [],
    quickCreateDestination: quickCreateDestinationMutation.mutateAsync,
    isCreatingDestination: quickCreateDestinationMutation.isPending,
    toggleChannelEnabled: toggleChannelEnabledMutation.mutateAsync,
    isTogglingChannel: toggleChannelEnabledMutation.isPending,
  };
}
