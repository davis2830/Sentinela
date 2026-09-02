import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { MonitoringCheck } from '../../types/monitoring';
import { Loader2, Activity } from 'lucide-react';

const statusColors: Record<string, string> = {
  up: 'bg-accent-green/10 text-accent-green border-accent-green',
  down: 'bg-accent-red/10 text-accent-red border-accent-red',
  slow: 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow',
  error: 'bg-accent-red/10 text-accent-red border-accent-red',
};

interface ChecksListProps {
  targetId: string;
}

export default function ChecksList({ targetId }: ChecksListProps) {
  const [limit, setLimit] = useState(20);

  const { data: checks, isLoading } = useQuery({
    queryKey: ['monitoring-checks', targetId, limit],
    queryFn: async () => {
      const response = await api.get(`/monitoring-targets/${targetId}/checks/`, {
        params: { limit },
      });
      return response.data?.data || [];
    },
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin text-accent-green" size={24} />
      </div>
    );
  }

  if (!checks || checks.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted text-sm">
        No hay checks registrados para este target.
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border-base rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 font-semibold">
          <Activity size={18} className="text-accent-green" />
          Checks Recientes
        </div>
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="text-text-muted">MOSTRAR:</span>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="bg-bg-dark border border-border-base rounded px-2 py-1 text-text-main focus:outline-none focus:border-accent-green cursor-pointer"
          >
            <option value={20}>20 escaneos</option>
            <option value={50}>50 escaneos</option>
            <option value={100}>100 escaneos</option>
            <option value={250}>250 escaneos</option>
            <option value={500}>500 escaneos</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="text-text-dim font-medium py-2 px-2 border-b border-border-base font-mono text-xs uppercase">Estado</th>
              <th className="text-text-dim font-medium py-2 px-2 border-b border-border-base font-mono text-xs uppercase">Latencia</th>
              <th className="text-text-dim font-medium py-2 px-2 border-b border-border-base font-mono text-xs uppercase">Fecha</th>
              <th className="text-text-dim font-medium py-2 px-2 border-b border-border-base font-mono text-xs uppercase">Detalles</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((check: MonitoringCheck) => (
              <tr key={check.id} className="hover:bg-bg-card-hover transition-colors">
                <td className="py-2 px-2 border-b border-border-base">
                  <span className={`px-2 py-0.5 rounded text-xs font-mono border ${statusColors[check.status] || ''}`}>
                    {check.status.toUpperCase()}
                  </span>
                </td>
                <td className="py-2 px-2 border-b border-border-base text-text-muted font-mono">
                  {check.latency !== null ? `${check.latency.toFixed(0)}ms` : '-'}
                </td>
                <td className="py-2 px-2 border-b border-border-base text-text-muted">
                  {new Date(check.checked_at).toLocaleString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </td>
                <td className="py-2 px-2 border-b border-border-base text-text-dim text-xs font-mono max-w-xs truncate">
                  {Object.keys(check.details).length > 0
                    ? JSON.stringify(check.details).substring(0, 60)
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}