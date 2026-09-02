import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { MonitoringTarget, CreateTargetData } from '../types/monitoring';
import TargetCard from '../components/monitoring/TargetCard';
import TargetForm from '../components/monitoring/TargetForm';
import ChecksList from '../components/monitoring/ChecksList';
import LatencyChart from '../components/monitoring/LatencyChart';
import SLACard from '../components/monitoring/SLACard';
import { Plus, Loader2, ArrowLeft, Trash2, TrendingUp, RefreshCw, Search, Filter, Calendar } from 'lucide-react';

export default function MonitoringPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<MonitoringTarget | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<MonitoringTarget | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MonitoringTarget | null>(null);

  const [scanningId, setScanningId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'up' | 'down' | 'slow' | 'disabled'>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  const { data: targets, isLoading } = useQuery({
    queryKey: ['monitoring-targets'],
    queryFn: async () => {
      const response = await api.get('/monitoring/');
      return response.data?.data || [];
    },
    refetchInterval: 15000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateTargetData) => {
      await api.post('/monitoring/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateTargetData }) => {
      await api.patch(`/monitoring/${id}/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/monitoring/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets'] });
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (id: string) => {
      setScanningId(id);
      const res = await api.post(`/monitoring/${id}/scan/`);
      return res.data?.data;
    },
    onSuccess: (updatedTarget) => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-checks'] });
      queryClient.invalidateQueries({ queryKey: ['target-checks-chart'] });
      queryClient.invalidateQueries({ queryKey: ['target-uptime-sla'] });
      if (selectedTarget && updatedTarget && selectedTarget.id === updatedTarget.id) {
        setSelectedTarget(updatedTarget);
      }
      setScanningId(null);
    },
    onError: () => {
      setScanningId(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (target: MonitoringTarget) => {
      await api.patch(`/monitoring/${target.id}/`, { enabled: !target.enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets'] });
    },
  });

  const handleExport = async (targetId: string, targetName: string) => {
    try {
      const response = await api.get(`/monitoring/${targetId}/export/`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `monitoring_history_${targetName.replace(/\s+/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error('Error exporting history:', err);
    }
  };

  const { data: maintenanceWindows, refetch: refetchMaintenance } = useQuery({
    queryKey: ['maintenance-windows', selectedTarget?.id],
    queryFn: async () => {
      if (!selectedTarget) return [];
      const res = await api.get(`/monitoring/${selectedTarget.id}/maintenance-windows/`);
      return res.data?.data || [];
    },
    enabled: !!selectedTarget,
  });

  const createMaintenanceMutation = useMutation({
    mutationFn: async (data: { name: string; start_time: string; end_time: string }) => {
      await api.post(`/monitoring/${selectedTarget?.id}/maintenance-windows/`, data);
    },
    onSuccess: () => {
      refetchMaintenance();
    },
  });

  const deleteMaintenanceMutation = useMutation({
    mutationFn: async (windowId: string) => {
      await api.delete(`/monitoring/maintenance-windows/${windowId}/`);
    },
    onSuccess: () => {
      refetchMaintenance();
    },
  });

  const scanAllMutation = useMutation({
    mutationFn: async () => {
      await api.post('/monitoring/scan-all/');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets'] });
    },
  });

  const handleSubmit = async (data: CreateTargetData) => {
    if (editingTarget) {
      await updateMutation.mutateAsync({ id: editingTarget.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleEdit = (target: MonitoringTarget) => {
    setEditingTarget(target);
    setShowForm(true);
  };

  const handleDelete = (target: MonitoringTarget) => {
    setDeleteConfirm(target);
  };

  const confirmDelete = async () => {
    if (deleteConfirm) {
      await deleteMutation.mutateAsync(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const handleNewTarget = () => {
    setEditingTarget(null);
    setShowForm(true);
  };

  // Detail view
  if (selectedTarget) {
    return (
      <div>
        <button
          onClick={() => setSelectedTarget(null)}
          className="flex items-center gap-2 text-text-muted hover:text-text-main transition-colors mb-6 text-sm"
        >
          <ArrowLeft size={18} />
          Volver
        </button>

        <div className="bg-bg-card border border-border-base rounded-xl p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold mb-1">{selectedTarget.name}</h1>
              <p className="text-text-dim font-mono text-sm">{selectedTarget.endpoint}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => scanMutation.mutate(selectedTarget.id)}
                disabled={scanningId === selectedTarget.id}
                className="flex items-center gap-2 bg-accent-green/10 border border-accent-green text-accent-green font-semibold px-3 py-1.5 rounded-lg text-xs hover:bg-accent-green/20 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={14} className={scanningId === selectedTarget.id ? 'animate-spin' : ''} />
                Escanear Ahora
              </button>
              <button
                onClick={() => handleExport(selectedTarget.id, selectedTarget.name)}
                className="bg-accent-blue/10 border border-accent-blue text-accent-blue font-semibold px-3 py-1.5 rounded-lg text-xs hover:bg-accent-blue/20 transition-colors"
              >
                Exportar CSV
              </button>
              <span className="px-3 py-1 rounded-lg text-xs font-mono uppercase bg-accent-green/10 text-accent-green border border-accent-green">
                {selectedTarget.target_type}
              </span>
              <span className={`px-3 py-1 rounded-lg text-xs font-mono border ${
                selectedTarget.enabled
                  ? 'bg-accent-green/10 text-accent-green border-accent-green'
                  : 'bg-gray-500/10 text-gray-400 border-gray-500'
              }`}>
                {selectedTarget.enabled ? 'ACTIVO' : 'INACTIVO'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <div>
              <div className="text-xs text-text-muted uppercase">Intervalo</div>
              <div className="text-lg font-mono font-bold mt-1">{selectedTarget.interval}s</div>
            </div>
            <div>
              <div className="text-xs text-text-muted uppercase">Ultimo Status</div>
              <div className="text-lg font-mono font-bold mt-1">
                {selectedTarget.last_status ? selectedTarget.last_status.toUpperCase() : '-'}
              </div>
            </div>
            <div>
              <div className="text-xs text-text-muted uppercase">Latencia</div>
              <div className="text-lg font-mono font-bold mt-1">
                {selectedTarget.last_latency !== null ? `${selectedTarget.last_latency.toFixed(0)}ms` : '-'}
              </div>
            </div>
            <div>
              <div className="text-xs text-text-muted uppercase">Ultimo Check</div>
              <div className="text-sm font-mono mt-1 text-text-muted">
                {selectedTarget.last_checked_at
                  ? new Date(selectedTarget.last_checked_at).toLocaleString('es-ES', {
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                    })
                  : 'Nunca'}
              </div>
            </div>
          </div>
        </div>

        <SLACard targetId={selectedTarget.id} />

        {/* Maintenance Windows Section */}
        <div className="bg-bg-card border border-border-base rounded-xl p-6 mb-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-border-base pb-4 mb-4">
            <h3 className="font-bold text-text-main text-base flex items-center gap-2">
              <Calendar size={18} className="text-accent-green" />
              Ventanas de Mantenimiento Planificado
            </h3>
            <button
              onClick={() => {
                const name = prompt('Nombre del mantenimiento:');
                if (!name) return;
                const startStr = prompt('Fecha y hora de inicio (YYYY-MM-DD HH:MM):');
                if (!startStr) return;
                const endStr = prompt('Fecha y hora de fin (YYYY-MM-DD HH:MM):');
                if (!endStr) return;
                try {
                  const start_time = new Date(startStr).toISOString();
                  const end_time = new Date(endStr).toISOString();
                  createMaintenanceMutation.mutate({ name, start_time, end_time });
                } catch {
                  alert('Formato de fecha inválido.');
                }
              }}
              className="bg-accent-green text-black px-3 py-1 rounded text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Programar Mantenimiento
            </button>
          </div>

          {maintenanceWindows && maintenanceWindows.length > 0 ? (
            <div className="space-y-3">
              {maintenanceWindows.map((mw: any) => {
                const isCurrent = new Date(mw.start_time) <= new Date() && new Date(mw.end_time) >= new Date();
                return (
                  <div key={mw.id} className="flex justify-between items-center bg-bg-dark border border-border-base p-3 rounded-lg font-mono text-xs">
                    <div>
                      <div className="font-bold text-text-main flex items-center gap-2">
                        {mw.name}
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 bg-accent-yellow/10 text-accent-yellow border border-accent-yellow rounded text-[9px] uppercase">
                            Activo Ahora
                          </span>
                        )}
                      </div>
                      <div className="text-text-dim mt-1">
                        Desde: {new Date(mw.start_time).toLocaleString('es-ES')}
                      </div>
                      <div className="text-text-dim">
                        Hasta: {new Date(mw.end_time).toLocaleString('es-ES')}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteMaintenanceMutation.mutate(mw.id)}
                      className="p-1.5 text-text-muted hover:text-accent-red transition-colors"
                      title="Eliminar mantenimiento"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-text-dim text-xs font-mono">
              No hay ventanas de mantenimiento programadas para este target.
            </div>
          )}
        </div>

        <LatencyChart targetId={selectedTarget.id} />

        <ChecksList targetId={selectedTarget.id} />
      </div>
    );
  }

  const allTags = Array.from(new Set((targets || []).flatMap((t: MonitoringTarget) => t.tags || []))) as string[];

  const filteredTargets = (targets || []).filter((t: MonitoringTarget) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.endpoint.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'up') return t.last_status === 'up';
    if (statusFilter === 'down') return t.last_status === 'down' || t.last_status === 'error';
    if (statusFilter === 'slow') return t.last_status === 'slow';
    if (statusFilter === 'disabled') return !t.enabled;

    if (selectedTag !== 'all' && (!t.tags || !t.tags.includes(selectedTag))) return false;

    return true;
  });

  // List view
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Uptime & Latencia</h1>
          <p className="text-text-muted text-sm mt-1">
            Monitorea la disponibilidad y tiempo de respuesta de tus servicios
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => scanAllMutation.mutate()}
            disabled={scanAllMutation.isPending}
            className="flex items-center gap-2 bg-accent-green/10 border border-accent-green text-accent-green font-semibold px-4 py-2 rounded-md text-sm hover:bg-accent-green/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={scanAllMutation.isPending ? 'animate-spin' : ''} />
            Actualizar Todo
          </button>
          <button
            onClick={handleNewTarget}
            className="flex items-center gap-2 bg-accent-green text-black font-semibold px-4 py-2 rounded-md text-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={18} />
            Nuevo Target
          </button>
        </div>
      </div>

      {/* Search & Status Filter Toolbar */}
      <div className="bg-bg-card border border-border-base rounded-xl p-4 mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-lg">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" size={16} />
          <input
            type="text"
            placeholder="Buscar target por nombre o URL/IP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-bg-dark border border-border-base rounded-lg pl-10 pr-4 py-2 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-mono"
          />
        </div>

        {/* Tag filter selector */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-text-muted">TAG:</span>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="bg-bg-dark border border-border-base rounded px-2.5 py-1.5 text-text-main focus:outline-none focus:border-accent-green cursor-pointer"
            >
              <option value="all">TODOS</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto font-mono text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${
              statusFilter === 'all'
                ? 'bg-accent-green/20 border-accent-green text-accent-green font-bold'
                : 'bg-bg-dark border-border-base text-text-muted hover:text-text-main'
            }`}
          >
            Todos ({targets?.length || 0})
          </button>
          <button
            onClick={() => setStatusFilter('up')}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${
              statusFilter === 'up'
                ? 'bg-accent-green/20 border-accent-green text-accent-green font-bold'
                : 'bg-bg-dark border-border-base text-text-muted hover:text-text-main'
            }`}
          >
            Online ({targets?.filter((t: MonitoringTarget) => t.last_status === 'up').length || 0})
          </button>
          <button
            onClick={() => setStatusFilter('down')}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${
              statusFilter === 'down'
                ? 'bg-accent-red/20 border-accent-red text-accent-red font-bold'
                : 'bg-bg-dark border-border-base text-text-muted hover:text-text-main'
            }`}
          >
            Caídos ({targets?.filter((t: MonitoringTarget) => t.last_status === 'down' || t.last_status === 'error').length || 0})
          </button>
          <button
            onClick={() => setStatusFilter('slow')}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${
              statusFilter === 'slow'
                ? 'bg-accent-yellow/20 border-accent-yellow text-accent-yellow font-bold'
                : 'bg-bg-dark border-border-base text-text-muted hover:text-text-main'
            }`}
          >
            Lentos ({targets?.filter((t: MonitoringTarget) => t.last_status === 'slow').length || 0})
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : filteredTargets && filteredTargets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTargets.map((target: MonitoringTarget) => (
            <TargetCard
              key={target.id}
              target={target}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onScan={(t) => scanMutation.mutate(t.id)}
              onToggle={(t) => toggleMutation.mutate(t)}
              onAlert={() => navigate('/alerts')}
              isScanning={scanningId === target.id}
              onClick={setSelectedTarget}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <TrendingUp className="mx-auto text-text-dim mb-4" size={48} />
          <h3 className="text-lg font-semibold text-text-muted mb-2">No hay targets configurados</h3>
          <p className="text-text-dim text-sm mb-4">Crea tu primer target de monitoreo para empezar</p>
          <button
            onClick={handleNewTarget}
            className="inline-flex items-center gap-2 bg-accent-green text-black font-semibold px-4 py-2 rounded-md text-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={18} />
            Crear Target
          </button>
        </div>
      )}

      {showForm && (
        <TargetForm
          target={editingTarget}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowForm(false);
            setEditingTarget(null);
          }}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div
            className="bg-bg-card border border-border-base rounded-xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-accent-red/10 flex items-center justify-center">
                <Trash2 className="text-accent-red" size={20} />
              </div>
              <h2 className="text-lg font-bold">Eliminar Target</h2>
            </div>
            <p className="text-text-muted text-sm mb-6">
              Seguro que deseas eliminar <strong className="text-text-main">{deleteConfirm.name}</strong>?
              Esta accion no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 border border-border-base rounded-lg text-sm text-text-muted hover:bg-bg-card-hover transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 bg-accent-red text-white font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}