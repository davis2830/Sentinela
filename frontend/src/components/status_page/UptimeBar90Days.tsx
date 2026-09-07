import React, { useState } from 'react';
import type { DayHistoryBlock } from '../../types/status_page';
import { Activity, Clock } from 'lucide-react';

interface UptimeBar90DaysProps {
  history: DayHistoryBlock[];
  overallPct: number;
  avgLatencyMs?: number;
}

export default function UptimeBar90Days({
  history,
  overallPct,
  avgLatencyMs,
}: UptimeBar90DaysProps) {
  const [hoveredDay, setHoveredDay] = useState<DayHistoryBlock | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'up':
        return 'bg-emerald-500 hover:bg-emerald-400';
      case 'degraded':
        return 'bg-amber-500 hover:bg-amber-400';
      case 'down':
        return 'bg-rose-500 hover:bg-rose-400';
      default:
        return 'bg-emerald-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'up':
        return 'Operacional';
      case 'degraded':
        return 'Degradación / Lento';
      case 'down':
        return 'Interrupción / Caída';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-2 font-sans select-none">
      {/* Interactive Tooltip & Header Info */}
      <div className="flex items-center justify-between text-xs font-mono min-h-[26px]">
        <div className="text-text-muted flex items-center gap-2">
          {hoveredDay ? (
            <span className="text-text-main font-semibold bg-bg-dark/95 px-2.5 py-1 rounded-xl border border-border-base flex items-center gap-2 shadow-xs animate-in fade-in duration-100">
              <span className="text-text-dim text-[11px]">{hoveredDay.date}:</span>
              <span
                className={
                  hoveredDay.status === 'up'
                    ? 'text-accent-green font-bold'
                    : hoveredDay.status === 'degraded'
                    ? 'text-accent-yellow font-bold'
                    : 'text-accent-red font-bold'
                }
              >
                {hoveredDay.uptime_pct}% ({getStatusLabel(hoveredDay.status)})
              </span>
              {hoveredDay.total_checks && hoveredDay.total_checks > 0 ? (
                <span className="text-text-dim text-[10px] hidden sm:inline">
                  &bull; {hoveredDay.total_checks} verificaciones
                </span>
              ) : (
                <span className="text-text-dim text-[10px] hidden sm:inline">
                  &bull; Sin anomalías
                </span>
              )}
            </span>
          ) : (
            <span className="text-text-dim text-xs font-sans">
              Historial de disponibilidad últimos 90 días
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {avgLatencyMs !== undefined && avgLatencyMs > 0 && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 font-semibold flex items-center gap-1">
              <Clock size={11} />
              {avgLatencyMs}ms 24h
            </span>
          )}
          <span className="font-bold text-accent-green bg-accent-green/10 border border-accent-green/30 px-2.5 py-0.5 rounded-full text-xs font-mono">
            {overallPct}% Uptime
          </span>
        </div>
      </div>

      {/* 90 Days Blocks Bar */}
      <div className="flex items-center gap-[2.5px] w-full h-8 overflow-hidden py-1">
        {history.map((block, idx) => {
          const colorClass = getStatusColor(block.status);

          return (
            <div
              key={idx}
              onMouseEnter={() => setHoveredDay(block)}
              onMouseLeave={() => setHoveredDay(null)}
              className={`flex-1 h-full rounded-[2px] transition-all cursor-pointer ${colorClass} hover:scale-y-125 hover:z-10`}
            />
          );
        })}
      </div>

      {/* Footer Labels */}
      <div className="flex items-center justify-between text-[10px] font-mono text-text-dim px-0.5">
        <span>Hace 90 días</span>
        <span className="text-accent-green font-semibold">Hoy (En Vivo)</span>
      </div>
    </div>
  );
}
