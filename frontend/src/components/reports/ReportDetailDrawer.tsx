import React, { useState } from 'react';
import type { ReportItem } from '../../types/reports';
import { NOCDrawer } from '../common/noc';
import StatusBadge from '../common/StatusBadge';
import {
  FileText,
  ShieldCheck,
  Activity,
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  Copy,
  Check,
  Calendar,
  Layers,
  Clock,
  Wrench,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from 'lucide-react';

interface ReportDetailDrawerProps {
  report: ReportItem | null;
  isOpen: boolean;
  onClose: () => void;
  onExportCSV: (reportId: string, e?: React.MouseEvent) => void;
  onExportPDF: (reportId: string, e?: React.MouseEvent) => void;
}

export default function ReportDetailDrawer({
  report,
  isOpen,
  onClose,
  onExportCSV,
  onExportPDF,
}: ReportDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'targets' | 'incidents' | 'export'>('summary');
  const [copiedRaw, setCopiedRaw] = useState(false);

  if (!report) return null;

  const data = report.data || {};
  const targets = data.targets || [];
  const incidents = data.incidents || [];
  const targetSla = data.target_sla ?? 99.9;
  const overallSla = data.overall_sla ?? data.summary?.overall_sla_percentage ?? 100.0;
  const mttr = data.mttr_minutes ?? data.summary?.mttr_minutes ?? 0;
  const mttd = data.mttd_minutes ?? data.summary?.mttd_minutes ?? 0;
  const totalIncidents = data.total_incidents ?? data.summary?.open_incidents ?? 0;

  const allowedDowntime = data.allowed_downtime_minutes ?? 43.2;
  const consumedDowntime = data.consumed_downtime_minutes ?? 0;
  const remainingBudget = data.remaining_budget_minutes ?? (allowedDowntime - consumedDowntime);
  const budgetConsumedPct = data.budget_consumed_percentage ?? (allowedDowntime > 0 ? (consumedDowntime / allowedDowntime) * 100 : 0);

  const handleCopyRaw = () => {
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const tabs = [
    { id: 'summary', label: 'Resumen Ejecutivo' },
    { id: 'targets', label: `Objetivos (${targets.length})` },
    { id: 'incidents', label: `Incidentes (${incidents.length})` },
    { id: 'export', label: 'Exportación & Raw' },
  ];

  return (
    <NOCDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={report.title}
      subtitle={`Informe oficial de tipo ${report.report_type.toUpperCase()} generado el ${
        report.generated_at
          ? new Date(report.generated_at).toLocaleString('es-ES')
          : 'Pendiente'
      }`}
      statusBadge={
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase bg-accent-green/10 text-accent-green border border-accent-green/30">
          {report.report_type}
        </span>
      }
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tabId) => setActiveTab(tabId as any)}
    >
      {/* TAB 1: RESUMEN EJECUTIVO */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          {/* Top Scorecard */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-bg-main/60 border border-border-base">
              <span className="text-[11px] uppercase font-semibold text-text-dim block mb-1">
                SLA Global Auditado
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono text-accent-green">
                  {overallSla.toFixed(2)}%
                </span>
                <span className="text-xs text-text-dim font-mono">/ {targetSla}%</span>
              </div>
              <div className="mt-2 flex items-center gap-1 text-xs">
                {overallSla >= targetSla ? (
                  <span className="flex items-center gap-1 text-accent-green font-medium">
                    <CheckCircle2 size={13} /> SLA Contractual Cumplido
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-accent-red font-medium">
                    <XCircle size={13} /> Brecha de Incumplimiento
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-bg-main/60 border border-border-base">
              <span className="text-[11px] uppercase font-semibold text-text-dim block mb-1">
                Error Budget Restante
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono text-sky-400">
                  {typeof remainingBudget === 'number' ? remainingBudget.toFixed(1) : remainingBudget}m
                </span>
                <span className="text-xs text-text-dim font-mono">
                  / {typeof allowedDowntime === 'number' ? allowedDowntime.toFixed(1) : allowedDowntime}m
                </span>
              </div>
              <div className="w-full bg-border-base h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-sky-400 h-full rounded-full"
                  style={{ width: `${Math.min(Number(budgetConsumedPct), 100)}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] text-text-dim">
                Consumido: {Number(budgetConsumedPct).toFixed(1)}% del límite
              </div>
            </div>
          </div>

          {/* SRE Metrics: MTTR & MTTD */}
          <div className="p-4 rounded-xl bg-bg-main/60 border border-border-base space-y-3">
            <h4 className="text-xs font-semibold text-text-main flex items-center gap-2">
              <Clock size={15} className="text-amber-400" />
              Métricas Operativas ITIL / SRE
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-bg-card rounded-lg border border-border-base/50">
                <span className="text-[10px] text-text-dim uppercase block">MTTR (Reparación)</span>
                <span className="text-lg font-bold font-mono text-sky-400">{mttr} min</span>
              </div>
              <div className="p-3 bg-bg-card rounded-lg border border-border-base/50">
                <span className="text-[10px] text-text-dim uppercase block">MTTD (Detección)</span>
                <span className="text-lg font-bold font-mono text-amber-400">{mttd} min</span>
              </div>
              <div className="p-3 bg-bg-card rounded-lg border border-border-base/50">
                <span className="text-[10px] text-text-dim uppercase block">Total Incidentes</span>
                <span className="text-lg font-bold font-mono text-text-main">{totalIncidents}</span>
              </div>
            </div>
          </div>

          {/* Period & Scope Details */}
          <div className="p-4 rounded-xl bg-bg-main/60 border border-border-base space-y-2 text-xs">
            <h4 className="text-xs font-semibold text-text-main flex items-center gap-2">
              <Calendar size={15} className="text-accent-purple" />
              Parámetros de la Auditoría
            </h4>
            <div className="grid grid-cols-2 gap-2 text-text-muted pt-1">
              <div>
                <span className="text-text-dim block text-[11px]">Rango de Fechas:</span>
                <span className="font-mono text-text-main">
                  {report.period_start ? new Date(report.period_start).toLocaleDateString('es-ES') : 'N/A'}{' '}
                  -{' '}
                  {report.period_end ? new Date(report.period_end).toLocaleDateString('es-ES') : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-text-dim block text-[11px]">Objetivos Incluidos:</span>
                <span className="font-mono text-text-main">
                  {report.parameters?.target_ids?.length
                    ? `${report.parameters.target_ids.length} objetivos específicos`
                    : 'Todos los servicios de la organización'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DESGLOSE DE TARGETS */}
      {activeTab === 'targets' && (
        <div className="space-y-4">
          {targets.length > 0 ? (
            <div className="border border-border-base rounded-xl overflow-hidden bg-bg-main/60">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-base text-text-dim bg-bg-card/50">
                    <th className="py-2.5 px-3">Servicio / Endpoint</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Chequeos</th>
                    <th className="py-2.5 px-3">SLA (%)</th>
                    <th className="py-2.5 px-3 text-right">Dictamen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-base/30">
                  {targets.map((t) => {
                    const isPass = t.sla_percentage >= Number(targetSla);
                    return (
                      <tr key={t.target_id} className="hover:bg-bg-card-hover/40 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-text-main">{t.target_name}</div>
                          <div className="text-[10px] text-text-dim font-mono truncate max-w-[220px]">
                            {t.endpoint}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-border-base/60 text-text-muted uppercase">
                            {t.target_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-text-muted">
                          {t.total_checks.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold">
                          <span className={isPass ? 'text-accent-green' : 'text-accent-red'}>
                            {t.sla_percentage.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isPass
                                ? 'bg-accent-green/10 text-accent-green border border-accent-green/20'
                                : 'bg-accent-red/10 text-accent-red border border-accent-red/20'
                            }`}
                          >
                            {isPass ? 'CUMPLE' : 'INCUMPLE'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-text-dim bg-bg-main/40 border border-border-base/50 rounded-xl">
              No hay desglose granular de targets disponible en este tipo de reporte.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: INCIDENTES */}
      {activeTab === 'incidents' && (
        <div className="space-y-4">
          {incidents.length > 0 ? (
            <div className="border border-border-base rounded-xl overflow-hidden bg-bg-main/60">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-base text-text-dim bg-bg-card/50">
                    <th className="py-2.5 px-3">Incidente</th>
                    <th className="py-2.5 px-3">Prioridad</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3">Apertura</th>
                    <th className="py-2.5 px-3 text-right">Cierre</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-base/30">
                  {incidents.map((inc) => (
                    <tr key={inc.id} className="hover:bg-bg-card-hover/40 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-text-main">{inc.title}</div>
                        <div className="text-[10px] text-text-dim font-mono">
                          ID: {inc.id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            inc.priority === 'critical'
                              ? 'bg-accent-red/10 text-accent-red border border-accent-red/20'
                              : 'bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20'
                          }`}
                        >
                          {inc.priority}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-text-muted capitalize">{inc.status}</td>
                      <td className="py-2.5 px-3 text-text-dim font-mono text-[11px]">
                        {new Date(inc.opened_at).toLocaleDateString('es-ES', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-3 text-right text-text-dim font-mono text-[11px]">
                        {inc.closed_at
                          ? new Date(inc.closed_at).toLocaleDateString('es-ES', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'En curso'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-text-dim bg-bg-main/40 border border-border-base/50 rounded-xl">
              Cero incidentes registrados en el período analizado. SLA y disponibilidad inmaculados.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: EXPORTACIÓN & RAW */}
      {activeTab === 'export' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-bg-main/60 border border-border-base space-y-3">
            <h4 className="text-xs font-semibold text-text-main">
              Descarga Oficial de Auditoría
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={(e) => onExportCSV(report.id, e)}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl font-medium text-xs transition-colors"
              >
                <FileSpreadsheet size={16} />
                Exportar CSV (UTF-8 BOM)
              </button>
              <button
                type="button"
                onClick={(e) => onExportPDF(report.id, e)}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-xl font-medium text-xs transition-colors"
              >
                <Printer size={16} />
                Imprimir / PDF Ejecutivo
              </button>
            </div>
            <p className="text-[11px] text-text-dim">
              El archivo CSV incluye cabecera Byte Order Mark (UTF-8 BOM) para compatibilidad instantánea con Excel en Windows sin caracteres corruptos.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-bg-main/60 border border-border-base space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-text-main">Payload JSON Inmutable</h4>
              <button
                type="button"
                onClick={handleCopyRaw}
                className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-main transition-colors"
              >
                {copiedRaw ? <Check size={14} className="text-accent-green" /> : <Copy size={14} />}
                {copiedRaw ? 'Copiado' : 'Copiar JSON'}
              </button>
            </div>
            <pre className="p-3 bg-bg-card rounded-lg text-[11px] font-mono text-text-muted overflow-x-auto max-h-64 border border-border-base/50">
              {JSON.stringify(report, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </NOCDrawer>
  );
}
