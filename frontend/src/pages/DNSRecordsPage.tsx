import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  DNSRecord,
  DNSRecordType,
  CreateDNSRecordData,
  DNSChangeHistory,
  DNSStats,
  DNSTestResolutionResult,
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
  RefreshCw,
  Clock,
  Pencil,
  ExternalLink,
  History,
  AlertTriangle,
  Server,
  Activity,
  CheckSquare,
  Square,
  ArrowRight,
  Download,
  Zap,
  Check,
  Shield,
  Layers,
  Sparkles,
  Search,
  X,
} from 'lucide-react';

const RECORD_TYPES: DNSRecordType[] = [
  'A',
  'AAAA',
  'CNAME',
  'MX',
  'TXT',
  'NS',
  'SOA',
  'PTR',
  'CAA',
];

export default function DNSRecordsPage() {
  const queryClient = useQueryClient();

  // State
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DNSRecord | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [recordTypeInput, setRecordTypeInput] = useState<DNSRecordType>('A');
  const [typeFilter, setTypeFilter] = useState<'all' | DNSRecordType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  // Persistent viewMode: remembers table or grid across refreshes and updates
  const [viewMode, setViewMode] = usePersistentViewMode('dns_records', 'table');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DNSRecord | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<DNSRecord | null>(null);
  const [drawerTab, setDrawerTab] = useState<'history' | 'details' | 'security'>('history');
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Live Test Resolution State
  const [isTestingResolution, setIsTestingResolution] = useState(false);
  const [testResult, setTestResult] = useState<DNSTestResolutionResult | null>(null);

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

  // Bulk Actions via backend endpoint
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
    try {
      await api.post('dns-records/bulk-action/', {
        action: 'scan',
        record_ids: selectedIds,
      });
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['dns-records'] });
      queryClient.invalidateQueries({ queryKey: ['dns-stats'] });
    } catch {
      for (const id of selectedIds) {
        api.post(`dns-records/${id}/scan/`).catch(() => {});
      }
      setSelectedIds([]);
    }
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
    try {
      await api.post('dns-records/bulk-action/', {
        action: 'delete',
        record_ids: selectedIds,
      });
    } catch {
      for (const id of selectedIds) {
        try {
          await api.delete(`dns-records/${id}/`);
        } catch {}
      }
    }
    setSelectedIds([]);
    setBulkDeleting(false);
    queryClient.invalidateQueries({ queryKey: ['dns-records'] });
    queryClient.invalidateQueries({ queryKey: ['dns-stats'] });
  };

  // Test DNS Resolution in Modal
  const handleTestResolution = async () => {
    if (!domainInput.trim()) return;
    setIsTestingResolution(true);
    setTestResult(null);

    let cleanDomain = domainInput.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (cleanDomain.includes(':')) {
      cleanDomain = cleanDomain.split(':')[0];
    }

    try {
      const response = await api.post('dns-records/test-resolution/', {
        domain: cleanDomain,
        record_type: recordTypeInput,
      });
      setTestResult(response.data?.data as DNSTestResolutionResult);
    } catch (err: any) {
      setTestResult({
        success: false,
        domain: cleanDomain,
        record_type: recordTypeInput,
        values: [],
        error_message: err.response?.data?.message || 'Error al resolver la consulta DNS.',
      });
    } finally {
      setIsTestingResolution(false);
    }
  };

  // Export CSV Report
  const handleExportCSV = () => {
    if (!records || records.length === 0) return;
    const headers = [
      'Dominio / Host',
      'Tipo de Registro',
      'Valor Resuelto',
      'TTL',
      'Latencia Consulta (ms)',
      'Último Cambio Detectado',
      'Última Comprobación',
    ];
    const rows = records.map((r) => [
      r.domain,
      r.record_type,
      `"${(r.value || '').replace(/"/g, '""').replace(/\n/g, ' ; ')}"`,
      r.ttl ?? 'N/A',
      r.response_time_ms ? `${r.response_time_ms}ms` : 'N/A',
      r.last_change_at ? new Date(r.last_change_at).toISOString() : 'Sin cambios',
      r.last_scanned_at ? new Date(r.last_scanned_at).toISOString() : 'N/A',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `sentinel_registros_dns_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Modal Handlers
  const handleOpenCreate = () => {
    setEditingRecord(null);
    setDomainInput('');
    setRecordTypeInput('A');
    setTestResult(null);
    setShowModal(true);
  };

  const handleOpenEdit = (record: DNSRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingRecord(record);
    setDomainInput(record.domain);
    setRecordTypeInput(record.record_type);
    setTestResult(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingRecord(null);
    setDomainInput('');
    setRecordTypeInput('A');
    setTestResult(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;
    let cleanDomain = domainInput.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (cleanDomain.includes(':')) {
      cleanDomain = cleanDomain.split(':')[0];
    }

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
      case 'SOA':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'PTR':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'CAA':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  const isRecentMutation = (dateStr: string | null) => {
    if (!dateStr) return false;
    const changeTime = new Date(dateStr).getTime();
    const now = Date.now();
    return now - changeTime < 24 * 60 * 60 * 1000;
  };

  // KPI Calculations
  const allRecords = records || [];
  const totalCount = stats?.total || allRecords.length;
  const resolvedCount = allRecords.filter((r: DNSRecord) => Boolean(r.value)).length;
  const changedCount =
    stats?.changes_24h || allRecords.filter((r: DNSRecord) => isRecentMutation(r.last_change_at)).length;

  const resolutionSla =
    totalCount > 0 ? Math.round((resolvedCount / totalCount) * 1000) / 10 : 100.0;

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
        title="Registros & Zonas DNS"
        badgeText="DNS MONITOR"
        description="Monitorización continua de resolución, propagación, tiempos de respuesta y detección de mutaciones en zonas DNS."
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
              onClick={handleExportCSV}
              disabled={!records || records.length === 0}
              className="flex items-center gap-2 bg-bg-card border border-border-base text-text-muted hover:text-text-main font-medium px-4 py-2 rounded-full text-sm hover:bg-bg-card-hover transition-all disabled:opacity-50 cursor-pointer"
              title="Descargar inventario DNS en formato CSV"
            >
              <Download size={15} />
              <span>Exportar</span>
            </button>
            <button
              type="button"
              onClick={() => scanAllMutation.mutate()}
              disabled={scanAllMutation.isPending}
              className="flex items-center gap-2 bg-accent-green/10 border border-accent-green/40 text-accent-green font-medium px-4 py-2 rounded-full text-sm hover:bg-accent-green/20 transition-all disabled:opacity-50 cursor-pointer"
              title="Re-resolver todos los registros DNS inmediatamente"
            >
              <RefreshCw
                size={15}
                className={scanAllMutation.isPending ? 'animate-spin' : ''}
              />
              <span>Re-resolver Todos</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 cursor-pointer"
            >
              <Plus size={16} />
              <span>Nuevo Registro</span>
            </button>
          </>
        }
      />

      {/* 2. NOC COMMAND CENTER: KPI STRIP */}
      <NOCKpiGrid columns={4}>
        {/* KPI 1: Resolución Exitosa */}
        <NOCKpiCard
          title="Salud de Resolución"
          icon={<Globe size={16} className="text-accent-green" />}
          badge={{
            text: resolutionSla >= 99.0 ? 'Óptimo' : 'Degradado',
            variant: resolutionSla >= 99.0 ? 'success' : 'warning',
          }}
          value={`${resolutionSla}%`}
          valueSuffix="resueltos"
          progress={{ value: resolutionSla }}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Registros monitorizados</span>
              <span className="text-text-main font-mono">{totalCount} activos</span>
            </div>
          }
        />

        {/* KPI 2: Latencia Media de Consulta */}
        <NOCKpiCard
          title="Latencia DNS Media"
          icon={<Zap size={16} className="text-accent-blue" />}
          badge={{
            text: `${stats?.avg_latency_ms || 24}ms`,
            variant: 'info',
          }}
          value={`${stats?.avg_latency_ms || 24} ms`}
          valueColor="text-accent-blue"
          subtitle="Tiempo medio de respuesta del servidor DNS"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Resolución rápida</span>
              <span className="text-accent-green font-mono font-medium">&lt; 50ms</span>
            </div>
          }
        />

        {/* KPI 3: Mutaciones de Zona Recientes */}
        <NOCKpiCard
          title="Mutaciones Recientes"
          icon={<History size={16} className={changedCount > 0 ? 'text-accent-yellow' : 'text-text-dim'} />}
          badge={{
            text: changedCount > 0 ? 'Mutación (24h)' : 'Zona Estable',
            variant: changedCount > 0 ? 'warning' : 'neutral',
          }}
          value={changedCount}
          valueColor={changedCount > 0 ? 'text-accent-yellow' : 'text-text-main'}
          subtitle={changedCount > 0 ? 'Cambios de IP detectados hoy' : 'Sin mutaciones de IP recientes'}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Auditoría de Cambios</span>
              <span className="text-accent-green font-mono font-medium">Activa</span>
            </div>
          }
        />

        {/* KPI 4: Carga y Protocolo */}
        <NOCKpiCard
          title="Dominios Únicos"
          icon={<Server size={16} className="text-accent-purple" />}
          badge={{
            text: 'UDP / TCP 53',
            variant: 'neutral',
          }}
          value={stats?.unique_domains || 4}
          valueColor="text-accent-purple"
          valueSuffix="zonas"
          subtitle="Zonas primarias bajo auditoría"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Protocolo de Red</span>
              <span className="text-accent-green font-mono">Puerto 53</span>
            </div>
          }
        />
      </NOCKpiGrid>

      {/* 3. TOOLBAR: Omnibar Search + Record Type Chips + Persistent Grid/Table Switcher */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por dominio, host o IP resuelta..."
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
          { id: 'SOA', label: 'SOA' },
          { id: 'PTR', label: 'PTR' },
          { id: 'CAA', label: 'CAA' },
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
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-sm cursor-pointer"
            >
              <RefreshCw size={13} />
              Re-resolver Seleccionados
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-red text-white font-semibold rounded-full text-xs hover:bg-accent-red/90 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Trash2 size={13} />
              {bulkDeleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </>
        }
      />

      {/* 5. MAIN CONTENT: DUAL VIEW (COMPACT TABLE OR GRID) */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : filteredRecords && filteredRecords.length > 0 ? (
        viewMode === 'table' ? (
          /* Compact NOC Table View */
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
                    <th className="py-3 px-3">Latencia</th>
                    <th className="py-3 px-3">Mutaciones</th>
                    <th className="py-3 px-3">Último Check</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-base/40">
                  {filteredRecords.map((record) => {
                    const isSelected = selectedIds.includes(record.id);
                    const isScanning = scanningId === record.id;
                    const isMutated = isRecentMutation(record.last_change_at);
                    const isTxt = record.record_type === 'TXT';
                    const isSpf = isTxt && record.value.includes('v=spf1');
                    const isDmarc = isTxt && record.value.includes('v=DMARC1');

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

                        {/* Domain / Host */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-text-main group-hover:text-accent-green transition-colors text-sm font-sans">
                              {record.domain}
                            </span>
                            <a
                              href={`https://${record.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-text-dim hover:text-accent-green shrink-0"
                              title="Abrir dominio"
                            >
                              <ExternalLink size={11} />
                            </a>
                          </div>
                        </td>

                        {/* Resolved Value */}
                        <td className="py-3 px-4 font-mono">
                          {record.value ? (
                            <div className="flex items-center gap-2 max-w-md">
                              <span
                                className="text-text-muted truncate block text-xs"
                                title={record.value}
                              >
                                {record.value.split('\n').slice(0, 2).join(', ')}
                                {record.value.split('\n').length > 2 ? ' ...' : ''}
                              </span>
                              {isSpf && (
                                <span className="px-1.5 py-0.2 rounded bg-accent-green/10 text-accent-green border border-accent-green/30 text-[10px] font-bold shrink-0">
                                  SPF
                                </span>
                              )}
                              {isDmarc && (
                                <span className="px-1.5 py-0.2 rounded bg-accent-purple/10 text-accent-purple border border-accent-purple/30 text-[10px] font-bold shrink-0">
                                  DMARC
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-accent-red font-semibold text-xs flex items-center gap-1">
                              <AlertTriangle size={12} />
                              Sin resolver
                            </span>
                          )}
                        </td>

                        {/* TTL */}
                        <td className="py-3 px-3 text-text-dim font-mono text-xs">
                          {record.ttl ? `${record.ttl}s` : 'Auto'}
                        </td>

                        {/* Latency ms */}
                        <td className="py-3 px-3 font-mono text-xs">
                          {record.response_time_ms ? (
                            <span
                              className={`font-semibold ${
                                record.response_time_ms < 50
                                  ? 'text-accent-green'
                                  : record.response_time_ms < 150
                                  ? 'text-accent-blue'
                                  : 'text-accent-yellow'
                              }`}
                            >
                              {record.response_time_ms}ms
                            </span>
                          ) : (
                            <span className="text-text-dim">-</span>
                          )}
                        </td>

                        {/* Mutations */}
                        <td className="py-3 px-3 font-mono text-xs">
                          {isMutated ? (
                            <span className="px-2 py-0.5 rounded-full bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30 text-[10px] font-bold animate-pulse">
                              Mutación 24h
                            </span>
                          ) : record.last_change_at ? (
                            <span className="text-text-dim text-xs">
                              {new Date(record.last_change_at).toLocaleDateString('es-ES')}
                            </span>
                          ) : (
                            <span className="text-text-dim text-xs">Estable</span>
                          )}
                        </td>

                        {/* Last check */}
                        <td className="py-3 px-3 text-text-dim font-mono text-xs whitespace-nowrap">
                          {record.last_scanned_at
                            ? new Date(record.last_scanned_at).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'N/A'}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => scanMutation.mutate(record.id)}
                              disabled={isScanning}
                              className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors disabled:opacity-50 cursor-pointer"
                              title="Re-resolver ahora"
                            >
                              <RefreshCw
                                size={14}
                                className={isScanning ? 'animate-spin text-accent-green' : ''}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleOpenEdit(record, e)}
                              className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors cursor-pointer"
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
                              className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors cursor-pointer"
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
          /* Grid Cards View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecords.map((record) => {
              const isSelected = selectedIds.includes(record.id);
              const isScanning = scanningId === record.id;
              const isMutated = isRecentMutation(record.last_change_at);

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
                    {/* Header: Checkbox, Type Badge, Domain & Actions */}
                    <div className="flex items-start justify-between gap-2 mb-3.5">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(record);
                          }}
                          className="text-text-dim hover:text-accent-green transition-colors shrink-0 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare size={16} className="text-accent-green" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${getTypeBadgeClass(
                            record.record_type
                          )}`}
                        >
                          {record.record_type}
                        </span>

                        <h3
                          className="font-bold text-text-main truncate text-base group-hover:text-accent-green transition-colors font-sans"
                          title={record.domain}
                        >
                          {record.domain}
                        </h3>
                      </div>

                      {isMutated && (
                        <span className="px-2 py-0.5 rounded-full bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30 text-[10px] font-bold animate-pulse shrink-0">
                          Mutación 24h
                        </span>
                      )}
                    </div>

                    {/* Value Box */}
                    <div className="bg-bg-dark/60 rounded-xl p-3 border border-border-base/50 font-mono text-xs space-y-1.5 mb-3">
                      <div className="text-[11px] text-text-dim flex justify-between font-sans">
                        <span>Valor Resuelto:</span>
                        {record.response_time_ms && (
                          <span className="text-accent-blue font-mono font-bold">
                            {record.response_time_ms} ms
                          </span>
                        )}
                      </div>
                      <p className="text-text-main break-all line-clamp-3">
                        {record.value || (
                          <span className="text-accent-red font-sans">Sin respuesta / NXDOMAIN</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer: TTL + Actions */}
                  <div className="pt-3 border-t border-border-base/40 flex items-center justify-between text-xs text-text-dim">
                    <span className="font-mono text-xs">
                      TTL: <strong className="text-text-muted">{record.ttl ? `${record.ttl}s` : 'Auto'}</strong>
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          scanMutation.mutate(record.id);
                        }}
                        disabled={isScanning}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors disabled:opacity-50 cursor-pointer"
                        title="Re-resolver ahora"
                      >
                        <RefreshCw size={14} className={isScanning ? 'animate-spin text-accent-green' : ''} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(record, e)}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors cursor-pointer"
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
                        className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors cursor-pointer"
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
          title="No hay registros DNS monitorizados"
          description="Agrega registros A, MX, TXT, CNAME o NS para vigilar la resolución de nombres y recibir alertas cuando las IPs cambien."
          actionLabel="Agregar Primer Registro DNS"
          onAction={handleOpenCreate}
        />
      )}

      {/* 6. SLIDE-OVER TECHNICAL DRAWER */}
      <NOCDrawer
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title={selectedRecord ? `${selectedRecord.record_type} ${selectedRecord.domain}` : ''}
        subtitle="Auditoría de Zona DNS & Historial de Mutaciones de IP"
        statusBadge={
          selectedRecord ? (
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${getTypeBadgeClass(
                  selectedRecord.record_type
                )}`}
              >
                {selectedRecord.record_type}
              </span>
              {selectedRecord.value ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs bg-accent-green/10 text-accent-green border border-accent-green/30 font-bold">
                  Resuelto
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs bg-accent-red/10 text-accent-red border border-accent-red/30 font-bold">
                  Sin respuesta
                </span>
              )}
            </div>
          ) : undefined
        }
        headerActions={
          selectedRecord && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scanMutation.mutate(selectedRecord.id)}
                disabled={scanningId === selectedRecord.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green/20 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw
                  size={13}
                  className={scanningId === selectedRecord.id ? 'animate-spin' : ''}
                />
                Re-resolver
              </button>
              <a
                href={`https://${selectedRecord.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-full bg-bg-dark border border-border-base text-text-dim hover:text-text-main transition-colors"
                title="Abrir dominio"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          )
        }
        quickKpis={
          selectedRecord && (
            <div className="grid grid-cols-3 gap-2.5 mb-2 font-mono">
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim font-sans">TTL Cache</div>
                <div className="text-xs font-bold text-text-main mt-0.5">
                  {selectedRecord.ttl ? `${selectedRecord.ttl}s` : 'Auto'}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim font-sans">Latencia Consulta</div>
                <div className="text-xs font-bold text-accent-blue mt-0.5">
                  {selectedRecord.response_time_ms ? `${selectedRecord.response_time_ms} ms` : '-'}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim font-sans">Último Cambio</div>
                <div className="text-xs font-bold text-accent-yellow mt-0.5 truncate">
                  {selectedRecord.last_change_at
                    ? new Date(selectedRecord.last_change_at).toLocaleDateString('es-ES')
                    : 'Estable'}
                </div>
              </div>
            </div>
          )
        }
        tabs={[
          { id: 'history', label: `Historial de Mutaciones (${history?.length || 0})` },
          { id: 'details', label: 'Valores Resueltos & TTL' },
          ...(selectedRecord?.record_type === 'TXT'
            ? [{ id: 'security', label: 'Seguridad SPF / DMARC' }]
            : []),
        ]}
        activeTab={drawerTab}
        onTabChange={(t) => setDrawerTab(t as any)}
        footerActions={
          selectedRecord && (
            <>
              <button
                type="button"
                onClick={() => handleOpenEdit(selectedRecord)}
                className="flex items-center gap-1.5 px-4 py-2 border border-border-base text-text-muted hover:text-text-main hover:bg-bg-dark rounded-full text-xs font-semibold transition-colors cursor-pointer"
              >
                <Pencil size={14} />
                Editar Registro
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(selectedRecord)}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-full text-xs font-semibold transition-colors cursor-pointer"
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
                Auditoría de Mutaciones & Comparativa Diff
              </h4>
              <span className="text-[11px] text-text-dim font-mono">
                {history?.length || 0} eventos registrados
              </span>
            </div>

            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-accent-green" size={28} />
              </div>
            ) : history && history.length > 0 ? (
              <div className="space-y-3 font-mono">
                {history.map((item) => {
                  const oldLines = (item.old_value || '').split('\n').filter(Boolean);
                  const newLines = (item.new_value || '').split('\n').filter(Boolean);
                  const removed = oldLines.filter((l) => !newLines.includes(l));
                  const added = newLines.filter((l) => !oldLines.includes(l));

                  return (
                    <div
                      key={item.id}
                      className="p-4 bg-bg-dark/80 border border-border-base rounded-2xl space-y-3 text-xs"
                    >
                      <div className="flex items-center justify-between text-text-dim text-[11px] border-b border-border-base/40 pb-2">
                        <span className="flex items-center gap-1.5">
                          <Clock size={12} />
                          {new Date(item.changed_at).toLocaleString('es-ES')}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30 font-semibold font-sans">
                          Mutación Confirmada
                        </span>
                      </div>

                      {/* Diff View */}
                      <div className="space-y-1.5 font-mono text-xs">
                        {removed.map((val, idx) => (
                          <div
                            key={`rem-${idx}`}
                            className="flex items-center gap-2 p-2 rounded-xl bg-accent-red/10 border border-accent-red/30 text-accent-red"
                          >
                            <span className="font-bold text-sm select-none">-</span>
                            <span className="break-all">{val}</span>
                            <span className="ml-auto text-[10px] font-sans opacity-80">(Anterior)</span>
                          </div>
                        ))}
                        {added.map((val, idx) => (
                          <div
                            key={`add-${idx}`}
                            className="flex items-center gap-2 p-2 rounded-xl bg-accent-green/10 border border-accent-green/30 text-accent-green"
                          >
                            <span className="font-bold text-sm select-none">+</span>
                            <span className="break-all">{val}</span>
                            <span className="ml-auto text-[10px] font-sans opacity-80 font-bold">(Nuevo)</span>
                          </div>
                        ))}
                        {removed.length === 0 && added.length === 0 && (
                          <div className="text-text-dim text-xs py-1">
                            Valores actualizados: {item.new_value}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
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
                <span className="text-text-dim font-sans font-medium">TTL Configurado:</span>
                <span className="font-bold text-text-main">{selectedRecord.ttl ? `${selectedRecord.ttl}s` : 'Auto'}</span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-sans font-medium">Latencia de Consulta:</span>
                <span className="font-bold text-accent-blue">{selectedRecord.response_time_ms ? `${selectedRecord.response_time_ms} ms` : '-'}</span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-sans font-medium">Última Comprobación:</span>
                <span className="text-text-muted">
                  {selectedRecord.last_scanned_at
                    ? new Date(selectedRecord.last_scanned_at).toLocaleString('es-ES')
                    : 'Nunca'}
                </span>
              </div>
            </div>

            {/* Resolved Values Box */}
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4">
              <h4 className="text-xs font-semibold text-text-muted mb-2.5">
                Respuestas Actuales de la Zona
              </h4>
              {selectedRecord.value ? (
                <div className="space-y-1.5 font-mono text-xs">
                  {selectedRecord.value.split('\n').map((val, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-bg-card rounded-xl border border-border-base/60 text-text-main break-all"
                    >
                      {val}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-accent-red/10 border border-accent-red/30 rounded-xl text-accent-red text-xs">
                  Sin respuestas devueltas por el resolver.
                </div>
              )}
            </div>
          </div>
        )}

        {selectedRecord && drawerTab === 'security' && (
          <div className="space-y-4 font-sans">
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Shield size={16} className="text-accent-green" />
                <h4 className="text-xs font-bold text-text-main">
                  Políticas de Correo & Anti-Spoofing (SPF / DMARC)
                </h4>
              </div>

              {selectedRecord.value.includes('v=spf1') ? (
                <div className="p-3.5 bg-accent-green/10 border border-accent-green/30 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-accent-green">Política SPF Detectada</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-bg-dark text-accent-green">
                      v=spf1
                    </span>
                  </div>
                  <p className="font-mono text-xs text-text-muted break-all">
                    {selectedRecord.value}
                  </p>
                  <p className="text-[11px] text-text-dim">
                    Autoriza qué servidores tienen permiso para enviar correos electrónicos en nombre de este dominio.
                  </p>
                </div>
              ) : selectedRecord.value.includes('v=DMARC1') ? (
                <div className="p-3.5 bg-accent-purple/10 border border-accent-purple/30 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-accent-purple">Política DMARC Detectada</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-bg-dark text-accent-purple">
                      v=DMARC1
                    </span>
                  </div>
                  <p className="font-mono text-xs text-text-muted break-all">
                    {selectedRecord.value}
                  </p>
                  <p className="text-[11px] text-text-dim">
                    Protege el dominio corporativo contra phishing y ataques de suplantación de identidad.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-bg-card border border-border-base rounded-xl text-text-dim text-xs">
                  Este registro TXT no contiene directivas SPF ni DMARC.
                </div>
              )}
            </div>
          </div>
        )}
      </NOCDrawer>

      {/* 7. CREATE / EDIT FORM MODAL WITH LIVE TEST RESOLUTION */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={handleCloseModal}
        >
          <div
            className="bg-bg-card border border-border-base rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-text-main flex items-center gap-2 font-sans">
                <Globe size={19} className="text-accent-green" />
                {editingRecord ? 'Editar Registro DNS' : 'Nuevo Registro DNS'}
              </h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-text-muted hover:text-text-main transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Tipo
                  </label>
                  <select
                    value={recordTypeInput}
                    onChange={(e) => {
                      setRecordTypeInput(e.target.value as DNSRecordType);
                      setTestResult(null);
                    }}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono cursor-pointer"
                  >
                    {RECORD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Host o Dominio FQDN
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. api.empresa.com o mail.empresa.com"
                    value={domainInput}
                    onChange={(e) => {
                      setDomainInput(e.target.value);
                      setTestResult(null);
                    }}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-mono"
                  />
                </div>
              </div>

              {/* Test Resolution Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleTestResolution}
                  disabled={!domainInput.trim() || isTestingResolution}
                  className="w-full py-2 px-4 rounded-xl border border-border-base bg-bg-dark hover:bg-bg-dark/80 text-text-main text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isTestingResolution ? (
                    <>
                      <Loader2 className="animate-spin text-accent-green" size={14} />
                      <span>Consultando servidores DNS...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={14} className="text-accent-yellow" />
                      <span>Resolver DNS en Vivo</span>
                    </>
                  )}
                </button>
              </div>

              {/* Test Result Live Preview */}
              {testResult && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs animate-in fade-in duration-200 ${
                    testResult.success
                      ? 'bg-accent-green/10 border-accent-green/30 text-text-main'
                      : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
                  }`}
                >
                  {testResult.success ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-accent-green flex items-center gap-1.5">
                          <Check size={14} /> Consulta Exitosa ({testResult.response_time_ms} ms)
                        </span>
                        <span className="font-mono text-[11px] text-text-dim">
                          TTL: {testResult.ttl ? `${testResult.ttl}s` : 'Auto'}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] bg-bg-dark/70 p-2 rounded-xl border border-border-base/50 space-y-1">
                        {testResult.values.map((v, i) => (
                          <div key={i} className="truncate" title={v}>
                            &bull; {v}
                          </div>
                        ))}
                      </div>
                      {testResult.spf_info && (
                        <div className="text-[11px] text-accent-green flex items-center gap-1 mt-1">
                          <Shield size={12} />
                          <span>Registro SPF válido detectado ({testResult.spf_info.policy})</span>
                        </div>
                      )}
                      {testResult.dmarc_info && (
                        <div className="text-[11px] text-accent-purple flex items-center gap-1 mt-1">
                          <Shield size={12} />
                          <span>Política DMARC: {testResult.dmarc_info.policy}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle size={14} />
                        <span>Fallo en la resolución DNS ({testResult.error_type})</span>
                      </div>
                      <p className="text-[11px] font-mono opacity-90">{testResult.error_message}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-border-base">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-2.5 border border-border-base rounded-full text-sm text-text-muted hover:bg-bg-dark transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-2.5 bg-accent-green text-black font-semibold rounded-full text-sm hover:bg-accent-green/90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : editingRecord ? (
                    'Actualizar'
                  ) : (
                    'Guardar y Monitorear'
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
