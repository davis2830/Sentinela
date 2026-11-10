import { useEffect, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import DataConsultationAge from './DataConsultationAge';
import { useAuthStore } from '../../store/authStore';
export default function ReloadDataButton({ queryKeys, scanIntervalSeconds, compact = false }: {
  queryKeys: string[]; scanIntervalSeconds?: number; compact?: boolean;
}) {
  const organizationId = useAuthStore(s=>s.user?.organization?.id);
  const client = useQueryClient(); const [updatedAt, setUpdatedAt] = useState(0); const [pending, setPending] = useState(false); const [failed, setFailed] = useState(false);
  const key = JSON.stringify(queryKeys);
  const watchedKeys = useMemo(() => JSON.parse(key) as string[], [key]);
  useEffect(() => { const update = () => { const queries = client.getQueryCache().getAll().filter(q => watchedKeys.includes(String(q.queryKey[0])) && q.isActive()); setUpdatedAt(Math.max(0, ...queries.map(q => q.state.dataUpdatedAt))); setFailed(queries.some(q=>q.state.status==='error')); };
    update(); return client.getQueryCache().subscribe(update);
  }, [client, watchedKeys]);
  return <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-xs text-text-muted">
    {!compact && <DataConsultationAge updatedAt={updatedAt} />}
    {failed && <span role="status" className="text-accent-yellow">Datos parciales. Recarga para reintentar.</span>}
    <button type="button" aria-label="Actualizar datos" disabled={pending} onClick={async () => {
      setPending(true);
      try {
        await Promise.all([...queryKeys, 'scan-detail'].map(key => client.refetchQueries({ queryKey: [key], type: 'active' }, { throwOnError: true })));
        // A manual GET never changes the area's automatic deadline.
        const plan = client.getQueryData<{ limits?: { min_check_interval_seconds?: number } }>(['org-subscription', organizationId]);
        const interval = plan ? plan.limits?.min_check_interval_seconds : scanIntervalSeconds;
        const cadence = scanIntervalSeconds && interval && Number.isFinite(interval) && interval > 0
          ? ` Tu plan permite sondeos como mínimo cada ${interval >= 60 && interval % 60 === 0 ? `${interval / 60} ${interval === 60 ? 'minuto' : 'minutos'}` : `${interval} segundos`}; cada recurso conserva su intervalo y tiempo de espera.` : '';
        window.dispatchEvent(new CustomEvent('sentinel:scan-feedback', { detail: `Datos guardados consultados. No se ejecutó una nueva comprobación.${cadence}` }));
      } catch {
        window.dispatchEvent(new CustomEvent('sentinel:scan-feedback', { detail: 'No pudimos consultar todos los datos. Reintenta la recarga; no se ejecutó ninguna comprobación.' }));
      } finally { setPending(false); }
    }} title={`Consultar resultados guardados, sin ejecutar un nuevo sondeo${compact && updatedAt ? `. Última consulta: ${new Date(updatedAt).toLocaleTimeString()}` : ''}`} className={compact ? 'ui-button ui-button-secondary ui-button-icon' : 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-base hover:border-border-accent hover:text-text-main disabled:opacity-50'}><RefreshCw size={compact ? 18 : 15} className={pending ? 'animate-spin' : ''} /></button>
  </div>;
}
