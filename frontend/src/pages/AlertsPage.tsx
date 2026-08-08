import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { AlertRule, Alert, CreateAlertRuleData, AlertSeverity, AlertStatus, AlertStats } from '../types/alerts';
import SeverityBadge from '../components/common/SeverityBadge';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
import AlertRuleForm from '../components/alerts/AlertRuleForm';
import {
  Bell,
  BellRing,
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
} from 'lucide-react';

type MainTab = 'rules' | 'alerts';
type FilterStatus = 'all' | AlertStatus;
type FilterSeverity = 'all' | AlertSeverity;

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<MainTab>('alerts');
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AlertRule | null>(null);

  // Filters for active alerts
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('active');
  const [severityFilter, setSeverityFilter] = useState<FilterSeverity>('all');

  // Rules query
  const { data: rules, isLoading: isLoadingRules, refetch: refetchRules, isRefetching: isRefetchingRules } = useQuery({
    queryKey: ['alert-rules'],
    queryFn: async () => {
      const response = await api.get('alert-rules/');
      return response.data?.data || [];
    },
    refetchInterval: 30000,
  });

  // Alerts stats query
  const { data: stats } = useQuery({
    queryKey: ['alerts-stats'],
    queryFn: async () => {
      const response = await api.get('alerts/stats/');
      return (response.data?.data || {}) as AlertStats;
    },
    refetchInterval: 15000,
  });

  // Alerts query
  const getAlertsEndpoint = () => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (severityFilter !== 'all') params.append('severity', severityFilter);
    const queryString = params.toString();
    return queryString ? `alerts/?${queryString}` : 'alerts/';
  };

  const { data: alerts, isLoading: isLoadingAlerts, refetch: refetchAlerts, isRefetching: isRefetchingAlerts } = useQuery({
    queryKey: ['alerts-list', statusFilter, severityFilter],
    queryFn: async () => {
      const response = await api.get(getAlertsEndpoint());
      return response.data?.data || [];
    },
    refetchInterval: 15000,
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

  const handleRuleFormSubmit = async (data: CreateAlertRuleData) => {
    if (editingRule) {
      await updateRuleMutation.mutateAsync({ id: editingRule.id, data });
    } else {
      await createRuleMutation.mutateAsync(data);
    }
  };

  const handleOpenCreateRule = () => {
    setEditingRule(null);
    setShowRuleModal(true);
  };

  const handleOpenEditRule = (rule: AlertRule) => {
    setEditingRule(rule);
    setShowRuleModal(true);
  };

  const toggleRuleEnabled = (rule: AlertRule) => {
    updateRuleMutation.mutate({
      id: rule.id,
      data: { enabled: !rule.enabled },
    });
  };

  // Evaluate rules mutation
  const evaluateMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('alert-rules/evaluate/');
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-list'] });
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-stats'] });
    },
  });

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            <Bell className="text-accent-green" size={28} />
            Alertas & Reglas de Disparo
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Configuración de umbrales automáticos y centro de atención de alertas del sistema
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => evaluateMutation.mutate()}
            disabled={evaluateMutation.isPending}
            className="flex items-center gap-2 bg-accent-green/10 border border-accent-green text-accent-green font-semibold px-3.5 py-2 rounded-md text-sm hover:bg-accent-green/20 transition-colors disabled:opacity-50"
            title="Ejecutar evaluación de reglas inmediatamente"
          >
            <RefreshCw size={16} className={evaluateMutation.isPending ? 'animate-spin' : ''} />
            Evaluar Reglas Ahora
          </button>

          <button
            onClick={() => (activeTab === 'rules' ? refetchRules() : refetchAlerts())}
            disabled={isRefetchingRules || isRefetchingAlerts}
            className="p-2 border border-border-base rounded-md text-text-muted hover:text-text-main hover:bg-bg-card-hover transition-colors disabled:opacity-50"
            title="Refrescar datos"
          >
            <RefreshCw
              size={18}
              className={isRefetchingRules || isRefetchingAlerts ? 'animate-spin' : ''}
            />
          </button>
          {activeTab === 'rules' && (
            <button
              onClick={handleOpenCreateRule}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-4 py-2 rounded-md text-sm hover:opacity-90 transition-opacity"
            >
              <Plus size={18} />
              Nueva Regla
            </button>
          )}
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-4 border-b border-border-base mb-6">
        <button
          onClick={() => setActiveTab('alerts')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'alerts'
              ? 'border-accent-green text-accent-green font-bold'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          <Bell size={18} />
          Alertas Activas & Historial
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'rules'
              ? 'border-accent-green text-accent-green font-bold'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          <Sliders size={18} />
          Reglas de Alerta ({rules?.length || 0})
        </button>
      </div>

      {/* TAB 1: ALERTS LIST */}
      {activeTab === 'alerts' && (
        <div>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
              <div className="w-10 h-10 rounded-lg bg-accent-red/10 flex items-center justify-center text-accent-red shrink-0">
                <ShieldAlert size={20} />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-text-muted">Críticas Activas</p>
                <p className="text-xl font-bold font-mono text-accent-red">{stats?.active_critical || 0}</p>
              </div>
            </div>

            <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
              <div className="w-10 h-10 rounded-lg bg-accent-yellow/10 flex items-center justify-center text-accent-yellow shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-text-muted">Advertencias</p>
                <p className="text-xl font-bold font-mono text-accent-yellow">{stats?.active_warning || 0}</p>
              </div>
            </div>

            <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
              <div className="w-10 h-10 rounded-lg bg-accent-blue/10 flex items-center justify-center text-accent-blue shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-text-muted">Resueltas</p>
                <p className="text-xl font-bold font-mono text-text-main">{stats?.resolved || 0}</p>
              </div>
            </div>

            <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
              <div className="w-10 h-10 rounded-lg bg-accent-green/10 flex items-center justify-center text-accent-green shrink-0">
                <Clock size={20} />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-text-muted">MTTR Promedio</p>
                <p className="text-xl font-bold font-mono text-accent-green">
                  {stats?.avg_mttr_minutes ? `${stats.avg_mttr_minutes}m` : '0m'}
                </p>
              </div>
            </div>
          </div>

          {/* Sub Filters & Bulk Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 bg-bg-card border border-border-base p-4 rounded-xl shadow-md">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-text-dim font-mono uppercase font-bold mr-1">Estado:</span>
              {(['all', 'active', 'acknowledged', 'resolved'] as FilterStatus[]).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg border font-mono capitalize transition-all ${
                    statusFilter === st
                      ? 'bg-accent-green/10 border-accent-green/40 text-accent-green font-bold'
                      : 'bg-bg-dark border-border-base text-text-muted hover:text-text-main'
                  }`}
                >
                  {st === 'all' ? 'Todos' : st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-text-dim font-mono uppercase font-bold mr-1">Severidad:</span>
                {(['all', 'critical', 'warning', 'info'] as FilterSeverity[]).map((sv) => (
                  <button
                    key={sv}
                    onClick={() => setSeverityFilter(sv)}
                    className={`px-3 py-1.5 rounded-lg border font-mono capitalize transition-all ${
                      severityFilter === sv
                        ? 'bg-accent-blue/10 border-accent-blue/40 text-accent-blue font-bold'
                        : 'bg-bg-dark border-border-base text-text-muted hover:text-text-main'
                    }`}
                  >
                    {sv === 'all' ? 'Todas' : sv}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 border-l border-border-base pl-3">
                <button
                  onClick={() => acknowledgeAllMutation.mutate()}
                  disabled={acknowledgeAllMutation.isPending || !stats?.total_active}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-base bg-bg-dark text-text-muted hover:text-text-main text-xs font-medium transition-colors disabled:opacity-40"
                  title="Marcar todas las alertas activas como reconocidas"
                >
                  <CheckCheck size={14} className="text-accent-yellow" />
                  Reconocer Todas
                </button>
                <button
                  onClick={() => resolveAllMutation.mutate()}
                  disabled={resolveAllMutation.isPending || (!stats?.total_active && !stats?.acknowledged)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-base bg-bg-dark text-text-muted hover:text-accent-green text-xs font-medium transition-colors disabled:opacity-40"
                  title="Marcar todas las alertas como resueltas"
                >
                  <CheckSquare size={14} className="text-accent-green" />
                  Resolver Todas
                </button>
              </div>
            </div>
          </div>

          {/* Alerts Grid */}
          {isLoadingAlerts ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-accent-green" size={32} />
            </div>
          ) : alerts && alerts.length > 0 ? (
            <div className="space-y-4">
              {alerts.map((alert: Alert) => (
                <div
                  key={alert.id}
                  className="bg-bg-card border border-border-base rounded-xl p-5 hover:border-accent-green/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      <SeverityBadge severity={alert.severity} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-text-main text-base">{alert.title}</h3>
                        <StatusBadge status={alert.status} />
                      </div>
                      <p className="text-sm text-text-muted mt-1">{alert.message}</p>
                      <div className="flex items-center gap-4 text-xs font-mono text-text-dim mt-2">
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> Disparada:{' '}
                          {new Date(alert.triggered_at).toLocaleString('es-ES')}
                        </span>
                        <span>•</span>
                        <span className="uppercase text-accent-blue">Módulo: {alert.target_type}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    {alert.incident_id ? (
                      <span
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-red/10 border border-accent-red/30 text-accent-red rounded-lg text-xs font-mono font-bold"
                        title={alert.incident_title || 'Incidente vinculado'}
                      >
                        <Flame size={14} /> Incidente Vinc.
                      </span>
                    ) : (
                      <button
                        onClick={() => createIncidentMutation.mutate(alert.id)}
                        disabled={createIncidentMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                        title="Elevar esta alerta a Incidente"
                      >
                        <Flame size={14} />
                        Crear Incidente
                      </button>
                    )}

                    {alert.status === 'active' && (
                      <button
                        onClick={() =>
                          updateAlertStatusMutation.mutate({ id: alert.id, status: 'acknowledged' })
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-yellow/10 border border-accent-yellow/30 text-accent-yellow hover:bg-accent-yellow hover:text-black rounded-lg text-xs font-semibold transition-all"
                        title="Reconocer alerta"
                      >
                        <Eye size={14} />
                        Reconocer
                      </button>
                    )}
                    {alert.status !== 'resolved' && (
                      <button
                        onClick={() =>
                          updateAlertStatusMutation.mutate({ id: alert.id, status: 'resolved' })
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-black rounded-lg text-xs font-semibold transition-all"
                        title="Marcar como resuelta"
                      >
                        <CheckCircle size={14} />
                        Resolver
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={BellRing}
              title="No hay alertas registradas"
              description="No hay eventos de alerta disparados para los filtros seleccionados."
            />
          )}
        </div>
      )}

      {/* TAB 2: ALERT RULES */}
      {activeTab === 'rules' && (
        <div>
          {isLoadingRules ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-accent-green" size={32} />
            </div>
          ) : rules && rules.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rules.map((rule: AlertRule) => (
                <div
                  key={rule.id}
                  className="bg-bg-card border border-border-base rounded-xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between shadow-lg"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="overflow-hidden">
                        <h3 className="font-bold text-text-main truncate text-base" title={rule.name}>
                          {rule.name}
                        </h3>
                        <span className="text-xs font-mono text-accent-blue uppercase tracking-wider">
                          {rule.target_type}
                        </span>
                      </div>
                      <SeverityBadge severity={rule.severity} />
                    </div>

                    <div className="space-y-2 text-xs font-mono text-text-muted border-t border-border-base/50 pt-3 mb-3">
                      <div className="flex justify-between">
                        <span className="text-text-dim">Condición:</span>
                        <span className="text-text-main font-semibold truncate max-w-[170px]">
                          {rule.condition}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-dim">Umbral (Threshold):</span>
                        <span className="text-accent-green font-bold">{rule.threshold}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border-base flex items-center justify-between text-xs">
                    {/* Toggle switch */}
                    <button
                      onClick={() => toggleRuleEnabled(rule)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono font-bold transition-all ${
                        rule.enabled
                          ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                          : 'bg-bg-dark border-border-base text-text-dim'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${rule.enabled ? 'bg-accent-green' : 'bg-text-dim'}`} />
                      {rule.enabled ? 'ACTIVA' : 'INACTIVA'}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditRule(rule)}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded transition-colors"
                        title="Editar regla"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(rule)}
                        className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded transition-colors"
                        title="Eliminar regla"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Sliders}
              title="No hay reglas de alerta configuradas"
              description="Crea tu primera regla de alerta para recibir notificaciones automáticas."
              actionLabel="Nueva Regla"
              onAction={handleOpenCreateRule}
            />
          )}
        </div>
      )}

      {/* Form Modal */}
      {showRuleModal && (
        <AlertRuleForm
          rule={editingRule}
          onSubmit={handleRuleFormSubmit}
          onClose={() => {
            setShowRuleModal(false);
            setEditingRule(null);
          }}
        />
      )}

      {/* Delete Modal */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.name || ''}
        isDeleting={deleteRuleMutation.isPending}
        onConfirm={() => deleteTarget && deleteRuleMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
