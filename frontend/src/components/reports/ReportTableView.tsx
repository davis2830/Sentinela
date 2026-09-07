import React from 'react';
import type { ReportItem, ReportType } from '../../types/reports';
import StatusBadge from '../common/StatusBadge';
import {
  FileText,
  ShieldCheck,
  Activity,
  AlertTriangle,
  TrendingUp,
  FileSpreadsheet,
  Printer,
  Download,
  Trash2,
  Eye,
  CheckSquare,
  Square,
  Calendar,
  Layers,
} from 'lucide-react';

interface ReportTableViewProps {
  reports: ReportItem[];
  selectedIds: string[];
  onToggleSelect: (report: ReportItem) => void;
  onSelectAllToggle: () => void;
  onSelectReport: (report: ReportItem) => void;
  onDelete: (report: ReportItem) => void;
  onExportCSV: (reportId: string, e?: React.MouseEvent) => void;
  onExportPDF: (reportId: string, e?: React.MouseEvent) => void;
}

export default function ReportTableView({
  reports,
  selectedIds,
  onToggleSelect,
  onSelectAllToggle,
  onSelectReport,
  onDelete,
  onExportCSV,
  onExportPDF,
}: ReportTableViewProps) {
  const getTypeMeta = (type: ReportType) => {
    switch (type) {
      case 'sla':
        return {
          label: 'SLA Contractual',
          icon: <ShieldCheck size={14} className="text-accent-green" />,
          color: 'text-accent-green',
          bg: 'bg-accent-green/10',
          border: 'border-accent-green/20',
        };
      case 'availability':
        return {
          label: 'Disponibilidad',
          icon: <Activity size={14} className="text-sky-400" />,
          color: 'text-sky-400',
          bg: 'bg-sky-500/10',
          border: 'border-sky-500/20',
        };
      case 'ssl':
        return {
          label: 'Certificados SSL',
          icon: <ShieldCheck size={14} className="text-accent-purple" />,
          color: 'text-accent-purple',
          bg: 'bg-accent-purple/10',
          border: 'border-accent-purple/20',
        };
      case 'incidents':
        return {
          label: 'Incidentes & RCA',
          icon: <AlertTriangle size={14} className="text-accent-red" />,
          color: 'text-accent-red',
          bg: 'bg-accent-red/10',
          border: 'border-accent-red/20',
        };
      case 'trends':
        return {
          label: 'Tendencias & Latencia',
          icon: <TrendingUp size={14} className="text-accent-yellow" />,
          color: 'text-accent-yellow',
          bg: 'bg-accent-yellow/10',
          border: 'border-accent-yellow/20',
        };
      case 'summary':
      default:
        return {
          label: 'Resumen Ejecutivo',
          icon: <FileText size={14} className="text-text-main" />,
          color: 'text-text-main',
          bg: 'bg-bg-card',
          border: 'border-border-base',
        };
    }
  };

  const isAllSelected = reports.length > 0 && selectedIds.length === reports.length;

  return (
    <div className="bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border-base text-text-dim text-xs bg-bg-card/60">
              <th className="py-3 px-3.5 w-10">
                <button
                  type="button"
                  onClick={onSelectAllToggle}
                  className="text-text-dim hover:text-accent-green transition-colors"
                  title={isAllSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                >
                  {isAllSelected ? (
                    <CheckSquare size={16} className="text-accent-green" />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
              </th>
              <th className="py-3 px-4">Título del Reporte</th>
              <th className="py-3 px-3">Tipo</th>
              <th className="py-3 px-3">Alcance (Targets)</th>
              <th className="py-3 px-4">Período de Análisis</th>
              <th className="py-3 px-3">Métrica Clave</th>
              <th className="py-3 px-3">Estado</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base/40 font-sans">
            {reports.map((report) => {
              const isSelected = selectedIds.includes(report.id);
              const meta = getTypeMeta(report.report_type);
              const targetCount = report.parameters?.target_ids?.length;

              // Extract key metric
              let keyMetricLabel = '-';
              if (report.data) {
                if (report.report_type === 'sla' || report.report_type === 'availability') {
                  const sla = report.data.overall_sla;
                  keyMetricLabel = sla !== undefined ? `${sla.toFixed(2)}% SLA` : '-';
                } else if (report.report_type === 'incidents') {
                  const incs = report.data.total_incidents ?? 0;
                  const mttr = report.data.mttr_minutes ?? 0;
                  keyMetricLabel = `${incs} inc / ${mttr}m MTTR`;
                } else if (report.report_type === 'summary') {
                  const sla = report.data.summary?.overall_sla_percentage;
                  keyMetricLabel = sla !== undefined ? `${sla.toFixed(2)}% SLA` : '-';
                } else if (report.report_type === 'ssl') {
                  const valid = report.data.certificates?.filter((c) => c.is_valid).length ?? 0;
                  const total = report.data.certificates?.length ?? 0;
                  keyMetricLabel = `${valid}/${total} válidos`;
                }
              }

              return (
                <tr
                  key={report.id}
                  onClick={() => onSelectReport(report)}
                  className={`hover:bg-bg-card-hover/80 transition-colors cursor-pointer group ${
                    isSelected ? 'bg-accent-green/[0.04]' : ''
                  }`}
                >
                  <td
                    className="py-3 px-3.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(report);
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

                  {/* Title & Date */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg ${meta.bg} ${meta.border} border`}>
                        {meta.icon}
                      </div>
                      <div>
                        <span className="font-medium text-text-main group-hover:text-accent-green transition-colors block">
                          {report.title}
                        </span>
                        <span className="text-[10px] text-text-dim">
                          Generado:{' '}
                          {report.generated_at
                            ? new Date(report.generated_at).toLocaleString('es-ES', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : 'Pendiente'}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Type Badge */}
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${meta.bg} ${meta.color} ${meta.border}`}
                    >
                      {meta.label}
                    </span>
                  </td>

                  {/* Scoped Targets */}
                  <td className="py-3 px-3">
                    {targetCount && targetCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple border border-accent-purple/20 font-medium">
                        <Layers size={11} />
                        {targetCount} {targetCount === 1 ? 'objetivo' : 'objetivos'}
                      </span>
                    ) : (
                      <span className="text-[11px] text-text-dim">Todos (Global)</span>
                    )}
                  </td>

                  {/* Period */}
                  <td className="py-3 px-4 text-text-muted">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <Calendar size={12} className="text-text-dim shrink-0" />
                      <span>
                        {report.period_start
                          ? new Date(report.period_start).toLocaleDateString('es-ES', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'N/A'}{' '}
                        &mdash;{' '}
                        {report.period_end
                          ? new Date(report.period_end).toLocaleDateString('es-ES', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'N/A'}
                      </span>
                    </div>
                  </td>

                  {/* Key Metric */}
                  <td className="py-3 px-3 font-mono font-semibold">
                    <span
                      className={
                        keyMetricLabel.includes('SLA')
                          ? 'text-accent-green'
                          : 'text-text-main'
                      }
                    >
                      {keyMetricLabel}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3">
                    <StatusBadge
                      status={
                        report.status === 'completed'
                          ? 'active'
                          : report.status === 'generating'
                          ? 'warning'
                          : report.status === 'failed'
                          ? 'down'
                          : 'unknown'
                      }
                      label={
                        report.status === 'completed'
                          ? 'Completado'
                          : report.status === 'generating'
                          ? 'Generando...'
                          : report.status === 'failed'
                          ? 'Fallido'
                          : 'Pendiente'
                      }
                    />
                  </td>

                  {/* Action buttons */}
                  <td
                    className="py-3 px-4 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => onSelectReport(report)}
                        title="Ver detalle de auditoría"
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-bg-main rounded-lg transition-colors"
                      >
                        <Eye size={15} />
                      </button>

                      {report.status === 'completed' && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => onExportCSV(report.id, e)}
                            title="Exportar CSV oficial (UTF-8 BOM)"
                            className="p-1.5 text-text-dim hover:text-emerald-400 hover:bg-bg-main rounded-lg transition-colors"
                          >
                            <FileSpreadsheet size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => onExportPDF(report.id, e)}
                            title="Imprimir / Exportar PDF Ejecutivo"
                            className="p-1.5 text-text-dim hover:text-sky-400 hover:bg-bg-main rounded-lg transition-colors"
                          >
                            <Printer size={15} />
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => onDelete(report)}
                        title="Eliminar reporte"
                        className="p-1.5 text-text-dim hover:text-accent-red hover:bg-bg-main rounded-lg transition-colors"
                      >
                        <Trash2 size={15} />
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
  );
}
