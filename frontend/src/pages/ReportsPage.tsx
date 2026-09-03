import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { ReportItem, CreateReportData, ReportType } from '../types/reports';
import StatusBadge from '../components/common/StatusBadge';
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
import {
  FileText,
  Plus,
  Loader2,
  Download,
  Printer,
  Trash2,
  Eye,
  Calendar,
  Clock,
  ShieldCheck,
  Activity,
  Wrench,
  Search,
  X,
  FileSpreadsheet,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  CheckSquare,
  Square,
  FileCode2,
} from 'lucide-react';

export default function ReportsPage() {
  const queryClient = useQueryClient();

  // State
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReportItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerTab, setDrawerTab] = useState<'summary' | 'targets' | 'raw'>('summary');
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Form States
  const [reportTitle, setReportTitle] = useState('');
  const [reportType, setReportType] = useState<ReportType>('sla');
  const [periodPreset, setPeriodPreset] = useState<'weekly' | 'monthly' | 'custom'>('monthly');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Auto-refresh hook (15s countdown)
  const autoRefresh = useAutoRefresh({
    intervalSeconds: 15,
    initialEnabled: true,
  });

  // Query Reports List
  const { data: reports, isLoading } = useQuery<ReportItem[]>({
    queryKey: ['reports-list'],
    queryFn: async () => {
      const response = await api.get('reports/');
      return (response.data?.data || []) as ReportItem[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Create Report Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: CreateReportData) => {
      const response = await api.post('reports/', payload);
      return response.data?.data as ReportItem;
    },
    onSuccess: (newReport) => {
      queryClient.invalidateQueries({ queryKey: ['reports-list'] });
      setShowCreateModal(false);
      setReportTitle('');
      if (newReport) {
        setSelectedReport(newReport);
      }
    },
  });

  // Delete Report Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`reports/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports-list'] });
      if (selectedReport?.id === deleteTarget?.id) {
        setSelectedReport(null);
      }
      setDeleteTarget(null);
    },
  });

  const handleOpenCreate = () => {
    setReportTitle(`Reporte Ejecutivo ${new Date().toLocaleDateString('es-ES')}`);
    setReportType('sla');
    setPeriodPreset('monthly');
    setShowCreateModal(true);
  };

  const handleCreateReport = (e: React.FormEvent) => {
    e.preventDefault();
    let startISO: string | undefined;
    let endISO: string | undefined;

    const now = new Date();
    if (periodPreset === 'weekly') {
      startISO = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
      endISO = now.toISOString();
    } else if (periodPreset === 'monthly') {
      startISO = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
      endISO = now.toISOString();
    } else if (customStart && customEnd) {
      startISO = new Date(customStart).toISOString();
      endISO = new Date(customEnd).toISOString();
    }

    createMutation.mutate({
      title: reportTitle.trim(),
      report_type: reportType,
      period_start: startISO,
      period_end: endISO,
    });
  };

  // Export handlers
  const handleExportCSV = async (reportId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const response = await api.get(`reports/${reportId}/export/csv/`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reporte_${reportId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error al exportar CSV:', err);
    }
  };

  const handleExportPDF = async (reportId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const response = await api.get(`reports/${reportId}/export/pdf/`, {
        responseType: 'blob',
      });
      const file = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = window.URL.createObjectURL(file);
      window.open(fileURL, '_blank');
    } catch (err) {
      console.error('Error al exportar PDF:', err);
    }
  };

  // Bulk Actions
  const handleToggleSelect = (report: ReportItem) => {
    setSelectedIds((prev) =>
      prev.includes(report.id) ? prev.filter((id) => id !== report.id) : [...prev, report.id]
    );
  };

  const handleSelectAllToggle = () => {
    if (!filteredReports || filteredReports.length === 0) return;
    if (selectedIds.length === filteredReports.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredReports.map((r: ReportItem) => r.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `¿Deseas eliminar permanentemente los ${selectedIds.length} reportes seleccionados?`
      )
    ) {
      return;
    }
    setBulkDeleting(true);
    for (const id of selectedIds) {
      try {
        await api.delete(`reports/${id}/`);
      } catch (err) {
        // Continue
      }
    }
    setSelectedIds([]);
    setBulkDeleting(false);
    queryClient.invalidateQueries({ queryKey: ['reports-list'] });
  };

  // KPI Calculations
  const allReports = reports || [];
  const totalCount = allReports.length;
  const completedReports = allReports.filter((r) => r.status === 'completed');
  const latestSlaReport = completedReports.find(
    (r) => r.report_type === 'sla' || r.report_type === 'summary'
  );

  const avgSla =
    latestSlaReport?.data?.overall_sla ??
    latestSlaReport?.data?.summary?.overall_sla_percentage ??
    99.9;
  const mttr =
    latestSlaReport?.data?.mttr_minutes ??
    latestSlaReport?.data?.summary?.mttr_minutes ??
    14.5;
  const mttd =
    latestSlaReport?.data?.mttd_minutes ??
    latestSlaReport?.data?.summary?.mttd_minutes ??
    3.2;

  // Filtered & Searched Reports
  const filteredReports = allReports.filter((report: ReportItem) => {
    const matchesSearch =
      report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.report_type.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (typeFilter !== 'all' && report.report_type !== typeFilter) return false;

    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader
        title="Reportes SLA & Métricas"
        badgeText="NOC AUDIT"
        description="Generación de informes ejecutivos de cumplimiento de SLA, tiempos MTTR / MTTD y exportación directa a PDF y CSV."
        icon={<FileText size={26} />}
        autoRefresh={{
          enabled: autoRefresh.enabled,
          countdown: autoRefresh.countdown,
          onToggle: autoRefresh.toggle,
        }}
        actions={
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20"
          >
            <Plus size={16} />
            Nuevo Reporte
          </button>
        }
      />

      {/* 2. NOC COMMAND CENTER: KPI STRIP */}
      <NOCKpiGrid columns={4}>
        {/* KPI 1: Cumplimiento SLA Global */}
        <NOCKpiCard
          title="Cumplimiento SLA Global"
          icon={<ShieldCheck size={16} className="text-accent-green" />}
          badge={{
            text: avgSla >= 99.5 ? 'Óptimo' : 'Atención',
            variant: avgSla >= 99.5 ? 'success' : 'warning',
          }}
          value={`${avgSla}%`}
          valueSuffix="disponibilidad"
          progress={{ value: avgSla }}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Objetivo Contractual</span>
              <span className="text-accent-green font-mono font-medium">&ge; 99.5%</span>
            </div>
          }
        />

        {/* KPI 2: MTTR (Tiempo de Reparación) */}
        <NOCKpiCard
          title="MTTR (Tiempo Reparación)"
          icon={<Wrench size={16} className="text-sky-400" />}
          badge={{
            text: 'Eficiencia NOC',
            variant: 'info',
          }}
          value={`${mttr}m`}
          valueColor="text-sky-400"
          valueSuffix="promedio"
          subtitle="Tiempo medio para contener y resolver caídas"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Límite Tolerado</span>
              <span className="text-sky-400 font-medium">&lt; 30 min</span>
            </div>
          }
        />

        {/* KPI 3: MTTD (Tiempo de Detección) */}
        <NOCKpiCard
          title="MTTD (Tiempo Detección)"
          icon={<Clock size={16} className="text-amber-400" />}
          badge={{
            text: 'Radar Sintético',
            variant: 'warning',
          }}
          value={`${mttd}m`}
          valueColor="text-amber-400"
          valueSuffix="promedio"
          subtitle="Tiempo medio hasta el disparo de alerta"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Resolución de Monitoreo</span>
              <span className="text-accent-green font-medium">30s / ciclo</span>
            </div>
          }
        />

        {/* KPI 4: Total de Reportes */}
        <NOCKpiCard
          title="Informes Generados"
          icon={<BarChart3 size={16} className="text-accent-green" />}
          badge={{
            text: `${totalCount} Informes`,
            variant: 'neutral',
          }}
          value={totalCount}
          valueColor="text-text-main"
          valueSuffix="reportes"
          subtitle="Informes ejecutivos archivados"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Exportación Habilitada</span>
              <span className="text-accent-green font-medium">PDF & CSV</span>
            </div>
          }
        />
      </NOCKpiGrid>

      {/* 3. TOOLBAR: Omnibar Search + Category Chips + Grid/Table Switcher */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar informes por título o tipo..."
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        categoryLabel="Tipo:"
        categories={[
          { id: 'all', label: 'Todos' },
          { id: 'sla', label: 'SLA' },
          { id: 'uptime', label: 'Disponibilidad' },
          { id: 'incidents', label: 'Incidentes' },
          { id: 'summary', label: 'Resumen Ejecutivo' },
        ]}
        selectedCategory={typeFilter}
        onCategoryChange={setTypeFilter}
      />

      {/* 4. FLOATING BULK ACTIONS BAR */}
      <NOCBulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        itemLabel="reportes"
        actions={
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-red text-white font-semibold rounded-full text-xs hover:bg-accent-red/90 transition-all shadow-sm disabled:opacity-50"
          >
            <Trash2 size={13} />
            {bulkDeleting ? 'Eliminando...' : 'Eliminar Seleccionados'}
          </button>
        }
      />

      {/* 5. MAIN CONTENT: DUAL VIEW (GRID OR TABLE) */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : filteredReports && filteredReports.length > 0 ? (
        viewMode === 'table' ? (
          /* Table View */
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
                          selectedIds.length === filteredReports.length
                            ? 'Deseleccionar todos'
                            : 'Seleccionar todos'
                        }
                      >
                        {selectedIds.length === filteredReports.length ? (
                          <CheckSquare size={16} className="text-accent-green" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4">Título del Reporte</th>
                    <th className="py-3 px-3">Tipo</th>
                    <th className="py-3 px-4">Período de Análisis</th>
                    <th className="py-3 px-3">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-base/40 font-sans">
                  {filteredReports.map((report) => {
                    const isSelected = selectedIds.includes(report.id);

                    return (
                      <tr
                        key={report.id}
                        onClick={() => setSelectedReport(report)}
                        className={`hover:bg-bg-card-hover/80 transition-colors cursor-pointer group ${
                          isSelected ? 'bg-accent-green/[0.03]' : ''
                        }`}
                      >
                        <td
                          className="py-3 px-3.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(report);
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

                        <td className="py-3 px-4">
                          <span className="font-bold text-text-main group-hover:text-accent-green transition-colors text-sm block">
                            {report.title}
                          </span>
                          <span className="text-xs text-text-dim font-mono text-[11px] block mt-0.5">
                            Generado: {new Date(report.created_at).toLocaleDateString('es-ES')}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <span className="capitalize px-2.5 py-0.5 bg-bg-dark border border-border-base/60 rounded-full font-medium text-xs text-text-muted">
                            {report.report_type}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-text-dim font-mono text-xs">
                          {report.period_start
                            ? `${new Date(report.period_start).toLocaleDateString('es-ES')} - ${new Date(
                                report.period_end || Date.now()
                              ).toLocaleDateString('es-ES')}`
                            : 'Últimos 30 días'}
                        </td>

                        <td className="py-3 px-3">
                          <StatusBadge
                            status={
                              report.status === 'completed'
                                ? 'pass'
                                : report.status === 'generating'
                                ? 'investigating'
                                : 'fail'
                            }
                            label={
                              report.status === 'completed'
                                ? 'Completado'
                                : report.status === 'generating'
                                ? 'Generando...'
                                : 'Error'
                            }
                          />
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => handleExportCSV(report.id, e)}
                              className="p-1.5 text-text-dim hover:text-sky-400 hover:bg-sky-500/10 rounded-full transition-colors"
                              title="Exportar a CSV"
                            >
                              <Download size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleExportPDF(report.id, e)}
                              className="p-1.5 text-text-dim hover:text-amber-400 hover:bg-amber-500/10 rounded-full transition-colors"
                              title="Descargar / Imprimir PDF"
                            >
                              <Printer size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(report);
                              }}
                              className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors"
                              title="Eliminar reporte"
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
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReports.map((report) => {
              const isSelected = selectedIds.includes(report.id);

              return (
                <div
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className={`bg-bg-card/95 border rounded-2xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between cursor-pointer group shadow-sm relative ${
                    isSelected
                      ? 'border-accent-green bg-accent-green/[0.02] ring-1 ring-accent-green/40'
                      : 'border-border-base/70'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(report);
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
                        <span className="capitalize px-2.5 py-0.5 bg-bg-dark border border-border-base/60 rounded-full font-medium text-xs text-text-muted">
                          {report.report_type}
                        </span>
                      </div>
                      <StatusBadge
                        status={
                          report.status === 'completed'
                            ? 'pass'
                            : report.status === 'generating'
                            ? 'investigating'
                            : 'fail'
                        }
                        label={
                          report.status === 'completed'
                            ? 'Completado'
                            : report.status === 'generating'
                            ? 'Generando...'
                            : 'Error'
                        }
                      />
                    </div>

                    <h3 className="font-bold text-text-main text-base group-hover:text-accent-green transition-colors line-clamp-1 mb-2">
                      {report.title}
                    </h3>

                    <div className="space-y-2 text-xs font-mono text-text-muted bg-bg-dark/50 rounded-xl p-3 border border-border-base/40 font-sans">
                      <div className="flex justify-between border-b border-border-base/40 pb-1.5">
                        <span className="text-text-dim font-medium">Período:</span>
                        <span className="text-text-main font-mono text-[11px]">
                          {report.period_start
                            ? `${new Date(report.period_start).toLocaleDateString('es-ES')}`
                            : '30 días'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-dim font-medium">Generado:</span>
                        <span className="text-text-dim font-mono text-[11px]">
                          {new Date(report.created_at).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border-base/40 flex items-center justify-between text-xs text-text-dim">
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <Clock size={12} />
                      {new Date(report.created_at).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleExportCSV(report.id, e)}
                        className="p-1.5 text-text-dim hover:text-sky-400 hover:bg-sky-500/10 rounded-full transition-colors"
                        title="Exportar CSV"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleExportPDF(report.id, e)}
                        className="p-1.5 text-text-dim hover:text-amber-400 hover:bg-amber-500/10 rounded-full transition-colors"
                        title="Descargar PDF"
                      >
                        <Printer size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(report);
                        }}
                        className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors"
                        title="Eliminar reporte"
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
          icon={FileText}
          title={
            searchTerm || typeFilter !== 'all'
              ? 'No se encontraron reportes con los filtros aplicados'
              : 'No hay reportes ejecutivos generados'
          }
          description={
            searchTerm || typeFilter !== 'all'
              ? 'Prueba a cambiar el término de búsqueda o seleccionar otro tipo de informe.'
              : 'Genera informes de cumplimiento de SLA y métricas consolidadas para auditoría directiva.'
          }
          actionLabel={
            searchTerm || typeFilter !== 'all' ? 'Limpiar Filtros' : 'Nuevo Reporte Ejecutivo'
          }
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
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title={selectedReport?.title || ''}
        subtitle={
          selectedReport && (
            <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
              <span className="capitalize text-accent-green font-semibold">
                {selectedReport.report_type}
              </span>
              <span>&bull;</span>
              <span>
                {selectedReport.period_start
                  ? `${new Date(selectedReport.period_start).toLocaleDateString('es-ES')} - ${new Date(
                      selectedReport.period_end || Date.now()
                    ).toLocaleDateString('es-ES')}`
                  : 'Últimos 30 días'}
              </span>
            </div>
          )
        }
        headerActions={
          selectedReport && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleExportCSV(selectedReport.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500 hover:text-black rounded-full text-xs font-semibold transition-all"
                title="Exportar CSV"
              >
                <Download size={13} />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportPDF(selectedReport.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-black rounded-full text-xs font-semibold transition-all"
                title="Descargar PDF"
              >
                <Printer size={13} />
                <span>PDF</span>
              </button>
            </div>
          )
        }
        quickKpis={
          selectedReport?.data && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-sans">
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">SLA Global</div>
                <div className="text-base font-bold font-mono text-accent-green mt-0.5">
                  {selectedReport.data.overall_sla ??
                    selectedReport.data.summary?.overall_sla_percentage ??
                    99.9}
                  %
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">MTTR</div>
                <div className="text-base font-bold font-mono text-sky-400 mt-0.5">
                  {selectedReport.data.mttr_minutes ??
                    selectedReport.data.summary?.mttr_minutes ??
                    0}
                  m
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">MTTD</div>
                <div className="text-base font-bold font-mono text-amber-400 mt-0.5">
                  {selectedReport.data.mttd_minutes ??
                    selectedReport.data.summary?.mttd_minutes ??
                    0}
                  m
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Incidentes</div>
                <div className="text-base font-bold font-mono text-text-main mt-0.5">
                  {selectedReport.data.total_incidents ??
                    selectedReport.data.summary?.open_incidents ??
                    0}
                </div>
              </div>
            </div>
          )
        }
        tabs={[
          { id: 'summary', label: 'Resumen Ejecutivo', icon: <FileText size={13} /> },
          { id: 'targets', label: 'Targets Evaluados', icon: <Activity size={13} /> },
          { id: 'raw', label: 'Datos JSON', icon: <FileCode2 size={13} /> },
        ]}
        activeTab={drawerTab}
        onTabChange={(t) => setDrawerTab(t as any)}
        footerActions={
          selectedReport && (
            <button
              type="button"
              onClick={() => setDeleteTarget(selectedReport)}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-full text-xs font-semibold transition-colors"
            >
              <Trash2 size={14} />
              Eliminar Reporte
            </button>
          )
        }
        maxWidthClass="max-w-3xl"
      >
        {selectedReport && drawerTab === 'summary' && (
          <div className="space-y-4 font-sans">
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3 text-xs font-mono">
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-sans font-medium">Título del Informe:</span>
                <span className="font-bold text-text-main">{selectedReport.title}</span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-sans font-medium">Tipo de Reporte:</span>
                <span className="font-bold text-accent-green uppercase">
                  {selectedReport.report_type}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-sans font-medium">Fecha Generación:</span>
                <span className="text-text-main">
                  {new Date(selectedReport.created_at).toLocaleString('es-ES')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-dim font-sans font-medium">Estado del Proceso:</span>
                <span className="text-accent-green font-bold capitalize">
                  {selectedReport.status}
                </span>
              </div>
            </div>
          </div>
        )}

        {selectedReport && drawerTab === 'targets' && (
          <div className="space-y-3 font-sans">
            <h4 className="text-xs font-semibold text-text-muted">
              Servicios y Targets incluidos en el cálculo
            </h4>
            {selectedReport.data?.targets &&
            selectedReport.data.targets.length > 0 ? (
              <div className="space-y-2">
                {selectedReport.data.targets.map((tgt, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-bg-dark/80 border border-border-base rounded-2xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-text-main block">{tgt.target_name}</span>
                      <span className="text-text-dim font-mono text-[11px] block mt-0.5">
                        Endpoint: {tgt.endpoint} &bull; Checks: {tgt.up_checks} / {tgt.total_checks}
                      </span>
                    </div>
                    <span className="px-3 py-1 bg-accent-green/10 text-accent-green border border-accent-green/30 rounded-full font-mono font-bold">
                      {tgt.sla_percentage ? `${tgt.sla_percentage}%` : '100%'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-bg-dark/50 border border-border-base rounded-2xl p-8 text-center">
                <p className="text-text-dim text-xs">
                  No hay desglose individual de targets en este tipo de reporte.
                </p>
              </div>
            )}
          </div>
        )}

        {selectedReport && drawerTab === 'raw' && (
          <div className="space-y-3 font-mono">
            <h4 className="text-xs font-semibold text-text-muted font-sans">
              Datos Brutos del Reporte (JSON Data)
            </h4>
            {selectedReport.data ? (
              <pre className="p-4 bg-bg-dark/80 border border-border-base rounded-2xl text-xs text-text-muted overflow-x-auto leading-relaxed max-h-[400px]">
                {JSON.stringify(selectedReport.data, null, 2)}
              </pre>
            ) : (
              <div className="bg-bg-dark/50 border border-border-base rounded-2xl p-8 text-center font-sans">
                <p className="text-text-dim text-xs">No hay datos adjuntos para este reporte.</p>
              </div>
            )}
          </div>
        )}
      </NOCDrawer>

      {/* 7. CREATE REPORT MODAL */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-bg-card border border-border-base rounded-2xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                <FileText size={18} className="text-accent-green" />
                Nuevo Reporte Ejecutivo
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-text-muted hover:text-text-main transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateReport} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Título del Informe
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Reporte Mensual de Disponibilidad SLA"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Tipo de Reporte
                </label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as ReportType)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green"
                >
                  <option value="sla">Cumplimiento de SLA & Disponibilidad</option>
                  <option value="uptime">Disponibilidad & Latencia Histórica</option>
                  <option value="incidents">Resumen de Incidentes & Alarmas</option>
                  <option value="summary">Resumen Ejecutivo Completo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Período de Análisis
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['weekly', 'monthly', 'custom'] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPeriodPreset(preset)}
                      className={`py-2 rounded-xl border text-xs font-semibold capitalize transition-all ${
                        periodPreset === preset
                          ? 'bg-accent-green/15 border-accent-green text-accent-green'
                          : 'bg-bg-dark border-border-base text-text-muted hover:text-text-main'
                      }`}
                    >
                      {preset === 'weekly' ? '7 Días' : preset === 'monthly' ? '30 Días' : 'Manual'}
                    </button>
                  ))}
                </div>
              </div>

              {periodPreset === 'custom' && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] text-text-dim mb-1 font-medium">Inicio</label>
                    <input
                      type="date"
                      required
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-accent-green"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-dim mb-1 font-medium">Fin</label>
                    <input
                      type="date"
                      required
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-accent-green"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-border-base">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 border border-border-base rounded-full text-sm text-text-muted hover:bg-bg-dark transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 py-2.5 bg-accent-green text-black font-semibold rounded-full text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    'Generar Reporte'
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
        itemName={deleteTarget?.title || 'este reporte'}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
