import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { MonitoringTarget, CreateTargetData } from '../types/monitoring';
import TargetCard from '../components/monitoring/TargetCard';
import TargetForm from '../components/monitoring/TargetForm';
import ChecksList from '../components/monitoring/ChecksList';
import { Plus, Loader2, ArrowLeft, Trash2, TrendingUp } from 'lucide-react';

export default function MonitoringPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<MonitoringTarget | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<MonitoringTarget | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MonitoringTarget | null>(null);

  const { data: targets, isLoading } = useQuery({
    queryKey: ['monitoring-targets'],
    queryFn: async () => {
      const response = await api.get('/monitoring-targets/');
      return response.data?.data || [];
    },
    refetchInterval: 30000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateTargetData) => {
      await api.post('/monitoring-targets/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateTargetData }) => {
      await api.patch(`/monitoring-targets/${id}/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/monitoring-targets/${id}/`);
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

        <ChecksList targetId={selectedTarget.id} />
      </div>
    );
  }

  // List view
  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Uptime & Latencia</h1>
          <p className="text-text-muted text-sm mt-1">
            Monitorea la disponibilidad y tiempo de respuesta de tus servicios
          </p>
        </div>
        <button
          onClick={handleNewTarget}
          className="flex items-center gap-2 bg-accent-green text-black font-semibold px-4 py-2 rounded-md text-sm hover:opacity-90 transition-opacity"
        >
          <Plus size={18} />
          Nuevo Target
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : targets && targets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {targets.map((target: MonitoringTarget) => (
            <TargetCard
              key={target.id}
              target={target}
              onEdit={handleEdit}
              onDelete={handleDelete}
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