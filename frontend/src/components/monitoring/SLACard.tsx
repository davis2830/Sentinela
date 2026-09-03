import React from 'react';
import type { TimeseriesSummary } from '../../types/monitoring';
import { ShieldCheck, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface SLACardProps {
  period: '24h' | '7d' | '30d';
  onPeriodChange: (period: '24h' | '7d' | '30d') => void;
  summary: TimeseriesSummary;
  targetInterval?: number;
}

export default function SLACard({
  period,
  onPeriodChange,
  summary,
}: SLACardProps) {
  const uptimePct = summary.uptime_percentage;
  const isCompliant = uptimePct >= 99.0;
  const incidentsCount = summary.incidents_count;
  const totalDowntimeSeconds = summary.total_downtime_seconds;

  // Format total downtime string
  let downtimeFormatted = '0 seg';
  if (totalDowntimeSeconds > 0) {
    if (totalDowntimeSeconds < 60) {
      downtimeFormatted = `${totalDowntimeSeconds}s`;
    } else if (totalDowntimeSeconds < 3600) {
      const mins = Math.floor(totalDowntimeSeconds / 60);
      const secs = totalDowntimeSeconds % 60;
      downtimeFormatted = `${mins}m ${secs}s`;
    } else {
      const hrs = Math.floor(totalDowntimeSeconds / 3600);
      const mins = Math.floor((totalDowntimeSeconds % 3600) / 60);
      downtimeFormatted = `${hrs}h ${mins}m`;
    }
  }

  const periodDescription =
    period === '24h' ? 'Últimas 24 horas' : period === '7d' ? 'Últimos 7 días' : 'Últimos 30 días';

  return (
    <div className="bg-bg-card border border-border-base rounded-xl p-6 mb-6 shadow-xl">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-border-base/50 pb-4">
        <div>
          <div className="flex items-center gap-2 font-bold text-text-main text-base">
            <ShieldCheck size={20} className="text-accent-blue" />
            <span>Nivel de Servicio (SLA) & Disponibilidad</span>
          </div>
          <p className="text-[11px] text-text-dim mt-0.5">
            Métricas de cumplimiento contractual y tiempo de actividad del servicio
          </p>
        </div>

        {/* Time Selector */}
        <div className="flex items-center gap-1 bg-bg-dark border border-border-base rounded-lg p-1 font-mono text-xs self-start sm:self-auto">
          <button
            onClick={() => onPeriodChange('24h')}
            className={`px-3 py-1 rounded transition-all font-semibold ${
              period === '24h'
                ? 'bg-accent-green text-black shadow-sm'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            24 Horas
          </button>
          <button
            onClick={() => onPeriodChange('7d')}
            className={`px-3 py-1 rounded transition-all font-semibold ${
              period === '7d'
                ? 'bg-accent-green text-black shadow-sm'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            7 Días
          </button>
          <button
            onClick={() => onPeriodChange('30d')}
            className={`px-3 py-1 rounded transition-all font-semibold ${
              period === '30d'
                ? 'bg-accent-green text-black shadow-sm'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            30 Días
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* % Uptime */}
        <div className="p-4 bg-bg-dark border border-border-base hover:border-accent-green/30 rounded-2xl transition-all">
          <span className="text-xs text-text-muted font-medium flex items-center justify-between">
            <span>% Disponibilidad SLA</span>
            <ShieldCheck
              size={14}
              className={isCompliant ? 'text-accent-green' : 'text-accent-red'}
            />
          </span>
          <div
            className={`text-2xl font-bold font-mono mt-1 ${
              uptimePct >= 99
                ? 'text-accent-green'
                : uptimePct >= 95
                ? 'text-accent-yellow'
                : 'text-accent-red'
            }`}
          >
            {uptimePct.toFixed(2)}%
          </div>
          <div className="text-[10px] text-text-dim mt-1 font-mono">
            {isCompliant ? 'Cumple meta SLA (≥99%)' : 'Desviación de meta SLA'}
          </div>
        </div>

        {/* Total Checks */}
        <div className="p-4 bg-bg-dark border border-border-base rounded-2xl">
          <span className="text-xs text-text-muted font-medium flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Clock size={13} />
              <span>Total Chequeos</span>
            </span>
          </span>
          <div className="text-2xl font-bold font-mono mt-1 text-text-main">
            {summary.total_checks.toLocaleString()}
          </div>
          <div className="text-[10px] text-text-dim mt-1 font-mono">
            {periodDescription}
          </div>
        </div>

        {/* Successful Checks */}
        <div className="p-4 bg-bg-dark border border-border-base rounded-2xl">
          <span className="text-xs text-text-muted font-medium flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-accent-green">
              <CheckCircle2 size={13} />
              <span>Chequeos Exitosos</span>
            </span>
          </span>
          <div className="text-2xl font-bold font-mono mt-1 text-accent-green">
            {summary.up_checks.toLocaleString()}
          </div>
          <div className="text-[10px] text-text-dim mt-1 font-mono">
            {summary.down_checks === 0 ? 'Sin fallos registrados' : `${summary.up_checks} respuestas OK`}
          </div>
        </div>

        {/* Downtime Incidents */}
        <div
          className={`p-4 bg-bg-dark border rounded-2xl transition-all ${
            incidentsCount > 0
              ? 'border-accent-red/40 bg-accent-red/5'
              : 'border-border-base'
          }`}
        >
          <span className="text-xs font-medium flex items-center justify-between">
            <span
              className={`flex items-center gap-1.5 ${
                incidentsCount > 0 ? 'text-accent-red' : 'text-text-muted'
              }`}
            >
              {incidentsCount > 0 ? <AlertTriangle size={13} /> : <XCircle size={13} />}
              <span>Caídas / Interrupciones</span>
            </span>
          </span>
          <div
            className={`text-2xl font-bold font-mono mt-1 ${
              incidentsCount > 0 ? 'text-accent-red' : 'text-text-main'
            }`}
          >
            {incidentsCount}
          </div>
          <div className="text-[10px] text-text-dim mt-1 font-mono">
            {incidentsCount > 0
              ? `${downtimeFormatted} fuera de servicio`
              : '0 eventos de interrupción'}
          </div>
        </div>
      </div>
    </div>
  );
}
