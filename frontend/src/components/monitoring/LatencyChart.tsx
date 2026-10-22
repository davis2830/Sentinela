import { useId, useState, type ReactNode } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from 'recharts';
import { TrendingUp, RefreshCw } from 'lucide-react';
import type { TimeseriesPoint, TimeseriesSummary } from '../../types/monitoring';
import { finite, formatMetric, latencyTone } from '../../utils/endpointPresentation';

interface LatencyChartProps {
  timeseries: TimeseriesPoint[];
  summary: TimeseriesSummary;
  period: '24h' | '7d' | '30d';
  isLoading?: boolean;
  thresholdMs?: number | null;
  compact?: boolean;
  preview?: boolean;
  periodControl?: ReactNode;
}
const latencyValue = (n: unknown) => finite(n) && n >= 0 ? n : null;
const display = (n: unknown) => latencyValue(n) == null ? '—' : `${formatMetric(n as number)} ms`;

// Recorded failures/slow results are preserved; current threshold is a visual reference.
const chartTone = (point: TimeseriesPoint, value: unknown, threshold: number | null) => latencyTone(value, threshold, point.is_down || point.status === 'down' ? 'down' : point.status === 'slow' ? 'slow' : undefined);
const pointColor = (tone: string) => tone === 'danger' ? 'rgb(var(--sentinel-accent-red))' : tone === 'warning' ? 'rgb(var(--sentinel-accent-yellow))' : tone === 'success' ? 'rgb(var(--sentinel-accent-green))' : '#94a3b8';

function ChartTooltip({ active, payload, threshold }: { active?: boolean; payload?: {payload: TimeseriesPoint}[]; threshold: number | null }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return <div className="ui-card max-w-xs space-y-2 text-xs shadow-xl">
    <p className="text-text-dim">{point.label}</p>
    <dl className="grid grid-cols-2 gap-x-5 gap-y-2">
      <dt>Media</dt><dd className="text-right font-mono ui-tone" data-tone={chartTone(point,point.latency,threshold)}>{display(point.latency)}</dd>
      <dt>Pico</dt><dd className="text-right font-mono ui-tone" data-tone={chartTone(point,point.max_latency,threshold)}>{display(point.max_latency)}</dd>
      {threshold !== null && <><dt>Umbral actual</dt><dd className="text-right font-mono">{display(threshold)}</dd></>}
      <dt>Muestras</dt><dd className="text-right font-mono">{point.total_count}</dd>
      {point.down_count > 0 && <><dt className="text-accent-red">Fallos</dt><dd className="text-right font-mono text-accent-red">{point.down_count}</dd></>}
    </dl>
  </div>;
}

export default function LatencyChart({ timeseries, summary, period, isLoading = false, thresholdMs = null, compact = false, preview = false, periodControl }: LatencyChartProps) {
  const [viewMode, setViewMode] = useState<'both' | 'avg' | 'max'>(preview ? 'avg' : 'both');
  const gradientId = `latency-${useId().replace(/:/g, '')}`;
  if (isLoading) return <div className="ui-card flex min-h-64 items-center justify-center" role="status" aria-label="Cargando latencia"><RefreshCw className="animate-spin text-accent-green" size={24}/></div>;
  // Missing measurements stay null: no synthetic zeros, max fallback or gap bridging.
  const chartData = timeseries.map(point => ({...point,
    displayLatency: point.total_count > 0 ? latencyValue(point.latency) : null,
    displayMaxLatency: point.total_count > 0 ? latencyValue(point.max_latency) : null,
  }));
  const values = chartData.flatMap(point => viewMode === 'avg' ? [point.displayLatency] : viewMode === 'max' ? [point.displayMaxLatency] : [point.displayLatency, point.displayMaxLatency]).filter(finite);
  const threshold = finite(thresholdMs) && thresholdMs > 0 ? thresholdMs : null;
  const yDomainMax = Math.ceil(Math.max(100, threshold || 0, ...values) * 1.15 / 50) * 50;
  const periodLabel = {'24h':'24 horas','7d':'7 días','30d':'30 días'}[period];
  const stats = [['Media',summary.avg_latency],['P50',summary.p50_latency],['P90',summary.p90_latency],['P99',summary.p99_latency],['Máximo',summary.max_latency]] as const;
  return <section className={`ui-card space-y-4 ${compact ? 'latency-chart-compact' : ''}`} aria-label={`Latencia · ${periodLabel}`} data-testid="latency-chart">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-base font-semibold"><TrendingUp size={20} className="text-accent-green"/>Latencia</h3>
      {periodControl}
      {!preview&&<div role="group" aria-label="Curvas de latencia" className="flex rounded-xl border border-border-base bg-bg-dark p-1">
        {([['avg','Media'],['max','Picos'],['both','Ambas']] as const).map(([mode,label]) => <button type="button" key={mode} aria-pressed={viewMode===mode} onClick={()=>setViewMode(mode)} className={`min-h-11 rounded-lg px-3 text-xs font-semibold ${viewMode===mode?'bg-accent-green text-bg-dark':'text-text-muted hover:bg-bg-card-hover'}`}>{label}</button>)}
      </div>}
    </header>
    {values.length ? <div className={compact ? 'latency-plot-compact min-w-0' : 'h-64 min-w-0 sm:h-72'} data-testid="latency-plot">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{top:12,right:12,left:-12,bottom:0}}>
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--monitoring-latency)" stopOpacity={.24}/><stop offset="100%" stopColor="var(--monitoring-latency)" stopOpacity={0}/></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--monitoring-chart-grid)" vertical={false}/>
          <XAxis dataKey="label" tick={{fontSize:12,fill:'var(--monitoring-chart-label)'}} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={48}/>
          <YAxis domain={[0,yDomainMax]} tick={{fontSize:12,fill:'var(--monitoring-chart-label)'}} axisLine={false} tickLine={false} width={62} tickFormatter={n=>`${formatMetric(n)}`}/>
          <Tooltip content={<ChartTooltip threshold={threshold}/>}/>
          {threshold!==null&&<ReferenceLine y={threshold} stroke="rgb(var(--sentinel-accent-yellow))" strokeDasharray="4 4"/>}
          {(viewMode==='both'||viewMode==='avg')&&<Area type="linear" dataKey="displayLatency" name="Media" stroke="var(--monitoring-latency)" strokeWidth={2} fill={`url(#${gradientId})`} connectNulls={false} isAnimationActive={false} dot={(props: any)=>{
            const tone=chartTone(props.payload,props.payload?.displayLatency,threshold);
            return finite(props.payload?.displayLatency)&&(tone==='danger'||tone==='warning')?<circle key={props.index} cx={props.cx} cy={props.cy} r={4} fill={pointColor(tone)} stroke="rgb(var(--sentinel-bg-card))" strokeWidth={2}/>:<g key={props.index}/>;
          }} activeDot={(props: any)=><circle cx={props.cx} cy={props.cy} r={5} fill={pointColor(chartTone(props.payload,props.payload?.displayLatency,threshold))} stroke="rgb(var(--sentinel-bg-card))" strokeWidth={2}/>}/>}
          {(viewMode==='both'||viewMode==='max')&&<Area type="linear" dataKey="displayMaxLatency" name="Picos" stroke="rgb(var(--sentinel-accent-yellow))" strokeWidth={1.5} strokeDasharray={viewMode==='both'?'4 3':undefined} fill="none" connectNulls={false} dot={false} isAnimationActive={false}/>}
        </AreaChart>
      </ResponsiveContainer>
    </div> : <p role="status" className="flex min-h-48 items-center justify-center text-sm text-text-dim">Sin latencia medida para esta curva.</p>}
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-base pt-3 text-xs text-text-dim">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Leyenda de latencia">
        {viewMode!=='max'&&<span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-accent-green"/>Media</span>}
        {viewMode!=='avg'&&<span className="flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-accent-yellow"/>Picos</span>}
        {threshold!==null&&<span>Umbral actual: {display(threshold)}</span>}
        {summary.down_checks>0&&<span className="text-accent-red">{summary.down_checks} fallos</span>}
        <span>Amarillo: lento o supera el umbral actual · Rojo: fallo registrado</span>
      </div>
      {!preview&&<details className="max-w-full">
        <summary className="ui-button ui-button-secondary w-fit text-xs">Detalles de latencia</summary>
        <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 rounded-xl border border-border-base bg-bg-dark p-3" aria-label="Estadísticas de latencia">
          {stats.map(([label,n])=><div key={label}><dt className="text-text-dim">{label}</dt><dd className="mt-1 font-mono text-sm text-text-main">{display(n)}</dd></div>)}
        </dl>
      </details>}
    </footer>
  </section>;
}
