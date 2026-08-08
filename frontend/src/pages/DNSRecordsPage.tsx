import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { DNSRecord, DNSRecordType, DNSChangeHistory, CreateDNSRecordData, DNSStats } from '../types/dns';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
import {
  Globe,
  Plus,
  Loader2,
  Trash2,
  ArrowLeft,
  History,
  RefreshCw,
  X,
  Clock,
  ArrowRight,
  Pencil,
  AlertTriangle,
  Layers,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';

const RECORD_TYPES: DNSRecordType[] = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME'];

export default function DNSRecordsPage() {
  const queryClient = useQueryClient();
  const [selectedRecord, setSelectedRecord] = useState<DNSRecord | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DNSRecord | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [recordTypeInput, setRecordTypeInput] = useState<DNSRecordType>('A');
  const [typeFilter, setTypeFilter] = useState<'all' | DNSRecordType>('all');
  const [deleteTarget, setDeleteTarget] = useState<DNSRecord | null>(null);

  // Stats query
  const { data: stats } = useQuery({
    queryKey: ['dns-stats'],
    queryFn: async () => {
      const response = await api.get('dns-records/stats/');
      return (response.data?.data || {}) as DNSStats;
    },
    refetchInterval: 15000,
  });

  // Main DNS records query
  const { data: records, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dns-records'],
    queryFn: async () => {
      const response = await api.get('dns-records/');
      return response.data?.data || [];
    },
    refetchInterval: 30000,
  });

  // Selected record change history query
  const { data: history, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['dns-history', selectedRecord?.id],
    queryFn: async () => {
      if (!selectedRecord) return [];
      const response = await api.get(`dns-records/${selectedRecord.id}/history/`);
      return response.data?.data || [];
    },
    enabled: !!selectedRecord,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateDNSRecordData) => {
      await api.post('dns-records/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dns-records'] });
      queryClient.invalidateQueries({ queryKey: ['dns-stats'] });
      handleCloseModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateDNSRecordData }) => {
      await api.patch(`dns-records/${id}/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dns-records'] });
      queryClient.invalidateQueries({ queryKey: ['dns-stats'] });
      handleCloseModal();
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`dns-records/${id}/scan/`);
      return response.data?.data;
    },
    onSuccess: (updatedRecord) => {
      queryClient.invalidateQueries({ queryKey: ['dns-records'] });
      queryClient.invalidateQueries({ queryKey: ['dns-stats'] });
      if (selectedRecord && updatedRecord) {
        setSelectedRecord(updatedRecord);
      }
    },
  });

  const scanAllMutation = useMutation({
    mutationFn: async () => {
      await api.post('dns-records/scan-all/');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dns-records'] });
      queryClient.invalidateQueries({ queryKey: ['dns-stats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`dns-records/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dns-records'] });
      queryClient.invalidateQueries({ queryKey: ['dns-stats'] });
      if (selectedRecord?.id === deleteTarget?.id) {
        setSelectedRecord(null);
      }
      setDeleteTarget(null);
    },
  });

  const handleOpenCreate = () => {
    setEditingRecord(null);
    setDomainInput('');
    setRecordTypeInput('A');
    setShowModal(true);
  };

  const handleOpenEdit = (record: DNSRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingRecord(record);
    setDomainInput(record.domain);
    setRecordTypeInput(record.record_type);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingRecord(null);
    setDomainInput('');
    setRecordTypeInput('A');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;
    let cleanDomain = domainInput.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (editingRecord) {
      updateMutation.mutate({
        id: editingRecord.id,
        data: { domain: cleanDomain, record_type: recordTypeInput },
      });
    } else {
      createMutation.mutate({ domain: cleanDomain, record_type: recordTypeInput });
    }
  };

  // Detail view for DNS record history
  if (selectedRecord) {
    return (
      <div>
        <button
          onClick={() => setSelectedRecord(null)}
          className="flex items-center gap-2 text-text-muted hover:text-text-main transition-colors mb-6 text-sm"
        >
          <ArrowLeft size={18} />
          Volver a Registros DNS
        </button>

        <div className="bg-bg-card border border-border-base rounded-xl p-6 mb-6 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-accent-green/10 text-accent-green border border-accent-green/30 rounded-lg text-xs font-mono font-bold">
                  {selectedRecord.record_type}
                </span>
                <h1 className="text-2xl font-bold text-text-main font-mono">{selectedRecord.domain}</h1>
              </div>
              <p className="text-text-muted font-mono text-sm mt-2">
                Valor resuelto actual:{' '}
                <span className="text-accent-green font-semibold bg-accent-green/10 px-2 py-0.5 rounded border border-accent-green/20">
                  {selectedRecord.value || 'Sin resolver'}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => scanMutation.mutate(selectedRecord.id)}
                disabled={scanMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-black rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                title="Re-resolver DNS inmediatamente"
              >
                <RefreshCw size={14} className={scanMutation.isPending ? 'animate-spin' : ''} />
                {scanMutation.isPending ? 'Resolviendo...' : 'Re-resolver'}
              </button>
              <button
                onClick={(e) => handleOpenEdit(selectedRecord, e)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-dark border border-border-base text-text-muted hover:text-text-main hover:bg-bg-card-hover rounded-lg text-xs font-semibold transition-colors"
              >
                <Pencil size={16} />
                Editar
              </button>
              <button
                onClick={() => setDeleteTarget(selectedRecord)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-lg text-xs font-semibold transition-colors"
              >
                <Trash2 size={16} />
                Eliminar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-border-base text-sm">
            <div>
              <div className="text-xs text-text-muted uppercase font-mono">TTL (Time-To-Live)</div>
              <div className="text-lg font-mono font-bold mt-1 text-text-main">{selectedRecord.ttl ?? 'Auto'}</div>
            </div>
            <div>
              <div className="text-xs text-text-muted uppercase font-mono">Último cambio detectado</div>
              <div className="text-sm font-mono mt-1 text-text-main">
                {selectedRecord.last_change_at
                  ? new Date(selectedRecord.last_change_at).toLocaleString('es-ES')
                  : 'Sin cambios detectados'}
              </div>
            </div>
            <div>
              <div className="text-xs text-text-muted uppercase font-mono">Última verificación</div>
              <div className="text-sm font-mono mt-1 text-text-muted">
                {selectedRecord.last_scanned_at
                  ? new Date(selectedRecord.last_scanned_at).toLocaleString('es-ES')
                  : 'Nunca'}
              </div>
            </div>
          </div>
        </div>

        {/* Change History Timeline */}
        <div className="bg-bg-card border border-border-base rounded-xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-text-main mb-6 flex items-center gap-2">
            <History size={20} className="text-accent-green" />
            Historial Auditado de Cambios DNS
          </h2>

          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-accent-green" size={24} />
            </div>
          ) : history && history.length > 0 ? (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border-base">
              {history.map((item: DNSChangeHistory) => (
                <div key={item.id} className="relative group">
                  <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-accent-green border-4 border-bg-card" />
                  <div className="bg-bg-dark border border-border-base rounded-lg p-4">
                    <div className="flex items-center gap-2 text-xs text-text-dim mb-2 font-mono">
                      <Clock size={14} />
                      {new Date(item.changed_at).toLocaleString('es-ES')}
                    </div>
                    <div className="flex items-center gap-3 text-xs sm:text-sm font-mono flex-wrap">
                      <span className="text-accent-red bg-accent-red/10 px-2.5 py-1 rounded border border-accent-red/20 line-through">
                        {item.old_value || 'Vacio'}
                      </span>
                      <ArrowRight size={16} className="text-text-dim" />
                      <span className="text-accent-green bg-accent-green/10 px-2.5 py-1 rounded border border-accent-green/20 font-bold">
                        {item.new_value}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-dim text-sm py-4 text-center font-mono">
              No se han registrado cambios de DNS para este registro.
            </p>
          )}
        </div>

        {/* Edit Modal */}
        {showModal && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
            onClick={handleCloseModal}
          >
            <div
              className="bg-bg-card border border-border-base rounded-xl p-6 w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                  <Globe size={20} className="text-accent-green" />
                  Editar Registro DNS
                </h2>
                <button onClick={handleCloseModal} className="text-text-muted hover:text-text-main">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-xs font-mono uppercase text-text-muted mb-2">Dominio</label>
                    <input
                      type="text"
                      required
                      placeholder="ej. miempresa.com"
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      className="w-full bg-bg-dark border border-border-base rounded-lg px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-text-muted mb-2">Tipo de Registro</label>
                    <select
                      value={recordTypeInput}
                      onChange={(e) => setRecordTypeInput(e.target.value as DNSRecordType)}
                      className="w-full bg-bg-dark border border-border-base rounded-lg px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono"
                    >
                      {RECORD_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 py-2.5 border border-border-base rounded-lg text-sm text-text-muted hover:bg-bg-card-hover transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="flex-1 py-2.5 bg-accent-green text-black font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {updateMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : 'Actualizar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmDelete
          isOpen={!!deleteTarget}
          itemName={`${selectedRecord.record_type} - ${selectedRecord.domain}`}
          isDeleting={deleteMutation.isPending}
          onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
        />
      </div>
    );
  }

  const filteredRecords = (records || []).filter((r: DNSRecord) => {
    if (typeFilter === 'all') return true;
    return r.record_type === typeFilter;
  });

  // Main list view
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            <Globe className="text-accent-green" size={28} />
            Registros DNS
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Monitorea la resolución DNS e historial de cambios en tus registros
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => scanAllMutation.mutate()}
            disabled={scanAllMutation.isPending}
            className="flex items-center gap-2 bg-accent-green/10 border border-accent-green text-accent-green font-semibold px-3.5 py-2 rounded-md text-sm hover:bg-accent-green/20 transition-colors disabled:opacity-50"
            title="Re-resolver todos los registros DNS inmediatamente"
          >
            <RefreshCw size={16} className={scanAllMutation.isPending ? 'animate-spin' : ''} />
            Re-resolver Todos
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-accent-green text-black font-semibold px-4 py-2 rounded-md text-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={18} />
            Nuevo Registro DNS
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
          <div className="w-10 h-10 rounded-lg bg-accent-blue/10 flex items-center justify-center text-accent-blue shrink-0">
            <Layers size={20} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-text-muted">Total Registros</p>
            <p className="text-xl font-bold font-mono text-text-main">{stats?.total || 0}</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
          <div className="w-10 h-10 rounded-lg bg-accent-green/10 flex items-center justify-center text-accent-green shrink-0">
            <Globe size={20} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-text-muted">Dominios Únicos</p>
            <p className="text-xl font-bold font-mono text-accent-green">{stats?.unique_domains || 0}</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
          <div className="w-10 h-10 rounded-lg bg-accent-yellow/10 flex items-center justify-center text-accent-yellow shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-text-muted">Cambios (24h)</p>
            <p className="text-xl font-bold font-mono text-accent-yellow">{stats?.changes_24h || 0}</p>
          </div>
        </div>

        <div className="bg-bg-card border border-border-base rounded-xl p-4 flex items-center gap-3 shadow-md">
          <div className="w-10 h-10 rounded-lg bg-accent-red/10 flex items-center justify-center text-accent-red shrink-0">
            <ShieldAlert size={20} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-text-muted">Sin Resolver</p>
            <p className="text-xl font-bold font-mono text-accent-red">{stats?.unresolved || 0}</p>
          </div>
        </div>
      </div>

      {/* Record Type Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border-base mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => setTypeFilter('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors shrink-0 ${
            typeFilter === 'all'
              ? 'border-accent-green text-accent-green font-bold'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          Todos ({records?.length || 0})
        </button>
        {RECORD_TYPES.map((type) => {
          const count = (records || []).filter((r: DNSRecord) => r.record_type === type).length;
          return (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3.5 py-2 text-sm font-mono font-medium border-b-2 transition-colors shrink-0 ${
                typeFilter === type
                  ? 'border-accent-green text-accent-green font-bold'
                  : 'border-transparent text-text-muted hover:text-text-main'
              }`}
            >
              {type} ({count})
            </button>
          );
        })}
      </div>

      {/* Table view */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : filteredRecords && filteredRecords.length > 0 ? (
        <div className="bg-bg-card border border-border-base rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border-base bg-bg-dark/50 text-text-muted font-mono text-xs uppercase">
                  <th className="py-3.5 px-4 font-semibold">Tipo</th>
                  <th className="py-3.5 px-4 font-semibold">Dominio</th>
                  <th className="py-3.5 px-4 font-semibold">Valor Resuelto</th>
                  <th className="py-3.5 px-4 font-semibold">TTL</th>
                  <th className="py-3.5 px-4 font-semibold">Último Escaneo</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base/50">
                {filteredRecords.map((record: DNSRecord) => (
                  <tr
                    key={record.id}
                    onClick={() => setSelectedRecord(record)}
                    className="hover:bg-bg-card-hover/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 bg-accent-green/10 text-accent-green border border-accent-green/30 rounded text-xs font-mono font-bold">
                        {record.record_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-text-main font-mono">
                      {record.domain}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-text-muted max-w-xs truncate">
                      {record.value || <span className="text-text-dim italic">Sin resolver</span>}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-text-dim text-xs">
                      {record.ttl ?? 'Auto'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-text-dim text-xs">
                      {record.last_scanned_at
                        ? new Date(record.last_scanned_at).toLocaleString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Nunca'}
                    </td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => handleOpenEdit(record, e)}
                          className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded transition-colors"
                          title="Editar registro"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(record)}
                          className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded transition-colors"
                          title="Eliminar registro"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Globe}
          title="No hay registros DNS monitoreados"
          description="Agrega dominios y tipos de registro DNS (A, MX, CNAME, etc.) para detectar cambios."
          actionLabel="Nuevo Registro DNS"
          onAction={handleOpenCreate}
        />
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-bg-card border border-border-base rounded-xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                <Globe size={20} className="text-accent-green" />
                {editingRecord ? 'Editar Registro DNS' : 'Agregar Registro DNS'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-text-muted hover:text-text-main"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-mono uppercase text-text-muted mb-2">
                    Dominio
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. miempresa.com"
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-lg px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-text-muted mb-2">
                    Tipo de Registro
                  </label>
                  <select
                    value={recordTypeInput}
                    onChange={(e) => setRecordTypeInput(e.target.value as DNSRecordType)}
                    className="w-full bg-bg-dark border border-border-base rounded-lg px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono"
                  >
                    {RECORD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-2.5 border border-border-base rounded-lg text-sm text-text-muted hover:bg-bg-card-hover transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-2.5 bg-accent-green text-black font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : editingRecord ? (
                    'Actualizar'
                  ) : (
                    'Guardar y Resolver'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        itemName={`${deleteTarget?.record_type} - ${deleteTarget?.domain}`}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
