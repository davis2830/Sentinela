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
  Trash2,
  Eye,
  Calendar,
  Layers,
  CheckSquare,
  Square,
  Clock,
} from 'lucide-react';

interface ReportCardProps {
  report: ReportItem;
  isSelected: boolean;
  onToggleSelect: (report: ReportItem) => void;
  onSelectReport: (report: ReportItem) => void;
  onDelete: (report: ReportItem) => void;
  onExportCSV: (reportId: string, e?: React.MouseEvent) => void;
  onExportPDF: (reportId: string, e?: React.MouseEvent) => void;
}

export default function ReportCard({
  report,
  isSelected,
  onToggleSelect,
  onSelectReport,
  onDelete,
  onExportCSV,
  onExportPDF,
}: ReportCardProps) {
  const getTypeMeta = (type: ReportType) => {
    switch (type) {
      case 'sla':
        return {
          label: 'SLA Contractual',
          icon: <ShieldCheck size={16} className="text-accent-green" />,
          color: 'text-accent-green',
          bg: 'bg-accent-green/10',
          border: 'border-accent-green/20',
        };
      case 'availability':
        return {
          label: 'Disponibilidad',
          icon: <Activity size={16} className="text-sky-400" />,
          color: 'text-sky-400',
          bg: 'bg-sky-500/10',
          border: 'border-sky-500/20',
        };
      case 'ssl':
        return {
          label: 'Certificados SSL',
          icon: <ShieldCheck size={16} className="text-accent-purple" />,
          color: 'text-accent-purple',
          bg: 'bg-accent-purple/10',
          border: 'border-accent-purple/20',
        };
      case 'incidents':
        return {
          label: 'Incidentes & RCA',
          icon: <AlertTriangle size={16} className="text-accent-red" />,
          color: 'text-accent-red',
          bg: 'bg-accent-red/10',
          border: 'border-accent-red/20',
        };
      case 'trends':
        return {
          label: 'Tendencias & Latencia',
          icon: <TrendingUp size={16} className="text-accent-yellow" />,
          color: 'text-accent-yellow',
          bg: 'bg-accent-yellow/10',
          border: 'border-accent-yellow/20',
        };
      case 'summary':
      default:
        return {
          label: 'Resumen Ejecutivo',
          icon: <FileText size={16} className="text-text-main" />,
          color: 'text-text-main',
          bg: 'bg-bg-card',
          border: 'border-border-base',
        };
    }
  };

  const meta = getTypeMeta(report.report_type);
  const targetCount = report.parameters?.target_ids?.length;

  const slaVal =
    report.data?.overall_sla ??
    report.data?.summary?.overall_sla_percentage;
  const mttrVal =
    report.data?.mttr_minutes ??
    report.data?.summary?.mttr_minutes;
  const errorBudgetConsumed = report.data?.consumed_downtime_minutes;
  const remainingBudget = report.data?.remaining_budget_minutes;

  return (
    <div
      onClick={() => onSelectReport(report)}
      className={`group relative bg-bg-card border rounded-2xl p-5 hover:border-border-accent transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
        isSelected
          ? 'border-accent-green ring-1 ring-accent-green/40 bg-accent-green/[0.02]'
          : 'border-border-base'
      }`}
    >
      <div>
        {/* Top bar: Selection checkbox & Type Badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(report);
              }}
              className="text-text-dim hover:text-accent-green transition-colors"
            >
              {isSelected ? (
                <CheckSquare size={17} className="text-accent-green" />
              ) : (
                <Square size={17} />
              )}
            </button>
            <div className={`p-1.5 rounded-xl ${meta.bg} ${meta.border} border`}>
              {meta.icon}
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${meta.bg} ${meta.color} ${meta.border}`}
          >
            {meta.label}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-text-main text-sm group-hover:text-accent-green transition-colors line-clamp-1 mb-1">
          {report.title}
        </h3>

        {/* Period & Target Scope */}
        <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-text-dim mb-4">
          <span className="flex items-center gap-1">
            <Calendar size={12} className="shrink-0" />
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
                })
              : 'N/A'}
          </span>

          {targetCount && targetCount > 0 ? (
            <span className="flex items-center gap-1 text-accent-purple font-medium text-[11px]">
              <Layers size={11} />
              {targetCount} {targetCount === 1 ? 'objetivo' : 'objetivos'}
            </span>
          ) : (
            <span className="text-[11px]">Todos los objetivos</span>
          )}
        </div>

        {/* Metric Card / SLA Gauge */}
        {report.status === 'completed' && slaVal !== undefined && (
          <div className="bg-bg-main/60 border border-border-base/70 rounded-xl p-3 mb-4 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-text-dim uppercase font-semibold">
                SLA Cumplido
              </span>
              <span className="text-base font-bold font-mono text-accent-green">
                {slaVal.toFixed(2)}%
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-border-base h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-accent-green h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(slaVal, 100)}%` }}
              />
            </div>
            {remainingBudget !== undefined && (
              <div className="flex items-center justify-between text-[10px] text-text-dim font-mono pt-0.5">
                <span>Budget restante:</span>
                <span className="text-sky-400 font-medium">{remainingBudget} min</span>
              </div>
            )}
          </div>
        )}

        {report.status === 'completed' && report.report_type === 'incidents' && (
          <div className="bg-bg-main/60 border border-border-base/70 rounded-xl p-3 mb-4 grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] uppercase font-semibold text-text-dim block">
                Incidentes
              </span>
              <span className="text-base font-bold font-mono text-text-main">
                {report.data?.total_incidents ?? 0}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-text-dim block">
                MTTR Prom.
              </span>
              <span className="text-base font-bold font-mono text-sky-400">
                {mttrVal ?? 0}m
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer: Status + Actions */}
      <div className="pt-3 border-t border-border-base/50 flex items-center justify-between">
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

        {/* Action icons */}
        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onSelectReport(report)}
            title="Ver detalle"
            className="p-1.5 text-text-dim hover:text-accent-green hover:bg-bg-main rounded-lg transition-colors"
          >
            <Eye size={15} />
          </button>

          {report.status === 'completed' && (
            <>
              <button
                type="button"
                onClick={(e) => onExportCSV(report.id, e)}
                title="Exportar CSV (UTF-8 BOM)"
                className="p-1.5 text-text-dim hover:text-emerald-400 hover:bg-bg-main rounded-lg transition-colors"
              >
                <FileSpreadsheet size={15} />
              </button>
              <button
                type="button"
                onClick={(e) => onExportPDF(report.id, e)}
                title="Exportar / Imprimir PDF"
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
      </div>
    </div>
  );
}
