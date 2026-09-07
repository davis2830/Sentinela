import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  DomainInfo,
  CreateDomainInfoData,
  DomainStats,
  DomainTestWhoisResult,
} from '../types/domain';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
import DomainTableView from '../components/domains/DomainTableView';
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
  FileText,
  Plus,
  Loader2,
  Trash2,
  Calendar,
  Building,
  RefreshCw,
  X,
  AlertTriangle,
  Server,
  Globe2,
  Pencil,
  Clock,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  CheckSquare,
  Square,
  Zap,
  Download,
  Lock,
  Unlock,
  Check,
  Shield,
  Layers,
} from 'lucide-react';

type FilterType = 'all' | 'expiring' | 'expired';

function renderNameServersList(nsData: any): string[] {
  if (!nsData) return [];
  if (Array.isArray(nsData)) return nsData.map((item) => String(item).toLowerCase());
  if (typeof nsData === 'string') {
    try {
      const parsed = JSON.parse(nsData);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item).toLowerCase());
    } catch {
      return nsData.split(/[\s,]+/).filter(Boolean).map((s) => s.toLowerCase());
    }
  }
  return [];
}

export default function DomainsPage() {
  const queryClient = useQueryClient();

  // State
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = usePersistentViewMode('domains', 'table');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scanningId, setScanningId] = useState<string | null>(null);

  // Modals & Drawer State
  const [showModal, setShowModal] = useState(false);
  const [editingDomain, setEditingDomain] = useState<DomainInfo | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<DomainInfo | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DomainInfo | null>(null);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'security' | 'nameservers'>('overview');
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Live Test WHOIS State
  const [isTestingWhois, setIsTestingWhois] = useState(false);
  const [testResult, setTestResult] = useState<DomainTestWhoisResult | null>(null);

  // Auto-refresh hook (15s countdown)
  const autoRefresh = useAutoRefresh({
    intervalSeconds: 15,
    initialEnabled: true,
  });

  const getEndpoint = () => {
    switch (filter) {
      case 'expiring':
        return 'domains/expiring/?days=30';
      case 'expired':
        return 'domains/expired/';
      default:
        return 'domains/';
    }
  };

  const { data: stats } = useQuery<DomainStats>({
    queryKey: ['domain-stats'],
    queryFn: async () => {
      const response = await api.get('domains/stats/');
      return (response.data?.data || {}) as DomainStats;
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  const { data: domains, isLoading } = useQuery<DomainInfo[]>({
    queryKey: ['domains', filter],
    queryFn: async () => {
      const response = await api.get(getEndpoint());
      return (response.data?.data || []) as DomainInfo[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateDomainInfoData) => {
      await api.post('domains/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      queryClient.invalidateQueries({ queryKey: ['domain-stats'] });
      handleCloseModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, domain }: { id: string; domain: string }) => {
      await api.patch(`domains/${id}/`, { domain });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      queryClient.invalidateQueries({ queryKey: ['domain-stats'] });
      handleCloseModal();
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (id: string) => {
      setScanningId(id);
      const response = await api.post(`domains/${id}/scan/`);
      return response.data?.data;
    },
    onSuccess: (updatedDomain) => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      queryClient.invalidateQueries({ queryKey: ['domain-stats'] });
      if (selectedDomain && updatedDomain && selectedDomain.id === updatedDomain.id) {
        setSelectedDomain(updatedDomain);
      }
      setScanningId(null);
    },
    onError: () => {
      setScanningId(null);
    },
  });

  const scanAllMutation = useMutation({
    mutationFn: async () => {
      await api.post('domains/scan-all/');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      queryClient.invalidateQueries({ queryKey: ['domain-stats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`domains/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      queryClient.invalidateQueries({ queryKey: ['domain-stats'] });
      if (selectedDomain?.id === deleteTarget?.id) {
        setSelectedDomain(null);
      }
      setDeleteTarget(null);
    },
  });

  // Bulk Actions via backend endpoint
  const handleToggleSelect = (domain: DomainInfo) => {
    setSelectedIds((prev) =>
      prev.includes(domain.id) ? prev.filter((id) => id !== domain.id) : [...prev, domain.id]
    );
  };

  const handleSelectAllToggle = () => {
    if (!filteredDomains || filteredDomains.length === 0) return;
    if (selectedIds.length === filteredDomains.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredDomains.map((d: DomainInfo) => d.id));
    }
  };

  const handleBulkScan = async () => {
    if (selectedIds.length === 0) return;
    try {
      await api.post('domains/bulk-action/', {
        action: 'scan',
        domain_ids: selectedIds,
      });
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      queryClient.invalidateQueries({ queryKey: ['domain-stats'] });
    } catch {
      for (const id of selectedIds) {
        api.post(`domains/${id}/scan/`).catch(() => {});
      }
      setSelectedIds([]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `¿Deseas eliminar permanentemente los ${selectedIds.length} dominios seleccionados?`
      )
    ) {
      return;
    }
    setBulkDeleting(true);
    try {
      await api.post('domains/bulk-action/', {
        action: 'delete',
        domain_ids: selectedIds,
      });
    } catch {
      for (const id of selectedIds) {
        try {
          await api.delete(`domains/${id}/`);
        } catch {}
      }
    }
    setSelectedIds([]);
    setBulkDeleting(false);
    queryClient.invalidateQueries({ queryKey: ['domains'] });
    queryClient.invalidateQueries({ queryKey: ['domain-stats'] });
  };

  // Test WHOIS Query Live in Modal
  const handleTestWhois = async () => {
    if (!domainInput.trim()) return;
    setIsTestingWhois(true);
    setTestResult(null);

    let cleanDomain = domainInput.trim().toLowerCase();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (cleanDomain.includes(':')) {
      cleanDomain = cleanDomain.split(':')[0];
    }

    try {
      const response = await api.post('domains/test-whois/', {
        domain: cleanDomain,
      });
      setTestResult(response.data?.data as DomainTestWhoisResult);
    } catch (err: any) {
      setTestResult({
        success: false,
        domain: cleanDomain,
        error_message: err.response?.data?.message || 'Error al consultar servidores WHOIS.',
      });
    } finally {
      setIsTestingWhois(false);
    }
  };

  // Export CSV Report
  const handleExportCSV = () => {
    if (!domains || domains.length === 0) return;
    const headers = [
      'Dominio',
      'Registrador',
      'Bloqueo EPP (Transfer Lock)',
      'Días Restantes',
      'Fecha Vencimiento',
      'Fecha Creación',
      'Servidores NS',
      'Última Sincronización',
    ];
    const rows = domains.map((d) => [
      d.domain,
      `"${d.registrar || 'Desconocido'}"`,
      d.is_locked ? 'Protegido (Locked)' : 'Sin Bloqueo',
      d.days_until_expiration ?? 'N/A',
      d.expiration_date ? new Date(d.expiration_date).toISOString().split('T')[0] : 'N/A',
      d.creation_date ? new Date(d.creation_date).toISOString().split('T')[0] : 'N/A',
      `"${renderNameServersList(d.name_servers).join(' ; ')}"`,
      d.last_scanned_at ? new Date(d.last_scanned_at).toISOString() : 'N/A',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `sentinel_dominios_whois_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Modal Handlers
  const handleOpenCreate = () => {
    setEditingDomain(null);
    setDomainInput('');
    setTestResult(null);
    setShowModal(true);
  };

  const handleOpenEdit = (domain: DomainInfo, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingDomain(domain);
    setDomainInput(domain.domain);
    setTestResult(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingDomain(null);
    setDomainInput('');
    setTestResult(null);
  };

  const handleSubmitModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;

    let cleanDomain = domainInput.trim().toLowerCase();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (cleanDomain.includes(':')) {
      cleanDomain = cleanDomain.split(':')[0];
    }

    if (editingDomain) {
      updateMutation.mutate({ id: editingDomain.id, domain: cleanDomain });
    } else {
      createMutation.mutate({ domain: cleanDomain });
    }
  };

  const getStatusType = (domain: DomainInfo) => {
    if (domain.status === 'error' || Boolean(domain.error_message)) return 'fallo';
    const days = domain.days_until_expiration;
    if (days !== null && days <= 0) return 'expirado';
    if (days !== null && days <= 30) return 'por_expirar';
    return 'valido';
  };

  const calculateLifePercentage = (domain: DomainInfo) => {
    if (!domain.creation_date || !domain.expiration_date) return null;
    const start = new Date(domain.creation_date).getTime();
    const end = new Date(domain.expiration_date).getTime();
    const now = Date.now();
    const total = end - start;
    if (total <= 0) return 100;
    const elapsed = now - start;
    return Math.min(Math.max(Math.round((elapsed / total) * 100), 0), 100);
  };

  // KPI Calculations
  const allDomains = domains || [];
  const totalCount = stats?.total || allDomains.length;
  const activeCount = stats?.active || allDomains.filter((d: DomainInfo) => !d.error_message && (d.days_until_expiration ?? 999) > 30).length;
  const expiringCount = stats?.expiring_30d || allDomains.filter(
    (d: DomainInfo) => d.days_until_expiration !== null && d.days_until_expiration <= 30 && d.days_until_expiration > 0
  ).length;
  const lockedCount = stats?.locked_count || allDomains.filter((d: DomainInfo) => d.is_locked).length;

  const validitySla =
    totalCount > 0 ? Math.round((activeCount / totalCount) * 1000) / 10 : 100.0;

  // Filtered & Searched Domains
  const filteredDomains = allDomains.filter((domain: DomainInfo) => {
    const matchesSearch =
      domain.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (domain.registrar && domain.registrar.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (filter === 'expiring') {
      return (
        domain.days_until_expiration !== null &&
        domain.days_until_expiration <= 30 &&
        domain.days_until_expiration > 0
      );
    }
    if (filter === 'expired') {
      return (
        domain.status === 'error' ||
        Boolean(domain.error_message) ||
        (domain.days_until_expiration !== null && domain.days_until_expiration <= 0)
      );
    }

    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader
        title="Dominios & WHOIS"
        badgeText="DOMAIN WATCH"
        description="Supervisión continua de vigencia ICANN, registradores autorizados, servidores de nombres DNS y fechas de renovación."
        icon={<Globe2 size={26} />}
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
              disabled={!domains || domains.length === 0}
              className="flex items-center gap-2 bg-bg-card border border-border-base text-text-muted hover:text-text-main font-medium px-4 py-2 rounded-full text-sm hover:bg-bg-card-hover transition-all disabled:opacity-50 cursor-pointer"
              title="Exportar inventario de dominios a CSV"
            >
              <Download size={15} />
              <span>Exportar</span>
            </button>
            <button
              type="button"
              onClick={() => scanAllMutation.mutate()}
              disabled={scanAllMutation.isPending}
              className="flex items-center gap-2 bg-accent-green/10 border border-accent-green/40 text-accent-green font-medium px-4 py-2 rounded-full text-sm hover:bg-accent-green/20 transition-all disabled:opacity-50 cursor-pointer"
              title="Sincronizar información WHOIS de todos los dominios"
            >
              <RefreshCw
                size={15}
                className={scanAllMutation.isPending ? 'animate-spin' : ''}
              />
              <span>Sincronizar Todos</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 cursor-pointer"
            >
              <Plus size={16} />
              <span>Registrar Dominio</span>
            </button>
          </>
        }
      />

      {/* 2. NOC COMMAND CENTER: KPI STRIP */}
      <NOCKpiGrid columns={4}>
        {/* KPI 1: Vigencia y Salud Global */}
        <NOCKpiCard
          title="Salud de Vigencia"
          icon={<Globe2 size={16} className="text-accent-green" />}
          badge={{
            text: validitySla >= 95.0 ? 'Saludable' : 'Atención',
            variant: validitySla >= 95.0 ? 'success' : 'warning',
          }}
          value={`${validitySla}%`}
          valueSuffix="activos"
          progress={{ value: validitySla }}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Dominios registrados</span>
              <span className="text-text-main font-mono">{totalCount} activos</span>
            </div>
          }
        />

        {/* KPI 2: Candado de Seguridad EPP */}
        <NOCKpiCard
          title="Bloqueo Anti-Robo (EPP)"
          icon={<Lock size={16} className="text-accent-green" />}
          badge={{
            text: lockedCount === totalCount ? '100% Blindado' : 'Revisar Candado',
            variant: lockedCount === totalCount ? 'success' : 'warning',
          }}
          value={`${lockedCount} / ${totalCount}`}
          valueColor="text-accent-green"
          subtitle="Dominios con Transfer Lock activo"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Protección contra Hijacking</span>
              <span className="text-accent-green font-mono font-medium">Activa</span>
            </div>
          }
        />

        {/* KPI 3: Por Expirar <= 30d */}
        <NOCKpiCard
          title="Por Expirar (≤ 30 días)"
          icon={<AlertTriangle size={16} className={expiringCount > 0 ? 'text-accent-yellow' : 'text-text-dim'} />}
          badge={{
            text: expiringCount > 0 ? 'Renovación Requerida' : 'Sin Riesgo',
            variant: expiringCount > 0 ? 'warning' : 'neutral',
          }}
          value={expiringCount}
          valueColor={expiringCount > 0 ? 'text-accent-yellow' : 'text-text-main'}
          subtitle={expiringCount > 0 ? 'Vencimientos próximos detectados' : 'Todos con vigencia mayor a 30 días'}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Alerta Temprana</span>
              <span className="text-accent-yellow font-mono font-medium">30 días</span>
            </div>
          }
        />

        {/* KPI 4: Servidores de Nombres */}
        <NOCKpiCard
          title="Delegación de Nombres"
          icon={<Server size={16} className="text-accent-purple" />}
          badge={{
            text: 'ICANN / Registry',
            variant: 'neutral',
          }}
          value={totalCount > 0 ? 'Delegado' : '0'}
          valueColor="text-accent-purple"
          subtitle="Nameservers verificados en TLD"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Protocolo RDAP / WHOIS</span>
              <span className="text-accent-purple font-mono">Port 43</span>
            </div>
          }
        />
      </NOCKpiGrid>

      {/* 3. TOOLBAR: Omnibar Search + Status Filter Chips + Persistent Grid/Table Switcher */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por dominio o registrador acreditado..."
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        categoryLabel="Filtro:"
        categories={[
          { id: 'all', label: `Todos (${totalCount})` },
          { id: 'expiring', label: `Por Expirar (${expiringCount})` },
          { id: 'expired', label: `Expirados / Error (${stats?.expired || 0})` },
        ]}
        selectedCategory={filter}
        onCategoryChange={(cat) => setFilter(cat as FilterType)}
      />

      {/* 4. FLOATING BULK ACTIONS BAR */}
      <NOCBulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        itemLabel="dominios"
        actions={
          <>
            <button
              type="button"
              onClick={handleBulkScan}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-sm cursor-pointer"
            >
              <RefreshCw size={13} />
              Sincronizar Seleccionados
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
      ) : filteredDomains && filteredDomains.length > 0 ? (
        viewMode === 'table' ? (
          /* Compact NOC Table View */
          <DomainTableView
            domains={filteredDomains}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAllToggle}
            onSelectDomain={(d) => setSelectedDomain(d)}
            onScan={(id, e) => {
              e.stopPropagation();
              scanMutation.mutate(id);
            }}
            scanningId={scanningId}
            onEdit={(d, e) => handleOpenEdit(d, e)}
            onDelete={(d, e) => {
              e.stopPropagation();
              setDeleteTarget(d);
            }}
          />
        ) : (
          /* Grid Cards View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDomains.map((domain) => {
              const isSelected = selectedIds.includes(domain.id);
              const isScanning = scanningId === domain.id;
              const statusType = getStatusType(domain);
              const days = domain.days_until_expiration;
              const nsList = renderNameServersList(domain.name_servers);
              const lifePct = calculateLifePercentage(domain);

              return (
                <div
                  key={domain.id}
                  onClick={() => setSelectedDomain(domain)}
                  className={`bg-bg-card/95 border rounded-2xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between cursor-pointer group shadow-sm relative ${
                    isSelected
                      ? 'border-accent-green bg-accent-green/[0.02] ring-1 ring-accent-green/40'
                      : 'border-border-base/70'
                  }`}
                >
                  <div>
                    {/* Header: Checkbox + Domain Name + Lock Badge */}
                    <div className="flex items-start justify-between gap-2 mb-3.5">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(domain);
                          }}
                          className="text-text-dim hover:text-accent-green transition-colors shrink-0 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare size={16} className="text-accent-green" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                        <h3
                          className="font-bold text-text-main truncate text-base group-hover:text-accent-green transition-colors font-sans"
                          title={domain.domain}
                        >
                          {domain.domain}
                        </h3>
                      </div>

                      {/* EPP Lock Badge */}
                      {domain.is_locked ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-green/10 text-accent-green border border-accent-green/30 flex items-center gap-1 shrink-0">
                          <Lock size={10} />
                          Protegido
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30 flex items-center gap-1 shrink-0">
                          <Unlock size={10} />
                          Sin Bloqueo
                        </span>
                      )}
                    </div>

                    {/* Card Content Details */}
                    <div className="space-y-2 text-xs text-text-muted bg-bg-dark/50 rounded-xl p-3 border border-border-base/40">
                      <div className="flex items-center justify-between border-b border-border-base/40 pb-1.5">
                        <span className="flex items-center gap-1.5 text-text-dim font-medium">
                          <Building size={13} /> Registrador:
                        </span>
                        <span
                          className="font-mono text-text-main font-semibold truncate max-w-[170px]"
                          title={domain.registrar || ''}
                        >
                          {domain.registrar || 'Desconocido'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-b border-border-base/40 pb-1.5">
                        <span className="flex items-center gap-1.5 text-text-dim font-medium">
                          <Calendar size={13} /> Expiración:
                        </span>
                        <span className="font-mono text-text-main">
                          {domain.expiration_date
                            ? new Date(domain.expiration_date).toLocaleDateString('es-ES')
                            : 'N/A'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-text-dim font-medium">
                          <Clock size={13} /> Días restantes:
                        </span>
                        <span
                          className={`font-mono font-bold ${
                            days !== null && days <= 0
                              ? 'text-accent-red'
                              : days !== null && days <= 30
                              ? 'text-accent-yellow'
                              : 'text-accent-green'
                          }`}
                        >
                          {days !== null ? (days <= 0 ? 'Expirado' : `${days} días`) : 'N/A'}
                        </span>
                      </div>

                      {/* Lifecycle Progress Bar */}
                      {lifePct !== null && (
                        <div className="pt-1">
                          <div className="w-full h-1.5 bg-bg-dark rounded-full overflow-hidden border border-border-base/50">
                            <div
                              className={`h-full transition-all duration-500 rounded-full ${
                                days !== null && days <= 15
                                  ? 'bg-accent-red'
                                  : days !== null && days <= 30
                                  ? 'bg-accent-yellow'
                                  : 'bg-accent-green'
                              }`}
                              style={{ width: `${lifePct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer: Nameservers + Actions */}
                  <div className="mt-4 pt-3 border-t border-border-base/40 flex items-center justify-between text-xs text-text-dim">
                    <span
                      className="font-mono text-[11px] bg-bg-dark px-2 py-0.5 rounded-md border border-border-base/50 truncate max-w-[160px]"
                      title={nsList.join(', ')}
                    >
                      {nsList.length > 0 ? `${nsList.length} NS activos` : 'Sin NS'}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          scanMutation.mutate(domain.id);
                        }}
                        disabled={isScanning}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors disabled:opacity-50 cursor-pointer"
                        title="Consultar WHOIS ahora"
                      >
                        <RefreshCw size={14} className={isScanning ? 'animate-spin text-accent-green' : ''} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(domain, e)}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors cursor-pointer"
                        title="Editar dominio"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(domain);
                        }}
                        className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors cursor-pointer"
                        title="Eliminar dominio"
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
          icon={Globe2}
          title={
            searchTerm || filter !== 'all'
              ? 'No se encontraron dominios con los filtros aplicados'
              : 'No hay dominios registrados'
          }
          description={
            searchTerm || filter !== 'all'
              ? 'Prueba a cambiar el término de búsqueda o restablecer los filtros.'
              : 'Comienza a monitorear la vigencia y datos WHOIS de tus dominios corporativos.'
          }
          actionLabel={
            searchTerm || filter !== 'all' ? 'Limpiar Filtros' : 'Registrar Dominio'
          }
          onAction={() => {
            if (searchTerm || filter !== 'all') {
              setSearchTerm('');
              setFilter('all');
            } else {
              handleOpenCreate();
            }
          }}
        />
      )}

      {/* 6. SLIDE-OVER DETAIL DRAWER */}
      <NOCDrawer
        isOpen={!!selectedDomain}
        onClose={() => setSelectedDomain(null)}
        title={selectedDomain?.domain || ''}
        subtitle={
          selectedDomain && (
            <div className="flex items-center gap-2">
              <span>Registrador: {selectedDomain.registrar || 'Desconocido'}</span>
              <span>&bull;</span>
              <a
                href={`http://${selectedDomain.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-green hover:underline flex items-center gap-1"
              >
                Abrir <ExternalLink size={11} />
              </a>
            </div>
          )
        }
        statusBadge={
          selectedDomain && (
            <div className="flex items-center gap-2">
              {selectedDomain.is_locked ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent-green/10 text-accent-green border border-accent-green/30 flex items-center gap-1">
                  <Lock size={11} />
                  EPP Protegido
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30 flex items-center gap-1">
                  <Unlock size={11} />
                  Sin Bloqueo EPP
                </span>
              )}
              <StatusBadge status={getStatusType(selectedDomain)} />
            </div>
          )
        }
        headerActions={
          selectedDomain && (
            <button
              type="button"
              onClick={() => scanMutation.mutate(selectedDomain.id)}
              disabled={scanMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-black rounded-full text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
              title="Consultar WHOIS inmediato"
            >
              <RefreshCw
                size={13}
                className={scanMutation.isPending ? 'animate-spin' : ''}
              />
              <span>{scanMutation.isPending ? 'Consultando...' : 'Consultar WHOIS'}</span>
            </button>
          )
        }
        quickKpis={
          selectedDomain && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim font-sans">Días Restantes</div>
                <div
                  className={`text-base font-bold mt-0.5 ${
                    selectedDomain.days_until_expiration !== null && selectedDomain.days_until_expiration <= 30
                      ? 'text-accent-red'
                      : 'text-accent-green'
                  }`}
                >
                  {selectedDomain.days_until_expiration !== null
                    ? `${selectedDomain.days_until_expiration}d`
                    : 'N/A'}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim font-sans">Fecha Expiración</div>
                <div className="text-sm font-semibold text-text-main mt-0.5 truncate">
                  {selectedDomain.expiration_date
                    ? new Date(selectedDomain.expiration_date).toLocaleDateString('es-ES')
                    : 'N/A'}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim font-sans">Fecha Creación</div>
                <div className="text-sm font-semibold text-text-muted mt-0.5 truncate">
                  {selectedDomain.creation_date
                    ? new Date(selectedDomain.creation_date).toLocaleDateString('es-ES')
                    : 'N/A'}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim font-sans">Servidores NS</div>
                <div className="text-sm font-semibold text-accent-blue mt-0.5">
                  {renderNameServersList(selectedDomain.name_servers).length} NS
                </div>
              </div>
            </div>
          )
        }
        tabs={[
          { id: 'overview', label: 'Vigencia & Renovación' },
          { id: 'security', label: 'Seguridad EPP & Privacidad' },
          { id: 'nameservers', label: 'Delegación Nameservers' },
        ]}
        activeTab={drawerTab}
        onTabChange={(t) => setDrawerTab(t as any)}
        footerActions={
          selectedDomain && (
            <>
              <button
                type="button"
                onClick={() => handleOpenEdit(selectedDomain)}
                className="flex items-center gap-1.5 px-4 py-2 border border-border-base text-text-muted hover:text-text-main hover:bg-bg-dark rounded-full text-xs font-semibold transition-colors cursor-pointer"
              >
                <Pencil size={14} />
                Editar Dominio
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(selectedDomain)}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-full text-xs font-semibold transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
                Eliminar Dominio
              </button>
            </>
          )
        }
        maxWidthClass="max-w-2xl"
      >
        {selectedDomain && drawerTab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">Registrador Acreditado:</span>
                <span className="font-mono font-semibold text-text-main truncate max-w-[280px]">
                  {selectedDomain.registrar || 'Desconocido'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">Fecha Creación:</span>
                <span className="font-mono text-text-main">
                  {selectedDomain.creation_date
                    ? new Date(selectedDomain.creation_date).toLocaleDateString('es-ES')
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">Fecha Expiración:</span>
                <span className="font-mono font-bold text-text-main">
                  {selectedDomain.expiration_date
                    ? new Date(selectedDomain.expiration_date).toLocaleDateString('es-ES')
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">Última Modificación en Registry:</span>
                <span className="font-mono text-text-muted">
                  {selectedDomain.last_updated
                    ? new Date(selectedDomain.last_updated).toLocaleDateString('es-ES')
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-dim font-medium">Última Comprobación WHOIS:</span>
                <span className="font-mono text-text-muted">
                  {selectedDomain.last_scanned_at
                    ? new Date(selectedDomain.last_scanned_at).toLocaleString('es-ES')
                    : 'Nunca'}
                </span>
              </div>
            </div>
          </div>
        )}

        {selectedDomain && drawerTab === 'security' && (
          <div className="space-y-4">
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3 text-xs">
              {/* Domain Lock Banner */}
              <div
                className={`p-3.5 rounded-2xl border flex items-start gap-2.5 ${
                  selectedDomain.is_locked
                    ? 'bg-accent-green/10 border-accent-green/30 text-text-main'
                    : 'bg-accent-yellow/10 border-accent-yellow/30 text-text-main'
                }`}
              >
                {selectedDomain.is_locked ? (
                  <Lock className="text-accent-green shrink-0 mt-0.5" size={16} />
                ) : (
                  <Unlock className="text-accent-yellow shrink-0 mt-0.5" size={16} />
                )}
                <div>
                  <h4 className="font-bold text-xs">
                    {selectedDomain.is_locked
                      ? 'Bloqueo Anti-Transferencia Activo (Domain Lock)'
                      : 'Atención: Dominio sin Bloqueo de Transferencia'}
                  </h4>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {selectedDomain.is_locked
                      ? 'El registrador ha activado la directiva clientTransferProhibited. El dominio está blindado contra transferencias no autorizadas.'
                      : 'El dominio no tiene activo el bloqueo de transferencia. Se recomienda habilitarlo en el registrador para prevenir Domain Hijacking.'}
                  </p>
                </div>
              </div>

              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">País Registrante:</span>
                <span className="font-bold font-mono text-text-main">
                  {selectedDomain.registrant_country || 'No disponible'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">Servidor WHOIS:</span>
                <span className="font-bold font-mono text-text-main">
                  {selectedDomain.whois_server || 'whois.iana.org'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">DNSSEC:</span>
                <span className="font-bold font-mono text-text-main">
                  {selectedDomain.dnssec || 'unsigned'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-medium">Estado ICANN / EPP:</span>
                <span className="font-bold font-mono text-accent-green break-all max-w-[280px]">
                  {Array.isArray(selectedDomain.status)
                    ? selectedDomain.status.join(', ')
                    : selectedDomain.status || 'Activo'}
                </span>
              </div>
              {selectedDomain.error_message && (
                <div className="p-3 bg-accent-red/10 border border-accent-red/20 rounded-xl text-accent-red">
                  {selectedDomain.error_message}
                </div>
              )}
            </div>
          </div>
        )}

        {selectedDomain && drawerTab === 'nameservers' && (
          <div className="space-y-4">
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4">
              <h4 className="text-xs font-semibold text-text-muted mb-3 flex items-center gap-1.5">
                <Server size={14} className="text-accent-green" />
                Servidores de Nombres Delegados en el TLD
              </h4>
              {renderNameServersList(selectedDomain.name_servers).length > 0 ? (
                <div className="space-y-2">
                  {renderNameServersList(selectedDomain.name_servers).map((ns, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-bg-card border border-border-base/60 rounded-xl text-xs font-mono text-text-main flex items-center gap-2"
                    >
                      <span className="w-2 h-2 rounded-full bg-accent-green" />
                      <span className="font-bold">{ns}</span>
                      <span className="ml-auto text-[10px] text-text-dim font-sans font-medium">Autoritativo</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-dim font-mono">
                  No se detectaron servidores de nombres delegados para este dominio.
                </p>
              )}
            </div>
          </div>
        )}
      </NOCDrawer>

      {/* 7. CREATE / EDIT FORM MODAL WITH LIVE TEST WHOIS */}
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
                <Globe2 size={19} className="text-accent-green" />
                {editingDomain ? 'Editar Dominio' : 'Monitorear Nuevo Dominio WHOIS'}
              </h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-text-muted hover:text-text-main transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Nombre de Dominio FQDN
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. empresa.com o micoope.com.gt"
                  value={domainInput}
                  onChange={(e) => {
                    setDomainInput(e.target.value);
                    setTestResult(null);
                  }}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-mono"
                />
                <p className="text-[11px] text-text-dim mt-1.5">
                  Ingresa el dominio corporativo raíz (ej. <code>empresa.com</code> sin https://).
                </p>
              </div>

              {/* Test WHOIS Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleTestWhois}
                  disabled={!domainInput.trim() || isTestingWhois}
                  className="w-full py-2 px-4 rounded-xl border border-border-base bg-bg-dark hover:bg-bg-dark/80 text-text-main text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isTestingWhois ? (
                    <>
                      <Loader2 className="animate-spin text-accent-green" size={14} />
                      <span>Consultando registro WHOIS/RDAP...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={14} className="text-accent-yellow" />
                      <span>Consultar WHOIS en Vivo</span>
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
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-accent-green flex items-center gap-1.5">
                          <Check size={14} /> Consulta Exitosa
                        </span>
                        {testResult.is_locked ? (
                          <span className="px-2 py-0.5 rounded-full bg-accent-green/20 text-accent-green text-[10px] font-bold flex items-center gap-1">
                            <Lock size={10} /> Transfer Lock Activo
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-accent-yellow/20 text-accent-yellow text-[10px] font-bold flex items-center gap-1">
                            <Unlock size={10} /> Sin Bloqueo
                          </span>
                        )}
                      </div>

                      <div className="font-mono text-[11px] bg-bg-dark/70 p-2.5 rounded-xl border border-border-base/50 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-text-dim">Registrador:</span>
                          <span className="font-bold truncate max-w-[200px]">{testResult.registrar || 'Desconocido'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-dim">Vigencia Restante:</span>
                          <span className="font-bold text-accent-green">
                            {testResult.days_until_expiration !== null ? `${testResult.days_until_expiration} días` : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-dim">Fecha Vencimiento:</span>
                          <span>
                            {testResult.expiration_date
                              ? new Date(testResult.expiration_date).toLocaleDateString('es-ES')
                              : 'N/A'}
                          </span>
                        </div>
                        {testResult.name_servers && testResult.name_servers.length > 0 && (
                          <div className="pt-1 border-t border-border-base/40 text-text-dim">
                            <span>Nameservers ({testResult.name_servers.length}):</span>
                            <div className="text-text-main truncate">
                              {testResult.name_servers.slice(0, 2).join(', ')}
                              {testResult.name_servers.length > 2 ? ' ...' : ''}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle size={14} />
                        <span>Fallo en la consulta WHOIS</span>
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
                  ) : editingDomain ? (
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
        itemName={deleteTarget?.domain || 'este dominio'}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
