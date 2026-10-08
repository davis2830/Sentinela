import React from 'react';
import { Activity, AlertTriangle, HeartPulse, Shield } from 'lucide-react';
import { dashboardHealthTone } from '../../utils/dashboardHealthTone';

interface Props {
  healthScore: number | null; totalTargets: number; healthyTargets: number; degradedTargets: number; downTargets: number; unknownTargets: number;
  availability: number | null; avgLatencyMs: number | null; attentionCount: number; criticalAttentionCount: number; activeIncidentsCount: number;
  telemetryPoints?: { uptime: number | null; latency: number | null }[]; isLoading: boolean;
}

const sparkline = (values: (number | null)[], color: string, label: string) => {
  const measured = values.filter((value): value is number => value !== null);
  if (measured.length < 2) return <span className="text-[10px] text-text-dim">Sin tendencia disponible</span>;
  const min = Math.min(...measured); const span = Math.max(1, Math.max(...measured) - min); let drawing = false;
  const path = values.map((value, index) => { if (value === null) { drawing = false; return ''; } const point = `${index * 100 / Math.max(1, values.length - 1)},${17 - (value - min) * 14 / span}`; const command = `${drawing ? 'L' : 'M'}${point}`; drawing = true; return command; }).join(' ');
  return <svg className="h-6 w-full" viewBox="0 0 100 20" preserveAspectRatio="none" role="img" aria-label={label}><path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" /></svg>;
};

function NOCExecutiveKpis({ healthScore, totalTargets, healthyTargets, degradedTargets, downTargets, unknownTargets, availability, avgLatencyMs, attentionCount, criticalAttentionCount, activeIncidentsCount, telemetryPoints = [], isLoading }: Props) {
  const cards = [
    { title: 'Salud actual', icon: HeartPulse, color: dashboardHealthTone({total:totalTargets,down:downTargets,degraded:degradedTargets,unknown:unknownTargets,score:healthScore,unavailable:isLoading}), value: isLoading ? '—' : healthScore == null ? 'Sin datos' : `${healthScore}%`, detail: `${healthyTargets}/${totalTargets} saludables · ${downTargets} caídos · ${unknownTargets} sin datos`, chart: null },
    { title: 'Disponibilidad del período', icon: Shield, color: 'text-accent-green', value: availability == null ? 'Sin datos' : `${availability.toFixed(2)}%`, detail: 'Uptime consolidado de checks', chart: sparkline(telemetryPoints.map((point) => point.uptime), '#00d4aa', 'Tendencia de disponibilidad') },
    { title: 'Latencia promedio', icon: Activity, color: 'text-accent-cyan', value: avgLatencyMs == null ? 'Sin datos' : `${Math.round(avgLatencyMs)} ms`, detail: 'Promedio del período seleccionado', chart: sparkline(telemetryPoints.map((point) => point.latency), '#38d9f5', 'Tendencia de latencia') },
    { title: 'Requiere atención', icon: AlertTriangle, color: criticalAttentionCount ? 'text-accent-red' : attentionCount ? 'text-accent-yellow' : 'text-accent-green', value: attentionCount.toString(), detail: `${criticalAttentionCount} críticos · ${activeIncidentsCount} incidentes activos`, chart: null },
  ];
  return (
    <section className="grid grid-cols-2 overflow-hidden rounded-xl border border-border-base/60 bg-bg-card xl:grid-cols-4" data-testid="dashboard-kpis">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div key={card.title} className={`px-4 py-3 ${index % 2 === 0 ? 'border-r border-border-base/60' : ''} ${index < 2 ? 'border-b xl:border-b-0 border-border-base/60' : ''} ${index === 1 ? 'xl:border-r xl:border-border-base/60' : ''}`}>
            <div className="flex items-center gap-1.5 text-[11px] text-text-muted"><Icon size={13} className={card.color} />{card.title}</div>
            <div className="mt-1.5 flex items-center justify-between gap-3"><strong data-testid={index===0?'dashboard-kpi-health-score':undefined} className={`text-2xl metric-value ${card.color}`}>{card.value}</strong>{card.chart && <div className="hidden w-20 shrink-0 sm:block">{card.chart}</div>}</div>
            <p className="mt-1 text-[10px] leading-relaxed text-text-muted">{card.detail}</p>
          </div>
        );
      })}
    </section>
  );
}
export default React.memo(NOCExecutiveKpis);
