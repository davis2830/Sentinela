import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { MonitoringCheck } from '../../types/monitoring';
import { TrendingUp, RefreshCw, Activity, Clock, Zap } from 'lucide-react';

interface LatencyChartProps {
  targetId: string;
}

export default function LatencyChart({ targetId }: LatencyChartProps) {
  const { data: checks, isLoading, refetch } = useQuery({
    queryKey: ['target-checks-chart', targetId],
    queryFn: async () => {
      const res = await api.get(`monitoring/${targetId}/checks/`, {
        params: { limit: 20 },
      });
      return (res.data?.data || []) as MonitoringCheck[];
    },
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="bg-bg-card border border-border-base rounded-xl p-6 mb-6 flex items-center justify-center py-12">
        <RefreshCw className="animate-spin text-accent-green" size={24} />
      </div>
    );
  }

  // Reverse to show chronological left-to-right history
  const history = [...(checks || [])].reverse();

  // Calculate statistics
  const validLatencies = history
    .map((c) => c.latency)
    .filter((l): l is number => l !== null && l !== undefined);

  const avgLatency =
    validLatencies.length > 0
      ? Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length)
      : 0;

  const maxLatency = validLatencies.length > 0 ? Math.round(Math.max(...validLatencies)) : 0;
  const minLatency = validLatencies.length > 0 ? Math.round(Math.min(...validLatencies)) : 0;

  const maxChartHeight = Math.max(maxLatency, 300);

  return (
    <div className="bg-bg-card border border-border-base rounded-xl p-6 mb-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-border-base pb-4">
        <div className="flex items-center gap-2 font-bold text-text-main text-base">
          <TrendingUp size={20} className="text-accent-green" />
          Historial de Latencia en Tiempo Real (últimos {history.length} escaneos)
        </div>

        {/* Stats Pills */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="bg-bg-dark border border-border-base px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <span className="text-text-muted">PROMEDIO:</span>
            <span className="font-bold text-accent-green">{avgLatency} ms</span>
          </div>
          <div className="bg-bg-dark border border-border-base px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <span className="text-text-muted">MÁXIMA:</span>
            <span className="font-bold text-accent-yellow">{maxLatency} ms</span>
          </div>
          <div className="bg-bg-dark border border-border-base px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <span className="text-text-muted">MÍNIMA:</span>
            <span className="font-bold text-accent-blue">{minLatency} ms</span>
          </div>
        </div>
      </div>

      {/* Chart Bars Container */}
      {history.length > 0 ? (
        <div className="pt-6">
          <div className="h-48 flex items-end gap-1.5 sm:gap-2">
            {history.map((check, index) => {
              const latency = check.latency || 0;
              const heightPercent = Math.min(Math.max((latency / maxChartHeight) * 100, 8), 100);

              let barBg = 'bg-accent-green/20 border-t-2 border-accent-green';
              let textHex = 'text-accent-green';

              if (check.status === 'down' || check.status === 'error') {
                barBg = 'bg-accent-red/30 border-t-2 border-accent-red';
                textHex = 'text-accent-red';
              } else if (latency > 500 || check.status === 'slow') {
                barBg = 'bg-accent-yellow/30 border-t-2 border-accent-yellow';
                textHex = 'text-accent-yellow';
              }

              const timeStr = check.checked_at
                ? new Date(check.checked_at).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                : '-';

              return (
                <div
                  key={check.id || index}
                  className="flex-1 h-full flex flex-col justify-end items-center gap-2 group relative cursor-pointer"
                >
                  {/* Hover Tooltip */}
                  <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center bg-bg-dark border border-border-base text-text-main text-[11px] font-mono px-2.5 py-1 rounded shadow-2xl pointer-events-none whitespace-nowrap">
                    <span className={`font-bold ${textHex}`}>{latency} ms</span>
                    <span className="text-text-dim text-[10px]">{timeStr}</span>
                  </div>

                  {/* Latency Bar */}
                  <div
                    className={`w-full rounded-t-md transition-all duration-300 group-hover:opacity-100 ${barBg}`}
                    style={{ height: `${heightPercent}%` }}
                  ></div>

                  {/* Time Axis Label */}
                  <span className="text-[10px] text-text-dim font-mono truncate max-w-[40px]">
                    {index === history.length - 1
                      ? 'Ahora'
                      : new Date(check.checked_at).toLocaleTimeString('es-ES', {
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 pt-4 border-t border-border-base/50 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-text-muted">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-accent-green/30 border border-accent-green"></span>
                <span>Normal (&lt;200ms)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-accent-yellow/30 border border-accent-yellow"></span>
                <span>Moderada (&gt;200ms)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-accent-red/30 border border-accent-red"></span>
                <span>Fallo / Caída (DOWN)</span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-text-dim">
              <Zap size={14} className="text-accent-green" />
              <span>Actualización en tiempo real (cada 15s)</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-10 text-center text-text-dim font-mono text-xs">
          No hay lecturas de latencia registradas para este target.
        </div>
      )}
    </div>
  );
}
