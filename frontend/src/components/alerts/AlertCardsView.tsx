import type { MouseEvent } from 'react';
import type { Alert } from '../../types/alerts';
import SeverityBadge from '../common/SeverityBadge';
import StatusBadge from '../common/StatusBadge';
import AdminButton from '../common/AdminButton';
import {
  CheckSquare,
  Square,
  Activity,
  Moon,
  Clock,
  ExternalLink,
  Eye,
  Flame,
  CheckCircle,
} from 'lucide-react';

export interface AlertCardsViewProps {
  alerts: Alert[];
  selectedAlertIds: string[];
  isItemSnoozed: (snoozedUntil: string | null) => boolean;
  getModuleName: (targetType: string) => string;
  getModuleRoute: (targetType: string) => string;
  onSelectAlert: (alert: Alert) => void;
  onToggleSelectAlert: (id: string, e: MouseEvent) => void;
  onNavigate: (route: string) => void;
  onSnooze: (alert: Alert) => void;
  onCreateIncident: (id: string) => void;
  isCreatingIncident: boolean;
  onUpdateStatus: (id: string, status: 'acknowledged' | 'resolved') => void;
}

export default function AlertCardsView({
  alerts,
  selectedAlertIds,
  isItemSnoozed,
  getModuleName,
  getModuleRoute,
  onSelectAlert,
  onToggleSelectAlert,
  onNavigate,
  onSnooze,
  onCreateIncident,
  isCreatingIncident,
  onUpdateStatus,
}: AlertCardsViewProps) {
  return (
    <div className="space-y-3">
      {alerts.map((alert: Alert) => {
        const isSelected = selectedAlertIds.includes(alert.id);
        const snoozed = isItemSnoozed(alert.snoozed_until);

        return (
          <div
            key={alert.id}
            onClick={() => onSelectAlert(alert)}
            className={`bg-bg-card border rounded-2xl p-4 sm:p-5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm cursor-pointer group ${
              isSelected
                ? 'border-accent-green/60 bg-accent-green/5'
                : alert.is_flapping
                ? 'border-accent-red/50 hover:border-accent-red'
                : 'border-border-base/70 hover:border-accent-green/40'
            }`}
          >
            <div className="flex items-start gap-3.5">
              {/* Checkbox for selection */}
              <div
                onClick={(e) => onToggleSelectAlert(alert.id, e)}
                className="mt-1 p-1 text-text-dim hover:text-accent-green cursor-pointer shrink-0 transition-colors"
                title={isSelected ? 'Deseleccionar' : 'Seleccionar'}
              >
                {isSelected ? (
                  <CheckSquare size={18} className="text-accent-green" />
                ) : (
                  <Square size={18} className="text-text-dim group-hover:text-text-muted" />
                )}
              </div>

              {/* Severity Badge */}
              <div className="mt-1 shrink-0">
                <SeverityBadge severity={alert.severity} />
              </div>

              <div>
                {/* Title, Badges & Indicators */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="font-bold text-text-main text-base group-hover:text-accent-green transition-colors">
                    {alert.title}
                  </h3>
                  <StatusBadge status={alert.status} />

                  {/* Deduplication Occurrence Badge */}
                  {alert.occurrence_count > 1 && (
                    <span
                      className="px-2 py-0.5 rounded-full bg-accent-purple/15 border border-accent-purple/40 text-accent-purple text-xs font-mono font-bold"
                      title={`Deduplicada: El evento ha ocurrido ${alert.occurrence_count} veces sin resolver`}
                    >
                      x{alert.occurrence_count}
                    </span>
                  )}

                  {/* Anti-Flapping Pulsing Badge */}
                  {alert.is_flapping && (
                    <span
                      className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-accent-red/15 border border-accent-red/40 text-accent-red text-xs font-semibold animate-pulse"
                      title={`Anti-Flapping: ${alert.flapping_count || 3} cambios de estado en 15m. Severidad auto-escalada.`}
                    >
                      <Activity size={12} />
                      Flapping ({alert.flapping_count || 3})
                    </span>
                  )}

                  {/* Snoozed Badge */}
                  {snoozed && (
                    <span
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-medium"
                      title={`Silenciada hasta ${new Date(alert.snoozed_until!).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
                    >
                      <Moon size={11} />
                      Silenciada
                    </span>
                  )}

                  {/* Auto-Resolved Badge */}
                  {alert.auto_resolved && (
                    <span
                      className="px-2 py-0.5 rounded-full bg-accent-green/10 border border-accent-green/30 text-accent-green text-xs font-medium"
                      title="Auto-mitigada automáticamente al recuperarse el servicio"
                    >
                      Auto-Mitigada
                    </span>
                  )}
                </div>

                {/* Message */}
                <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed line-clamp-2">
                  {alert.message}
                </p>

                {/* Timestamps & Module Route Link */}
                <div className="flex items-center gap-3 text-xs font-mono text-text-dim mt-2 flex-wrap">
                  <span className="flex items-center gap-1 text-xs">
                    <Clock size={12} />
                    Inicio: {new Date(alert.triggered_at).toLocaleString('es-ES')}
                  </span>

                  {alert.last_seen_at && alert.last_seen_at !== alert.triggered_at && (
                    <>
                      <span>•</span>
                      <span className="text-xs text-text-dim">
                        Último: {new Date(alert.last_seen_at).toLocaleTimeString('es-ES')}
                      </span>
                    </>
                  )}

                  <span>•</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate(getModuleRoute(alert.target_type));
                    }}
                    className="flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium hover:underline cursor-pointer"
                    title="Ir al módulo de monitoreo"
                  >
                    <span>Módulo: {getModuleName(alert.target_type)}</span>
                    <ExternalLink size={10} />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div
              className="flex items-center gap-2 self-end md:self-center shrink-0 flex-wrap"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Inspect Button */}
              <button
                type="button"
                onClick={() => onSelectAlert(alert)}
                className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors cursor-pointer"
                title="Inspeccionar diagnóstico RCA y cronología"
              >
                <Eye size={15} />
              </button>

              {/* Snooze Button */}
              <AdminButton capability="alerts.snooze"
                type="button"
                onClick={() => onSnooze(alert)}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  snoozed
                    ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25'
                    : 'text-text-dim hover:text-amber-400 hover:bg-amber-500/10'
                }`}
                title={snoozed ? 'Configurar / Desactivar silencio' : 'Silenciar alerta'}
              >
                <Moon size={15} />
              </AdminButton>

              {/* Incident Button */}
              {alert.incident_id ? (
                <span
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-red/10 border border-accent-red/30 text-accent-red rounded-full text-xs font-mono font-bold"
                  title={alert.incident_title || 'Incidente vinculado'}
                >
                  <Flame size={13} /> Incidente Vinc.
                </span>
              ) : (
                <AdminButton capability={["alerts.update", "incidents.create"]}
                  type="button"
                  onClick={() => onCreateIncident(alert.id)}
                  disabled={isCreatingIncident}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-full text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                  title="Elevar esta alerta a Incidente"
                >
                  <Flame size={13} />
                  Crear Incidente
                </AdminButton>
              )}

              {/* Acknowledge Button */}
              {alert.status === 'active' && (
                <AdminButton capability="alerts.acknowledge"
                  type="button"
                  onClick={() => onUpdateStatus(alert.id, 'acknowledged')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-yellow/10 border border-accent-yellow/30 text-accent-yellow hover:bg-accent-yellow hover:text-black rounded-full text-xs font-semibold transition-all cursor-pointer"
                  title="Reconocer alerta"
                >
                  <Eye size={13} />
                  Reconocer
                </AdminButton>
              )}

              {/* Resolve Button */}
              {alert.status !== 'resolved' && (
                <AdminButton capability="alerts.resolve"
                  type="button"
                  onClick={() => onUpdateStatus(alert.id, 'resolved')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-black rounded-full text-xs font-semibold transition-all cursor-pointer"
                  title="Marcar como resuelta"
                >
                  <CheckCircle size={13} />
                  Resolver
                </AdminButton>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
