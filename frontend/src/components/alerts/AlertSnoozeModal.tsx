import { createPortal } from 'react-dom';
import AdminButton from '../common/AdminButton';
import { Moon, X } from 'lucide-react';

export interface SnoozeTarget {
  type: 'alert' | 'rule' | 'bulk';
  id?: string;
  name: string;
  isCurrentlySnoozed?: boolean;
}

export interface AlertSnoozeModalProps {
  target: SnoozeTarget | null;
  snoozeMinutes: number;
  onSetSnoozeMinutes: (mins: number) => void;
  onConfirm: () => void;
  onRemoveSnooze: () => void;
  onClose: () => void;
}

export default function AlertSnoozeModal({
  target,
  snoozeMinutes,
  onSetSnoozeMinutes,
  onConfirm,
  onRemoveSnooze,
  onClose,
}: AlertSnoozeModalProps) {
  if (!target || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-bg-card border border-border-base rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-amber-400">
            <Moon size={20} />
            <h3 className="text-base font-bold text-text-main font-sans">
              Silenciar Notificaciones (Snooze)
            </h3>
          </div>
          <AdminButton capability="alerts.snooze"
            type="button"
            onClick={onClose}
            className="p-1 text-text-dim hover:text-text-main rounded-full cursor-pointer"
          >
            <X size={18} />
          </AdminButton>
        </div>

        <p className="text-xs text-text-muted leading-relaxed">
          Silenciar pausa las alertas enviadas a canales externos para{' '}
          <strong className="text-text-main">{target.name}</strong>. Seguirá visible en la consola para trazabilidad.
        </p>

        <div className="space-y-2">
          <label className="text-xs text-text-dim font-medium">Periodo de Silencio:</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '30 Minutos', mins: 30 },
              { label: '1 Hora', mins: 60 },
              { label: '4 Horas', mins: 240 },
              { label: '24 Horas', mins: 1440 },
            ].map((item) => (
              <button
                key={item.mins}
                type="button"
                onClick={() => onSetSnoozeMinutes(item.mins)}
                className={`py-2 px-3 rounded-xl border text-xs font-mono font-medium transition-all cursor-pointer ${
                  snoozeMinutes === item.mins
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-400 font-bold'
                    : 'bg-bg-dark border-border-base text-text-muted hover:text-text-main'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border-base/50">
          {target.isCurrentlySnoozed ? (
            <AdminButton capability="alerts.snooze"
              type="button"
              onClick={onRemoveSnooze}
              className="text-xs text-rose-400 hover:text-rose-300 underline cursor-pointer"
            >
              Quitar Silencio
            </AdminButton>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <AdminButton capability="alerts.snooze"
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-border-base bg-bg-dark text-text-muted hover:text-text-main text-xs font-medium transition-colors cursor-pointer"
            >
              Cancelar
            </AdminButton>
            <AdminButton capability="alerts.snooze"
              type="button"
              onClick={onConfirm}
              className="px-5 py-2 rounded-full bg-amber-500 text-black font-semibold text-xs hover:bg-amber-400 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
            >
              Confirmar Silencio
            </AdminButton>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
