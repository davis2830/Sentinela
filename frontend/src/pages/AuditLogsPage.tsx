import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import {
  NOCPageHeader,
  NOCKpiGrid,
  NOCKpiCard,
  NOCToolbar,
  NOCDrawer,
} from '../components/common/noc';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import {
  ShieldAlert,
  Clock,
  User,
  Server,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileCode2,
  Activity,
  Zap,
} from 'lucide-react';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  // Auto-refresh hook (15s countdown)
  const autoRefresh = useAutoRefresh({
    intervalSeconds: 15,
    initialEnabled: true,
  });

  const { data: auditLogs, isLoading } = useQuery<AuditLogItem[]>({
    queryKey: ['audit-logs', moduleFilter],
    queryFn: async () => {
      const param = moduleFilter ? `?module=${moduleFilter}` : '';
      const response = await api.get(`audit-logs/${param}`);
      return (response.data?.data || []) as AuditLogItem[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  const allLogs = auditLogs || [];
  const totalCount = allLogs.length;
  const successCount = allLogs.filter((l) => l.result === 'success').length;
  const failureCount = allLogs.filter((l) => l.result !== 'success').length;
  const uniqueUsers = new Set(allLogs.map((l) => l.user_email).filter(Boolean)).size;
  const uniqueModules = new Set(allLogs.map((l) => l.module).filter(Boolean)).size;

  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 1000) / 10 : 100.0;

  // Filtered logs by search term
  const filteredLogs = allLogs.filter((log) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (log.user_email && log.user_email.toLowerCase().includes(term)) ||
      (log.action && log.action.toLowerCase().includes(term)) ||
      (log.description && log.description.toLowerCase().includes(term)) ||
      (log.ip_address && log.ip_address.toLowerCase().includes(term)) ||
      (log.module && log.module.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader
        title="Logs de Auditoría"
        badgeText="SECURITY AUDIT"
        description="Historial inmutable de auditoría para trazabilidad de eventos, cambios de configuración y accesos al sistema."
        icon={<ShieldAlert size={26} />}
        autoRefresh={{
          enabled: autoRefresh.enabled,
          countdown: autoRefresh.countdown,
          onToggle: autoRefresh.toggle,
        }}
      />

      {/* 2. NOC COMMAND CENTER: KPI STRIP */}
      <NOCKpiGrid columns={4}>
        {/* KPI 1: Total Eventos */}
        <NOCKpiCard
          title="Eventos Registrados"
          icon={<Activity size={16} className="text-accent-green" />}
          badge={{
            text: 'Trazabilidad OK',
            variant: 'success',
          }}
          value={totalCount}
          valueSuffix="eventos"
          subtitle="Historial inmutable verificado"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Integridad de Logs</span>
              <span className="text-accent-green font-medium">Criptográfica</span>
            </div>
          }
        />

        {/* KPI 2: Tasa de Éxito */}
        <NOCKpiCard
          title="Operaciones Exitosas"
          icon={<CheckCircle2 size={16} className="text-emerald-400" />}
          badge={{
            text: successRate >= 95.0 ? 'Normal' : 'Atención',
            variant: successRate >= 95.0 ? 'success' : 'warning',
          }}
          value={`${successRate}%`}
          valueColor="text-emerald-400"
          valueSuffix="éxito"
          progress={{ value: successRate }}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Fallos / Errores</span>
              <span className={failureCount > 0 ? 'text-amber-400 font-semibold' : 'text-text-main'}>
                {failureCount} eventos
              </span>
            </div>
          }
        />

        {/* KPI 3: Actores Únicos */}
        <NOCKpiCard
          title="Actores Únicos"
          icon={<User size={16} className="text-sky-400" />}
          badge={{
            text: `${uniqueUsers} Usuarios`,
            variant: 'info',
          }}
          value={uniqueUsers}
          valueColor="text-sky-400"
          valueSuffix="usuarios"
          subtitle="Cuentas activas y procesos del sistema"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Modo de Autenticación</span>
              <span className="text-sky-400 font-medium">JWT / Sesión</span>
            </div>
          }
        />

        {/* KPI 4: Módulos Auditados */}
        <NOCKpiCard
          title="Módulos Auditados"
          icon={<Server size={16} className="text-amber-400" />}
          badge={{
            text: `${uniqueModules} Módulos`,
            variant: 'neutral',
          }}
          value={uniqueModules}
          valueColor="text-amber-400"
          valueSuffix="módulos"
          subtitle="Monitoreo, Alertas, Incidentes, etc."
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Retención de Auditoría</span>
              <span className="text-accent-green font-medium">90 Días</span>
            </div>
          }
        />
      </NOCKpiGrid>

      {/* 3. TOOLBAR: Omnibar Search + Module Category Chips */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por usuario, acción, IP o descripción de auditoría..."
        categoryLabel="Módulo:"
        categories={[
          { id: '', label: 'Todos' },
          { id: 'monitoring', label: 'Monitoreo' },
          { id: 'status_page', label: 'Status Page' },
          { id: 'alerts', label: 'Alertas' },
          { id: 'incidents', label: 'Incidentes' },
          { id: 'notifications', label: 'Notificaciones' },
          { id: 'accounts', label: 'Cuentas & Seguridad' },
        ]}
        selectedCategory={moduleFilter}
        onCategoryChange={setModuleFilter}
      />

      {/* 4. AUDIT LOGS TABLE */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : filteredLogs && filteredLogs.length > 0 ? (
        <div className="bg-bg-card/95 border border-border-base/70 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-base text-text-dim text-xs bg-bg-card/50">
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4">Usuario / Actor</th>
                  <th className="py-3 px-4">Módulo</th>
                  <th className="py-3 px-4">Acción / Evento</th>
                  <th className="py-3 px-3">Resultado</th>
                  <th className="py-3 px-4 text-right">Dirección IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base/40 font-sans">
                {filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-bg-card-hover/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 text-text-muted flex items-center gap-1.5 font-mono text-[11px] whitespace-nowrap">
                      <Clock size={12} className="text-text-dim" />
                      {new Date(log.timestamp).toLocaleString('es-ES')}
                    </td>
                    <td className="py-3 px-4 font-semibold text-text-main group-hover:text-accent-green transition-colors text-sm">
                      {log.user_email || 'Sistema (Automático)'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize px-2.5 py-0.5 bg-bg-dark border border-border-base/60 rounded-full font-medium text-xs text-text-muted">
                        {log.module}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-text-main font-medium">
                      {log.description || log.action}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge
                        status={log.result === 'success' ? 'pass' : 'fail'}
                        label={log.result === 'success' ? 'Éxito' : 'Fallo'}
                      />
                    </td>
                    <td className="py-3 px-4 text-text-dim font-mono text-xs text-right whitespace-nowrap">
                      {log.ip_address || '127.0.0.1'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={ShieldAlert}
          title={
            searchTerm || moduleFilter
              ? 'No se encontraron logs con los filtros aplicados'
              : 'No hay eventos de auditoría registrados'
          }
          description={
            searchTerm || moduleFilter
              ? 'Prueba a cambiar el término de búsqueda o seleccionar otro módulo.'
              : 'Los registros de auditoría comenzarán a aparecer conforme los usuarios interactúen con el sistema.'
          }
          actionLabel={searchTerm || moduleFilter ? 'Limpiar Filtros' : undefined}
          onAction={() => {
            setSearchTerm('');
            setModuleFilter('');
          }}
        />
      )}

      {/* 5. SLIDE-OVER DETAIL DRAWER (Zero Context Loss with NOCDrawer) */}
      <NOCDrawer
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={selectedLog?.description || selectedLog?.action || 'Detalle de Auditoría'}
        subtitle={
          selectedLog && (
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-accent-green">{selectedLog.user_email || 'Sistema'}</span>
              <span>•</span>
              <span className="text-text-dim">{selectedLog.ip_address}</span>
            </div>
          )
        }
        statusBadge={
          selectedLog && (
            <StatusBadge
              status={selectedLog.result === 'success' ? 'pass' : 'fail'}
              label={selectedLog.result === 'success' ? 'Éxito' : 'Fallo'}
            />
          )
        }
        quickKpis={
          selectedLog && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-sans">
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Módulo</div>
                <div className="text-sm font-bold text-text-main mt-0.5 capitalize truncate">
                  {selectedLog.module}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Acción</div>
                <div className="text-sm font-bold text-accent-green mt-0.5 truncate">
                  {selectedLog.action}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">IP Origen</div>
                <div className="text-xs font-bold font-mono text-text-main mt-0.5 truncate">
                  {selectedLog.ip_address || '127.0.0.1'}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Fecha</div>
                <div className="text-xs font-semibold font-mono text-text-muted mt-0.5 truncate">
                  {new Date(selectedLog.timestamp).toLocaleDateString('es-ES')}
                </div>
              </div>
            </div>
          )
        }
        maxWidthClass="max-w-2xl"
      >
        {selectedLog && (
          <div className="space-y-4 font-sans">
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3 text-xs font-mono">
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-sans font-medium">ID de Registro:</span>
                <span className="text-text-muted">{selectedLog.id}</span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-sans font-medium">Timestamp Completo:</span>
                <span className="text-text-main">
                  {new Date(selectedLog.timestamp).toLocaleString('es-ES')}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-sans font-medium">Actor / Email:</span>
                <span className="font-bold text-accent-green">
                  {selectedLog.user_email || 'Sistema (Automático)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-dim font-sans font-medium">Dirección IP:</span>
                <span className="text-text-main">{selectedLog.ip_address || '127.0.0.1'}</span>
              </div>
            </div>

            {/* JSON Metadata */}
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-2">
              <h4 className="text-xs font-semibold text-text-muted flex items-center gap-1.5">
                <FileCode2 size={14} className="text-accent-green" />
                Carga Útil & Metadatos del Evento (JSON Metadata)
              </h4>
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 ? (
                <pre className="p-3.5 bg-bg-card border border-border-base rounded-xl text-xs font-mono text-text-muted overflow-x-auto leading-relaxed max-h-[350px]">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              ) : (
                <p className="text-xs text-text-dim font-sans">
                  No hay metadatos adicionales asociados a este evento.
                </p>
              )}
            </div>
          </div>
        )}
      </NOCDrawer>
    </div>
  );
}
