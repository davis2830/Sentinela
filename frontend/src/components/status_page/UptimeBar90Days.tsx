import React, { useState } from 'react';
import type { DayHistoryBlock } from '../../types/status_page';

interface UptimeBar90DaysProps {
  history: DayHistoryBlock[];
  overallPct: number;
}

export default function UptimeBar90Days({ history, overallPct }: UptimeBar90DaysProps) {
  const [hoveredDay, setHoveredDay] = useState<DayHistoryBlock | null>(null);

  return (
    <div className="space-y-2">
      {/* Interactive Tooltip & Header Info */}
      <div className="flex items-center justify-between text-xs font-mono">
        <div className="text-text-muted flex items-center gap-2">
          {hoveredDay ? (
            <span className="text-text-main font-semibold bg-bg-dark px-2 py-0.5 rounded border border-border-base">
              {hoveredDay.date}: <span className={hoveredDay.status === 'up' ? 'text-accent-green' : hoveredDay.status === 'degraded' ? 'text-accent-yellow' : 'text-accent-red'}>{hoveredDay.uptime_pct}% disponible</span>
            </span>
          ) : (
            <span>Histórico de 90 días</span>
          )}
        </div>
        <div className="font-bold text-accent-green bg-accent-green/10 border border-accent-green/30 px-2 py-0.5 rounded text-[11px]">
          {overallPct}% Uptime
        </div>
      </div>

      {/* 90 Days Blocks Bar */}
      <div className="flex items-center gap-[2px] w-full h-8 overflow-hidden py-1">
        {history.map((block, idx) => {
          const colorClass =
            block.status === 'up'
              ? 'bg-accent-green hover:bg-emerald-400'
              : block.status === 'degraded'
              ? 'bg-accent-yellow hover:bg-amber-300'
              : 'bg-accent-red hover:bg-rose-400';

          return (
            <div
              key={idx}
              onMouseEnter={() => setHoveredDay(block)}
              onMouseLeave={() => setHoveredDay(null)}
              className={`flex-1 h-full rounded-[1px] transition-all cursor-pointer ${colorClass}`}
              title={`${block.date}: ${block.uptime_pct}% Uptime (${block.status.toUpperCase()})`}
            />
          );
        })}
      </div>

      {/* Footer Labels */}
      <div className="flex items-center justify-between text-[10px] font-mono text-text-dim">
        <span>Hace 90 días</span>
        <span>Hoy</span>
      </div>
    </div>
  );
}
