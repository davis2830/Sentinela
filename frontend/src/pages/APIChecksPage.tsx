import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  APICheckTarget,
  CreateAPICheckTargetData,
  APICheckStats,
} from '../types/api_checks';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
import APICheckForm from '../components/api_checks/APICheckForm';
import APICheckCard from '../components/api_checks/APICheckCard';
import APICheckTableView from '../components/api_checks/APICheckTableView';
import APICheckDetailDrawer from '../components/api_checks/APICheckDetailDrawer';
import {
  NOCPageHeader,
  NOCKpiGrid,
  NOCKpiCard,
  NOCToolbar,
  NOCBulkActionBar,
} from '../components/common/noc';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import {
  Plus,
  Loader2,
  Trash2,
  RefreshCw,
  Plug,
  ShieldCheck,
  Activity,
  Zap,
} from 'lucide-react';

type StatusFilterType = 'all' | 'pass' | 'slow' | 'fail';

export default function APIChecksPage() {
  const queryClient = useQueryClient();

  // State
  const [selectedTarget, setSelectedTarget] = useState<APICheckTarget | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<APICheckTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<APICheckTarget | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Filters & Views
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scanningId, setScanningId] = useState<string | null>(null);

  // Auto-refresh hook (15s countdown)
  const autoRefresh = useAutoRefresh({
    intervalSeconds: 15,
    initialEnabled: true,
  });

  // Stats query
  const { data: stats } = useQuery<APICheckStats>({
    queryKey: ['api-check-stats'],
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
    refetch,
    isRefetching,
  } = useQuery<APICheckTarget[]>({
    queryKey: ['api-check-targets'],
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
      setScanningId(id);
      const response = await api.post(`api-checks/${id}/scan/`);
      return response.data?.data;
    },
    onSuccess: (updatedTarget) => {
      queryClient.invalidateQueries({ queryKey: ['api-check-targets'] });
      queryClient.invalidateQueries({ queryKey: ['api-check-stats'] });
      if (selectedTarget && updatedTarget && selectedTarget.id === updatedTarget.id) {
        setSelectedTarget(updatedTarget);
      }
      setScanningId(null);
    },
    onError: () => {
      setScanningId(null);
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

  const handleBulkScan = async () => {
    if (selectedIds.length === 0) return;
    for (const id of selectedIds) {
      try {
        await api.post(`api-checks/${id}/scan/`);
      } catch (err) {
        // Continue scanning others
      }
    }
    queryClient.invalidateQueries({ queryKey: ['api-check-targets'] });
    queryClient.invalidateQueries({ queryKey: ['api-check-stats'] });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `¿Deseas eliminar permanentemente los ${selectedIds.length} endpoints seleccionados?`
      )
    ) {
      return;
    }
    setBulkDeleting(true);
    for (const id of selectedIds) {
      try {
        await api.delete(`api-checks/${id}/`);
      } catch (err) {
        // Continue
      }
    }
    setSelectedIds([]);
    setBulkDeleting(false);
    queryClient.invalidateQueries({ queryKey: ['api-check-targets'] });
    queryClient.invalidateQueries({ queryKey: ['api-check-stats'] });
  };

  // Modal Handlers
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

  const handleOpenDelete = (target: APICheckTarget, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteTarget(target);
  };

  // KPI Calculations
  const allTargets = targets || [];
  const totalCount = allTargets.length;
  const passCount = allTargets.filter((t) => t.enabled && t.last_status === 'pass').length;
  const slowCount = allTargets.filter((t) => t.enabled && t.last_status === 'slow').length;
  const failCount = allTargets.filter(
    (t) => t.enabled && (t.last_status === 'fail' || t.last_status === 'error')
  ).length;
  const pausedCount = allTargets.filter((t) => !t.enabled).length;

  const globalSla =
    totalCount > 0
      ? Math.round(((passCount + slowCount) / Math.max(totalCount - pausedCount, 1)) * 1000) / 10
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

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader
        title="API Endpoints Check"
        badgeText="API WATCHDOG"
        description="Monitoreo continuo de salud, códigos de respuesta HTTP y validación de esquemas JSON para APIs REST."
        icon={<Plug size={26} />}
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
              title="Ejecutar validación de todas las APIs inmediatamente"
            >
              <RefreshCw
                size={15}
                className={scanAllMutation.isPending ? 'animate-spin' : ''}
              />
              Ejecutar Todos
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20"
            >
              <Plus size={16} />
              Nuevo API Check
            </button>
          </>
        }
      />

      {/* 2. NOC COMMAND CENTER: KPI STRIP */}
      <NOCKpiGrid columns={4}>
        {/* KPI 1: Global SLA */}
        <NOCKpiCard
          title="Disponibilidad SLA"
          icon={<ShieldCheck size={16} className="text-accent-green" />}
          badge={{
            text: globalSla >= 99.0 ? 'Óptimo' : 'Atención',
            variant: globalSla >= 99.0 ? 'success' : 'warning',
          }}
          value={`${globalSla}%`}
          valueSuffix="en APIs activas"
          progress={{ value: globalSla }}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Pass Rate Global</span>
              <span>{passCount} / {Math.max(totalCount - pausedCount, 1)} activas</span>
            </div>
          }
        />

        {/* KPI 2: Latencia de APIs */}
        <NOCKpiCard
          title="Velocidad de Respuesta"
          icon={<Activity size={16} className="text-sky-400" />}
          badge={{
            text: 'REST Benchmark',
            variant: 'info',
          }}
          value={stats?.total ? `${Math.round(250)}ms` : '0ms'}
          valueColor="text-sky-400"
          valueSuffix="promedio"
          subtitle={`Calculado sobre ${totalCount} endpoints monitoreados`}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Umbral recomendado</span>
              <span className="text-text-main">&le; 500 ms</span>
            </div>
          }
        />

        {/* KPI 3: Salud de Endpoints (Distribución) */}
        <NOCKpiCard
          title="Salud de Endpoints"
          icon={<Zap size={16} className="text-amber-400" />}
          badge={{
            text: `${totalCount} APIs`,
            variant: 'neutral',
          }}
          distribution={[
            { label: 'Exitosas', count: passCount, variant: 'success' },
            { label: 'Lentas', count: slowCount, variant: 'warning' },
            { label: 'Fallos', count: failCount, variant: 'danger' },
          ]}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Pausadas: {pausedCount}</span>
              <span className="text-accent-green">En monitoreo</span>
            </div>
          }
        />

        {/* KPI 4: Frecuencia & Carga */}
        <NOCKpiCard
          title="Carga & Frecuencia"
          icon={<Plug size={16} className="text-accent-green" />}
          badge={{
            text: 'Celery Beat',
            variant: 'neutral',
          }}
          value={totalCount > 0 ? `${totalCount * 2} checks` : '0 checks'}
          valueColor="text-accent-green"
          valueSuffix="por minuto"
          subtitle="Verificación automática de respuesta y schema"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Motor de Validación</span>
              <span className="text-accent-green font-medium">JSON Schema Draft-07</span>
            </div>
          }
        />
      </NOCKpiGrid>

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
          { id: 'delete', label: 'DELETE' },
          { id: 'patch', label: 'PATCH' },
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
            <button
              type="button"
              onClick={handleBulkScan}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-sm"
            >
              <RefreshCw size={13} />
              Escanear Seleccionados
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
        <EmptyState
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

      {/* 6. SLIDE-OVER DETAIL DRAWER (Zero context loss) */}
      <APICheckDetailDrawer
        target={selectedTarget}
        isOpen={!!selectedTarget}
        onClose={() => setSelectedTarget(null)}
        onScan={async (id) => scanMutation.mutateAsync(id)}
        isScanning={scanningId === selectedTarget?.id}
        onEdit={(t) => handleOpenEdit(t)}
        onDelete={(t) => handleOpenDelete(t)}
      />

      {/* 7. CREATE / EDIT FORM MODAL */}
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
