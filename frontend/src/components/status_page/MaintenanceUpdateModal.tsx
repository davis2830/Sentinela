import React, { useState } from 'react';
import type { ScheduledMaintenanceItem, MaintenanceStatus } from '../../types/status_page';
import { X, Loader2, MessageSquarePlus, Clock, CheckCircle2 } from 'lucide-react';

interface MaintenanceUpdateModalProps {
  maintenance: ScheduledMaintenanceItem | null;
  onClose: () => void;
  onSubmit: (data: { message: string; status?: MaintenanceStatus }) => Promise<void>;
}

export default function MaintenanceUpdateModal({
  maintenance,
  onClose,
  onSubmit,
}: MaintenanceUpdateModalProps) {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<MaintenanceStatus>(
    maintenance ? maintenance.status : 'in_progress'
  );
  const [submitting, setSubmitting] = useState(false);

  if (!maintenance) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit({ message: message.trim(), status });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const updates = maintenance.updates || [];

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200 font-sans"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border-base rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border-base/60 shrink-0">
          <div>
            <h3 className="text-base font-bold text-text-main flex items-center gap-2">
              <MessageSquarePlus size={20} className="text-purple-400" />
              Publicar Avance de Mantenimiento
            </h3>
            <p className="text-xs text-text-muted mt-0.5 truncate max-w-md">
              {maintenance.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-main p-1.5 rounded-full hover:bg-bg-dark transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Previous Updates Feed */}
        {updates.length > 0 && (
          <div className="py-3 border-b border-border-base/50 shrink-0 max-h-40 overflow-y-auto">
            <span className="text-[11px] font-semibold text-text-dim block mb-2">
              Historial de notas publicadas ({updates.length}):
            </span>
            <div className="space-y-2 text-xs">
              {updates.map((u) => (
                <div
                  key={u.id}
                  className="bg-bg-dark/70 border border-border-base/60 rounded-xl p-2.5"
                >
                  <div className="flex items-center justify-between text-[10px] text-text-dim mb-1 font-mono">
                    <span className="uppercase font-semibold text-purple-400">{u.status}</span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(u.posted_at).toLocaleString('es-ES')}
                    </span>
                  </div>
                  <p className="text-text-muted text-xs leading-relaxed">{u.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-4 flex-1 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Estado Actual del Mantenimiento
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as MaintenanceStatus)}
              className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-accent-green font-sans cursor-pointer"
            >
              <option value="scheduled">Programado (Scheduled)</option>
              <option value="in_progress">En Progreso (In Progress)</option>
              <option value="completed">Completado (Completed)</option>
              <option value="cancelled">Cancelado (Cancelled)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Nota o Avance Técnico para Clientes
            </label>
            <textarea
              rows={3}
              required
              placeholder="ej. Se completó la migración del cluster primario, iniciando validaciones de tráfico..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-base/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border-base rounded-full text-xs text-text-muted hover:text-text-main hover:bg-bg-dark transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-full text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Publicar Avance
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
