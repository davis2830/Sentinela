import React from 'react';
import type { ScheduledMaintenanceItem } from '../../types/status_page';
import StatusBadge from '../common/StatusBadge';
import {
  CheckSquare,
  Square,
  MinusSquare,
  Calendar,
  Clock,
  Pencil,
  Trash2,
  MessageSquarePlus,
  Flame,
  CheckCircle2,
  XCircle,
  Activity,
} from 'lucide-react';

export interface MaintenanceTableViewProps {
  maintenances: ScheduledMaintenanceItem[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onAddUpdate: (maintenance: ScheduledMaintenanceItem) => void;
  onEdit: (maintenance: ScheduledMaintenanceItem) => void;
  onDelete: (maintenance: ScheduledMaintenanceItem) => void;
}

export default function MaintenanceTableView({
  maintenances,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onAddUpdate,
  onEdit,
  onDelete,
}: MaintenanceTableViewProps) {
  const allSelected = maintenances.length > 0 && selectedIds.length === maintenances.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < maintenances.length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Activity size={12} className="animate-spin text-amber-400" />
            En Progreso
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-green/10 text-accent-green border border-accent-green/30">
            <CheckCircle2 size={12} />
            Completado
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-bg-dark text-text-dim border border-border-base">
            <XCircle size={12} />
            Cancelado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30">
            <Calendar size={12} />
            Programado
          </span>
        );
    }
  };

  if (maintenances.length === 0) {
    return (
      <div className="bg-bg-card border border-border-base/70 rounded-2xl p-10 text-center font-sans">
        <Calendar size={32} className="text-text-dim mx-auto mb-2 opacity-50" />
        <p className="text-text-muted text-sm">No hay mantenimientos planificados o registrados.</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-card/95 border border-border-base/70 rounded-2xl overflow-hidden shadow-sm font-sans">
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
              <th className="py-3 px-4 w-36">Estado</th>
              <th className="py-3 px-4 min-w-[240px]">Mantenimiento & Impacto</th>
              <th className="py-3 px-4 w-48">Ventana Horaria</th>
              <th className="py-3 px-4 w-28 text-center">Avances</th>
              <th className="py-3 px-4 w-32 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base/30 text-xs">
            {maintenances.map((m) => {
              const isSelected = selectedIds.includes(m.id);
              const updatesCount = m.updates?.length || 0;

              return (
                <tr
                  key={m.id}
                  className={`group transition-colors ${
                    isSelected
                      ? 'bg-accent-green/[0.04] hover:bg-accent-green/[0.07]'
                      : 'hover:bg-bg-card-hover/70'
                  }`}
                >
                  {/* Select Checkbox */}
                  <td
                    className="py-3 px-4 text-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(m.id);
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

                  {/* Status */}
                  <td className="py-3 px-4">{getStatusBadge(m.status)}</td>

                  {/* Title & Description */}
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-text-main group-hover:text-accent-green transition-colors">
                        {m.title}
                      </span>
                      <p className="text-text-muted text-[11px] line-clamp-1">
                        {m.description || 'Sin detalles adicionales.'}
                      </p>
                    </div>
                  </td>

                  {/* Schedule Dates */}
                  <td className="py-3 px-4 font-mono text-[11px] text-text-dim">
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1 text-text-main">
                        <Clock size={11} className="text-accent-yellow" />
                        {new Date(m.start_time).toLocaleString('es-ES', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="text-[10px] text-text-dim">
                        hasta{' '}
                        {new Date(m.end_time).toLocaleString('es-ES', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </td>

                  {/* Live Updates Count */}
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded-full border ${
                        updatesCount > 0
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                          : 'bg-bg-dark text-text-dim border-border-base'
                      }`}
                    >
                      {updatesCount} notas
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onAddUpdate(m)}
                        className="p-1.5 text-text-dim hover:text-purple-400 hover:bg-purple-500/10 rounded-full transition-colors cursor-pointer"
                        title="Publicar nota de avance"
                      >
                        <MessageSquarePlus size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(m)}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors cursor-pointer"
                        title="Editar mantenimiento"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(m)}
                        className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors cursor-pointer"
                        title="Eliminar mantenimiento"
                      >
                        <Trash2 size={14} />
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
