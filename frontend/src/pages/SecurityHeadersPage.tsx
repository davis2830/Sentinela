import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  SecurityHeaderTarget,
  SecurityHeaderResult,
  CreateSecurityHeaderTargetData,
} from '../types/security_headers';
import GradeBadge from '../components/common/GradeBadge';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
import SecurityHeaderForm from '../components/security_headers/SecurityHeaderForm';
import {
  ShieldCheck,
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
  Shield,
  FileCode2,
} from 'lucide-react';

export default function SecurityHeadersPage() {
  const queryClient = useQueryClient();
  const [selectedTarget, setSelectedTarget] = useState<SecurityHeaderTarget | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<SecurityHeaderTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SecurityHeaderTarget | null>(null);

  // Targets query
  const { data: targets, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['security-header-targets'],
    queryFn: async () => {
      const response = await api.get('security-headers/');
      return response.data?.data || [];
    },
    refetchInterval: 30000,
  });

  // Target scan results query
  const { data: results, isLoading: isLoadingResults } = useQuery({
    queryKey: ['security-header-results', selectedTarget?.id],
    queryFn: async () => {
      if (!selectedTarget) return [];
      const response = await api.get(`security-headers/${selectedTarget.id}/results/`);
      return response.data?.data || [];
    },
    enabled: !!selectedTarget,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateSecurityHeaderTargetData) => {
      await api.post('security-headers/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-header-targets'] });
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`security-headers/${id}/scan/`);
      return response.data?.data;
    },
    onSuccess: (updatedTarget) => {
      queryClient.invalidateQueries({ queryKey: ['security-header-targets'] });
      queryClient.invalidateQueries({ queryKey: ['security-header-results', selectedTarget?.id] });
      if (selectedTarget && updatedTarget) {
        setSelectedTarget(updatedTarget);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`security-headers/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-header-targets'] });
      if (selectedTarget?.id === deleteTarget?.id) {
        setSelectedTarget(null);
      }
      setDeleteTarget(null);
    },
  });

  const handleFormSubmit = async (data: CreateSecurityHeaderTargetData) => {
    await createMutation.mutateAsync(data);
  };

  const handleOpenCreate = () => {
    setEditingTarget(null);
    setShowForm(true);
  };

  const handleOpenEdit = (target: SecurityHeaderTarget, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTarget(target);
    setShowForm(true);
  };

  const parseHeadersList = (headers: string[] | Record<string, string> | undefined): string[] => {
    if (!headers) return [];
    if (Array.isArray(headers)) return headers;
    return Object.keys(headers);
  };

  // Latest scan result for selected target
  const latestResult: SecurityHeaderResult | null =
    results && results.length > 0 ? results[0] : null;

  // Detail View
  if (selectedTarget) {
    const foundList = latestResult ? parseHeadersList(latestResult.headers_found) : [];
    const missingList = latestResult ? parseHeadersList(latestResult.headers_missing) : [];

    return (
      <div>
        <button
          onClick={() => setSelectedTarget(null)}
          className="flex items-center gap-2 text-text-muted hover:text-text-main transition-colors mb-6 text-sm"
        >
          <ArrowLeft size={18} />
          Volver a Security Headers
        </button>

        {/* Target Header Card */}
        <div className="bg-bg-card border border-border-base rounded-xl p-6 mb-6 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-3">
                <Shield className="text-accent-green" size={24} />
                <h1 className="text-2xl font-bold text-text-main font-sans">{selectedTarget.name}</h1>
                <GradeBadge
                  grade={latestResult?.grade || null}
                  score={selectedTarget.last_score ?? latestResult?.score ?? null}
                />
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
                title="Escanear cabeceras de seguridad inmediatamente"
              >
                <RefreshCw size={14} className={scanMutation.isPending ? 'animate-spin' : ''} />
                {scanMutation.isPending ? 'Escaneando...' : 'Re-escanear'}
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
        </div>

        {/* Audit Results Content */}
        {isLoadingResults ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-accent-green" size={32} />
          </div>
        ) : latestResult ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Headers Found */}
            <div className="bg-bg-card border border-border-base rounded-xl p-6 shadow-xl">
              <h3 className="text-base font-bold text-text-main mb-4 flex items-center gap-2 border-b border-border-base pb-3">
                <CheckCircle2 size={20} className="text-accent-green" />
                Cabeceras de Seguridad Presentes ({foundList.length})
              </h3>
              {foundList.length > 0 ? (
                <div className="space-y-2.5 font-mono text-xs">
                  {foundList.map((header, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-accent-green/10 border border-accent-green/20 rounded-lg text-accent-green font-bold flex items-center justify-between"
                    >
                      <span>{header}</span>
                      <span className="text-[10px] bg-accent-green/20 px-2 py-0.5 rounded uppercase">
                        Presente
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-text-dim text-sm py-4 font-mono">No se detectó ninguna cabecera de seguridad recomendada.</p>
              )}
            </div>

            {/* Headers Missing */}
            <div className="bg-bg-card border border-border-base rounded-xl p-6 shadow-xl">
              <h3 className="text-base font-bold text-text-main mb-4 flex items-center gap-2 border-b border-border-base pb-3">
                <XCircle size={20} className="text-accent-red" />
                Cabeceras de Seguridad Faltantes ({missingList.length})
              </h3>
              {missingList.length > 0 ? (
                <div className="space-y-2.5 font-mono text-xs">
                  {missingList.map((header, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-accent-red/10 border border-accent-red/20 rounded-lg text-accent-red font-bold flex items-center justify-between"
                    >
                      <span>{header}</span>
                      <span className="text-[10px] bg-accent-red/20 px-2 py-0.5 rounded uppercase">
                        Faltante
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-accent-green text-sm py-4 font-mono">¡Excelente! Tu sitio implementa todas las cabeceras recomendadas.</p>
              )}
            </div>

            {/* Raw Headers JSON Breakdown */}
            {latestResult.raw_headers && Object.keys(latestResult.raw_headers).length > 0 && (
              <div className="lg:col-span-2 bg-bg-card border border-border-base rounded-xl p-6 shadow-xl">
                <h3 className="text-base font-bold text-text-main mb-4 flex items-center gap-2 border-b border-border-base pb-3">
                  <FileCode2 size={20} className="text-accent-blue" />
                  Todas las Cabeceras HTTP Recibidas (Raw Headers)
                </h3>
                <div className="bg-bg-dark border border-border-base p-4 rounded-xl font-mono text-xs text-text-muted overflow-x-auto max-h-60 overflow-y-auto">
                  {Object.entries(latestResult.raw_headers).map(([k, v]) => (
                    <div key={k} className="py-0.5 border-b border-border-base/30 last:border-0">
                      <span className="text-accent-blue font-bold">{k}:</span>{' '}
                      <span className="text-text-main">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-bg-card border border-border-base rounded-xl p-8 text-center">
            <Shield className="mx-auto text-text-dim mb-3" size={40} />
            <p className="text-text-muted text-sm font-mono">No se ha realizado un escaneo aún para este sitio.</p>
          </div>
        )}

        {/* Modals */}
        {showForm && (
          <SecurityHeaderForm
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
            <ShieldCheck className="text-accent-green" size={28} />
            Security Headers Audit
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Auditoría automatizada de cabeceras de protección HTTP (HSTS, CSP, X-Frame-Options, CORS)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-2 border border-border-base rounded-md text-text-muted hover:text-text-main hover:bg-bg-card-hover transition-colors disabled:opacity-50"
            title="Refrescar objetivos"
          >
            <RefreshCw size={18} className={isRefetching ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-accent-green text-black font-semibold px-4 py-2 rounded-md text-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={18} />
            Nuevo Security Scan
          </button>
        </div>
      </div>

      {/* Targets Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : targets && targets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {targets.map((target: SecurityHeaderTarget) => (
            <div
              key={target.id}
              onClick={() => setSelectedTarget(target)}
              className="bg-bg-card border border-border-base rounded-xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between cursor-pointer group shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-9 h-9 rounded-lg bg-bg-dark border border-border-base flex items-center justify-center shrink-0 text-accent-green group-hover:border-accent-green/40 transition-colors">
                      <Shield size={18} />
                    </div>
                    <h3 className="font-bold text-text-main truncate text-base group-hover:text-accent-green transition-colors" title={target.name}>
                      {target.name}
                    </h3>
                  </div>
                </div>

                <p className="text-xs font-mono text-text-dim truncate mb-4" title={target.url}>
                  {target.url}
                </p>

                <div className="flex items-center justify-between border-t border-b border-border-base/50 py-2">
                  <span className="text-xs text-text-dim font-mono">Calificación Seguridad:</span>
                  <GradeBadge grade={target.last_score !== null ? (target.last_score >= 90 ? 'A+' : target.last_score >= 80 ? 'A' : target.last_score >= 70 ? 'B' : 'F') : null} score={target.last_score} />
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
                    title="Editar objetivo"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(target);
                    }}
                    className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded transition-colors"
                    title="Eliminar objetivo"
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
          icon={ShieldCheck}
          title="No hay objetivos de Security Headers configurados"
          description="Monitorea y audita las cabeceras HTTP de protección en tus portales web."
          actionLabel="Nuevo Security Scan"
          onAction={handleOpenCreate}
        />
      )}

      {/* Form Modal */}
      {showForm && (
        <SecurityHeaderForm
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
