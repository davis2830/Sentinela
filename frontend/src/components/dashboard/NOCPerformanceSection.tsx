import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

export interface TelemetryPoint {
  timestamp?: number;
  time: string;
  uptime: number | null;
  latency: number | null;
  checks: number;
  checks_per_minute: number;
}

interface NOCPerformanceSectionProps {
  timeRange: '1h' | '6h' | '24h' | '7d';
  checksPerMinute: number | null;
  historicalData?: TelemetryPoint[];
  isLoading?: boolean;
  isError?: boolean;
}

function NOCPerformanceSection({
  timeRange,
  checksPerMinute,
  historicalData,
  isLoading,
  isError,
}: NOCPerformanceSectionProps) {
  const formattedData = useMemo(() => {
    return (historicalData || []).map((pt, idx) => {
      const ts = pt.timestamp;
      let displayTime = pt.time;
      let fullDateStr = pt.time;

      if (ts) {
        const d = new Date(ts);
        if (timeRange === '7d') {
          displayTime = `${d.getDate()}/${d.getMonth() + 1} ${d.getHours().toString().padStart(2, '0')}h`;
          fullDateStr = d.toLocaleString('es-ES', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          });
        } else {
          displayTime = d.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          });
          fullDateStr = d.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
        }
      }

      return {
        ...pt,
        pointKey: ts ? `${ts}-${idx}` : `pt-${idx}`,
        displayTime,
        fullDateStr,
      };
    });
  }, [historicalData, timeRange]);
  const hasChecks = formattedData.some((point) => point.checks > 0);
  const measuredUptime = formattedData.map((point) => point.uptime).filter((value): value is number => value !== null);
  const minUptime = measuredUptime.length ? Math.max(0, Math.floor(Math.min(...measuredUptime) - 1)) : 0;

  return (
    <div className="bg-bg-card border border-border-base rounded-2xl p-4 shadow-sm flex flex-col justify-between h-full" data-testid="dashboard-performance">
      {/* Header with Title, Legends and Time Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-accent-green" />
            <h3 className="text-sm font-bold tracking-wide text-text-main">
              Rendimiento Global
            </h3>
          </div>

          {/* Series Legends */}
          <div className="flex items-center gap-3 text-xs text-text-dim">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent-green" />
              <span className="text-text-muted">Disponibilidad</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent-cyan" />
              <span className="text-text-muted">Latencia</span>
            </div>
          </div>
        </div>

      </div>

      {/* Main Chart Area */}
      <div className="min-w-0 flex-1">
        <div className="min-w-0">
          <div className="h-56 sm:h-60 w-full relative">
          {isLoading && <div className="absolute inset-0 z-10 rounded-xl bg-bg-dark/70 animate-pulse"><div className="m-5 h-4 rounded bg-border-base/60" /><div className="mx-5 mt-8 h-28 rounded-xl bg-border-base/35" /></div>}
          {!isLoading && (isError || !hasChecks) && <div className="absolute inset-0 flex items-center justify-center text-xs text-text-dim z-10">{isError ? 'No se pudo cargar la telemetría' : 'Sin checks en este período'}</div>}
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorUptime" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#00d4aa" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38d9f5" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#38d9f5" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="displayTime"
                stroke="#cbd5e1"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: '#304359' }}
                minTickGap={28}
              />
              <YAxis
                yAxisId="uptime"
                stroke="#cbd5e1"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: '#304359' }}
                domain={[minUptime, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <YAxis yAxisId="latency" orientation="right" stroke="#38d9f5" fontSize={12} tickLine={false} axisLine={false} unit=" ms" />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as (typeof formattedData)[number];
                return <div className="rounded-xl border border-border-base bg-bg-dark/95 p-3 text-[11px] shadow-xl"><p className="mb-2 font-semibold text-text-main">{point.fullDateStr}</p><div className="space-y-1 font-mono"><p className="text-accent-green">Uptime: {point.uptime == null ? 'Sin datos' : `${point.uptime.toFixed(2)}%`}</p><p className="text-accent-cyan">Latencia: {point.latency == null ? 'Sin datos' : `${Math.round(point.latency)} ms`}</p><p className="text-accent-purple">Volumen: {point.checks} checks · {point.checks_per_minute}/min</p></div></div>;
              }} />
              <ReferenceLine yAxisId="uptime" y={99} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: 'Disponibilidad degradada', fill: '#fbbf24', fontSize: 12 }} />
              <ReferenceLine yAxisId="latency" y={500} stroke="#ff7384" strokeDasharray="4 4" label={{ value: 'Latencia crítica', fill: '#ff7384', fontSize: 12, position: 'insideTopRight' }} />
              <Area
                yAxisId="uptime"
                type="monotone"
                dataKey="uptime"
                name="Disponibilidad (%)"
                stroke="#00d4aa"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorUptime)"
                activeDot={{ r: 5, fill: '#00d4aa', stroke: '#090D11', strokeWidth: 2 }}
                isAnimationActive={false}
                connectNulls={false}
              />
              <Area
                yAxisId="latency"
                type="monotone"
                dataKey="latency"
                name="Latencia (ms)"
                stroke="#38d9f5"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorLatency)"
                activeDot={{ r: 4, fill: '#38d9f5', stroke: '#090D11', strokeWidth: 2 }}
                isAnimationActive={false}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
          </div>
          <div className="mt-3 rounded-xl border border-border-base/60 bg-bg-dark/40 px-3 py-2">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="flex items-center gap-1.5 text-text-muted"><span className="h-2 w-2 rounded-full bg-accent-purple" />Checks por minuto</span>
              <span className="font-mono text-accent-purple">{checksPerMinute === null ? 'Sin datos' : `${checksPerMinute} promedio`}</span>
            </div>
            <div className="h-16 w-full" role="img" aria-label="Historial de checks por minuto">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={formattedData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <YAxis domain={[0, 'dataMax + 1']} width={27} tickLine={false} axisLine={false} fontSize={12} stroke="#b499ff" allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: '#8b5cf620' }}
                    contentStyle={{ backgroundColor: '#111c2b', borderColor: '#405770', borderRadius: '0.75rem', color: '#f8fafc', fontSize: 12 }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDateStr || ''}
                    formatter={(value: any, _name: any, item: any) => [`${value} checks/min (${item.payload.checks} en el intervalo)`, 'Sondeos']}
                  />
                  <Bar dataKey="checks_per_minute" fill="#b499ff" radius={[2, 2, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default React.memo(NOCPerformanceSection);
