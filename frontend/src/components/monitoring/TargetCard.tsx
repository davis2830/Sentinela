import { Globe, Zap, Lock, Plug, Server, Trash2, Pencil, RefreshCw, Bell } from 'lucide-react';
import type { MonitoringTarget } from '../../types/monitoring';

const typeIcons: Record<string, typeof Globe> = {
  http: Globe,
  https: Globe,
  tcp: Server,
  dns: Globe,
  api: Plug,
  ssl: Lock,
};

const statusColors: Record<string, string> = {
  up: 'bg-accent-green/10 text-accent-green border-accent-green',
  down: 'bg-accent-red/10 text-accent-red border-accent-red',
  slow: 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow',
  error: 'bg-accent-red/10 text-accent-red border-accent-red',
};

interface TargetCardProps {
  target: MonitoringTarget;
  onEdit: (target: MonitoringTarget) => void;
  onDelete: (target: MonitoringTarget) => void;
  onScan: (target: MonitoringTarget) => void;
  onToggle: (target: MonitoringTarget) => void;
  onAlert?: (target: MonitoringTarget) => void;
  isScanning?: boolean;
  onClick: (target: MonitoringTarget) => void;
}

export default function TargetCard({ target, onEdit, onDelete, onScan, onToggle, onAlert, isScanning, onClick }: TargetCardProps) {
  const Icon = typeIcons[target.target_type] || Globe;
  const status = target.last_status || 'unknown';
  const statusClass = statusColors[status] || 'bg-gray-500/10 text-gray-400 border-gray-500';

  return (
    <div
      className="bg-bg-card border border-border-base rounded-xl p-5 cursor-pointer hover:border-accent-green/50 transition-all"
      onClick={() => onClick(target)}
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-lg bg-accent-green/10 flex items-center justify-center shrink-0">
            <Icon className="text-accent-green" size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-text-main truncate" title={target.name}>{target.name}</h3>
            <p className="text-xs text-text-dim font-mono truncate" title={target.endpoint}>{target.endpoint}</p>
            {target.tags && target.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {target.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 bg-bg-dark border border-border-base text-[10px] text-text-muted rounded-md uppercase font-mono"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onScan(target); }}
            disabled={isScanning}
            className="p-1.5 text-accent-green hover:bg-accent-green/10 rounded transition-colors disabled:opacity-50"
            title="Escanear ahora"
          >
            <RefreshCw size={16} className={isScanning ? 'animate-spin' : ''} />
          </button>
          {onAlert && (
            <button
              onClick={(e) => { e.stopPropagation(); onAlert(target); }}
              className="p-1.5 text-text-muted hover:text-accent-yellow transition-colors"
              title="Vincular regla de alerta"
            >
              <Bell size={16} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(target); }}
            className="p-1.5 text-text-muted hover:text-accent-blue transition-colors"
            title="Editar target"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(target); }}
            className="p-1.5 text-text-muted hover:text-accent-red transition-colors"
            title="Eliminar target"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="font-mono uppercase">{target.target_type}</span>
          <span>·</span>
          <span>{target.interval}s</span>
          {target.last_latency !== null && (
            <>
              <span>·</span>
              <span>{target.last_latency.toFixed(0)}ms</span>
            </>
          )}
        </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(target);
            }}
            className={`w-9 h-5 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
              target.enabled ? 'bg-accent-green' : 'bg-bg-dark border border-border-base'
            }`}
            title={target.enabled ? 'Desactivar monitoreo' : 'Activar monitoreo'}
          >
            <div
              className={`w-3 h-3 rounded-full shadow-md transform duration-300 ${
                target.enabled ? 'translate-x-4 bg-black' : 'translate-x-0 bg-text-dim'
              }`}
            ></div>
          </button>
        </div>
      </div>
  );
}