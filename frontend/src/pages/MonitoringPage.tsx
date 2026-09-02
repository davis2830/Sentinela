import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { MonitoringTarget, CreateTargetData } from '../types/monitoring';
import TargetCard from '../components/monitoring/TargetCard';
import TargetTableView from '../components/monitoring/TargetTableView';
import TargetDetailDrawer from '../components/monitoring/TargetDetailDrawer';
import TargetForm from '../components/monitoring/TargetForm';
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
} from 'lucide-react';

export default function MonitoringPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<MonitoringTarget | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<MonitoringTarget | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MonitoringTarget | null>(null);

  const [scanningId, setScanningId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'up' | 'down' | 'slow' | 'disabled'>('all');
  const [protocolFilter, setProtocolFilter] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<'name' | 'latency' | 'status'>('status');
  const [sortAsc, setSortAsc] = useState(true);

  // Live Auto-refresh countdown state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [countdown, setCountdown] = useState(15);

  const { data: targets, isLoading } = useQuery({
    queryKey: ['monitoring-targets'],
    queryFn: async () => {
      const response = await api.get('/monitoring/');
      return (response.data?.data || []) as MonitoringTarget[];
    },
    refetchInterval: autoRefreshEnabled ? 15000 : false,
  });

  // Countdown timer effect
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return 15;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefreshEnabled]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateTargetData) => {
      await api.post('/monitoring/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateTargetData }) => {
      await api.patch(`/monitoring/${id}/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/monitoring/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets'] });
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (id: string) => {
      setScanningId(id);
      const res = await api.post(`/monitoring/${id}/scan/`);
      return res.data?.data;
    },
    onSuccess: (updatedTarget) => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-checks'] });
      queryClient.invalidateQueries({ queryKey: ['target-checks-chart'] });
      queryClient.invalidateQueries({ queryKey: ['target-uptime-sla'] });
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
      await api.post('/monitoring/scan-all/');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (target: MonitoringTarget) => {
      await api.patch(`/monitoring/${target.id}/`, { enabled: !target.enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets'] });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async ({ action, target_ids }: { action: string; target_ids: string[] }) => {
      await api.post('/monitoring/bulk-action/', { action, target_ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets'] });
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

  const activeWithLatency = allTargets.filter((t) => t.enabled && t.last_latency !== null);
  const avgLatency =
    activeWithLatency.length > 0
      ? Math.round(activeWithLatency.reduce((acc, t) => acc + (t.last_latency || 0), 0) / activeWithLatency.length)
      : 0;

  const globalSla =
    totalCount > 0
      ? Math.round(((onlineCount + slowCount) / Math.max(totalCount - pausedCount, 1)) * 1000) / 10
      : 100.0;

  const allTags = Array.from(new Set(allTargets.flatMap((t) => t.tags || []))) as string[];

  // Filtered & Sorted Targets
  const filteredTargets = allTargets
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

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight">Uptime & Latencia</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-accent-green/10 text-accent-green border border-accent-green/30">
              NOC TELEMETRY
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-xs transition-colors ${
              autoRefreshEnabled
                ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                : 'bg-bg-dark border-border-base text-text-dim'
            }`}
            title={autoRefreshEnabled ? 'Pausar auto-refresco' : 'Activar auto-refresco'}
          >
            {autoRefreshEnabled ? <Radio size={12} className="animate-pulse text-accent-green" /> : <Pause size={12} />}
            {autoRefreshEnabled ? `En vivo: ${countdown}s` : 'Pausado'}
          </button>

          <button
            onClick={() => scanAllMutation.mutate()}
            disabled={scanAllMutation.isPending}
            className="flex items-center gap-2 bg-accent-green/10 border border-accent-green/40 text-accent-green font-semibold px-3.5 py-2 rounded-lg text-sm hover:bg-accent-green/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={scanAllMutation.isPending ? 'animate-spin' : ''} />
            Actualizar Todo
          </button>

          <button
            onClick={handleNewTarget}
            className="flex items-center gap-2 bg-accent-green text-black font-bold px-4 py-2 rounded-lg text-sm hover:bg-accent-green/90 transition-all shadow-md hover:shadow-accent-green/20"
          >
            <Plus size={16} />
            Nuevo Target
          </button>
        </div>
      </div>

      {/* NOC Command Center: KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Global SLA */}
        <div className="bg-bg-card/90 border border-border-base rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-text-muted font-bold flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-accent-green" /> Disponibilidad SLA
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {globalSla >= 99.0 ? 'ÓPTIMO' : 'ATENCIÓN'}
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-text-main">{globalSla}%</span>
            <span className="text-xs text-text-dim font-mono">últimas 24h</span>
          </div>
          <div className="w-full bg-bg-dark h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                globalSla >= 99 ? 'bg-emerald-400' : globalSla >= 95 ? 'bg-amber-400' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(globalSla, 100)}%` }}
            />
          </div>
        </div>

        {/* KPI 2: Latencia Promedio */}
        <div className="bg-bg-card/90 border border-border-base rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-text-muted font-bold flex items-center gap-1.5">
              <Activity size={14} className="text-sky-400" /> Latencia Promedio
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
              RED GLOBAL
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-sky-400">{avgLatency}ms</span>
            <span className="text-xs text-text-dim font-mono">tiempo respuesta</span>
          </div>
          <p className="text-[11px] text-text-muted mt-2 font-mono truncate">
            Calculado sobre {activeWithLatency.length} targets activos
          </p>
        </div>

        {/* KPI 3: Estado de Targets */}
        <div className="bg-bg-card/90 border border-border-base rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase text-text-muted font-bold flex items-center gap-1.5">
              <Zap size={14} className="text-amber-400" /> Salud de Infraestructura
            </span>
            <span className="text-xs font-mono font-bold text-text-main">{totalCount} Targets</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg py-1.5 px-1">
              <div className="text-lg font-bold text-emerald-400">{onlineCount}</div>
              <div className="text-[10px] text-emerald-400/80">ONLINE</div>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg py-1.5 px-1">
              <div className="text-lg font-bold text-amber-400">{slowCount}</div>
              <div className="text-[10px] text-amber-400/80">LENTOS</div>
            </div>
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg py-1.5 px-1">
              <div className="text-lg font-bold text-rose-400">{downCount}</div>
              <div className="text-[10px] text-rose-400/80">CAÍDOS</div>
            </div>
          </div>
        </div>

        {/* KPI 4: Próximo Chequeo / Carga */}
        <div className="bg-bg-card/90 border border-border-base rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-text-muted font-bold">Frecuencia Monitoreo</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
              CELERY BEAT
            </span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-extrabold font-mono text-accent-green">
              {totalCount > 0 ? `${totalCount * 2} checks` : '0 checks'}
            </div>
            <p className="text-xs text-text-dim font-mono mt-0.5">por minuto en ejecución continua</p>
          </div>
          <div className="text-[11px] font-mono text-text-muted flex items-center justify-between pt-1 border-t border-border-base/40">
            <span>Pausados: {pausedCount}</span>
            <span className="text-accent-green flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-ping" /> Activo
            </span>
          </div>
        </div>
      </div>

      {/* Search, Filter Toolbar & View Switcher */}
      <div className="bg-bg-card border border-border-base rounded-xl p-4 shadow-md space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" size={16} />
            <input
              type="text"
              placeholder="Buscar por nombre, URL o dirección IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-bg-dark border border-border-base rounded-lg pl-10 pr-4 py-2 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-mono"
            />
          </div>

          {/* Tag filter selector */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <span className="text-text-muted">TAG:</span>
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="bg-bg-dark border border-border-base rounded-lg px-2.5 py-2 text-text-main focus:outline-none focus:border-accent-green cursor-pointer"
              >
                <option value="all">TODOS LOS TAGS</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    #{tag.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-bg-dark p-1 rounded-lg border border-border-base">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'grid' ? 'bg-accent-green text-black font-bold' : 'text-text-muted hover:text-text-main'
              }`}
              title="Vista de Cuadrícula (Cards)"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'table' ? 'bg-accent-green text-black font-bold' : 'text-text-muted hover:text-text-main'
              }`}
              title="Vista de Tabla Compacta (NOC)"
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div>

        {/* Filters Row: Protocol Chips & Status Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border-base/40">
          {/* Protocol Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto font-mono text-xs">
            <span className="text-[11px] text-text-dim uppercase mr-1">Tipo:</span>
            {['all', 'https', 'http', 'tcp', 'dns', 'api', 'ssl'].map((proto) => (
              <button
                key={proto}
                onClick={() => setProtocolFilter(proto)}
                className={`px-2.5 py-1 rounded text-[11px] uppercase transition-colors border ${
                  protocolFilter === proto
                    ? 'bg-accent-green/20 border-accent-green text-accent-green font-bold'
                    : 'bg-bg-dark/60 border-border-base/70 text-text-muted hover:text-text-main'
                }`}
              >
                {proto === 'all' ? 'Todos' : proto}
              </button>
            ))}
          </div>

          {/* Status Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto font-mono text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg border transition-colors ${
                statusFilter === 'all'
                  ? 'bg-accent-green/20 border-accent-green text-accent-green font-bold'
                  : 'bg-bg-dark border-border-base text-text-muted hover:text-text-main'
              }`}
            >
              Todos ({totalCount})
            </button>
            <button
              onClick={() => setStatusFilter('up')}
              className={`px-3 py-1 rounded-lg border transition-colors ${
                statusFilter === 'up'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold'
                  : 'bg-bg-dark border-border-base text-text-muted hover:text-text-main'
              }`}
            >
              Online ({onlineCount})
            </button>
            <button
              onClick={() => setStatusFilter('down')}
              className={`px-3 py-1 rounded-lg border transition-colors ${
                statusFilter === 'down'
                  ? 'bg-rose-500/20 border-rose-500 text-rose-400 font-bold'
                  : 'bg-bg-dark border-border-base text-text-muted hover:text-text-main'
              }`}
            >
              Caídos ({downCount})
            </button>
            <button
              onClick={() => setStatusFilter('slow')}
              className={`px-3 py-1 rounded-lg border transition-colors ${
                statusFilter === 'slow'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400 font-bold'
                  : 'bg-bg-dark border-border-base text-text-muted hover:text-text-main'
              }`}
            >
              Lentos ({slowCount})
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-4 z-20 bg-bg-dark/95 border border-accent-green/50 backdrop-blur-md rounded-xl p-3 px-5 shadow-2xl flex items-center justify-between gap-4 animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-3">
            <CheckSquare size={18} className="text-accent-green" />
            <span className="font-mono text-sm font-bold text-text-main">
              {selectedIds.length} target{selectedIds.length > 1 ? 's' : ''} seleccionado{selectedIds.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => bulkMutation.mutate({ action: 'scan', target_ids: selectedIds })}
              disabled={bulkMutation.isPending}
              className="px-3 py-1.5 bg-accent-green/10 border border-accent-green text-accent-green font-semibold rounded-lg text-xs hover:bg-accent-green/20 transition-colors"
            >
              Escanear Seleccionados
            </button>
            <button
              onClick={() => bulkMutation.mutate({ action: 'pause', target_ids: selectedIds })}
              disabled={bulkMutation.isPending}
              className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/40 text-amber-400 font-semibold rounded-lg text-xs hover:bg-amber-500/20 transition-colors"
            >
              Pausar Monitoreo
            </button>
            <button
              onClick={() => bulkMutation.mutate({ action: 'resume', target_ids: selectedIds })}
              disabled={bulkMutation.isPending}
              className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 font-semibold rounded-lg text-xs hover:bg-emerald-500/20 transition-colors"
            >
              Reanudar
            </button>
            <button
              onClick={() => bulkMutation.mutate({ action: 'delete', target_ids: selectedIds })}
              disabled={bulkMutation.isPending}
              className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/40 text-rose-400 font-semibold rounded-lg text-xs hover:bg-rose-500/20 transition-colors"
            >
              Eliminar
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 text-text-muted hover:text-text-main text-xs"
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
                onScan={(t) => scanMutation.mutate(t.id)}
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
      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
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
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 border border-border-base rounded-lg text-sm text-text-muted hover:bg-bg-card-hover transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 bg-accent-red text-white font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}