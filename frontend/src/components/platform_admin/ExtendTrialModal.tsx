import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { PlatformOrganization } from '../../types/platform_admin';
import { X, Clock, Calendar, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

interface ExtendTrialModalProps {
  organization: PlatformOrganization | null;
  onClose: () => void;
}

export default function ExtendTrialModal({
  organization,
  onClose,
}: ExtendTrialModalProps) {
  const queryClient = useQueryClient();
  const [days, setDays] = useState<number>(14);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!organization) return;
      await api.post(`/platform-admin/organizations/${organization.id}/extend-trial/`, {
        days: days,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-admin-orgs'] });
      queryClient.invalidateQueries({ queryKey: ['platform-admin-stats'] });
      onClose();
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Error al extender periodo de prueba.');
    },
  });

  if (!organization) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-bg-card border border-border-base rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border-base flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-yellow/10 border border-accent-yellow/30 flex items-center justify-center text-accent-yellow shadow-inner">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-main">
                Extender Periodo de Prueba (Trial)
              </h3>
              <p className="text-xs text-text-muted mt-0.5 truncate max-w-[260px]">
                {organization.name} ({organization.slug})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text-main p-1.5 rounded-lg hover:bg-bg-dark transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-bg-dark rounded-2xl border border-border-base/70 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-text-dim">Estado Actual:</span>
              <span className="font-semibold text-accent-green uppercase font-mono">
                {organization.subscription_status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-dim">Días Restantes Actuales:</span>
              <span className="font-bold text-text-main font-mono">
                {organization.trial_days_remaining} días
              </span>
            </div>
            {organization.trial_ends_at && (
              <div className="flex justify-between">
                <span className="text-text-dim">Fecha Vencimiento:</span>
                <span className="text-text-muted font-mono">
                  {new Date(organization.trial_ends_at).toLocaleDateString('es-ES')}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-2">
              Días de Extensión a Otorgar
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[7, 14, 30, 60].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                    days === d
                      ? 'bg-accent-green/20 border-accent-green text-accent-green shadow-sm'
                      : 'bg-bg-dark border-border-base text-text-muted hover:border-zinc-700'
                  }`}
                >
                  +{d} días
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-accent-blue/10 border border-accent-blue/20 text-xs text-text-muted">
            <Calendar size={15} className="text-accent-blue shrink-0 mt-0.5" />
            <span>
              La extensión sumará {days} días a partir de hoy o de su fecha de vencimiento actual. Esta acción se registrará formalmente en los logs de auditoría.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-bg-dark/80 border-t border-border-base flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-text-main hover:bg-bg-card transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-accent-green hover:bg-accent-green/90 text-black shadow-md shadow-accent-green/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {mutation.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Aplicando...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                <span>Confirmar Extensión</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
