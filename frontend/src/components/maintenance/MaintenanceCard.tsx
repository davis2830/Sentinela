import React from 'react';
import {
  Calendar,
  Clock,
  Wrench,
  Play,
  CheckCircle2,
  XCircle,
  BellOff,
  Shield,
  Repeat,
  ChevronRight,
  Layers,
  Users,
} from 'lucide-react';
import type { MaintenanceWindow } from '../../types';

interface MaintenanceCardProps {
  window: MaintenanceWindow;
  onSelect: (window: MaintenanceWindow) => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  isStarting?: boolean;
  isCompleting?: boolean;
}

export const MaintenanceCard: React.FC<MaintenanceCardProps> = ({
  window: item,
  onSelect,
  onStart,
  onComplete,
  isStarting,
  isCompleting,
}) => {
  const startDate = new Date(item.start_time);
  const endDate = new Date(item.end_time);
  const now = new Date();
  const isRunning = item.status === 'in_progress';
  const isInsideWindow = now >= startDate && now <= endDate;

  // Helper for dynamic countdown or time status
  const getTimeStatus = () => {
    if (item.status === 'completed') return { label: 'Completado', color: 'text-accent-green' };
    if (item.status === 'cancelled') return { label: 'Cancelado', color: 'text-accent-red' };

    if (isRunning) {
      const diffMinutes = Math.max(0, Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60)));
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      return {
        label: hours > 0 ? `En curso (restan ${hours}h ${mins}m)` : `En curso (restan ${mins}m)`,
        color: 'text-accent-yellow font-bold',
      };
    }

    // Scheduled
    if (isInsideWindow) {
      const diffMinutes = Math.max(0, Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60)));
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      return {
        label: hours > 0 ? `En horario (restan ${hours}h ${mins}m)` : `En horario (restan ${mins}m)`,
        color: 'text-sky-400 font-semibold',
      };
    }

    const diffHours = Math.floor((startDate.getTime() - now.getTime()) / (1000 * 60 * 60));
    if (diffHours < 0) return { label: 'Horario expirado', color: 'text-text-dim' };
    if (diffHours < 24) return { label: `Inicia en ${diffHours}h`, color: 'text-accent-blue' };
    const diffDays = Math.floor(diffHours / 24);
    return { label: `Inicia en ${diffDays} día${diffDays > 1 ? 's' : ''}`, color: 'text-text-muted' };
  };

  const timeStatus = getTimeStatus();

  return (
    <div
      onClick={() => onSelect(item)}
      className={`bg-bg-card border rounded-2xl p-5 transition-all duration-200 cursor-pointer group flex flex-col justify-between relative overflow-hidden ${
        isRunning
          ? 'border-accent-yellow/40 hover:border-accent-yellow/60 shadow-lg shadow-accent-yellow/5'
          : isInsideWindow && item.status === 'scheduled'
          ? 'border-sky-500/40 hover:border-sky-500/60 shadow-lg shadow-sky-500/5'
          : 'border-border-base hover:border-border-accent hover:bg-bg-card-hover'
      }`}
    >
      {/* Halo pulsante para mantenimientos en curso */}
      {isRunning && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent-yellow via-accent-yellow-glow to-accent-yellow animate-pulse" />
      )}
      {isInsideWindow && item.status === 'scheduled' && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 via-sky-300 to-sky-400 opacity-75" />
      )}

      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${
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
              {isRunning && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent-yellow animate-ping" />
              )}
              {item.status === 'scheduled' && isInsideWindow && (
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              )}
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

            {item.recurrence && item.recurrence !== 'none' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-bg-dark text-text-dim border border-border-base flex items-center gap-1">
                <Repeat size={10} className="text-accent-blue" />
                {item.recurrence === 'weekly' ? 'Semanal' : item.recurrence === 'biweekly' ? 'Quincenal' : 'Mensual'}
              </span>
            )}
          </div>

          <div className={`text-xs font-mono ${timeStatus.color}`}>
            {timeStatus.label}
          </div>
        </div>

        {/* Title and Description */}
        <h3 className="text-base font-bold text-text-main group-hover:text-accent-green transition-colors line-clamp-1 mb-1">
          {item.title}
        </h3>
        <p className="text-xs text-text-dim line-clamp-2 mb-4 leading-relaxed">
          {item.description || 'Sin descripción adicional para este mantenimiento.'}
        </p>

        {/* Fechas y Horas */}
        <div className="p-3 bg-bg-dark/70 border border-border-base/70 rounded-xl space-y-1.5 mb-4 text-xs font-mono">
          <div className="flex items-center justify-between text-text-muted">
            <span className="flex items-center gap-1.5 text-text-dim">
              <Calendar size={13} className="text-accent-blue" /> Inicio:
            </span>
            <span className="text-text-main">{startDate.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
          </div>
          <div className="flex items-center justify-between text-text-muted">
            <span className="flex items-center gap-1.5 text-text-dim">
              <Clock size={13} className="text-accent-yellow" /> Fin:
            </span>
            <span className="text-text-main">{endDate.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
          </div>
        </div>

        {/* Targets Asignados */}
        <div className="space-y-1.5 mb-4">
          <div className="text-[10px] font-mono text-text-dim uppercase tracking-wider flex items-center gap-1">
            <Layers size={11} /> Targets Cubiertos ({item.targets?.length || 0}):
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-16 overflow-hidden">
            {item.targets?.length > 0 ? (
              item.targets.slice(0, 3).map((t, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-bg-dark border border-border-base text-[11px] font-mono text-text-muted truncate max-w-[200px]"
                >
                  {t.target_type === 'all' ? 'Toda la Organización' : t.target_name || t.target_type}
                </span>
              ))
            ) : (
              <span className="text-[11px] text-text-dim italic">Sin targets asignados</span>
            )}
            {item.targets?.length > 3 && (
              <span className="px-1.5 py-0.5 rounded-md bg-bg-dark border border-border-base text-[10px] font-mono text-text-dim">
                +{item.targets.length - 3} más
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer Details & Action Controls */}
      <div className="pt-3 border-t border-border-base/70 flex items-center justify-between gap-2">
        {/* Badges de Supresión & Equipo */}
        <div className="flex items-center gap-2 text-xs">
          {item.suppress_notifications && (
            <span title="Alertas silenciadas" className="text-text-dim hover:text-accent-yellow transition-colors">
              <BellOff size={14} />
            </span>
          )}
          {item.exclude_from_sla && (
            <span title="Excluido de SLA" className="text-text-dim hover:text-accent-green transition-colors">
              <Shield size={14} />
            </span>
          )}
          {item.responsible_team_name && (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 bg-bg-dark border border-border-base text-text-muted"
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: item.responsible_team_color || '#3B82F6' }}
              />
              {item.responsible_team_name}
            </span>
          )}
        </div>

        {/* Acciones Rápidas */}
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {item.status === 'scheduled' && (
            <button
              type="button"
              disabled={isStarting}
              onClick={() => onStart(item.id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                isInsideWindow
                  ? 'bg-sky-500 text-black hover:bg-sky-400 shadow-sm shadow-sky-500/20'
                  : 'bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/25 border border-accent-blue/30'
              }`}
            >
              <Play size={11} /> {isInsideWindow ? 'Iniciar Ahora' : 'Iniciar'}
            </button>
          )}

          {item.status === 'in_progress' && (
            <button
              type="button"
              disabled={isCompleting}
              onClick={() => onComplete(item.id)}
              className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-accent-green text-black hover:bg-accent-green/90 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <CheckCircle2 size={11} /> Finalizar
            </button>
          )}

          <button
            type="button"
            onClick={() => onSelect(item)}
            className="p-1.5 rounded-lg bg-bg-dark hover:bg-bg-card text-text-dim hover:text-text-main border border-border-base transition-colors cursor-pointer"
            title="Ver detalles"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
