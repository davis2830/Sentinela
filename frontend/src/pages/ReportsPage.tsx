import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { ReportItem, CreateReportData, ReportType } from '../types/reports';
import StatusBadge from '../components/common/StatusBadge';
import ConfirmDelete from '../components/common/ConfirmDelete';
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
} from 'lucide-react';

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReportItem | null>(null);

  // Form States
  const [reportTitle, setReportTitle] = useState('');
  const [reportType, setReportType] = useState<ReportType>('sla');
  const [periodPreset, setPeriodPreset] = useState<'weekly' | 'monthly' | 'custom'>('monthly');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Query Reports List
  const { data: reports, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['reports-list'],
    queryFn: async () => {
      const response = await api.get('reports/');
      return (response.data?.data || []) as ReportItem[];
    },
    refetchInterval: 15000,
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
  const handleExportCSV = async (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await api.get(`reports/${reportId}/export/csv/`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reporte_${reportId.substring(0, 8)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al exportar CSV:', err);
    }
  };

  const handleExportPDF = async (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await api.get(`reports/${reportId}/export/pdf/`, {
        responseType: 'blob',
      });
      const file = new Blob([response.data], { type: 'text/html;charset=utf-8' });
      const fileURL = window.URL.createObjectURL(file);
      window.open(fileURL, '_blank');
    } catch (err) {
      console.error('Error al exportar PDF:', err);
    }
  };

  // KPI Calculations
  const completedReports = reports?.filter((r) => r.status === 'completed') || [];
  const latestSlaReport = completedReports.find((r) => r.report_type === 'sla' || r.report_type === 'summary');
  
  const avgSla = latestSlaReport?.data?.overall_sla ?? latestSlaReport?.data?.summary?.overall_sla_percentage ?? 99.9;
  const mttr = latestSlaReport?.data?.mttr_minutes ?? latestSlaReport?.data?.summary?.mttr_minutes ?? 14.5;
  const mttd = latestSlaReport?.data?.mttd_minutes ?? latestSlaReport?.data?.summary?.mttd_minutes ?? 3.2;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            <FileText className="text-accent-green" size={28} />
            Reportes SLA & Métricas Ejecutivas
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Generación de informes de cumplimiento de SLA, tiempos MTTR / MTTD y exportación directa a PDF y CSV
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 bg-accent-green text-black font-semibold px-4 py-2 rounded-md text-sm hover:opacity-90 transition-opacity self-start sm:self-auto"
        >
          <Plus size={18} />
          Nuevo Reporte Ejecutivo
        </button>
      </div>

      {/* High-Level KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-bg-card border border-border-base rounded-xl p-5 shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent-green/10 border border-accent-green/30 flex items-center justify-center text-accent-green font-bold">
            <ShieldCheck size={24} />
          </div>
          <div>
            <span className="text-xs font-mono text-text-dim uppercase">Cumplimiento SLA Global</span>
            <div className="text-xl font-bold text-accent-green font-mono">{avgSla}%</div>
          </div>
        </div>

        <div className="bg-bg-card border border-border-base rounded-xl p-5 shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center text-accent-blue font-bold">
            <Wrench size={24} />
          </div>
          <div>
            <span className="text-xs font-mono text-text-dim uppercase">MTTR (Tiempo Reparación)</span>
            <div className="text-xl font-bold text-text-main font-mono">{mttr} min</div>
          </div>
        </div>

        <div className="bg-bg-card border border-border-base rounded-xl p-5 shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent-yellow/10 border border-accent-yellow/30 flex items-center justify-center text-accent-yellow font-bold">
            <Clock size={24} />
          </div>
          <div>
            <span className="text-xs font-mono text-text-dim uppercase">MTTD (Tiempo Detección)</span>
            <div className="text-xl font-bold text-text-main font-mono">{mttd} min</div>
          </div>
        </div>

        <div className="bg-bg-card border border-border-base rounded-xl p-5 shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent-purple/10 border border-border-base flex items-center justify-center text-text-main font-bold">
            <BarChart3 size={24} />
          </div>
          <div>
            <span className="text-xs font-mono text-text-dim uppercase">Total Reportes Generados</span>
            <div className="text-xl font-bold text-text-main font-mono">{reports?.length || 0}</div>
          </div>
        </div>
      </div>

      {/* Reports Table List */}
      <div className="bg-bg-card border border-border-base rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-border-base pb-4">
          <h2 className="text-base font-bold text-text-main flex items-center gap-2 font-mono uppercase">
            <FileSpreadsheet size={18} className="text-accent-green" />
            Historial de Reportes e Informes de Auditoría
          </h2>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-1.5 border border-border-base rounded text-text-muted hover:text-text-main transition-colors disabled:opacity-50"
            title="Refrescar reportes"
          >
            <Loader2 size={16} className={isRefetching ? 'animate-spin text-accent-green' : ''} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-accent-green" size={28} />
          </div>
        ) : reports && reports.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-border-base text-text-dim uppercase">
                  <th className="py-3 px-4">Título del Reporte</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Período de Análisis</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones Exportación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base/50">
                {reports.map((report) => (
                  <tr
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className="hover:bg-bg-dark/50 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-bold text-text-main group-hover:text-accent-green transition-colors">
                      {report.title}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="uppercase px-2 py-0.5 bg-bg-dark border border-border-base rounded font-semibold text-text-muted">
                        {report.report_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-text-dim">
                      {report.period_start
                        ? `${new Date(report.period_start).toLocaleDateString('es-ES')} - ${new Date(
                            report.period_end || Date.now()
                          ).toLocaleDateString('es-ES')}`
                        : 'Últimos 30 días'}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge
                        status={report.status === 'completed' ? 'pass' : report.status === 'generating' ? 'investigating' : 'fail'}
                        label={report.status === 'completed' ? 'Completado' : report.status === 'generating' ? 'Generando...' : 'Error'}
                      />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReport(report);
                          }}
                          className="p-1.5 bg-bg-dark border border-border-base rounded hover:border-accent-green hover:text-accent-green transition-colors text-text-muted"
                          title="Ver detalle de reporte"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={(e) => handleExportCSV(report.id, e)}
                          className="p-1.5 bg-bg-dark border border-border-base rounded hover:border-accent-blue hover:text-accent-blue transition-colors text-text-muted"
                          title="Exportar a CSV"
                        >
                          <Download size={15} />
                        </button>
                        <button
                          onClick={(e) => handleExportPDF(report.id, e)}
                          className="p-1.5 bg-bg-dark border border-border-base rounded hover:border-accent-yellow hover:text-accent-yellow transition-colors text-text-muted"
                          title="Descargar / Imprimir PDF Ejecutivo"
                        >
                          <Printer size={15} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(report);
                          }}
                          className="p-1.5 bg-bg-dark border border-border-base rounded hover:border-accent-red hover:text-accent-red transition-colors text-text-muted"
                          title="Eliminar reporte"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-text-dim text-xs py-8 text-center font-mono">
            No se han generado reportes ejecutivos todavía.
          </p>
        )}
      </div>

      {/* View Selected Report Modal */}
      {selectedReport && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="bg-bg-card border border-border-base rounded-2xl p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-2xl space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-base pb-3">
              <div>
                <h3 className="text-lg font-bold text-text-main">{selectedReport.title}</h3>
                <p className="text-xs text-text-muted font-mono mt-0.5">
                  Tipo: <span className="uppercase text-accent-green">{selectedReport.report_type}</span> &bull; Generado: {new Date(selectedReport.created_at).toLocaleString('es-ES')}
                </p>
              </div>
              <button onClick={() => setSelectedReport(null)} className="text-text-muted hover:text-text-main">
                <X size={20} />
              </button>
            </div>

            {/* Report Header KPIs */}
            <div className="grid grid-cols-3 gap-4 font-mono text-xs">
              <div className="bg-bg-dark border border-border-base rounded-xl p-3 text-center">
                <span className="text-text-dim uppercase text-[10px]">SLA Cumplido</span>
                <div className="text-base font-bold text-accent-green mt-1">
                  {selectedReport.data?.overall_sla ?? selectedReport.data?.summary?.overall_sla_percentage ?? 100}%
                </div>
              </div>
              <div className="bg-bg-dark border border-border-base rounded-xl p-3 text-center">
                <span className="text-text-dim uppercase text-[10px]">MTTR (Reparación)</span>
                <div className="text-base font-bold text-accent-blue mt-1">
                  {selectedReport.data?.mttr_minutes ?? selectedReport.data?.summary?.mttr_minutes ?? 0} min
                </div>
              </div>
              <div className="bg-bg-dark border border-border-base rounded-xl p-3 text-center">
                <span className="text-text-dim uppercase text-[10px]">MTTD (Detección)</span>
                <div className="text-base font-bold text-accent-yellow mt-1">
                  {selectedReport.data?.mttd_minutes ?? selectedReport.data?.summary?.mttd_minutes ?? 0} min
                </div>
              </div>
            </div>

            {/* Details Table */}
            {selectedReport.data?.targets && selectedReport.data.targets.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-mono uppercase font-bold text-text-main">Desglose de Servicios Monitoreados</h4>
                <div className="bg-bg-dark border border-border-base rounded-xl overflow-hidden font-mono text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border-base text-text-dim uppercase bg-bg-card/50">
                        <th className="py-2 px-3">Servicio</th>
                        <th className="py-2 px-3">Endpoint</th>
                        <th className="py-2 px-3">Verificaciones</th>
                        <th className="py-2 px-3 text-right">SLA %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-base/40">
                      {selectedReport.data.targets.map((t) => (
                        <tr key={t.target_id}>
                          <td className="py-2 px-3 font-bold text-text-main">{t.target_name}</td>
                          <td className="py-2 px-3 text-text-muted">{t.endpoint}</td>
                          <td className="py-2 px-3">{t.total_checks}</td>
                          <td className="py-2 px-3 text-right font-bold text-accent-green">{t.sla_percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Export Bar */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-base">
              <button
                onClick={(e) => handleExportCSV(selectedReport.id, e)}
                className="flex items-center gap-2 px-4 py-2 bg-bg-dark border border-border-base hover:border-accent-blue text-text-main rounded-lg text-xs font-mono transition-colors"
              >
                <Download size={14} />
                Exportar CSV
              </button>
              <button
                onClick={(e) => handleExportPDF(selectedReport.id, e)}
                className="flex items-center gap-2 px-4 py-2 bg-accent-green text-black font-semibold rounded-lg text-xs font-mono hover:opacity-90 transition-opacity"
              >
                <Printer size={14} />
                Ver / Imprimir Reporte PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Report Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-bg-card border border-border-base rounded-2xl p-6 w-full max-w-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 border-b border-border-base pb-3">
              <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                <FileText size={18} className="text-accent-green" />
                Nuevo Reporte Ejecutivo
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-text-muted hover:text-text-main">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateReport} className="space-y-4 font-sans">
              <div>
                <label className="block text-xs font-mono uppercase text-text-muted mb-1 font-bold">
                  Título del Reporte
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Reporte Mensual de Disponibilidad SLA"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-text-muted mb-1 font-bold">
                  Tipo de Reporte
                </label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as ReportType)}
                  className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                >
                  <option value="sla">SLA & Disponibilidad por Servicio</option>
                  <option value="summary">Resumen Ejecutivo Completo</option>
                  <option value="incidents">Reporte de Incidentes, MTTR y MTTD</option>
                  <option value="availability">Análisis de Indisponibilidad (Downtime)</option>
                  <option value="ssl">Estado de Certificados SSL</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-text-muted mb-1 font-bold">
                  Período de Análisis
                </label>
                <select
                  value={periodPreset}
                  onChange={(e) => setPeriodPreset(e.target.value as any)}
                  className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                >
                  <option value="weekly">Semanal (Últimos 7 días)</option>
                  <option value="monthly">Mensual (Últimos 30 días)</option>
                  <option value="custom">Rango Personalizado</option>
                </select>
              </div>

              {periodPreset === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono text-text-muted mb-1">Fecha Inicio</label>
                    <input
                      type="date"
                      required
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-1.5 text-xs font-mono text-text-main"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-text-muted mb-1">Fecha Fin</label>
                    <input
                      type="date"
                      required
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-1.5 text-xs font-mono text-text-main"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-base">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 bg-bg-dark border border-border-base rounded-lg text-xs text-text-muted hover:text-text-main"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-1.5 bg-accent-green text-black font-semibold rounded-lg text-xs hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
                  Generar Reporte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
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
