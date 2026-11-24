import type { Alert } from '../../types/alerts';
import SeverityBadge from '../common/SeverityBadge';
import StatusBadge from '../common/StatusBadge';
import AdminButton from '../common/AdminButton';
import { NOCDrawer } from '../common/noc';
import {
  ShieldAlert,
  Clock,
  Zap,
  ExternalLink,
  Activity,
  Flame,
  Moon,
  RotateCcw,
  Eye,
  CheckCircle,
} from 'lucide-react';

export interface AlertInspectionDrawerProps {
  alert: Alert | null;
  activeTab: 'rca' | 'timeline' | 'actions';
  onTabChange: (tab: 'rca' | 'timeline' | 'actions') => void;
  onClose: () => void;
  getModuleName: (targetType: string) => string;
  getModuleRoute: (targetType: string) => string;
  onNavigate: (route: string) => void;
  isItemSnoozed: (snoozedUntil: string | null) => boolean;
  onCreateIncident: (id: string) => void;
  isCreatingIncident: boolean;
  onSnoozeAlert: (id: string, minutes: number) => void;
  isSnoozing: boolean;
  onUpdateStatus: (id: string, status: 'acknowledged' | 'resolved') => void;
  isUpdatingStatus: boolean;
}

export default function AlertInspectionDrawer({
  alert,
  activeTab,
  onTabChange,
  onClose,
  getModuleName,
  getModuleRoute,
  onNavigate,
  isItemSnoozed,
  onCreateIncident,
  isCreatingIncident,
  onSnoozeAlert,
  isSnoozing,
  onUpdateStatus,
  isUpdatingStatus,
}: AlertInspectionDrawerProps) {
  if (!alert) return null;

  return (
    <NOCDrawer
      isOpen={!!alert}
      onClose={onClose}
      title={alert.title}
      subtitle={`ID: ${alert.id} • Módulo: ${getModuleName(alert.target_type)}`}
      statusBadge={
        <div className="flex items-center gap-1.5 flex-wrap">
          <SeverityBadge severity={alert.severity} />
          <StatusBadge status={alert.status} />
          {alert.occurrence_count > 1 && (
            <span className="px-2 py-0.5 rounded-full bg-accent-purple/15 border border-accent-purple/40 text-accent-purple text-xs font-mono font-bold">
              x{alert.occurrence_count}
            </span>
          )}
          {alert.is_flapping && (
            <span className="px-2 py-0.5 rounded-full bg-accent-red/15 border border-accent-red/40 text-accent-red text-xs font-semibold animate-pulse">
              Flapping
            </span>
          )}
        </div>
      }
      tabs={[
        { id: 'rca', label: 'Causa Raíz (RCA)', icon: <ShieldAlert size={14} /> },
        { id: 'timeline', label: 'Cronología & MTTR', icon: <Clock size={14} /> },
        { id: 'actions', label: 'Acciones & Silencio', icon: <Zap size={14} /> },
      ]}
      activeTab={activeTab}
      onTabChange={(tab) => onTabChange(tab as typeof activeTab)}
      headerActions={
        <button
          type="button"
          onClick={() => {
            onNavigate(getModuleRoute(alert.target_type));
            onClose();
          }}
          className="flex items-center gap-1 px-3 py-1 bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 rounded-full text-xs font-medium transition-all cursor-pointer"
          title="Abrir módulo de origen en pantalla completa"
        >
          <span>Ver Módulo</span>
          <ExternalLink size={12} />
        </button>
      }
      footerActions={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-text-dim font-mono">
            Sentinel Smart Alerts v2
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full border border-border-base bg-bg-dark text-text-muted hover:text-text-main text-xs font-medium transition-colors cursor-pointer"
          >
            Cerrar Panel
          </button>
        </div>
      }
    >
      {/* TAB 1: RCA & CAUSA RAÍZ */}
      {activeTab === 'rca' && (
        <div className="space-y-4 font-sans text-sm">
          {/* Target & Route Header */}
          <div className="bg-bg-dark/60 border border-border-base/60 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-text-dim block mb-0.5">Módulo de Origen</span>
              <span className="text-base font-bold text-text-main flex items-center gap-2">
                {getModuleName(alert.target_type)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                onNavigate(getModuleRoute(alert.target_type));
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/10 border border-accent-green/40 text-accent-green hover:bg-accent-green/20 rounded-full text-xs font-semibold transition-all cursor-pointer"
            >
              <span>Inspeccionar en {getModuleName(alert.target_type)}</span>
              <ExternalLink size={12} />
            </button>
          </div>

          {/* Message Details */}
          <div className="bg-bg-dark/60 border border-border-base/60 rounded-2xl p-4 space-y-2">
            <span className="text-xs text-text-dim uppercase font-semibold tracking-wider block">
              Descripción del Incidente / Infracción
            </span>
            <p className="text-text-main text-sm leading-relaxed font-sans">
              {alert.message}
            </p>
          </div>

          {/* Anti-Flapping Evaluation */}
          <div
            className={`rounded-2xl p-4 border space-y-2 ${
              alert.is_flapping
                ? 'bg-rose-500/10 border-rose-500/30'
                : 'bg-bg-dark/60 border-border-base/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <Activity
                size={16}
                className={alert.is_flapping ? 'text-accent-red animate-pulse' : 'text-accent-green'}
              />
              <span
                className={`font-semibold text-xs ${
                  alert.is_flapping ? 'text-accent-red' : 'text-text-main'
                }`}
              >
                Análisis de Estabilidad & Anti-Flapping
              </span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              {alert.is_flapping
                ? `Oscilación rápida detectada: Se han registrado ${alert.flapping_count || 3} cambios de estado en menos de 15 minutos. El motor inteligente ha escalado la severidad a Crítica para evitar fatiga de alertas.`
                : 'Comportamiento de servicio estable. No se registran oscilaciones rápidas ni flapping en la ventana reciente.'}
            </p>
          </div>

          {/* Deduplication & Occurrences */}
          <div className="bg-bg-dark/60 border border-border-base/60 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-text-dim block mb-0.5">Deduplicación de Eventos</span>
              <span className="text-xs text-text-muted">
                Impactos continuos registrados sin resolución
              </span>
            </div>
            <span className="px-3 py-1 rounded-full bg-accent-purple/15 border border-accent-purple/40 text-accent-purple font-mono font-bold text-sm">
              {alert.occurrence_count || 1} impactos
            </span>
          </div>

          {/* Telemetry / Metadata Attributes */}
          {alert.metadata && Object.keys(alert.metadata).length > 0 && (
            <div className="bg-bg-dark/60 border border-border-base/60 rounded-2xl p-4 space-y-3">
              <span className="text-xs text-text-dim uppercase font-semibold tracking-wider block">
                Telemetría & Metadatos del Objetivo
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                {Object.entries(alert.metadata).map(([key, val]) => (
                  <div
                    key={key}
                    className="bg-bg-card border border-border-base/40 rounded-xl p-2.5"
                  >
                    <span className="text-text-dim block text-xs uppercase truncate">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className="text-accent-green font-semibold truncate block mt-0.5">
                      {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TIMELINE & MTTR */}
      {activeTab === 'timeline' && (
        <div className="space-y-5 font-sans">
          {/* Stepper Timeline */}
          <div className="relative pl-6 space-y-6 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-[2px] before:bg-border-base">
            {/* 1. Triggered At */}
            <div className="relative">
              <div className="absolute -left-[29px] top-1 w-4 h-4 rounded-full bg-accent-red border-4 border-bg-card" />
              <div>
                <span className="text-xs font-mono text-text-dim block">
                  {new Date(alert.triggered_at).toLocaleString('es-ES')}
                </span>
                <h4 className="text-sm font-bold text-text-main mt-0.5">
                  Disparo Inicial de la Alerta (Tiempo Cero)
                </h4>
                <p className="text-xs text-text-muted mt-1">
                  El objetivo superó el umbral configurado por primera vez. Preservado para cálculo de MTTR exacto.
                </p>
              </div>
            </div>

            {/* 2. Last Seen At */}
            {alert.last_seen_at && (
              <div className="relative">
                <div className="absolute -left-[29px] top-1 w-4 h-4 rounded-full bg-accent-yellow border-4 border-bg-card" />
                <div>
                  <span className="text-xs font-mono text-text-dim block">
                    {new Date(alert.last_seen_at).toLocaleString('es-ES')}
                  </span>
                  <h4 className="text-sm font-bold text-text-main mt-0.5">
                    Última Detección Activa
                  </h4>
                  <p className="text-xs text-text-muted mt-1">
                    Monitoreo recurrente confirmó la persistencia del fallo (ocurrencia #{alert.occurrence_count || 1}).
                  </p>
                </div>
              </div>
            )}

            {/* 3. Snoozed (if applicable) */}
            {isItemSnoozed(alert.snoozed_until) && (
              <div className="relative">
                <div className="absolute -left-[29px] top-1 w-4 h-4 rounded-full bg-amber-400 border-4 border-bg-card" />
                <div>
                  <span className="text-xs font-mono text-amber-400 block">
                    Hasta: {new Date(alert.snoozed_until!).toLocaleString('es-ES')}
                  </span>
                  <h4 className="text-sm font-bold text-amber-400 mt-0.5">
                    Silenciado Activo (Mute)
                  </h4>
                  <p className="text-xs text-text-muted mt-1">
                    Las notificaciones a canales externos se encuentran pausadas temporalmente.
                  </p>
                </div>
              </div>
            )}

            {/* 4. Resolved At */}
            {alert.resolved_at ? (
              <div className="relative">
                <div className="absolute -left-[29px] top-1 w-4 h-4 rounded-full bg-accent-green border-4 border-bg-card" />
                <div>
                  <span className="text-xs font-mono text-accent-green block">
                    {new Date(alert.resolved_at).toLocaleString('es-ES')}
                  </span>
                  <h4 className="text-sm font-bold text-accent-green mt-0.5">
                    {alert.auto_resolved
                      ? 'Auto-Mitigada por Recuperación de Servicio'
                      : 'Alerta Marcada como Resuelta'}
                  </h4>
                  <p className="text-xs text-text-muted mt-1">
                    El servicio volvió al rango normal de operación o fue resuelta por el operador.
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute -left-[29px] top-1 w-4 h-4 rounded-full bg-border-base border-4 border-bg-card" />
                <div>
                  <span className="text-xs font-mono text-text-dim block">Actualmente Abierta</span>
                  <h4 className="text-sm font-bold text-text-dim mt-0.5">Pendiente de Mitigación</h4>
                </div>
              </div>
            )}
          </div>

          {/* Incident Duration Card */}
          <div className="bg-bg-dark/60 border border-border-base/60 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-text-dim block mb-0.5">Duración del Evento</span>
              <span className="text-xs text-text-muted">
                {alert.resolved_at ? 'Tiempo total de resolución' : 'Tiempo transcurrido activa'}
              </span>
            </div>
            <span className="text-base font-bold font-mono text-sky-400">
              {(() => {
                const start = new Date(alert.triggered_at).getTime();
                const end = alert.resolved_at
                  ? new Date(alert.resolved_at).getTime()
                  : Date.now();
                const diffMinutes = Math.max(1, Math.round((end - start) / 60000));
                if (diffMinutes < 60) return `${diffMinutes} min`;
                const hours = Math.floor(diffMinutes / 60);
                const mins = diffMinutes % 60;
                return `${hours}h ${mins}m`;
              })()}
            </span>
          </div>
        </div>
      )}

      {/* TAB 3: ACTIONS & SNOOZE */}
      {activeTab === 'actions' && (
        <div className="space-y-4 font-sans">
          {/* Incident Elevation */}
          <div className="bg-bg-dark/60 border border-border-base/60 rounded-2xl p-4 space-y-3">
            <span className="text-xs text-text-dim uppercase font-semibold tracking-wider block">
              Elevación a Incidente Formal
            </span>
            {alert.incident_id ? (
              <div className="flex items-center gap-2 p-3 bg-accent-red/10 border border-accent-red/30 rounded-xl text-accent-red text-xs font-semibold">
                <Flame size={15} />
                <span>Incidente #{alert.incident_id}: {alert.incident_title || 'Vinculado'}</span>
              </div>
            ) : (
              <div>
                <p className="text-xs text-text-muted mb-3">
                  Crea un expediente de incidente formal con asignación de responsables y bitácora de seguimiento.
                </p>
                <AdminButton capability={["alerts.update", "incidents.create"]}
                  type="button"
                  onClick={() => onCreateIncident(alert.id)}
                  disabled={isCreatingIncident}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent-red text-white font-semibold rounded-full text-xs hover:bg-accent-red/90 transition-all shadow-md shadow-accent-red/20 disabled:opacity-50 cursor-pointer"
                >
                  <Flame size={14} />
                  <span>{isCreatingIncident ? 'Creando...' : 'Elevar a Incidente'}</span>
                </AdminButton>
              </div>
            )}
          </div>

          {/* Smart Snooze / Mute */}
          <div className="bg-bg-dark/60 border border-border-base/60 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-dim uppercase font-semibold tracking-wider">
                Silenciado Inteligente (Snooze)
              </span>
              {isItemSnoozed(alert.snoozed_until) && (
                <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
                  <Moon size={11} />
                  Activo hasta {new Date(alert.snoozed_until!).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Pausa temporalmente las notificaciones a canales externos (Email, Slack, Telegram) para este objetivo durante trabajos de mantenimiento.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {[30, 60, 240, 1440].map((mins) => (
                <AdminButton capability="alerts.snooze"
                  key={mins}
                  type="button"
                  onClick={() => onSnoozeAlert(alert.id, mins)}
                  disabled={isSnoozing}
                  className="px-3 py-2 bg-bg-card border border-border-base hover:border-amber-400/50 text-text-main hover:text-amber-400 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer"
                >
                  {mins === 30 ? '30m' : mins === 60 ? '1 hora' : mins === 240 ? '4 horas' : '24 horas'}
                </AdminButton>
              ))}
            </div>

            {isItemSnoozed(alert.snoozed_until) && (
              <AdminButton capability="alerts.snooze"
                type="button"
                onClick={() => onSnoozeAlert(alert.id, 0)}
                disabled={isSnoozing}
                className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 border border-border-base bg-bg-card text-text-muted hover:text-text-main rounded-xl text-xs font-medium transition-all cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Reanudar Notificaciones (Quitar Silencio)</span>
              </AdminButton>
            )}
          </div>

          {/* Status Actions */}
          <div className="bg-bg-dark/60 border border-border-base/60 rounded-2xl p-4 space-y-3">
            <span className="text-xs text-text-dim uppercase font-semibold tracking-wider block">
              Cambio Manual de Estado
            </span>
            <div className="flex gap-2">
              {alert.status === 'active' && (
                <AdminButton capability="alerts.acknowledge"
                  type="button"
                  onClick={() => onUpdateStatus(alert.id, 'acknowledged')}
                  disabled={isUpdatingStatus}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-accent-yellow/15 border border-accent-yellow/40 text-accent-yellow hover:bg-accent-yellow/25 rounded-full text-xs font-semibold transition-all cursor-pointer"
                >
                  <Eye size={14} />
                  <span>Reconocer Alerta</span>
                </AdminButton>
              )}

              {alert.status !== 'resolved' && (
                <AdminButton capability="alerts.resolve"
                  type="button"
                  onClick={() => onUpdateStatus(alert.id, 'resolved')}
                  disabled={isUpdatingStatus}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-accent-green/15 border border-accent-green/40 text-accent-green hover:bg-accent-green/25 rounded-full text-xs font-semibold transition-all cursor-pointer"
                >
                  <CheckCircle size={14} />
                  <span>Marcar como Resuelta</span>
                </AdminButton>
              )}
            </div>
          </div>
        </div>
      )}
    </NOCDrawer>
  );
}
