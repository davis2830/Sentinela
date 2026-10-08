import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import type { SubscriptionSummary } from '../types/organization';
import { useAutoRefresh } from './useAutoRefresh';

/** UI reads follow the server plan floor; this never admits or triggers scans. */
export function useConnectivityRefresh() {
  const organizationId = useAuthStore(s => s.user?.organization?.id);
  const query = useQuery<SubscriptionSummary>({
    queryKey: ['org-subscription', organizationId],
    queryFn: async () => (await api.get('organizations/current/subscription/')).data?.data,
    enabled: Boolean(organizationId),
  });
  const value = query.data?.limits?.min_check_interval_seconds;
  const validCadence = typeof value === 'number' && Number.isFinite(value) && value > 0;
  const ready = !query.isError && typeof query.data?.monitoring_allowed === 'boolean' && validCadence;
  // A transient GET error suspends reads, but never changes the last known cadence.
  const intervalSeconds = validCadence ? Math.ceil(value!) : 300;
  const refresh = useAutoRefresh({ intervalSeconds, scopeKey: 'connectivity', available: ready && query.data?.monitoring_allowed === true });
  // Revalidate plan/operational permission on the same clock, not a separate timer.
  useEffect(() => {
    refresh.refetchInterval({ queryKey: ['org-subscription', organizationId] });
  }, [organizationId, refresh.refetchInterval]);
  return { ...refresh, subscription: query.data, subscriptionQuery: query, ready,
    blockedReason: ready && query.data?.monitoring_allowed === false ? 'Suscripción no vigente' : undefined };
}
