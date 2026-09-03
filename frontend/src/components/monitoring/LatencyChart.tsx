import React from 'react';
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
import { TrendingUp, RefreshCw, Zap, AlertTriangle } from 'lucide-react';

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

      <div className="space-y-1">
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
            <span className="text-text-dim">Pico Máximo:</span>
            <span className="text-text-main font-semibold">{data.max_latency} ms</span>
          </div>
        )}

        {data.down_count > 0 && (
          <div className="flex items-center justify-between gap-4 text-[11px] text-accent-red">
            <span>Chequeos Fallidos:</span>
            <span className="font-bold">{data.down_count}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 text-[10px] text-text-dim pt-1 border-t border-border-base/30">
          <span>Muestras en intervalo:</span>
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
  if (isLoading) {
    return (
      <div className="bg-bg-card border border-border-base rounded-xl p-6 mb-6 flex items-center justify-center py-16">
        <RefreshCw className="animate-spin text-accent-green" size={24} />
      </div>
    );
  }

  const periodLabel =
    period === '24h' ? 'Últimas 24 Horas' : period === '7d' ? 'Últimos 7 Días' : 'Últimos 30 Días';

  // Format chart data: replace null latency with 0 for continuous drawing
  const chartData = timeseries.map((item) => ({
    ...item,
    displayLatency: item.latency !== null ? item.latency : 0,
  }));

  const maxVal = Math.max(...chartData.map((d) => d.displayLatency || 0), 100);
  const yDomainMax = Math.ceil((maxVal * 1.15) / 50) * 50;

  return (
    <div className="bg-bg-card border border-border-base rounded-xl p-6 mb-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 border-b border-border-base/50 pb-4">
        <div>
          <div className="flex items-center gap-2 font-bold text-text-main text-base">
            <TrendingUp size={20} className="text-accent-green" />
            <span>Curva Continua de Latencia & Rendimiento ({periodLabel})</span>
          </div>
          <p className="text-[11px] text-text-dim mt-0.5 font-sans">
            Métricas de tiempo de respuesta en tiempo real con detección de picos y caídas
          </p>
        </div>

        {/* Stats Pills */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <div className="bg-bg-dark border border-border-base px-2.5 py-1 rounded-lg flex items-center gap-1.5" title="Latencia promedio">
            <span className="text-text-muted">AVG:</span>
            <span className="font-bold text-accent-green">{summary.avg_latency}ms</span>
          </div>
          <div className="bg-bg-dark border border-border-base px-2.5 py-1 rounded-lg flex items-center gap-1.5" title="Percentil 50 (Mediana)">
            <span className="text-text-muted">P50:</span>
            <span className="font-bold text-accent-blue">{summary.p50_latency}ms</span>
          </div>
          <div className="bg-bg-dark border border-border-base px-2.5 py-1 rounded-lg flex items-center gap-1.5" title="Percentil 90">
            <span className="text-text-muted">P90:</span>
            <span className="font-bold text-accent-yellow">{summary.p90_latency}ms</span>
          </div>
          <div className="bg-bg-dark border border-border-base px-2.5 py-1 rounded-lg flex items-center gap-1.5" title="Percentil 99">
            <span className="text-text-muted">P99:</span>
            <span className="font-bold text-accent-red">{summary.p99_latency}ms</span>
          </div>
          <div className="bg-bg-dark border border-border-base px-2.5 py-1 rounded-lg flex items-center gap-1.5" title="Pico máximo registrado">
            <span className="text-text-muted">MAX:</span>
            <span className="font-bold text-text-main">{summary.max_latency}ms</span>
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

                <Area
                  type="monotone"
                  dataKey="displayLatency"
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
                    if (payload && payload.status === 'slow') {
                      return (
                        <circle
                          key={`dot-slow-${props.index}`}
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
                  activeDot={{
                    r: 5,
                    fill: '#10b981',
                    stroke: '#FFFFFF',
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Legend and Realtime Indicator */}
          <div className="mt-4 pt-3 border-t border-border-base/50 flex flex-wrap items-center justify-between gap-4 text-[11px] font-mono text-text-muted">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-accent-green" />
                <span>Latencia Regular</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-accent-yellow" />
                <span>Lentitud (&gt;300ms)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-accent-red animate-pulse" />
                <span>Caída / Fallo (DOWN)</span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-text-dim">
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
