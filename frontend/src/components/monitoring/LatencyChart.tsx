import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import type { TimeseriesPoint, TimeseriesSummary } from '../../types/monitoring';
import { TrendingUp, RefreshCw, Zap, Activity } from 'lucide-react';

interface LatencyChartProps {
  timeseries: TimeseriesPoint[];
  summary: TimeseriesSummary;
  period: '24h' | '7d' | '30d';
  isLoading?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const data: TimeseriesPoint = payload[0].payload;
  const isDown = data.is_down || data.status === 'down';
  const isSlow = data.status === 'slow';

  return (
    <div className="bg-bg-card border border-border-base rounded-xl p-3 shadow-2xl font-mono text-xs max-w-xs z-50">
      <div className="text-text-dim text-[10px] mb-1.5 border-b border-border-base/50 pb-1 flex items-center justify-between gap-2">
        <span>{data.label}</span>
        {isDown ? (
          <span className="text-accent-red font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-red" />
            Caída Detectada
          </span>
        ) : isSlow ? (
          <span className="text-accent-yellow font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-yellow" />
            Lentitud
          </span>
        ) : (
          <span className="text-accent-green font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
            Normal
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-text-muted">Latencia Promedio:</span>
          <span
            className={`font-bold ${
              isDown ? 'text-accent-red' : isSlow ? 'text-accent-yellow' : 'text-accent-green'
            }`}
          >
            {data.latency !== null ? `${data.latency} ms` : 'Sin respuesta'}
          </span>
        </div>

        {data.max_latency !== null && (
          <div className="flex items-center justify-between gap-4 text-[11px]">
            <span className="text-accent-yellow">Pico Máximo en Intervalo:</span>
            <span className={`font-bold ${data.max_latency > 500 ? 'text-accent-red' : 'text-accent-yellow'}`}>
              {data.max_latency} ms
            </span>
          </div>
        )}

        {data.down_count > 0 && (
          <div className="flex items-center justify-between gap-4 text-[11px] text-accent-red">
            <span>Chequeos Fallidos:</span>
            <span className="font-bold">{data.down_count}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 text-[10px] text-text-dim pt-1 border-t border-border-base/30">
          <span>Muestras analizadas:</span>
          <span>{data.total_count}</span>
        </div>
      </div>
    </div>
  );
};

export default function LatencyChart({
  timeseries,
  summary,
  period,
  isLoading = false,
}: LatencyChartProps) {
  const [viewMode, setViewMode] = useState<'both' | 'avg' | 'max'>('both');

  if (isLoading) {
    return (
      <div className="bg-bg-card border border-border-base rounded-xl p-6 mb-6 flex items-center justify-center py-16">
        <RefreshCw className="animate-spin text-accent-green" size={24} />
      </div>
    );
  }

  const periodLabel =
    period === '24h' ? 'Últimas 24 Horas' : period === '7d' ? 'Últimos 7 Días' : 'Últimos 30 Días';

  // Format chart data: populate average and max peak values
  const chartData = timeseries.map((item) => {
    const avg = item.latency !== null ? item.latency : 0;
    const max = item.max_latency !== null ? item.max_latency : avg;
    return {
      ...item,
      displayLatency: avg,
      displayMaxLatency: max,
    };
  });

  // Calculate dynamic max domain according to active view mode
  const relevantValues = chartData.map((d) =>
    viewMode === 'avg' ? d.displayLatency : Math.max(d.displayLatency, d.displayMaxLatency)
  );
  const maxVal = Math.max(...relevantValues, 100);
  const yDomainMax = Math.ceil((maxVal * 1.15) / 50) * 50;

  return (
    <div className="bg-bg-card border border-border-base rounded-xl p-6 mb-6 shadow-xl">
      {/* Header with Stats and View Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 border-b border-border-base/50 pb-4">
        <div>
          <div className="flex items-center gap-2 font-bold text-text-main text-base font-sans">
            <TrendingUp size={20} className="text-accent-green" />
            <span>Curva de Latencia & Rendimiento ({periodLabel})</span>
          </div>
          <p className="text-[11px] text-text-dim mt-0.5 font-sans">
            Comparativa en tiempo real entre latencia promedio y picos máximos detectados
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-bg-dark border border-border-base rounded-lg p-1 font-mono text-xs">
            <button
              onClick={() => setViewMode('both')}
              className={`px-2.5 py-1 rounded transition-all font-semibold cursor-pointer ${
                viewMode === 'both'
                  ? 'bg-accent-green text-black shadow-xs'
                  : 'text-text-muted hover:text-text-main'
              }`}
              title="Mostrar promedio sombreado y picos máximos simultáneamente"
            >
              Ambas Curvas
            </button>
            <button
              onClick={() => setViewMode('avg')}
              className={`px-2.5 py-1 rounded transition-all font-semibold cursor-pointer ${
                viewMode === 'avg'
                  ? 'bg-accent-green text-black shadow-xs'
                  : 'text-text-muted hover:text-text-main'
              }`}
              title="Ver solo latencia promedio suavizada"
            >
              Promedio
            </button>
            <button
              onClick={() => setViewMode('max')}
              className={`px-2.5 py-1 rounded transition-all font-semibold cursor-pointer ${
                viewMode === 'max'
                  ? 'bg-accent-green text-black shadow-xs'
                  : 'text-text-muted hover:text-text-main'
              }`}
              title="Ver picos máximos registrados en cada intervalo"
            >
              Picos Máximos
            </button>
          </div>

          {/* Stats Pills */}
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
            <div className="bg-bg-dark border border-border-base px-2.5 py-1 rounded-lg flex items-center gap-1" title="Latencia promedio general">
              <span className="text-text-muted">AVG:</span>
              <span className="font-bold text-accent-green">{summary.avg_latency}ms</span>
            </div>
            <div className="bg-bg-dark border border-border-base px-2.5 py-1 rounded-lg flex items-center gap-1" title="Percentil 50 (Mediana habitual)">
              <span className="text-text-muted">P50:</span>
              <span className="font-bold text-accent-blue">{summary.p50_latency}ms</span>
            </div>
            <div className="bg-bg-dark border border-border-base px-2.5 py-1 rounded-lg flex items-center gap-1" title="Percentil 90">
              <span className="text-text-muted">P90:</span>
              <span className="font-bold text-accent-yellow">{summary.p90_latency}ms</span>
            </div>
            <div
              className={`border px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                summary.p99_latency > 500
                  ? 'bg-accent-red/10 border-accent-red/40 text-accent-red'
                  : 'bg-bg-dark border-border-base text-accent-yellow'
              }`}
              title="Percentil 99 (Pico del 1% de chequeos más lentos)"
            >
              <span className="text-text-muted">P99:</span>
              <span className="font-bold">{summary.p99_latency}ms</span>
            </div>
            <div className="bg-bg-dark border border-border-base px-2.5 py-1 rounded-lg flex items-center gap-1" title="Pico máximo registrado">
              <span className="text-text-muted">MAX:</span>
              <span className="font-bold text-text-main">{summary.max_latency}ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recharts Area Chart */}
      {chartData.length > 0 ? (
        <div className="w-full">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />

                <XAxis
                  dataKey="label"
                  stroke="#64748B"
                  tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={{ stroke: '#1E293B' }}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />

                <YAxis
                  stroke="#64748B"
                  tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={{ stroke: '#1E293B' }}
                  domain={[0, yDomainMax]}
                  unit="ms"
                />

                <Tooltip content={<CustomTooltip />} />

                {/* Warning Latency Threshold Line at 500ms */}
                <ReferenceLine
                  y={500}
                  stroke="#F59E0B"
                  strokeDasharray="4 4"
                  label={{
                    value: 'Alerta (500ms)',
                    fill: '#F59E0B',
                    fontSize: 10,
                    position: 'insideTopRight',
                    fontFamily: 'monospace',
                  }}
                />

                {/* Average Latency Area (Shown when viewMode is 'both' or 'avg') */}
                {(viewMode === 'both' || viewMode === 'avg') && (
                  <Area
                    type="monotone"
                    dataKey="displayLatency"
                    name="Latencia Promedio"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#latencyGradient)"
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      if (payload && payload.is_down) {
                        return (
                          <circle
                            key={`dot-down-${props.index}`}
                            cx={cx}
                            cy={cy}
                            r={5}
                            fill="#EF4444"
                            stroke="#FFFFFF"
                            strokeWidth={2}
                            className="animate-pulse"
                          />
                        );
                      }
                      return <></>;
                    }}
                    activeDot={{
                      r: 5,
                      fill: '#10b981',
                      stroke: '#FFFFFF',
                      strokeWidth: 2,
                    }}
                  />
                )}

                {/* Max Peak Line (Shown when viewMode is 'both' or 'max') */}
                {(viewMode === 'both' || viewMode === 'max') && (
                  <Area
                    type="monotone"
                    dataKey="displayMaxLatency"
                    name="Pico Máximo"
                    stroke="#F59E0B"
                    strokeWidth={viewMode === 'max' ? 2 : 1.5}
                    strokeDasharray={viewMode === 'both' ? '4 3' : undefined}
                    fill="none"
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      if (payload && payload.displayMaxLatency > 500 && !payload.is_down) {
                        return (
                          <circle
                            key={`dot-peak-${props.index}`}
                            cx={cx}
                            cy={cy}
                            r={3.5}
                            fill="#F59E0B"
                            stroke="#111720"
                            strokeWidth={1.5}
                          />
                        );
                      }
                      return <></>;
                    }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Legend and Realtime Indicator */}
          <div className="mt-4 pt-3 border-t border-border-base/50 flex flex-wrap items-center justify-between gap-4 text-[11px] font-mono text-text-muted">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-0.5 bg-accent-green" />
                <span>Latencia Promedio (AVG)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-0.5 border-b border-dashed border-accent-yellow" />
                <span>Pico Máximo en Intervalo (MAX)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-accent-red animate-pulse" />
                <span>Caída / Fallo (DOWN)</span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-text-dim font-sans">
              <Zap size={13} className="text-accent-green" />
              <span>Actualización en vivo cada 30s</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-text-dim font-mono text-xs">
          No hay datos de telemetría registrados en este período.
        </div>
      )}
    </div>
  );
}
