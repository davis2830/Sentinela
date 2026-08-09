import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  APICheckTarget,
  APICheckResult,
  CreateAPICheckTargetData,
  APICheckStats,
} from '../types/api_checks';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
import APICheckForm from '../components/api_checks/APICheckForm';
import {
  Plug,
  Plus,
  Loader2,
  Trash2,
  ArrowLeft,
  RefreshCw,
  Clock,
  Pencil,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Zap,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';

type StatusFilterType = 'all' | 'pass' | 'slow' | 'fail';

export default function APIChecksPage() {
  const queryClient = useQueryClient();
  const [selectedTarget, setSelectedTarget] = useState<APICheckTarget | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<APICheckTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<APICheckTarget | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all');

  // Stats query
  const { data: stats } = useQuery({
    queryKey: ['api-check-stats'],
    queryFn: async () => {
      const response = await api.get('api-checks/stats/');
      return (response.data?.data || {}) as APICheckStats;
    },
    refetchInterval: 15000,
  });

  // List targets query
  const { data: targets, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['api-check-targets'],
    queryFn: async () => {
      const response = await api.get('api-checks/');
      return response.data?.data || [];
    },
    refetchInterval: 10000,
  });

  // Target results history query
  const { data: results, isLoading: isLoadingResults } = useQuery({
    queryKey: ['api-check-results', selectedTarget?.id],
    queryFn: async () => {
      if (!selectedTarget) return [];
      const response = await api.get(`api-checks/${selectedTarget.id}/results/`);
      return response.data?.data || [];
    },
    enabled: !!selectedTarget,
    refetchInterval: 15000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateAPICheckTargetData) => {
      await api.post('api-checks/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-check-targets'] });
      queryClient.invalidateQueries({ queryKey: ['api-check-stats'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateAPICheckTargetData }) => {
      await api.patch(`api-checks/${id}/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-check-targets'] });
      queryClient.invalidateQueries({ queryKey: ['api-check-stats'] });
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`api-checks/${id}/scan/`);
      return response.data?.data;
    },
    onSuccess: (updatedTarget) => {
      queryClient.invalidateQueries({ queryKey: ['api-check-targets'] });
      queryClient.invalidateQueries({ queryKey: ['api-check-stats'] });
      queryClient.invalidateQueries({ queryKey: ['api-check-results', selectedTarget?.id] });
      if (selectedTarget && updatedTarget) {
        setSelectedTarget(updatedTarget);
      }
    },
  });

  const scanAllMutation = useMutation({
    mutationFn: async () => {
      await api.post('api-checks/scan-all/');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-check-targets'] });
      queryClient.invalidateQueries({ queryKey: ['api-check-stats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`api-checks/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-check-targets'] });
      queryClient.invalidateQueries({ queryKey: ['api-check-stats'] });
      if (selectedTarget?.id === deleteTarget?.id) {
        setSelectedTarget(null);
      }
      setDeleteTarget(null);
    },
  });

  const handleFormSubmit = async (data: CreateAPICheckTargetData) => {
    if (editingTarget) {
      await updateMutation.mutateAsync({ id: editingTarget.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleOpenCreate = () => {
    setEditingTarget(null);
    setShowForm(true);
  };

  const handleOpenEdit = (target: APICheckTarget, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTarget(target);
    setShowForm(true);
  };

  const filteredTargets = (targets || []).filter((t: APICheckTarget) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pass') return t.last_status === 'pass';
    if (statusFilter === 'slow') return t.last_status === 'slow';
    if (statusFilter === 'fail') return t.last_status === 'fail' || t.last_status === 'error';
    return true;
  });

  // Detail View for an API Check Target
  if (selectedTarget) {
    return (
      <div>
        <button
          onClick={() => setSelectedTarget(null)}
          className="flex items-center gap-2 text-text-muted hover:text-text-main transition-colors mb-6 text-sm"
        >
          <ArrowLeft size={18} />
          Volver a API Endpoints
        </button>

        {/* Target Info Header Card */}
        <div className="bg-bg-card border border-border-base rounded-xl p-6 mb-6 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded-lg text-xs font-mono font-bold uppercase">
                  {selectedTarget.method}
                </span>
                <h1 className="text-2xl font-bold text-text-main font-sans">{selectedTarget.name}</h1>
                <StatusBadge status={selectedTarget.last_status || 'desconocido'} />
              </div>
              <p className="text-text-muted font-mono text-sm mt-2 flex items-center gap-2">
                <span>{selectedTarget.url}</span>
                <a
                  href={selectedTarget.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-green hover:underline flex items-center gap-1 text-xs"
                >
                  <ExternalLink size={12} />
                </a>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => scanMutation.mutate(selectedTarget.id)}
                disabled={scanMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-black rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                title="Ejecutar chequeo HTTP inmediato"
              >
                <RefreshCw size={14} className={scanMutation.isPending ? 'animate-spin' : ''} />
                {scanMutation.isPending ? 'Ejecutando...' : 'Ejecutar Check'}
              </button>
              <button
                onClick={(e) => handleOpenEdit(selectedTarget, e)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-dark border border-border-base text-text-muted hover:text-text-main hover:bg-bg-card-hover rounded-lg text-xs font-semibold transition-colors"
              >
                <Pencil size={16} />
                Editar
              </button>
              <button
                onClick={() => setDeleteTarget(selectedTarget)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-lg text-xs font-semibold transition-colors"
              >
                <Trash2 size={16} />
                Eliminar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border-base text-sm">
            <div>
              <div className="text-xs text-text-muted uppercase font-mono">HTTP Status Esperado</div>
              <div className="text-lg font-mono font-bold mt-1 text-accent-green">
                {selectedTarget.expected_status}
              </div>
            </div>
            <div>
              <div className="text-xs text-text-muted uppercase font-mono">Max Latencia Permitida</div>
              <div className="text-lg font-mono font-bold mt-1 text-text-main">
                {selectedTarget.expected_response_time_ms} ms
              </div>
            </div>
            <div>
              <div className="text-xs text-text-muted uppercase font-mono">Estado Monitoreo</div>
              <div className="text-sm font-mono mt-1 text-text-main">
                {selectedTarget.enabled ? (
                  <span className="text-accent-green font-bold">ACTIVO</span>
                ) : (
                  <span className="text-text-dim">PAUSADO</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-text-muted uppercase font-mono">Última Verificación</div>
              <div className="text-sm font-mono mt-1 text-text-muted">
                {selectedTarget.last_checked_at
                  ? new Date(selectedTarget.last_checked_at).toLocaleString('es-ES')
                  : 'Nunca'}
              </div>
            </div>
          </div>
        </div>

        {/* Results History Table */}
        <div className="bg-bg-card border border-border-base rounded-xl overflow-hidden shadow-xl p-6">
          <h2 className="text-lg font-bold text-text-main mb-4 flex items-center gap-2">
            <Zap size={20} className="text-accent-green" />
            Historial de Ejecuciones & Validaciones API
          </h2>

          {isLoadingResults ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-accent-green" size={28} />
            </div>
          ) : results && results.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border-base bg-bg-dark/50 text-text-muted font-mono text-xs uppercase">
                    <th className="py-3 px-4 font-semibold">Fecha y Hora</th>
                    <th className="py-3 px-4 font-semibold">Estado</th>
                    <th className="py-3 px-4 font-semibold">Status HTTP</th>
                    <th className="py-3 px-4 font-semibold">Latencia</th>
                    <th className="py-3 px-4 font-semibold text-center">JSON Válido</th>
                    <th className="py-3 px-4 font-semibold text-center">Esquema</th>
                    <th className="py-3 px-4 font-semibold text-center">Headers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-base/50 font-mono">
                  {results.map((res: APICheckResult) => (
                    <tr key={res.id} className="hover:bg-bg-card-hover/80 transition-colors">
                      <td className="py-3 px-4 text-text-muted text-xs">
                        <span className="flex items-center gap-1.5">
                          <Clock size={13} className="text-text-dim" />
                          {new Date(res.checked_at).toLocaleString('es-ES')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={res.status} />
                      </td>
                      <td className="py-3 px-4 font-bold text-text-main">
                        {res.http_status ?? 'N/A'}
                      </td>
                      <td className="py-3 px-4 font-bold text-accent-blue">
                        {res.response_time_ms !== null ? `${res.response_time_ms} ms` : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {res.json_valid === true ? (
                          <CheckCircle2 size={16} className="text-accent-green mx-auto" />
                        ) : res.json_valid === false ? (
                          <XCircle size={16} className="text-accent-red mx-auto" />
                        ) : (
                          <span className="text-text-dim text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {res.schema_valid === true ? (
                          <CheckCircle2 size={16} className="text-accent-green mx-auto" />
                        ) : res.schema_valid === false ? (
                          <XCircle size={16} className="text-accent-red mx-auto" />
                        ) : (
                          <span className="text-text-dim text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {res.headers_valid === true ? (
                          <CheckCircle2 size={16} className="text-accent-green mx-auto" />
                        ) : res.headers_valid === false ? (
                          <XCircle size={16} className="text-accent-red mx-auto" />
                        ) : (
                          <span className="text-text-dim text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-text-dim text-sm py-6 text-center font-mono">
              No hay ejecuciones registradas para esta API.
            </p>
          )}
        </div>

        {/* Modals */}
        {showForm && (
          <APICheckForm
            target={editingTarget}
            onSubmit={handleFormSubmit}
            onClose={() => {
              setShowForm(false);
              setEditingTarget(null);
            }}
          />
        )}

        <ConfirmDelete
          isOpen={!!deleteTarget}
          itemName={selectedTarget.name}
          isDeleting={deleteMutation.isPending}
          onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
        />
      </div>
    );
  }

  // Main List View
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            <Plug className="text-accent-green" size={28} />
            API Endpoints Check
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Monitoreo continuo de salud, códigos de respuesta y esquemas JSON para APIs REST
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => scanAllMutation.mutate()}
            disabled={scanAllMutation.isPending}
            className="flex items-center gap-2 bg-accent-green/10 border border-accent-green text-accent-green font-semibold px-3.5 py-2 rounded-md text-sm hover:bg-accent-green/20 transition-colors disabled:opacity-50"
            title="Ejecutar validación de todas las APIs inmediatamente"
          >
            <RefreshCw size={16} className={scanAllMutation.isPending ? 'animate-spin' : ''} />
            Ejecutar Checks Todos
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-accent-green text-black font-semibold px-4 py-2 rounded-md text-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={18} />
            Nuevo API Check
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
          <div className="w-10 h-10 rounded-lg bg-accent-blue/10 flex items-center justify-center text-accent-blue shrink-0">
            <Plug size={20} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-text-muted">Total Monitoreados</p>
            <p className="text-xl font-bold font-mono text-text-main">{stats?.total || 0}</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
          <div className="w-10 h-10 rounded-lg bg-accent-green/10 flex items-center justify-center text-accent-green shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-text-muted">APIs Exitosas (Pass)</p>
            <p className="text-xl font-bold font-mono text-accent-green">{stats?.pass_count || 0}</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
          <div className="w-10 h-10 rounded-lg bg-accent-yellow/10 flex items-center justify-center text-accent-yellow shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-text-muted">APIs Lentas (Slow)</p>
            <p className="text-xl font-bold font-mono text-accent-yellow">{stats?.slow_count || 0}</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
          <div className="w-10 h-10 rounded-lg bg-accent-red/10 flex items-center justify-center text-accent-red shrink-0">
            <ShieldAlert size={20} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-text-muted">Con Fallos / Errores</p>
            <p className="text-xl font-bold font-mono text-accent-red">{stats?.fail_count || 0}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border-base mb-6">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            statusFilter === 'all'
              ? 'border-accent-green text-accent-green font-bold'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          Todos ({stats?.total || 0})
        </button>
        <button
          onClick={() => setStatusFilter('pass')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            statusFilter === 'pass'
              ? 'border-accent-green text-accent-green font-bold'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          <CheckCircle2 size={15} />
          Exitosas ({stats?.pass_count || 0})
        </button>
        <button
          onClick={() => setStatusFilter('slow')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            statusFilter === 'slow'
              ? 'border-accent-yellow text-accent-yellow font-bold'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          <AlertTriangle size={15} />
          Lentas ({stats?.slow_count || 0})
        </button>
        <button
          onClick={() => setStatusFilter('fail')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            statusFilter === 'fail'
              ? 'border-accent-red text-accent-red font-bold'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          <ShieldAlert size={15} />
          Con Fallos ({stats?.fail_count || 0})
        </button>
      </div>

      {/* Targets Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : filteredTargets && filteredTargets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTargets.map((target: APICheckTarget) => (
            <div
              key={target.id}
              onClick={() => setSelectedTarget(target)}
              className="bg-bg-card border border-border-base rounded-xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between cursor-pointer group shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span className="px-2.5 py-1 bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded text-xs font-mono font-bold uppercase shrink-0">
                      {target.method}
                    </span>
                    <h3 className="font-bold text-text-main truncate text-base group-hover:text-accent-green transition-colors" title={target.name}>
                      {target.name}
                    </h3>
                  </div>
                  <StatusBadge status={target.last_status || 'desconocido'} />
                </div>

                <p className="text-xs font-mono text-text-dim truncate mb-4" title={target.url}>
                  {target.url}
                </p>

                <div className="space-y-2 text-xs font-mono text-text-muted">
                  <div className="flex justify-between border-b border-border-base/50 pb-1.5">
                    <span className="text-text-dim">Status Esperado:</span>
                    <span className="text-accent-green font-bold">{target.expected_status}</span>
                  </div>
                  <div className="flex justify-between border-b border-border-base/50 pb-1.5">
                    <span className="text-text-dim">Max Latencia:</span>
                    <span className="text-text-main font-semibold">{target.expected_response_time_ms} ms</span>
                  </div>
                  <div className="flex justify-between pb-1">
                    <span className="text-text-dim">Frecuencia:</span>
                    <span className="text-accent-blue font-bold">Cada {target.check_interval || 60}s</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-border-base flex items-center justify-between text-xs text-text-dim">
                <span className="flex items-center gap-1 font-mono">
                  <Clock size={12} />
                  {target.last_checked_at
                    ? new Date(target.last_checked_at).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Nunca'}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleOpenEdit(target, e)}
                    className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded transition-colors"
                    title="Editar target"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(target);
                    }}
                    className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded transition-colors"
                    title="Eliminar target"
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
          icon={Plug}
          title="No hay API Check targets configurados"
          description="Monitorea tus endpoints REST, códigos de respuesta HTTP y velocidad de respuesta."
          actionLabel="Nuevo API Check"
          onAction={handleOpenCreate}
        />
      )}

      {/* Form Modal */}
      {showForm && (
        <APICheckForm
          target={editingTarget}
          onSubmit={handleFormSubmit}
          onClose={() => {
            setShowForm(false);
            setEditingTarget(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.name || ''}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
