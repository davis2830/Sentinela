import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  ShieldCheck,
  Server,
  Lock,
} from 'lucide-react';

export interface ActivityEvent {
  id: string;
  serviceName: string;
  timestamp: string;
  statusText: string;
  type: 'success' | 'warning' | 'error' | 'info';
  category?: 'uptime' | 'api' | 'ssl' | 'dns' | 'alert';
}

interface NOCRecentActivityFeedProps {
  events: ActivityEvent[];
}

export default function NOCRecentActivityFeed({ events }: NOCRecentActivityFeedProps) {
  const navigate = useNavigate();

  const getStatusIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={14} className="text-accent-green shrink-0" />;
      case 'warning':
        return <AlertTriangle size={14} className="text-accent-yellow shrink-0" />;
      case 'error':
        return <AlertTriangle size={14} className="text-accent-red shrink-0" />;
      case 'info':
      default:
        return <Clock size={14} className="text-sky-400 shrink-0" />;
    }
  };

  const getBadgeStyle = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'success':
        return 'bg-accent-green/10 text-accent-green border-accent-green/30';
      case 'warning':
        return 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30';
      case 'error':
        return 'bg-accent-red/10 text-accent-red border-accent-red/30';
      case 'info':
      default:
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
    }
  };

  return (
    <div className="bg-bg-card border border-border-base rounded-2xl p-5 md:p-6 shadow-sm flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-accent-blue" />
          <h3 className="text-sm font-bold tracking-wide text-text-main">
            Actividad Reciente
          </h3>
        </div>
        <button
          type="button"
          onClick={() => navigate('/reports')}
          className="text-xs text-text-muted hover:text-accent-blue flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>Ver todas</span>
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Events Feed List */}
      <div className="space-y-3 overflow-y-auto max-h-64 pr-1 scrollbar-thin">
        {events.length === 0 ? (
          <div className="py-8 text-center text-xs text-text-dim">
            Sin telemetría reciente registrada en este intervalo.
          </div>
        ) : (
          events.slice(0, 6).map((evt) => (
            <div
              key={evt.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-bg-dark/50 hover:bg-bg-dark border border-border-base/50 hover:border-border-accent transition-colors gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`p-1.5 rounded-lg border flex items-center justify-center shrink-0 ${getBadgeStyle(
                    evt.type
                  )}`}
                >
                  {getStatusIcon(evt.type)}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-text-main truncate">
                    {evt.serviceName}
                  </h4>
                  <p className="text-[11px] text-text-dim font-mono">
                    {evt.timestamp} &bull; {evt.statusText}
                  </p>
                </div>
              </div>

              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${getBadgeStyle(
                  evt.type
                )}`}
              >
                {evt.type === 'success'
                  ? 'OK'
                  : evt.type === 'warning'
                  ? 'Atención'
                  : evt.type === 'error'
                  ? 'Fallo'
                  : 'Info'}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-border-base/50 flex items-center justify-between text-[11px] text-text-dim">
        <span>Sondeo continuo cada 15s/60s</span>
        <span className="text-accent-green font-medium flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-ping" />
          En vivo
        </span>
      </div>
    </div>
  );
}
