import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Sliders } from 'lucide-react';
import type { DashboardHealthFilter } from '../../utils/dashboardModel';

interface Props {
  total: number; online: number; degraded: number; down: number; unknown: number;
  healthScore: number | null; dataUnavailable: boolean; isLoading: boolean;
  selectedHealth: DashboardHealthFilter | null;
  onHealthSelect: (health: DashboardHealthFilter | null) => void;
}
interface Slice { key: DashboardHealthFilter; name: string; value: number; color: string; pct: number }

function NOCInfraHealthDonut({ total, online, degraded, down, unknown, healthScore, dataUnavailable, isLoading, selectedHealth, onHealthSelect }: Props) {
  const safeTotal = Math.max(1, total);
  const data = useMemo<Slice[]>(() => {
    const slices: Slice[] = [
      { key: 'healthy', name: 'Saludables', value: online, color: '#4ade80', pct: online / safeTotal * 100 },
      { key: 'degraded', name: 'Degradados', value: degraded, color: '#fbbf24', pct: degraded / safeTotal * 100 },
      { key: 'down', name: 'Caídos', value: down, color: '#ff7384', pct: down / safeTotal * 100 },
      { key: 'unknown', name: 'Sin datos', value: unknown, color: '#cbd5e1', pct: unknown / safeTotal * 100 },
    ];
    return slices.filter((entry) => entry.value > 0);
  }, [online, degraded, down, unknown, safeTotal]);
  const chartData = data.length ? data : [{ key: 'unknown' as const, name: 'Sin datos', value: 1, color: '#334155', pct: 100 }];

  return <section className="bg-bg-card border border-border-base rounded-2xl p-4 shadow-sm h-full" data-testid="dashboard-health-donut">
    <div className="flex items-center gap-2 mb-3"><Sliders size={16} className="text-accent-green" /><div><h3 className="text-sm font-bold text-text-main">Estado actual</h3><p className="text-[10px] text-text-dim">Selecciona un segmento para filtrar</p></div></div>
    {isLoading ? <div className="h-64 rounded-xl bg-bg-dark/60 animate-pulse" /> : <div className="flex flex-col sm:flex-row xl:flex-col 2xl:flex-row items-center justify-center gap-5 py-2">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%"><PieChart><Pie isAnimationActive={false} data={chartData} dataKey="value" innerRadius={56} outerRadius={78} paddingAngle={3} cornerRadius={4} stroke="#111c2b" strokeWidth={2} onClick={(entry) => !dataUnavailable && onHealthSelect((entry as unknown as { payload: Slice }).payload.key)}>{chartData.map((entry) => <Cell key={entry.key} fill={entry.color} opacity={selectedHealth && selectedHealth !== entry.key ? 0.3 : 1} className="cursor-pointer outline-none" />)}</Pie><Tooltip content={({ active, payload }) => active && payload?.[0] ? <div className="rounded-lg border border-border-base bg-bg-dark px-3 py-2 text-xs text-text-main shadow-xl"><b>{(payload[0].payload as Slice).name}</b>: {(payload[0].payload as Slice).value} ({(payload[0].payload as Slice).pct.toFixed(1)}%)</div> : null} /></PieChart></ResponsiveContainer>
        <button type="button" data-testid="dashboard-donut-reset" onClick={() => onHealthSelect(null)} style={{ clipPath: 'circle(48% at 50% 50%)' }} className="absolute inset-8 rounded-full flex flex-col items-center justify-center hover:bg-bg-dark/40 transition-colors" title="Restablecer filtro"><strong className="text-2xl metric-value text-text-main">{dataUnavailable ? '—' : healthScore ?? '—'}</strong><span className="text-[9px] uppercase tracking-wider text-text-dim">health score</span><span className="text-[10px] text-text-muted">{dataUnavailable ? 'Sin datos' : `${total} recursos`}</span></button>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full">{chartData.map((entry) => <button key={entry.key} type="button" data-testid={`dashboard-health-${entry.key}`} onClick={() => onHealthSelect(entry.key)} className={`rounded-xl border p-2 text-left transition-colors ${selectedHealth === entry.key ? 'border-border-accent bg-bg-dark' : 'border-border-base/50 hover:border-border-accent'}`}><span className="flex items-center gap-1.5 text-[10px] text-text-muted"><span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />{entry.name}</span><strong className="mt-1 block font-mono text-sm text-text-main">{dataUnavailable ? '—' : entry.value}</strong></button>)}</div>
    </div>}
    <div className="mt-3 border-t border-border-base/50 pt-3 text-[10px] text-text-dim">El estado sin datos nunca se contabiliza como saludable.</div>
  </section>;
}
export default React.memo(NOCInfraHealthDonut);
