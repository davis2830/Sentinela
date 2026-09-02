import { Globe, Server, Plug, Lock, RefreshCw, Bell, Pencil, Trash2, ArrowUpDown } from 'lucide-react';
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

  const getLatencyColor = (ms: number | null) => {
    if (ms === null) return 'text-text-dim';
    if (ms < 100) return 'text-emerald-400';
    if (ms < 400) return 'text-sky-300';
    if (ms < 1000) return 'text-amber-400';
    return 'text-rose-400';
  };

  const renderStatus = (target: MonitoringTarget) => {
    if (!target.enabled) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
          PAUSADO
        </span>
      );
    }
    if (target.last_status === 'up') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          ONLINE
        </span>
      );
    }
    if (target.last_status === 'slow') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          LENTO
        </span>
      );
    }
    if (target.last_status === 'down' || target.last_status === 'error') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          </span>
          CAÍDO
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
        DESCONOCIDO
      </span>
    );
  };

  return (
    <div className="bg-bg-card border border-border-base rounded-xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-text-main border-collapse">
          <thead>
            <tr className="border-b border-border-base bg-bg-dark/80 font-mono text-xs text-text-muted">
              <th className="py-3.5 px-4 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onSelectAllToggle}
                  className="w-4 h-4 rounded border-border-base text-accent-green focus:ring-accent-green/40 bg-bg-dark cursor-pointer"
                />
              </th>
              <th className="py-3.5 px-4 cursor-pointer hover:text-text-main" onClick={() => onSortChange('status')}>
                <div className="flex items-center gap-1.5">
                  ESTADO
                  <ArrowUpDown size={12} className={sortField === 'status' ? 'text-accent-green' : 'text-text-dim'} />
                </div>
              </th>
              <th className="py-3.5 px-4 cursor-pointer hover:text-text-main" onClick={() => onSortChange('name')}>
                <div className="flex items-center gap-1.5">
                  TARGET & ENDPOINT
                  <ArrowUpDown size={12} className={sortField === 'name' ? 'text-accent-green' : 'text-text-dim'} />
                </div>
              </th>
              <th className="py-3.5 px-4">TIPO</th>
              <th className="py-3.5 px-4">INTERVALO</th>
              <th className="py-3.5 px-4 cursor-pointer hover:text-text-main" onClick={() => onSortChange('latency')}>
                <div className="flex items-center gap-1.5">
                  LATENCIA
                  <ArrowUpDown size={12} className={sortField === 'latency' ? 'text-accent-green' : 'text-text-dim'} />
                </div>
              </th>
              <th className="py-3.5 px-4 min-w-[140px]">HISTORIAL RECIENTE</th>
              <th className="py-3.5 px-4">ÚLTIMO CHECK</th>
              <th className="py-3.5 px-4 text-right">ACCIONES</th>
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
                    status: target.enabled ? (target.last_status || 'up') : 'disabled',
                    latency: target.last_latency,
                  }));

              return (
                <tr
                  key={target.id}
                  onClick={() => onClick(target)}
                  className={`hover:bg-bg-dark/50 cursor-pointer transition-colors ${
                    isSelected ? 'bg-accent-green/5' : ''
                  }`}
                >
                  <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onSelectToggle(target)}
                      className="w-4 h-4 rounded border-border-base text-accent-green focus:ring-accent-green/40 bg-bg-dark cursor-pointer"
                    />
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">{renderStatus(target)}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${typeStyle.bg} border ${typeStyle.border} flex items-center justify-center shrink-0`}>
                        <Icon className={typeStyle.text} size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-text-main text-sm truncate max-w-[200px]" title={target.name}>
                          {target.name}
                        </div>
                        <div className="text-xs text-text-dim font-mono truncate max-w-[260px]" title={target.endpoint}>
                          {target.endpoint}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase font-bold border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>
                      {target.target_type}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-text-muted">
                    {target.interval}s
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap font-mono font-bold text-sm">
                    <span className={getLatencyColor(target.last_latency)}>
                      {target.last_latency !== null ? `${target.last_latency.toFixed(0)}ms` : '-'}
                    </span>
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
                      <button
                        onClick={() => onScan(target)}
                        disabled={scanningId === target.id}
                        className="p-1.5 text-text-muted hover:text-accent-green hover:bg-accent-green/10 rounded transition-colors disabled:opacity-50"
                        title="Escanear ahora"
                      >
                        <RefreshCw size={14} className={scanningId === target.id ? 'animate-spin text-accent-green' : ''} />
                      </button>
                      {onAlert && (
                        <button
                          onClick={() => onAlert(target)}
                          className="p-1.5 text-text-muted hover:text-accent-yellow hover:bg-accent-yellow/10 rounded transition-colors"
                          title="Vincular regla de alerta"
                        >
                          <Bell size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => onEdit(target)}
                        className="p-1.5 text-text-muted hover:text-accent-blue hover:bg-accent-blue/10 rounded transition-colors"
                        title="Editar target"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => onDelete(target)}
                        className="p-1.5 text-text-muted hover:text-accent-red hover:bg-accent-red/10 rounded transition-colors"
                        title="Eliminar target"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
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
