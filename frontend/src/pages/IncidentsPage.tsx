import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  Incident,
  IncidentTimelineEvent,
  IncidentAlert,
  CreateIncidentData,
  IncidentStatus,
  IncidentPriority,
} from '../types/incidents';
import StatusBadge from '../components/common/StatusBadge';
import PriorityBadge from '../components/common/PriorityBadge';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
import IncidentForm from '../components/incidents/IncidentForm';
import TimelineView from '../components/incidents/TimelineView';
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
  RefreshCw,
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
  CheckSquare,
  Square,
  Flame,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';

const LIFECYCLE_STEPS: { status: IncidentStatus; label: string; icon: any }[] = [
  { status: 'open', label: 'Abierto', icon: AlertOctagon },
  { status: 'investigating', label: 'Investigando', icon: Search },
  { status: 'identified', label: 'Identificado', icon: Wrench },
  { status: 'mitigated', label: 'Mitigado', icon: ShieldAlert },
  { status: 'resolved', label: 'Resuelto', icon: CheckCircle2 },
  { status: 'closed', label: 'Cerrado', icon: XCircle },
];

export default function IncidentsPage() {
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
  const [drawerTab, setDrawerTab] = useState<'timeline' | 'alerts' | 'details'>('timeline');
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Auto-refresh hook (15s countdown)
  const autoRefresh = useAutoRefresh({
    intervalSeconds: 15,
    initialEnabled: true,
  });

  // Incidents List Query
  const { data: incidents, isLoading } = useQuery<Incident[]>({
    queryKey: ['incidents-list'],
    queryFn: async () => {
      const response = await api.get('incidents/');
      return (response.data?.data || []) as Incident[];
    },
    refetchInterval: autoRefresh.refetchInterval,
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
      if (selectedIncident?.id === deleteTarget?.id) {
        setSelectedIncident(null);
      }
      setDeleteTarget(null);
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      await api.post(`incidents/${id}/add-timeline-event/`, {
        event_type: 'note',
        description: note,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incident-timeline', selectedIncident?.id] });
      setNoteInput('');
    },
  });

  // Bulk Actions
  const handleToggleSelect = (incident: Incident) => {
    setSelectedIds((prev) =>
      prev.includes(incident.id) ? prev.filter((id) => id !== incident.id) : [...prev, incident.id]
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

  const handleBulkClose = async () => {
    if (selectedIds.length === 0) return;
    setBulkProcessing(true);
    for (const id of selectedIds) {
      try {
        await api.patch(`incidents/${id}/`, { status: 'closed' });
      } catch (err) {
        // Continue
      }
    }
    setSelectedIds([]);
    setBulkProcessing(false);
    queryClient.invalidateQueries({ queryKey: ['incidents-list'] });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `¿Deseas eliminar permanentemente los ${selectedIds.length} incidentes seleccionados?`
      )
    ) {
      return;
    }
    setBulkProcessing(true);
    for (const id of selectedIds) {
      try {
        await api.delete(`incidents/${id}/`);
      } catch (err) {
        // Continue
      }
    }
    setSelectedIds([]);
    setBulkProcessing(false);
    queryClient.invalidateQueries({ queryKey: ['incidents-list'] });
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

  // KPI Calculations
  const allIncidents = incidents || [];
  const totalCount = allIncidents.length;
  const criticalCount = allIncidents.filter(
    (i: Incident) => i.priority === 'critical' && i.status !== 'resolved' && i.status !== 'closed'
  ).length;
  const inProgressCount = allIncidents.filter(
    (i: Incident) =>
      (i.status === 'investigating' || i.status === 'identified' || i.status === 'mitigated')
  ).length;
  const resolvedCount = allIncidents.filter(
    (i: Incident) => i.status === 'resolved' || i.status === 'closed'
  ).length;

  const resolutionRate =
    totalCount > 0 ? Math.round((resolvedCount / totalCount) * 1000) / 10 : 100.0;

  // Filtered & Searched Incidents
  const filteredIncidents = allIncidents.filter((incident: Incident) => {
    const matchesSearch =
      incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (incident.description && incident.description.toLowerCase().includes(searchTerm.toLowerCase()));

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
        badgeText="NOC ESCALATION"
        description="Gestión del ciclo de vida, trazabilidad colaborativa y resolución de incidentes operativos."
        icon={<AlertOctagon size={26} />}
        autoRefresh={{
          enabled: autoRefresh.enabled,
          countdown: autoRefresh.countdown,
          onToggle: autoRefresh.toggle,
        }}
        actions={
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20"
          >
            <Plus size={16} />
            Nuevo Incidente
          </button>
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
              <span className={criticalCount > 0 ? 'text-accent-red font-semibold' : 'text-accent-green'}>
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
              <span>Equipo Asignado</span>
              <span className="text-amber-400 font-medium">NOC Guard</span>
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

        {/* KPI 4: Tiempo Medio de Respuesta */}
        <NOCKpiCard
          title="Respuesta Operativa"
          icon={<Clock size={16} className="text-sky-400" />}
          badge={{
            text: 'SLA Operativo',
            variant: 'info',
          }}
          value="< 15m"
          valueColor="text-sky-400"
          valueSuffix="promedio"
          subtitle="Tiempo medio de contención (MTTR)"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Cumplimiento SLA</span>
              <span className="text-accent-green font-medium">99.2%</span>
            </div>
          }
        />
      </NOCKpiGrid>

      {/* 3. TOOLBAR: Omnibar Search + Priority Chips + Status Pills + Dual View */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por título o descripción del incidente..."
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
        ]}
        selectedStatus={statusFilter}
        onStatusChange={setStatusFilter}
      />

      {/* 4. FLOATING BULK ACTIONS BAR */}
      <NOCBulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        itemLabel="incidentes"
        actions={
          <>
            <button
              type="button"
              onClick={handleBulkClose}
              disabled={bulkProcessing}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-sm disabled:opacity-50"
            >
              <CheckCircle2 size={13} />
              Cerrar Seleccionados
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkProcessing}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-red text-white font-semibold rounded-full text-xs hover:bg-accent-red/90 transition-all shadow-sm disabled:opacity-50"
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
            {filteredIncidents.map((incident: Incident) => {
              const isSelected = selectedIds.includes(incident.id);

              return (
                <div
                  key={incident.id}
                  onClick={() => setSelectedIncident(incident)}
                  className={`bg-bg-card/95 border rounded-2xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between cursor-pointer group shadow-sm relative ${
                    isSelected
                      ? 'border-accent-green bg-accent-green/[0.02] ring-1 ring-accent-green/40'
                      : 'border-border-base/70'
                  }`}
                >
                  <div>
                    {/* Top Row: Checkbox, Badges */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(incident);
                          }}
                          className="text-text-dim hover:text-accent-green transition-colors shrink-0"
                          title={isSelected ? 'Deseleccionar' : 'Seleccionar'}
                        >
                          {isSelected ? (
                            <CheckSquare size={16} className="text-accent-green" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                        <PriorityBadge priority={incident.priority} />
                      </div>
                      <StatusBadge status={incident.status} />
                    </div>

                    {/* Title & Description */}
                    <h3
                      className="font-bold text-text-main text-base group-hover:text-accent-green transition-colors line-clamp-2 mb-2 font-sans"
                      title={incident.title}
                    >
                      {incident.title}
                    </h3>
                    <p className="text-xs text-text-dim line-clamp-2 mb-4 font-sans">
                      {incident.description || 'Sin descripción adicional registrada.'}
                    </p>

                    {/* Quick Metric Box */}
                    <div className="space-y-2 text-xs font-mono text-text-muted bg-bg-dark/50 rounded-xl p-3 border border-border-base/40 font-sans">
                      <div className="flex justify-between border-b border-border-base/40 pb-1.5">
                        <span className="text-text-dim font-medium">Alertas Vinculadas:</span>
                        <span className="text-accent-green font-bold flex items-center gap-1">
                          <Bell size={12} />
                          {incident.alerts_count}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-dim font-medium">Apertura:</span>
                        <span className="text-text-main font-mono text-[11px]">
                          {new Date(incident.opened_at).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="mt-4 pt-3 border-t border-border-base/40 flex items-center justify-between text-xs text-text-dim">
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <Clock size={12} />
                      {new Date(incident.opened_at).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(incident, e)}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors"
                        title="Editar incidente"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(incident);
                        }}
                        className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors"
                        title="Eliminar incidente"
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
          /* Table View */
          <div className="bg-bg-card/95 border border-border-base/70 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead>
                  <tr className="border-b border-border-base text-text-dim text-xs bg-bg-card/50">
                    <th className="py-3 px-3.5 w-10">
                      <button
                        type="button"
                        onClick={handleSelectAllToggle}
                        className="text-text-dim hover:text-accent-green transition-colors"
                        title={
                          selectedIds.length === filteredIncidents.length
                            ? 'Deseleccionar todos'
                            : 'Seleccionar todos'
                        }
                      >
                        {selectedIds.length === filteredIncidents.length ? (
                          <CheckSquare size={16} className="text-accent-green" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4">Incidente</th>
                    <th className="py-3 px-3">Prioridad</th>
                    <th className="py-3 px-3">Estado</th>
                    <th className="py-3 px-3">Alertas</th>
                    <th className="py-3 px-3">Apertura</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-base/40">
                  {filteredIncidents.map((incident: Incident) => {
                    const isSelected = selectedIds.includes(incident.id);

                    return (
                      <tr
                        key={incident.id}
                        onClick={() => setSelectedIncident(incident)}
                        className={`hover:bg-bg-card-hover/80 transition-colors cursor-pointer group ${
                          isSelected ? 'bg-accent-green/[0.03]' : ''
                        }`}
                      >
                        <td
                          className="py-3 px-3.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(incident);
                          }}
                        >
                          <button
                            type="button"
                            className="text-text-dim hover:text-accent-green transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare size={16} className="text-accent-green" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-bold text-text-main group-hover:text-accent-green transition-colors text-sm block">
                            {incident.title}
                          </span>
                          <span className="text-xs text-text-dim truncate max-w-[320px] block">
                            {incident.description || 'Sin descripción'}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <PriorityBadge priority={incident.priority} />
                        </td>

                        <td className="py-3 px-3">
                          <StatusBadge status={incident.status} />
                        </td>

                        <td className="py-3 px-3 font-mono font-bold text-accent-green text-xs">
                          {incident.alerts_count}
                        </td>

                        <td className="py-3 px-3 text-text-dim font-mono text-xs whitespace-nowrap">
                          {new Date(incident.opened_at).toLocaleDateString('es-ES')}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => handleOpenEdit(incident, e)}
                              className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors"
                              title="Editar incidente"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(incident);
                              }}
                              className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors"
                              title="Eliminar incidente"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
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
                <div className="text-[11px] font-semibold text-text-dim mb-2.5 flex items-center gap-1.5">
                  <Activity size={13} className="text-accent-green" />
                  Controlador del Ciclo de Vida del Incidente
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
                        className={`p-2 rounded-xl border text-[11px] font-medium flex flex-col items-center justify-center gap-1 transition-all ${
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-sans">
                <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                  <div className="text-[11px] text-text-dim">Apertura</div>
                  <div className="text-xs font-bold font-mono text-text-main mt-0.5 truncate">
                    {new Date(selectedIncident.opened_at).toLocaleDateString('es-ES')}
                  </div>
                </div>
                <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                  <div className="text-[11px] text-text-dim">Cierre</div>
                  <div className="text-xs font-bold font-mono text-text-main mt-0.5 truncate">
                    {selectedIncident.closed_at
                      ? new Date(selectedIncident.closed_at).toLocaleDateString('es-ES')
                      : 'En curso'}
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
          { id: 'timeline', label: 'Línea de Tiempo & Bitácora', icon: <Clock size={13} /> },
          {
            id: 'alerts',
            label: `Alertas Vinculadas (${selectedIncident?.alerts_count || 0})`,
            icon: <Bell size={13} />,
          },
        ]}
        activeTab={drawerTab}
        onTabChange={(t) => setDrawerTab(t as any)}
        footerActions={
          selectedIncident && (
            <>
              <button
                type="button"
                onClick={() => handleOpenEdit(selectedIncident)}
                className="flex items-center gap-1.5 px-4 py-2 border border-border-base text-text-muted hover:text-text-main hover:bg-bg-dark rounded-full text-xs font-semibold transition-colors"
              >
                <Pencil size={14} />
                Editar Incidente
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(selectedIncident)}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-full text-xs font-semibold transition-colors"
              >
                <Trash2 size={14} />
                Eliminar Incidente
              </button>
            </>
          )
        }
        maxWidthClass="max-w-2xl"
      >
        {selectedIncident && drawerTab === 'timeline' && (
          <div className="space-y-5">
            {/* Add Note Form */}
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4">
              <h4 className="text-xs font-semibold text-text-muted mb-2.5 flex items-center gap-1.5">
                <MessageSquare size={14} className="text-accent-green" />
                Agregar Nota de Bitácora / Avance
              </h4>
              <form onSubmit={handleAddNote} className="space-y-2.5">
                <textarea
                  rows={2}
                  required
                  placeholder="Escribe un avance técnico o resolución preliminar..."
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  className="w-full bg-bg-card border border-border-base rounded-xl px-3 py-2 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans resize-none"
                />
                <button
                  type="submit"
                  disabled={addNoteMutation.isPending || !noteInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-green text-black font-semibold rounded-full text-xs hover:opacity-90 transition-opacity disabled:opacity-50"
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

        {selectedIncident && drawerTab === 'alerts' && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-text-muted">
              Alertas del Sistema Relacionadas con este Incidente
            </h4>
            {linkedAlerts && linkedAlerts.length > 0 ? (
              <div className="space-y-2">
                {linkedAlerts.map((la: IncidentAlert) => (
                  <div
                    key={la.id}
                    className="p-3.5 bg-bg-dark/80 border border-border-base rounded-2xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Bell size={14} className="text-accent-green shrink-0" />
                      <div>
                        <span className="font-bold text-text-main">{la.alert_title}</span>
                        <p className="text-[11px] text-text-dim mt-0.5">
                          {new Date(la.added_at).toLocaleString('es-ES')}
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-green/10 text-accent-green border border-accent-green/30">
                      Vinculada
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-bg-dark/50 border border-border-base rounded-2xl p-8 text-center">
                <p className="text-text-dim text-xs">
                  No hay alertas del sistema vinculadas a este incidente.
                </p>
              </div>
            )}
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
