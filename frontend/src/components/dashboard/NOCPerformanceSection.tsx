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
    <div className="bg-bg-card border border-border-base rounded-2xl p-5 md:p-6 shadow-sm flex flex-col justify-between h-full">
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
          <div className="h-56 sm:h-64 w-full relative">
          {isLoading && (
            <div className="absolute inset-0 bg-bg-card/70 backdrop-blur-xs flex items-center justify-center z-10 rounded-xl">
              <div className="flex items-center gap-2 text-xs text-accent-green font-mono">
                <span className="h-2 w-2 rounded-full bg-accent-green animate-ping" />
                Cargando telemetría real...
              </div>
            </div>
          )}
          {!isLoading && (isError || !hasChecks) && <div className="absolute inset-0 flex items-center justify-center text-xs text-text-dim z-10">{isError ? 'No se pudo cargar la telemetría' : 'Sin checks en este período'}</div>}
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorUptime" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="displayTime"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
                minTickGap={28}
              />
              <YAxis
                yAxisId="uptime"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
                domain={[minUptime, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <YAxis yAxisId="latency" orientation="right" stroke="#06b6d4" fontSize={11} tickLine={false} axisLine={false} unit=" ms" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111720',
                  borderColor: '#263345',
                  borderRadius: '0.75rem',
                  fontSize: '11px',
                  color: '#f8fafc',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                }}
                labelFormatter={(_, payload) => {
                  if (payload && payload.length > 0 && payload[0].payload) {
                    return payload[0].payload.fullDateStr || payload[0].payload.displayTime || '';
                  }
                  return '';
                }}
                formatter={(value: any, name: any) => [
                  name.includes('Disponibilidad') ? `${Number(value).toFixed(2)}%` : `${Math.round(value)} ms`,
                  name,
                ]}
              />
              <Area
                yAxisId="uptime"
                type="monotone"
                dataKey="uptime"
                name="Disponibilidad (%)"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorUptime)"
                activeDot={{ r: 5, fill: '#10b981', stroke: '#090D11', strokeWidth: 2 }}
                isAnimationActive={false}
                connectNulls={false}
              />
              <Area
                yAxisId="latency"
                type="monotone"
                dataKey="latency"
                name="Latencia (ms)"
                stroke="#06b6d4"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorLatency)"
                activeDot={{ r: 4, fill: '#06b6d4', stroke: '#090D11', strokeWidth: 2 }}
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
                  <YAxis domain={[0, 'dataMax + 1']} width={27} tickLine={false} axisLine={false} fontSize={10} stroke="#a78bfa" allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: '#8b5cf620' }}
                    contentStyle={{ backgroundColor: '#111720', borderColor: '#263345', borderRadius: '0.75rem', color: '#f8fafc', fontSize: 11 }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDateStr || ''}
                    formatter={(value: any, _name: any, item: any) => [`${value} checks/min (${item.payload.checks} en el intervalo)`, 'Sondeos']}
                  />
                  <Bar dataKey="checks_per_minute" fill="#8b5cf6" radius={[2, 2, 0, 0]} maxBarSize={18} isAnimationActive={false} />
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
