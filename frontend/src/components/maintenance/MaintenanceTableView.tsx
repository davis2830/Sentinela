import React from 'react';
import {
  Calendar,
  Clock,
  Wrench,
  Play,
  CheckCircle2,
  BellOff,
  Shield,
  ChevronRight,
  Repeat,
} from 'lucide-react';
import type { MaintenanceWindow } from '../../types';

interface MaintenanceTableViewProps {
  windows: MaintenanceWindow[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onSelect: (window: MaintenanceWindow) => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
}

export const MaintenanceTableView: React.FC<MaintenanceTableViewProps> = ({
  windows,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onSelect,
  onStart,
  onComplete,
}) => {
  const allSelected = windows.length > 0 && selectedIds.size === windows.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div className="bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-bg-dark/80 text-text-dim border-b border-border-base font-mono uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-3 px-4 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={onSelectAll}
                  className="rounded border-border-base bg-bg-dark text-accent-green focus:ring-0 cursor-pointer"
                />
              </th>
              <th className="py-3 px-4">Ventana de Mantenimiento</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4">Horario & Duración</th>
              <th className="py-3 px-4">Targets Cubiertos</th>
              <th className="py-3 px-4">Cuadrilla</th>
              <th className="py-3 px-4">Supresión</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base/50">
            {windows.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const startDate = new Date(item.start_time);
              const endDate = new Date(item.end_time);
              const now = new Date();
              const isRunning = item.status === 'in_progress';
              const isInsideWindow = now >= startDate && now <= endDate;

              return (
                <tr
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className={`hover:bg-bg-card-hover transition-colors cursor-pointer ${
                    isSelected ? 'bg-accent-green/5' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <td
                    className="py-3 px-4 text-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(item.id);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(item.id)}
                      className="rounded border-border-base bg-bg-dark text-accent-green focus:ring-0 cursor-pointer"
                    />
                  </td>

                  {/* Title & Desc */}
                  <td className="py-3 px-4 max-w-xs">
                    <div className="font-bold text-text-main hover:text-accent-green transition-colors truncate">
                      {item.title}
                    </div>
                    {item.description && (
                      <div className="text-[11px] text-text-dim truncate mt-0.5">
                        {item.description}
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1.5 ${
                        isRunning
                          ? 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30'
                          : item.status === 'scheduled' && isInsideWindow
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                          : item.status === 'completed'
                          ? 'bg-accent-green/10 text-accent-green border-accent-green/30'
                          : item.status === 'cancelled'
                          ? 'bg-accent-red/10 text-accent-red border-accent-red/30'
                          : 'bg-accent-blue/10 text-accent-blue border-accent-blue/30'
                      }`}
                    >
                      {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-accent-yellow animate-ping" />}
                      {item.status === 'scheduled' && isInsideWindow && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
                      {isRunning
                        ? 'En Curso'
                        : item.status === 'scheduled' && isInsideWindow
                        ? 'En Horario'
                        : item.status === 'completed'
                        ? 'Completado'
                        : item.status === 'cancelled'
                        ? 'Cancelado'
                        : 'Programado'}
                    </span>
                  </td>

                  {/* Schedule */}
                  <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-text-muted">
                    <div className="text-text-main flex items-center gap-1">
                      <Calendar size={11} className="text-accent-blue" />
                      {startDate.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                    <div className="text-[11px] text-text-dim flex items-center gap-1 mt-0.5">
                      <Clock size={11} className="text-accent-yellow" />
                      {item.duration_minutes > 60
                        ? `${Math.floor(item.duration_minutes / 60)}h ${item.duration_minutes % 60}m`
                        : `${item.duration_minutes}m`}
                      {item.recurrence && item.recurrence !== 'none' && (
                        <span className="text-accent-blue flex items-center gap-0.5 ml-1">
                          <Repeat size={10} /> {item.recurrence}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Targets */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 flex-wrap max-w-xs">
                      {item.targets?.length > 0 ? (
                        <>
                          <span className="px-2 py-0.5 rounded-md bg-bg-dark border border-border-base text-[11px] font-mono text-text-muted truncate max-w-[150px]">
                            {item.targets[0].target_type === 'all'
                              ? 'Toda la Organización'
                              : item.targets[0].target_name || item.targets[0].target_type}
                          </span>
                          {item.targets.length > 1 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-bg-dark border border-border-base text-[10px] font-mono text-text-dim">
                              +{item.targets.length - 1} más
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[11px] text-text-dim italic">Global</span>
                      )}
                    </div>
                  </td>

                  {/* Team */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {item.responsible_team_name ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 bg-bg-dark border border-border-base text-text-muted w-fit">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: item.responsible_team_color || '#3B82F6' }}
                        />
                        {item.responsible_team_name}
                      </span>
                    ) : (
                      <span className="text-text-dim text-[11px]">—</span>
                    )}
                  </td>

                  {/* Suppression */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {item.suppress_notifications ? (
                        <span title="Alertas Silenciadas" className="text-accent-yellow">
                          <BellOff size={14} />
                        </span>
                      ) : (
                        <span className="text-text-dim opacity-40">
                          <BellOff size={14} />
                        </span>
                      )}
                      {item.exclude_from_sla ? (
                        <span title="Excluido de SLA" className="text-accent-green">
                          <Shield size={14} />
                        </span>
                      ) : (
                        <span className="text-text-dim opacity-40">
                          <Shield size={14} />
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Quick Actions */}
                  <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {item.status === 'scheduled' && (
                        <button
                          type="button"
                          onClick={() => onStart(item.id)}
                          className="px-2 py-1 rounded-full text-[10px] font-bold bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/25 border border-accent-blue/30 transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Play size={10} /> Iniciar
                        </button>
                      )}

                      {item.status === 'in_progress' && (
                        <button
                          type="button"
                          onClick={() => onComplete(item.id)}
                          className="px-2 py-1 rounded-full text-[10px] font-bold bg-accent-green text-black hover:bg-accent-green/90 transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 size={10} /> Finalizar
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onSelect(item)}
                        className="p-1.5 rounded-lg bg-bg-dark hover:bg-bg-card-hover border border-border-base text-text-dim hover:text-text-main transition-colors cursor-pointer"
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
};
