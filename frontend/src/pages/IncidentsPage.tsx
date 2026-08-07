import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  Incident,
  IncidentTimelineEvent,
  IncidentAlert,
  CreateIncidentData,
  IncidentStatus,
} from '../types/incidents';
import StatusBadge from '../components/common/StatusBadge';
import PriorityBadge from '../components/common/PriorityBadge';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
import IncidentForm from '../components/incidents/IncidentForm';
import TimelineView from '../components/incidents/TimelineView';
import {
  AlertOctagon,
  Plus,
  Loader2,
  Trash2,
  ArrowLeft,
  RefreshCw,
  Clock,
  Pencil,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Bell,
  Search,
  Check,
} from 'lucide-react';

export default function IncidentsPage() {
  const queryClient = useQueryClient();
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Incident | null>(null);
  const [noteInput, setNoteInput] = useState('');

  // Incidents List Query
  const { data: incidents, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['incidents-list'],
    queryFn: async () => {
      const response = await api.get('incidents/');
      return response.data?.data || [];
    },
    refetchInterval: 30000,
  });

  // Timeline events query for selected incident
  const { data: timelineEvents, isLoading: isLoadingTimeline } = useQuery({
    queryKey: ['incident-timeline', selectedIncident?.id],
    queryFn: async () => {
      if (!selectedIncident) return [];
      const response = await api.get(`incidents/${selectedIncident.id}/timeline/`);
      return response.data?.data || [];
    },
    enabled: !!selectedIncident,
    refetchInterval: 10000,
  });

  // Linked alerts query for selected incident
  const { data: linkedAlerts } = useQuery({
    queryKey: ['incident-alerts', selectedIncident?.id],
    queryFn: async () => {
      if (!selectedIncident) return [];
      const response = await api.get(`incidents/${selectedIncident.id}/alerts/`);
      return response.data?.data || [];
    },
    enabled: !!selectedIncident,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: CreateIncidentData) => {
      await api.post('incidents/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents-list'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateIncidentData & { status: IncidentStatus }> }) => {
      const response = await api.patch(`incidents/${id}/`, data);
      return response.data?.data as Incident;
    },
    onSuccess: (updatedIncident) => {
      queryClient.invalidateQueries({ queryKey: ['incidents-list'] });
      queryClient.invalidateQueries({ queryKey: ['incident-timeline', selectedIncident?.id] });
      if (selectedIncident && updatedIncident) {
        setSelectedIncident(updatedIncident);
      }
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
      await api.post(`incidents/${id}/timeline/`, { note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incident-timeline', selectedIncident?.id] });
      setNoteInput('');
    },
  });

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

  // Detail View for an Incident
  if (selectedIncident) {
    return (
      <div>
        <button
          onClick={() => setSelectedIncident(null)}
          className="flex items-center gap-2 text-text-muted hover:text-text-main transition-colors mb-6 text-sm"
        >
          <ArrowLeft size={18} />
          Volver a Incidentes
        </button>

        {/* Incident Header Card */}
        <div className="bg-bg-card border border-border-base rounded-xl p-6 mb-6 shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <PriorityBadge priority={selectedIncident.priority} />
                <h1 className="text-2xl font-bold text-text-main">{selectedIncident.title}</h1>
                <StatusBadge status={selectedIncident.status} />
              </div>
              <p className="text-text-muted text-sm mt-2">{selectedIncident.description || 'Sin descripción adicional.'}</p>
            </div>

            {/* Lifecycle Quick Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {selectedIncident.status === 'open' && (
                <button
                  onClick={() => handleStatusChange('investigating')}
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 bg-accent-yellow/10 border border-accent-yellow/30 text-accent-yellow hover:bg-accent-yellow hover:text-black rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                >
                  <Search size={14} />
                  Investigar (Investigating)
                </button>
              )}

              {(selectedIncident.status === 'open' || selectedIncident.status === 'investigating') && (
                <button
                  onClick={() => handleStatusChange('resolved')}
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-black rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                >
                  <CheckCircle2 size={14} />
                  Resolver (Resolved)
                </button>
              )}

              {selectedIncident.status === 'resolved' && (
                <button
                  onClick={() => handleStatusChange('closed')}
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 bg-bg-dark border border-border-base text-text-muted hover:text-text-main rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                >
                  <XCircle size={14} />
                  Cerrar (Closed)
                </button>
              )}

              <button
                onClick={() => setDeleteTarget(selectedIncident)}
                className="p-2 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-lg text-xs font-semibold transition-colors"
                title="Eliminar incidente"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-border-base text-xs font-mono">
            <div>
              <span className="text-text-dim uppercase">Apertura:</span>
              <div className="text-text-main font-bold mt-1">
                {new Date(selectedIncident.opened_at).toLocaleString('es-ES')}
              </div>
            </div>
            <div>
              <span className="text-text-dim uppercase">Cierre:</span>
              <div className="text-text-main font-bold mt-1">
                {selectedIncident.closed_at
                  ? new Date(selectedIncident.closed_at).toLocaleString('es-ES')
                  : 'En curso'}
              </div>
            </div>
            <div>
              <span className="text-text-dim uppercase">Alertas Vinculadas:</span>
              <div className="text-accent-green font-bold mt-1">
                {selectedIncident.alerts_count} alertas
              </div>
            </div>
          </div>
        </div>

        {/* Content Layout: Timeline + Notes & Linked Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Timeline & Add Note */}
          <div className="lg:col-span-2 space-y-6">
            {/* Add Note Form */}
            <div className="bg-bg-card border border-border-base rounded-xl p-5 shadow-xl">
              <h3 className="text-sm font-bold text-text-main mb-3 flex items-center gap-2 font-mono uppercase">
                <MessageSquare size={16} className="text-accent-green" />
                Agregar Nota de Bitácora / Avance
              </h3>
              <form onSubmit={handleAddNote} className="space-y-3">
                <textarea
                  rows={3}
                  required
                  placeholder="Escribe un avance o notas del análisis técnico..."
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-lg px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans resize-none"
                />
                <button
                  type="submit"
                  disabled={addNoteMutation.isPending || !noteInput.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-accent-green text-black font-semibold rounded-lg text-xs hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {addNoteMutation.isPending ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <Check size={14} />
                  )}
                  Publicar Nota en Timeline
                </button>
              </form>
            </div>

            {/* Timeline Component */}
            <div className="bg-bg-card border border-border-base rounded-xl p-6 shadow-xl">
              <h3 className="text-base font-bold text-text-main mb-6 flex items-center gap-2 border-b border-border-base pb-3">
                <Clock size={18} className="text-accent-green" />
                Línea de Tiempo del Incidente (Timeline)
              </h3>
              {isLoadingTimeline ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-accent-green" size={24} />
                </div>
              ) : (
                <TimelineView events={timelineEvents || []} />
              )}
            </div>
          </div>

          {/* Right Column: Linked Alerts */}
          <div>
            <div className="bg-bg-card border border-border-base rounded-xl p-5 shadow-xl">
              <h3 className="text-sm font-bold text-text-main mb-4 flex items-center gap-2 border-b border-border-base pb-3 font-mono uppercase">
                <Bell size={16} className="text-accent-red" />
                Alertas Asociadas ({linkedAlerts?.length || 0})
              </h3>
              {linkedAlerts && linkedAlerts.length > 0 ? (
                <div className="space-y-3 font-mono text-xs">
                  {linkedAlerts.map((item: IncidentAlert) => (
                    <div
                      key={item.id}
                      className="p-3 bg-bg-dark border border-border-base rounded-lg flex items-center justify-between"
                    >
                      <span className="text-text-muted truncate">ID Alerta: {item.alert_id}</span>
                      <span className="text-text-dim text-[10px]">
                        {new Date(item.added_at).toLocaleTimeString('es-ES')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-text-dim text-xs py-4 font-mono">
                  No hay alertas vinculadas directamente a este incidente.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modals */}
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

        <ConfirmDelete
          isOpen={!!deleteTarget}
          itemName={selectedIncident.title}
          isDeleting={deleteMutation.isPending}
          onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
        />
      </div>
    );
  }

  // Main Incidents List View
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            <AlertOctagon className="text-accent-red" size={28} />
            Gestión de Incidentes
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Centro de control de respuesta a incidentes, gestión de ciclo de vida y línea de tiempo técnica
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-2 border border-border-base rounded-md text-text-muted hover:text-text-main hover:bg-bg-card-hover transition-colors disabled:opacity-50"
            title="Refrescar incidentes"
          >
            <RefreshCw size={18} className={isRefetching ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => {
              setEditingIncident(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 bg-accent-red text-white font-semibold px-4 py-2 rounded-md text-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={18} />
            Nuevo Incidente
          </button>
        </div>
      </div>

      {/* Incidents Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : incidents && incidents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {incidents.map((incident: Incident) => (
            <div
              key={incident.id}
              onClick={() => setSelectedIncident(incident)}
              className="bg-bg-card border border-border-base rounded-xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between cursor-pointer group shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <PriorityBadge priority={incident.priority} />
                  <StatusBadge status={incident.status} />
                </div>

                <h3 className="font-bold text-text-main text-base group-hover:text-accent-green transition-colors mb-2 truncate" title={incident.title}>
                  {incident.title}
                </h3>

                <p className="text-xs text-text-muted line-clamp-2 mb-4">
                  {incident.description || 'Sin descripción.'}
                </p>
              </div>

              <div className="pt-3 border-t border-border-base flex items-center justify-between text-xs text-text-dim font-mono">
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {new Date(incident.opened_at).toLocaleDateString('es-ES')}
                </span>
                <span className="flex items-center gap-1 text-accent-green font-bold">
                  <Bell size={12} />
                  {incident.alerts_count} alertas
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={AlertOctagon}
          title="No hay incidentes registrados"
          description="Genial. El sistema opera normalmente sin incidentes de servicio en curso."
          actionLabel="Nuevo Incidente"
          onAction={() => {
            setEditingIncident(null);
            setShowForm(true);
          }}
        />
      )}

      {/* Form Modal */}
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

      {/* Delete Modal */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.title || ''}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
