import { useQuery } from '@tanstack/react-query';
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
  const ready = !query.isError && typeof value === 'number' && Number.isFinite(value) && value > 0;
  const intervalSeconds = ready ? Math.ceil(value!) : 300;
  const refresh = useAutoRefresh({ intervalSeconds, available: ready && query.data?.monitoring_allowed !== false });
  return { ...refresh, subscription: query.data, ready };
}
