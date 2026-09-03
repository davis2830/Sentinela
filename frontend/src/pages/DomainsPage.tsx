import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { DomainInfo, CreateDomainInfoData, DomainStats } from '../types/domain';
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
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scanningId, setScanningId] = useState<string | null>(null);

  // Modals & Drawer State
  const [showModal, setShowModal] = useState(false);
  const [editingDomain, setEditingDomain] = useState<DomainInfo | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<DomainInfo | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DomainInfo | null>(null);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'nameservers' | 'raw'>('overview');
  const [bulkDeleting, setBulkDeleting] = useState(false);

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
    queryKey: ['domains-whois', filter],
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
      queryClient.invalidateQueries({ queryKey: ['domains-whois'] });
      queryClient.invalidateQueries({ queryKey: ['domain-stats'] });
      handleCloseModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, domain }: { id: string; domain: string }) => {
      await api.patch(`domains/${id}/`, { domain });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains-whois'] });
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
      queryClient.invalidateQueries({ queryKey: ['domains-whois'] });
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
      queryClient.invalidateQueries({ queryKey: ['domains-whois'] });
      queryClient.invalidateQueries({ queryKey: ['domain-stats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`domains/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains-whois'] });
      queryClient.invalidateQueries({ queryKey: ['domain-stats'] });
      if (selectedDomain?.id === deleteTarget?.id) {
        setSelectedDomain(null);
      }
      setDeleteTarget(null);
    },
  });

  // Bulk Actions
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
    for (const id of selectedIds) {
      try {
        await api.post(`domains/${id}/scan/`);
      } catch (err) {
        // Continue
      }
    }
    queryClient.invalidateQueries({ queryKey: ['domains-whois'] });
    queryClient.invalidateQueries({ queryKey: ['domain-stats'] });
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
    for (const id of selectedIds) {
      try {
        await api.delete(`domains/${id}/`);
      } catch (err) {
        // Continue
      }
    }
    setSelectedIds([]);
    setBulkDeleting(false);
    queryClient.invalidateQueries({ queryKey: ['domains-whois'] });
    queryClient.invalidateQueries({ queryKey: ['domain-stats'] });
  };

  // Modal Handlers
  const handleOpenCreate = () => {
    setEditingDomain(null);
    setDomainInput('');
    setShowModal(true);
  };

  const handleOpenEdit = (domain: DomainInfo, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingDomain(domain);
    setDomainInput(domain.domain);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingDomain(null);
    setDomainInput('');
  };

  const handleSubmitModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;

    let cleanDomain = domainInput.trim().toLowerCase();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    if (editingDomain) {
      updateMutation.mutate({ id: editingDomain.id, domain: cleanDomain });
    } else {
      createMutation.mutate({ domain: cleanDomain });
    }
  };

  const getStatusType = (domain: DomainInfo) => {
    if (domain.status === 'error') return 'fallo';
    const days = domain.days_until_expiration;
    if (days !== null && days <= 0) return 'expirado';
    if (days !== null && days <= 30) return 'por_expirar';
    return 'valido';
  };

  // KPI Calculations
  const allDomains = domains || [];
  const totalCount = stats?.total || allDomains.length;
  const activeCount = stats?.active || allDomains.filter((d: DomainInfo) => d.status === 'active').length;
  const expiringCount = stats?.expiring_30d || allDomains.filter(
    (d: DomainInfo) => d.days_until_expiration !== null && d.days_until_expiration <= 30 && d.days_until_expiration > 0
  ).length;
  const expiredCount = (stats?.expired || 0) + (stats?.error || 0);

  const validitySla =
    totalCount > 0
      ? Math.round((activeCount / totalCount) * 1000) / 10
      : 100.0;

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
        description="Supervisión de vigencia, registradores autorizados, servidores de nombres DNS y fechas de renovación."
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
              onClick={() => scanAllMutation.mutate()}
              disabled={scanAllMutation.isPending}
              className="flex items-center gap-2 bg-accent-green/10 border border-accent-green/40 text-accent-green font-medium px-4 py-2 rounded-full text-sm hover:bg-accent-green/20 transition-all disabled:opacity-50"
              title="Sincronizar información WHOIS de todos los dominios"
            >
              <RefreshCw
                size={15}
                className={scanAllMutation.isPending ? 'animate-spin' : ''}
              />
              Sincronizar Todos
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20"
            >
              <Plus size={16} />
              Registrar Dominio
            </button>
          </>
        }
      />

      {/* 2. NOC COMMAND CENTER: KPI STRIP */}
      <NOCKpiGrid columns={4}>
        {/* KPI 1: Salud de Dominios */}
        <NOCKpiCard
          title="Salud de Dominios"
          icon={<ShieldCheck size={16} className="text-accent-green" />}
          badge={{
            text: validitySla >= 95.0 ? 'Óptimo' : 'Atención',
            variant: validitySla >= 95.0 ? 'success' : 'warning',
          }}
          value={`${validitySla}%`}
          valueSuffix="activos"
          progress={{ value: validitySla }}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Resolución de Zona</span>
              <span>{activeCount} de {totalCount} dominios</span>
            </div>
          }
        />

        {/* KPI 2: Por Expirar */}
        <NOCKpiCard
          title="Próximos a Expirar"
          icon={<AlertTriangle size={16} className="text-amber-400" />}
          badge={{
            text: '≤ 30 días',
            variant: expiringCount > 0 ? 'warning' : 'neutral',
          }}
          value={expiringCount}
          valueColor={expiringCount > 0 ? 'text-amber-400' : 'text-text-main'}
          valueSuffix="dominios"
          subtitle="Requieren renovación con el Registrador"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Ventana de Renovación</span>
              <span className="text-amber-400 font-medium">Auto-alerta activa</span>
            </div>
          }
        />

        {/* KPI 3: Distribución */}
        <NOCKpiCard
          title="Estado de Cobertura"
          icon={<Zap size={16} className="text-sky-400" />}
          badge={{
            text: `${totalCount} FQDNs`,
            variant: 'neutral',
          }}
          distribution={[
            { label: 'Activos', count: activeCount, variant: 'success' },
            { label: 'Por expirar', count: expiringCount, variant: 'warning' },
            { label: 'Expirados', count: expiredCount, variant: 'danger' },
          ]}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>ICANN WHOIS sync</span>
              <span className="text-accent-green">Sincronizado</span>
            </div>
          }
        />

        {/* KPI 4: Frecuencia de Verificación */}
        <NOCKpiCard
          title="Carga de Monitoreo"
          icon={<Server size={16} className="text-accent-green" />}
          badge={{
            text: 'Celery Beat',
            variant: 'neutral',
          }}
          value={totalCount > 0 ? `${totalCount} checks` : '0 checks'}
          valueColor="text-accent-green"
          valueSuffix="diarios"
          subtitle="Consulta automática de servidores WHOIS"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Protocolo de Consulta</span>
              <span className="text-accent-green font-medium font-mono">Port 43 / RDAP</span>
            </div>
          }
        />
      </NOCKpiGrid>

      {/* 3. TOOLBAR: Omnibar Search + Status Pills + Grid/Table Switcher */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por dominio, registrador o servidores DNS..."
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        statusPills={[
          { id: 'all', label: 'Todos', count: totalCount, variant: 'all' },
          { id: 'expiring', label: 'Por expirar', count: expiringCount, variant: 'warning' },
          { id: 'expired', label: 'Expirados / Errores', count: expiredCount, variant: 'danger' },
        ]}
        selectedStatus={filter}
        onStatusChange={(st) => setFilter(st as FilterType)}
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
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-sm"
            >
              <RefreshCw size={13} />
              Sincronizar WHOIS Seleccionados
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

      {/* 5. MAIN CONTENT: DUAL VIEW (GRID OR TABLE) */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : filteredDomains && filteredDomains.length > 0 ? (
        viewMode === 'grid' ? (
          /* Grid View (Cards) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDomains.map((domain: DomainInfo) => {
              const status = getStatusType(domain);
              const days = domain.days_until_expiration;
              const nsList = renderNameServersList(domain.name_servers);
              const isSelected = selectedIds.includes(domain.id);
              const isScanning = scanningId === domain.id;

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
                    {/* Top Bar: Checkbox, Icon, Domain, Radar & Status */}
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(domain);
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

                        <div className="w-9 h-9 rounded-xl bg-bg-dark border border-border-base flex items-center justify-center shrink-0 text-accent-green group-hover:border-accent-green/40 transition-colors">
                          <Globe2 size={16} />
                        </div>
                        <div className="overflow-hidden">
                          <h3
                            className="font-bold text-text-main truncate text-base group-hover:text-accent-green transition-colors font-sans"
                            title={domain.domain}
                          >
                            {domain.domain}
                          </h3>
                          <span className="text-xs font-medium text-text-dim truncate block">
                            {domain.registrar || 'Registrador no especificado'}
                          </span>
                        </div>
                      </div>

                      {/* Radar & Status */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {domain.status === 'active' && (
                          <span className="relative flex h-2 w-2 mr-0.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                          </span>
                        )}
                        <StatusBadge status={status} />
                      </div>
                    </div>

                    {/* Card Content Details */}
                    <div className="space-y-2 text-xs text-text-muted bg-bg-dark/50 rounded-xl p-3 border border-border-base/40">
                      <div className="flex items-center justify-between border-b border-border-base/40 pb-1.5">
                        <span className="flex items-center gap-1.5 text-text-dim font-medium">
                          <Building size={13} /> Registrador:
                        </span>
                        <span
                          className="font-mono text-text-main font-semibold truncate max-w-[180px]"
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
                              ? 'text-rose-400'
                              : days !== null && days <= 30
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {days !== null ? (days <= 0 ? 'Expirado' : `${days} días`) : 'N/A'}
                        </span>
                      </div>
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
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors disabled:opacity-50"
                        title="Consultar WHOIS ahora"
                      >
                        <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(domain, e)}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors"
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
                        className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors"
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
        ) : (
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
              : 'Comienza a monitorear la vigencia y datos WHOIS de tus dominios.'
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

      {/* 6. SLIDE-OVER DETAIL DRAWER (Zero Context Loss with NOCDrawer) */}
      <NOCDrawer
        isOpen={!!selectedDomain}
        onClose={() => setSelectedDomain(null)}
        title={selectedDomain?.domain || ''}
        subtitle={
          selectedDomain && (
            <div className="flex items-center gap-2">
              <span>Registrador: {selectedDomain.registrar || 'Desconocido'}</span>
              <span>•</span>
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
        statusBadge={selectedDomain && <StatusBadge status={getStatusType(selectedDomain)} />}
        headerActions={
          selectedDomain && (
            <button
              type="button"
              onClick={() => scanMutation.mutate(selectedDomain.id)}
              disabled={scanMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-black rounded-full text-xs font-semibold transition-all disabled:opacity-50"
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Vigencia</div>
                <div
                  className={`text-base font-bold font-mono mt-0.5 ${
                    selectedDomain.days_until_expiration !== null && selectedDomain.days_until_expiration <= 30
                      ? 'text-rose-400'
                      : 'text-accent-green'
                  }`}
                >
                  {selectedDomain.days_until_expiration !== null
                    ? `${selectedDomain.days_until_expiration}d`
                    : 'N/A'}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Expiración</div>
                <div className="text-sm font-semibold font-mono text-text-main mt-0.5 truncate">
                  {selectedDomain.expiration_date
                    ? new Date(selectedDomain.expiration_date).toLocaleDateString('es-ES')
                    : 'N/A'}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Creación</div>
                <div className="text-sm font-semibold font-mono text-text-muted mt-0.5 truncate">
                  {selectedDomain.creation_date
                    ? new Date(selectedDomain.creation_date).toLocaleDateString('es-ES')
                    : 'N/A'}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Servidores NS</div>
                <div className="text-sm font-semibold font-mono text-accent-blue mt-0.5">
                  {renderNameServersList(selectedDomain.name_servers).length} Servidores
                </div>
              </div>
            </div>
          )
        }
        tabs={[
          { id: 'overview', label: 'Vigencia & Estado', icon: <Calendar size={13} /> },
          { id: 'nameservers', label: 'Servidores DNS (NS)', icon: <Server size={13} /> },
          { id: 'raw', label: 'Registro WHOIS', icon: <FileText size={13} /> },
        ]}
        activeTab={drawerTab}
        onTabChange={(t) => setDrawerTab(t as any)}
        footerActions={
          selectedDomain && (
            <>
              <button
                type="button"
                onClick={() => handleOpenEdit(selectedDomain)}
                className="flex items-center gap-1.5 px-4 py-2 border border-border-base text-text-muted hover:text-text-main hover:bg-bg-dark rounded-full text-xs font-semibold transition-colors"
              >
                <Pencil size={14} />
                Editar Dominio
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(selectedDomain)}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-full text-xs font-semibold transition-colors"
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
              <div className="flex justify-between">
                <span className="text-text-dim font-medium">Última Sincronización:</span>
                <span className="font-mono text-text-muted">
                  {selectedDomain.last_scanned_at
                    ? new Date(selectedDomain.last_scanned_at).toLocaleString('es-ES')
                    : 'Nunca'}
                </span>
              </div>
            </div>
          </div>
        )}

        {selectedDomain && drawerTab === 'nameservers' && (
          <div className="space-y-4">
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4">
              <h4 className="text-xs font-semibold text-text-muted mb-3 flex items-center gap-1.5">
                <Server size={14} className="text-accent-green" />
                Servidores de Nombres Delegados (NS)
              </h4>
              {renderNameServersList(selectedDomain.name_servers).length > 0 ? (
                <div className="space-y-2">
                  {renderNameServersList(selectedDomain.name_servers).map((ns, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-bg-card border border-border-base/60 rounded-xl text-xs font-mono text-text-main flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                      <span>{ns}</span>
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

        {selectedDomain && drawerTab === 'raw' && (
          <div className="space-y-4">
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3 text-xs font-mono">
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-sans font-medium">País Registrante:</span>
                <span className="font-bold text-text-main">
                  {selectedDomain.registrant_country || 'No disponible'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-sans font-medium">Última Actualización WHOIS:</span>
                <span className="font-bold text-text-main">
                  {selectedDomain.last_updated || 'No disponible'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-sans font-medium">Estado ICANN:</span>
                <span className="font-bold text-accent-green">
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
                <Globe2 size={18} className="text-accent-green" />
                {editingDomain ? 'Editar Dominio' : 'Monitorear Nuevo Dominio WHOIS'}
              </h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-text-muted hover:text-text-main transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Nombre de Dominio (FQDN)
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. empresa.com"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-mono"
                />
                <p className="text-[11px] text-text-dim mt-1.5">
                  Ingresa solo el nombre de dominio (sin https:// ni subdominios profundos).
                </p>
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
                  ) : editingDomain ? (
                    'Actualizar'
                  ) : (
                    'Guardar y Consultar'
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
