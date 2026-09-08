import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { SubscriptionSummary } from '../../types/organization';
import {
  X,
  Check,
  Zap,
  Shield,
  Server,
  Layers,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface UpgradePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: string;
  subscriptionSummary?: SubscriptionSummary;
  initialReason?: string;
}

export default function UpgradePlanModal({
  isOpen,
  onClose,
  currentTier,
  subscriptionSummary,
  initialReason,
}: UpgradePlanModalProps) {
  const queryClient = useQueryClient();
  const [selectedTier, setSelectedTier] = useState<string>(currentTier);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const changePlanMutation = useMutation({
    mutationFn: async (tier: string) => {
      const res = await api.post('organizations/current/change-plan/', { plan_tier: tier });
      return res.data;
    },
    onSuccess: (data) => {
      setSuccessMsg(`Plan actualizado exitosamente a ${data?.data?.plan_name || selectedTier.toUpperCase()}`);
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['org-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['current-organization'] });
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 1400);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'Error al procesar el cambio de plan.');
    },
  });

  if (!isOpen) return null;

  const plans = [
    {
      tier: 'free',
      name: 'Starter / Free',
      badge: 'Básico',
      badgeColor: 'text-text-muted bg-white/5 border-white/10',
      price: '$0',
      period: 'por siempre',
      description: 'Para desarrolladores independientes y proyectos personales que requieren monitoreo básico.',
      features: [
        '5 Monitores de Uptime',
        'Frecuencia de 5 minutos',
        '2 Certificados SSL',
        '1 API Check sintético',
        '1 Status Page (con marca de agua)',
        '7 días de retención de métricas',
        '1 Miembro de equipo',
      ],
      notIncluded: [
        'Agentes satélite on-premise',
        'Ventanas de mantenimiento',
        'Reportes de SLA ejecutivos',
        'Análisis RCA post-mortem',
      ],
    },
    {
      tier: 'pro',
      name: 'Pro / Growth',
      badge: 'Popular',
      badgeColor: 'text-accent-blue bg-accent-blue/10 border-accent-blue/30',
      price: '$29',
      period: 'USD / mes',
      description: 'Ideal para startups, agencias y tiendas en línea con servicios críticos de cara al cliente.',
      features: [
        '25 Monitores de Uptime',
        'Frecuencia de 1 minuto (60s)',
        '10 Certificados SSL multi-puerto',
        '5 API Checks sintéticos',
        '1 Agente Satélite Privado (LAN)',
        '2 Status Pages con dominio custom',
        '30 días de retención en TimescaleDB',
        '5 Miembros de equipo',
        'Reportes de SLA ejecutivos',
      ],
      notIncluded: [
        'Ventanas de mantenimiento',
        'Análisis RCA post-mortem',
      ],
    },
    {
      tier: 'business',
      name: 'Business',
      badge: 'Recomendado',
      badgeColor: 'text-accent-green bg-accent-green/10 border-accent-green/30',
      price: '$99',
      period: 'USD / mes',
      description: 'Para empresas en crecimiento y equipos DevOps/SRE que necesitan observabilidad profunda 24/7.',
      features: [
        '75 Monitores de Uptime',
        'Frecuencia de 30 segundos',
        '50 Certificados SSL multi-puerto',
        '25 API Checks sintéticos con JSON schema',
        '3 Agentes Satélite Privados (On-Premise)',
        '10 Status Pages públicas y privadas',
        '90 días de retención histórica',
        '15 Miembros de equipo con roles',
        'Ventanas de Mantenimiento con supresión',
        'Análisis de Causa Raíz (RCA Post-Mortem)',
      ],
      notIncluded: [],
    },
    {
      tier: 'enterprise',
      name: 'Enterprise Dedicated',
      badge: 'Corporativo',
      badgeColor: 'text-accent-purple bg-accent-purple/10 border-accent-purple/30',
      price: '$399',
      period: 'USD / mes',
      description: 'Para bancos, fintechs y corporativos que exigen SLA 99.99%, retención ISO 27001 y soporte VIP.',
      features: [
        'Monitores de Uptime ilimitados',
        'Frecuencia ultra rápida (15 segundos)',
        'Certificados SSL ilimitados',
        'API Checks sintéticos ilimitados',
        'Agentes Satélite Privados ilimitados',
        'Status Pages ilimitadas con SSO',
        '365 días de retención (Auditoría ISO)',
        'Usuarios y Cuadrillas ilimitadas',
        'SLA 99.99% garantizado contractualmente',
        'Soporte prioritario 24/7 con canal dedicado',
      ],
      notIncluded: [],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-bg-card border border-border-base rounded-3xl w-full max-w-6xl overflow-hidden shadow-2xl my-8 animate-in fade-in duration-200">
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-border-base bg-gradient-to-r from-bg-card via-bg-card-hover to-bg-card flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-accent-green/10 text-accent-green border border-accent-green/30 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} />
                Planes & Suscripción
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-text-main">
              Escala la Observabilidad de tu Infraestructura
            </h2>
            <p className="text-text-muted text-sm mt-1 max-w-2xl">
              {initialReason ||
                'Selecciona el nivel de plan adecuado para las demandas operativas y el tamaño de tu equipo.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-main rounded-xl hover:bg-white/5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Feedback messages */}
        {successMsg && (
          <div className="mx-6 mt-6 p-4 rounded-2xl bg-accent-green/10 border border-accent-green/30 text-accent-green flex items-center gap-3 text-sm">
            <CheckCircle2 size={18} />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mx-6 mt-6 p-4 rounded-2xl bg-accent-red/10 border border-accent-red/30 text-accent-red flex items-center gap-3 text-sm">
            <AlertCircle size={18} />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {/* Plan Cards Grid */}
        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((p) => {
            const isCurrent = currentTier === p.tier;
            const isSelected = selectedTier === p.tier;

            return (
              <div
                key={p.tier}
                onClick={() => setSelectedTier(p.tier)}
                className={`relative rounded-2xl p-6 border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-bg-card-hover border-accent-green shadow-lg shadow-accent-green/5 ring-1 ring-accent-green'
                    : 'bg-bg-dark/60 border-border-base hover:border-border-accent hover:bg-bg-card-hover/40'
                }`}
              >
                {/* Badge top */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${p.badgeColor}`}>
                      {p.badge}
                    </span>
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-accent-blue/10 text-accent-blue border border-accent-blue/30">
                        Plan Actual
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-text-main">{p.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-text-main tracking-tight font-mono">
                      {p.price}
                    </span>
                    <span className="text-xs text-text-dim">{p.period}</span>
                  </div>
                  <p className="text-text-muted text-xs mt-3 leading-relaxed min-h-[48px]">
                    {p.description}
                  </p>

                  <div className="my-5 border-t border-border-base/60" />

                  {/* Feature checkmarks */}
                  <ul className="space-y-2.5">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-text-muted">
                        <Check size={14} className="text-accent-green shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                    {p.notIncluded.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-text-dim/60 line-through">
                        <X size={14} className="text-text-dim/40 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Select / Active Button */}
                <div className="mt-6 pt-4 border-t border-border-base/60">
                  {isCurrent ? (
                    <div className="w-full py-2.5 text-center text-xs font-semibold text-text-muted bg-white/5 rounded-xl border border-white/10">
                      Suscripción Activa
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTier(p.tier);
                        changePlanMutation.mutate(p.tier);
                      }}
                      disabled={changePlanMutation.isPending}
                      className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        p.tier === 'business' || p.tier === 'enterprise'
                          ? 'bg-accent-green text-black hover:bg-accent-green-glow shadow-md shadow-accent-green/20'
                          : 'bg-white/10 text-text-main hover:bg-white/20'
                      }`}
                    >
                      {changePlanMutation.isPending && selectedTier === p.tier ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Actualizando...
                        </>
                      ) : (
                        <>
                          Cambiar a {p.name.split('/')[0].trim()}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="p-6 bg-bg-dark/40 border-t border-border-base flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-dim">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-accent-blue shrink-0" />
            <span>Facturación transparente. Puedes actualizar o cancelar tu suscripción en cualquier momento.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-muted hover:text-text-main rounded-xl border border-border-base hover:bg-white/5 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
