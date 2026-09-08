import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wrench,
  Plus,
  Clock,
  Calendar,
  Layers,
  Shield,
  Download,
  CheckCircle2,
  Play,
  XCircle,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { usePersistentViewMode } from '../hooks/usePersistentViewMode';
import NOCPageHeader from '../components/common/noc/NOCPageHeader';
import NOCKpiGrid from '../components/common/noc/NOCKpiGrid';
import NOCKpiCard from '../components/common/noc/NOCKpiCard';
import NOCToolbar from '../components/common/noc/NOCToolbar';
import NOCBulkActionBar from '../components/common/noc/NOCBulkActionBar';
import { MaintenanceCard } from '../components/maintenance/MaintenanceCard';
import { MaintenanceTableView } from '../components/maintenance/MaintenanceTableView';
import { MaintenanceWindowModal } from '../components/maintenance/MaintenanceWindowModal';
import { MaintenanceDetailDrawer } from '../components/maintenance/MaintenanceDetailDrawer';
import type { MaintenanceWindow, MaintenanceStats } from '../types';

export default function MaintenancePage() {
  const queryClient = useQueryClient();

  // State
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerTarget, setDrawerTarget] = useState<MaintenanceWindow | null>(null);
  const [modalTarget, setModalTarget] = useState<MaintenanceWindow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Persistent view mode (grid vs table)
  const [viewMode, setViewMode] = usePersistentViewMode('maintenance', 'grid');

  // Auto-refresh hook (30s interval)
  const autoRefresh = useAutoRefresh({ intervalSeconds: 30 });

  // 1. Fetch Maintenance Windows List
  const {
    data: windows = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<MaintenanceWindow[]>({
    queryKey: ['maintenance-windows', statusFilter, searchQuery],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.get('maintenance/', { params });
      return res.data?.data || [];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // 2. Fetch NOC Maintenance Stats
  const { data: stats } = useQuery<MaintenanceStats>({
    queryKey: ['maintenance-stats'],
    queryFn: async () => {
      const res = await api.get('maintenance/stats/');
      return res.data?.data || {
        active_in_progress: 0,
        upcoming_7d: 0,
        targets_in_maintenance: 0,
        scheduled_hours_month: 0,
      };
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('maintenance/', data);
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-windows'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-stats'] });
      setIsModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.patch(`maintenance/${id}/`, data);
      return res.data?.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-windows'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-stats'] });
      if (drawerTarget?.id === updated?.id) setDrawerTarget(updated);
      setIsModalOpen(false);
    },
  });

  const startMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`maintenance/${id}/start/`);
      return res.data?.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-windows'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-stats'] });
      if (drawerTarget?.id === updated?.id) setDrawerTarget(updated);
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`maintenance/${id}/complete/`);
      return res.data?.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-windows'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-stats'] });
      if (drawerTarget?.id === updated?.id) setDrawerTarget(updated);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`maintenance/${id}/cancel/`);
      return res.data?.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-windows'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-stats'] });
      if (drawerTarget?.id === updated?.id) setDrawerTarget(updated);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`maintenance/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-windows'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-stats'] });
      setDrawerTarget(null);
    },
  });

  const addUpdateMutation = useMutation({
    mutationFn: async ({ id, message, status }: { id: string; message: string; status?: string }) => {
      const res = await api.post(`maintenance/${id}/updates/`, { message, status });
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-windows'] });
      if (drawerTarget) {
        api.get(`maintenance/${drawerTarget.id}/`).then((res: any) => {
          setDrawerTarget(res.data?.data);
        });
      }
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async ({ action, ids }: { action: string; ids: string[] }) => {
      const res = await api.post('maintenance/bulk-action/', {
        maintenance_ids: ids,
        action,
      });
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-windows'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-stats'] });
      setSelectedIds(new Set());
    },
  });

  // Filtered list
  const filteredWindows = useMemo(() => {
    return windows.filter((w) => {
      if (statusFilter === 'in_progress') return w.status === 'in_progress';
      if (statusFilter === 'scheduled') return w.status === 'scheduled';
      if (statusFilter === 'completed') return w.status === 'completed';
      if (statusFilter === 'cancelled') return w.status === 'cancelled';
      return true;
    });
  }, [windows, statusFilter]);

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredWindows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredWindows.map((w) => w.id)));
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!windows.length) return;
    const headers = [
      'ID',
      'Título',
      'Estado',
      'Inicio',
      'Fin',
      'Duración (min)',
      'Recurrencia',
      'Alertas Silenciadas',
      'Excluido de SLA',
      'Cuadrilla',
    ];
    const rows = windows.map((w) => [
      w.id,
      `"${(w.title || '').replace(/"/g, '""')}"`,
      w.status,
      w.start_time,
      w.end_time,
      w.duration_minutes,
      w.recurrence || 'none',
      w.suppress_notifications ? 'Sí' : 'No',
      w.exclude_from_sla ? 'Sí' : 'No',
      `"${(w.responsible_team_name || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sentinel_maintenances_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* 1. Header Unificado */}
      <NOCPageHeader
        title="Ventanas de Mantenimiento"
        badgeText="PLANIFICACIÓN & SUPRESIÓN"
        description="Planifica trabajos de infraestructura con supresión inteligente de alertas y protección de SLA."
        icon={<Wrench size={24} />}
        autoRefresh={{
          enabled: autoRefresh.enabled,
          countdown: autoRefresh.countdown,
          onToggle: autoRefresh.toggle,
        }}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="flex items-center gap-1.5 bg-bg-card border border-border-base text-text-muted hover:text-text-main font-medium px-3.5 py-2 rounded-full text-xs hover:bg-bg-card-hover transition-all disabled:opacity-50 cursor-pointer"
              title="Refrescar lista"
            >
              <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} />
              <span>Refrescar</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={!windows.length}
              className="flex items-center gap-1.5 bg-bg-card border border-border-base text-text-muted hover:text-text-main font-medium px-3.5 py-2 rounded-full text-xs hover:bg-bg-card-hover transition-all disabled:opacity-50 cursor-pointer"
              title="Exportar inventario a CSV"
            >
              <Download size={14} />
              <span>Exportar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setModalTarget(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-accent-green text-black font-bold px-4 py-2 rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 cursor-pointer"
            >
              <Plus size={15} />
              <span>Nuevo Mantenimiento</span>
            </button>
          </div>
        }
      />

      {/* 2. KPI Cards de Nivel Superior */}
      <NOCKpiGrid columns={4}>
        <NOCKpiCard
          title="Mantenimientos En Curso"
          value={stats?.active_in_progress ?? 0}
          valueColor="text-accent-yellow"
          icon={<Clock size={16} className="text-accent-yellow" />}
          badge={{
            text: (stats?.active_in_progress ?? 0) > 0 ? 'En curso' : 'Sin activos',
            variant: (stats?.active_in_progress ?? 0) > 0 ? 'warning' : 'neutral',
          }}
          subtitle="Halo de radar pulsante en vivo"
          footer={
            <div className="text-[11px] text-text-dim flex justify-between">
              <span>Estado en consola:</span>
              <span className="text-accent-yellow font-bold">Activo</span>
            </div>
          }
        />
        <NOCKpiCard
          title="Próximas Ventanas (7d)"
          value={stats?.upcoming_7d ?? 0}
          valueColor="text-accent-blue"
          icon={<Calendar size={16} className="text-accent-blue" />}
          badge={{
            text: 'Planificado',
            variant: 'info',
          }}
          subtitle="Trabajos programados en la semana"
          footer={
            <div className="text-[11px] text-text-dim flex justify-between">
              <span>Horizonte:</span>
              <span className="text-text-main font-mono">Próximos 7 días</span>
            </div>
          }
        />
        <NOCKpiCard
          title="Targets Protegidos"
          value={stats?.targets_in_maintenance ?? 0}
          valueColor="text-accent-green"
          icon={<Shield size={16} className="text-accent-green" />}
          badge={{
            text: 'Silenciado',
            variant: 'success',
          }}
          subtitle="Alertas silenciadas activamente"
          footer={
            <div className="text-[11px] text-text-dim flex justify-between">
              <span>Canales externos:</span>
              <span className="text-accent-green">Sin falsas alarmas</span>
            </div>
          }
        />
        <NOCKpiCard
          title="Horas Planificadas (Mes)"
          value={`${stats?.scheduled_hours_month ?? 0}h`}
          valueColor="text-text-main"
          icon={<Layers size={16} className="text-text-dim" />}
          badge={{
            text: 'Tiempo Reservado',
            variant: 'neutral',
          }}
          subtitle="Tiempo reservado en el mes"
          footer={
            <div className="text-[11px] text-text-dim flex justify-between">
              <span>Impacto en SLA:</span>
              <span className="text-accent-green font-medium">Excluido de castigo</span>
            </div>
          }
        />
      </NOCKpiGrid>

      {/* 3. Toolbar con Omnibar y Chips de Filtrado */}
      <NOCToolbar
        searchTerm={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Buscar por título, descripción o targets..."
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        statusPills={[
          { id: 'all', label: 'Todos', count: windows.length, variant: 'all' },
          {
            id: 'in_progress',
            label: 'En Curso',
            count: windows.filter((w) => w.status === 'in_progress').length,
            variant: 'warning',
          },
          {
            id: 'scheduled',
            label: 'Programados',
            count: windows.filter((w) => w.status === 'scheduled').length,
            variant: 'info',
          },
          {
            id: 'completed',
            label: 'Completados',
            count: windows.filter((w) => w.status === 'completed').length,
            variant: 'success',
          },
          {
            id: 'cancelled',
            label: 'Cancelados',
            count: windows.filter((w) => w.status === 'cancelled').length,
            variant: 'danger',
          },
        ]}
        selectedStatus={statusFilter}
        onStatusChange={setStatusFilter}
      />

      {/* 4. Barra Flotante de Acciones en Lote */}
      <NOCBulkActionBar
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        itemLabel="mantenimientos"
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                if (confirm(`¿Iniciar ${selectedIds.size} ventanas de mantenimiento seleccionadas?`)) {
                  bulkMutation.mutate({ action: 'start', ids: Array.from(selectedIds) });
                }
              }}
              className="px-3 py-1.5 rounded-full bg-accent-blue/20 hover:bg-accent-blue/30 text-accent-blue border border-accent-blue/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Play size={12} /> Iniciar en Lote
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`¿Marcar como completadas ${selectedIds.size} ventanas?`)) {
                  bulkMutation.mutate({ action: 'complete', ids: Array.from(selectedIds) });
                }
              }}
              className="px-3 py-1.5 rounded-full bg-accent-green text-black hover:bg-accent-green/90 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <CheckCircle2 size={12} /> Completar en Lote
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`¿Cancelar ${selectedIds.size} ventanas de mantenimiento?`)) {
                  bulkMutation.mutate({ action: 'cancel', ids: Array.from(selectedIds) });
                }
              }}
              className="px-3 py-1.5 rounded-full bg-bg-card hover:bg-bg-card-hover border border-border-base text-text-muted hover:text-text-main text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <XCircle size={12} /> Cancelar en Lote
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`¿Eliminar definitivamente ${selectedIds.size} ventanas de mantenimiento?`)) {
                  bulkMutation.mutate({ action: 'delete', ids: Array.from(selectedIds) });
                }
              }}
              className="px-3 py-1.5 rounded-full bg-accent-red/15 hover:bg-accent-red/25 border border-accent-red/30 text-accent-red text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 size={12} /> Eliminar en Lote
            </button>
          </>
        }
      />

      {/* 5. Contenido Principal (Cards vs Tabla) */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-64 bg-bg-card border border-border-base rounded-2xl animate-pulse p-6 space-y-4"
            >
              <div className="h-4 bg-bg-dark rounded-md w-1/3" />
              <div className="h-6 bg-bg-dark rounded-md w-3/4" />
              <div className="h-16 bg-bg-dark rounded-md w-full" />
            </div>
          ))}
        </div>
      ) : filteredWindows.length === 0 ? (
        <div className="bg-bg-card border border-border-base rounded-2xl p-12 text-center space-y-4 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center text-accent-blue mx-auto">
            <Wrench size={28} />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-main">
              {searchQuery ? 'No se encontraron resultados' : 'Sin ventanas de mantenimiento'}
            </h3>
            <p className="text-xs text-text-dim mt-1 max-w-sm mx-auto leading-relaxed">
              {searchQuery
                ? 'Prueba ajustando los términos de búsqueda o cambiando el filtro de estado.'
                : 'Planifica mantenimientos programados para suprimir alertas falsas positivas y proteger tu SLA.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              type="button"
              onClick={() => {
                setModalTarget(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 rounded-full bg-accent-green text-black text-xs font-bold hover:bg-accent-green/90 transition-all inline-flex items-center gap-1.5 shadow-md shadow-accent-green/20 cursor-pointer"
            >
              <Plus size={14} /> Programar Primer Mantenimiento
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWindows.map((item) => (
            <MaintenanceCard
              key={item.id}
              window={item}
              onSelect={(w) => setDrawerTarget(w)}
              onStart={(id) => startMutation.mutate(id)}
              onComplete={(id) => completeMutation.mutate(id)}
              isStarting={startMutation.isPending}
              isCompleting={completeMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <MaintenanceTableView
          windows={filteredWindows}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onSelect={(w) => setDrawerTarget(w)}
          onStart={(id) => startMutation.mutate(id)}
          onComplete={(id) => completeMutation.mutate(id)}
        />
      )}

      {/* 6. Modal de Creación / Edición */}
      <MaintenanceWindowModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalTarget(null);
        }}
        onSubmit={async (payload) => {
          if (modalTarget) {
            await updateMutation.mutateAsync({ id: modalTarget.id, data: payload });
          } else {
            await createMutation.mutateAsync(payload);
          }
        }}
        initialData={modalTarget}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      {/* 7. Slide-Over Drawer Lateral */}
      <MaintenanceDetailDrawer
        isOpen={!!drawerTarget}
        onClose={() => setDrawerTarget(null)}
        window={drawerTarget}
        onStart={(id) => startMutation.mutate(id)}
        onComplete={(id) => completeMutation.mutate(id)}
        onCancel={(id) => cancelMutation.mutate(id)}
        onEdit={(w) => {
          setModalTarget(w);
          setIsModalOpen(true);
        }}
        onDelete={(id) => deleteMutation.mutate(id)}
        onAddUpdate={async (id, message, status) => {
          await addUpdateMutation.mutateAsync({ id, message, status });
        }}
        isStarting={startMutation.isPending}
        isCompleting={completeMutation.isPending}
        isCancelling={cancelMutation.isPending}
      />
    </div>
  );
}
