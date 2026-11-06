import TargetLatency, { TargetDiagnostic } from './TargetLatency';
import { useEffect, useState } from 'react';

import AdminButton from '../common/AdminButton';
import { Globe, Server, Plug, Lock, RefreshCw, Bell, Pencil, Trash2, ArrowUpDown, Check, Layers } from 'lucide-react';
import type { MonitoringTarget } from '../../types/monitoring';

const typeIcons: Record<string, typeof Globe> = {
  http: Globe,
  https: Globe,
  tcp: Server,
  dns: Globe,
  api: Plug,
  ssl: Lock,
};

const typeColors: Record<string, { bg: string; text: string; border: string }> = {
  https: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30' },
  http: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  tcp: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  dns: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  api: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  ssl: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
};

interface TargetTableViewProps {
  targets: MonitoringTarget[];
  selectedIds: string[];
  onSelectToggle: (target: MonitoringTarget) => void;
  onSelectAllToggle: () => void;
  onEdit: (target: MonitoringTarget) => void;
  onDelete: (target: MonitoringTarget) => void;
  onScan: (target: MonitoringTarget) => void;
  onToggle: (target: MonitoringTarget) => void;
  onAlert?: (target: MonitoringTarget) => void;
  scanningId: string | null;
  onClick: (target: MonitoringTarget) => void;
  sortField: 'name' | 'latency' | 'status';
  sortAsc: boolean;
  onSortChange: (field: 'name' | 'latency' | 'status') => void;
}

export default function TargetTableView({
  targets,
  selectedIds,
  onSelectToggle,
  onSelectAllToggle,
  onEdit,
  onDelete,
  onScan,
  onToggle,
  onAlert,
  scanningId,
  onClick,
  sortField,
  sortAsc,
  onSortChange,
}: TargetTableViewProps) {
  const allSelected = targets.length > 0 && selectedIds.length === targets.length;
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);


  const renderStatus = (target: MonitoringTarget) => {
    if (!target.enabled) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
          Pausado
        </span>
      );
    }
    if (target.last_status === 'up') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Online
        </span>
      );
    }
    if (target.last_status === 'slow') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          Lento
        </span>
      );
    }
    if (target.last_status === 'down' || target.last_status === 'error') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          </span>
          Caído
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
        Desconocido
      </span>
    );
  };

  return (
    <div data-testid="connectivity-table" className="min-w-0 max-w-full bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-xl">
      {mobile ? <div className="divide-y divide-border-base" data-testid="monitoring-mobile-list">
        <details className="p-3">
          <summary className="flex items-center text-xs text-text-muted cursor-pointer">Orden y selección</summary>
          <div className="flex flex-wrap items-center gap-3">
          <button className="text-xs text-accent-green" onClick={onSelectAllToggle}>{allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}</button>
          <label className="text-xs text-text-muted">Ordenar por
            <select aria-label="Ordenar targets" className="ml-2 bg-bg-dark border border-border-base rounded-lg p-2" value={sortField} onChange={e => onSortChange(e.target.value as 'name' | 'latency' | 'status')}>
              <option value="name">Nombre</option><option value="status">Estado</option><option value="latency">Latencia</option>
            </select>
          </label>
          <button onClick={() => onSortChange(sortField)} aria-label="Invertir orden">{sortAsc ? 'Ascendente' : 'Descendente'}</button>
          </div>
        </details>
        {targets.map(target => <article key={target.id} className="min-w-0 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <button aria-label={`Seleccionar ${target.name}`} aria-pressed={selectedIds.includes(target.id)} onClick={() => onSelectToggle(target)} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg">
              <span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded-md border border-border-base">
                {selectedIds.includes(target.id) && <Check className="text-accent-green" size={14} />}
              </span>
            </button>
            <button onClick={() => onClick(target)} aria-label={`Ver detalle de ${target.name}`} className="min-w-0 flex-1 text-left">
              <span className="block font-semibold text-text-main break-words">{target.name}</span>
              <span className="block text-xs text-text-muted break-all">{target.endpoint}</span>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            {renderStatus(target)}<span>{target.target_type.toUpperCase()} · cada {target.interval}s</span>
            <TargetLatency target={target} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
            <span>Última medición: {target.last_checked_at ? new Date(target.last_checked_at).toLocaleString('es-ES') : 'Sin mediciones'}</span>
            <button className="text-accent-green" onClick={() => onClick(target)}>Ver detalle</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminButton className="text-xs text-text-main" onClick={() => onEdit(target)}>Editar</AdminButton>
            {onAlert && <AdminButton className="text-xs text-accent-yellow" onClick={() => onAlert(target)}>Vincular alerta</AdminButton>}
            <AdminButton className="text-xs text-text-muted" onClick={() => onToggle(target)}>{target.enabled ? 'Pausar' : 'Reanudar'}</AdminButton>
            <AdminButton className="text-xs text-accent-red" onClick={() => onDelete(target)}>Eliminar</AdminButton>
          </div>
        </article>)}
      </div> : <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-text-main border-collapse">
          <thead>
            <tr className="border-b border-border-base bg-bg-dark/80 font-medium text-xs text-text-muted">
              <th scope="col" className="py-3.5 px-4 w-10">
                <button
                  type="button"
                  onClick={onSelectAllToggle}
                  className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all duration-150 ${
                    allSelected
                      ? 'bg-accent-green text-black shadow-sm shadow-accent-green/30 ring-2 ring-accent-green/40'
                      : 'border border-border-base/90 bg-bg-dark/80 hover:border-accent-green/50 text-transparent'
                  }`}
                  title={allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                >
                  <Check size={12} strokeWidth={3} className={allSelected ? 'scale-100 opacity-100' : 'scale-50 opacity-0'} />
                </button>
              </th>
              <th scope="col" className="py-3.5 px-4 cursor-pointer hover:text-text-main" onClick={() => onSortChange('status')}>
                <div className="flex items-center gap-1.5">
                  Estado
                  <ArrowUpDown size={12} className={sortField === 'status' ? 'text-accent-green' : 'text-text-dim'} />
                </div>
              </th>
              <th scope="col" className="py-3.5 px-4 cursor-pointer hover:text-text-main" onClick={() => onSortChange('name')}>
                <div className="flex items-center gap-1.5">
                  Target & Endpoint
                  <ArrowUpDown size={12} className={sortField === 'name' ? 'text-accent-green' : 'text-text-dim'} />
                </div>
              </th>
              <th scope="col" className="py-3.5 px-4">Tipo</th>
              <th scope="col" className="py-3.5 px-4">Intervalo</th>
              <th scope="col" className="py-3.5 px-4 cursor-pointer hover:text-text-main" onClick={() => onSortChange('latency')}>
                <div className="flex items-center gap-1.5">
                  Latencia
                  <ArrowUpDown size={12} className={sortField === 'latency' ? 'text-accent-green' : 'text-text-dim'} />
                </div>
              </th>
              <th scope="col" className="py-3.5 px-4 min-w-[140px]">Historial Reciente</th>
              <th scope="col" className="py-3.5 px-4">Último Check</th>
              <th scope="col" className="py-3.5 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base/50">
            {targets.map((target) => {
              const isSelected = selectedIds.includes(target.id);
              const Icon = typeIcons[target.target_type] || Globe;
              const typeStyle = typeColors[target.target_type] || {
                bg: 'bg-accent-green/10',
                text: 'text-accent-green',
                border: 'border-accent-green/30',
              };

              const recentChecks = target.recent_checks && target.recent_checks.length > 0
                ? target.recent_checks
                : Array.from({ length: 12 }).map(() => ({
                    status: target.enabled ? (target.last_status || 'unknown') : 'disabled',
                    latency: target.last_latency,
                  }));

              return (
                <tr
                  key={target.id}
                  onClick={() => onClick(target)}
                  tabIndex={0}
                  aria-label={target.name}
                  onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(target); } }}
                  className={`hover:bg-bg-dark/50 cursor-pointer transition-colors ${
                    isSelected ? 'bg-accent-green/5' : ''
                  }`}
                >
                  <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onSelectToggle(target)}
                      className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all duration-150 ${
                        isSelected
                          ? 'bg-accent-green text-black shadow-sm shadow-accent-green/30 ring-2 ring-accent-green/40'
                          : 'border border-border-base/90 bg-bg-dark/80 hover:border-accent-green/50 text-transparent'
                      }`}
                      title={isSelected ? 'Deseleccionar target' : 'Seleccionar target'}
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-label={`Seleccionar ${target.name}`}
                    >
                      <Check size={12} strokeWidth={3} className={isSelected ? 'scale-100 opacity-100' : 'scale-50 opacity-0'} />
                    </button>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">{renderStatus(target)}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${typeStyle.bg} border ${typeStyle.border} flex items-center justify-center shrink-0`}>
                        <Icon className={typeStyle.text} size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-text-main text-sm truncate max-w-[180px]" title={target.name}>
                            {target.name}
                          </div>
                          {target.owner_team_name && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border shrink-0"
                              style={{
                                backgroundColor: `${target.owner_team_color || '#8B5CF6'}15`,
                                borderColor: `${target.owner_team_color || '#8B5CF6'}40`,
                                color: target.owner_team_color || '#A78BFA',
                              }}
                            >
                              <Layers size={9} className="shrink-0" />
                              <span className="truncate max-w-[90px]">{target.owner_team_name}</span>
                            </span>
                          )}
                          {target.runner_type === 'agent' && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border shrink-0 ${
                                target.agent_probe_online === false || target.agent_probe_status === 'offline'
                                  ? 'bg-accent-red/10 text-accent-red border-accent-red/30'
                                  : 'bg-accent-purple/10 text-accent-purple border-accent-purple/30'
                              }`}
                              title={
                                target.agent_probe_online === false || target.agent_probe_status === 'offline'
                                  ? `Atención: Guardián Senti9 (${target.agent_probe_name || 'LAN'}) desconectado`
                                  : `Sondeado por Guardián Senti9: ${target.agent_probe_name || 'LAN'}`
                              }
                            >
                              <Server size={9} className="shrink-0" />
                              <span className="truncate max-w-[85px]">Senti9: {target.agent_probe_name || 'LAN'}</span>
                              {(target.agent_probe_online === false || target.agent_probe_status === 'offline') && (
                                <span className="text-[8px] text-accent-red font-mono">(Offline)</span>
                              )}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-text-dim font-mono truncate max-w-[260px]" title={target.endpoint}>
                          {target.endpoint}
                        </div><TargetDiagnostic target={target}/>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>
                      {target.target_type.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-text-muted">
                    {target.interval}s
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap font-mono font-bold text-sm">
                    <TargetLatency target={target}/>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 h-3 w-28">
                      {recentChecks.slice(-12).map((c, idx) => {
                        let bg = 'bg-zinc-700';
                        if (c.status === 'up') bg = 'bg-emerald-500';
                        else if (c.status === 'slow') bg = 'bg-amber-400';
                        else if (c.status === 'down' || c.status === 'error') bg = 'bg-rose-500';
                        return <div key={idx} className={`flex-1 h-full rounded-xs ${bg}`} />;
                      })}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-text-muted">
                    {target.last_checked_at
                      ? new Date(target.last_checked_at).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : 'Nunca'}
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">

                      {onAlert && (
                        <AdminButton
                          onClick={() => onAlert(target)}
                          className="p-1.5 text-text-muted hover:text-accent-yellow hover:bg-accent-yellow/10 rounded transition-colors"
                          title="Vincular regla de alerta"
                        >
                          <Bell size={14} />
                        </AdminButton>
                      )}
                      <AdminButton
                        onClick={() => onEdit(target)}
                        className="p-1.5 text-text-muted hover:text-accent-blue hover:bg-accent-blue/10 rounded transition-colors"
                        title="Editar target"
                      >
                        <Pencil size={14} />
                      </AdminButton>
                      <AdminButton
                        onClick={() => onDelete(target)}
                        className="p-1.5 text-text-muted hover:text-accent-red hover:bg-accent-red/10 rounded transition-colors"
                        title="Eliminar target"
                      >
                        <Trash2 size={14} />
                      </AdminButton>
                      <AdminButton
                        onClick={() => onToggle(target)}
                        className={`w-8 h-4.5 flex items-center rounded-full p-0.5 ml-2 cursor-pointer transition-colors ${
                          target.enabled ? 'bg-accent-green' : 'bg-bg-dark border border-border-base'
                        }`}
                        title={target.enabled ? 'Pausar monitoreo' : 'Activar monitoreo'}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full shadow-md transform duration-200 ${
                            target.enabled ? 'translate-x-3.5 bg-black' : 'translate-x-0 bg-text-dim'
                          }`}
                        />
                      </AdminButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>}
    </div>
  );
}
