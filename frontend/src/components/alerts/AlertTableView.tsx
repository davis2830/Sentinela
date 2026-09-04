import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Alert } from '../../types/alerts';
import SeverityBadge from '../common/SeverityBadge';
import StatusBadge from '../common/StatusBadge';
import {
  Clock,
  Eye,
  CheckCircle,
  Flame,
  Moon,
  Activity,
  ExternalLink,
  CheckSquare,
  Square,
  Globe,
  Lock,
  Plug,
  Shield,
} from 'lucide-react';

export interface AlertTableViewProps {
  alerts: Alert[];
  selectedIds: string[];
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onSelectAll: () => void;
  onSelectAlert: (alert: Alert) => void;
  onSnooze: (alert: Alert, e: React.MouseEvent) => void;
  onCreateIncident: (id: string, e: React.MouseEvent) => void;
  onAcknowledge: (id: string, e: React.MouseEvent) => void;
  onResolve: (id: string, e: React.MouseEvent) => void;
  isCreatingIncident?: boolean;
}

export default function AlertTableView({
  alerts,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onSelectAlert,
  onSnooze,
  onCreateIncident,
  onAcknowledge,
  onResolve,
  isCreatingIncident = false,
}: AlertTableViewProps) {
  const navigate = useNavigate();
  const allSelected = alerts.length > 0 && selectedIds.length === alerts.length;

  const getModuleRoute = (targetType: string) => {
    switch (targetType) {
      case 'monitoring':
        return '/monitoring';
      case 'ssl':
        return '/ssl';
      case 'dns':
        return '/dns';
      case 'domain':
        return '/domains';
      case 'api_check':
        return '/api-checks';
      case 'security_headers':
        return '/security-headers';
      default:
        return '/monitoring';
    }
  };

  const getModuleName = (targetType: string) => {
    switch (targetType) {
      case 'monitoring':
        return 'Uptime';
      case 'ssl':
        return 'SSL';
      case 'dns':
        return 'DNS';
      case 'domain':
        return 'WHOIS';
      case 'api_check':
        return 'API Checks';
      case 'security_headers':
        return 'Cabeceras';
      default:
        return targetType;
    }
  };

  const getModuleIcon = (targetType: string) => {
    switch (targetType) {
      case 'monitoring':
        return <Globe size={13} className="text-emerald-400" />;
      case 'ssl':
        return <Lock size={13} className="text-rose-400" />;
      case 'dns':
        return <Activity size={13} className="text-sky-400" />;
      case 'domain':
        return <Globe size={13} className="text-blue-400" />;
      case 'api_check':
        return <Plug size={13} className="text-amber-400" />;
      case 'security_headers':
        return <Shield size={13} className="text-purple-400" />;
      default:
        return <Globe size={13} className="text-emerald-400" />;
    }
  };

  const isAlertSnoozed = (snoozedUntil?: string | null) => {
    if (!snoozedUntil) return false;
    return new Date(snoozedUntil) > new Date();
  };

  return (
    <div className="bg-bg-card/95 border border-border-base/70 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead>
            <tr className="border-b border-border-base text-text-dim text-xs bg-bg-card/50">
              <th className="py-3 px-3.5 w-10">
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="text-text-dim hover:text-accent-green transition-colors cursor-pointer"
                  title={allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                >
                  {allSelected ? (
                    <CheckSquare size={16} className="text-accent-green" />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
              </th>
              <th className="py-3 px-3 font-semibold">Severidad</th>
              <th className="py-3 px-4 font-semibold">Título del Evento & Mensaje</th>
              <th className="py-3 px-3 font-semibold">Módulo</th>
              <th className="py-3 px-3 font-semibold text-center">Impactos / Radar</th>
              <th className="py-3 px-4 font-semibold">Cronología (Inicio / Último)</th>
              <th className="py-3 px-3 font-semibold text-center">Estado</th>
              <th className="py-3 px-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base/40">
            {alerts.map((alert) => {
              const isSelected = selectedIds.includes(alert.id);
              const snoozed = isAlertSnoozed(alert.snoozed_until);

              return (
                <tr
                  key={alert.id}
                  onClick={() => onSelectAlert(alert)}
                  className={`hover:bg-bg-dark/60 transition-colors cursor-pointer group ${
                    isSelected
                      ? 'bg-accent-green/5'
                      : alert.is_flapping
                      ? 'bg-rose-500/5'
                      : ''
                  }`}
                >
                  {/* Selection Checkbox */}
                  <td
                    className="py-3 px-3.5"
                    onClick={(e) => onToggleSelect(alert.id, e)}
                  >
                    <div className="text-text-dim hover:text-accent-green transition-colors">
                      {isSelected ? (
                        <CheckSquare size={16} className="text-accent-green" />
                      ) : (
                        <Square size={16} className="group-hover:text-text-muted" />
                      )}
                    </div>
                  </td>

                  {/* Severity */}
                  <td className="py-3 px-3 shrink-0">
                    <SeverityBadge severity={alert.severity} />
                  </td>

                  {/* Title & Message */}
                  <td className="py-3 px-4 max-w-sm sm:max-w-md">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-text-main text-sm group-hover:text-accent-green transition-colors truncate">
                        {alert.title}
                      </span>

                      {alert.occurrence_count > 1 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-accent-purple/15 border border-accent-purple/40 text-accent-purple text-[10px] font-mono font-bold">
                          x{alert.occurrence_count}
                        </span>
                      )}

                      {alert.is_flapping && (
                        <span className="flex items-center gap-1 px-2 py-0.2 rounded-full bg-accent-red/15 border border-accent-red/40 text-accent-red text-[10px] font-semibold animate-pulse">
                          <Activity size={10} />
                          Flapping ({alert.flapping_count || 3})
                        </span>
                      )}

                      {snoozed && (
                        <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[10px] font-medium">
                          <Moon size={9} />
                          Mute
                        </span>
                      )}

                      {alert.auto_resolved && (
                        <span className="px-1.5 py-0.2 rounded-full bg-accent-green/10 border border-accent-green/30 text-accent-green text-[10px] font-medium">
                          Auto-Mitigada
                        </span>
                      )}
                    </div>
                    <p className="text-text-muted text-xs truncate mt-0.5 max-w-sm">
                      {alert.message}
                    </p>
                  </td>

                  {/* Target Module with quick link */}
                  <td className="py-3 px-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(getModuleRoute(alert.target_type));
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bg-dark border border-border-base hover:border-sky-400/50 text-sky-400 font-medium text-xs transition-colors"
                      title="Ir al módulo"
                    >
                      {getModuleIcon(alert.target_type)}
                      <span>{getModuleName(alert.target_type)}</span>
                      <ExternalLink size={10} className="text-sky-400/70" />
                    </button>
                  </td>

                  {/* Impacts count */}
                  <td className="py-3 px-3 text-center">
                    <span className="font-mono text-xs text-text-dim">
                      {alert.occurrence_count || 1} hits
                    </span>
                  </td>

                  {/* Timestamps */}
                  <td className="py-3 px-4 font-mono text-xs text-text-dim">
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1 text-[11px] text-text-main">
                        <Clock size={11} className="text-text-dim" />
                        {new Date(alert.triggered_at).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        • {new Date(alert.triggered_at).toLocaleDateString('es-ES')}
                      </span>
                      {alert.last_seen_at && alert.last_seen_at !== alert.triggered_at && (
                        <span className="text-[10px] text-text-dim">
                          Último: {new Date(alert.last_seen_at).toLocaleTimeString('es-ES')}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3 text-center">
                    <StatusBadge status={alert.status} />
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div
                      className="flex items-center justify-end gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Inspect */}
                      <button
                        type="button"
                        onClick={() => onSelectAlert(alert)}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors"
                        title="Inspeccionar alerta (RCA y Cronología)"
                      >
                        <Eye size={14} />
                      </button>

                      {/* Snooze */}
                      <button
                        type="button"
                        onClick={(e) => onSnooze(alert, e)}
                        className={`p-1.5 rounded-full transition-colors ${
                          snoozed
                            ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25'
                            : 'text-text-dim hover:text-amber-400 hover:bg-amber-500/10'
                        }`}
                        title={snoozed ? 'Configurar / Desactivar silencio' : 'Silenciar alerta'}
                      >
                        <Moon size={14} />
                      </button>

                      {/* Create Incident */}
                      {alert.incident_id ? (
                        <span
                          className="p-1.5 text-accent-red"
                          title={alert.incident_title || 'Incidente vinculado'}
                        >
                          <Flame size={14} />
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => onCreateIncident(alert.id, e)}
                          disabled={isCreatingIncident}
                          className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors disabled:opacity-50"
                          title="Elevar a Incidente"
                        >
                          <Flame size={14} />
                        </button>
                      )}

                      {/* Acknowledge */}
                      {alert.status === 'active' && (
                        <button
                          type="button"
                          onClick={(e) => onAcknowledge(alert.id, e)}
                          className="p-1.5 text-text-dim hover:text-accent-yellow hover:bg-accent-yellow/10 rounded-full transition-colors"
                          title="Reconocer alerta"
                        >
                          <Eye size={14} />
                        </button>
                      )}

                      {/* Resolve */}
                      {alert.status !== 'resolved' && (
                        <button
                          type="button"
                          onClick={(e) => onResolve(alert.id, e)}
                          className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors"
                          title="Marcar como resuelta"
                        >
                          <CheckCircle size={14} />
                        </button>
                      )}
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
