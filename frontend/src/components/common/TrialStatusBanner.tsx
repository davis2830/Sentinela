import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { SubscriptionSummary } from '../../types/organization';
import UpgradePlanModal from '../organization/UpgradePlanModal';
import { Clock, AlertTriangle, Zap, Sparkles, ArrowRight, ShieldAlert } from 'lucide-react';

export default function TrialStatusBanner() {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const { data: subData, isLoading } = useQuery<SubscriptionSummary>({
    queryKey: ['subscription-summary'],
    queryFn: async () => {
      const res = await api.get('/organizations/current/subscription/');
      return res.data?.data || res.data;
    },
    staleTime: 60000,
  });

  if (isLoading || !subData) {
    return null;
  }

  const isPastDue = subData.subscription_status === 'past_due';
  const isInTrial = subData.is_in_trial || subData.subscription_status === 'trialing';
  const daysRemaining = subData.trial_days_remaining ?? 0;
  const isExpiringSoon = isInTrial && daysRemaining <= 3 && !isPastDue;

  // If active with no imminent expiration, or dismissed (only allowed for warning, past_due is never dismissible)
  if (!isPastDue && (!isExpiringSoon || dismissed)) {
    return null;
  }

  return (
    <>
      <div
        className={`w-full rounded-2xl p-4 md:p-5 border transition-all duration-300 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 ${
          isPastDue
            ? 'bg-gradient-to-r from-accent-red/15 via-bg-card to-accent-red/5 border-accent-red/40 shadow-accent-red/10 text-text-main'
            : 'bg-gradient-to-r from-accent-yellow/15 via-bg-card to-accent-yellow/5 border-accent-yellow/40 shadow-accent-yellow/10 text-text-main'
        }`}
      >
        <div className="flex items-start sm:items-center gap-3.5">
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              isPastDue
                ? 'bg-accent-red/20 text-accent-red border border-accent-red/30'
                : 'bg-accent-yellow/20 text-accent-yellow border border-accent-yellow/30'
            }`}
          >
            {isPastDue ? (
              <ShieldAlert size={22} className="animate-pulse" />
            ) : (
              <Clock size={22} className="animate-pulse" />
            )}
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold tracking-wide">
                {isPastDue
                  ? 'Suscripción Expirada &bull; Monitoreo en Segundo Plano Pausado'
                  : daysRemaining <= 0
                  ? 'Tu Periodo de Prueba Finaliza Hoy'
                  : `Periodo de Prueba: Te ${daysRemaining === 1 ? 'queda' : 'quedan'} ${daysRemaining} ${
                      daysRemaining === 1 ? 'día' : 'días'
                    }`}
              </h4>
              <span
                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                  isPastDue
                    ? 'bg-accent-red/20 text-accent-red border-accent-red/40'
                    : 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/40'
                }`}
              >
                {isPastDue ? 'Past Due' : 'Trial'}
              </span>
            </div>
            <p className="text-xs text-text-muted max-w-3xl">
              {isPastDue
                ? 'El periodo de prueba de tu organización ha concluido. Para optimizar infraestructura, los chequeos automáticos (Uptime, SSL, DNS, APIs y Cabeceras) están pausados. Actualiza tu plan para reactivarlos inmediatamente.'
                : `Estás explorando Sentinel bajo el plan ${subData.plan_name}. Actualiza a un plan de pago antes de que venza el periodo de prueba para garantizar la continuidad operativa de tus servicios y alertas 24/7.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center w-full sm:w-auto">
          {!isPastDue && (
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="text-xs text-text-dim hover:text-text-muted px-3 py-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            >
              Recordar luego
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowUpgradeModal(true)}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs tracking-wide transition-all shadow-lg cursor-pointer w-full sm:w-auto hover:scale-[1.02] active:scale-[0.98] ${
              isPastDue
                ? 'bg-accent-red hover:bg-accent-red/90 text-white shadow-accent-red/20'
                : 'bg-accent-yellow hover:bg-accent-yellow/90 text-black shadow-accent-yellow/20'
            }`}
          >
            {isPastDue ? <Zap size={15} /> : <Sparkles size={15} />}
            <span>{isPastDue ? 'Reactivar Monitoreo' : 'Actualizar Plan'}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <UpgradePlanModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentTier={subData.plan_tier}
        subscriptionSummary={subData}
      />
    </>
  );
}
