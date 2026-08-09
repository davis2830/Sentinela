import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import StatusBadge from '../components/common/StatusBadge';
import { ShieldAlert, RefreshCw, Loader2, Clock, User, Filter, Server } from 'lucide-react';

interface AuditLogItem {
  id: string;
  user_email: string;
  action: string;
  module: string;
  result: string;
  ip_address: string;
  description: string;
  timestamp: string;
  metadata: Record<string, any>;
}

export default function AuditLogsPage() {
  const [moduleFilter, setModuleFilter] = useState('');

  const { data: auditLogs, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['audit-logs', moduleFilter],
    queryFn: async () => {
      const param = moduleFilter ? `?module=${moduleFilter}` : '';
      const response = await api.get(`audit-logs/${param}`);
      return (response.data?.data || []) as AuditLogItem[];
    },
    refetchInterval: 15000,
  });

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            <ShieldAlert className="text-accent-yellow" size={28} />
            Logs de Auditoría y Registro de Cambios
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Historial inmutable de auditoría para trazabilidad de eventos, cambios en reglas y accesos al sistema
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-2 border border-border-base rounded-md text-text-muted hover:text-text-main hover:bg-bg-card transition-colors disabled:opacity-50"
            title="Refrescar logs"
          >
            <RefreshCw size={18} className={isRefetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-bg-card border border-border-base rounded-xl p-4 mb-6 shadow-xl flex items-center gap-4">
        <Filter size={16} className="text-accent-green" />
        <span className="text-xs font-mono uppercase text-text-muted font-bold">Filtrar por Módulo:</span>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="bg-bg-dark border border-border-base rounded-lg px-3 py-1.5 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
        >
          <option value="">Todos los Módulos</option>
          <option value="monitoring">Monitoreo & Servidores</option>
          <option value="status_page">Status Page</option>
          <option value="alerts">Smart Alerts</option>
          <option value="incidents">Incidentes</option>
          <option value="notifications">Notificaciones</option>
          <option value="accounts">Cuentas & Seguridad</option>
        </select>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-bg-card border border-border-base rounded-xl p-6 shadow-xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-accent-green" size={28} />
          </div>
        ) : auditLogs && auditLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-border-base text-text-dim uppercase">
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4">Usuario / Actor</th>
                  <th className="py-3 px-4">Módulo</th>
                  <th className="py-3 px-4">Acción / Evento</th>
                  <th className="py-3 px-4">Resultado</th>
                  <th className="py-3 px-4">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base/50">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-bg-dark/50 transition-colors">
                    <td className="py-3.5 px-4 text-text-muted flex items-center gap-1.5">
                      <Clock size={13} className="text-text-dim" />
                      {new Date(log.timestamp).toLocaleString('es-ES')}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-text-main">
                      {log.user_email || 'Sistema (Automático)'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="uppercase px-2 py-0.5 bg-bg-dark border border-border-base rounded font-semibold text-text-muted">
                        {log.module}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-text-main font-semibold">
                      {log.description || log.action}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge
                        status={log.result === 'success' ? 'pass' : 'fail'}
                        label={log.result === 'success' ? 'Éxito' : 'Fallo'}
                      />
                    </td>
                    <td className="py-3.5 px-4 text-text-dim">{log.ip_address || '127.0.0.1'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-text-dim text-xs py-8 text-center font-mono">
            No hay registros de auditoría registrados en este período.
          </p>
        )}
      </div>
    </div>
  );
}
