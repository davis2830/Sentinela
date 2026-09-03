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
} from 'lucide-react';

interface TimelineViewProps {
  events: IncidentTimelineEvent[];
}

export default function TimelineView({ events }: TimelineViewProps) {
  if (!events || events.length === 0) {
    return (
      <div className="py-6 text-center text-text-dim font-mono text-xs">
        No hay eventos registrados en la línea de tiempo.
      </div>
    );
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'created':
        return <PlusCircle size={16} className="text-accent-blue" />;
      case 'status_changed':
        return <RefreshCw size={16} className="text-accent-yellow" />;
      case 'alert_added':
        return <Bell size={16} className="text-accent-red" />;
      case 'note_added':
        return <MessageSquare size={16} className="text-accent-green" />;
      case 'resolved':
        return <CheckCircle2 size={16} className="text-accent-green" />;
      case 'closed':
        return <XCircle size={16} className="text-text-dim" />;
      default:
        return <Clock size={16} className="text-text-muted" />;
    }
  };

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border-base">
      {events.map((event) => (
        <div key={event.id} className="relative group">
          <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-bg-card border border-border-base flex items-center justify-center shrink-0">
            {getEventIcon(event.event_type)}
          </div>
          <div className="bg-bg-dark border border-border-base rounded-xl p-4">
            <div className="flex items-center justify-between gap-2 text-xs text-text-dim mb-1.5 font-mono">
              <span className="capitalize font-semibold text-text-main">{event.event_type.replace('_', ' ')}</span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {new Date(event.occurred_at).toLocaleString('es-ES')}
              </span>
            </div>
            <p className="text-sm text-text-muted">{event.description}</p>

            {(event.old_value || event.new_value) && (
              <div className="mt-2 text-xs font-mono flex items-center gap-2 text-text-dim bg-bg-card p-2 rounded border border-border-base/50">
                {event.old_value && <span className="line-through text-accent-red">{event.old_value}</span>}
                {event.old_value && event.new_value && <span>&rarr;</span>}
                {event.new_value && <span className="text-accent-green font-bold">{event.new_value}</span>}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
