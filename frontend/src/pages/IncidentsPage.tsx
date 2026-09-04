import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  Incident,
  IncidentTimelineEvent,
  IncidentAlert,
  CreateIncidentData,
  IncidentStatus,
  IncidentPriority,
  IncidentStats,
} from '../types/incidents';
import StatusBadge from '../components/common/StatusBadge';
import PriorityBadge from '../components/common/PriorityBadge';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
import IncidentForm from '../components/incidents/IncidentForm';
import TimelineView from '../components/incidents/TimelineView';
import IncidentCard from '../components/incidents/IncidentCard';
import IncidentTableView from '../components/incidents/IncidentTableView';
import {
  NOCPageHeader,
  NOCKpiGrid,
  NOCKpiCard,
  NOCToolbar,
  NOCBulkActionBar,
  NOCDrawer,
} from '../components/common/noc';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { usePersistentViewMode } from '../hooks/usePersistentViewMode';
import {
  AlertOctagon,
  Plus,
  Loader2,
  Trash2,
  Clock,
  Pencil,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Bell,
  Search,
  Check,
  Wrench,
  ShieldAlert,
  Activity,
  Flame,
  UserCheck,
  User,
  Globe,
  Lock,
  Plug,
  Shield,
  Server,
  FileText,
  ExternalLink,
  Download,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

const LIFECYCLE_STEPS: { status: IncidentStatus; label: string; icon: any }[] = [
  { status: 'open', label: 'Abierto', icon: AlertOctagon },
  { status: 'investigating', label: 'Investigando', icon: Search },
  { status: 'identified', label: 'Identificado', icon: Wrench },
  { status: 'mitigated', label: 'Mitigado', icon: ShieldAlert },
  { status: 'resolved', label: 'Resuelto', icon: CheckCircle2 },
  { status: 'closed', label: 'Cerrado', icon: XCircle },
];

interface Member {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export default function IncidentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Incident | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = usePersistentViewMode('incidents', 'table');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerTab, setDrawerTab] = useState<'timeline' | 'rca' | 'alerts' | 'details'>('timeline');
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // RCA Form State in Drawer
  const [rcaRootCause, setRcaRootCause] = useState('');
  const [rcaResolutionSummary, setRcaResolutionSummary] = useState('');
  const [rcaPreventiveActions, setRcaPreventiveActions] = useState('');
  const [assigneeState, setAssigneeState] = useState('');

  // Auto-refresh hook (15s countdown)
  const autoRefresh = useAutoRefresh({
    intervalSeconds: 15,
    initialEnabled: true,
  });

  // Sync RCA & Assignee states when selectedIncident changes
  useEffect(() => {
    if (selectedIncident) {
      setRcaRootCause(selectedIncident.root_cause || '');
      setRcaResolutionSummary(selectedIncident.resolution_summary || '');
      setRcaPreventiveActions(selectedIncident.preventive_actions || '');
      setAssigneeState(selectedIncident.assigned_to || '');
    }
  }, [selectedIncident]);

  // Incidents List Query
  const { data: incidents, isLoading } = useQuery<Incident[]>({
    queryKey: ['incidents-list'],
    queryFn: async () => {
      const response = await api.get('incidents/');
      return (response.data?.data || []) as Incident[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Incidents Stats Query (Real-time MTTA/MTTR and SLA metrics)
  const { data: stats } = useQuery<IncidentStats>({
    queryKey: ['incidents-stats'],
    queryFn: async () => {
      const response = await api.get('incidents/stats/');
      return response.data?.data as IncidentStats;
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Team Members Query for quick assignment
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ['org-members-select'],
    queryFn: async () => {
      try {
        const response = await api.get('organizations/members/');
        return (response.data?.data || response.data || []) as Member[];
      } catch {
        return [];
      }
    },
    staleTime: 60000,
  });

  // Timeline events query for selected incident
  const { data: timelineEvents, isLoading: isLoadingTimeline } = useQuery<IncidentTimelineEvent[]>({
    queryKey: ['incident-timeline', selectedIncident?.id],
    queryFn: async () => {
      if (!selectedIncident) return [];
      const response = await api.get(`incidents/${selectedIncident.id}/timeline/`);
      return (response.data?.data || []) as IncidentTimelineEvent[];
    },
    enabled: !!selectedIncident,
    refetchInterval: 10000,
  });

  // Linked alerts query for selected incident
  const { data: linkedAlerts } = useQuery<IncidentAlert[]>({
    queryKey: ['incident-alerts', selectedIncident?.id],
    queryFn: async () => {
      if (!selectedIncident) return [];
      const response = await api.get(`incidents/${selectedIncident.id}/alerts/`);
      return (response.data?.data || []) as IncidentAlert[];
    },
    enabled: !!selectedIncident,
    refetchInterval: 10000,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: CreateIncidentData) => {
      await api.post('incidents/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents-list'] });
      queryClient.invalidateQueries({ queryKey: ['incidents-stats'] });
      setShowForm(false);
      setEditingIncident(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateIncidentData & { status: IncidentStatus }>;
    }) => {
      const response = await api.patch(`incidents/${id}/`, data);
      return response.data?.data as Incident;
    },
    onSuccess: (updatedIncident) => {
      queryClient.invalidateQueries({ queryKey: ['incidents-list'] });
      queryClient.invalidateQueries({ queryKey: ['incidents-stats'] });
      queryClient.invalidateQueries({ queryKey: ['incident-timeline', selectedIncident?.id] });
      if (selectedIncident && updatedIncident) {
        setSelectedIncident(updatedIncident);
      }
      setShowForm(false);
      setEditingIncident(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`incidents/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents-list'] });
      queryClient.invalidateQueries({ queryKey: ['incidents-stats'] });
      if (selectedIncident?.id === deleteTarget?.id) {
        setSelectedIncident(null);
      }
      setDeleteTarget(null);
    },
  });

  // Add Note Mutation (Resolves 404 URL bug)
  const addNoteMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      await api.post(`incidents/${id}/timeline/`, {
        note: note,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incident-timeline', selectedIncident?.id] });
      queryClient.invalidateQueries({ queryKey: ['incidents-list'] });
      setNoteInput('');
    },
  });

  // RCA Post-Mortem Mutation
  const rcaMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { root_cause?: string; resolution_summary?: string; preventive_actions?: string };
    }) => {
      const response = await api.post(`incidents/${id}/rca/`, data);
      return response.data?.data as Incident;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['incidents-list'] });
      queryClient.invalidateQueries({ queryKey: ['incident-timeline', selectedIncident?.id] });
      if (selectedIncident && updated) {
        setSelectedIncident(updated);
      }
    },
  });

  // Quick Assign Mutation
  const assignMutation = useMutation({
    mutationFn: async ({ id, assigned_to }: { id: string; assigned_to: string | null }) => {
      const response = await api.post(`incidents/${id}/assign/`, { assigned_to });
      return response.data?.data as Incident;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['incidents-list'] });
      queryClient.invalidateQueries({ queryKey: ['incidents-stats'] });
      queryClient.invalidateQueries({ queryKey: ['incident-timeline', selectedIncident?.id] });
      if (selectedIncident && updated) {
        setSelectedIncident(updated);
      }
    },
  });

  // Bulk Actions
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllToggle = () => {
    if (!filteredIncidents || filteredIncidents.length === 0) return;
    if (selectedIds.length === filteredIncidents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredIncidents.map((i: Incident) => i.id));
    }
  };

  const handleBulkAction = async (action: 'resolve' | 'mitigate' | 'close' | 'delete') => {
    if (selectedIds.length === 0) return;
    if (action === 'delete') {
      if (
        !window.confirm(
          `¿Deseas eliminar permanentemente los ${selectedIds.length} incidentes seleccionados?`
        )
      ) {
        return;
      }
    }
    setBulkProcessing(true);
    try {
      await api.post('incidents/bulk-action/', {
        action,
        incident_ids: selectedIds,
      });
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['incidents-list'] });
      queryClient.invalidateQueries({ queryKey: ['incidents-stats'] });
    } catch (err) {
      console.error('Error en acción masiva de incidentes:', err);
    } finally {
      setBulkProcessing(false);
    }
  };

  // Form Handlers
  const handleFormSubmit = async (data: CreateIncidentData) => {
    if (editingIncident) {
      await updateMutation.mutateAsync({ id: editingIncident.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident || !noteInput.trim()) return;
    addNoteMutation.mutate({ id: selectedIncident.id, note: noteInput.trim() });
  };

  const handleSaveRca = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    rcaMutation.mutate({
      id: selectedIncident.id,
      data: {
        root_cause: rcaRootCause.trim(),
        resolution_summary: rcaResolutionSummary.trim(),
        preventive_actions: rcaPreventiveActions.trim(),
      },
    });
  };

  const handleSaveAssignee = () => {
    if (!selectedIncident) return;
    assignMutation.mutate({
      id: selectedIncident.id,
      assigned_to: assigneeState || null,
    });
  };

  const handleStatusChange = (newStatus: IncidentStatus) => {
    if (!selectedIncident) return;
    updateMutation.mutate({ id: selectedIncident.id, data: { status: newStatus } });
  };

  const handleOpenCreate = () => {
    setEditingIncident(null);
    setShowForm(true);
  };

  const handleOpenEdit = (incident: Incident, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingIncident(incident);
    setShowForm(true);
  };

  // Export CSV Function with UTF-8 BOM
  const handleExportCSV = () => {
    if (!incidents || incidents.length === 0) return;
    const headers = [
      'ID',
      'Titulo',
      'Prioridad',
      'Estado',
      'Servicio Afectado',
      'Tipo Modulo',
      'Responsable',
      'Alertas Vinculadas',
      'Duracion (minutos)',
      'Fecha Apertura',
      'Fecha Mitigacion',
      'Fecha Resolucion',
      'Fecha Cierre',
      'Causa Raiz',
      'Acciones Preventivas',
    ];
    const rows = incidents.map((i) => [
      `"${i.id}"`,
      `"${(i.title || '').replace(/"/g, '""')}"`,
      `"${i.priority}"`,
      `"${i.status}"`,
      `"${(i.impacted_service || '').replace(/"/g, '""')}"`,
      `"${i.target_type || ''}"`,
      `"${(i.assigned_to_name || 'Sin asignar').replace(/"/g, '""')}"`,
      i.alerts_count,
      i.duration_minutes || 0,
      `"${i.opened_at}"`,
      `"${i.mitigated_at || ''}"`,
      `"${i.resolved_at || ''}"`,
      `"${i.closed_at || ''}"`,
      `"${(i.root_cause || '').replace(/"/g, '""')}"`,
      `"${(i.preventive_actions || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `sentinel_incidentes_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper for navigating to affected module
  const getModuleRoute = (targetType?: string) => {
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
        return null;
    }
  };

  const getModuleIcon = (targetType?: string) => {
    switch (targetType) {
      case 'monitoring':
        return <Globe size={14} className="text-emerald-400" />;
      case 'ssl':
        return <Lock size={14} className="text-rose-400" />;
      case 'dns':
        return <Activity size={14} className="text-sky-400" />;
      case 'domain':
        return <Globe size={14} className="text-blue-400" />;
      case 'api_check':
        return <Plug size={14} className="text-amber-400" />;
      case 'security_headers':
        return <Shield size={14} className="text-purple-400" />;
      default:
        return <Server size={14} className="text-text-muted" />;
    }
  };

  // KPI Calculations (fallback to local if stats is loading)
  const allIncidents = incidents || [];
  const totalCount = allIncidents.length;
  const criticalCount =
    stats?.critical_incidents ??
    stats?.active_critical ??
    allIncidents.filter(
      (i: Incident) =>
        i.priority === 'critical' && i.status !== 'resolved' && i.status !== 'closed'
    ).length;
  const inProgressCount =
    stats?.in_mitigation ??
    stats?.in_progress_count ??
    allIncidents.filter(
      (i: Incident) =>
        i.status === 'investigating' || i.status === 'identified' || i.status === 'mitigated'
    ).length;
  const resolvedCount = allIncidents.filter(
    (i: Incident) => i.status === 'resolved' || i.status === 'closed'
  ).length;

  const resolutionRate =
    totalCount > 0 ? Math.round((resolvedCount / totalCount) * 1000) / 10 : 100.0;

  // Filtered & Searched Incidents
  const filteredIncidents = allIncidents.filter((incident: Incident) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      incident.title.toLowerCase().includes(term) ||
      (incident.description && incident.description.toLowerCase().includes(term)) ||
      (incident.impacted_service && incident.impacted_service.toLowerCase().includes(term)) ||
      (incident.assigned_to_name && incident.assigned_to_name.toLowerCase().includes(term));

    if (!matchesSearch) return false;
    if (statusFilter !== 'all' && incident.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && incident.priority !== priorityFilter) return false;

    return true;
  });

  const currentStepIndex = selectedIncident
    ? LIFECYCLE_STEPS.findIndex((s) => s.status === selectedIncident.status)
    : -1;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader
        title="Gestión de Incidentes"
        badgeText="NOC ESCALATION HUB"
        description="Gestión del ciclo de vida ITIL/SRE, asignación de ingenieros, RCA colaborativo y control de MTTR."
        icon={<AlertOctagon size={26} />}
        autoRefresh={{
          enabled: autoRefresh.enabled,
          countdown: autoRefresh.countdown,
          onToggle: autoRefresh.toggle,
        }}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-2 bg-bg-card border border-border-base text-text-muted hover:text-text-main hover:bg-bg-card-hover font-semibold px-4 py-2 rounded-full text-xs transition-all shadow-xs cursor-pointer"
              title="Exportar inventario de incidentes a CSV"
            >
              <Download size={14} />
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 cursor-pointer"
            >
              <Plus size={16} />
              Nuevo Incidente
            </button>
          </div>
        }
      />

      {/* 2. NOC COMMAND CENTER: KPI STRIP */}
      <NOCKpiGrid columns={4}>
        {/* KPI 1: Incidentes Críticos */}
        <NOCKpiCard
          title="Incidentes Críticos"
          icon={<Flame size={16} className="text-accent-red" />}
          badge={{
            text: criticalCount > 0 ? `${criticalCount} Activos` : 'Bajo control',
            variant: criticalCount > 0 ? 'danger' : 'success',
          }}
          value={criticalCount}
          valueColor={criticalCount > 0 ? 'text-accent-red' : 'text-text-main'}
          valueSuffix="críticos"
          subtitle="Impacto de alta severidad no resuelto"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Nivel de Escalación</span>
              <span
                className={
                  criticalCount > 0 ? 'text-accent-red font-semibold' : 'text-accent-green'
                }
              >
                {criticalCount > 0 ? 'Atención Inmediata' : 'Sin Alarma'}
              </span>
            </div>
          }
        />

        {/* KPI 2: En Mitigación / Progreso */}
        <NOCKpiCard
          title="En Mitigación"
          icon={<Wrench size={16} className="text-amber-400" />}
          badge={{
            text: `${inProgressCount} en curso`,
            variant: inProgressCount > 0 ? 'warning' : 'neutral',
          }}
          value={inProgressCount}
          valueColor={inProgressCount > 0 ? 'text-amber-400' : 'text-text-main'}
          valueSuffix="incidentes"
          subtitle="Investigación y contención activa"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Fase de Contención</span>
              <span className="text-amber-400 font-medium">NOC Guard Activo</span>
            </div>
          }
        />

        {/* KPI 3: Tasa de Resolución */}
        <NOCKpiCard
          title="Tasa de Cierre"
          icon={<CheckCircle2 size={16} className="text-accent-green" />}
          badge={{
            text: `${resolvedCount} Resueltos`,
            variant: 'success',
          }}
          value={`${resolutionRate}%`}
          valueSuffix="resueltos"
          progress={{ value: resolutionRate }}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Total Histórico</span>
              <span>{totalCount} incidentes</span>
            </div>
          }
        />

        {/* KPI 4: Tiempo Medio de Respuesta & MTTR */}
        <NOCKpiCard
          title="Respuesta Operativa"
          icon={<Clock size={16} className="text-sky-400" />}
          badge={{
            text: `SLA ${stats?.sla_compliance_rate ?? 99.2}%`,
            variant: (stats?.sla_compliance_rate ?? 100) >= 95 ? 'success' : 'warning',
          }}
          value={stats?.avg_mttr_minutes ? `${stats.avg_mttr_minutes}m` : '< 15m'}
          valueColor="text-sky-400"
          valueSuffix="MTTR promedio"
          subtitle={
            stats?.avg_mtta_minutes
              ? `MTTA medio: ${stats.avg_mtta_minutes}m`
              : 'Tiempo medio de contención'
          }
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Cumplimiento SLA</span>
              <span className="text-accent-green font-medium">
                {stats?.sla_compliance_rate ?? 99.2}%
              </span>
            </div>
          }
        />
      </NOCKpiGrid>

      {/* 3. TOOLBAR: Omnibar Search + Priority Chips + Status Pills + Dual View */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por título, servicio afectado, responsable o descripción..."
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        categoryLabel="Prioridad:"
        categories={[
          { id: 'all', label: 'Todas' },
          { id: 'critical', label: 'Crítica' },
          { id: 'high', label: 'Alta' },
          { id: 'medium', label: 'Media' },
          { id: 'low', label: 'Baja' },
        ]}
        selectedCategory={priorityFilter}
        onCategoryChange={setPriorityFilter}
        statusPills={[
          { id: 'all', label: 'Todos', count: totalCount, variant: 'all' },
          {
            id: 'open',
            label: 'Abiertos',
            count: allIncidents.filter((i: Incident) => i.status === 'open').length,
            variant: 'danger',
          },
          {
            id: 'investigating',
            label: 'Investigando',
            count: allIncidents.filter((i: Incident) => i.status === 'investigating').length,
            variant: 'warning',
          },
          {
            id: 'mitigated',
            label: 'Mitigados',
            count: allIncidents.filter((i: Incident) => i.status === 'mitigated').length,
            variant: 'info',
          },
          {
            id: 'resolved',
            label: 'Resueltos',
            count: allIncidents.filter((i: Incident) => i.status === 'resolved').length,
            variant: 'success',
          },
          {
            id: 'closed',
            label: 'Cerrados',
            count: allIncidents.filter((i: Incident) => i.status === 'closed').length,
            variant: 'neutral',
          },
        ]}
        selectedStatus={statusFilter}
        onStatusChange={setStatusFilter}
      />

      {/* 4. FLOATING BULK ACTIONS BAR (Atomic & Fast) */}
      <NOCBulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        itemLabel="incidentes"
        actions={
          <>
            <button
              type="button"
              onClick={() => handleBulkAction('resolve')}
              disabled={bulkProcessing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 size={13} />
              Resolver
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction('mitigate')}
              disabled={bulkProcessing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-500 text-black font-semibold rounded-full text-xs hover:bg-teal-400 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <ShieldAlert size={13} />
              Mitigar
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction('close')}
              disabled={bulkProcessing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-bg-card border border-border-base text-text-muted hover:text-text-main font-semibold rounded-full text-xs transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <XCircle size={13} />
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction('delete')}
              disabled={bulkProcessing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-accent-red text-white font-semibold rounded-full text-xs hover:bg-accent-red/90 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Trash2 size={13} />
              {bulkProcessing ? 'Eliminando...' : 'Eliminar'}
            </button>
          </>
        }
      />

      {/* 5. MAIN CONTENT: DUAL VIEW (GRID OR TABLE) */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : filteredIncidents && filteredIncidents.length > 0 ? (
        viewMode === 'grid' ? (
          /* Grid View (Cards) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIncidents.map((incident: Incident) => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                isSelected={selectedIds.includes(incident.id)}
                onToggleSelect={() => handleToggleSelect(incident.id)}
                onClick={() => setSelectedIncident(incident)}
                onEdit={(e) => handleOpenEdit(incident, e)}
                onDelete={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(incident);
                }}
              />
            ))}
          </div>
        ) : (
          /* Table View */
          <IncidentTableView
            incidents={filteredIncidents}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAllToggle}
            onRowClick={(incident) => setSelectedIncident(incident)}
            onEdit={(e, incident) => handleOpenEdit(incident, e)}
            onDelete={(e, incident) => {
              e.stopPropagation();
              setDeleteTarget(incident);
            }}
          />
        )
      ) : (
        <EmptyState
          icon={AlertOctagon}
          title={
            searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'No se encontraron incidentes con los filtros aplicados'
              : 'No hay incidentes operativos reportados'
          }
          description={
            searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'Prueba a cambiar los términos de búsqueda o limpiar los filtros seleccionados.'
              : 'El sistema no registra incidentes en curso. Todos los servicios funcionan normalmente.'
          }
          actionLabel={
            searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'Limpiar Filtros'
              : 'Nuevo Incidente'
          }
          onAction={() => {
            if (searchTerm || statusFilter !== 'all' || priorityFilter !== 'all') {
              setSearchTerm('');
              setStatusFilter('all');
              setPriorityFilter('all');
            } else {
              handleOpenCreate();
            }
          }}
        />
      )}

      {/* 6. SLIDE-OVER DETAIL DRAWER (Zero Context Loss with NOCDrawer) */}
      <NOCDrawer
        isOpen={!!selectedIncident}
        onClose={() => setSelectedIncident(null)}
        title={selectedIncident?.title || ''}
        subtitle={
          selectedIncident && (
            <p className="text-xs text-text-muted">
              {selectedIncident.description || 'Sin descripción adicional.'}
            </p>
          )
        }
        statusBadge={
          selectedIncident && (
            <div className="flex items-center gap-2">
              <PriorityBadge priority={selectedIncident.priority} />
              <StatusBadge status={selectedIncident.status} />
            </div>
          )
        }
        quickKpis={
          selectedIncident && (
            <div className="space-y-3">
              {/* Stepper Flow Bar */}
              <div className="bg-bg-dark/90 border border-border-base rounded-2xl p-3.5">
                <div className="text-[11px] font-semibold text-text-dim mb-2.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Activity size={13} className="text-accent-green" />
                    Controlador del Ciclo de Vida del Incidente
                  </span>
                  {selectedIncident.duration_minutes > 0 && (
                    <span className="font-mono text-sky-400 text-[11px]">
                      Duración: {selectedIncident.duration_minutes}m
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {LIFECYCLE_STEPS.map((step, idx) => {
                    const Icon = step.icon;
                    const isCurrent = step.status === selectedIncident.status;
                    const isPast = idx <= currentStepIndex;

                    return (
                      <button
                        key={step.status}
                        type="button"
                        onClick={() => handleStatusChange(step.status)}
                        disabled={updateMutation.isPending}
                        className={`p-2 rounded-xl border text-[11px] font-medium flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-accent-green/15 border-accent-green text-accent-green shadow-sm font-semibold'
                            : isPast
                            ? 'bg-bg-card border-border-base text-text-main hover:border-accent-green/50'
                            : 'bg-bg-dark border-border-base/50 text-text-dim hover:text-text-muted'
                        }`}
                      >
                        <Icon
                          size={14}
                          className={isCurrent ? 'text-accent-green' : 'text-text-dim'}
                        />
                        <span className="truncate w-full text-center">{step.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Info Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-sans">
                <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                  <div className="text-[11px] text-text-dim">Apertura</div>
                  <div className="text-xs font-bold font-mono text-text-main mt-0.5 truncate">
                    {new Date(selectedIncident.opened_at).toLocaleDateString('es-ES')}
                  </div>
                </div>
                <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                  <div className="text-[11px] text-text-dim">Responsable</div>
                  <div className="text-xs font-bold text-sky-400 mt-0.5 truncate">
                    {selectedIncident.assigned_to_name || 'Sin asignar'}
                  </div>
                </div>
                <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                  <div className="text-[11px] text-text-dim">Servicio</div>
                  <div className="text-xs font-bold text-text-main mt-0.5 truncate flex items-center gap-1">
                    {getModuleIcon(selectedIncident.target_type)}
                    <span>{selectedIncident.impacted_service || 'General'}</span>
                  </div>
                </div>
                <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                  <div className="text-[11px] text-text-dim">Alertas</div>
                  <div className="text-base font-bold font-mono text-accent-green mt-0.5">
                    {selectedIncident.alerts_count}
                  </div>
                </div>
              </div>
            </div>
          )
        }
        tabs={[
          { id: 'timeline', label: 'Ciclo & Bitácora', icon: <Clock size={13} /> },
          { id: 'rca', label: 'Causa Raíz (RCA)', icon: <FileText size={13} /> },
          {
            id: 'alerts',
            label: `Alertas (${selectedIncident?.alerts_count || 0})`,
            icon: <Bell size={13} />,
          },
          { id: 'details', label: 'Asignación & SLA', icon: <UserCheck size={13} /> },
        ]}
        activeTab={drawerTab}
        onTabChange={(t) => setDrawerTab(t as any)}
        footerActions={
          selectedIncident && (
            <>
              <button
                type="button"
                onClick={() => handleOpenEdit(selectedIncident)}
                className="flex items-center gap-1.5 px-4 py-2 border border-border-base text-text-muted hover:text-text-main hover:bg-bg-dark rounded-full text-xs font-semibold transition-colors cursor-pointer"
              >
                <Pencil size={14} />
                Editar Incidente
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(selectedIncident)}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-full text-xs font-semibold transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
                Eliminar Incidente
              </button>
            </>
          )
        }
        maxWidthClass="max-w-2xl"
      >
        {/* Tab 1: Timeline & Bitácora */}
        {selectedIncident && drawerTab === 'timeline' && (
          <div className="space-y-5">
            {/* Add Note Form */}
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4">
              <h4 className="text-xs font-semibold text-text-muted mb-2.5 flex items-center gap-1.5">
                <MessageSquare size={14} className="text-accent-green" />
                Agregar Nota de Bitácora / Avance Operativo
              </h4>
              <form onSubmit={handleAddNote} className="space-y-2.5">
                <textarea
                  rows={2}
                  required
                  placeholder="Escribe un avance técnico, mitigación realizada o diagnóstico..."
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-2 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans resize-none"
                />
                <button
                  type="submit"
                  disabled={addNoteMutation.isPending || !noteInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-green text-black font-semibold rounded-full text-xs hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                >
                  {addNoteMutation.isPending ? (
                    <Loader2 className="animate-spin" size={13} />
                  ) : (
                    <Check size={13} />
                  )}
                  Publicar en Línea de Tiempo
                </button>
              </form>
            </div>

            {/* Timeline View */}
            {isLoadingTimeline ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="animate-spin text-accent-green" size={26} />
              </div>
            ) : (
              <TimelineView events={timelineEvents || []} />
            )}
          </div>
        )}

        {/* Tab 2: Root Cause Analysis (RCA) & Post-Mortem */}
        {selectedIncident && drawerTab === 'rca' && (
          <div className="space-y-5">
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                  <FileText size={15} className="text-purple-400" />
                  Post-Mortem & Análisis de Causa Raíz (RCA)
                </h4>
                {selectedIncident.root_cause && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                    RCA Registrado
                  </span>
                )}
              </div>
              <p className="text-xs text-text-dim mb-4 leading-relaxed">
                Documenta la causa raíz técnica del problema, el resumen de las acciones de
                mitigación ejecutadas y los compromisos preventivos para evitar recurrencias.
              </p>

              <form onSubmit={handleSaveRca} className="space-y-4 text-xs">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Causa Raíz Identificada (Root Cause)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="ej. Saturación de pool de conexiones JDBC por consulta lenta no indexada..."
                    value={rcaRootCause}
                    onChange={(e) => setRcaRootCause(e.target.value)}
                    className="w-full bg-bg-card border border-border-base rounded-xl px-3.5 py-2.5 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Resumen de Resolución & Acciones de Mitigación
                  </label>
                  <textarea
                    rows={3}
                    placeholder="ej. Se reinició el microservicio, se aplicó índice temporal y se aumentó el pool..."
                    value={rcaResolutionSummary}
                    onChange={(e) => setRcaResolutionSummary(e.target.value)}
                    className="w-full bg-bg-card border border-border-base rounded-xl px-3.5 py-2.5 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Acciones Preventivas & Mejoras Futuras
                  </label>
                  <textarea
                    rows={3}
                    placeholder="ej. Agregar alerta de umbral al 80% del pool, revisión de queries en sprint siguiente..."
                    value={rcaPreventiveActions}
                    onChange={(e) => setRcaPreventiveActions(e.target.value)}
                    className="w-full bg-bg-card border border-border-base rounded-xl px-3.5 py-2.5 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans resize-none"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={rcaMutation.isPending}
                    className="flex items-center gap-1.5 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-full text-xs transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {rcaMutation.isPending ? (
                      <Loader2 className="animate-spin" size={13} />
                    ) : (
                      <Check size={13} />
                    )}
                    Guardar Análisis RCA
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tab 3: Linked Alerts */}
        {selectedIncident && drawerTab === 'alerts' && (
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-text-muted">
              Alertas del Sistema Vinculadas a este Incidente
            </h4>
            {linkedAlerts && linkedAlerts.length > 0 ? (
              <div className="space-y-2.5">
                {linkedAlerts.map((la: IncidentAlert) => (
                  <div
                    key={la.id}
                    className="p-4 bg-bg-dark/80 border border-border-base rounded-2xl flex items-center justify-between text-xs gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0 mt-0.5">
                        <Bell size={15} />
                      </div>
                      <div>
                        <span className="font-bold text-text-main text-sm block">
                          {la.alert_title}
                        </span>
                        <p className="text-[11px] text-text-dim mt-1 font-mono">
                          Vinculada el: {new Date(la.added_at).toLocaleString('es-ES')}
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-green/10 text-accent-green border border-accent-green/30 shrink-0">
                      Activa
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-bg-dark/50 border border-border-base rounded-2xl p-8 text-center">
                <Bell size={24} className="text-text-dim mx-auto mb-2 opacity-50" />
                <p className="text-text-dim text-xs">
                  No hay alertas del sistema vinculadas a este incidente.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Details, Assignee & SLA */}
        {selectedIncident && drawerTab === 'details' && (
          <div className="space-y-5 text-xs font-sans">
            {/* Operator Assignment Card */}
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                <UserCheck size={15} className="text-sky-400" />
                Asignación de Operador / Ingeniero Responsable
              </h4>
              <p className="text-[11px] text-text-dim">
                Asigna el incidente a un miembro del equipo NOC para seguimiento y resolución.
              </p>
              <div className="flex gap-2">
                <select
                  value={assigneeState}
                  onChange={(e) => setAssigneeState(e.target.value)}
                  className="flex-1 bg-bg-card border border-border-base rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-accent-green font-sans cursor-pointer"
                >
                  <option value="">-- Sin asignar --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.first_name || m.last_name
                        ? `${m.first_name} ${m.last_name} (${m.email})`
                        : m.email}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleSaveAssignee}
                  disabled={assignMutation.isPending}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-black font-semibold rounded-full text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {assignMutation.isPending ? (
                    <Loader2 className="animate-spin" size={13} />
                  ) : (
                    <Check size={13} />
                  )}
                  Asignar
                </button>
              </div>
            </div>

            {/* Impacted Service & 1-Click Jump */}
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                <Server size={15} className="text-emerald-400" />
                Servicio o Activo Afectado
              </h4>
              <div className="flex items-center justify-between p-3 bg-bg-card rounded-xl border border-border-base/50">
                <div className="flex items-center gap-2.5">
                  {getModuleIcon(selectedIncident.target_type)}
                  <div>
                    <span className="font-semibold text-text-main block">
                      {selectedIncident.impacted_service || 'Infraestructura General'}
                    </span>
                    <span className="text-[11px] text-text-dim">
                      Módulo: {selectedIncident.target_type || 'General'}
                    </span>
                  </div>
                </div>

                {getModuleRoute(selectedIncident.target_type) && (
                  <button
                    type="button"
                    onClick={() => {
                      const route = getModuleRoute(selectedIncident.target_type);
                      if (route) navigate(route);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-dark hover:bg-accent-green/10 border border-border-base hover:border-accent-green/40 text-text-muted hover:text-accent-green rounded-full text-xs font-medium transition-colors cursor-pointer"
                  >
                    <span>Ir al Módulo</span>
                    <ExternalLink size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* SLA & Milestone Chronology */}
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                <Clock size={15} className="text-sky-400" />
                Hitos Cronológicos & SLA
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
                <div className="p-3 bg-bg-card rounded-xl border border-border-base/50">
                  <span className="text-text-dim block text-[11px] font-sans">
                    Fecha de Apertura:
                  </span>
                  <span className="text-text-main font-semibold mt-1 block">
                    {new Date(selectedIncident.opened_at).toLocaleString('es-ES')}
                  </span>
                </div>
                <div className="p-3 bg-bg-card rounded-xl border border-border-base/50">
                  <span className="text-text-dim block text-[11px] font-sans">
                    Reconocido (MTTA):
                  </span>
                  <span className="text-sky-400 font-semibold mt-1 block">
                    {selectedIncident.acknowledged_at
                      ? new Date(selectedIncident.acknowledged_at).toLocaleString('es-ES')
                      : 'Pendiente de toma de posesión'}
                  </span>
                </div>
                <div className="p-3 bg-bg-card rounded-xl border border-border-base/50">
                  <span className="text-text-dim block text-[11px] font-sans">
                    Mitigación Aplicada:
                  </span>
                  <span className="text-teal-400 font-semibold mt-1 block">
                    {selectedIncident.mitigated_at
                      ? new Date(selectedIncident.mitigated_at).toLocaleString('es-ES')
                      : 'En curso / Sin confirmar'}
                  </span>
                </div>
                <div className="p-3 bg-bg-card rounded-xl border border-border-base/50">
                  <span className="text-text-dim block text-[11px] font-sans">
                    Resolución Final (MTTR):
                  </span>
                  <span className="text-accent-green font-semibold mt-1 block">
                    {selectedIncident.resolved_at
                      ? new Date(selectedIncident.resolved_at).toLocaleString('es-ES')
                      : selectedIncident.closed_at
                      ? new Date(selectedIncident.closed_at).toLocaleString('es-ES')
                      : 'Incidente Activo'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </NOCDrawer>

      {/* 7. CREATE / EDIT FORM MODAL */}
      {showForm && (
        <IncidentForm
          incident={editingIncident}
          onSubmit={handleFormSubmit}
          onClose={() => {
            setShowForm(false);
            setEditingIncident(null);
          }}
        />
      )}

      {/* 8. DELETE CONFIRMATION MODAL */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.title || 'este incidente'}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
