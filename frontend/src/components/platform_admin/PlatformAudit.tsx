import { useQuery } from '@tanstack/react-query';
import { platformApi } from '../../services/platformApi';

type Event = {
  id: string;
  timestamp: string;
  user_email: string;
  description: string;
  module: string;
  action: string;
  organization_id: string | null;
};

export default function PlatformAudit({ operatorId, onOpenOrganization }: {
  operatorId: string; onOpenOrganization: (id: string) => void;
}) {
  const query = useQuery<Event[]>({
    queryKey: ['platform-admin-audit', operatorId],
    queryFn: async ({ signal }) => (await platformApi.get('platform-admin/audit-logs/', { params: { limit: 100 }, signal })).data.data,
  });
  return <section className="space-y-4" aria-labelledby="platform-audit-title">
    <h2 id="platform-audit-title" className="text-xl font-semibold">Auditoría de plataforma</h2>
    <p className="text-sm text-text-muted">Últimos 100 eventos de todas las organizaciones y de la plataforma.</p>
    {query.isPending && <p role="status">Cargando auditoría…</p>}
    {query.isError && <p role="alert">No se pudo cargar la auditoría. <button onClick={() => void query.refetch()}>Reintentar</button></p>}
    {query.data?.length === 0 && <p>No hay eventos registrados.</p>}
    <ul className="divide-y divide-border-base rounded-2xl border border-border-base bg-bg-card">
      {query.data?.map(event => <li key={event.id} className="space-y-1 break-words p-4">
        <p className="text-sm">{event.description || event.action}</p>
        <p className="text-xs text-text-muted">{event.user_email || 'Sistema'} · {event.module} · {new Date(event.timestamp).toLocaleString('es-GT')}</p>
        {event.organization_id && <button className="text-sm text-accent-green" onClick={() => onOpenOrganization(event.organization_id!)}>Ver organización</button>}
      </li>)}
    </ul>
  </section>;
}
