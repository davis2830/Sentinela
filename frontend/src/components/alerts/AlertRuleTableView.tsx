import React from 'react';
import type { AlertRule } from '../../types/alerts';
import SeverityBadge from '../common/SeverityBadge';
import { Pencil, Trash2, Moon, Globe, Lock, Activity, Plug, Shield } from 'lucide-react';

export interface AlertRuleTableViewProps {
  rules: AlertRule[];
  onEdit: (rule: AlertRule) => void;
  onDelete: (rule: AlertRule) => void;
  onSnooze: (rule: AlertRule) => void;
}

export default function AlertRuleTableView({
  rules,
  onEdit,
  onDelete,
  onSnooze,
}: AlertRuleTableViewProps) {
  const getModuleName = (targetType: string) => {
    switch (targetType) {
      case 'monitoring':
        return 'Uptime & Latencia';
      case 'ssl':
        return 'Certificados SSL';
      case 'dns':
        return 'Registros DNS';
      case 'domain':
        return 'Dominios WHOIS';
      case 'api_check':
        return 'API Checks Sintéticos';
      case 'security_headers':
        return 'Cabeceras de Seguridad';
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

  const isRuleSnoozed = (snoozedUntil?: string | null) => {
    if (!snoozedUntil) return false;
    return new Date(snoozedUntil) > new Date();
  };

  return (
    <div className="bg-bg-card/95 border border-border-base/70 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead>
            <tr className="border-b border-border-base text-text-dim text-xs bg-bg-card/50">
              <th className="py-3 px-4 font-semibold">Regla & Severidad</th>
              <th className="py-3 px-4 font-semibold">Módulo Objetivo</th>
              <th className="py-3 px-4 font-semibold">Condición & Umbral</th>
              <th className="py-3 px-3 font-semibold text-center">Auto-Resolución</th>
              <th className="py-3 px-3 font-semibold text-center">Cooldown</th>
              <th className="py-3 px-3 font-semibold text-center">Estado</th>
              <th className="py-3 px-4 font-semibold">Creada</th>
              <th className="py-3 px-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base/40">
            {rules.map((rule) => {
              const snoozed = isRuleSnoozed(rule.snoozed_until);

              return (
                <tr
                  key={rule.id}
                  className="hover:bg-bg-dark/50 transition-colors group cursor-default"
                >
                  {/* Name & Severity */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-text-main text-sm group-hover:text-accent-green transition-colors">
                        {rule.name}
                      </span>
                      <SeverityBadge severity={rule.severity} />
                      {snoozed && (
                        <span
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[11px] font-medium"
                          title={`Silenciada hasta ${new Date(rule.snoozed_until!).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
                        >
                          <Moon size={10} />
                          Mute
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Target Module */}
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bg-dark border border-border-base text-text-main font-medium text-xs">
                      {getModuleIcon(rule.target_type)}
                      <span>{getModuleName(rule.target_type)}</span>
                    </span>
                  </td>

                  {/* Condition & Threshold */}
                  <td className="py-3 px-4">
                    <span className="font-mono text-accent-green font-bold bg-accent-green/5 border border-accent-green/20 px-2 py-0.5 rounded-lg text-xs">
                      {rule.condition} ({rule.threshold})
                    </span>
                  </td>

                  {/* Auto-Resolve */}
                  <td className="py-3 px-3 text-center">
                    {rule.auto_resolve ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent-green/10 border border-accent-green/30 text-accent-green text-[11px] font-medium">
                        Activada
                      </span>
                    ) : (
                      <span className="text-text-dim text-xs">Manual</span>
                    )}
                  </td>

                  {/* Cooldown */}
                  <td className="py-3 px-3 text-center font-mono text-xs text-sky-400 font-medium">
                    {rule.cooldown_minutes || 5} min
                  </td>

                  {/* Enabled Status */}
                  <td className="py-3 px-3 text-center">
                    {rule.enabled ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Activa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                        Inactiva
                      </span>
                    )}
                  </td>

                  {/* Created Date */}
                  <td className="py-3 px-4 font-mono text-xs text-text-dim">
                    {new Date(rule.created_at).toLocaleDateString('es-ES')}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Snooze Button */}
                      <button
                        type="button"
                        onClick={() => onSnooze(rule)}
                        className={`p-1.5 rounded-full transition-colors ${
                          snoozed
                            ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25'
                            : 'text-text-dim hover:text-amber-400 hover:bg-amber-500/10'
                        }`}
                        title={snoozed ? 'Desactivar silencio' : 'Silenciar regla (Mute)'}
                      >
                        <Moon size={14} />
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => onEdit(rule)}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors"
                        title="Editar regla"
                      >
                        <Pencil size={14} />
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => onDelete(rule)}
                        className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors"
                        title="Eliminar regla"
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
