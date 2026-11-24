import { useMemo } from 'react';
import { Activity } from 'lucide-react';
import type { TimeseriesPoint, TimeseriesSummary } from '../../types/monitoring';
import { formatMetric } from '../../utils/endpointPresentation';

interface UptimeStatusBarProps {
  timeseries: TimeseriesPoint[];
  summary?: TimeseriesSummary | null;
  isLoading?: boolean;
}

interface HourBucket {
  index: number;
  label: string;
  startIso: string;
  status: 'up' | 'slow' | 'down' | 'no_data';
  uptimePct: number | null;
  avgLatency: number | null;
  downCount: number;
  totalCount: number;
}

export default function UptimeStatusBar({
  timeseries,
  summary,
  isLoading = false,
}: UptimeStatusBarProps) {
  // Aggregate timeseries into 24 one-hour buckets covering the last 24 hours in local time
  const buckets = useMemo<HourBucket[]>(() => {
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    const result: HourBucket[] = [];

    for (let i = 23; i >= 0; i--) {
      const bucketStart = now - (i + 1) * oneHourMs;
      const bucketEnd = now - i * oneHourMs;
      const startDate = new Date(bucketStart);
      const endDate = new Date(bucketEnd);

      const label = `${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

      // Find points falling into this hour bucket
      const points = (timeseries || []).filter((p) => {
        const t = Date.parse(p.timestamp);
        return !isNaN(t) && t >= bucketStart && t < bucketEnd;
      });

      if (points.length === 0) {
        result.push({
          index: 23 - i,
          label,
          startIso: startDate.toISOString(),
          status: 'no_data',
          uptimePct: null,
          avgLatency: null,
          downCount: 0,
          totalCount: 0,
        });
        continue;
      }

      let totalCount = 0;
      let downCount = 0;
      let slowCount = 0;
      let upCount = 0;
      const latencies: number[] = [];

      for (const p of points) {
        totalCount += p.total_count || 1;
        const isDown = p.status === 'down' || p.is_down || (p.down_count > 0);
        downCount += p.down_count || (isDown ? 1 : 0);
        if (p.status === 'slow') {
          slowCount++;
        }
        if (p.status === 'up' && !isDown) {
          upCount++;
        }
        if (p.latency != null && p.latency >= 0) {
          latencies.push(p.latency);
        }
      }

      const avgLatency = latencies.length
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null;

      let status: 'up' | 'slow' | 'down' | 'no_data' = 'up';
      if (downCount > 0) {
        status = 'down';
      } else if (slowCount > 0) {
        status = 'slow';
      } else if (upCount === 0 && totalCount === 0) {
        status = 'no_data';
      }

      const uptimePct = totalCount > 0
        ? Math.round(((totalCount - downCount) / totalCount) * 1000) / 10
        : null;

      result.push({
        index: 23 - i,
        label,
        startIso: startDate.toISOString(),
        status,
        uptimePct,
        avgLatency,
        downCount,
        totalCount,
      });
    }

    return result;
  }, [timeseries]);

  const uptimePct = summary?.uptime_percentage;
  const uptimeColor =
    uptimePct != null
      ? uptimePct >= 99
        ? 'text-emerald-400'
        : uptimePct >= 95
          ? 'text-amber-400'
          : 'text-rose-400'
      : 'text-slate-400';

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border-base bg-bg-dark/60 p-3 space-y-2.5">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <div className="flex items-center gap-1.5">
            <Activity size={14} className="text-emerald-400 animate-pulse" />
            <span className="font-medium text-text-main">Disponibilidad 24 h</span>
          </div>
          <span className="animate-pulse">Cargando…</span>
        </div>
        <div className="flex items-center gap-[3px] w-full py-1">
          {Array.from({ length: 24 }).map((_, idx) => (
            <div
              key={idx}
              className="flex-1 h-7 rounded-[3px] bg-bg-card-hover animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Disponibilidad 24 h"
      className="rounded-xl border border-border-base bg-bg-dark/60 p-3 space-y-2"
    >
      <header className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <Activity size={14} className="text-accent-cyan shrink-0" />
          <span className="font-semibold text-text-main">Disponibilidad 24 h</span>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span className={`font-bold ${uptimeColor}`}>
            {uptimePct != null ? `${formatMetric(uptimePct, 2)} %` : '—'}
          </span>
          <span className="text-[11px] text-text-muted">24 h</span>
        </div>
      </header>

      {/* 24-Segment Uptime Bar */}
      <div className="flex items-center gap-[3px] w-full py-0.5">
        {buckets.map((b) => {
          let bgClass = 'bg-bg-card-hover';
          let statusText = 'Sin datos';

          if (b.status === 'up') {
            bgClass = 'bg-emerald-500 hover:bg-emerald-400';
            statusText = '100% Operacional';
          } else if (b.status === 'slow') {
            bgClass = 'bg-amber-400 hover:bg-amber-300';
            statusText = 'Respuesta lenta';
          } else if (b.status === 'down') {
            bgClass = 'bg-rose-500 hover:bg-rose-400';
            statusText = b.downCount > 0 ? `Caído (${b.downCount} fallos)` : 'Caído';
          }

          return (
            <div
              key={b.index}
              className={`flex-1 h-7 rounded-[3px] transition-all cursor-pointer relative group ${bgClass}`}
            >
              {/* Tooltip on hover */}
              <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-40 min-w-[160px] p-2 rounded-lg bg-bg-dark border border-border-base shadow-2xl text-[11px] text-text-main space-y-1">
                <div className="font-mono text-text-muted text-[10px] border-b border-border-base pb-1">
                  {b.label}
                </div>
                <div className="flex items-center justify-between font-medium">
                  <span>Estado:</span>
                  <span
                    className={
                      b.status === 'up'
                        ? 'text-emerald-400'
                        : b.status === 'slow'
                          ? 'text-amber-400'
                          : b.status === 'down'
                            ? 'text-rose-400'
                            : 'text-text-muted'
                    }
                  >
                    {statusText}
                  </span>
                </div>
                {b.uptimePct != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Uptime:</span>
                    <span className="font-mono">{b.uptimePct}%</span>
                  </div>
                )}
                {b.avgLatency != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Latencia:</span>
                    <span className="font-mono">{b.avgLatency} ms</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Axis Footer */}
      <footer className="flex justify-between text-[10px] text-text-muted font-mono pt-0.5">
        <span>Hace 24 h</span>
        <span className="text-slate-500">Intervalos de 1 h</span>
        <span>Ahora</span>
      </footer>
    </section>
  );
}
