import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sliders, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

interface NOCInfraHealthDonutProps {
  total: number;
  online: number;
  degraded: number;
  down: number;
  unknown: number;
  healthScore: number | null;
  dataUnavailable: boolean;
  isLoading: boolean;
}

interface DonutSlice {
  name: string;
  value: number;
  color: string;
  pct: number;
}

function NOCInfraHealthDonut({
  total,
  online,
  degraded,
  down,
  unknown,
  healthScore,
  dataUnavailable,
  isLoading,
}: NOCInfraHealthDonutProps) {
  const navigate = useNavigate();

  const safeTotal = total > 0 ? total : 1;

  // Prepare chart segments
  const chartData = useMemo<DonutSlice[]>(() => {
    const data: DonutSlice[] = [];
    if (dataUnavailable) return [{ name: 'Sin datos', value: 1, color: '#1e293b', pct: 100 }];
    if (online > 0) {
      data.push({
        name: 'Online',
        value: online,
        color: '#10b981',
        pct: Math.round((online / safeTotal) * 1000) / 10,
      });
    }
    if (degraded > 0) {
      data.push({
        name: 'Degradados',
        value: degraded,
        color: '#f59e0b',
        pct: Math.round((degraded / safeTotal) * 1000) / 10,
      });
    }
    if (down > 0) {
      data.push({
        name: 'Caídos',
        value: down,
        color: '#ef4444',
        pct: Math.round((down / safeTotal) * 1000) / 10,
      });
    }
    if (unknown > 0) {
      data.push({ name: 'Sin datos o pausados', value: unknown, color: '#64748b', pct: Math.round((unknown / safeTotal) * 1000) / 10 });
    }
    // Fallback if no services registered
    if (data.length === 0) {
      data.push({
        name: 'Sin datos',
        value: 1,
        color: '#1e293b',
        pct: 100,
      });
    }
    return data;
  }, [online, degraded, down, unknown, safeTotal, dataUnavailable]);

  const activeSlicesCount = chartData.filter((d) => d.name !== 'Sin datos').length;

  return (
    <div className="bg-bg-card border border-border-base rounded-2xl p-5 md:p-6 shadow-sm flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sliders size={16} className="text-accent-green" />
          <h3 className="text-sm font-bold tracking-wide text-text-main">
            Estado de Infraestructura
          </h3>
        </div>
        <button
          type="button"
          onClick={() => navigate('/monitoring')}
          className="text-xs text-text-muted hover:text-accent-green flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>Ver detalle</span>
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Donut Chart and Breakdown */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 my-auto flex-1 py-2">
        {/* Recharts Pie Donut with Central Absolute Counter */}
        <div className="relative shrink-0 w-36 h-36 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={46}
                outerRadius={64}
                paddingAngle={activeSlicesCount > 1 ? 4 : 0}
                cornerRadius={activeSlicesCount > 1 ? 4 : 0}
                dataKey="value"
                stroke="#111720"
                strokeWidth={activeSlicesCount > 1 ? 2 : 0}
                isAnimationActive={true}
                animationDuration={800}
              >
                {chartData.map((entry) => (
                  <Cell key={`slice-${entry.name}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as DonutSlice;
                    if (data.name === 'Sin datos') return null;
                    return (
                      <div className="bg-bg-dark/95 backdrop-blur-md border border-border-base rounded-xl px-3 py-1.5 shadow-xl text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: data.color }}
                          />
                          <span className="font-semibold text-text-main">{data.name}:</span>
                          <span className="font-mono font-bold text-text-main">{data.value}</span>
                          <span className="text-[10px] text-text-dim">({data.pct}%)</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Central Info Badge */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            <span className="text-2xl font-bold font-mono text-text-main tracking-tight leading-none">
              {dataUnavailable ? '—' : total}
            </span>
            <span className="text-[10px] font-semibold text-text-dim tracking-wider mt-1">
              Total
            </span>
          </div>
        </div>

        {/* Legend Breakdown List */}
        <div className="space-y-3 w-full sm:w-auto">
          <div className="flex items-center justify-between sm:justify-start gap-4">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span className="h-2.5 w-2.5 rounded-full bg-accent-green shadow-sm shadow-accent-green/50" />
              <span>Online</span>
            </div>
            <span className="font-mono font-bold text-xs text-text-main">{dataUnavailable ? '—' : online}</span>
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-4">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span className="h-2.5 w-2.5 rounded-full bg-accent-yellow shadow-sm shadow-accent-yellow/50" />
              <span>Degradados</span>
            </div>
            <span className="font-mono font-bold text-xs text-text-main">{dataUnavailable ? '—' : degraded}</span>
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-4">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span className="h-2.5 w-2.5 rounded-full bg-accent-red shadow-sm shadow-accent-red/50" />
              <span>Caídos</span>
            </div>
            <span className="font-mono font-bold text-xs text-text-main">{dataUnavailable ? '—' : down}</span>
          </div>
          {!dataUnavailable && unknown > 0 && <div className="flex items-center justify-between sm:justify-start gap-4 text-xs text-text-muted"><span>Sin datos o pausados</span><span className="font-mono font-bold text-text-main">{unknown}</span></div>}
        </div>
      </div>

      {/* Bottom Health Bar */}
      <div className="mt-4 pt-3 border-t border-border-base/50">
        <div className="flex justify-between items-center text-xs mb-1.5">
          <span className="text-text-dim">Salud general</span>
          <span className="font-mono font-bold text-accent-green">{isLoading ? 'Cargando' : dataUnavailable ? 'No disponible' : healthScore === null ? 'Sin datos' : `${healthScore}%`}</span>
        </div>
        <div className="w-full bg-bg-dark h-2 rounded-full overflow-hidden border border-border-base/60">
          <div
            className="h-full bg-gradient-to-r from-accent-green via-accent-green-glow to-accent-green transition-all duration-700"
            style={{ width: `${dataUnavailable ? 0 : healthScore ?? 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default React.memo(NOCInfraHealthDonut);
