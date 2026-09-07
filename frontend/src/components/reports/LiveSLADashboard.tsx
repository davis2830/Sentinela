import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { LiveSLAMetrics } from '../../types/reports';
import {
  ShieldCheck,
  AlertTriangle,
  Flame,
  Clock,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers,
} from 'lucide-react';

interface LiveSLADashboardProps {
  refetchInterval?: number | false;
}

export default function LiveSLADashboard({ refetchInterval }: LiveSLADashboardProps) {
  const [days, setDays] = useState<number>(30);
  const [targetSla, setTargetSla] = useState<number>(99.9);
  const [expanded, setExpanded] = useState<boolean>(false);

  const { data: metrics, isLoading } = useQuery<LiveSLAMetrics>({
    queryKey: ['live-sla-metrics', days, targetSla],
    queryFn: async () => {
      const res = await api.get('reports/sla-live/', {
        params: { days, target_sla: targetSla },
      });
      return (res.data?.data || null) as LiveSLAMetrics;
    },
    refetchInterval,
  });

  const currentSla = metrics?.current_sla ?? 99.9;
  const isMeeting = currentSla >= targetSla;
  const consumedPct = metrics?.consumed_percentage ?? 0;
  const totalBudget = metrics?.total_error_budget_minutes ?? 43.2;
  const consumedBudget = metrics?.consumed_error_budget_minutes ?? 0;
  const remainingBudget = metrics?.remaining_error_budget_minutes ?? 43.2;
  const meetingTargets = metrics?.meeting_sla ?? 0;
  const totalTargets = metrics?.total_targets ?? 0;

  // Determine budget status
  const getBudgetStatus = () => {
    if (consumedPct >= 100) return { label: 'Agotado', color: 'text-accent-red', bg: 'bg-accent-red/10', border: 'border-accent-red/30' };
    if (consumedPct >= 75) return { label: 'Consumo Crítico', color: 'text-accent-red', bg: 'bg-accent-red/10', border: 'border-accent-red/30' };
    if (consumedPct >= 50) return { label: 'Consumo Acelerado', color: 'text-accent-yellow', bg: 'bg-accent-yellow/10', border: 'border-accent-yellow/30' };
    return { label: 'Saludable', color: 'text-accent-green', bg: 'bg-accent-green/10', border: 'border-accent-green/30' };
  };

  const budgetStatus = getBudgetStatus();

  return (
    <div className="bg-bg-card border border-border-base rounded-2xl p-5 shadow-sm space-y-4">
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-base/50">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-accent-green/10 border border-accent-green/20 text-accent-green">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text-main">
                Telemetría SLA & Presupuesto de Error (Error Budget)
              </h2>
              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue border border-accent-blue/20 font-medium">
                <Sparkles size={11} />
                En Vivo
              </span>
            </div>
            <p className="text-xs text-text-dim">
              Seguimiento contractual SRE en tiempo real para el período activo
            </p>
          </div>
        </div>

        {/* Filters: Days & SLA Presets */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Days */}
          <div className="flex items-center bg-bg-main border border-border-base rounded-xl p-0.5">
            {[
              { label: '7D', value: 7 },
              { label: '30D', value: 30 },
              { label: '90D', value: 90 },
            ].map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDays(d.value)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  days === d.value
                    ? 'bg-accent-green text-black font-semibold shadow-sm'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Target SLA */}
          <div className="flex items-center bg-bg-main border border-border-base rounded-xl p-0.5">
            {[99.0, 99.5, 99.9, 99.99].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setTargetSla(val)}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  targetSla === val
                    ? 'bg-accent-blue text-white font-semibold shadow-sm'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                {val}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* SLA Actual vs Objetivo */}
        <div className="p-4 rounded-xl bg-bg-main/60 border border-border-base/70">
          <div className="flex items-center justify-between text-xs text-text-dim mb-1">
            <span>SLA Observado</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isMeeting
                  ? 'bg-accent-green/10 text-accent-green border border-accent-green/30'
                  : 'bg-accent-red/10 text-accent-red border border-accent-red/30'
              }`}
            >
              {isMeeting ? 'Cumple SLA' : 'Incumplimiento'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono ${
                isMeeting ? 'text-accent-green' : 'text-accent-red'
              }`}
            >
              {currentSla.toFixed(2)}%
            </span>
            <span className="text-xs text-text-dim font-mono">/ {targetSla}%</span>
          </div>
          <div className="mt-2 text-[11px] text-text-muted flex items-center justify-between">
            <span>Meta contractual</span>
            <span className="text-text-main font-mono">&ge; {targetSla}%</span>
          </div>
        </div>

        {/* Error Budget Restante */}
        <div className="p-4 rounded-xl bg-bg-main/60 border border-border-base/70">
          <div className="flex items-center justify-between text-xs text-text-dim mb-1">
            <span>Error Budget Restante</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${budgetStatus.bg} ${budgetStatus.color} ${budgetStatus.border}`}
            >
              {budgetStatus.label}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-sky-400">
              {remainingBudget.toFixed(1)}m
            </span>
            <span className="text-xs text-text-dim">de {totalBudget.toFixed(1)}m</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-border-base/60 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                consumedPct >= 80
                  ? 'bg-accent-red'
                  : consumedPct >= 50
                  ? 'bg-accent-yellow'
                  : 'bg-accent-green'
              }`}
              style={{ width: `${Math.min(consumedPct, 100)}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-text-dim font-mono">
            <span>Consumido: {consumedPct.toFixed(1)}%</span>
            <span>Permitido: {totalBudget.toFixed(1)}m</span>
          </div>
        </div>

        {/* Servicios Cumpliendo */}
        <div className="p-4 rounded-xl bg-bg-main/60 border border-border-base/70">
          <div className="flex items-center justify-between text-xs text-text-dim mb-1">
            <span>Servicios en Meta</span>
            <Layers size={14} className="text-accent-purple" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-text-main">
              {meetingTargets}
            </span>
            <span className="text-xs text-text-dim">de {totalTargets} servicios</span>
          </div>
          <div className="mt-2 text-[11px] text-text-muted flex items-center justify-between">
            <span>Tasa de cumplimiento</span>
            <span className="text-accent-purple font-mono font-semibold">
              {totalTargets > 0 ? ((meetingTargets / totalTargets) * 100).toFixed(0) : 100}%
            </span>
          </div>
        </div>

        {/* MTTR & MTTD Período */}
        <div className="p-4 rounded-xl bg-bg-main/60 border border-border-base/70">
          <div className="flex items-center justify-between text-xs text-text-dim mb-1">
            <span>Eficiencia Operativa</span>
            <Clock size={14} className="text-accent-yellow" />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div>
              <span className="text-[10px] uppercase font-semibold text-text-dim block">MTTR</span>
              <span className="text-lg font-bold font-mono text-sky-400">
                {metrics?.mttr_minutes ?? 0}m
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-text-dim block">MTTD</span>
              <span className="text-lg font-bold font-mono text-accent-yellow">
                {metrics?.mttd_minutes ?? 0}m
              </span>
            </div>
          </div>
          <div className="mt-1 text-[10px] text-text-dim">
            Basado en incidentes cerrados en {days} días
          </div>
        </div>
      </div>

      {/* Target breakdown drawer toggle */}
      {metrics?.targets && metrics.targets.length > 0 && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-3 py-2 bg-bg-main/50 hover:bg-bg-main border border-border-base/50 rounded-xl text-xs text-text-muted hover:text-text-main transition-colors"
          >
            <span className="flex items-center gap-2">
              <Activity size={14} className="text-accent-green" />
              <span>
                Desglose de Presupuesto por Servicio ({metrics.targets.length} monitoreados)
              </span>
            </span>
            <span className="flex items-center gap-1 font-medium">
              {expanded ? 'Ocultar' : 'Ver Servicios'}
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </button>

          {expanded && (
            <div className="mt-3 overflow-x-auto border border-border-base/60 rounded-xl bg-bg-main/70">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-base text-text-dim bg-bg-card/50">
                    <th className="py-2.5 px-3">Servicio</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Disponibilidad</th>
                    <th className="py-2.5 px-3">Latencia Prom.</th>
                    <th className="py-2.5 px-3">Downtime Est.</th>
                    <th className="py-2.5 px-3">Burn Rate</th>
                    <th className="py-2.5 px-3 text-right">Dictamen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-base/30">
                  {metrics.targets.map((t) => (
                    <tr key={t.target_id} className="hover:bg-bg-card-hover/40 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-text-main">{t.target_name}</div>
                        <div className="text-[10px] text-text-dim font-mono truncate max-w-[200px]">
                          {t.endpoint}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-border-base/60 text-text-muted uppercase">
                          {t.target_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold">
                        <span className={t.meets_sla ? 'text-accent-green' : 'text-accent-red'}>
                          {t.uptime_percentage.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-text-muted">
                        {t.avg_latency_ms}ms
                      </td>
                      <td className="py-2.5 px-3 font-mono text-sky-400">
                        {t.consumed_budget_minutes.toFixed(1)} min
                      </td>
                      <td className="py-2.5 px-3">
                        {t.burn_rate === 'exhausted' ? (
                          <span className="flex items-center gap-1 text-[10px] text-accent-red font-semibold">
                            <Flame size={12} /> Agotado
                          </span>
                        ) : t.burn_rate === 'fast' ? (
                          <span className="flex items-center gap-1 text-[10px] text-accent-yellow font-medium">
                            <Flame size={12} /> Acelerado
                          </span>
                        ) : t.burn_rate === 'normal' ? (
                          <span className="text-[10px] text-text-muted">Normal</span>
                        ) : (
                          <span className="text-[10px] text-accent-green">Inmune (0m)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            t.meets_sla
                              ? 'bg-accent-green/10 text-accent-green border border-accent-green/20'
                              : 'bg-accent-red/10 text-accent-red border border-accent-red/20'
                          }`}
                        >
                          {t.meets_sla ? 'CUMPLE' : 'INCUMPLE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
