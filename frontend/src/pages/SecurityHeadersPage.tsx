import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  SecurityHeaderTarget,
  SecurityHeaderResult,
  CreateSecurityHeaderTargetData,
  SecurityHeaderStats,
} from '../types/security_headers';
import GradeBadge from '../components/common/GradeBadge';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
import SecurityHeaderForm from '../components/security_headers/SecurityHeaderForm';
import SecurityHeaderTableView from '../components/security_headers/SecurityHeaderTableView';
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
  ShieldCheck,
  Plus,
  Loader2,
  Trash2,
  RefreshCw,
  Clock,
  Pencil,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Shield,
  FileCode2,
  AlertTriangle,
  ShieldAlert,
  CheckSquare,
  Square,
  Activity,
  Zap,
} from 'lucide-react';

type GradeFilterType = 'all' | 'grade_a' | 'grade_bc' | 'grade_df';

export default function SecurityHeadersPage() {
  const queryClient = useQueryClient();

  // State
  const [selectedTarget, setSelectedTarget] = useState<SecurityHeaderTarget | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<SecurityHeaderTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SecurityHeaderTarget | null>(null);
  const [gradeFilter, setGradeFilter] = useState<GradeFilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = usePersistentViewMode('security_headers', 'table');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<'found' | 'missing' | 'history'>('found');
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Auto-refresh hook (15s countdown)
  const autoRefresh = useAutoRefresh({
    intervalSeconds: 15,
    initialEnabled: true,
  });

  // Stats query
  const { data: stats } = useQuery<SecurityHeaderStats>({
    queryKey: ['security-header-stats'],
    queryFn: async () => {
      const response = await api.get('security-headers/stats/');
      return (response.data?.data || {}) as SecurityHeaderStats;
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Targets query
  const { data: targets, isLoading } = useQuery<SecurityHeaderTarget[]>({
    queryKey: ['security-header-targets'],
    queryFn: async () => {
      const response = await api.get('security-headers/');
      return (response.data?.data || []) as SecurityHeaderTarget[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Target scan results query for selectedTarget
  const { data: results, isLoading: isLoadingResults } = useQuery<SecurityHeaderResult[]>({
    queryKey: ['security-header-results', selectedTarget?.id],
    queryFn: async () => {
      if (!selectedTarget) return [];
      const response = await api.get(`security-headers/${selectedTarget.id}/results/`);
      return (response.data?.data || []) as SecurityHeaderResult[];
    },
    enabled: !!selectedTarget,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateSecurityHeaderTargetData) => {
      await api.post('security-headers/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-header-targets'] });
      queryClient.invalidateQueries({ queryKey: ['security-header-stats'] });
      setShowForm(false);
      setEditingTarget(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateSecurityHeaderTargetData }) => {
      await api.patch(`security-headers/${id}/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-header-targets'] });
      queryClient.invalidateQueries({ queryKey: ['security-header-stats'] });
      setShowForm(false);
      setEditingTarget(null);
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (id: string) => {
      setScanningId(id);
      const response = await api.post(`security-headers/${id}/scan/`);
      return response.data?.data;
    },
    onSuccess: (updatedTarget) => {
      queryClient.invalidateQueries({ queryKey: ['security-header-targets'] });
      queryClient.invalidateQueries({ queryKey: ['security-header-stats'] });
      queryClient.invalidateQueries({ queryKey: ['security-header-results', selectedTarget?.id] });
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
      await api.post('security-headers/scan-all/');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-header-targets'] });
      queryClient.invalidateQueries({ queryKey: ['security-header-stats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`security-headers/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-header-targets'] });
      queryClient.invalidateQueries({ queryKey: ['security-header-stats'] });
      if (selectedTarget?.id === deleteTarget?.id) {
        setSelectedTarget(null);
      }
      setDeleteTarget(null);
    },
  });

  // Bulk Actions
  const handleToggleSelect = (target: SecurityHeaderTarget) => {
    setSelectedIds((prev) =>
      prev.includes(target.id) ? prev.filter((id) => id !== target.id) : [...prev, target.id]
    );
  };

  const handleSelectAllToggle = () => {
    if (!filteredTargets || filteredTargets.length === 0) return;
    if (selectedIds.length === filteredTargets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTargets.map((t: SecurityHeaderTarget) => t.id));
    }
  };

  const handleBulkScan = async () => {
    if (selectedIds.length === 0) return;
    for (const id of selectedIds) {
      try {
        await api.post(`security-headers/${id}/scan/`);
      } catch (err) {
        // Continue
      }
    }
    queryClient.invalidateQueries({ queryKey: ['security-header-targets'] });
    queryClient.invalidateQueries({ queryKey: ['security-header-stats'] });
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
        await api.delete(`security-headers/${id}/`);
      } catch (err) {
        // Continue
      }
    }
    setSelectedIds([]);
    setBulkDeleting(false);
    queryClient.invalidateQueries({ queryKey: ['security-header-targets'] });
    queryClient.invalidateQueries({ queryKey: ['security-header-stats'] });
  };

  // Form Handlers
  const handleFormSubmit = async (data: CreateSecurityHeaderTargetData) => {
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

  const handleOpenEdit = (target: SecurityHeaderTarget, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTarget(target);
    setShowForm(true);
  };

  const parseHeadersList = (headers: string[] | Record<string, string> | undefined): string[] => {
    if (!headers) return [];
    if (Array.isArray(headers)) return headers;
    return Object.keys(headers);
  };

  const calculateGrade = (score: number | null) => {
    if (score === null) return null;
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  };

  // KPI Calculations
  const allTargets = targets || [];
  const totalCount = stats?.total || allTargets.length;
  const gradeACount = stats?.grade_a || allTargets.filter((t: SecurityHeaderTarget) => t.last_score !== null && t.last_score >= 80).length;
  const gradeBCCount = stats?.grade_bc || allTargets.filter((t: SecurityHeaderTarget) => t.last_score !== null && t.last_score >= 60 && t.last_score < 80).length;
  const gradeDFCount = stats?.grade_df || allTargets.filter((t: SecurityHeaderTarget) => t.last_score === null || t.last_score < 60).length;

  const optimalRate =
    totalCount > 0
      ? Math.round((gradeACount / totalCount) * 1000) / 10
      : 100.0;

  // Filtered & Searched Targets
  const filteredTargets = allTargets.filter((t: SecurityHeaderTarget) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.url.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    const score = t.last_score;
    if (gradeFilter === 'grade_a') return score !== null && score >= 80;
    if (gradeFilter === 'grade_bc') return score !== null && score >= 60 && score < 80;
    if (gradeFilter === 'grade_df') return score === null || score < 60;

    return true;
  });

  const latestResult: SecurityHeaderResult | null =
    results && results.length > 0 ? results[0] : null;
  const foundList = latestResult ? parseHeadersList(latestResult.headers_found) : [];
  const missingList = latestResult ? parseHeadersList(latestResult.headers_missing) : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader
        title="Cabeceras de Seguridad"
        badgeText="HEADER AUDIT"
        description="Auditoría de cabeceras HTTP recomendadas (HSTS, CSP, X-Frame-Options) y análisis de mitigación contra ataques web."
        icon={<ShieldCheck size={26} />}
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
              title="Escanear cabeceras de todos los endpoints inmediatamente"
            >
              <RefreshCw
                size={15}
                className={scanAllMutation.isPending ? 'animate-spin' : ''}
              />
              Escanear Todos
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20"
            >
              <Plus size={16} />
              Nuevo Endpoint
            </button>
          </>
        }
      />

      {/* 2. NOC COMMAND CENTER: KPI STRIP */}
      <NOCKpiGrid columns={4}>
        {/* KPI 1: Calificación Óptima */}
        <NOCKpiCard
          title="Tasa de Excelencia"
          icon={<ShieldCheck size={16} className="text-accent-green" />}
          badge={{
            text: optimalRate >= 80.0 ? 'Óptimo' : 'Atención',
            variant: optimalRate >= 80.0 ? 'success' : 'warning',
          }}
          value={`${optimalRate}%`}
          valueSuffix="Grado A/A+"
          progress={{ value: optimalRate }}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Blindaje de Seguridad</span>
              <span>{gradeACount} de {totalCount} endpoints</span>
            </div>
          }
        />

        {/* KPI 2: Puntuación Promedio */}
        <NOCKpiCard
          title="Puntuación Media"
          icon={<Activity size={16} className="text-sky-400" />}
          badge={{
            text: 'Benchmark OWASP',
            variant: 'info',
          }}
          value={stats?.avg_score ? `${Math.round(stats.avg_score)}` : '0'}
          valueColor="text-sky-400"
          valueSuffix="/ 100 pts"
          subtitle="Basado en presencia y configuración de cabeceras"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Nivel Recomendado</span>
              <span className="text-sky-400 font-semibold">&ge; 85 puntos</span>
            </div>
          }
        />

        {/* KPI 3: Distribución por Grados */}
        <NOCKpiCard
          title="Distribución de Calidad"
          icon={<Zap size={16} className="text-amber-400" />}
          badge={{
            text: `${totalCount} Sitios`,
            variant: 'neutral',
          }}
          distribution={[
            { label: 'Grado A/A+', count: gradeACount, variant: 'success' },
            { label: 'Grado B/C', count: gradeBCCount, variant: 'warning' },
            { label: 'Grado D/F', count: gradeDFCount, variant: 'danger' },
          ]}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>HSTS / CSP / X-Frame</span>
              <span className="text-accent-green">Auditado</span>
            </div>
          }
        />

        {/* KPI 4: Frecuencia de Verificación */}
        <NOCKpiCard
          title="Carga de Auditoría"
          icon={<Shield size={16} className="text-accent-green" />}
          badge={{
            text: 'Celery Beat',
            variant: 'neutral',
          }}
          value={totalCount > 0 ? `${totalCount} checks` : '0 checks'}
          valueColor="text-accent-green"
          valueSuffix="por ciclo"
          subtitle="Verificación automatizada de cabeceras de respuesta"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Estándar Evaluado</span>
              <span className="text-accent-green font-medium">Mozilla Observatory</span>
            </div>
          }
        />
      </NOCKpiGrid>

      {/* 3. TOOLBAR: Omnibar Search + Grade Status Pills + Grid/Table Switcher */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por nombre de servicio o URL analizada..."
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        statusPills={[
          { id: 'all', label: 'Todos', count: totalCount, variant: 'all' },
          { id: 'grade_a', label: 'Grado A / A+', count: gradeACount, variant: 'success' },
          { id: 'grade_bc', label: 'Grado B / C', count: gradeBCCount, variant: 'warning' },
          { id: 'grade_df', label: 'Grado D / F', count: gradeDFCount, variant: 'danger' },
        ]}
        selectedStatus={gradeFilter}
        onStatusChange={(st) => setGradeFilter(st as GradeFilterType)}
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
            {filteredTargets.map((target: SecurityHeaderTarget) => {
              const grade = calculateGrade(target.last_score);
              const isSelected = selectedIds.includes(target.id);
              const isScanning = scanningId === target.id;

              return (
                <div
                  key={target.id}
                  onClick={() => setSelectedTarget(target)}
                  className={`bg-bg-card/95 border rounded-2xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between cursor-pointer group shadow-sm relative ${
                    isSelected
                      ? 'border-accent-green bg-accent-green/[0.02] ring-1 ring-accent-green/40'
                      : 'border-border-base/70'
                  }`}
                >
                  <div>
                    {/* Top row: Checkbox, Icon, Name, GradeBadge */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(target);
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
                          <Shield size={16} />
                        </div>
                        <h3
                          className="font-bold text-text-main truncate text-base group-hover:text-accent-green transition-colors font-sans"
                          title={target.name}
                        >
                          {target.name}
                        </h3>
                      </div>

                      <GradeBadge grade={grade} score={target.last_score} />
                    </div>

                    <p className="text-xs font-mono text-text-dim truncate mb-4" title={target.url}>
                      {target.url}
                    </p>

                    {/* Quick Metric Box */}
                    <div className="space-y-2 text-xs font-mono text-text-muted bg-bg-dark/50 rounded-xl p-3 border border-border-base/40">
                      <div className="flex justify-between border-b border-border-base/40 pb-1.5 font-sans">
                        <span className="text-text-dim font-medium">Puntuación de Seguridad:</span>
                        <span
                          className={`font-mono font-bold ${
                            target.last_score !== null && target.last_score >= 80
                              ? 'text-accent-green'
                              : target.last_score !== null && target.last_score >= 60
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {target.last_score !== null ? `${target.last_score} / 100` : 'Sin evaluar'}
                        </span>
                      </div>
                      <div className="flex justify-between font-sans">
                        <span className="text-text-dim font-medium">Monitoreo:</span>
                        <span className="text-text-main font-semibold">
                          {target.enabled ? (
                            <span className="text-accent-green">Activo</span>
                          ) : (
                            <span className="text-text-dim">Pausado</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-4 pt-3 border-t border-border-base/40 flex items-center justify-between text-xs text-text-dim">
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <Clock size={12} />
                      {target.last_checked_at
                        ? new Date(target.last_checked_at).toLocaleTimeString('es-ES', {
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
                          scanMutation.mutate(target.id);
                        }}
                        disabled={isScanning}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors disabled:opacity-50"
                        title="Escanear cabeceras ahora"
                      >
                        <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(target, e)}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors"
                        title="Editar endpoint"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(target);
                        }}
                        className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors"
                        title="Eliminar endpoint"
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
          /* Compact Table View */
          <SecurityHeaderTableView
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
            onDelete={(t, e) => {
              e.stopPropagation();
              setDeleteTarget(t);
            }}
          />
        )
      ) : (
        <EmptyState
          icon={ShieldCheck}
          title={
            searchTerm || gradeFilter !== 'all'
              ? 'No se encontraron endpoints con los filtros aplicados'
              : 'No hay endpoints de Security Headers monitoreados'
          }
          description={
            searchTerm || gradeFilter !== 'all'
              ? 'Prueba a cambiar el término de búsqueda o restablecer los filtros de calificación.'
              : 'Supervisa las cabeceras HTTP de seguridad de tus portales y endpoints REST.'
          }
          actionLabel={searchTerm || gradeFilter !== 'all' ? 'Limpiar Filtros' : 'Nuevo Endpoint'}
          onAction={() => {
            if (searchTerm || gradeFilter !== 'all') {
              setSearchTerm('');
              setGradeFilter('all');
            } else {
              handleOpenCreate();
            }
          }}
        />
      )}

      {/* 6. SLIDE-OVER DETAIL DRAWER (Zero Context Loss with NOCDrawer) */}
      <NOCDrawer
        isOpen={!!selectedTarget}
        onClose={() => setSelectedTarget(null)}
        title={selectedTarget?.name || ''}
        subtitle={
          selectedTarget && (
            <div className="flex items-center gap-2">
              <span className="truncate">{selectedTarget.url}</span>
              <a
                href={selectedTarget.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-green hover:underline flex items-center gap-1 shrink-0"
              >
                Abrir <ExternalLink size={11} />
              </a>
            </div>
          )
        }
        statusBadge={
          selectedTarget && (
            <GradeBadge
              grade={calculateGrade(selectedTarget.last_score)}
              score={selectedTarget.last_score}
            />
          )
        }
        headerActions={
          selectedTarget && (
            <button
              type="button"
              onClick={() => scanMutation.mutate(selectedTarget.id)}
              disabled={scanMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-black rounded-full text-xs font-semibold transition-all disabled:opacity-50"
              title="Escanear cabeceras inmediatamente"
            >
              <RefreshCw
                size={13}
                className={scanMutation.isPending ? 'animate-spin' : ''}
              />
              <span>{scanMutation.isPending ? 'Escaneando...' : 'Re-escanear'}</span>
            </button>
          )
        }
        quickKpis={
          selectedTarget && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-sans">
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Puntuación</div>
                <div className="text-base font-bold font-mono text-accent-green mt-0.5">
                  {selectedTarget.last_score !== null ? `${selectedTarget.last_score} / 100` : 'N/A'}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Cabeceras OK</div>
                <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                  {foundList.length}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Faltantes</div>
                <div
                  className={`text-base font-bold font-mono mt-0.5 ${
                    missingList.length > 0 ? 'text-amber-400' : 'text-accent-green'
                  }`}
                >
                  {missingList.length}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Último Check</div>
                <div className="text-xs font-semibold font-mono text-text-muted mt-0.5 truncate">
                  {selectedTarget.last_checked_at
                    ? new Date(selectedTarget.last_checked_at).toLocaleTimeString('es-ES', {
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
          { id: 'found', label: `Presentes (${foundList.length})`, icon: <CheckCircle2 size={13} /> },
          { id: 'missing', label: `Faltantes (${missingList.length})`, icon: <AlertTriangle size={13} /> },
          { id: 'history', label: 'Historial', icon: <Clock size={13} /> },
        ]}
        activeTab={drawerTab}
        onTabChange={(t) => setDrawerTab(t as any)}
        footerActions={
          selectedTarget && (
            <>
              <button
                type="button"
                onClick={() => handleOpenEdit(selectedTarget)}
                className="flex items-center gap-1.5 px-4 py-2 border border-border-base text-text-muted hover:text-text-main hover:bg-bg-dark rounded-full text-xs font-semibold transition-colors"
              >
                <Pencil size={14} />
                Editar Configuración
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(selectedTarget)}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-full text-xs font-semibold transition-colors"
              >
                <Trash2 size={14} />
                Eliminar Endpoint
              </button>
            </>
          )
        }
        maxWidthClass="max-w-2xl"
      >
        {selectedTarget && drawerTab === 'found' && (
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-text-muted">
              Cabeceras de Seguridad Detectadas Activas
            </h4>
            {foundList.length > 0 ? (
              <div className="space-y-2.5 font-mono text-xs">
                {foundList.map((header, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 font-bold flex items-center justify-between"
                  >
                    <span>{header}</span>
                    <span className="text-xs bg-emerald-500/20 px-2.5 py-0.5 rounded-full font-medium">
                      Presente
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-bg-dark/50 border border-border-base rounded-2xl p-8 text-center">
                <p className="text-text-dim text-xs">
                  No se detectaron cabeceras de seguridad activas en la última respuesta HTTP.
                </p>
              </div>
            )}
          </div>
        )}

        {selectedTarget && drawerTab === 'missing' && (
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-text-muted">
              Cabeceras Faltantes (Recomendaciones de Mitigación)
            </h4>
            {missingList.length > 0 ? (
              <div className="space-y-2.5 font-mono text-xs">
                {missingList.map((header, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 font-semibold flex items-center justify-between"
                  >
                    <span>{header}</span>
                    <span className="text-xs bg-rose-500/20 px-2.5 py-0.5 rounded-full font-medium">
                      Ausente
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-8 text-center text-emerald-400 text-xs font-medium">
                Excelente. Todas las cabeceras de seguridad recomendadas están presentes.
              </div>
            )}
          </div>
        )}

        {selectedTarget && drawerTab === 'history' && (
          <div className="space-y-4 font-sans">
            <h4 className="text-xs font-semibold text-text-muted">
              Historial de Escaneos Realizados
            </h4>
            {isLoadingResults ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-accent-green" size={28} />
              </div>
            ) : results && results.length > 0 ? (
              <div className="space-y-2.5">
                {results.map((res: SecurityHeaderResult) => (
                  <div
                    key={res.id}
                    className="p-3.5 bg-bg-dark/80 border border-border-base rounded-2xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Clock size={13} className="text-text-dim" />
                      <span className="font-mono text-text-muted">
                        {new Date(res.checked_at).toLocaleString('es-ES')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="font-bold text-text-main">{res.score} pts</span>
                      <GradeBadge grade={res.grade} score={res.score} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-bg-dark/50 border border-border-base rounded-2xl p-8 text-center">
                <p className="text-text-dim text-xs">
                  No hay historial previo registrado para este endpoint.
                </p>
              </div>
            )}
          </div>
        )}
      </NOCDrawer>

      {/* 7. CREATE / EDIT FORM MODAL */}
      {showForm && (
        <SecurityHeaderForm
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
