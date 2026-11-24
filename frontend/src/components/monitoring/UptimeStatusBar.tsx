import { useMemo } from 'react';
import { Activity } from 'lucide-react';
import type { TimeseriesPoint, TimeseriesSummary } from '../../types/monitoring';
import { formatMetric } from '../../utils/endpointPresentation';

interface UptimeStatusBarProps {
  timeseries: TimeseriesPoint[];
  summary?: TimeseriesSummary | null;
  targetCreatedAt?: string;
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
  isPreCreation?: boolean;
}

export default function UptimeStatusBar({
  timeseries,
  summary,
  targetCreatedAt,
  isLoading = false,
}: UptimeStatusBarProps) {
  // Aggregate timeseries into 24 one-hour buckets covering the last 24 hours in local time
  const buckets = useMemo<HourBucket[]>(() => {
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    const createdAtMs = targetCreatedAt ? Date.parse(targetCreatedAt) : 0;
    const result: HourBucket[] = [];

    for (let i = 23; i >= 0; i--) {
      const bucketStart = now - (i + 1) * oneHourMs;
      const bucketEnd = now - i * oneHourMs;
      const startDate = new Date(bucketStart);
      const endDate = new Date(bucketEnd);

      const label = `${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

      // If the target was created after this bucket ended, mark strictly as pre-creation no_data
      if (createdAtMs > 0 && bucketEnd < createdAtMs) {
        result.push({
          index: 23 - i,
          label,
          startIso: startDate.toISOString(),
          status: 'no_data',
          uptimePct: null,
          avgLatency: null,
          downCount: 0,
          totalCount: 0,
          isPreCreation: true,
        });
        continue;
      }

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
          isPreCreation: false,
        });
        continue;
      }

      let totalCount = 0;
      let downCount = 0;
      let slowCount = 0;
      let upCount = 0;
      const latencies: number[] = [];

      for (const p of points) {
        const count = typeof p.total_count === 'number' ? p.total_count : 0;
        totalCount += count;

        const isDown = p.status === 'down' || p.is_down || ((p.down_count || 0) > 0);
        const pointDown = typeof p.down_count === 'number' ? p.down_count : (isDown ? 1 : 0);
        downCount += pointDown;

        if (p.status === 'slow') {
          slowCount++;
        }
        if (p.status === 'up' && !isDown) {
          upCount += Math.max(1, count - pointDown);
        }
        if (p.latency != null && p.latency >= 0) {
          latencies.push(p.latency);
        }
      }

      const avgLatency = latencies.length
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null;

      let status: 'up' | 'slow' | 'down' | 'no_data' = 'no_data';
      if (totalCount === 0) {
        status = 'no_data';
      } else if (downCount > 0) {
        status = 'down';
      } else if (slowCount > 0) {
        status = 'slow';
      } else if (upCount > 0 || (totalCount > 0 && downCount === 0)) {
        status = 'up';
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
        isPreCreation: false,
      });
    }

    return result;
  }, [timeseries, targetCreatedAt]);

  const uptimePct = summary?.uptime_percentage;
  const targetAgeHours = targetCreatedAt
    ? Math.floor((Date.now() - Date.parse(targetCreatedAt)) / (1000 * 60 * 60))
    : 24;
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
          <span className="text-[11px] text-text-muted">
            {targetAgeHours < 24 && targetAgeHours >= 0
              ? `(sobre ${Math.max(1, targetAgeHours)} h)`
              : '24 h'}
          </span>
        </div>
      </header>

      {/* 24-Segment Uptime Bar */}
      <div className="flex items-center gap-[3px] w-full py-0.5">
        {buckets.map((b) => {
          let bgClass = 'bg-bg-card-hover';
          let statusText = b.isPreCreation
            ? 'Sin monitor (no creado aún)'
            : 'Sin mediciones';

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

          // Tooltip position: clamp to left on start, clamp to right on end, center in middle
          const tooltipPositionClass =
            b.index < 5
              ? 'left-0 translate-x-0'
              : b.index > 18
                ? 'right-0 left-auto translate-x-0'
                : 'left-1/2 -translate-x-1/2';

          return (
            <div
              key={b.index}
              className={`flex-1 h-7 rounded-[3px] transition-all cursor-pointer relative group ${bgClass}`}
            >
              {/* Tooltip on hover */}
              <div
                className={`pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-full mb-2 z-50 min-w-[190px] p-2.5 rounded-xl bg-slate-900 border border-border-base shadow-2xl text-[11px] text-text-main space-y-1.5 whitespace-nowrap ${tooltipPositionClass}`}
              >
                <div className="font-mono text-text-muted text-[10px] border-b border-border-base pb-1">
                  {b.label}
                </div>
                <div className="flex items-center justify-between gap-3 font-medium">
                  <span className="text-text-muted">Estado:</span>
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
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-text-muted">Disponibilidad:</span>
                    <span className="font-mono font-semibold">{b.uptimePct}%</span>
                  </div>
                )}
                {b.avgLatency != null && (
                  <div className="flex items-center justify-between gap-3">
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
