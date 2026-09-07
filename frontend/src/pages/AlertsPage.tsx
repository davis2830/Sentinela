import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  AlertRule,
  Alert,
  CreateAlertRuleData,
  AlertSeverity,
  AlertStatus,
  AlertStats,
  AlertTargetType,
} from '../types/alerts';
import SeverityBadge from '../components/common/SeverityBadge';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
import AlertRuleForm from '../components/alerts/AlertRuleForm';
import AlertRuleTableView from '../components/alerts/AlertRuleTableView';
import AlertTableView from '../components/alerts/AlertTableView';
import {
  NOCPageHeader,
  NOCKpiGrid,
  NOCKpiCard,
  NOCToolbar,
  NOCDrawer,
  NOCBulkActionBar,
} from '../components/common/noc';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { usePersistentViewMode } from '../hooks/usePersistentViewMode';
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
  Square,
  Flame,
  Info,
  X,
  Download,
  Moon,
  ExternalLink,
  Activity,
  Zap,
  RotateCcw,
} from 'lucide-react';

type MainTab = 'alerts' | 'rules';
type FilterStatus = 'all' | AlertStatus;
type FilterSeverity = 'all' | AlertSeverity;

interface SnoozeTarget {
  type: 'alert' | 'rule' | 'bulk';
  id?: string;
  name: string;
  isCurrentlySnoozed?: boolean;
}

export default function AlertsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<MainTab>('alerts');
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AlertRule | null>(null);

  // Persistent view mode ('grid' | 'table') per Sentinel NOC standard
  const [viewMode, setViewMode] = usePersistentViewMode('alerts', 'grid');

  // Inspection Drawer
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [drawerTab, setDrawerTab] = useState<'rca' | 'timeline' | 'actions'>('rca');

  // Multi-Selection
  const [selectedAlertIds, setSelectedAlertIds] = useState<string[]>([]);

  // Snooze Modal State
  const [snoozeTarget, setSnoozeTarget] = useState<SnoozeTarget | null>(null);
  const [snoozeMinutes, setSnoozeMinutes] = useState<number>(60);

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

  // Helper: Get route from target_type
  const getModuleRoute = (targetType: AlertTargetType | string) => {
    switch (targetType) {
      case 'monitoring':
        return '/monitoring';
      case 'ssl':
        return '/ssl';
      case 'dns':
        return '/dns';
      case 'domain':
        return '/domains';
      case 'api_check':
        return '/api-checks';
      case 'security_headers':
        return '/security-headers';
      default:
        return '/monitoring';
    }
  };

  const getModuleName = (targetType: AlertTargetType | string) => {
    switch (targetType) {
      case 'monitoring':
        return 'Uptime & Latencia';
      case 'ssl':
        return 'Certificados SSL';
      case 'dns':
        return 'Registros DNS';
      case 'domain':
        return 'Dominios WHOIS';
      case 'api_check':
        return 'API Checks Sintéticos';
      case 'security_headers':
        return 'Cabeceras de Seguridad';
      default:
        return targetType;
    }
  };

  // Rule mutations
  const createRuleMutation = useMutation({
    mutationFn: async (data: CreateAlertRuleData) => {
      await api.post('alert-rules/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
      notify('Regla creada exitosamente.', 'success');
    },
    onError: (err: any) => {
      notify(err?.response?.data?.message || 'Error al crear la regla.', 'error');
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateAlertRuleData> }) => {
      await api.patch(`alert-rules/${id}/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
      notify('Regla actualizada exitosamente.', 'success');
    },
    onError: (err: any) => {
      notify(err?.response?.data?.message || 'Error al actualizar la regla.', 'error');
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`alert-rules/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
      setDeleteTarget(null);
      notify('Regla eliminada del sistema.', 'info');
    },
  });

  // Alert status update mutation
  const updateAlertStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AlertStatus }) => {
      await api.patch(`alerts/${id}/`, { status });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['alerts-list'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-stats'] });
      if (selectedAlert?.id === vars.id) {
        setSelectedAlert((prev) => (prev ? { ...prev, status: vars.status } : null));
      }
      notify(`Alerta marcada como ${vars.status === 'resolved' ? 'resuelta' : 'reconocida'}.`, 'success');
    },
  });

  const acknowledgeAllMutation = useMutation({
    mutationFn: async () => {
      await api.post('alerts/acknowledge-all/');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-list'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-stats'] });
      notify('Todas las alertas activas han sido reconocidas.', 'success');
    },
  });

  const resolveAllMutation = useMutation({
    mutationFn: async () => {
      await api.post('alerts/resolve-all/');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-list'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-stats'] });
      notify('Todas las alertas han sido marcadas como resueltas.', 'success');
    },
  });

  const createIncidentMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await api.post(`alerts/${alertId}/create-incident/`);
      return res.data?.data;
    },
    onSuccess: (data, alertId) => {
      queryClient.invalidateQueries({ queryKey: ['alerts-list'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-stats'] });
      queryClient.invalidateQueries({ queryKey: ['incidents-list'] });
      if (selectedAlert?.id === alertId) {
        setSelectedAlert((prev) =>
          prev
            ? {
                ...prev,
                incident_id: data?.incident?.id || 'linked',
                incident_title: data?.incident?.title || 'Incidente Creado',
              }
            : null
        );
      }
      notify('Alerta elevada a Incidente formal exitosamente.', 'success');
    },
    onError: (err: any) => {
      notify(err?.response?.data?.message || 'Error al crear el incidente.', 'error');
    },
  });

  // Evaluate Rules on Demand
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
      notify(msg, 'success');
    },
    onError: (err: any) => {
      const errorMsg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        'Error al evaluar las reglas de alerta.';
      notify(errorMsg, 'error');
    },
  });

  // Snooze Alert Mutation
  const snoozeAlertMutation = useMutation({
    mutationFn: async ({ id, minutes }: { id: string; minutes: number }) => {
      const res = await api.post(`alerts/${id}/snooze/`, { minutes });
      return res.data?.data;
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['alerts-list'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-stats'] });
      if (selectedAlert?.id === vars.id) {
        setSelectedAlert(data?.alert || null);
      }
      setSnoozeTarget(null);
      const msg =
        vars.minutes > 0
          ? `Alerta silenciada por ${vars.minutes} minutos.`
          : 'Silencio desactivado. Notificaciones reanudadas.';
      notify(msg, 'info');
    },
  });

  // Snooze Rule Mutation
  const snoozeRuleMutation = useMutation({
    mutationFn: async ({ id, minutes }: { id: string; minutes: number }) => {
      const res = await api.post(`alert-rules/${id}/snooze/`, { minutes });
      return res.data?.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
      setSnoozeTarget(null);
      const msg =
        vars.minutes > 0
          ? `Regla silenciada por ${vars.minutes} minutos.`
          : 'Silencio desactivado. Regla activa normalmente.';
      notify(msg, 'info');
    },
  });

  // Bulk Actions Mutation
  const bulkActionMutation = useMutation({
    mutationFn: async ({
      action,
      alert_ids,
      minutes,
    }: {
      action: 'acknowledge' | 'resolve' | 'snooze' | 'delete';
      alert_ids: string[];
      minutes?: number;
    }) => {
      const res = await api.post('alerts/bulk-action/', { action, alert_ids, minutes });
      return res.data?.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['alerts-list'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-stats'] });
      setSelectedAlertIds([]);
      setSnoozeTarget(null);
      notify(data?.message || 'Acción en lote completada con éxito.', 'success');
    },
    onError: (err: any) => {
      notify(err?.response?.data?.message || 'Error en acción masiva.', 'error');
    },
  });

  const notify = (message: string, type: 'success' | 'info' | 'error') => {
    setActionNotification({ message, type });
    setTimeout(() => setActionNotification(null), 6000);
  };

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

  // Multi-selection helpers
  const handleToggleSelectAlert = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAlertIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllVisible = () => {
    if (selectedAlertIds.length === filteredAlerts.length && filteredAlerts.length > 0) {
      setSelectedAlertIds([]);
    } else {
      setSelectedAlertIds(filteredAlerts.map((a) => a.id));
    }
  };

  // Export to CSV with UTF-8 BOM
  const handleExportCSV = () => {
    const listToExport = filteredAlerts;
    if (listToExport.length === 0) {
      notify('No hay alertas disponibles para exportar con los filtros actuales.', 'info');
      return;
    }

    const headers = [
      'ID',
      'Título',
      'Módulo',
      'Severidad',
      'Estado',
      'Ocurrencias',
      'Anti-Flapping',
      'Disparo Inicial',
      'Última Detección',
      'Resuelto En',
      'Auto-Resuelto',
      'Silenciado Hasta',
      'Mensaje Detallado',
    ];

    const rows = listToExport.map((a) => [
      `"${a.id}"`,
      `"${(a.title || '').replace(/"/g, '""')}"`,
      `"${a.target_type || ''}"`,
      `"${a.severity || ''}"`,
      `"${a.status || ''}"`,
      a.occurrence_count || 1,
      a.is_flapping ? `SÍ (${a.flapping_count || 3})` : 'NO',
      `"${a.triggered_at ? new Date(a.triggered_at).toLocaleString('es-ES') : ''}"`,
      `"${a.last_seen_at ? new Date(a.last_seen_at).toLocaleString('es-ES') : ''}"`,
      `"${a.resolved_at ? new Date(a.resolved_at).toLocaleString('es-ES') : ''}"`,
      a.auto_resolved ? 'SÍ' : 'NO',
      `"${a.snoozed_until ? new Date(a.snoozed_until).toLocaleString('es-ES') : 'NO'}"`,
      `"${(a.message || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `sentinel_smart_alerts_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify(`${listToExport.length} alertas exportadas a CSV con éxito.`, 'success');
  };

  // Snooze submit handler
  const handleConfirmSnooze = () => {
    if (!snoozeTarget) return;

    if (snoozeTarget.type === 'alert' && snoozeTarget.id) {
      snoozeAlertMutation.mutate({ id: snoozeTarget.id, minutes: snoozeMinutes });
    } else if (snoozeTarget.type === 'rule' && snoozeTarget.id) {
      snoozeRuleMutation.mutate({ id: snoozeTarget.id, minutes: snoozeMinutes });
    } else if (snoozeTarget.type === 'bulk') {
      bulkActionMutation.mutate({
        action: 'snooze',
        alert_ids: selectedAlertIds,
        minutes: snoozeMinutes,
      });
    }
  };

  const totalAlertsCount =
    (stats?.total_active || 0) + (stats?.acknowledged || 0) + (stats?.resolved || 0);

  // Helper to check if item is currently snoozed
  const isItemSnoozed = (snoozedUntil?: string | null) => {
    if (!snoozedUntil) return false;
    return new Date(snoozedUntil) > new Date();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader
        title="Centro de Alertas Inteligentes & Umbrales"
        badgeText="SMART ALERTS RADAR"
        description="Deduplicación inteligente, anti-flapping, mitigación de fatiga (snooze), simulación previa y enlace directo a módulos."
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
              className="flex items-center gap-2 bg-accent-green/10 border border-accent-green/40 text-accent-green font-medium px-4 py-2 rounded-full text-sm hover:bg-accent-green/20 transition-all disabled:opacity-50 cursor-pointer"
              title="Ejecutar evaluación de reglas inmediatamente"
            >
              <RefreshCw
                size={15}
                className={evaluateMutation.isPending ? 'animate-spin' : ''}
              />
              <span>
                {evaluateMutation.isPending ? 'Evaluando...' : 'Evaluar Reglas Ahora'}
              </span>
            </button>
            {activeTab === 'rules' && (
              <button
                type="button"
                onClick={handleOpenCreateRule}
                className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 cursor-pointer"
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
            className="p-1 hover:bg-white/10 rounded-full transition-colors text-text-dim hover:text-text-main cursor-pointer"
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

        {/* KPI 3: Resueltas & Auto-Mitigadas */}
        <NOCKpiCard
          title="Alertas Resueltas"
          icon={<CheckCircle2 size={16} className="text-accent-green" />}
          badge={{
            text: 'Histórico',
            variant: 'success',
          }}
          value={stats?.resolved || 0}
          valueSuffix="mitigadas"
          subtitle="Contención exitosa y auto-resolución"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Reconocidas en Gestión</span>
              <span className="text-text-main font-semibold">{stats?.acknowledged || 0}</span>
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
          subtitle="Calculado desde disparo inicial a resolución"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Eficiencia de Respuesta</span>
              <span className="text-accent-green font-medium">&lt; 30m</span>
            </div>
          }
        />
      </NOCKpiGrid>

      {/* 3. TOOLBAR: Omnibar Search + View Mode Switcher (Grid vs List/Table) + Main Tab Switcher + Status Pills */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={
          activeTab === 'alerts'
            ? 'Buscar por título, mensaje o módulo (SSL, DNS, API, WHOIS)...'
            : 'Buscar por nombre de regla o métrica...'
        }
        viewMode={viewMode}
        onViewModeChange={setViewMode}
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

      {/* 4. SUB-ACTIONS BAR FOR ALERTS */}
      {activeTab === 'alerts' && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-bg-card/95 border border-border-base/70 p-3.5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Multi-select all checkbox */}
            {filteredAlerts.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-border-base bg-bg-dark text-text-dim hover:text-text-main transition-colors mr-1 cursor-pointer"
                title="Seleccionar todas las alertas visibles"
              >
                {selectedAlertIds.length === filteredAlerts.length && filteredAlerts.length > 0 ? (
                  <CheckSquare size={14} className="text-accent-green" />
                ) : (
                  <Square size={14} />
                )}
                <span>
                  {selectedAlertIds.length === filteredAlerts.length && filteredAlerts.length > 0
                    ? 'Deseleccionar'
                    : 'Seleccionar Todo'}
                </span>
              </button>
            )}

            <span className="text-text-dim text-xs font-semibold mr-1">Severidad:</span>
            {(['all', 'critical', 'warning', 'info'] as FilterSeverity[]).map((sv) => (
              <button
                key={sv}
                type="button"
                onClick={() => setSeverityFilter(sv)}
                className={`px-3 py-1 rounded-full border text-xs capitalize transition-all cursor-pointer ${
                  severityFilter === sv
                    ? 'bg-accent-green/10 border-accent-green/40 text-accent-green font-semibold'
                    : 'bg-bg-dark border-border-base/60 text-text-muted hover:text-text-main'
                }`}
              >
                {sv === 'all'
                  ? 'Todas'
                  : sv === 'critical'
                  ? 'Crítica'
                  : sv === 'warning'
                  ? 'Advertencia'
                  : 'Informativa'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border-base bg-bg-dark text-text-muted hover:text-accent-green text-xs font-medium transition-colors cursor-pointer"
              title="Descargar inventario de alertas en CSV (UTF-8 BOM)"
            >
              <Download size={14} />
              <span>Exportar CSV</span>
            </button>

            {/* Acknowledge All */}
            <button
              type="button"
              onClick={() => acknowledgeAllMutation.mutate()}
              disabled={acknowledgeAllMutation.isPending || !stats?.total_active}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border-base bg-bg-dark text-text-muted hover:text-text-main text-xs font-medium transition-colors disabled:opacity-40 cursor-pointer"
              title="Marcar todas las alertas activas como reconocidas"
            >
              <CheckCheck size={14} className="text-accent-yellow" />
              Reconocer Todas
            </button>

            {/* Resolve All */}
            <button
              type="button"
              onClick={() => resolveAllMutation.mutate()}
              disabled={
                resolveAllMutation.isPending || (!stats?.total_active && !stats?.acknowledged)
              }
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border-base bg-bg-dark text-text-muted hover:text-accent-green text-xs font-medium transition-colors disabled:opacity-40 cursor-pointer"
              title="Marcar todas las alertas como resueltas"
            >
              <CheckSquare size={14} className="text-accent-green" />
              Resolver Todas
            </button>
          </div>
        </div>
      )}

      {/* 5. NOC BULK ACTION BAR */}
      <NOCBulkActionBar
        selectedCount={selectedAlertIds.length}
        itemLabel="alertas"
        onClearSelection={() => setSelectedAlertIds([])}
        actions={
          <>
            <button
              type="button"
              onClick={() =>
                bulkActionMutation.mutate({
                  action: 'acknowledge',
                  alert_ids: selectedAlertIds,
                })
              }
              disabled={bulkActionMutation.isPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-accent-yellow/15 border border-accent-yellow/40 text-accent-yellow hover:bg-accent-yellow/25 rounded-full text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              <Eye size={13} />
              Reconocer en Lote
            </button>

            <button
              type="button"
              onClick={() =>
                bulkActionMutation.mutate({
                  action: 'resolve',
                  alert_ids: selectedAlertIds,
                })
              }
              disabled={bulkActionMutation.isPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-accent-green/15 border border-accent-green/40 text-accent-green hover:bg-accent-green/25 rounded-full text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle size={13} />
              Resolver en Lote
            </button>

            <button
              type="button"
              onClick={() =>
                setSnoozeTarget({
                  type: 'bulk',
                  name: `${selectedAlertIds.length} alertas seleccionadas`,
                })
              }
              disabled={bulkActionMutation.isPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500/25 rounded-full text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              <Moon size={13} />
              Silenciar en Lote
            </button>

            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `¿Estás seguro de eliminar permanentemente ${selectedAlertIds.length} alertas seleccionadas?`
                  )
                ) {
                  bulkActionMutation.mutate({
                    action: 'delete',
                    alert_ids: selectedAlertIds,
                  });
                }
              }}
              disabled={bulkActionMutation.isPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-500/15 border border-rose-500/40 text-rose-400 hover:bg-rose-500/25 rounded-full text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              <Trash2 size={13} />
              Eliminar
            </button>
          </>
        }
      />

      {/* 6. MAIN CONTENT: DUAL VIEW MODE (CARDS / GRID vs TABLE / LIST) */}
      {activeTab === 'alerts' ? (
        isLoadingAlerts ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-accent-green" size={32} />
          </div>
        ) : filteredAlerts && filteredAlerts.length > 0 ? (
          viewMode === 'grid' ? (
            /* Cards View */
            <div className="space-y-3">
              {filteredAlerts.map((alert: Alert) => {
                const isSelected = selectedAlertIds.includes(alert.id);
                const snoozed = isItemSnoozed(alert.snoozed_until);

                return (
                  <div
                    key={alert.id}
                    onClick={() => setSelectedAlert(alert)}
                    className={`bg-bg-card/95 border rounded-2xl p-4 sm:p-5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm cursor-pointer group ${
                      isSelected
                        ? 'border-accent-green/60 bg-accent-green/5'
                        : alert.is_flapping
                        ? 'border-accent-red/50 hover:border-accent-red'
                        : 'border-border-base/70 hover:border-accent-green/40'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Checkbox for selection */}
                      <div
                        onClick={(e) => handleToggleSelectAlert(alert.id, e)}
                        className="mt-1 p-1 text-text-dim hover:text-accent-green cursor-pointer shrink-0 transition-colors"
                        title={isSelected ? 'Deseleccionar' : 'Seleccionar'}
                      >
                        {isSelected ? (
                          <CheckSquare size={18} className="text-accent-green" />
                        ) : (
                          <Square size={18} className="text-text-dim group-hover:text-text-muted" />
                        )}
                      </div>

                      {/* Severity Badge */}
                      <div className="mt-1 shrink-0">
                        <SeverityBadge severity={alert.severity} />
                      </div>

                      <div>
                        {/* Title, Badges & Indicators */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="font-bold text-text-main text-base group-hover:text-accent-green transition-colors">
                            {alert.title}
                          </h3>
                          <StatusBadge status={alert.status} />

                          {/* Deduplication Occurrence Badge */}
                          {alert.occurrence_count > 1 && (
                            <span
                              className="px-2 py-0.5 rounded-full bg-accent-purple/15 border border-accent-purple/40 text-accent-purple text-xs font-mono font-bold"
                              title={`Deduplicada: El evento ha ocurrido ${alert.occurrence_count} veces sin resolver`}
                            >
                              x{alert.occurrence_count}
                            </span>
                          )}

                          {/* Anti-Flapping Pulsing Badge */}
                          {alert.is_flapping && (
                            <span
                              className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-accent-red/15 border border-accent-red/40 text-accent-red text-xs font-semibold animate-pulse"
                              title={`Anti-Flapping: ${alert.flapping_count || 3} cambios de estado en 15m. Severidad auto-escalada.`}
                            >
                              <Activity size={12} />
                              Flapping ({alert.flapping_count || 3})
                            </span>
                          )}

                          {/* Snoozed Badge */}
                          {snoozed && (
                            <span
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-medium"
                              title={`Silenciada hasta ${new Date(alert.snoozed_until!).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
                            >
                              <Moon size={11} />
                              Silenciada
                            </span>
                          )}

                          {/* Auto-Resolved Badge */}
                          {alert.auto_resolved && (
                            <span
                              className="px-2 py-0.5 rounded-full bg-accent-green/10 border border-accent-green/30 text-accent-green text-[11px] font-medium"
                              title="Auto-mitigada automáticamente al recuperarse el servicio"
                            >
                              Auto-Mitigada
                            </span>
                          )}
                        </div>

                        {/* Message */}
                        <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed line-clamp-2">
                          {alert.message}
                        </p>

                        {/* Timestamps & Module Route Link */}
                        <div className="flex items-center gap-3 text-xs font-mono text-text-dim mt-2 flex-wrap">
                          <span className="flex items-center gap-1 text-[11px]">
                            <Clock size={12} />
                            Inicio: {new Date(alert.triggered_at).toLocaleString('es-ES')}
                          </span>

                          {alert.last_seen_at && alert.last_seen_at !== alert.triggered_at && (
                            <>
                              <span>•</span>
                              <span className="text-[11px] text-text-dim">
                                Último: {new Date(alert.last_seen_at).toLocaleTimeString('es-ES')}
                              </span>
                            </>
                          )}

                          <span>•</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(getModuleRoute(alert.target_type));
                            }}
                            className="flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium hover:underline cursor-pointer"
                            title="Ir al módulo de monitoreo"
                          >
                            <span>Módulo: {getModuleName(alert.target_type)}</span>
                            <ExternalLink size={10} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div
                      className="flex items-center gap-2 self-end md:self-center shrink-0 flex-wrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Inspect Button */}
                      <button
                        type="button"
                        onClick={() => setSelectedAlert(alert)}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors cursor-pointer"
                        title="Inspeccionar diagnóstico RCA y cronología"
                      >
                        <Eye size={15} />
                      </button>

                      {/* Snooze Button */}
                      <button
                        type="button"
                        onClick={() =>
                          setSnoozeTarget({
                            type: 'alert',
                            id: alert.id,
                            name: alert.title,
                            isCurrentlySnoozed: snoozed,
                          })
                        }
                        className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                          snoozed
                            ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25'
                            : 'text-text-dim hover:text-amber-400 hover:bg-amber-500/10'
                        }`}
                        title={snoozed ? 'Configurar / Desactivar silencio' : 'Silenciar alerta'}
                      >
                        <Moon size={15} />
                      </button>

                      {/* Incident Button */}
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
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-full text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                          title="Elevar esta alerta a Incidente"
                        >
                          <Flame size={13} />
                          Crear Incidente
                        </button>
                      )}

                      {/* Acknowledge Button */}
                      {alert.status === 'active' && (
                        <button
                          type="button"
                          onClick={() =>
                            updateAlertStatusMutation.mutate({ id: alert.id, status: 'acknowledged' })
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-yellow/10 border border-accent-yellow/30 text-accent-yellow hover:bg-accent-yellow hover:text-black rounded-full text-xs font-semibold transition-all cursor-pointer"
                          title="Reconocer alerta"
                        >
                          <Eye size={13} />
                          Reconocer
                        </button>
                      )}

                      {/* Resolve Button */}
                      {alert.status !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() =>
                            updateAlertStatusMutation.mutate({ id: alert.id, status: 'resolved' })
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-black rounded-full text-xs font-semibold transition-all cursor-pointer"
                          title="Marcar como resuelta"
                        >
                          <CheckCircle size={13} />
                          Resolver
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table / List View */
            <AlertTableView
              alerts={filteredAlerts}
              selectedIds={selectedAlertIds}
              onToggleSelect={handleToggleSelectAlert}
              onSelectAll={handleSelectAllVisible}
              onSelectAlert={(alert) => setSelectedAlert(alert)}
              onSnooze={(alert, e) => {
                e.stopPropagation();
                setSnoozeTarget({
                  type: 'alert',
                  id: alert.id,
                  name: alert.title,
                  isCurrentlySnoozed: isItemSnoozed(alert.snoozed_until),
                });
              }}
              onCreateIncident={(id, e) => {
                e.stopPropagation();
                createIncidentMutation.mutate(id);
              }}
              onAcknowledge={(id, e) => {
                e.stopPropagation();
                updateAlertStatusMutation.mutate({ id, status: 'acknowledged' });
              }}
              onResolve={(id, e) => {
                e.stopPropagation();
                updateAlertStatusMutation.mutate({ id, status: 'resolved' });
              }}
              isCreatingIncident={createIncidentMutation.isPending}
            />
          )
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
          viewMode === 'grid' ? (
            /* Cards View for Rules */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRules.map((rule: AlertRule) => {
                const ruleSnoozed = isItemSnoozed(rule.snoozed_until);

                return (
                  <div
                    key={rule.id}
                    className="bg-bg-card/95 border border-border-base/70 rounded-2xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between group shadow-sm"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h3 className="font-bold text-text-main text-base group-hover:text-accent-green transition-colors line-clamp-1">
                          {rule.name}
                        </h3>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {ruleSnoozed && (
                            <span
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-medium"
                              title={`Silenciada hasta ${new Date(rule.snoozed_until!).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
                            >
                              <Moon size={10} />
                              Mute
                            </span>
                          )}
                          <SeverityBadge severity={rule.severity} />
                        </div>
                      </div>

                      <div className="space-y-2 text-xs font-mono text-text-muted bg-bg-dark/50 rounded-xl p-3 border border-border-base/40 font-sans">
                        <div className="flex justify-between border-b border-border-base/40 pb-1.5">
                          <span className="text-text-dim font-medium">Condición:</span>
                          <span className="text-accent-green font-mono font-bold truncate max-w-[160px]">
                            {rule.condition} ({rule.threshold})
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-border-base/40 pb-1.5">
                          <span className="text-text-dim font-medium">Módulo:</span>
                          <span className="text-text-main font-semibold capitalize">
                            {getModuleName(rule.target_type)}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-border-base/40 pb-1.5">
                          <span className="text-text-dim font-medium">Auto-Resolución:</span>
                          <span className="font-semibold">
                            {rule.auto_resolve ? (
                              <span className="text-accent-green">Activada</span>
                            ) : (
                              <span className="text-text-dim">Manual</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-dim font-medium">Cooldown / Estado:</span>
                          <span className="font-semibold flex items-center gap-1.5">
                            <span className="text-sky-400 font-mono">{rule.cooldown_minutes || 5}m</span>
                            <span>•</span>
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
                        {/* Rule Snooze Button */}
                        <button
                          type="button"
                          onClick={() =>
                            setSnoozeTarget({
                              type: 'rule',
                              id: rule.id,
                              name: rule.name,
                              isCurrentlySnoozed: ruleSnoozed,
                            })
                          }
                          className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                            ruleSnoozed
                              ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25'
                              : 'text-text-dim hover:text-amber-400 hover:bg-amber-500/10'
                          }`}
                          title={ruleSnoozed ? 'Desactivar silencio' : 'Silenciar regla (Mute)'}
                        >
                          <Moon size={14} />
                        </button>

                        {/* Edit Rule */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditRule(rule)}
                          className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors cursor-pointer"
                          title="Editar regla"
                        >
                          <Pencil size={14} />
                        </button>

                        {/* Delete Rule */}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(rule)}
                          className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors cursor-pointer"
                          title="Eliminar regla"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table / List View for Rules */
            <AlertRuleTableView
              rules={filteredRules}
              onEdit={handleOpenEditRule}
              onDelete={(rule) => setDeleteTarget(rule)}
              onSnooze={(rule) =>
                setSnoozeTarget({
                  type: 'rule',
                  id: rule.id,
                  name: rule.name,
                  isCurrentlySnoozed: isItemSnoozed(rule.snoozed_until),
                })
              }
            />
          )
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

      {/* 7. SLIDE-OVER NOCDRAWER FOR ALERT INSPECTION */}
      {selectedAlert && (
        <NOCDrawer
          isOpen={!!selectedAlert}
          onClose={() => setSelectedAlert(null)}
          title={selectedAlert.title}
          subtitle={`ID: ${selectedAlert.id} • Módulo: ${getModuleName(selectedAlert.target_type)}`}
          statusBadge={
            <div className="flex items-center gap-1.5 flex-wrap">
              <SeverityBadge severity={selectedAlert.severity} />
              <StatusBadge status={selectedAlert.status} />
              {selectedAlert.occurrence_count > 1 && (
                <span className="px-2 py-0.5 rounded-full bg-accent-purple/15 border border-accent-purple/40 text-accent-purple text-xs font-mono font-bold">
                  x{selectedAlert.occurrence_count}
                </span>
              )}
              {selectedAlert.is_flapping && (
                <span className="px-2 py-0.5 rounded-full bg-accent-red/15 border border-accent-red/40 text-accent-red text-xs font-semibold animate-pulse">
                  Flapping
                </span>
              )}
            </div>
          }
          tabs={[
            { id: 'rca', label: 'Causa Raíz (RCA)', icon: <ShieldAlert size={14} /> },
            { id: 'timeline', label: 'Cronología & MTTR', icon: <Clock size={14} /> },
            { id: 'actions', label: 'Acciones & Silencio', icon: <Zap size={14} /> },
          ]}
          activeTab={drawerTab}
          onTabChange={(tab) => setDrawerTab(tab as any)}
          headerActions={
            <button
              type="button"
              onClick={() => {
                navigate(getModuleRoute(selectedAlert.target_type));
                setSelectedAlert(null);
              }}
              className="flex items-center gap-1 px-3 py-1 bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 rounded-full text-xs font-medium transition-all cursor-pointer"
              title="Abrir módulo de origen en pantalla completa"
            >
              <span>Ver Módulo</span>
              <ExternalLink size={12} />
            </button>
          }
          footerActions={
            <div className="flex items-center justify-between w-full">
              <div className="text-xs text-text-dim font-mono">
                Sentinel Smart Alerts v2
              </div>
              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
                className="px-4 py-2 rounded-full border border-border-base bg-bg-dark text-text-muted hover:text-text-main text-xs font-medium transition-colors cursor-pointer"
              >
                Cerrar Panel
              </button>
            </div>
          }
        >
          {/* TAB 1: RCA & CAUSA RAÍZ */}
          {drawerTab === 'rca' && (
            <div className="space-y-4 font-sans text-sm">
              {/* Target & Route Header */}
              <div className="bg-bg-dark/60 border border-border-base/60 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-text-dim block mb-0.5">Módulo de Origen</span>
                  <span className="text-base font-bold text-text-main flex items-center gap-2">
                    {getModuleName(selectedAlert.target_type)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigate(getModuleRoute(selectedAlert.target_type));
                    setSelectedAlert(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/10 border border-accent-green/40 text-accent-green hover:bg-accent-green/20 rounded-full text-xs font-semibold transition-all cursor-pointer"
                >
                  <span>Inspeccionar en {getModuleName(selectedAlert.target_type)}</span>
                  <ExternalLink size={12} />
                </button>
              </div>

              {/* Message Details */}
              <div className="bg-bg-dark/60 border border-border-base/60 rounded-2xl p-4 space-y-2">
                <span className="text-xs text-text-dim uppercase font-semibold tracking-wider block">
                  Descripción del Incidente / Infracción
                </span>
                <p className="text-text-main text-sm leading-relaxed font-sans">
                  {selectedAlert.message}
                </p>
              </div>

              {/* Anti-Flapping Evaluation */}
              <div
                className={`rounded-2xl p-4 border space-y-2 ${
                  selectedAlert.is_flapping
                    ? 'bg-rose-500/10 border-rose-500/30'
                    : 'bg-bg-dark/60 border-border-base/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Activity
                    size={16}
                    className={selectedAlert.is_flapping ? 'text-accent-red animate-pulse' : 'text-accent-green'}
                  />
                  <span
                    className={`font-semibold text-xs ${
                      selectedAlert.is_flapping ? 'text-accent-red' : 'text-text-main'
                    }`}
                  >
                    Análisis de Estabilidad & Anti-Flapping
                  </span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  {selectedAlert.is_flapping
                    ? `Oscilación rápida detectada: Se han registrado ${selectedAlert.flapping_count || 3} cambios de estado en menos de 15 minutos. El motor inteligente ha escalado la severidad a Crítica para evitar fatiga de alertas.`
                    : 'Comportamiento de servicio estable. No se registran oscilaciones rápidas ni flapping en la ventana reciente.'}
                </p>
              </div>

              {/* Deduplication & Occurrences */}
              <div className="bg-bg-dark/60 border border-border-base/60 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-text-dim block mb-0.5">Deduplicación de Eventos</span>
                  <span className="text-xs text-text-muted">
                    Impactos continuos registrados sin resolución
                  </span>
                </div>
                <span className="px-3 py-1 rounded-full bg-accent-purple/15 border border-accent-purple/40 text-accent-purple font-mono font-bold text-sm">
                  {selectedAlert.occurrence_count || 1} impactos
                </span>
              </div>

              {/* Telemetry / Metadata Attributes */}
              {selectedAlert.metadata && Object.keys(selectedAlert.metadata).length > 0 && (
                <div className="bg-bg-dark/60 border border-border-base/60 rounded-2xl p-4 space-y-3">
                  <span className="text-xs text-text-dim uppercase font-semibold tracking-wider block">
                    Telemetría & Metadatos del Objetivo
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    {Object.entries(selectedAlert.metadata).map(([key, val]) => (
                      <div
                        key={key}
                        className="bg-bg-card/70 border border-border-base/40 rounded-xl p-2.5"
                      >
                        <span className="text-text-dim block text-[10px] uppercase truncate">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span className="text-accent-green font-semibold truncate block mt-0.5">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TIMELINE & MTTR */}
          {drawerTab === 'timeline' && (
            <div className="space-y-5 font-sans">
              {/* Stepper Timeline */}
              <div className="relative pl-6 space-y-6 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-[2px] before:bg-border-base">
                {/* 1. Triggered At */}
                <div className="relative">
                  <div className="absolute -left-[29px] top-1 w-4 h-4 rounded-full bg-accent-red border-4 border-bg-card" />
                  <div>
                    <span className="text-xs font-mono text-text-dim block">
                      {new Date(selectedAlert.triggered_at).toLocaleString('es-ES')}
                    </span>
                    <h4 className="text-sm font-bold text-text-main mt-0.5">
                      Disparo Inicial de la Alerta (Tiempo Cero)
                    </h4>
                    <p className="text-xs text-text-muted mt-1">
                      El objetivo superó el umbral configurado por primera vez. Preservado para cálculo de MTTR exacto.
                    </p>
                  </div>
                </div>

                {/* 2. Last Seen At */}
                {selectedAlert.last_seen_at && (
                  <div className="relative">
                    <div className="absolute -left-[29px] top-1 w-4 h-4 rounded-full bg-accent-yellow border-4 border-bg-card" />
                    <div>
                      <span className="text-xs font-mono text-text-dim block">
                        {new Date(selectedAlert.last_seen_at).toLocaleString('es-ES')}
                      </span>
                      <h4 className="text-sm font-bold text-text-main mt-0.5">
                        Última Detección Activa
                      </h4>
                      <p className="text-xs text-text-muted mt-1">
                        Monitoreo recurrente confirmó la persistencia del fallo (ocurrencia #{selectedAlert.occurrence_count || 1}).
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. Snoozed (if applicable) */}
                {isItemSnoozed(selectedAlert.snoozed_until) && (
                  <div className="relative">
                    <div className="absolute -left-[29px] top-1 w-4 h-4 rounded-full bg-amber-400 border-4 border-bg-card" />
                    <div>
                      <span className="text-xs font-mono text-amber-400 block">
                        Hasta: {new Date(selectedAlert.snoozed_until!).toLocaleString('es-ES')}
                      </span>
                      <h4 className="text-sm font-bold text-amber-400 mt-0.5">
                        Silenciado Activo (Mute)
                      </h4>
                      <p className="text-xs text-text-muted mt-1">
                        Las notificaciones a canales externos se encuentran pausadas temporalmente.
                      </p>
                    </div>
                  </div>
                )}

                {/* 4. Resolved At */}
                {selectedAlert.resolved_at ? (
                  <div className="relative">
                    <div className="absolute -left-[29px] top-1 w-4 h-4 rounded-full bg-accent-green border-4 border-bg-card" />
                    <div>
                      <span className="text-xs font-mono text-accent-green block">
                        {new Date(selectedAlert.resolved_at).toLocaleString('es-ES')}
                      </span>
                      <h4 className="text-sm font-bold text-accent-green mt-0.5">
                        {selectedAlert.auto_resolved
                          ? 'Auto-Mitigada por Recuperación de Servicio'
                          : 'Alerta Marcada como Resuelta'}
                      </h4>
                      <p className="text-xs text-text-muted mt-1">
                        El servicio volvió al rango normal de operación o fue resuelta por el operador.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute -left-[29px] top-1 w-4 h-4 rounded-full bg-border-base border-4 border-bg-card" />
                    <div>
                      <span className="text-xs font-mono text-text-dim block">Actualmente Abierta</span>
                      <h4 className="text-sm font-bold text-text-dim mt-0.5">Pendiente de Mitigación</h4>
                    </div>
                  </div>
                )}
              </div>

              {/* Incident Duration Card */}
              <div className="bg-bg-dark/60 border border-border-base/60 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-text-dim block mb-0.5">Duración del Evento</span>
                  <span className="text-xs text-text-muted">
                    {selectedAlert.resolved_at ? 'Tiempo total de resolución' : 'Tiempo transcurrido activa'}
                  </span>
                </div>
                <span className="text-base font-bold font-mono text-sky-400">
                  {(() => {
                    const start = new Date(selectedAlert.triggered_at).getTime();
                    const end = selectedAlert.resolved_at
                      ? new Date(selectedAlert.resolved_at).getTime()
                      : Date.now();
                    const diffMinutes = Math.max(1, Math.round((end - start) / 60000));
                    if (diffMinutes < 60) return `${diffMinutes} min`;
                    const hours = Math.floor(diffMinutes / 60);
                    const mins = diffMinutes % 60;
                    return `${hours}h ${mins}m`;
                  })()}
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: ACTIONS & SNOOZE */}
          {drawerTab === 'actions' && (
            <div className="space-y-4 font-sans">
              {/* Incident Elevation */}
              <div className="bg-bg-dark/60 border border-border-base/60 rounded-2xl p-4 space-y-3">
                <span className="text-xs text-text-dim uppercase font-semibold tracking-wider block">
                  Elevación a Incidente Formal
                </span>
                {selectedAlert.incident_id ? (
                  <div className="flex items-center gap-2 p-3 bg-accent-red/10 border border-accent-red/30 rounded-xl text-accent-red text-xs font-semibold">
                    <Flame size={15} />
                    <span>Incidente #{selectedAlert.incident_id}: {selectedAlert.incident_title || 'Vinculado'}</span>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-text-muted mb-3">
                      Crea un expediente de incidente formal con asignación de responsables y bitácora de seguimiento.
                    </p>
                    <button
                      type="button"
                      onClick={() => createIncidentMutation.mutate(selectedAlert.id)}
                      disabled={createIncidentMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent-red text-white font-semibold rounded-full text-xs hover:bg-accent-red/90 transition-all shadow-md shadow-accent-red/20 disabled:opacity-50 cursor-pointer"
                    >
                      <Flame size={14} />
                      <span>{createIncidentMutation.isPending ? 'Creando...' : 'Elevar a Incidente'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Smart Snooze / Mute */}
              <div className="bg-bg-dark/60 border border-border-base/60 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-dim uppercase font-semibold tracking-wider">
                    Silenciado Inteligente (Snooze)
                  </span>
                  {isItemSnoozed(selectedAlert.snoozed_until) && (
                    <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
                      <Moon size={11} />
                      Activo hasta {new Date(selectedAlert.snoozed_until!).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  Pausa temporalmente las notificaciones a canales externos (Email, Slack, Telegram) para este objetivo durante trabajos de mantenimiento.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[30, 60, 240, 1440].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() =>
                        snoozeAlertMutation.mutate({ id: selectedAlert.id, minutes: mins })
                      }
                      disabled={snoozeAlertMutation.isPending}
                      className="px-3 py-2 bg-bg-card border border-border-base hover:border-amber-400/50 text-text-main hover:text-amber-400 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer"
                    >
                      {mins === 30 ? '30m' : mins === 60 ? '1 hora' : mins === 240 ? '4 horas' : '24 horas'}
                    </button>
                  ))}
                </div>

                {isItemSnoozed(selectedAlert.snoozed_until) && (
                  <button
                    type="button"
                    onClick={() =>
                      snoozeAlertMutation.mutate({ id: selectedAlert.id, minutes: 0 })
                    }
                    disabled={snoozeAlertMutation.isPending}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 border border-border-base bg-bg-card text-text-muted hover:text-text-main rounded-xl text-xs font-medium transition-all cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Reanudar Notificaciones (Quitar Silencio)</span>
                  </button>
                )}
              </div>

              {/* Status Actions */}
              <div className="bg-bg-dark/60 border border-border-base/60 rounded-2xl p-4 space-y-3">
                <span className="text-xs text-text-dim uppercase font-semibold tracking-wider block">
                  Cambio Manual de Estado
                </span>
                <div className="flex gap-2">
                  {selectedAlert.status === 'active' && (
                    <button
                      type="button"
                      onClick={() =>
                        updateAlertStatusMutation.mutate({
                          id: selectedAlert.id,
                          status: 'acknowledged',
                        })
                      }
                      disabled={updateAlertStatusMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-accent-yellow/15 border border-accent-yellow/40 text-accent-yellow hover:bg-accent-yellow/25 rounded-full text-xs font-semibold transition-all cursor-pointer"
                    >
                      <Eye size={14} />
                      <span>Reconocer Alerta</span>
                    </button>
                  )}

                  {selectedAlert.status !== 'resolved' && (
                    <button
                      type="button"
                      onClick={() =>
                        updateAlertStatusMutation.mutate({
                          id: selectedAlert.id,
                          status: 'resolved',
                        })
                      }
                      disabled={updateAlertStatusMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-accent-green/15 border border-accent-green/40 text-accent-green hover:bg-accent-green/25 rounded-full text-xs font-semibold transition-all cursor-pointer"
                    >
                      <CheckCircle size={14} />
                      <span>Marcar como Resuelta</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </NOCDrawer>
      )}

      {/* 8. SNOOZE MODAL DIALOG */}
      {snoozeTarget && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-bg-card border border-border-base rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-amber-400">
                <Moon size={20} />
                <h3 className="text-base font-bold text-text-main font-sans">
                  Silenciar Notificaciones (Snooze)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSnoozeTarget(null)}
                className="p-1 text-text-dim hover:text-text-main rounded-full cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Silenciar pausa las alertas enviadas a canales externos para{' '}
              <strong className="text-text-main">{snoozeTarget.name}</strong>. Seguirá visible en el NOC para trazabilidad.
            </p>

            <div className="space-y-2">
              <label className="text-xs text-text-dim font-medium">Periodo de Silencio:</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '30 Minutos', mins: 30 },
                  { label: '1 Hora', mins: 60 },
                  { label: '4 Horas', mins: 240 },
                  { label: '24 Horas', mins: 1440 },
                ].map((item) => (
                  <button
                    key={item.mins}
                    type="button"
                    onClick={() => setSnoozeMinutes(item.mins)}
                    className={`py-2 px-3 rounded-xl border text-xs font-mono font-medium transition-all cursor-pointer ${
                      snoozeMinutes === item.mins
                        ? 'bg-amber-500/20 border-amber-500/60 text-amber-400 font-bold'
                        : 'bg-bg-dark border-border-base text-text-muted hover:text-text-main'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border-base/50">
              {snoozeTarget.isCurrentlySnoozed ? (
                <button
                  type="button"
                  onClick={() => {
                    setSnoozeMinutes(0);
                    if (snoozeTarget.type === 'alert' && snoozeTarget.id) {
                      snoozeAlertMutation.mutate({ id: snoozeTarget.id, minutes: 0 });
                    } else if (snoozeTarget.type === 'rule' && snoozeTarget.id) {
                      snoozeRuleMutation.mutate({ id: snoozeTarget.id, minutes: 0 });
                    }
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 underline cursor-pointer"
                >
                  Quitar Silencio
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSnoozeTarget(null)}
                  className="px-4 py-2 rounded-full border border-border-base bg-bg-dark text-text-muted hover:text-text-main text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSnooze}
                  className="px-5 py-2 rounded-full bg-amber-500 text-black font-semibold text-xs hover:bg-amber-400 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  Confirmar Silencio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. CREATE / EDIT RULE MODAL */}
      {showRuleModal && (
        <AlertRuleForm
          rule={editingRule}
          onSubmit={handleRuleSubmit}
          onClose={handleCloseRuleModal}
        />
      )}

      {/* 10. DELETE CONFIRMATION MODAL */}
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
