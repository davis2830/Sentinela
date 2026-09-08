import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { PlatformOrganization } from '../../types/platform_admin';
import { X, Crown, ShieldCheck, AlertCircle, Loader2, Check } from 'lucide-react';

interface ChangeTenantPlanModalProps {
  organization: PlatformOrganization | null;
  onClose: () => void;
}

export default function ChangeTenantPlanModal({
  organization,
  onClose,
}: ChangeTenantPlanModalProps) {
  const queryClient = useQueryClient();
  const [planTier, setPlanTier] = useState<string>(organization?.plan_tier || 'pro');
  const [status, setStatus] = useState<string>(organization?.subscription_status || 'active');

  const mutation = useMutation({
    mutationFn: async () => {
      if (!organization) return;
      await api.post(`/platform-admin/organizations/${organization.id}/set-plan/`, {
        plan_tier: planTier,
        subscription_status: status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-admin-orgs'] });
      queryClient.invalidateQueries({ queryKey: ['platform-admin-stats'] });
      onClose();
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Error al actualizar el plan.');
    },
  });

  if (!organization) return null;

  const plans = [
    { id: 'free', name: 'Free Tier', price: '$0/mes', color: 'border-zinc-700' },
    { id: 'pro', name: 'Pro', price: '$29/mes', color: 'border-accent-green' },
    { id: 'business', name: 'Business', price: '$99/mes', color: 'border-accent-blue' },
    { id: 'enterprise', name: 'Enterprise Custom', price: '$299/mes', color: 'border-accent-purple' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-bg-card border border-border-base rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border-base flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-purple/10 border border-accent-purple/30 flex items-center justify-center text-accent-purple shadow-inner">
              <Crown size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-main">
                Asignación Manual de Plan
              </h3>
              <p className="text-xs text-text-muted mt-0.5 truncate max-w-[300px]">
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
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-2">
              Selecciona el Nivel de Suscripción
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {plans.map((p) => {
                const isSelected = planTier === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlanTier(p.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'bg-accent-green/10 border-accent-green ring-1 ring-accent-green/40 shadow-sm'
                        : 'bg-bg-dark border-border-base hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-text-main">{p.name}</span>
                      {isSelected && <Check size={14} className="text-accent-green" />}
                    </div>
                    <span className="text-[11px] font-mono text-accent-green font-semibold">
                      {p.price}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Estado de Facturación
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-xs text-text-main focus:outline-none focus:border-accent-green cursor-pointer font-mono"
            >
              <option value="active">ACTIVE (Suscripción activa / pagada)</option>
              <option value="trialing">TRIALING (En periodo de prueba)</option>
              <option value="past_due">PAST_DUE (Pago pendiente de procesamiento)</option>
              <option value="suspended">SUSPENDED (Acceso temporalmente suspendido)</option>
            </select>
          </div>

          <div className="p-3 bg-bg-dark rounded-xl border border-border-base/50 text-[11px] text-text-dim">
            Al asignar manualmente un plan Enterprise o Business, los límites de targets, monitores de latencia, retención TimescaleDB y agentes satélite se ajustarán automáticamente de acuerdo a las cuotas del sistema.
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
                <span>Actualizando...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={14} />
                <span>Guardar Cambios</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
