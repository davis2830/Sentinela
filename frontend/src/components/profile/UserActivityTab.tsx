import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import {
  Activity,
  Search,
  CheckCircle2,
  XCircle,
  LogIn,
  LogOut,
  Edit2,
  Trash2,
  Plus,
  AlertTriangle,
  Bell,
  Clock,
  Globe,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface AuditLogItem {
  id: string;
  action: string;
  module: string;
  result: 'success' | 'failure';
  ip_address: string | null;
  description: string;
  timestamp: string;
}

interface UserActivityTabProps {
  userId: string;
}

export default function UserActivityTab({ userId }: UserActivityTabProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery<AuditLogItem[]>({
    queryKey: ['user-audit-logs', userId],
    queryFn: async () => {
      if (!userId) return [];
      const response = await api.get('audit-logs/', {
        params: { user_id: userId, limit: 50 },
      });
      return (response.data?.data || []) as AuditLogItem[];
    },
    enabled: !!userId,
  });

  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) return logs;
    const q = searchTerm.toLowerCase();
    return logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.module.toLowerCase().includes(q) ||
        (l.description || '').toLowerCase().includes(q) ||
        (l.ip_address || '').includes(q)
    );
  }, [logs, searchTerm]);

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'login':
        return <LogIn size={13} className="text-accent-green" />;
      case 'logout':
        return <LogOut size={13} className="text-accent-yellow" />;
      case 'create':
        return <Plus size={13} className="text-accent-blue" />;
      case 'update':
        return <Edit2 size={13} className="text-accent-purple" />;
      case 'delete':
        return <Trash2 size={13} className="text-accent-red" />;
      case 'incident_created':
      case 'incident_resolved':
        return <AlertTriangle size={13} className="text-rose-400" />;
      case 'alert_acknowledged':
      case 'alert_resolved':
        return <Bell size={13} className="text-amber-400" />;
      default:
        return <Activity size={13} className="text-text-dim" />;
    }
  };

  return (
    <div className="bg-bg-card border border-border-base rounded-2xl p-6 sm:p-7 shadow-xl space-y-5">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border-base pb-4">
        <div>
          <h2 className="text-base font-bold text-text-main flex items-center gap-2">
            <Activity size={18} className="text-accent-blue" />
            Bitácora de Actividad del Usuario
          </h2>
          <p className="text-xs text-text-dim mt-0.5">
            Registro inmutable de acciones administrativas, autenticaciones y operaciones ejecutadas
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
            <input
              type="text"
              placeholder="Buscar acción, módulo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-bg-dark border border-border-base rounded-full pl-8 pr-3 py-1.5 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
            />
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-full border border-border-base hover:bg-bg-dark text-text-dim hover:text-text-main transition-colors shrink-0"
            title="Actualizar bitácora"
          >
            <RefreshCw size={13} className={isFetching ? 'animate-spin text-accent-green' : ''} />
          </button>
        </div>
      </div>

      {/* Activity Timeline List */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-text-dim">
          <Loader2 size={24} className="animate-spin text-accent-green" />
          <p className="text-xs font-mono">Cargando registros de auditoría...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-12 text-center text-xs text-text-dim font-mono">
          {searchTerm
            ? 'No hay registros que coincidan con la búsqueda.'
            : 'No hay eventos de auditoría registrados para esta cuenta.'}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="p-3.5 bg-bg-dark/80 border border-border-base rounded-xl flex items-center justify-between gap-4 text-xs font-sans transition-colors hover:border-border-accent"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-bg-card border border-border-base flex items-center justify-center shrink-0">
                  {getActionIcon(log.action)}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-text-main font-mono text-[11px] uppercase tracking-wider">
                      {log.action.replace('_', ' ')}
                    </span>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-bg-card border border-border-base text-text-muted">
                      {log.module}
                    </span>
                  </div>

                  <p className="text-[11px] text-text-dim truncate mt-0.5" title={log.description}>
                    {log.description || 'Acción ejecutada en el sistema.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 text-[11px] font-mono text-text-dim">
                {log.ip_address && (
                  <span className="hidden md:inline-flex items-center gap-1">
                    <Globe size={11} />
                    {log.ip_address}
                  </span>
                )}

                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {new Date(log.timestamp).toLocaleString('es-ES', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>

                {log.result === 'success' ? (
                  <span className="inline-flex items-center gap-1 text-accent-green" title="Operación exitosa">
                    <CheckCircle2 size={13} />
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-accent-red" title="Operación fallida">
                    <XCircle size={13} />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
