import React from 'react';
import type { Incident } from '../../types/incidents';
import PriorityBadge from '../common/PriorityBadge';
import StatusBadge from '../common/StatusBadge';
import {
  CheckSquare,
  Square,
  MinusSquare,
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
  ChevronRight,
} from 'lucide-react';

export interface IncidentTableViewProps {
  incidents: Incident[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onRowClick: (incident: Incident) => void;
  onEdit: (e: React.MouseEvent, incident: Incident) => void;
  onDelete: (e: React.MouseEvent, incident: Incident) => void;
}

export default function IncidentTableView({
  incidents,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onRowClick,
  onEdit,
  onDelete,
}: IncidentTableViewProps) {
  const allSelected = incidents.length > 0 && selectedIds.length === incidents.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < incidents.length;

  const getModuleIcon = (targetType?: string) => {
    switch (targetType) {
      case 'monitoring':
        return <Globe size={13} className="text-emerald-400 shrink-0" />;
      case 'ssl':
        return <Lock size={13} className="text-rose-400 shrink-0" />;
      case 'dns':
        return <Activity size={13} className="text-sky-400 shrink-0" />;
      case 'domain':
        return <Globe size={13} className="text-blue-400 shrink-0" />;
      case 'api_check':
        return <Plug size={13} className="text-amber-400 shrink-0" />;
      case 'security_headers':
        return <Shield size={13} className="text-purple-400 shrink-0" />;
      default:
        return <Server size={13} className="text-text-muted shrink-0" />;
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

  if (incidents.length === 0) {
    return (
      <div className="bg-bg-card border border-border-base/70 rounded-2xl p-12 text-center">
        <p className="text-text-muted text-sm">No se encontraron incidentes con los filtros actuales.</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-card/95 border border-border-base/70 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-bg-dark/90 border-b border-border-base/60 text-[11px] font-semibold text-text-dim tracking-wider select-none">
              <th className="py-3 px-4 w-10 text-center">
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="text-text-dim hover:text-accent-green transition-colors cursor-pointer"
                  title={allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                >
                  {allSelected ? (
                    <CheckSquare size={16} className="text-accent-green" />
                  ) : someSelected ? (
                    <MinusSquare size={16} className="text-accent-green" />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
              </th>
              <th className="py-3 px-4 w-28">Prioridad</th>
              <th className="py-3 px-4 min-w-[260px]">Incidente / Servicio Afectado</th>
              <th className="py-3 px-4 w-32">Estado</th>
              <th className="py-3 px-4 w-44">Responsable</th>
              <th className="py-3 px-4 w-28 text-center">Alertas</th>
              <th className="py-3 px-4 w-32">Duración (MTTR)</th>
              <th className="py-3 px-4 w-36">Apertura</th>
              <th className="py-3 px-4 w-24 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base/30 text-xs">
            {incidents.map((incident) => {
              const isSelected = selectedIds.includes(incident.id);
              const isCriticalActive =
                incident.priority === 'critical' &&
                incident.status !== 'resolved' &&
                incident.status !== 'closed';

              return (
                <tr
                  key={incident.id}
                  onClick={() => onRowClick(incident)}
                  className={`group transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-accent-green/[0.04] hover:bg-accent-green/[0.07]'
                      : isCriticalActive
                      ? 'bg-accent-red/[0.02] hover:bg-bg-card-hover/90'
                      : 'hover:bg-bg-card-hover/70'
                  }`}
                >
                  {/* Select Checkbox */}
                  <td
                    className="py-3 px-4 text-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(incident.id);
                    }}
                  >
                    <button
                      type="button"
                      className="text-text-dim hover:text-accent-green transition-colors cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare size={16} className="text-accent-green" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </td>

                  {/* Priority */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <PriorityBadge priority={incident.priority} />
                      {isCriticalActive && (
                        <span title="Alta Urgencia" className="text-accent-red animate-pulse">
                          <Flame size={13} />
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Title, Description & Impacted Service */}
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text-main group-hover:text-accent-green transition-colors line-clamp-1 font-sans">
                          {incident.title}
                        </span>
                      </div>
                      {incident.description && (
                        <p className="text-text-muted text-[11px] line-clamp-1 font-sans">
                          {incident.description}
                        </p>
                      )}
                      {incident.impacted_service && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-bg-dark border border-border-base text-text-main text-[10px] font-medium">
                            {getModuleIcon(incident.target_type)}
                            <span className="truncate max-w-[200px]">{incident.impacted_service}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4">
                    <StatusBadge status={incident.status} />
                  </td>

                  {/* Assignee */}
                  <td className="py-3 px-4">
                    {incident.assigned_to_name ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-medium">
                        <UserCheck size={12} className="shrink-0" />
                        <span className="truncate max-w-[120px]">{incident.assigned_to_name}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bg-dark/80 border border-border-base text-text-dim text-xs">
                        <User size={12} className="shrink-0" />
                        <span>Sin asignar</span>
                      </span>
                    )}
                  </td>

                  {/* Linked Alerts Count */}
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-bg-dark border border-border-base text-accent-green">
                      <Bell size={11} />
                      {incident.alerts_count}
                    </span>
                  </td>

                  {/* Duration / MTTR */}
                  <td className="py-3 px-4 font-mono text-xs text-sky-400 font-semibold">
                    {formatDuration(incident.opened_at, incident.closed_at, incident.resolved_at)}
                  </td>

                  {/* Opened At */}
                  <td className="py-3 px-4 font-mono text-[11px] text-text-dim whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock size={11} className="shrink-0" />
                      <span>
                        {new Date(incident.opened_at).toLocaleDateString('es-ES')}{' '}
                        {new Date(incident.opened_at).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td
                    className="py-3 px-4 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={(e) => onEdit(e, incident)}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors cursor-pointer"
                        title="Editar incidente"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => onDelete(e, incident)}
                        className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors cursor-pointer"
                        title="Eliminar incidente"
                      >
                        <Trash2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRowClick(incident)}
                        className="p-1.5 text-text-dim hover:text-text-main rounded-full transition-colors cursor-pointer"
                        title="Ver detalles"
                      >
                        <ChevronRight size={14} />
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
