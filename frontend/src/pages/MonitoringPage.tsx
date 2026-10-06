import { useLinkedResource } from '../hooks/useLinkedResource';
import { useUrlFilter } from '../hooks/useUrlFilter';
import CompactModuleSummary from '../components/common/CompactModuleSummary';
import AdminButton from '../components/common/AdminButton';
import { useAuthStore } from '../store/authStore';
import ReloadDataButton from '../components/common/ReloadDataButton';
import { useConnectivityRefresh } from '../hooks/useConnectivityRefresh';
import { formatRefreshCountdown } from '../hooks/useAutoRefresh';
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { waitForFreshScan, type QueuedScan } from '../utils/scanPolling';
import type { MonitoringTarget, CreateTargetData } from '../types/monitoring';
import TargetCard from '../components/monitoring/TargetCard';
import TargetTableView from '../components/monitoring/TargetTableView';
import TargetDetailDrawer from '../components/monitoring/TargetDetailDrawer';
import TargetForm from '../components/monitoring/TargetForm';
import ProbeDirectoryDrawer from '../components/monitoring/ProbeDirectoryDrawer';
import { usePersistentViewMode } from '../hooks/usePersistentViewMode';
import {
  Plus,
  Loader2,
  Trash2,
  TrendingUp,
  RefreshCw,
  Search,
  LayoutGrid,
  List as ListIcon,
  ShieldCheck,
  Activity,
  Zap,
  Pause,
  Play,
  CheckSquare,
  AlertTriangle,
  Radio,
  Server,
} from 'lucide-react';

export default function MonitoringPage() {
  const organizationId = useAuthStore(state => state.user?.organization?.id);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<MonitoringTarget | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<MonitoringTarget | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MonitoringTarget | null>(null);
  const [showProbeDrawer, setShowProbeDrawer] = useState(false);

  const [scanningId, setScanningId] = useState<string | null>(null);
  const autoRefresh = useConnectivityRefresh();
  const { subscription, enabled: autoRefreshEnabled, countdown, setEnabled: setAutoRefreshEnabled } = autoRefresh;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useUrlFilter('status', ["all","up","down","slow","disabled"] as const);
  const [protocolFilter, setProtocolFilter] = useUrlFilter('type', ["all","http","https","tcp","dns","api","ssl"] as const);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [viewMode, setViewMode] = usePersistentViewMode('monitoring', 'table');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<'name' | 'latency' | 'status'>('status');
  const [sortAsc, setSortAsc] = useState(true);

  const { data: targets, isLoading } = useQuery({
    queryKey: ['monitoring-targets', organizationId],
    queryFn: async () => {
      const response = await api.get('/monitoring/');
      return (response.data?.data || []) as MonitoringTarget[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Probe query for live badge count
  const { data: probes } = useQuery({
    queryKey: ['agent-probes', organizationId],
    queryFn: async () => {
      const res = await api.get('agent-probes/');
      return res.data?.data || [];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateTargetData) => {
      await api.post('/monitoring/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets', organizationId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateTargetData }) => {
      await api.patch(`/monitoring/${id}/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets', organizationId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/monitoring/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets', organizationId] });
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (id: string) => {
      setScanningId(id);
      const res = await api.post(`/monitoring/${id}/scan/`);
      const queued = res.data?.data as QueuedScan;
      return waitForFreshScan<MonitoringTarget>(
        queued,
        async () => (await api.get(`/monitoring/${id}/`)).data?.data as MonitoringTarget,
        (target) => target.last_checked_at,
      );
    },
    onSuccess: (updatedTarget) => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-checks', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['target-checks-chart', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['target-uptime-sla', organizationId] });
      if (selectedTarget && updatedTarget && selectedTarget.id === updatedTarget.id) {
        setSelectedTarget(updatedTarget);
      }
      setScanningId(null);
    },
    onError: () => {
      setScanningId(null);
    },
  });


  const toggleMutation = useMutation({
    mutationFn: async (target: MonitoringTarget) => {
      await api.patch(`/monitoring/${target.id}/`, { enabled: !target.enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets', organizationId] });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async ({ action, target_ids }: { action: string; target_ids: string[] }) => {
      await api.post('/monitoring/bulk-action/', { action, target_ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets', organizationId] });
      setSelectedIds([]);
    },
  });

  const handleExport = async (targetId: string, targetName: string) => {
    try {
      const response = await api.get(`/monitoring/${targetId}/export/`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `monitoring_history_${targetName.replace(/\s+/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error('Error exporting history:', err);
    }
  };

  const handleSubmit = async (data: CreateTargetData) => {
    if (editingTarget) {
      await updateMutation.mutateAsync({ id: editingTarget.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleEdit = (target: MonitoringTarget) => {
    setEditingTarget(target);
    setShowForm(true);
  };

  const handleDelete = (target: MonitoringTarget) => {
    setDeleteConfirm(target);
  };

  const confirmDelete = async () => {
    if (deleteConfirm) {
      await deleteMutation.mutateAsync(deleteConfirm.id);
      setDeleteConfirm(null);
      if (selectedTarget?.id === deleteConfirm.id) {
        setSelectedTarget(null);
      }
    }
  };

  const handleNewTarget = () => {
    setEditingTarget(null);
    setShowForm(true);
  };

  // Bulk selection handlers
  const handleSelectToggle = (target: MonitoringTarget) => {
    setSelectedIds((prev) =>
      prev.includes(target.id) ? prev.filter((id) => id !== target.id) : [...prev, target.id]
    );
  };

  const handleSelectAllToggle = () => {
    if (!filteredTargets || filteredTargets.length === 0) return;
    if (selectedIds.length === filteredTargets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTargets.map((t) => t.id));
    }
  };

  const handleSortChange = (field: 'name' | 'latency' | 'status') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // KPI Calculations
  const allTargets = targets || [];
  const totalCount = allTargets.length;
  const onlineCount = allTargets.filter((t) => t.enabled && t.last_status === 'up').length;
  const slowCount = allTargets.filter((t) => t.enabled && t.last_status === 'slow').length;
  const downCount = allTargets.filter((t) => t.enabled && (t.last_status === 'down' || t.last_status === 'error')).length;
  const pausedCount = allTargets.filter((t) => !t.enabled).length;
  const estimatedChecksPerMinute = subscription?.monitoring_allowed === false ? 0 : allTargets.filter(t => t.enabled).reduce((sum, target) => sum + 60 / Math.max(target.interval || 300, subscription?.limits?.min_check_interval_seconds || 300), 0);

  const activeWithLatency = allTargets.filter((t) => t.enabled && t.last_latency !== null);
  const avgLatency =
    activeWithLatency.length > 0
      ? Math.round(activeWithLatency.reduce((acc, t) => acc + (t.last_latency || 0), 0) / activeWithLatency.length)
      : 0;

  const globalSla =
    totalCount > 0
      ? Math.round(((onlineCount + slowCount) / Math.max(totalCount - pausedCount, 1)) * 1000) / 10
      : 100.0;

  const allTags = useMemo(
    () => Array.from(new Set(allTargets.flatMap((t) => t.tags || []))) as string[],
    [allTargets]
  );

  // Filtered & Sorted Targets (Memoized)
  const filteredTargets = useMemo(() => {
    return allTargets
      .filter((t: MonitoringTarget) => {
        const matchesSearch =
          t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.endpoint.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        if (statusFilter === 'up') return t.last_status === 'up';
        if (statusFilter === 'down') return t.last_status === 'down' || t.last_status === 'error';
        if (statusFilter === 'slow') return t.last_status === 'slow';
        if (statusFilter === 'disabled') return !t.enabled;

        if (protocolFilter !== 'all' && t.target_type !== protocolFilter) return false;
        if (selectedTag !== 'all' && (!t.tags || !t.tags.includes(selectedTag))) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortField === 'latency') {
          const latA = a.last_latency ?? 999999;
          const latB = b.last_latency ?? 999999;
          return sortAsc ? latA - latB : latB - latA;
        }
        if (sortField === 'name') {
          return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        }
        if (sortField === 'status') {
          const order: Record<string, number> = { down: 0, error: 0, slow: 1, up: 2, unknown: 3 };
          const scoreA = a.enabled ? (order[a.last_status || 'unknown'] ?? 3) : 4;
          const scoreB = b.enabled ? (order[b.last_status || 'unknown'] ?? 3) : 4;
          return sortAsc ? scoreA - scoreB : scoreB - scoreA;
        }
        return 0;
      });
  }, [allTargets, searchTerm, statusFilter, protocolFilter, selectedTag, sortField, sortAsc]);

  useLinkedResource(targets, selectedTarget, setSelectedTarget);

  return (
    <div className="compact-workspace space-y-4 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight">Uptime & Latencia</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-accent-green/10 text-accent-green border border-accent-green/30">
              TELEMETRÍA EN VIVO
            </span>
          </div>
          <p className="text-text-muted text-sm mt-1">
            Supervisión continua de disponibilidad, latencia y acuerdos de nivel de servicio (SLA).
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
          {/* Auto-refresh indicator & toggle */}
          <button
            onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
            aria-label={autoRefreshEnabled ? 'Pausar auto-refresco' : 'Activar auto-refresco'}
            disabled={!autoRefresh.ready}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-medium transition-colors ${
              autoRefreshEnabled
                ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                : 'bg-bg-dark/80 border-border-base/80 text-text-dim'
            }`}
            title="Recarga automática de datos guardados, no ejecuta sondeos. La frecuencia sigue el plan."
          >
            {autoRefreshEnabled ? <Radio size={12} className="animate-pulse text-accent-green" /> : <Pause size={12} />}
            {!autoRefresh.ready ? 'Frecuencia no disponible' : autoRefreshEnabled ? `En vivo: ${formatRefreshCountdown(countdown)}` : 'Pausado'}
          </button>

          <ReloadDataButton queryKeys={["monitoring-targets","agent-probes","org-subscription","target-timeseries"]} scanIntervalSeconds={autoRefresh.ready ? autoRefresh.intervalSeconds : undefined} onReload={autoRefresh.resetCountdown} />


          <button
            onClick={() => setShowProbeDrawer(true)}
            className="flex items-center gap-2 bg-accent-purple/10 border border-accent-purple/40 text-accent-purple font-medium px-4 py-2 rounded-full text-sm hover:bg-accent-purple/20 transition-all shadow-sm"
            title="Administrar guardianes Sentinine para auditar redes privadas y On-Premise"
          >
            <Server size={15} />
            <span>Sentinine ({probes?.length || 0})</span>
          </button>

          <button
            onClick={handleNewTarget}
            className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20"
          >
            <Plus size={16} />
            Nuevo Target
          </button>
        </div>
      </div>

      <CompactModuleSummary variant="status" items={[
        {label:'Targets',value:targets ? totalCount : null,icon:Server,tone:'neutral',active:statusFilter==='all',onClick:()=>setStatusFilter('all')},
        {label:'Online',value:targets ? onlineCount : null,icon:ShieldCheck,tone:'success',active:statusFilter==='up',onClick:()=>setStatusFilter('up')},
        {label:'Lentos',value:targets ? slowCount : null,icon:Activity,tone:'warning',active:statusFilter==='slow',onClick:()=>setStatusFilter('slow')},
        {label:'Caídos',value:targets ? downCount : null,icon:AlertTriangle,tone:'danger',active:statusFilter==='down',onClick:()=>setStatusFilter('down')},
        {label:'Pausados',value:targets ? pausedCount : null,icon:Pause,tone:'muted',active:statusFilter==='disabled',onClick:()=>setStatusFilter('disabled')},
      ]} />

      {/* Search, Filter Toolbar & View Switcher */}
      <div className="border-b border-border-base/70 py-3 space-y-2.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" size={16} />
            <input
              type="text"
              placeholder="Buscar por nombre, URL o dirección IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-bg-dark/80 border border-border-base/80 rounded-full pl-10 pr-4 py-2 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green focus:ring-2 focus:ring-accent-green/20 transition-all"
            />
          </div>

          {/* Tag filter selector */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <span className="text-text-muted">Tag:</span>
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="bg-bg-dark/80 border border-border-base/80 rounded-full px-3 py-2 text-text-main focus:outline-none focus:border-accent-green cursor-pointer"
              >
                <option value="all">Todos los Tags</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    #{tag}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-bg-dark/80 p-1 rounded-full border border-border-base/80">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-full transition-all ${
                viewMode === 'grid' ? 'bg-accent-green text-black font-semibold shadow-sm' : 'text-text-muted hover:text-text-main'
              }`}
              title="Cuadrícula" aria-label="Cuadrícula"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-full transition-all ${
                viewMode === 'table' ? 'bg-accent-green text-black font-semibold shadow-sm' : 'text-text-muted hover:text-text-main'
              }`}
              title="Lista" aria-label="Lista"
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div>

        {/* Filters Row: Protocol Chips & Status Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-border-base/40">
          {/* Protocol Chips */}
          <div className="flex flex-wrap items-center gap-1.5 max-w-full text-xs">
            <span className="text-[11px] text-text-dim font-semibold mr-1">Tipo:</span>
            {['all', 'https', 'http', 'tcp', 'dns', 'api', 'ssl'].map((proto) => (
              <button
                key={proto}
                onClick={() => setProtocolFilter(proto)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                  protocolFilter === proto
                    ? 'bg-accent-green/20 border-accent-green text-accent-green font-semibold shadow-sm'
                    : 'bg-bg-dark/60 border-border-base/70 text-text-muted hover:text-text-main hover:border-border-base'
                }`}
              >
                {proto === 'all' ? 'Todos' : proto.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Status Pills */}
          <div className="flex flex-wrap items-center gap-1.5 max-w-full text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3.5 py-1 rounded-full border transition-all font-medium ${
                statusFilter === 'all'
                  ? 'bg-accent-green/20 border-accent-green text-accent-green font-semibold shadow-sm'
                  : 'bg-bg-dark/60 border-border-base/70 text-text-muted hover:text-text-main'
              }`}
            >
              Todos ({totalCount})
            </button>
            <button
              onClick={() => setStatusFilter('up')}
              className={`px-3.5 py-1 rounded-full border transition-all font-medium ${
                statusFilter === 'up'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-semibold shadow-sm'
                  : 'bg-bg-dark/60 border-border-base/70 text-text-muted hover:text-text-main'
              }`}
            >
              Online ({onlineCount})
            </button>
            <button
              onClick={() => setStatusFilter('down')}
              className={`px-3.5 py-1 rounded-full border transition-all font-medium ${
                statusFilter === 'down'
                  ? 'bg-rose-500/20 border-rose-500 text-rose-400 font-semibold shadow-sm'
                  : 'bg-bg-dark/60 border-border-base/70 text-text-muted hover:text-text-main'
              }`}
            >
              Caídos ({downCount})
            </button>
            <button
              onClick={() => setStatusFilter('slow')}
              className={`px-3.5 py-1 rounded-full border transition-all font-medium ${
                statusFilter === 'slow'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400 font-semibold shadow-sm'
                  : 'bg-bg-dark/60 border-border-base/70 text-text-muted hover:text-text-main'
              }`}
            >
              Lentos ({slowCount})
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-4 z-20 bg-bg-dark/95 border border-accent-green/50 backdrop-blur-md rounded-2xl p-3 px-5 shadow-2xl flex items-center justify-between gap-4 animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-3">
            <CheckSquare size={18} className="text-accent-green" />
            <span className="text-sm font-semibold text-text-main">
              {selectedIds.length} target{selectedIds.length > 1 ? 's' : ''} seleccionado{selectedIds.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">

            <AdminButton
              onClick={() => bulkMutation.mutate({ action: 'pause', target_ids: selectedIds })}
              disabled={bulkMutation.isPending}
              className="px-3.5 py-1.5 bg-amber-500/10 border border-amber-500/40 text-amber-400 font-medium rounded-full text-xs hover:bg-amber-500/20 transition-all"
            >
              Pausar
            </AdminButton>
            <AdminButton
              onClick={() => bulkMutation.mutate({ action: 'resume', target_ids: selectedIds })}
              disabled={bulkMutation.isPending}
              className="px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 font-medium rounded-full text-xs hover:bg-emerald-500/20 transition-all"
            >
              Reanudar
            </AdminButton>
            <AdminButton
              onClick={() => bulkMutation.mutate({ action: 'delete', target_ids: selectedIds })}
              disabled={bulkMutation.isPending}
              className="px-3.5 py-1.5 bg-rose-500/10 border border-rose-500/40 text-rose-400 font-medium rounded-full text-xs hover:bg-rose-500/20 transition-all"
            >
              Eliminar
            </AdminButton>
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 text-text-muted hover:text-text-main text-xs font-medium transition-colors"
            >
              Deseleccionar
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area: Grid vs Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-accent-green" size={36} />
        </div>
      ) : filteredTargets && filteredTargets.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTargets.map((target: MonitoringTarget) => (
              <TargetCard
                key={target.id}
                target={target}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onScan={(t) => scanMutation.mutateAsync(t.id)}
                onToggle={(t) => toggleMutation.mutate(t)}
                onAlert={() => navigate('/alerts')}
                isScanning={scanningId === target.id}
                onClick={setSelectedTarget}
                isSelected={selectedIds.includes(target.id)}
                onSelectToggle={handleSelectToggle}
              />
            ))}
          </div>
        ) : (
          <TargetTableView
            targets={filteredTargets}
            selectedIds={selectedIds}
            onSelectToggle={handleSelectToggle}
            onSelectAllToggle={handleSelectAllToggle}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onScan={(t) => scanMutation.mutate(t.id)}
            onToggle={(t) => toggleMutation.mutate(t)}
            onAlert={() => navigate('/alerts')}
            scanningId={scanningId}
            onClick={setSelectedTarget}
            sortField={sortField}
            sortAsc={sortAsc}
            onSortChange={handleSortChange}
          />
        )
      ) : (
        <div className="bg-bg-card border border-border-base rounded-2xl text-center py-16 px-4">
          <TrendingUp className="mx-auto text-text-dim mb-4" size={48} />
          <h3 className="text-lg font-bold text-text-main mb-1">No se encontraron objetivos de monitoreo</h3>
          <p className="text-text-muted text-sm mb-6 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'all' || protocolFilter !== 'all'
              ? 'Prueba ajustando los filtros de búsqueda o protocolo.'
              : 'Empieza registrando tu primer servidor, API o dominio para supervisar su latencia y SLA.'}
          </p>
          <button
            onClick={handleNewTarget}
            className="inline-flex items-center gap-2 bg-accent-green text-black font-bold px-4 py-2 rounded-lg text-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={18} />
            Crear Target
          </button>
        </div>
      )}

      {/* Target Detail Slide-Over Drawer */}
      {selectedTarget && (
        <TargetDetailDrawer
          target={selectedTarget}
          onClose={() => setSelectedTarget(null)}
          onScan={(t) => scanMutation.mutate(t.id)}
          onEdit={handleEdit}
          onAlert={() => navigate('/alerts')}
          onExport={handleExport}
          isScanning={scanningId === selectedTarget.id}
        />
      )}

      {/* Private Satellite Agent Directory Drawer */}
      <ProbeDirectoryDrawer
        isOpen={showProbeDrawer}
        onClose={() => setShowProbeDrawer(false)}
      />

      {/* Target Create/Edit Modal Form */}
      {showForm && (
        <TargetForm
          target={editingTarget}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowForm(false);
            setEditingTarget(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={() => setDeleteConfirm(null)}
          >
            <div
              className="bg-bg-card border border-border-base rounded-xl p-6 w-full max-w-sm shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-accent-red/10 flex items-center justify-center">
                  <Trash2 className="text-accent-red" size={20} />
                </div>
                <h2 className="text-lg font-bold">Eliminar Target</h2>
              </div>
              <p className="text-text-muted text-sm mb-6">
                ¿Seguro que deseas eliminar <strong className="text-text-main">{deleteConfirm.name}</strong>?
                Esta acción eliminará todo su historial de métricas y no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <AdminButton
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 border border-border-base rounded-lg text-sm text-text-muted hover:bg-bg-card-hover transition-colors"
                >
                  Cancelar
                </AdminButton>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 bg-accent-red text-white font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
