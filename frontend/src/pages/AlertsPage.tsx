import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  AlertRule,
  Alert,
  CreateAlertRuleData,
  AlertSeverity,
  AlertStatus,
  AlertStats,
} from '../types/alerts';
import SeverityBadge from '../components/common/SeverityBadge';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
import AlertRuleForm from '../components/alerts/AlertRuleForm';
import {
  NOCPageHeader,
  NOCKpiGrid,
  NOCKpiCard,
  NOCToolbar,
} from '../components/common/noc';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import {
  Bell,
  Plus,
  Loader2,
  Trash2,
  RefreshCw,
  Clock,
  Pencil,
  CheckCircle,
  Eye,
  Sliders,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  CheckCheck,
  CheckSquare,
  Flame,
  Info,
  X,
} from 'lucide-react';

type MainTab = 'alerts' | 'rules';
type FilterStatus = 'all' | AlertStatus;
type FilterSeverity = 'all' | AlertSeverity;

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<MainTab>('alerts');
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AlertRule | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('active');
  const [severityFilter, setSeverityFilter] = useState<FilterSeverity>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionNotification, setActionNotification] = useState<{
    message: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  // Auto-refresh hook (15s countdown)
  const autoRefresh = useAutoRefresh({
    intervalSeconds: 15,
    initialEnabled: true,
  });

  // Rules query
  const { data: rules, isLoading: isLoadingRules } = useQuery<AlertRule[]>({
    queryKey: ['alert-rules'],
    queryFn: async () => {
      const response = await api.get('alert-rules/');
      return (response.data?.data || []) as AlertRule[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Alerts stats query
  const { data: stats } = useQuery<AlertStats>({
    queryKey: ['alerts-stats'],
    queryFn: async () => {
      const response = await api.get('alerts/stats/');
      return (response.data?.data || {}) as AlertStats;
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Alerts query
  const getAlertsEndpoint = () => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (severityFilter !== 'all') params.append('severity', severityFilter);
    const queryString = params.toString();
    return queryString ? `alerts/?${queryString}` : 'alerts/';
  };

  const { data: alerts, isLoading: isLoadingAlerts } = useQuery<Alert[]>({
    queryKey: ['alerts-list', statusFilter, severityFilter],
    queryFn: async () => {
      const response = await api.get(getAlertsEndpoint());
      return (response.data?.data || []) as Alert[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Rule mutations
  const createRuleMutation = useMutation({
    mutationFn: async (data: CreateAlertRuleData) => {
      await api.post('alert-rules/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateAlertRuleData> }) => {
      await api.patch(`alert-rules/${id}/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`alert-rules/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
      setDeleteTarget(null);
    },
  });

  // Alert status update mutation
  const updateAlertStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AlertStatus }) => {
      await api.patch(`alerts/${id}/`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-list'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-stats'] });
    },
  });

  const acknowledgeAllMutation = useMutation({
    mutationFn: async () => {
      await api.post('alerts/acknowledge-all/');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-list'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-stats'] });
    },
  });

  const resolveAllMutation = useMutation({
    mutationFn: async () => {
      await api.post('alerts/resolve-all/');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-list'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-stats'] });
    },
  });

  const createIncidentMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await api.post(`alerts/${alertId}/create-incident/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-list'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-stats'] });
      queryClient.invalidateQueries({ queryKey: ['incidents-list'] });
    },
  });

  const evaluateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('alert-rules/evaluate/');
      return res.data?.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['alerts-list'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-stats'] });
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
      const msg = data?.message || 'Evaluación de reglas completada correctamente.';
      setActionNotification({
        message: msg,
        type: 'success',
      });
      setTimeout(() => setActionNotification(null), 6000);
    },
    onError: (err: any) => {
      const errorMsg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        'Error al evaluar las reglas de alerta.';
      setActionNotification({
        message: errorMsg,
        type: 'error',
      });
      setTimeout(() => setActionNotification(null), 6000);
    },
  });

  // Handlers
  const handleOpenCreateRule = () => {
    setEditingRule(null);
    setShowRuleModal(true);
  };

  const handleOpenEditRule = (rule: AlertRule) => {
    setEditingRule(rule);
    setShowRuleModal(true);
  };

  const handleCloseRuleModal = () => {
    setShowRuleModal(false);
    setEditingRule(null);
  };

  const handleRuleSubmit = async (data: CreateAlertRuleData) => {
    if (editingRule) {
      await updateRuleMutation.mutateAsync({ id: editingRule.id, data });
    } else {
      await createRuleMutation.mutateAsync(data);
    }
  };

  // Filtered alerts by search term
  const filteredAlerts = (alerts || []).filter((alert: Alert) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      alert.title.toLowerCase().includes(term) ||
      (alert.message && alert.message.toLowerCase().includes(term)) ||
      (alert.target_type && alert.target_type.toLowerCase().includes(term))
    );
  });

  // Filtered rules by search term
  const filteredRules = (rules || []).filter((rule: AlertRule) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      rule.name.toLowerCase().includes(term) ||
      (rule.target_type && rule.target_type.toLowerCase().includes(term)) ||
      (rule.condition && rule.condition.toLowerCase().includes(term))
    );
  });

  const totalAlertsCount =
    (stats?.total_active || 0) + (stats?.acknowledged || 0) + (stats?.resolved || 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader
        title="Centro de Alertas & Umbrales"
        badgeText="INCIDENT RADAR"
        description="Configuración de umbrales automáticos, centro de atención de alertas y derivación directa a incidentes."
        icon={<Bell size={26} />}
        autoRefresh={{
          enabled: autoRefresh.enabled,
          countdown: autoRefresh.countdown,
          onToggle: autoRefresh.toggle,
        }}
        actions={
          <>
            <button
              type="button"
              onClick={() => evaluateMutation.mutate()}
              disabled={evaluateMutation.isPending}
              className="flex items-center gap-2 bg-accent-green/10 border border-accent-green/40 text-accent-green font-medium px-4 py-2 rounded-full text-sm hover:bg-accent-green/20 transition-all disabled:opacity-50"
              title="Ejecutar evaluación de reglas inmediatamente"
            >
              <RefreshCw
                size={15}
                className={evaluateMutation.isPending ? 'animate-spin' : ''}
              />
              <span>
                {evaluateMutation.isPending ? 'Evaluando Reglas...' : 'Evaluar Reglas Ahora'}
              </span>
            </button>
            {activeTab === 'rules' && (
              <button
                type="button"
                onClick={handleOpenCreateRule}
                className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20"
              >
                <Plus size={16} />
                Nueva Regla
              </button>
            )}
          </>
        }
      />

      {/* Action Notification Banner */}
      {actionNotification && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs font-sans animate-in fade-in slide-in-from-top-2 duration-200 ${
            actionNotification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : actionNotification.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionNotification.type === 'success' && (
              <CheckCircle2 size={16} className="shrink-0" />
            )}
            {actionNotification.type === 'error' && (
              <AlertTriangle size={16} className="shrink-0" />
            )}
            {actionNotification.type === 'info' && <Info size={16} className="shrink-0" />}
            <span className="font-medium">{actionNotification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotification(null)}
            className="p-1 hover:bg-white/10 rounded-full transition-colors text-text-dim hover:text-text-main"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. NOC COMMAND CENTER: KPI STRIP */}
      <NOCKpiGrid columns={4}>
        {/* KPI 1: Críticas Activas */}
        <NOCKpiCard
          title="Críticas Activas"
          icon={<ShieldAlert size={16} className="text-accent-red" />}
          badge={{
            text: (stats?.active_critical || 0) > 0 ? `${stats?.active_critical} Activas` : 'Sin Alarma',
            variant: (stats?.active_critical || 0) > 0 ? 'danger' : 'success',
          }}
          value={stats?.active_critical || 0}
          valueColor={(stats?.active_critical || 0) > 0 ? 'text-accent-red' : 'text-text-main'}
          valueSuffix="alertas"
          subtitle="Requieren acción inmediata o escalación"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Nivel de Gravedad</span>
              <span className={(stats?.active_critical || 0) > 0 ? 'text-accent-red font-semibold' : 'text-accent-green'}>
                {(stats?.active_critical || 0) > 0 ? 'Atención Inmediata' : 'Óptimo'}
              </span>
            </div>
          }
        />

        {/* KPI 2: Advertencias */}
        <NOCKpiCard
          title="Advertencias"
          icon={<AlertTriangle size={16} className="text-amber-400" />}
          badge={{
            text: `${stats?.active_warning || 0} Activas`,
            variant: (stats?.active_warning || 0) > 0 ? 'warning' : 'neutral',
          }}
          value={stats?.active_warning || 0}
          valueColor={(stats?.active_warning || 0) > 0 ? 'text-amber-400' : 'text-text-main'}
          valueSuffix="alertas"
          subtitle="Umbrales preventivos superados"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Monitoreo Preventivo</span>
              <span className="text-amber-400 font-medium">Activo</span>
            </div>
          }
        />

        {/* KPI 3: Resueltas */}
        <NOCKpiCard
          title="Alertas Resueltas"
          icon={<CheckCircle2 size={16} className="text-accent-green" />}
          badge={{
            text: 'Histórico',
            variant: 'success',
          }}
          value={stats?.resolved || 0}
          valueSuffix="mitigadas"
          subtitle="Contención exitosa de incidentes"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Reconocidas en Gestión</span>
              <span>{stats?.acknowledged || 0}</span>
            </div>
          }
        />

        {/* KPI 4: MTTR Promedio */}
        <NOCKpiCard
          title="MTTR Promedio"
          icon={<Clock size={16} className="text-sky-400" />}
          badge={{
            text: 'SLA Resolución',
            variant: 'info',
          }}
          value={stats?.avg_mttr_minutes ? `${stats.avg_mttr_minutes}m` : '0m'}
          valueColor="text-sky-400"
          valueSuffix="tiempo medio"
          subtitle="Tiempo promedio desde disparo a resolución"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Eficiencia de Respuesta</span>
              <span className="text-accent-green font-medium">&lt; 30m</span>
            </div>
          }
        />
      </NOCKpiGrid>

      {/* 3. TOOLBAR: Omnibar Search + Main Tab Switcher + Status Pills */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={
          activeTab === 'alerts'
            ? 'Buscar por título, mensaje o módulo de alerta...'
            : 'Buscar por nombre de regla o métrica...'
        }
        categoryLabel="Vista:"
        categories={[
          { id: 'alerts', label: 'Alertas Activas & Historial' },
          { id: 'rules', label: `Reglas de Umbral (${rules?.length || 0})` },
        ]}
        selectedCategory={activeTab}
        onCategoryChange={(c) => setActiveTab(c as MainTab)}
        statusPills={
          activeTab === 'alerts'
            ? [
                { id: 'all', label: 'Todos', count: totalAlertsCount, variant: 'all' },
                {
                  id: 'active',
                  label: 'Activas',
                  count: stats?.total_active || 0,
                  variant: 'danger',
                },
                {
                  id: 'acknowledged',
                  label: 'Reconocidas',
                  count: stats?.acknowledged || 0,
                  variant: 'warning',
                },
                {
                  id: 'resolved',
                  label: 'Resueltas',
                  count: stats?.resolved || 0,
                  variant: 'success',
                },
              ]
            : undefined
        }
        selectedStatus={statusFilter}
        onStatusChange={(st) => setStatusFilter(st as FilterStatus)}
      />

      {/* 4. SUB-ACTIONS BAR FOR ALERTS (Acknowledge All / Resolve All) */}
      {activeTab === 'alerts' && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-bg-card/95 border border-border-base/70 p-3.5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-text-dim text-xs font-semibold mr-1">Severidad:</span>
            {(['all', 'critical', 'warning', 'info'] as FilterSeverity[]).map((sv) => (
              <button
                key={sv}
                type="button"
                onClick={() => setSeverityFilter(sv)}
                className={`px-3 py-1 rounded-full border text-xs capitalize transition-all ${
                  severityFilter === sv
                    ? 'bg-accent-green/10 border-accent-green/40 text-accent-green font-semibold'
                    : 'bg-bg-dark border-border-base/60 text-text-muted hover:text-text-main'
                }`}
              >
                {sv === 'all' ? 'Todas' : sv === 'critical' ? 'Crítica' : sv === 'warning' ? 'Advertencia' : 'Informativa'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => acknowledgeAllMutation.mutate()}
              disabled={acknowledgeAllMutation.isPending || !stats?.total_active}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border-base bg-bg-dark text-text-muted hover:text-text-main text-xs font-medium transition-colors disabled:opacity-40"
              title="Marcar todas las alertas activas como reconocidas"
            >
              <CheckCheck size={14} className="text-accent-yellow" />
              Reconocer Todas
            </button>
            <button
              type="button"
              onClick={() => resolveAllMutation.mutate()}
              disabled={
                resolveAllMutation.isPending || (!stats?.total_active && !stats?.acknowledged)
              }
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border-base bg-bg-dark text-text-muted hover:text-accent-green text-xs font-medium transition-colors disabled:opacity-40"
              title="Marcar todas las alertas como resueltas"
            >
              <CheckSquare size={14} className="text-accent-green" />
              Resolver Todas
            </button>
          </div>
        </div>
      )}

      {/* 5. CONTENT: ALERTS TAB OR RULES TAB */}
      {activeTab === 'alerts' ? (
        isLoadingAlerts ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-accent-green" size={32} />
          </div>
        ) : filteredAlerts && filteredAlerts.length > 0 ? (
          <div className="space-y-3">
            {filteredAlerts.map((alert: Alert) => (
              <div
                key={alert.id}
                className="bg-bg-card/95 border border-border-base/70 rounded-2xl p-4 sm:p-5 hover:border-accent-green/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
              >
                <div className="flex items-start gap-3.5">
                  <div className="mt-1 shrink-0">
                    <SeverityBadge severity={alert.severity} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-bold text-text-main text-base">{alert.title}</h3>
                      <StatusBadge status={alert.status} />
                    </div>
                    <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed">
                      {alert.message}
                    </p>
                    <div className="flex items-center gap-3 text-xs font-mono text-text-dim mt-2 flex-wrap">
                      <span className="flex items-center gap-1 text-[11px]">
                        <Clock size={12} />
                        {new Date(alert.triggered_at).toLocaleString('es-ES')}
                      </span>
                      <span>•</span>
                      <span className="text-sky-400 font-medium">Módulo: {alert.target_type}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  {alert.incident_id ? (
                    <span
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-red/10 border border-accent-red/30 text-accent-red rounded-full text-xs font-mono font-bold"
                      title={alert.incident_title || 'Incidente vinculado'}
                    >
                      <Flame size={13} /> Incidente Vinc.
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => createIncidentMutation.mutate(alert.id)}
                      disabled={createIncidentMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-full text-xs font-semibold transition-all disabled:opacity-50"
                      title="Elevar esta alerta a Incidente"
                    >
                      <Flame size={13} />
                      Crear Incidente
                    </button>
                  )}

                  {alert.status === 'active' && (
                    <button
                      type="button"
                      onClick={() =>
                        updateAlertStatusMutation.mutate({ id: alert.id, status: 'acknowledged' })
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-yellow/10 border border-accent-yellow/30 text-accent-yellow hover:bg-accent-yellow hover:text-black rounded-full text-xs font-semibold transition-all"
                      title="Reconocer alerta"
                    >
                      <Eye size={13} />
                      Reconocer
                    </button>
                  )}
                  {alert.status !== 'resolved' && (
                    <button
                      type="button"
                      onClick={() =>
                        updateAlertStatusMutation.mutate({ id: alert.id, status: 'resolved' })
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-black rounded-full text-xs font-semibold transition-all"
                      title="Marcar como resuelta"
                    >
                      <CheckCircle size={13} />
                      Resolver
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Bell}
            title={
              searchTerm || statusFilter !== 'all' || severityFilter !== 'all'
                ? 'No se encontraron alertas con los filtros aplicados'
                : 'No hay alertas activas en el sistema'
            }
            description={
              searchTerm || statusFilter !== 'all' || severityFilter !== 'all'
                ? 'Prueba a cambiar el término de búsqueda o restablecer los filtros de estado y severidad.'
                : 'Todos los servicios operan dentro de los umbrales normales sin infracciones reportadas.'
            }
            actionLabel={
              searchTerm || statusFilter !== 'all' || severityFilter !== 'all'
                ? 'Limpiar Filtros'
                : 'Evaluar Reglas Ahora'
            }
            onAction={() => {
              if (searchTerm || statusFilter !== 'all' || severityFilter !== 'all') {
                setSearchTerm('');
                setStatusFilter('all');
                setSeverityFilter('all');
              } else {
                evaluateMutation.mutate();
              }
            }}
          />
        )
      ) : (
        /* RULES TAB */
        isLoadingRules ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-accent-green" size={32} />
          </div>
        ) : filteredRules && filteredRules.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRules.map((rule: AlertRule) => (
              <div
                key={rule.id}
                className="bg-bg-card/95 border border-border-base/70 rounded-2xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between group shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-bold text-text-main text-base group-hover:text-accent-green transition-colors line-clamp-1">
                      {rule.name}
                    </h3>
                    <SeverityBadge severity={rule.severity} />
                  </div>

                  <div className="space-y-2 text-xs font-mono text-text-muted bg-bg-dark/50 rounded-xl p-3 border border-border-base/40 font-sans">
                    <div className="flex justify-between border-b border-border-base/40 pb-1.5">
                      <span className="text-text-dim font-medium">Condición:</span>
                      <span className="text-accent-green font-mono font-bold">
                        {rule.condition} ({rule.threshold})
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border-base/40 pb-1.5">
                      <span className="text-text-dim font-medium">Tipo Objetivo:</span>
                      <span className="text-text-main font-semibold capitalize">{rule.target_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-dim font-medium">Estado:</span>
                      <span className="font-semibold">
                        {rule.enabled ? (
                          <span className="text-accent-green">Activa</span>
                        ) : (
                          <span className="text-text-dim">Deshabilitada</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border-base/40 flex items-center justify-between text-xs text-text-dim">
                  <span className="font-mono text-[11px]">
                    Creada: {new Date(rule.created_at).toLocaleDateString('es-ES')}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditRule(rule)}
                      className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors"
                      title="Editar regla"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(rule)}
                      className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors"
                      title="Eliminar regla"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Sliders}
            title={
              searchTerm
                ? 'No se encontraron reglas con los términos de búsqueda'
                : 'No hay reglas de alerta configuradas'
            }
            description={
              searchTerm
                ? 'Prueba a cambiar el término de búsqueda para ver las reglas configuradas.'
                : 'Define condiciones y umbrales automáticos para ser notificado de incidentes por Email, Telegram o Webhook.'
            }
            actionLabel={searchTerm ? 'Limpiar Filtro' : 'Crear Primera Regla'}
            onAction={() => {
              if (searchTerm) {
                setSearchTerm('');
              } else {
                handleOpenCreateRule();
              }
            }}
          />
        )
      )}

      {/* 6. CREATE / EDIT RULE MODAL */}
      {showRuleModal && (
        <AlertRuleForm
          rule={editingRule}
          onSubmit={handleRuleSubmit}
          onClose={handleCloseRuleModal}
        />
      )}

      {/* 7. DELETE CONFIRMATION MODAL */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.name || 'esta regla'}
        isDeleting={deleteRuleMutation.isPending}
        onConfirm={() => deleteTarget && deleteRuleMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
