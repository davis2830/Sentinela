import type { AlertRule } from '../../types/alerts';
import SeverityBadge from '../common/SeverityBadge';
import AdminButton from '../common/AdminButton';
import { Moon, Pencil, Trash2 } from 'lucide-react';

export interface AlertRuleCardsViewProps {
  rules: AlertRule[];
  isItemSnoozed: (snoozedUntil: string | null) => boolean;
  getModuleName: (targetType: string) => string;
  onSnooze: (rule: AlertRule) => void;
  onEdit: (rule: AlertRule) => void;
  onDelete: (rule: AlertRule) => void;
}

export default function AlertRuleCardsView({
  rules,
  isItemSnoozed,
  getModuleName,
  onSnooze,
  onEdit,
  onDelete,
}: AlertRuleCardsViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {rules.map((rule: AlertRule) => {
        const ruleSnoozed = isItemSnoozed(rule.snoozed_until ?? null);

        return (
          <div
            key={rule.id}
            className="bg-bg-card border border-border-base/70 rounded-2xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between group shadow-sm"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="font-bold text-text-main text-base group-hover:text-accent-green transition-colors line-clamp-1">
                  {rule.name}
                </h3>
                <div className="flex items-center gap-1.5 shrink-0">
                  {ruleSnoozed && (
                    <span
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-medium"
                      title={`Silenciada hasta ${new Date(rule.snoozed_until!).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
                    >
                      <Moon size={10} />
                      Mute
                    </span>
                  )}
                  <SeverityBadge severity={rule.severity} />
                </div>
              </div>

              <div className="space-y-2 text-xs font-mono text-text-muted bg-bg-dark/50 rounded-xl p-3 border border-border-base/40 font-sans">
                <div className="flex justify-between border-b border-border-base/40 pb-1.5">
                  <span className="text-text-dim font-medium">Condición:</span>
                  <span className="text-accent-green font-mono font-bold truncate max-w-[160px]">
                    {rule.condition} ({rule.threshold})
                  </span>
                </div>
                <div className="flex justify-between border-b border-border-base/40 pb-1.5">
                  <span className="text-text-dim font-medium">Módulo:</span>
                  <span className="text-text-main font-semibold capitalize">
                    {getModuleName(rule.target_type)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border-base/40 pb-1.5">
                  <span className="text-text-dim font-medium">Auto-Resolución:</span>
                  <span className="font-semibold">
                    {rule.auto_resolve ? (
                      <span className="text-accent-green">Activada</span>
                    ) : (
                      <span className="text-text-dim">Manual</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-dim font-medium">Cooldown / Estado:</span>
                  <span className="font-semibold flex items-center gap-1.5">
                    <span className="text-sky-400 font-mono">{rule.cooldown_minutes || 5}m</span>
                    <span>•</span>
                    {rule.enabled ? (
                      <span className="text-accent-green">Activa</span>
                    ) : (
                      <span className="text-text-dim">Deshabilitada</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border-base/40 flex items-center justify-between text-xs text-text-dim">
              <span className="font-mono text-xs">
                Creada: {new Date(rule.created_at).toLocaleDateString('es-ES')}
              </span>
              <div className="flex items-center gap-1">
                {/* Rule Snooze Button */}
                <AdminButton capability="alerts.snooze"
                  type="button"
                  onClick={() => onSnooze(rule)}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    ruleSnoozed
                      ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25'
                      : 'text-text-dim hover:text-amber-400 hover:bg-amber-500/10'
                  }`}
                  title={ruleSnoozed ? 'Desactivar silencio' : 'Silenciar regla (Mute)'}
                >
                  <Moon size={14} />
                </AdminButton>

                {/* Edit Rule */}
                <AdminButton capability="alerts.update"
                  type="button"
                  onClick={() => onEdit(rule)}
                  className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors cursor-pointer"
                  title="Editar regla"
                >
                  <Pencil size={14} />
                </AdminButton>

                {/* Delete Rule */}
                <AdminButton capability="alerts.delete"
                  type="button"
                  onClick={() => onDelete(rule)}
                  className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors cursor-pointer"
                  title="Eliminar regla"
                >
                  <Trash2 size={14} />
                </AdminButton>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
