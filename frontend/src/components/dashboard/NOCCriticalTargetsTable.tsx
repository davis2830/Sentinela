import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Bell, ExternalLink, ChevronRight } from 'lucide-react';
import type { MonitoringTarget } from '../../types/monitoring';

interface Props {
  targets: MonitoringTarget[];
  onScanTarget: (id: string) => void;
  onToggleActive: (id: string, enabled: boolean) => void;
  onInspectTarget: (target: MonitoringTarget) => void;
  isScanningId?: string | null;
  canManageTargets: boolean;
  isUnavailable?: boolean;
  isLoading?: boolean;
}

function getStatus(target: MonitoringTarget) {
  if (!target.enabled) return { label: 'Pausado', color: 'bg-bg-dark text-text-dim border-border-base', dot: 'bg-text-dim' };
  if (target.last_status === 'down' || target.last_status === 'error') return { label: 'Caído', color: 'bg-accent-red/15 text-accent-red border-accent-red/30', dot: 'bg-accent-red' };
  if (target.last_status === 'degraded' || target.last_status === 'slow') return { label: 'Degradado', color: 'bg-accent-yellow/15 text-accent-yellow border-accent-yellow/30', dot: 'bg-accent-yellow' };
  if (target.last_status === 'up') return { label: 'Online', color: 'bg-accent-green/15 text-accent-green border-accent-green/30', dot: 'bg-accent-green' };
  return { label: 'Sin datos', color: 'bg-bg-dark text-text-dim border-border-base', dot: 'bg-text-dim' };
}

function StatusPill({ target }: { target: MonitoringTarget }) {
  const status = getStatus(target);
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${status.color}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />{status.label}
  </span>;
}

const latencyText = (target: MonitoringTarget) => target.last_latency == null ? '—' : `${Math.round(target.last_latency)} ms`;
const checkTime = (target: MonitoringTarget) => target.last_checked_at
  ? new Date(target.last_checked_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  : 'Pendiente';

function NOCCriticalTargetsTable({ targets, onScanTarget, onToggleActive, onInspectTarget, isScanningId, canManageTargets, isUnavailable = false, isLoading = false }: Props) {
  const navigate = useNavigate();
  const sortedTargets = useMemo(() => [...targets].sort((a, b) => {
    const priority: Record<string, number> = { down: 1, error: 1, degraded: 2, slow: 2, unknown: 3, up: 4 };
    const score = (target: MonitoringTarget) => target.enabled ? priority[target.last_status || 'unknown'] || 3 : 5;
    return score(a) - score(b);
  }).slice(0, 5), [targets]);
  const criticalCount = targets.filter((target) => target.enabled && ['down', 'error', 'degraded', 'slow'].includes(target.last_status || '')).length;

  const actions = (target: MonitoringTarget) => <div className="flex flex-wrap items-center justify-end gap-1.5">
    {canManageTargets && <button type="button" onClick={() => onScanTarget(target.id)} disabled={isScanningId === target.id}
      className="rounded-lg p-2 text-text-muted hover:bg-accent-green/10 hover:text-accent-green disabled:opacity-50" title="Escanear bajo demanda" aria-label={`Escanear ${target.name}`}>
      <RefreshCw size={15} className={isScanningId === target.id ? 'animate-spin' : ''} />
    </button>}
    <button type="button" onClick={() => navigate(`/alerts?target_id=${encodeURIComponent(target.id)}&target_type=monitoring`)}
      className="rounded-lg p-2 text-text-muted hover:bg-accent-yellow/10 hover:text-accent-yellow" title="Ver alertas" aria-label={`Ver alertas de ${target.name}`}><Bell size={15} /></button>
    <button type="button" onClick={() => onInspectTarget(target)} className="rounded-lg p-2 text-text-muted hover:bg-white/10 hover:text-text-main"
      title="Ver telemetría detallada" aria-label={`Inspeccionar ${target.name}`}><ExternalLink size={15} /></button>
    {canManageTargets && <button type="button" role="switch" aria-checked={target.enabled} aria-label={`${target.enabled ? 'Pausar' : 'Reanudar'} ${target.name}`}
      title={target.enabled ? 'Pausar monitoreo' : 'Reanudar monitoreo'} onClick={() => onToggleActive(target.id, target.enabled)}
      className={`relative ml-1 inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${target.enabled ? 'bg-accent-green' : 'bg-border-base'}`}>
      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-black transition-transform ${target.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>}
  </div>;

  return <section className="min-w-0 rounded-2xl border border-border-base bg-bg-card p-4 shadow-sm md:p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="rounded-lg border border-accent-red/20 bg-accent-red/10 p-1.5 text-accent-red"><AlertTriangle size={15} /></span>
        <h3 className="truncate text-sm font-bold text-text-main">Targets prioritarios</h3>
        {criticalCount > 0 && <span className="rounded-full border border-accent-red/40 bg-accent-red/20 px-2 py-0.5 font-mono text-[10px] font-bold text-accent-red">{criticalCount}</span>}
      </div>
      <button type="button" onClick={() => navigate('/monitoring')} className="flex shrink-0 items-center gap-1 text-xs text-text-muted hover:text-accent-green">Ver todos <ChevronRight size={13} /></button>
    </div>

    {isUnavailable && <p className="mb-3 rounded-lg border border-accent-red/30 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">No se pudo actualizar la lista de monitores.</p>}
    {sortedTargets.length === 0 ? <p className="py-8 text-center text-xs text-text-dim">{isLoading ? 'Cargando monitores…' : isUnavailable ? 'Estado actual no disponible.' : 'No hay monitores registrados.'}</p> : <>
      <div className="space-y-2 xl:hidden">
        {sortedTargets.map((target) => <article key={target.id} className="min-w-0 rounded-xl border border-border-base/70 bg-bg-dark/40 p-3">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => onInspectTarget(target)} className="max-w-full truncate text-left text-xs font-semibold text-text-main hover:text-accent-green">{target.name}</button>
              <div title={target.endpoint} className="truncate font-mono text-[11px] text-text-dim">{target.endpoint}</div>
            </div>
            <StatusPill target={target} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] sm:grid-cols-3">
            <div><dt className="text-text-dim">Tipo</dt><dd className="font-mono text-text-muted">{target.target_type || 'http'}</dd></div>
            <div><dt className="text-text-dim">Latencia</dt><dd className="font-mono text-text-main">{latencyText(target)}</dd></div>
            <div><dt className="text-text-dim">Último check</dt><dd className="font-mono text-text-muted">{checkTime(target)}</dd></div>
          </dl>
          <div className="mt-3 border-t border-border-base/50 pt-2">{actions(target)}</div>
        </article>)}
      </div>

      <div className="hidden min-w-0 xl:block">
        <table className="w-full table-fixed text-left text-xs">
          <colgroup><col className="w-28" /><col /><col className="w-24" /><col className="w-28" /><col className={canManageTargets ? 'w-44' : 'w-24'} /></colgroup>
          <thead className="border-b border-border-base text-[11px] font-semibold text-text-dim"><tr>
            <th className="px-2 py-2.5">Estado</th><th className="px-2 py-2.5">Servicio / Recurso</th><th className="px-2 py-2.5">Latencia</th>
            <th className="px-2 py-2.5">Último check</th><th className="px-2 py-2.5 text-right">Acciones</th>
          </tr></thead>
          <tbody className="divide-y divide-border-base/50">
            {sortedTargets.map((target) => <tr key={target.id} className="hover:bg-bg-dark/40">
              <td className="px-2 py-3"><StatusPill target={target} /></td>
              <td className="min-w-0 px-2 py-3"><button type="button" onClick={() => onInspectTarget(target)} className="block max-w-full truncate text-left font-semibold text-text-main hover:text-accent-green">{target.name}</button>
                <div title={target.endpoint} className="truncate font-mono text-[11px] text-text-dim">{target.endpoint}</div>
                <span className="font-mono text-[10px] text-text-dim">{target.target_type || 'http'}</span></td>
              <td className="px-2 py-3 font-mono text-text-main">{latencyText(target)}</td>
              <td className="px-2 py-3 font-mono text-[11px] text-text-muted">{checkTime(target)}</td>
              <td className="px-2 py-3">{actions(target)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </>}
  </section>;
}

export default React.memo(NOCCriticalTargetsTable);
