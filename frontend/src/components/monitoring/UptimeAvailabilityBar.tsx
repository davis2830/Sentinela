import React, { useState } from 'react';
import type { DailyAvailabilityItem } from '../../types/monitoring';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';

interface UptimeAvailabilityBarProps {
  days: DailyAvailabilityItem[];
  uptimePercentage?: number;
}

export default function UptimeAvailabilityBar({
  days,
  uptimePercentage = 100,
}: UptimeAvailabilityBarProps) {
  const [hoveredDay, setHoveredDay] = useState<DailyAvailabilityItem | null>(null);

  return (
    <div className="bg-bg-card border border-border-base rounded-xl p-5 mb-6 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <div className="font-bold text-sm text-text-main flex items-center gap-2">
            <span>Disponibilidad Diaria (Últimos 30 días)</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
                uptimePercentage >= 99
                  ? 'bg-accent-green/10 text-accent-green border border-accent-green/30'
                  : uptimePercentage >= 95
                  ? 'bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30'
                  : 'bg-accent-red/10 text-accent-red border border-accent-red/30'
              }`}
            >
              {uptimePercentage.toFixed(2)}%
            </span>
          </div>
          <p className="text-[11px] text-text-dim mt-0.5">
            Registro visual por día del estado de disponibilidad y eventos de interrupción
          </p>
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono text-text-muted">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-accent-green" />
            <span>Operacional</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-accent-yellow" />
            <span>Degradado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-accent-red" />
            <span>Caída</span>
          </div>
        </div>
      </div>

      {/* 30-Day Blocks Row */}
      <div className="relative">
        <div className="flex items-center gap-1 sm:gap-1.5 py-2">
          {days.map((day) => {
            let bgClass = 'bg-accent-green';
            if (day.status === 'down') {
              bgClass = 'bg-accent-red';
            } else if (day.status === 'degraded') {
              bgClass = 'bg-accent-yellow';
            } else if (day.status === 'no_data') {
              bgClass = 'bg-border-accent/40';
            }

            const isHovered = hoveredDay?.date === day.date;

            return (
              <div
                key={day.date}
                className="flex-1 relative group py-1"
                onMouseEnter={() => setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
              >
                <div
                  className={`h-9 w-full rounded-sm transition-all duration-200 cursor-pointer ${bgClass} ${
                    isHovered ? 'scale-110 ring-2 ring-text-main shadow-lg z-20' : 'opacity-90 hover:opacity-100'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Hover Tooltip Floating Card */}
        {hoveredDay && (
          <div className="mt-2 p-3 bg-bg-dark border border-border-base rounded-xl shadow-2xl flex items-center justify-between gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              {hoveredDay.status === 'operational' ? (
                <div className="w-7 h-7 rounded-lg bg-accent-green/10 border border-accent-green/30 flex items-center justify-center text-accent-green">
                  <CheckCircle2 size={16} />
                </div>
              ) : hoveredDay.status === 'down' ? (
                <div className="w-7 h-7 rounded-lg bg-accent-red/10 border border-accent-red/30 flex items-center justify-center text-accent-red">
                  <XCircle size={16} />
                </div>
              ) : hoveredDay.status === 'degraded' ? (
                <div className="w-7 h-7 rounded-lg bg-accent-yellow/10 border border-accent-yellow/30 flex items-center justify-center text-accent-yellow">
                  <AlertTriangle size={16} />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-text-dim">
                  <HelpCircle size={16} />
                </div>
              )}

              <div>
                <div className="font-bold text-xs text-text-main flex items-center gap-2">
                  <span>{hoveredDay.label}</span>
                  <span
                    className={`font-mono text-[11px] ${
                      hoveredDay.status === 'down'
                        ? 'text-accent-red'
                        : hoveredDay.status === 'degraded'
                        ? 'text-accent-yellow'
                        : 'text-accent-green'
                    }`}
                  >
                    {hoveredDay.status === 'no_data'
                      ? 'Sin datos de monitoreo'
                      : `${hoveredDay.uptime_percentage.toFixed(2)}% disponibilidad`}
                  </span>
                </div>
                <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-3 font-mono">
                  {hoveredDay.status !== 'no_data' && (
                    <>
                      <span>Chequeos: {hoveredDay.total_checks}</span>
                      {hoveredDay.down_checks > 0 ? (
                        <span className="text-accent-red font-semibold">
                          Caídas detectadas: {hoveredDay.down_checks}
                        </span>
                      ) : (
                        <span className="text-accent-green">Sin interrupciones</span>
                      )}
                      {hoveredDay.avg_latency > 0 && (
                        <span>Latencia media: {hoveredDay.avg_latency}ms</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="text-[10px] text-text-dim font-mono">
              {hoveredDay.date}
            </div>
          </div>
        )}
      </div>

      {/* Footer Range Labels */}
      <div className="flex items-center justify-between text-[11px] font-mono text-text-dim mt-2 pt-2 border-t border-border-base/40">
        <span>Hace 30 días</span>
        <span>Hoy</span>
      </div>
    </div>
  );
}
