import React from 'react';
import type { IncidentTimelineEvent } from '../../types/incidents';
import {
  PlusCircle,
  RefreshCw,
  Bell,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  FileText,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

interface TimelineViewProps {
  events: IncidentTimelineEvent[];
}

export default function TimelineView({ events }: TimelineViewProps) {
  if (!events || events.length === 0) {
    return (
      <div className="py-8 text-center text-text-dim font-mono text-xs bg-bg-dark/40 rounded-2xl border border-border-base/40">
        No hay eventos registrados en la línea de tiempo.
      </div>
    );
  }

  const getEventMeta = (type: string) => {
    switch (type) {
      case 'created':
        return {
          icon: <PlusCircle size={15} className="text-accent-blue" />,
          label: 'Incidente Creado',
          badgeClass: 'bg-accent-blue/10 text-accent-blue border-accent-blue/30',
        };
      case 'status_changed':
        return {
          icon: <RefreshCw size={15} className="text-accent-yellow" />,
          label: 'Cambio de Estado',
          badgeClass: 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30',
        };
      case 'priority_changed':
        return {
          icon: <AlertTriangle size={15} className="text-accent-red" />,
          label: 'Cambio de Prioridad',
          badgeClass: 'bg-accent-red/10 text-accent-red border-accent-red/30',
        };
      case 'assigned':
        return {
          icon: <UserCheck size={15} className="text-sky-400" />,
          label: 'Asignación de Responsable',
          badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
        };
      case 'rca_updated':
        return {
          icon: <FileText size={15} className="text-purple-400" />,
          label: 'Análisis Causa Raíz (RCA)',
          badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
        };
      case 'mitigated':
        return {
          icon: <ShieldCheck size={15} className="text-teal-400" />,
          label: 'Mitigación Confirmada',
          badgeClass: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
        };
      case 'alert_added':
        return {
          icon: <Bell size={15} className="text-rose-400" />,
          label: 'Alerta Vinculada',
          badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        };
      case 'note_added':
        return {
          icon: <MessageSquare size={15} className="text-accent-green" />,
          label: 'Nota de Bitácora',
          badgeClass: 'bg-accent-green/10 text-accent-green border-accent-green/30',
        };
      case 'resolved':
        return {
          icon: <CheckCircle2 size={15} className="text-accent-green" />,
          label: 'Incidente Resuelto',
          badgeClass: 'bg-accent-green/15 text-accent-green border-accent-green/40',
        };
      case 'closed':
        return {
          icon: <XCircle size={15} className="text-text-dim" />,
          label: 'Incidente Cerrado',
          badgeClass: 'bg-bg-dark text-text-dim border-border-base',
        };
      default:
        return {
          icon: <Clock size={15} className="text-text-muted" />,
          label: type.replace('_', ' '),
          badgeClass: 'bg-bg-dark text-text-muted border-border-base',
        };
    }
  };

  return (
    <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border-base/70">
      {events.map((event) => {
        const meta = getEventMeta(event.event_type);
        return (
          <div key={event.id} className="relative group">
            {/* Dot Icon Node */}
            <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-bg-card border border-border-base flex items-center justify-center shrink-0 ring-2 ring-bg-dark">
              {meta.icon}
            </div>

            {/* Event Card */}
            <div className="bg-bg-dark/80 border border-border-base/70 rounded-2xl p-3.5 hover:border-border-accent transition-colors shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold tracking-wide ${meta.badgeClass}`}
                  >
                    {meta.label}
                  </span>
                  {event.actor_name && (
                    <span className="text-[11px] text-text-dim font-sans">
                      por <strong className="text-text-muted font-medium">{event.actor_name}</strong>
                    </span>
                  )}
                </div>

                <span className="flex items-center gap-1 font-mono text-[11px] text-text-dim">
                  <Clock size={11} />
                  {new Date(event.occurred_at).toLocaleDateString('es-ES')}{' '}
                  {new Date(event.occurred_at).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <p className="text-xs text-text-muted font-sans leading-relaxed whitespace-pre-wrap">
                {event.description}
              </p>

              {(event.old_value || event.new_value) && (
                <div className="mt-2 text-[11px] font-mono flex items-center gap-2 text-text-dim bg-bg-card/70 px-2.5 py-1.5 rounded-xl border border-border-base/40">
                  {event.old_value && (
                    <span className="line-through text-accent-red/80">{event.old_value}</span>
                  )}
                  {event.old_value && event.new_value && (
                    <ArrowRight size={11} className="text-text-dim" />
                  )}
                  {event.new_value && (
                    <span className="text-accent-green font-semibold">{event.new_value}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
