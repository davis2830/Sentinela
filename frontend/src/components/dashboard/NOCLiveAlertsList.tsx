import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import type { Incident } from '../../types/incidents';
import type { Alert } from '../../types/alerts';

interface UnifiedAlertItem {
  id: string;
  title: string;
  serviceName: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'open' | 'investigating' | 'mitigated' | 'resolved';
  timestamp: string;
  rawIncident?: Incident;
  rawAlert?: Alert;
}

interface NOCLiveAlertsListProps {
  incidents: Incident[];
  alerts: Alert[];
  onInspectItem: (item: { type: 'incident' | 'alert'; data: Incident | Alert }) => void;
}

function NOCLiveAlertsList({
  incidents,
  alerts,
  onInspectItem,
}: NOCLiveAlertsListProps) {
  const navigate = useNavigate();

  // Unified items list combining active incidents and recent alerts
  const items: UnifiedAlertItem[] = useMemo(() => [
    ...incidents.map((inc) => ({
      id: `inc-${inc.id}`,
      title: inc.title,
      serviceName: inc.impacted_service || 'Infraestructura',
      severity: (inc.priority === 'critical'
        ? 'critical'
        : inc.priority === 'high'
        ? 'warning'
        : 'info') as UnifiedAlertItem['severity'],
      status: (inc.status === 'resolved' || inc.status === 'closed'
        ? 'resolved'
        : inc.status === 'mitigated'
        ? 'mitigated'
        : inc.status === 'investigating' || inc.status === 'identified'
        ? 'investigating'
        : 'open') as UnifiedAlertItem['status'],
      timestamp: new Date(inc.opened_at || inc.created_at).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      rawIncident: inc,
    })),
    ...alerts.map((al) => ({
      id: `alt-${al.id}`,
      title: al.title || al.message || 'Alarma del Sistema',
      serviceName: al.target_type || 'Servicio',
      severity: (al.severity === 'critical'
        ? 'critical'
        : al.severity === 'warning'
        ? 'warning'
        : 'info') as UnifiedAlertItem['severity'],
      status: (al.status === 'resolved'
        ? 'resolved'
        : al.status === 'acknowledged'
        ? 'investigating'
        : 'open') as UnifiedAlertItem['status'],
      timestamp: new Date(al.created_at).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      rawAlert: al,
    })),
  ], [incidents, alerts]);

  const totalActive = useMemo(() => items.filter((i) => i.status !== 'resolved').length, [items]);

  const getSeverityIcon = (sev: UnifiedAlertItem['severity']) => {
    switch (sev) {
      case 'critical':
        return <AlertOctagon size={15} className="text-accent-red shrink-0" />;
      case 'warning':
        return <AlertTriangle size={15} className="text-accent-yellow shrink-0" />;
      case 'info':
      default:
        return <Info size={15} className="text-sky-400 shrink-0" />;
    }
  };

  const getStatusBadge = (status: UnifiedAlertItem['status']) => {
    switch (status) {
      case 'open':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-accent-red/15 text-accent-red border border-accent-red/30">
            Abierto
          </span>
        );
      case 'investigating':
      case 'mitigated':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-accent-yellow/15 text-accent-yellow border border-accent-yellow/30">
            En progreso
          </span>
        );
      case 'resolved':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-accent-green/15 text-accent-green border border-accent-green/30">
            Resuelto
          </span>
        );
    }
  };

  return (
    <div className="bg-bg-card border border-border-base rounded-2xl p-5 md:p-6 shadow-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-accent-red/10 text-accent-red border border-accent-red/20">
            <AlertTriangle size={15} />
          </div>
          <h3 className="text-sm font-bold tracking-wide text-text-main">
            Incidentes y Alertas
          </h3>
          {totalActive > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-accent-red/20 text-accent-red border border-accent-red/40">
              {totalActive}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate('/alerts')}
          className="text-xs text-text-muted hover:text-accent-red flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>Ver todos</span>
          <ChevronRight size={13} />
        </button>
      </div>

      {/* List Feed */}
      <div className="space-y-2.5">
        {items.length === 0 ? (
          <div className="py-8 text-center text-xs text-text-dim">
            Sin alarmas ni incidentes registrados en el periodo.
          </div>
        ) : (
          items.slice(0, 5).map((item) => (
            <div
              key={item.id}
              onClick={() => {
                if (item.rawIncident) onInspectItem({ type: 'incident', data: item.rawIncident });
                else if (item.rawAlert) onInspectItem({ type: 'alert', data: item.rawAlert });
              }}
              className="flex items-center justify-between p-3 rounded-xl bg-bg-dark/50 hover:bg-bg-dark border border-border-base/50 hover:border-border-accent transition-colors gap-3 cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    item.severity === 'critical'
                      ? 'bg-accent-red/10 border border-accent-red/20'
                      : item.severity === 'warning'
                      ? 'bg-accent-yellow/10 border border-accent-yellow/20'
                      : 'bg-sky-500/10 border border-sky-500/20'
                  }`}
                >
                  {getSeverityIcon(item.severity)}
                </div>

                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-text-main group-hover:text-accent-red transition-colors truncate">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-text-dim">
                    Desde {item.timestamp} &bull;{' '}
                    <span className="capitalize font-medium">
                      {item.severity === 'critical'
                        ? 'Crítico'
                        : item.severity === 'warning'
                        ? 'Advertencia'
                        : 'Información'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="shrink-0">{getStatusBadge(item.status)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default React.memo(NOCLiveAlertsList);
