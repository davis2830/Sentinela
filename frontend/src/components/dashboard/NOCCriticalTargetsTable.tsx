import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  RefreshCw,
  Bell,
  ExternalLink,
  ChevronRight,
  Globe,
  Server,
  Zap,
} from 'lucide-react';
import type { MonitoringTarget } from '../../types/monitoring';

interface NOCCriticalTargetsTableProps {
  targets: MonitoringTarget[];
  onScanTarget: (id: string) => void;
  onToggleActive: (id: string, currentEnabled: boolean) => void;
  onInspectTarget: (target: MonitoringTarget) => void;
  isScanningId?: string | null;
}

export default function NOCCriticalTargetsTable({
  targets,
  onScanTarget,
  onToggleActive,
  onInspectTarget,
  isScanningId,
}: NOCCriticalTargetsTableProps) {
  const navigate = useNavigate();

  // Sort targets: down first, then degraded, then up, then unknown
  const sortedTargets = [...targets].sort((a, b) => {
    const priority: Record<string, number> = { down: 1, degraded: 2, unknown: 3, up: 4 };
    const pA = priority[a.last_status || 'unknown'] || 5;
    const pB = priority[b.last_status || 'unknown'] || 5;
    return pA - pB;
  });

  const criticalCount = targets.filter(
    (t) => t.last_status === 'down' || t.last_status === 'degraded'
  ).length;

  return (
    <div className="bg-bg-card border border-border-base rounded-2xl p-5 md:p-6 shadow-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-accent-red/10 text-accent-red border border-accent-red/20">
            <AlertTriangle size={15} />
          </div>
          <h3 className="text-sm font-bold tracking-wide text-text-main">
            Targets Críticos
          </h3>
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-accent-red/20 text-accent-red border border-accent-red/40">
              {criticalCount}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate('/monitoring')}
          className="text-xs text-text-muted hover:text-accent-green flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>Ver todos</span>
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-left text-xs">
          <thead className="text-[11px] text-text-dim border-b border-border-base uppercase tracking-wider font-semibold">
            <tr>
              <th className="py-2.5 px-3">Estado</th>
              <th className="py-2.5 px-3">Servicio / Recurso</th>
              <th className="py-2.5 px-3">Tipo</th>
              <th className="py-2.5 px-3">Latencia</th>
              <th className="py-2.5 px-3">Último Check</th>
              <th className="py-2.5 px-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base/50 font-sans">
            {sortedTargets.slice(0, 5).map((t) => {
              const isDown = t.last_status === 'down';
              const isDegraded = t.last_status === 'degraded';
              const isUp = t.last_status === 'up';

              return (
                <tr
                  key={t.id}
                  className="hover:bg-bg-dark/40 transition-colors group cursor-pointer"
                  onClick={() => onInspectTarget(t)}
                >
                  {/* Status Capsule */}
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        isDown
                          ? 'bg-accent-red/15 text-accent-red border-accent-red/30'
                          : isDegraded
                          ? 'bg-accent-yellow/15 text-accent-yellow border-accent-yellow/30'
                          : 'bg-accent-green/15 text-accent-green border-accent-green/30'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isDown
                            ? 'bg-accent-red animate-pulse'
                            : isDegraded
                            ? 'bg-accent-yellow animate-pulse'
                            : 'bg-accent-green'
                        }`}
                      />
                      {isDown ? 'Caído' : isDegraded ? 'Degradado' : 'Online'}
                    </span>
                  </td>

                  {/* Resource Name & URL */}
                  <td className="py-3 px-3">
                    <div className="font-semibold text-text-main group-hover:text-accent-green transition-colors">
                      {t.name}
                    </div>
                    <div className="text-[11px] text-text-dim font-mono truncate max-w-xs">
                      {t.endpoint}
                    </div>
                  </td>

                  {/* Protocol Type */}
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-md bg-bg-dark border border-border-base text-[10px] font-mono font-bold text-text-muted uppercase">
                      {t.target_type || 'HTTP'}
                    </span>
                  </td>

                  {/* Latency */}
                  <td className="py-3 px-3 font-mono font-bold">
                    {t.last_latency !== null && t.last_latency !== undefined ? (
                      <span
                        className={
                          t.last_latency > 400
                            ? 'text-accent-yellow'
                            : t.last_latency > 800
                            ? 'text-accent-red'
                            : 'text-text-main'
                        }
                      >
                        {Math.round(t.last_latency)} ms
                      </span>
                    ) : (
                      <span className="text-text-dim">&mdash;</span>
                    )}
                  </td>

                  {/* Timestamp */}
                  <td className="py-3 px-3 text-text-dim font-mono text-[11px]">
                    {t.last_checked_at
                      ? new Date(t.last_checked_at).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : 'Pendiente'}
                  </td>

                  {/* Quick Actions & Switch Toggle */}
                  <td
                    className="py-3 px-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Manual Scan Button */}
                      <button
                        type="button"
                        onClick={() => onScanTarget(t.id)}
                        disabled={isScanningId === t.id}
                        className="p-1.5 text-text-dim hover:text-accent-green rounded-lg hover:bg-accent-green/10 transition-colors"
                        title="Escanear bajo demanda"
                      >
                        <RefreshCw
                          size={13}
                          className={isScanningId === t.id ? 'animate-spin text-accent-green' : ''}
                        />
                      </button>

                      {/* Alert Link Button */}
                      <button
                        type="button"
                        onClick={() => navigate('/alerts')}
                        className="p-1.5 text-text-dim hover:text-accent-yellow rounded-lg hover:bg-accent-yellow/10 transition-colors"
                        title="Vincular Alerta"
                      >
                        <Bell size={13} />
                      </button>

                      {/* Deep Inspect Button */}
                      <button
                        type="button"
                        onClick={() => onInspectTarget(t)}
                        className="p-1.5 text-text-dim hover:text-text-main rounded-lg hover:bg-white/10 transition-colors"
                        title="Ver telemetría detallada"
                      >
                        <ExternalLink size={13} />
                      </button>

                      {/* Interactive Switch Toggle */}
                      <button
                        type="button"
                        onClick={() => onToggleActive(t.id, t.enabled ?? true)}
                        className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ml-1 ${
                          (t.enabled ?? true) ? 'bg-accent-green' : 'bg-border-base'
                        }`}
                        title={
                          (t.enabled ?? true) ? 'Pausar monitoreo' : 'Reanudar monitoreo'
                        }
                      >
                        <span
                          className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-black shadow transform ring-0 transition duration-200 ease-in-out ${
                            (t.enabled ?? true) ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
