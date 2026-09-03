import React from 'react';
import type { APICheckTarget } from '../../types/api_checks';
import StatusBadge from '../common/StatusBadge';
import {
  Clock,
  Pencil,
  Trash2,
  RefreshCw,
  ExternalLink,
  CheckSquare,
  Square,
  Radio,
} from 'lucide-react';

export interface APICheckCardProps {
  target: APICheckTarget;
  isSelected: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
  onScan: (e: React.MouseEvent) => void;
  isScanning: boolean;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

export default function APICheckCard({
  target,
  isSelected,
  onToggleSelect,
  onClick,
  onScan,
  isScanning,
  onEdit,
  onDelete,
}: APICheckCardProps) {
  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'POST':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'PUT':
      case 'PATCH':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'DELETE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  const isUp = target.enabled && target.last_status === 'pass';

  return (
    <div
      onClick={onClick}
      className={`bg-bg-card/95 border rounded-2xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between cursor-pointer group shadow-sm relative ${
        isSelected
          ? 'border-accent-green bg-accent-green/[0.02] ring-1 ring-accent-green/40'
          : 'border-border-base/70'
      }`}
    >
      <div>
        {/* Top bar: Checkbox + Method + Name + Radar & Status */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            {/* Selection Checkbox */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect();
              }}
              className="text-text-dim hover:text-accent-green transition-colors shrink-0"
              title={isSelected ? 'Deseleccionar' : 'Seleccionar'}
            >
              {isSelected ? (
                <CheckSquare size={16} className="text-accent-green" />
              ) : (
                <Square size={16} />
              )}
            </button>

            {/* Method Badge */}
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border shrink-0 ${getMethodBadgeClass(
                target.method
              )}`}
            >
              {target.method}
            </span>

            {/* Name */}
            <h3
              className="font-bold text-text-main truncate text-base group-hover:text-accent-green transition-colors font-sans"
              title={target.name}
            >
              {target.name}
            </h3>
          </div>

          {/* Status & Live Radar */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isUp && (
              <span className="relative flex h-2 w-2 mr-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            )}
            <StatusBadge status={target.last_status || 'desconocido'} />
          </div>
        </div>

        {/* Endpoint URL with external link */}
        <div className="flex items-center gap-1 text-xs font-mono text-text-dim truncate mb-4">
          <span className="truncate" title={target.url}>
            {target.url}
          </span>
          <a
            href={target.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-text-dim hover:text-accent-green shrink-0 ml-0.5"
            title="Abrir URL"
          >
            <ExternalLink size={12} />
          </a>
        </div>

        {/* Key Metrics Grid */}
        <div className="space-y-2 text-xs font-mono text-text-muted bg-bg-dark/50 rounded-xl p-3 border border-border-base/40">
          <div className="flex justify-between border-b border-border-base/40 pb-1.5 font-sans">
            <span className="text-text-dim font-medium">Status Esperado:</span>
            <span className="text-accent-green font-bold font-mono">
              {target.expected_status}
            </span>
          </div>
          <div className="flex justify-between border-b border-border-base/40 pb-1.5 font-sans">
            <span className="text-text-dim font-medium">Max Latencia:</span>
            <span className="text-text-main font-semibold font-mono">
              {target.expected_response_time_ms} ms
            </span>
          </div>
          <div className="flex justify-between font-sans">
            <span className="text-text-dim font-medium">Frecuencia:</span>
            <span className="text-sky-400 font-semibold font-mono">
              Cada {target.check_interval || 60}s
            </span>
          </div>
        </div>
      </div>

      {/* Footer: Last checked time + Actions */}
      <div className="mt-4 pt-3 border-t border-border-base/40 flex items-center justify-between text-xs text-text-dim">
        <span className="flex items-center gap-1 font-mono text-[11px]">
          <Clock size={12} />
          {target.last_checked_at
            ? new Date(target.last_checked_at).toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Nunca'}
        </span>

        <div className="flex items-center gap-1">
          {/* Instant scan button */}
          <button
            type="button"
            onClick={onScan}
            disabled={isScanning}
            className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors disabled:opacity-50"
            title="Escanear endpoint ahora"
          >
            <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors"
            title="Editar target"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors"
            title="Eliminar target"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
