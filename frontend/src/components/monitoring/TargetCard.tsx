import { Globe, Zap, Lock, Plug, Server, Trash2, Pencil, RefreshCw, Bell, Activity } from 'lucide-react';
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

interface TargetCardProps {
  target: MonitoringTarget;
  onEdit: (target: MonitoringTarget) => void;
  onDelete: (target: MonitoringTarget) => void;
  onScan: (target: MonitoringTarget) => void;
  onToggle: (target: MonitoringTarget) => void;
  onAlert?: (target: MonitoringTarget) => void;
  isScanning?: boolean;
  onClick: (target: MonitoringTarget) => void;
  isSelected?: boolean;
  onSelectToggle?: (target: MonitoringTarget) => void;
}

export default function TargetCard({
  target,
  onEdit,
  onDelete,
  onScan,
  onToggle,
  onAlert,
  isScanning,
  onClick,
  isSelected = false,
  onSelectToggle,
}: TargetCardProps) {
  const Icon = typeIcons[target.target_type] || Globe;
  const status = target.last_status || 'unknown';
  const typeStyle = typeColors[target.target_type] || {
    bg: 'bg-accent-green/10',
    text: 'text-accent-green',
    border: 'border-accent-green/30',
  };

  // Latency styling
  const getLatencyColor = (ms: number | null) => {
    if (ms === null) return 'text-text-dim';
    if (ms < 100) return 'text-emerald-400';
    if (ms < 400) return 'text-sky-300';
    if (ms < 1000) return 'text-amber-400';
    return 'text-rose-400';
  };

  // Status badge with pulsing dot
  const renderStatusIndicator = () => {
    if (!target.enabled) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
          PAUSADO
        </span>
      );
    }

    if (status === 'up') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          ONLINE
        </span>
      );
    }

    if (status === 'slow') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          LENTO
        </span>
      );
    }

    if (status === 'down' || status === 'error') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
          CAÍDO
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
        DESCONOCIDO
      </span>
    );
  };

  // Generate 20 blocks for the mini uptime sparkline
  const recentChecks = target.recent_checks && target.recent_checks.length > 0
    ? target.recent_checks
    : Array.from({ length: 16 }).map((_, i) => ({
        status: target.enabled ? (status === 'up' ? 'up' : (status === 'slow' ? 'slow' : 'down')) : 'disabled',
        latency: target.last_latency,
        checked_at: new Date(Date.now() - (15 - i) * (target.interval || 60) * 1000).toISOString(),
      }));

  return (
    <div
      className={`group relative bg-bg-card border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-lg ${
        isSelected
          ? 'border-accent-green bg-accent-green/5 ring-1 ring-accent-green/50'
          : 'border-border-base hover:border-accent-green/40 hover:bg-bg-card/90'
      }`}
      onClick={() => onClick(target)}
    >
      {/* Top row: Checkbox, Icon, Title, Status & Actions */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Checkbox for bulk actions */}
          {onSelectToggle && (
            <div
              className="pt-1"
              onClick={(e) => {
                e.stopPropagation();
                onSelectToggle(target);
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}}
                className="w-4 h-4 rounded border-border-base text-accent-green focus:ring-accent-green/40 bg-bg-dark cursor-pointer"
              />
            </div>
          )}

          {/* Type Icon */}
          <div className={`w-9 h-9 rounded-lg ${typeStyle.bg} border ${typeStyle.border} flex items-center justify-center shrink-0`}>
            <Icon className={typeStyle.text} size={18} />
          </div>

          {/* Name & Endpoint */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-text-main text-sm truncate max-w-[180px]" title={target.name}>
                {target.name}
              </h3>
              {renderStatusIndicator()}
            </div>
            <p className="text-xs text-text-dim font-mono truncate mt-0.5" title={target.endpoint}>
              {target.endpoint}
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-0.5 shrink-0 bg-bg-dark/60 p-1 rounded-lg border border-border-base/50">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onScan(target);
            }}
            disabled={isScanning}
            className="p-1.5 text-text-muted hover:text-accent-green hover:bg-accent-green/10 rounded transition-colors disabled:opacity-50"
            title="Escanear ahora"
          >
            <RefreshCw size={14} className={isScanning ? 'animate-spin text-accent-green' : ''} />
          </button>
          {onAlert && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAlert(target);
              }}
              className="p-1.5 text-text-muted hover:text-accent-yellow hover:bg-accent-yellow/10 rounded transition-colors"
              title="Vincular regla de alerta"
            >
              <Bell size={14} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(target);
            }}
            className="p-1.5 text-text-muted hover:text-accent-blue hover:bg-accent-blue/10 rounded transition-colors"
            title="Editar target"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(target);
            }}
            className="p-1.5 text-text-muted hover:text-accent-red hover:bg-accent-red/10 rounded transition-colors"
            title="Eliminar target"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Tags row */}
      {target.tags && target.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {target.tags.map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 bg-bg-dark border border-border-base text-[10px] text-text-muted rounded uppercase font-mono"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Mini Uptime Sparkline / Blocks Bar */}
      <div className="mb-3 pt-2 border-t border-border-base/40">
        <div className="flex items-center justify-between text-[10px] text-text-dim font-mono mb-1.5">
          <span className="flex items-center gap-1">
            <Activity size={10} className="text-accent-green" /> Disponibilidad Reciente
          </span>
          <span className={getLatencyColor(target.last_latency)}>
            {target.last_latency !== null ? `${target.last_latency.toFixed(0)}ms` : 'Sin datos'}
          </span>
        </div>
        <div className="flex items-center gap-1 h-2 w-full">
          {recentChecks.slice(-18).map((c, idx) => {
            let bgClass = 'bg-zinc-700';
            if (c.status === 'up') bgClass = 'bg-emerald-500 hover:bg-emerald-400';
            else if (c.status === 'slow') bgClass = 'bg-amber-400 hover:bg-amber-300';
            else if (c.status === 'down' || c.status === 'error') bgClass = 'bg-rose-500 hover:bg-rose-400';

            return (
              <div
                key={idx}
                className={`flex-1 h-full rounded-xs transition-transform hover:scale-125 cursor-pointer ${bgClass}`}
                title={`Check ${idx + 1}: ${c.status.toUpperCase()} ${c.latency ? `(${c.latency.toFixed(0)}ms)` : ''}`}
              />
            );
          })}
        </div>
      </div>

      {/* Bottom row: Protocol, Interval, Latency & Switch */}
      <div className="flex items-center justify-between pt-1 text-xs">
        <div className="flex items-center gap-2 font-mono">
          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>
            {target.target_type}
          </span>
          <span className="text-text-dim text-[11px]">cada {target.interval}s</span>
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
          />
        </button>
      </div>
    </div>
  );
}