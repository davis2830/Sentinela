import React, { useId, useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Area, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { Activity, TrendingUp } from 'lucide-react';

export interface TelemetryPoint {
  timestamp?: number;
  time: string;
  uptime: number | null;
  latency: number | null;
  checks?: number | null;
  requests?: number;
  checks_per_minute?: number | null;
}
interface Props {
  timeRange: '1h' | '6h' | '24h' | '7d';
  checksPerMinute?: number | null;
  historicalData?: TelemetryPoint[];
  isLoading?: boolean;
  isError?: boolean;
}
const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const number = (value: number) => value.toLocaleString('es', { maximumFractionDigits: value > 0 && value < 0.01 ? 6 : 2 });
const colors = { uptime: '#00d4aa', latency: '#38d9f5', volume: '#b499ff', grid: 'rgb(var(--sentinel-border-base))', text: '#e2e8f0' };

function NOCPerformanceSection({ timeRange, checksPerMinute, historicalData, isLoading, isError }: Props) {
  const id = useId().replace(/:/g, '');
  const [activeTrack, setActiveTrack] = useState<'latency' | 'uptime' | 'volume' | null>(null);
  const trackEvents = (track: NonNullable<typeof activeTrack>) => ({
    onPointerEnter: () => setActiveTrack(track),
    onPointerLeave: () => setActiveTrack(previous => previous === track ? null : previous),
    onFocusCapture: () => setActiveTrack(track),
    onBlurCapture: (event: React.FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setActiveTrack(previous => previous === track ? null : previous);
      }
    },
  });
  const points = useMemo(() => (historicalData || []).map((point, index) => {
    const checks = finite(point.checks) ?? finite(point.requests);
    const timestamp = finite(point.timestamp);
    const date = timestamp == null ? null : new Date(timestamp);
    const validDate = date && Number.isFinite(date.getTime());
    return {
      ...point,
      checks,
      sampleAt: timestamp ?? index,
      // Explicitly empty buckets must not carry fabricated or previous readings.
      uptime: checks === 0 ? null : finite(point.uptime),
      latency: checks === 0 ? null : finite(point.latency),
      checks_per_minute: finite(point.checks_per_minute),
      label: validDate ? date.toLocaleString('es', timeRange === '7d'
        ? { day: '2-digit', month: '2-digit', hour: '2-digit' }
        : { hour: '2-digit', minute: '2-digit' }) : point.time,
      fullDate: validDate ? date.toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : point.time,
    };
  }), [historicalData, timeRange]);
  const hasData = points.some(point => (point.checks ?? 0) > 0 || point.uptime != null || point.latency != null);
  const hasRate = points.some(point => point.checks_per_minute != null);
  const rate = finite(checksPerMinute);
  const maxLatency = Math.max(0, ...points.map(point => point.latency ?? 0));
  const latencyCeiling = Math.max(100, Math.ceil(maxLatency * 1.15 / 100) * 100);
  const samples = points.map(point=>point.sampleAt);
  const first = Math.min(...samples), last = Math.max(...samples);
  const timeDomain: [number,number] = first === last ? [first-60000,last+60000] : [first,last];
  const timeAxis = {
    dataKey: 'sampleAt', type: 'number' as const, scale: 'time' as const, domain: timeDomain,
    ticks: Array.from({length:5},(_,index)=>timeDomain[0]+(timeDomain[1]-timeDomain[0])*index/4),
    padding: {left:12,right:12},
    tickFormatter: (sample:number) => {
      if (!points.some(point=>point.timestamp!=null)) return points.find(point=>point.sampleAt===sample)?.time||'';
      return new Date(sample).toLocaleString('es', timeRange==='7d'
        ? {day:'2-digit',month:'2-digit',hour:'2-digit'} : {hour:'2-digit',minute:'2-digit'});
    },
  };
  const tooltip = ({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) => {
    if (!active || !payload?.length) return null;
    const point = payload[0].payload as typeof points[number];
    if (!point) return null;
    return <div className="rounded-xl border border-border-accent bg-bg-dark p-3 text-xs shadow-xl" data-testid="performance-tooltip">
      <p className="mb-2 font-semibold text-text-main">{point.fullDate}</p>
      <dl className="space-y-1 tabular-nums">
        <div className="flex gap-4 justify-between"><dt className="text-text-muted">Disponibilidad</dt><dd className="text-accent-green">{point.uptime == null ? 'Sin medición' : number(point.uptime) + '%'}</dd></div>
        <div className="flex gap-4 justify-between"><dt className="text-text-muted">Latencia</dt><dd className="text-accent-cyan">{point.latency == null ? 'Sin medición' : number(point.latency) + ' ms'}</dd></div>
        <div className="flex gap-4 justify-between"><dt className="text-text-muted">Comprobaciones</dt><dd>{point.checks == null ? 'No disponible' : number(point.checks)}</dd></div>
        <div className="flex gap-4 justify-between"><dt className="text-text-muted">Ritmo del intervalo</dt><dd className="text-accent-purple">{point.checks_per_minute == null ? 'No disponible' : number(point.checks_per_minute) + '/min'}</dd></div>
      </dl>
    </div>;
  };
  const axis = { stroke: colors.text, fontSize: 12, tickLine: false, axisLine: false };
  const margin = { top: 8, right: 12, left: 0, bottom: 8 };
  return <section className="min-w-0 bg-bg-card border border-border-base rounded-2xl p-4 h-full" data-testid="dashboard-performance" aria-label="Rendimiento global">
    <header className="flex flex-wrap items-center justify-between gap-2 mb-3">
      <h3 className="flex items-center gap-2 text-sm font-bold text-text-main"><TrendingUp size={18} className="text-accent-green"/>Rendimiento Global</h3>
      <span className="text-xs text-text-muted">Histórico de Monitoring · {timeRange}</span>
    </header>
    {isLoading ? <div role="status" className="h-72 space-y-4 animate-pulse rounded-xl bg-bg-dark/40 p-4"><p className="text-sm text-text-muted">Cargando mediciones…</p><div className="h-28 bg-border-base/40 rounded-lg"/><div className="h-12 bg-border-base/25 rounded-lg"/></div>
    : isError || !hasData ? <div role="status" className="h-72 flex flex-col items-center justify-center gap-3 text-center px-6">
      <Activity className="text-text-dim" size={28}/>
      <p className="text-sm font-semibold">{isError ? 'Telemetría no disponible' : 'Sin mediciones en este período'}</p>
      <p className="max-w-sm text-xs text-text-muted">{isError ? 'No pudimos consultar las mediciones. Actualiza los datos para intentarlo de nuevo.' : 'Las gráficas aparecerán cuando se registren comprobaciones. Los intervalos vacíos no se consideran saludables.'}</p>
    </div> : <>
      <div className="flex flex-wrap justify-between gap-2 text-xs mb-1"><span className="font-semibold text-accent-cyan">Latencia · ms</span><span className="text-text-muted">Referencia crítica: 500 ms</span></div>
      <div className="h-36 w-full" role="img" aria-label="Latencia histórica en milisegundos" {...trackEvents('latency')}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} syncId={id} margin={margin}>
            <defs><linearGradient id={id + '-latency'} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colors.latency} stopOpacity={0.2}/><stop offset="100%" stopColor={colors.latency} stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 5" opacity={0.65}/>
            <XAxis {...timeAxis} hide/>
            <YAxis {...axis} width={52} domain={[0, latencyCeiling]} tickCount={4} tickFormatter={number}/>
            <Tooltip content={props=>activeTrack==='latency'?tooltip(props):null} cursor={{stroke: colors.text, strokeDasharray:'3 3'}}/>
            {maxLatency >= 500 && <ReferenceLine y={500} stroke="#ff7384" strokeDasharray="4 4"/>}
            <Area type="linear" dataKey="latency" stroke={colors.latency} strokeWidth={2} fill={'url(#' + id + '-latency)'} dot={{r:2,fill:colors.latency,strokeWidth:0}} activeDot={{r:4}} connectNulls={false} isAnimationActive={false}/>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-xs mt-2 mb-1"><span className="font-semibold text-accent-green">Disponibilidad · %</span><span className="text-text-muted">Referencia degradada: &lt;99%</span></div>
      <div className="h-16 w-full" role="img" aria-label="Disponibilidad histórica de cero a cien por ciento" {...trackEvents('uptime')}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} syncId={id} margin={margin}>
            <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 5" opacity={0.65}/>
            <XAxis {...timeAxis} hide/>
            <YAxis {...axis} width={52} domain={[0,100]} ticks={[0,100]} interval={0} tickFormatter={value=>number(value)+'%'}/>
            <Tooltip content={props=>activeTrack==='uptime'?tooltip(props):null}/>
            <ReferenceLine y={99} stroke="#fbbf24" strokeDasharray="4 4" opacity={0.5}/>
            <Line type="stepAfter" dataKey="uptime" stroke={colors.uptime} strokeWidth={2} dot={{r:2,fill:colors.uptime,strokeWidth:0}} connectNulls={false} isAnimationActive={false}/>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-xs mt-2 mb-1"><span className="font-semibold text-accent-purple">Comprobaciones / min</span><span className="text-text-muted">{rate == null ? 'Promedio no disponible' : number(rate) + '/min · promedio del período'}</span></div>
      {hasRate ? <div className="h-20 w-full" role="img" aria-label="Comprobaciones por minuto y eje de tiempo" {...trackEvents('volume')}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} syncId={id} margin={margin}>
            <XAxis {...axis} {...timeAxis} minTickGap={36} interval="preserveStartEnd" height={24}/>
            <YAxis {...axis} width={52} tickCount={2} domain={[0,'auto']} tickFormatter={number}/>
            <Tooltip content={props=>activeTrack==='volume'?tooltip(props):null} cursor={{fill:'#b499ff15'}}/>
            <Bar dataKey="checks_per_minute" fill={colors.volume} radius={[3,3,0,0]} maxBarSize={18} isAnimationActive={false}/>
          </ComposedChart>
        </ResponsiveContainer>
      </div> : <p className="py-4 text-xs text-text-muted">El ritmo de comprobaciones no está disponible para estos datos.</p>}
      <p className="mt-2 text-xs text-text-dim">{points.filter(point=>(point.checks??0)>0||point.uptime!=null||point.latency!=null).length} de {points.length} intervalos con mediciones. Los huecos indican intervalos sin medición; no se interpolan resultados.</p>
    </>}
  </section>;
}
export default React.memo(NOCPerformanceSection);
