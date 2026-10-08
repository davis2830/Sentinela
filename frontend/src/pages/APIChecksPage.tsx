import { useLinkedResource } from '../hooks/useLinkedResource';
import { useUrlFilter } from '../hooks/useUrlFilter';
import CompactModuleSummary from '../components/common/CompactModuleSummary';
import AdminButton from '../components/common/AdminButton';
import { useAuthStore } from '../store/authStore';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import ReloadDataButton from '../components/common/ReloadDataButton';
import { waitForFreshScan, type QueuedScan } from '../utils/scanPolling';
import type {
  APICheckTarget,
  CreateAPICheckTargetData,
  APICheckStats,
} from '../types/api_checks';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
import APICheckCard from '../components/api_checks/APICheckCard';
import APICheckTableView from '../components/api_checks/APICheckTableView';
import APICheckDetailDrawer from '../components/api_checks/APICheckDetailDrawer';
import APICheckForm from '../components/api_checks/APICheckForm';
import {
  NOCPageHeader,
  NOCKpiGrid,
  NOCKpiCard,
  NOCToolbar,
  NOCBulkActionBar,
} from '../components/common/noc';
import { useConnectivityRefresh } from '../hooks/useConnectivityRefresh';
import { usePersistentViewMode } from '../hooks/usePersistentViewMode';
import {
  Plug,
  Plus,
  Loader2,
  Trash2,
  RefreshCw,
  Activity,
  ShieldCheck,
  Zap,
  Download,
  Pause,
  Play,
} from 'lucide-react';

type StatusFilterType = 'all' | 'pass' | 'slow' | 'fail';

export default function APIChecksPage() {
  const organizationId = useAuthStore(state => state.user?.organization?.id);

  const queryClient = useQueryClient();

  // State
  const [methodFilter, setMethodFilter] = useUrlFilter('method', ["all","GET","POST","PUT","PATCH","DELETE","HEAD"] as const);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useUrlFilter('status', ["all","pass","slow","fail"] as const);
  const [viewMode, setViewMode] = usePersistentViewMode('api_checks', 'table');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scanningId, setScanningId] = useState<string | null>(null);

  // Read cadence follows the server plan; GET never triggers a scan.
  const autoRefresh = useConnectivityRefresh();

  // Stats query
  const { data: stats } = useQuery<APICheckStats>({
    queryKey: ['api-check-stats', organizationId],
    queryFn: async () => {
      const response = await api.get('api-checks/stats/');
      return (response.data?.data || {}) as APICheckStats;
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // List targets query
  const {
    data: targets,
    isLoading,
  } = useQuery<APICheckTarget[]>({
    queryKey: ['api-check-targets', organizationId],
    queryFn: async () => {
      const response = await api.get('api-checks/');
      return (response.data?.data || []) as APICheckTarget[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: CreateAPICheckTargetData) => {
      await api.post('api-checks/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-check-targets', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['api-check-stats', organizationId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateAPICheckTargetData }) => {
      await api.patch(`api-checks/${id}/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-check-targets', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['api-check-stats', organizationId] });
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (id: string) => {
      setScanningId(id);
      const response = await api.post(`api-checks/${id}/scan/`);
      const queued = response.data?.data as QueuedScan;
      return waitForFreshScan<APICheckTarget>(
        queued,
        async () => (await api.get(`api-checks/${id}/`)).data?.data as APICheckTarget,
        (target) => target.last_checked_at,
      );
    },
    onSuccess: (updatedTarget) => {
      queryClient.invalidateQueries({ queryKey: ['api-check-targets', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['api-check-stats', organizationId] });
      if (selectedTarget && updatedTarget && selectedTarget.id === updatedTarget.id) {
        setSelectedTarget(updatedTarget);
      }
      setScanningId(null);
    },
    onError: () => {
      setScanningId(null);
    },
  });


  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`api-checks/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-check-targets', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['api-check-stats', organizationId] });
      if (selectedTarget?.id === deleteTarget?.id) {
        setSelectedTarget(null);
      }
      setDeleteTarget(null);
    },
  });

  // Bulk Actions
  const handleToggleSelect = (target: APICheckTarget) => {
    setSelectedIds((prev) =>
      prev.includes(target.id) ? prev.filter((id) => id !== target.id) : [...prev, target.id]
    );
  };

  const handleSelectAllToggle = () => {
    if (!filteredTargets || filteredTargets.length === 0) return;
    if (selectedIds.length === filteredTargets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTargets.map((t: APICheckTarget) => t.id));
    }
  };

  const [bulkProcessing, setBulkProcessing] = useState(false);

  const handleBulkAction = async (action: 'scan' | 'pause' | 'resume' | 'delete') => {
    if (selectedIds.length === 0) return;

    if (action === 'delete') {
      if (
        !window.confirm(
          `¿Deseas eliminar permanentemente los ${selectedIds.length} endpoints seleccionados?`
        )
      ) {
        return;
      }
    }

    setBulkProcessing(true);
    try {
      await api.post('api-checks/bulk-action/', {
        action,
        target_ids: selectedIds,
      });
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['api-check-targets', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['api-check-stats', organizationId] });
    } catch {
      // Fallback
      if (action === 'scan') {
        for (const id of selectedIds) {
          api.post(`api-checks/${id}/scan/`).catch(() => {});
        }
      } else if (action === 'delete') {
        for (const id of selectedIds) {
          api.delete(`api-checks/${id}/`).catch(() => {});
        }
      }
      setSelectedIds([]);
    } finally {
      setBulkProcessing(false);
    }
  };

  // Export CSV Report
  const handleExportCSV = () => {
    if (!targets || targets.length === 0) return;
    const headers = [
      'Nombre Servicio',
      'Metodo HTTP',
      'URL Endpoint',
      'Status Esperado',
      'Ultimo Status HTTP',
      'Latencia Real (ms)',
      'Max Latencia Permitida (ms)',
      'Ultimo Estado',
      'Monitoreo Activo',
      'Frecuencia (seg)',
      'Ultima Comprobacion',
    ];
    const rows = targets.map((t) => [
      `"${t.name}"`,
      t.method,
      `"${t.url}"`,
      t.expected_status,
      t.last_http_status ?? 'N/A',
      t.last_response_time_ms !== null && t.last_response_time_ms !== undefined
        ? Math.round(t.last_response_time_ms)
        : 'N/A',
      t.expected_response_time_ms,
      t.last_status || 'desconocido',
      t.enabled ? 'Activo' : 'Pausado',
      t.check_interval,
      t.last_checked_at ? new Date(t.last_checked_at).toISOString() : 'N/A',
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `sentinel_api_endpoints_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Modals & Drawer State
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<APICheckTarget | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<APICheckTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<APICheckTarget | null>(null);

  const handleOpenCreate = () => {
    setEditingTarget(null);
    setShowForm(true);
  };

  const handleOpenEdit = (target: APICheckTarget, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTarget(target);
    setShowForm(true);
  };

  const handleOpenDelete = (target: APICheckTarget, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteTarget(target);
  };

  const handleFormSubmit = async (data: CreateAPICheckTargetData) => {
    if (editingTarget) {
      await updateMutation.mutateAsync({ id: editingTarget.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    setShowForm(false);
    setEditingTarget(null);
  };

  // KPI Calculations
  const allTargets = targets || [];
  const totalCount = stats?.total || allTargets.length;
  const passCount = stats?.pass_count || allTargets.filter((t: APICheckTarget) => t.last_status === 'pass').length;
  const slowCount = stats?.slow_count || allTargets.filter((t: APICheckTarget) => t.last_status === 'slow').length;
  const failCount =
    stats?.fail_count ||
    allTargets.filter((t: APICheckTarget) => t.last_status === 'fail' || t.last_status === 'error').length;
  const pausedCount = stats?.paused_count || allTargets.filter((t: APICheckTarget) => !t.enabled).length;

  const globalSla =
    totalCount > 0
      ? Math.round((passCount / Math.max(totalCount - pausedCount, 1)) * 1000) / 10
      : 100.0;

  // Filtered & Searched Targets
  const filteredTargets = allTargets.filter((t: APICheckTarget) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.url.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (methodFilter !== 'all' && t.method.toLowerCase() !== methodFilter.toLowerCase()) {
      return false;
    }

    if (statusFilter === 'pass') return t.last_status === 'pass';
    if (statusFilter === 'slow') return t.last_status === 'slow';
    if (statusFilter === 'fail') return t.last_status === 'fail' || t.last_status === 'error';

    return true;
  });

  useLinkedResource(targets, selectedTarget, setSelectedTarget);

  return (
    <div className="compact-workspace space-y-6 animate-in fade-in duration-300 font-sans">
      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader queryKeys={["api-check-targets","api-check-stats","api-check-results"]}
        title="API Endpoints Check"
        badgeText="API WATCHDOG"
        description="Monitoreo sintético continuo, benchmarking de latencia REST, códigos de respuesta HTTP y validación de esquemas JSON."
        icon={<Plug size={26} />}
        autoRefresh={{
          enabled: autoRefresh.enabled,
          countdown: autoRefresh.countdown,
          onToggle: autoRefresh.toggle,
          intervalSeconds: autoRefresh.intervalSeconds,
          ready: autoRefresh.ready,
          blockedReason: autoRefresh.blockedReason,
        }}
        actions={
          <>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={!targets || targets.length === 0}
              className="flex items-center gap-2 bg-bg-card border border-border-base text-text-muted hover:text-text-main font-medium px-4 py-2 rounded-full text-sm hover:bg-bg-card-hover transition-all disabled:opacity-50 cursor-pointer"
              title="Exportar inventario de endpoints a CSV"
            >
              <Download size={15} />
              <span>Exportar</span>
            </button>


            <AdminButton
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 cursor-pointer"
            >
              <Plus size={16} />
              <span>Nuevo API Check</span>
            </AdminButton>
          </>
        }
      />

      {/* 2. NOC COMMAND CENTER: KPI STRIP */}
      <CompactModuleSummary variant="status" items={[
        {label:'API Checks',value:targets ? totalCount : null,icon:Plug,tone:'neutral'},
        {label:'Correctos',value:targets ? passCount : null,icon:ShieldCheck,tone:'success'},
        {label:'Lentos',value:targets ? slowCount : null,icon:Activity,tone:'warning'},
        {label:'Fallos',value:targets ? failCount : null,icon:Zap,tone:'danger'},
        {label:'Pausados',value:targets ? pausedCount : null,icon:Pause,tone:'muted'}
      ]} />

      {/* 3. TOOLBAR: Omnibar Search + Methods + Status Pills + Grid/Table Switcher */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por nombre de API, ruta o URL de endpoint..."
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        categoryLabel="Método:"
        categories={[
          { id: 'all', label: 'Todos' },
          { id: 'get', label: 'GET' },
          { id: 'post', label: 'POST' },
          { id: 'put', label: 'PUT' },
          { id: 'patch', label: 'PATCH' },
          { id: 'delete', label: 'DELETE' },
          { id: 'head', label: 'HEAD' },
        ]}
        selectedCategory={methodFilter}
        onCategoryChange={setMethodFilter}
        statusPills={[
          { id: 'all', label: 'Todos', count: totalCount, variant: 'all' },
          { id: 'pass', label: 'Exitosas', count: passCount, variant: 'success' },
          { id: 'slow', label: 'Lentas', count: slowCount, variant: 'warning' },
          { id: 'fail', label: 'Con Fallos', count: failCount, variant: 'danger' },
        ]}
        selectedStatus={statusFilter}
        onStatusChange={(st) => setStatusFilter(st as StatusFilterType)}
      />

      {/* 4. FLOATING BULK ACTIONS BAR */}
      <NOCBulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        itemLabel="endpoints"
        actions={
          <>

            <AdminButton
              type="button"
              onClick={() => handleBulkAction('pause')}
              disabled={bulkProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-dark border border-border-base text-text-muted hover:text-text-main font-semibold rounded-full text-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Pause size={13} />
              Pausar
            </AdminButton>
            <AdminButton
              type="button"
              onClick={() => handleBulkAction('resume')}
              disabled={bulkProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-dark border border-border-base text-accent-green hover:bg-accent-green/10 font-semibold rounded-full text-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Play size={13} />
              Reanudar
            </AdminButton>
            <AdminButton
              type="button"
              onClick={() => handleBulkAction('delete')}
              disabled={bulkProcessing}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-red text-white font-semibold rounded-full text-xs hover:bg-accent-red/90 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Trash2 size={13} />
              {bulkProcessing ? 'Procesando...' : 'Eliminar'}
            </AdminButton>
          </>
        }
      />

      {/* 5. MAIN CONTENT: DUAL VIEW (GRID OR TABLE) */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : filteredTargets && filteredTargets.length > 0 ? (
        viewMode === 'grid' ? (
          /* Grid View (Cards) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTargets.map((target: APICheckTarget) => (
              <APICheckCard
                key={target.id}
                target={target}
                isSelected={selectedIds.includes(target.id)}
                onToggleSelect={() => handleToggleSelect(target)}
                onClick={() => setSelectedTarget(target)}
                onScan={(e) => {
                  e.stopPropagation();
                  scanMutation.mutate(target.id);
                }}
                isScanning={scanningId === target.id}
                onEdit={(e) => handleOpenEdit(target, e)}
                onDelete={(e) => handleOpenDelete(target, e)}
              />
            ))}
          </div>
        ) : (
          /* Compact NOC Table View */
          <APICheckTableView
            targets={filteredTargets}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAllToggle}
            onSelectTarget={(t) => setSelectedTarget(t)}
            onScan={(id, e) => {
              e.stopPropagation();
              scanMutation.mutate(id);
            }}
            scanningId={scanningId}
            onEdit={(t, e) => handleOpenEdit(t, e)}
            onDelete={(t, e) => handleOpenDelete(t, e)}
          />
        )
      ) : (
        <EmptyState requiresAdmin
          icon={Plug}
          title={
            searchTerm || methodFilter !== 'all' || statusFilter !== 'all'
              ? 'No se encontraron endpoints con los filtros seleccionados'
              : 'No hay API Check targets configurados'
          }
          description={
            searchTerm || methodFilter !== 'all' || statusFilter !== 'all'
              ? 'Intenta cambiar el término de búsqueda o restablecer los filtros activos.'
              : 'Comienza a monitorear tus endpoints REST, tiempos de respuesta y validación de schemas.'
          }
          actionLabel={
            searchTerm || methodFilter !== 'all' || statusFilter !== 'all'
              ? 'Limpiar Filtros'
              : 'Nuevo API Check'
          }
          onAction={() => {
            if (searchTerm || methodFilter !== 'all' || statusFilter !== 'all') {
              setSearchTerm('');
              setMethodFilter('all');
              setStatusFilter('all');
            } else {
              handleOpenCreate();
            }
          }}
        />
      )}

      {/* 6. SLIDE-OVER DETAIL DRAWER */}
      <APICheckDetailDrawer
        target={selectedTarget}
        isOpen={!!selectedTarget}
        onClose={() => setSelectedTarget(null)}
        onScan={async (id) => scanMutation.mutateAsync(id)}
        isScanning={scanningId === selectedTarget?.id}
        onEdit={(t) => handleOpenEdit(t)}
        onDelete={(t) => handleOpenDelete(t)}
      />

      {/* 7. CREATE / EDIT FORM MODAL WITH LIVE TEST */}
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

      {/* 8. DELETE CONFIRMATION MODAL */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.name || 'este endpoint'}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
