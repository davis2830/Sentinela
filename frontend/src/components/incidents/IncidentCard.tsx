import React from 'react';
import type { Incident } from '../../types/incidents';
import PriorityBadge from '../common/PriorityBadge';
import StatusBadge from '../common/StatusBadge';
import {
  CheckSquare,
  Square,
  Clock,
  Pencil,
  Trash2,
  Bell,
  UserCheck,
  User,
  Globe,
  Lock,
  Activity,
  Plug,
  Shield,
  Server,
  Flame,
} from 'lucide-react';

export interface IncidentCardProps {
  incident: Incident;
  isSelected: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

export default function IncidentCard({
  incident,
  isSelected,
  onToggleSelect,
  onClick,
  onEdit,
  onDelete,
}: IncidentCardProps) {
  const getModuleIcon = (targetType?: string) => {
    switch (targetType) {
      case 'monitoring':
        return <Globe size={13} className="text-emerald-400" />;
      case 'ssl':
        return <Lock size={13} className="text-rose-400" />;
      case 'dns':
        return <Activity size={13} className="text-sky-400" />;
      case 'domain':
        return <Globe size={13} className="text-blue-400" />;
      case 'api_check':
        return <Plug size={13} className="text-amber-400" />;
      case 'security_headers':
        return <Shield size={13} className="text-purple-400" />;
      default:
        return <Server size={13} className="text-text-muted" />;
    }
  };

  const formatDuration = (openedAt: string, closedAt?: string | null, resolvedAt?: string | null) => {
    const start = new Date(openedAt).getTime();
    const end = resolvedAt
      ? new Date(resolvedAt).getTime()
      : closedAt
      ? new Date(closedAt).getTime()
      : Date.now();
    const diffMinutes = Math.max(1, Math.round((end - start) / 60000));
    if (diffMinutes < 60) return `${diffMinutes}m`;
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div
      onClick={onClick}
      className={`bg-bg-card/95 border rounded-2xl p-5 transition-all flex flex-col justify-between group shadow-sm cursor-pointer hover:border-accent-green/50 ${
        isSelected
          ? 'border-accent-green bg-accent-green/[0.03] ring-1 ring-accent-green/40'
          : incident.priority === 'critical' && incident.status !== 'resolved' && incident.status !== 'closed'
          ? 'border-accent-red/50 hover:border-accent-red'
          : 'border-border-base/70'
      }`}
    >
      <div>
        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect();
              }}
              className="text-text-dim hover:text-accent-green transition-colors shrink-0 cursor-pointer"
              title={isSelected ? 'Deseleccionar' : 'Seleccionar'}
            >
              {isSelected ? (
                <CheckSquare size={16} className="text-accent-green" />
              ) : (
                <Square size={16} />
              )}
            </button>
            <PriorityBadge priority={incident.priority} />
            {incident.priority === 'critical' && incident.status !== 'resolved' && incident.status !== 'closed' && (
              <span className="flex items-center gap-1 text-[10px] text-accent-red font-semibold uppercase tracking-wider animate-pulse">
                <Flame size={12} /> Alta Urgencia
              </span>
            )}
          </div>
          <StatusBadge status={incident.status} />
        </div>

        {/* Title & Description */}
        <h3
          className="font-bold text-text-main text-base group-hover:text-accent-green transition-colors line-clamp-2 mb-1.5 font-sans"
          title={incident.title}
        >
          {incident.title}
        </h3>
        <p className="text-xs text-text-muted line-clamp-2 mb-3 font-sans leading-relaxed">
          {incident.description || 'Sin descripción adicional registrada.'}
        </p>

        {/* Impacted Service & Assignee Pills */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {incident.impacted_service && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-bg-dark border border-border-base text-text-main text-xs font-medium">
              {getModuleIcon(incident.target_type)}
              <span className="truncate max-w-[160px]">{incident.impacted_service}</span>
            </span>
          )}

          {incident.assigned_to_name ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-medium">
              <UserCheck size={12} />
              <span className="truncate max-w-[140px]">{incident.assigned_to_name}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-bg-dark border border-border-base text-text-dim text-xs">
              <User size={12} />
              <span>Sin asignar</span>
            </span>
          )}
        </div>

        {/* Metric Summary Box */}
        <div className="space-y-2 text-xs font-mono text-text-muted bg-bg-dark/50 rounded-xl p-3 border border-border-base/40 font-sans">
          <div className="flex justify-between border-b border-border-base/40 pb-1.5">
            <span className="text-text-dim font-medium">Alertas Vinculadas:</span>
            <span className="text-accent-green font-bold flex items-center gap-1 font-mono">
              <Bell size={12} />
              {incident.alerts_count}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-dim font-medium">Duración (MTTR):</span>
            <span className="text-sky-400 font-mono font-semibold">
              {formatDuration(incident.opened_at, incident.closed_at, incident.resolved_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Actions & Timestamp */}
      <div className="mt-4 pt-3 border-t border-border-base/40 flex items-center justify-between text-xs text-text-dim">
        <span className="flex items-center gap-1 font-mono text-[11px]">
          <Clock size={12} />
          {new Date(incident.opened_at).toLocaleDateString('es-ES')}{' '}
          {new Date(incident.opened_at).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors cursor-pointer"
            title="Editar incidente"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors cursor-pointer"
            title="Eliminar incidente"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
