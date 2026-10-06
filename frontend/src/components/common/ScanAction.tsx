import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import type { ScannableResource, ScanAvailability } from '../../types/scan';

const messages = {
  pending: 'Comprobación pendiente', subscription_required: 'Suscripción no vigente',
  disabled: 'Monitoreo pausado', agent_managed: 'Gestionado por Sentinine', read_only: 'Solo lectura',
};
const statuses = ['ready','cooldown','pending','subscription_required','disabled','agent_managed','read_only'];
export default function ScanAction({ resource, route, onScan, pending = false }: {
  resource: ScannableResource & { id: string }; route: string; onScan: () => void | Promise<unknown>; pending?: boolean;
}) {
  const user = useAuthStore(s => s.user);
  const canManage = Boolean(user?.is_staff || user?.is_superuser);
  const [now, setNow] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const query = useQuery<ScanAvailability>({
    queryKey:['scan-detail',user?.organization?.id,route,resource.id],
    queryFn:async()=> {
      const response = await api.get(`${route}/${resource.id}/`);
      const snapshot = response.data?.data?.scan_availability;
      if (!snapshot || !statuses.includes(snapshot.status) || snapshot.status==='cooldown' && (!Number.isFinite(Date.parse(snapshot.next_allowed_at)) || !Number.isFinite(snapshot.retry_after_seconds))) throw new Error('Disponibilidad no disponible');
      return snapshot;
    },
    enabled:canManage, staleTime:0, refetchInterval:30000,
  });
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  if (!canManage) return null;
  const snapshot = query.isError ? undefined : query.data;
  const seconds = snapshot?.next_allowed_at ? Math.max(0, Math.ceil((Date.parse(snapshot.next_allowed_at) - now) / 1000)) : null;
  const busy = pending || submitting;
  const available = snapshot?.status === 'ready' && !busy && !query.isFetching;
  const text = busy ? messages.pending : !snapshot ? query.isLoading ? 'Consultando disponibilidad…' : 'Disponibilidad no disponible. Recarga los datos.' : snapshot.status === 'cooldown' ? seconds ? `Disponible en ${Math.floor(seconds / 60)} min ${seconds % 60} s` : 'Recarga para verificar disponibilidad' : snapshot.status === 'ready' ? 'Comprobar ahora' : messages[snapshot.status];
  return <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="scan-action">
    <button type="button" disabled={!available} onClick={async () => {
      setSubmitting(true);
      try { await onScan(); } catch { /* API feedback reports admission failures. */ } finally { await query.refetch(); setSubmitting(false); }
    }} className="inline-flex items-center gap-2 rounded-lg border border-accent-green/40 px-3 py-2 text-accent-green disabled:opacity-50"><RefreshCw size={14} className={busy ? 'animate-spin' : ''} />Comprobar ahora</button>
    {!available && <span className="text-text-muted" role="status">{text}</span>}
    {(!snapshot || snapshot.status === 'cooldown' && seconds === 0) && <button type="button" onClick={()=>query.refetch()} disabled={query.isFetching} aria-label="Recargar disponibilidad" className="p-2 text-text-muted"><RefreshCw size={14} /></button>}
  </div>;
}
