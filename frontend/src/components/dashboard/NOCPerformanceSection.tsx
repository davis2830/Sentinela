import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import {
  TrendingUp,
  Globe,
  Code2,
  Database,
  Lock,
  Network,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

export interface TelemetryPoint {
  timestamp?: number;
  time: string;
  uptime: number;
  latency: number;
  requests: number;
}

interface NOCPerformanceSectionProps {
  timeRange: '1h' | '6h' | '24h' | '7d';
  onTimeRangeChange: (range: '1h' | '6h' | '24h' | '7d') => void;
  avgUptime: number;
  avgLatencyMs: number;
  estimatedRps: string;
  historicalData?: TelemetryPoint[];
  isLoading?: boolean;
}

function NOCPerformanceSection({
  timeRange,
  onTimeRangeChange,
  avgUptime,
  avgLatencyMs,
  estimatedRps,
  historicalData,
  isLoading,
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

        {/* Time Selector Pills */}
        <div className="flex items-center bg-bg-dark border border-border-base rounded-xl p-1 gap-1 self-start sm:self-auto">
          {(['1h', '6h', '24h', '7d'] as const).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => onTimeRangeChange(range)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                timeRange === range
                  ? 'bg-accent-green/20 text-accent-green border border-accent-green/40 shadow-sm'
                  : 'text-text-dim hover:text-text-main hover:bg-white/5'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chart Area with Right Metric Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center flex-1">
        {/* Recharts Area Chart */}
        <div className="lg:col-span-3 h-56 sm:h-64 w-full relative">
          {isLoading && (
            <div className="absolute inset-0 bg-bg-card/70 backdrop-blur-xs flex items-center justify-center z-10 rounded-xl">
              <div className="flex items-center gap-2 text-xs text-accent-green font-mono">
                <span className="h-2 w-2 rounded-full bg-accent-green animate-ping" />
                Cargando telemetría real...
              </div>
            </div>
          )}
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
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
                domain={['dataMin - 5', 'auto']}
              />
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
                type="monotone"
                dataKey="uptime"
                name="Disponibilidad (%)"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorUptime)"
                activeDot={{ r: 5, fill: '#10b981', stroke: '#090D11', strokeWidth: 2 }}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="latency"
                name="Latencia (ms)"
                stroke="#06b6d4"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorLatency)"
                activeDot={{ r: 4, fill: '#06b6d4', stroke: '#090D11', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Right Metric Summary Strip */}
        <div className="lg:col-span-1 space-y-4 bg-bg-dark/50 border border-border-base/60 rounded-xl p-4">
          <div>
            <span className="text-[11px] text-text-dim block">Uptime</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-text-main">
                {avgUptime.toFixed(2)}%
              </span>
              <span className="text-[10px] font-semibold text-accent-green flex items-center">
                <ArrowUpRight size={11} /> +0.02%
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-border-base/40">
            <span className="text-[11px] text-text-dim block">Latencia promedio</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-text-main">
                {avgLatencyMs} <span className="text-xs font-normal text-text-dim">ms</span>
              </span>
              <span className="text-[10px] font-semibold text-accent-green flex items-center">
                <ArrowDownRight size={11} /> -18ms
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-border-base/40">
            <span className="text-[11px] text-text-dim block">Solicitudes</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-text-main">{estimatedRps}</span>
              <span className="text-[10px] font-semibold text-accent-green flex items-center">
                <ArrowUpRight size={11} /> en vivo
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(NOCPerformanceSection);
