import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import DataConsultationAge from './DataConsultationAge';
import { useAuthStore } from '../../store/authStore';
export default function ReloadDataButton({ queryKeys, scanIntervalSeconds }: {
  queryKeys: string[]; scanIntervalSeconds?: number;
}) {
  const organizationId = useAuthStore(s=>s.user?.organization?.id);
  const client = useQueryClient(); const [updatedAt, setUpdatedAt] = useState(0); const [pending, setPending] = useState(false); const [failed, setFailed] = useState(false);
  const key = queryKeys.join('|');
  useEffect(() => { const update = () => { const queries = client.getQueryCache().getAll().filter(q => queryKeys.includes(String(q.queryKey[0])) && q.queryKey[1] === organizationId && q.isActive()); setUpdatedAt(Math.max(0, ...queries.map(q => q.state.dataUpdatedAt))); setFailed(queries.some(q=>q.state.status==='error')); };
    update(); return client.getQueryCache().subscribe(update);
  }, [client, key, organizationId]);
  return <div className="flex items-center gap-2 text-xs text-text-muted">
    <DataConsultationAge updatedAt={updatedAt} />
    {failed && <span role="status" className="text-accent-yellow">Datos parciales. Recarga para reintentar.</span>}
    <button type="button" aria-label="Actualizar datos" disabled={pending} onClick={async () => {
      setPending(true);
      try {
        await Promise.all([...queryKeys, 'scan-detail'].map(key => client.refetchQueries({ queryKey: [key, organizationId], type: 'active' }, { throwOnError: true })));
        // A manual GET never changes the area's automatic deadline.
        const plan = client.getQueryData<{ limits?: { min_check_interval_seconds?: number } }>(['org-subscription', organizationId]);
        const interval = plan ? plan.limits?.min_check_interval_seconds : scanIntervalSeconds;
        const cadence = scanIntervalSeconds && interval && Number.isFinite(interval) && interval > 0
          ? ` Tu plan permite sondeos como mínimo cada ${interval >= 60 && interval % 60 === 0 ? `${interval / 60} ${interval === 60 ? 'minuto' : 'minutos'}` : `${interval} segundos`}; cada recurso conserva su intervalo y tiempo de espera.` : '';
        window.dispatchEvent(new CustomEvent('sentinel:scan-feedback', { detail: `Datos guardados consultados. No se ejecutó una nueva comprobación.${cadence}` }));
      } catch {
        window.dispatchEvent(new CustomEvent('sentinel:scan-feedback', { detail: 'No pudimos consultar todos los datos. Reintenta la recarga; no se ejecutó ninguna comprobación.' }));
      } finally { setPending(false); }
    }} title="Consultar resultados guardados, sin ejecutar un nuevo sondeo" className="p-2 rounded-lg border border-border-base hover:text-text-main"><RefreshCw size={15} className={pending ? 'animate-spin' : ''} /></button>
  </div>;
}
