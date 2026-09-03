import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  DNSRecord,
  DNSRecordType,
  DNSChangeHistory,
  CreateDNSRecordData,
  DNSStats,
} from '../types/dns';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
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
  Globe,
  Plus,
  Loader2,
  Trash2,
  History,
  RefreshCw,
  X,
  Clock,
  ArrowRight,
  Pencil,
  AlertTriangle,
  Layers,
  CheckSquare,
  Square,
  ShieldCheck,
  Server,
  Activity,
} from 'lucide-react';

const RECORD_TYPES: DNSRecordType[] = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME'];

export default function DNSRecordsPage() {
  const queryClient = useQueryClient();

  // State
  const [selectedRecord, setSelectedRecord] = useState<DNSRecord | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DNSRecord | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [recordTypeInput, setRecordTypeInput] = useState<DNSRecordType>('A');
  const [typeFilter, setTypeFilter] = useState<'all' | DNSRecordType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = usePersistentViewMode('dns_records', 'table');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DNSRecord | null>(null);
  const [drawerTab, setDrawerTab] = useState<'history' | 'details'>('history');
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Auto-refresh hook (15s countdown)
  const autoRefresh = useAutoRefresh({
    intervalSeconds: 15,
    initialEnabled: true,
  });

  // Stats query
  const { data: stats } = useQuery<DNSStats>({
    queryKey: ['dns-stats'],
    queryFn: async () => {
      const response = await api.get('dns-records/stats/');
      return (response.data?.data || {}) as DNSStats;
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Main DNS records query
  const { data: records, isLoading } = useQuery<DNSRecord[]>({
    queryKey: ['dns-records'],
    queryFn: async () => {
      const response = await api.get('dns-records/');
      return (response.data?.data || []) as DNSRecord[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Selected record change history query
  const { data: history, isLoading: isLoadingHistory } = useQuery<DNSChangeHistory[]>({
    queryKey: ['dns-history', selectedRecord?.id],
    queryFn: async () => {
      if (!selectedRecord) return [];
      const response = await api.get(`dns-records/${selectedRecord.id}/history/`);
      return (response.data?.data || []) as DNSChangeHistory[];
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
      setScanningId(id);
      const response = await api.post(`dns-records/${id}/scan/`);
      return response.data?.data;
    },
    onSuccess: (updatedRecord) => {
      queryClient.invalidateQueries({ queryKey: ['dns-records'] });
      queryClient.invalidateQueries({ queryKey: ['dns-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dns-history', selectedRecord?.id] });
      if (selectedRecord && updatedRecord && selectedRecord.id === updatedRecord.id) {
        setSelectedRecord(updatedRecord);
      }
      setScanningId(null);
    },
    onError: () => {
      setScanningId(null);
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

  // Bulk Actions
  const handleToggleSelect = (record: DNSRecord) => {
    setSelectedIds((prev) =>
      prev.includes(record.id) ? prev.filter((id) => id !== record.id) : [...prev, record.id]
    );
  };

  const handleSelectAllToggle = () => {
    if (!filteredRecords || filteredRecords.length === 0) return;
    if (selectedIds.length === filteredRecords.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRecords.map((r: DNSRecord) => r.id));
    }
  };

  const handleBulkScan = async () => {
    if (selectedIds.length === 0) return;
    for (const id of selectedIds) {
      try {
        await api.post(`dns-records/${id}/scan/`);
      } catch (err) {
        // Continue
      }
    }
    queryClient.invalidateQueries({ queryKey: ['dns-records'] });
    queryClient.invalidateQueries({ queryKey: ['dns-stats'] });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `¿Deseas eliminar permanentemente los ${selectedIds.length} registros DNS seleccionados?`
      )
    ) {
      return;
    }
    setBulkDeleting(true);
    for (const id of selectedIds) {
      try {
        await api.delete(`dns-records/${id}/`);
      } catch (err) {
        // Continue
      }
    }
    setSelectedIds([]);
    setBulkDeleting(false);
    queryClient.invalidateQueries({ queryKey: ['dns-records'] });
    queryClient.invalidateQueries({ queryKey: ['dns-stats'] });
  };

  // Modal Handlers
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

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'A':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'AAAA':
        return 'bg-teal-500/10 text-teal-400 border-teal-500/30';
      case 'CNAME':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'MX':
        return 'bg-violet-500/10 text-violet-400 border-violet-500/30';
      case 'TXT':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'NS':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  // KPI Calculations
  const allRecords = records || [];
  const totalCount = stats?.total || allRecords.length;
  const resolvedCount = allRecords.filter((r: DNSRecord) => Boolean(r.value)).length;
  const changedCount = stats?.changes_24h || allRecords.filter((r: DNSRecord) => Boolean(r.last_change_at)).length;

  const resolutionSla =
    totalCount > 0
      ? Math.round((resolvedCount / totalCount) * 1000) / 10
      : 100.0;

  // Filtered & Searched Records
  const filteredRecords = allRecords.filter((record: DNSRecord) => {
    const matchesSearch =
      record.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (record.value && record.value.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (typeFilter !== 'all' && record.record_type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader
        title="Registros DNS"
        badgeText="DNS MONITOR"
        description="Monitorización de resolución, propagación y detección de cambios no autorizados en zonas DNS."
        icon={<Globe size={26} />}
        autoRefresh={{
          enabled: autoRefresh.enabled,
          countdown: autoRefresh.countdown,
          onToggle: autoRefresh.toggle,
        }}
        actions={
          <>
            <button
              type="button"
              onClick={() => scanAllMutation.mutate()}
              disabled={scanAllMutation.isPending}
              className="flex items-center gap-2 bg-accent-green/10 border border-accent-green/40 text-accent-green font-medium px-4 py-2 rounded-full text-sm hover:bg-accent-green/20 transition-all disabled:opacity-50"
              title="Re-resolver todos los registros DNS inmediatamente"
            >
              <RefreshCw
                size={15}
                className={scanAllMutation.isPending ? 'animate-spin' : ''}
              />
              Re-resolver Todos
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20"
            >
              <Plus size={16} />
              Nuevo Registro
            </button>
          </>
        }
      />

      {/* 2. NOC COMMAND CENTER: KPI STRIP */}
      <NOCKpiGrid columns={4}>
        {/* KPI 1: Resolución Exitosa */}
        <NOCKpiCard
          title="Tasa de Resolución"
          icon={<ShieldCheck size={16} className="text-accent-green" />}
          badge={{
            text: resolutionSla >= 99.0 ? 'Óptimo' : 'Atención',
            variant: resolutionSla >= 99.0 ? 'success' : 'warning',
          }}
          value={`${resolutionSla}%`}
          valueSuffix="resueltos"
          progress={{ value: resolutionSla }}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Registros con IP / Valor</span>
              <span>{resolvedCount} de {totalCount}</span>
            </div>
          }
        />

        {/* KPI 2: Tipos de Registros */}
        <NOCKpiCard
          title="Diversidad de Zona"
          icon={<Layers size={16} className="text-sky-400" />}
          badge={{
            text: `${RECORD_TYPES.length} Tipos`,
            variant: 'info',
          }}
          value={totalCount}
          valueColor="text-sky-400"
          valueSuffix="registros"
          subtitle="Distribución entre A, CNAME, MX, TXT y NS"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Servidor Recursive</span>
              <span className="text-sky-400 font-mono">1.1.1.1 / 8.8.8.8</span>
            </div>
          }
        />

        {/* KPI 3: Cambios Recientes */}
        <NOCKpiCard
          title="Historial de Mutaciones"
          icon={<History size={16} className="text-amber-400" />}
          badge={{
            text: changedCount > 0 ? `${changedCount} cambios` : 'Sin cambios',
            variant: changedCount > 0 ? 'warning' : 'neutral',
          }}
          value={changedCount}
          valueColor={changedCount > 0 ? 'text-amber-400' : 'text-text-main'}
          valueSuffix="modificaciones"
          subtitle="Detección de alteración de IP o nameserver"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Auditoría de Zona</span>
              <span className="text-accent-green font-medium">Activa</span>
            </div>
          }
        />

        {/* KPI 4: Carga de Monitoreo */}
        <NOCKpiCard
          title="Carga de Resolución"
          icon={<Server size={16} className="text-accent-green" />}
          badge={{
            text: 'Celery Beat',
            variant: 'neutral',
          }}
          value={totalCount > 0 ? `${totalCount * 2} queries` : '0 queries'}
          valueColor="text-accent-green"
          valueSuffix="por ciclo"
          subtitle="Verificación periódica de propagación DNS"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Protocolo de Red</span>
              <span className="text-accent-green font-mono">UDP / TCP 53</span>
            </div>
          }
        />
      </NOCKpiGrid>

      {/* 3. TOOLBAR: Omnibar Search + Record Type Chips + Grid/Table Switcher */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por dominio, subdominio o IP resuelta..."
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        categoryLabel="Tipo:"
        categories={[
          { id: 'all', label: 'Todos' },
          { id: 'A', label: 'A' },
          { id: 'AAAA', label: 'AAAA' },
          { id: 'CNAME', label: 'CNAME' },
          { id: 'MX', label: 'MX' },
          { id: 'TXT', label: 'TXT' },
          { id: 'NS', label: 'NS' },
        ]}
        selectedCategory={typeFilter}
        onCategoryChange={(cat) => setTypeFilter(cat as any)}
      />

      {/* 4. FLOATING BULK ACTIONS BAR */}
      <NOCBulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        itemLabel="registros"
        actions={
          <>
            <button
              type="button"
              onClick={handleBulkScan}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-sm"
            >
              <RefreshCw size={13} />
              Re-resolver Seleccionados
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-red text-white font-semibold rounded-full text-xs hover:bg-accent-red/90 transition-all shadow-sm disabled:opacity-50"
            >
              <Trash2 size={13} />
              {bulkDeleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </>
        }
      />

      {/* 5. MAIN CONTENT: DUAL VIEW (TABLE OR GRID) */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : filteredRecords && filteredRecords.length > 0 ? (
        viewMode === 'table' ? (
          /* Compact Table View (Default for DNS) */
          <div className="bg-bg-card/95 border border-border-base/70 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-base text-text-dim text-xs bg-bg-card/50">
                    <th className="py-3 px-3.5 w-10">
                      <button
                        type="button"
                        onClick={handleSelectAllToggle}
                        className="text-text-dim hover:text-accent-green transition-colors"
                        title={
                          selectedIds.length === filteredRecords.length
                            ? 'Deseleccionar todos'
                            : 'Seleccionar todos'
                        }
                      >
                        {selectedIds.length === filteredRecords.length ? (
                          <CheckSquare size={16} className="text-accent-green" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3">Tipo</th>
                    <th className="py-3 px-4">Nombre / Host</th>
                    <th className="py-3 px-4">Valor Resuelto</th>
                    <th className="py-3 px-3">TTL</th>
                    <th className="py-3 px-3">Último Cambio</th>
                    <th className="py-3 px-3">Última Consulta</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-base/40">
                  {filteredRecords.map((record) => {
                    const isSelected = selectedIds.includes(record.id);
                    const isScanning = scanningId === record.id;

                    return (
                      <tr
                        key={record.id}
                        onClick={() => setSelectedRecord(record)}
                        className={`hover:bg-bg-card-hover/80 transition-colors cursor-pointer group ${
                          isSelected ? 'bg-accent-green/[0.03]' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td
                          className="py-3 px-3.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(record);
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

                        {/* Record Type Badge */}
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${getTypeBadgeClass(
                              record.record_type
                            )}`}
                          >
                            {record.record_type}
                          </span>
                        </td>

                        {/* Host / Domain */}
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-text-main group-hover:text-accent-green transition-colors text-sm">
                            {record.domain}
                          </span>
                        </td>

                        {/* Resolved Value */}
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs text-accent-green bg-accent-green/5 px-2 py-0.5 rounded border border-accent-green/20 break-all">
                            {record.value || 'Sin resolver'}
                          </span>
                        </td>

                        {/* TTL */}
                        <td className="py-3 px-3 font-mono text-text-dim text-xs">
                          {record.ttl ?? 'Auto'}
                        </td>

                        {/* Last Change */}
                        <td className="py-3 px-3 text-text-dim font-mono text-xs whitespace-nowrap">
                          {record.last_change_at ? (
                            <span className="flex items-center gap-1 text-amber-400">
                              <History size={12} />
                              {new Date(record.last_change_at).toLocaleDateString('es-ES')}
                            </span>
                          ) : (
                            <span className="text-text-dim">Sin cambios</span>
                          )}
                        </td>

                        {/* Last Checked */}
                        <td className="py-3 px-3 text-text-dim font-mono text-xs whitespace-nowrap">
                          {record.last_scanned_at ? (
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {new Date(record.last_scanned_at).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          ) : (
                            'Nunca'
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                scanMutation.mutate(record.id);
                              }}
                              disabled={isScanning}
                              className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors disabled:opacity-50"
                              title="Re-resolver DNS ahora"
                            >
                              <RefreshCw
                                size={14}
                                className={isScanning ? 'animate-spin' : ''}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleOpenEdit(record, e)}
                              className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors"
                              title="Editar registro"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(record);
                              }}
                              className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors"
                              title="Eliminar registro"
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
        ) : (
          /* Grid View (Cards) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecords.map((record) => {
              const isSelected = selectedIds.includes(record.id);
              const isScanning = scanningId === record.id;

              return (
                <div
                  key={record.id}
                  onClick={() => setSelectedRecord(record)}
                  className={`bg-bg-card/95 border rounded-2xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between cursor-pointer group shadow-sm relative ${
                    isSelected
                      ? 'border-accent-green bg-accent-green/[0.02] ring-1 ring-accent-green/40'
                      : 'border-border-base/70'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(record);
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
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border shrink-0 ${getTypeBadgeClass(
                            record.record_type
                          )}`}
                        >
                          {record.record_type}
                        </span>
                        <h3
                          className="font-bold font-mono text-text-main truncate text-base group-hover:text-accent-green transition-colors"
                          title={record.domain}
                        >
                          {record.domain}
                        </h3>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs font-mono text-text-muted bg-bg-dark/50 rounded-xl p-3 border border-border-base/40">
                      <div className="flex justify-between border-b border-border-base/40 pb-1.5 font-sans">
                        <span className="text-text-dim font-medium">Valor:</span>
                        <span
                          className="text-accent-green font-mono font-semibold truncate max-w-[200px]"
                          title={record.value || ''}
                        >
                          {record.value || 'Sin resolver'}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-border-base/40 pb-1.5 font-sans">
                        <span className="text-text-dim font-medium">TTL:</span>
                        <span className="text-text-main font-mono">{record.ttl ?? 'Auto'}</span>
                      </div>
                      <div className="flex justify-between font-sans">
                        <span className="text-text-dim font-medium">Último Cambio:</span>
                        <span className="text-amber-400 font-mono">
                          {record.last_change_at
                            ? new Date(record.last_change_at).toLocaleDateString('es-ES')
                            : 'Sin cambios'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border-base/40 flex items-center justify-between text-xs text-text-dim">
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <Clock size={12} />
                      {record.last_scanned_at
                        ? new Date(record.last_scanned_at).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Nunca'}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          scanMutation.mutate(record.id);
                        }}
                        disabled={isScanning}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors disabled:opacity-50"
                        title="Re-resolver DNS ahora"
                      >
                        <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(record, e)}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors"
                        title="Editar registro"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(record);
                        }}
                        className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors"
                        title="Eliminar registro"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <EmptyState
          icon={Globe}
          title={
            searchTerm || typeFilter !== 'all'
              ? 'No se encontraron registros con los filtros aplicados'
              : 'No hay registros DNS monitoreados'
          }
          description={
            searchTerm || typeFilter !== 'all'
              ? 'Prueba a cambiar el término de búsqueda o restablecer el filtro de tipo de registro.'
              : 'Supervisa registros A, CNAME, MX y detecta cambios de IP o desvíos no autorizados.'
          }
          actionLabel={searchTerm || typeFilter !== 'all' ? 'Limpiar Filtros' : 'Nuevo Registro'}
          onAction={() => {
            if (searchTerm || typeFilter !== 'all') {
              setSearchTerm('');
              setTypeFilter('all');
            } else {
              handleOpenCreate();
            }
          }}
        />
      )}

      {/* 6. SLIDE-OVER DETAIL DRAWER (Zero Context Loss with NOCDrawer) */}
      <NOCDrawer
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title={selectedRecord?.domain || ''}
        subtitle={
          selectedRecord && (
            <div className="flex items-center gap-2 font-mono">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getTypeBadgeClass(
                  selectedRecord.record_type
                )}`}
              >
                {selectedRecord.record_type}
              </span>
              <span className="text-accent-green truncate">
                {selectedRecord.value || 'Sin resolver'}
              </span>
            </div>
          )
        }
        headerActions={
          selectedRecord && (
            <button
              type="button"
              onClick={() => scanMutation.mutate(selectedRecord.id)}
              disabled={scanMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-black rounded-full text-xs font-semibold transition-all disabled:opacity-50"
              title="Re-resolver DNS inmediatamente"
            >
              <RefreshCw
                size={13}
                className={scanMutation.isPending ? 'animate-spin' : ''}
              />
              <span>{scanMutation.isPending ? 'Resolviendo...' : 'Re-resolver'}</span>
            </button>
          )
        }
        quickKpis={
          selectedRecord && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-sans">
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">TTL</div>
                <div className="text-base font-bold font-mono text-text-main mt-0.5">
                  {selectedRecord.ttl ?? 'Auto'}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Tipo Registro</div>
                <div className="text-base font-bold font-mono text-accent-green mt-0.5">
                  {selectedRecord.record_type}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Último Cambio</div>
                <div className="text-xs font-semibold font-mono text-amber-400 mt-0.5 truncate">
                  {selectedRecord.last_change_at
                    ? new Date(selectedRecord.last_change_at).toLocaleDateString('es-ES')
                    : 'Sin cambios'}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Último Check</div>
                <div className="text-xs font-semibold font-mono text-text-muted mt-0.5 truncate">
                  {selectedRecord.last_scanned_at
                    ? new Date(selectedRecord.last_scanned_at).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Nunca'}
                </div>
              </div>
            </div>
          )
        }
        tabs={[
          { id: 'history', label: 'Historial de Mutaciones', icon: <History size={13} /> },
          { id: 'details', label: 'Detalles de Configuración', icon: <Activity size={13} /> },
        ]}
        activeTab={drawerTab}
        onTabChange={(t) => setDrawerTab(t as any)}
        footerActions={
          selectedRecord && (
            <>
              <button
                type="button"
                onClick={() => handleOpenEdit(selectedRecord)}
                className="flex items-center gap-1.5 px-4 py-2 border border-border-base text-text-muted hover:text-text-main hover:bg-bg-dark rounded-full text-xs font-semibold transition-colors"
              >
                <Pencil size={14} />
                Editar Registro
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(selectedRecord)}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-full text-xs font-semibold transition-colors"
              >
                <Trash2 size={14} />
                Eliminar Registro
              </button>
            </>
          )
        }
        maxWidthClass="max-w-2xl"
      >
        {selectedRecord && drawerTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-text-muted">
                Registro de Cambios Detectados
              </h4>
              <span className="text-[11px] text-text-dim">
                {history?.length || 0} eventos registrados
              </span>
            </div>

            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-accent-green" size={28} />
              </div>
            ) : history && history.length > 0 ? (
              <div className="space-y-3 font-mono">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-bg-dark/80 border border-border-base rounded-2xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between text-text-dim text-[11px] border-b border-border-base/40 pb-2">
                      <span className="flex items-center gap-1.5">
                        <Clock size={12} />
                        {new Date(item.changed_at).toLocaleString('es-ES')}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold font-sans">
                        Cambio Detectado
                      </span>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <div className="flex-1 p-2 bg-bg-card rounded-xl border border-border-base/60">
                        <span className="text-[10px] text-text-dim block mb-0.5 font-sans font-medium">
                          Valor Anterior:
                        </span>
                        <span className="text-rose-400 break-all">{item.old_value || 'None'}</span>
                      </div>
                      <ArrowRight size={16} className="text-text-dim shrink-0" />
                      <div className="flex-1 p-2 bg-bg-card rounded-xl border border-border-base/60">
                        <span className="text-[10px] text-text-dim block mb-0.5 font-sans font-medium">
                          Nuevo Valor:
                        </span>
                        <span className="text-accent-green font-bold break-all">
                          {item.new_value || 'None'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-bg-dark/50 border border-border-base rounded-2xl p-8 text-center font-sans">
                <p className="text-text-dim text-xs">
                  No se han detectado mutaciones en este registro desde su creación.
                </p>
              </div>
            )}
          </div>
        )}

        {selectedRecord && drawerTab === 'details' && (
          <div className="space-y-4 font-sans">
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3 text-xs font-mono">
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-sans font-medium">Host / Dominio FQDN:</span>
                <span className="font-bold text-text-main">{selectedRecord.domain}</span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-sans font-medium">Tipo de Registro:</span>
                <span className="font-bold text-accent-green">{selectedRecord.record_type}</span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-sans font-medium">Valor Actual Resuelto:</span>
                <span className="font-bold text-accent-green truncate max-w-[280px]">
                  {selectedRecord.value || 'Sin resolver'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-sans font-medium">TTL Configurado:</span>
                <span className="font-bold text-text-main">{selectedRecord.ttl ?? 'Auto'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-dim font-sans font-medium">Última Comprobación:</span>
                <span className="text-text-muted">
                  {selectedRecord.last_scanned_at
                    ? new Date(selectedRecord.last_scanned_at).toLocaleString('es-ES')
                    : 'Nunca'}
                </span>
              </div>
            </div>
          </div>
        )}
      </NOCDrawer>

      {/* 7. CREATE / EDIT FORM MODAL */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={handleCloseModal}
        >
          <div
            className="bg-bg-card border border-border-base rounded-2xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                <Globe size={18} className="text-accent-green" />
                {editingRecord ? 'Editar Registro DNS' : 'Nuevo Registro DNS'}
              </h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-text-muted hover:text-text-main transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Tipo de Registro DNS
                </label>
                <select
                  value={recordTypeInput}
                  onChange={(e) => setRecordTypeInput(e.target.value as DNSRecordType)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono"
                >
                  {RECORD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Host o Dominio
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. api.empresa.com o mail.empresa.com"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-mono"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-border-base">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-2.5 border border-border-base rounded-full text-sm text-text-muted hover:bg-bg-dark transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-2.5 bg-accent-green text-black font-semibold rounded-full text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : editingRecord ? (
                    'Actualizar'
                  ) : (
                    'Crear y Resolver'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. DELETE CONFIRMATION MODAL */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        itemName={deleteTarget ? `${deleteTarget.record_type} ${deleteTarget.domain}` : ''}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
