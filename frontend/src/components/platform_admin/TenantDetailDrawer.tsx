import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { PlatformOrganizationDetail } from '../../types/platform_admin';
import {
  X,
  Building,
  Users,
  Server,
  Shield,
  Clock,
  Mail,
  Phone,
  Globe,
  Lock,
  Layers,
  Activity,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Zap,
} from 'lucide-react';

interface TenantDetailDrawerProps {
  orgId: string | null;
  onClose: () => void;
}

export default function TenantDetailDrawer({
  orgId,
  onClose,
}: TenantDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'infrastructure' | 'audit'>('general');

  const { data: detail, isLoading } = useQuery<PlatformOrganizationDetail>({
    queryKey: ['platform-admin-org-detail', orgId],
    queryFn: async () => {
      const res = await api.get(`/platform-admin/organizations/${orgId}/`);
      return res.data?.data;
    },
    enabled: !!orgId,
  });

  if (!orgId) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-bg-card border-l border-border-base h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-6 border-b border-border-base flex items-start justify-between bg-bg-dark/70">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-accent-green/10 border border-accent-green/30 flex items-center justify-center text-accent-green shadow-inner">
              <Building size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-text-main">
                  {detail?.name || 'Cargando Organización...'}
                </h2>
                {detail && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-accent-green/15 text-accent-green border border-accent-green/30 font-mono">
                    {detail.plan_tier}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-dim font-mono mt-0.5">
                Slug: {detail?.slug} &bull; ID: {detail?.id?.substring(0, 8)}...
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-dim hover:text-text-main hover:bg-bg-dark rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-border-base bg-bg-dark/40 px-6 text-xs font-semibold">
          {[
            { id: 'general', label: 'General & Facturación', icon: Building },
            { id: 'users', label: `Usuarios (${detail?.users?.length || 0})`, icon: Users },
            { id: 'infrastructure', label: `Infraestructura (${detail?.targets?.length || 0})`, icon: Server },
            { id: 'audit', label: `Auditoría (${detail?.recent_audits?.length || 0})`, icon: Shield },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-all cursor-pointer ${
                  isActive
                    ? 'border-accent-green text-accent-green bg-accent-green/5'
                    : 'border-transparent text-text-dim hover:text-text-main'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-text-dim gap-3">
              <Loader2 size={32} className="animate-spin text-accent-green" />
              <span className="text-xs">Cargando telemetría del inquilino...</span>
            </div>
          ) : detail ? (
            <>
              {activeTab === 'general' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Subscription & SLA Card */}
                  <div className="p-4 rounded-2xl bg-bg-dark/70 border border-border-base space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
                      <Shield size={14} className="text-accent-green" />
                      Suscripción & Parámetros Operativos
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-text-dim block">Plan Activo:</span>
                        <span className="font-bold text-text-main uppercase font-mono">{detail.plan_tier}</span>
                      </div>
                      <div>
                        <span className="text-text-dim block">Estado Suscripción:</span>
                        <span className="font-bold text-accent-green uppercase font-mono">{detail.subscription_status}</span>
                      </div>
                      <div>
                        <span className="text-text-dim block">En Periodo Trial:</span>
                        <span className="font-mono text-text-main">{detail.is_in_trial ? `Sí (${detail.trial_days_remaining}d restantes)` : 'No'}</span>
                      </div>
                      <div>
                        <span className="text-text-dim block">Vencimiento Trial:</span>
                        <span className="font-mono text-text-muted">{detail.trial_ends_at ? new Date(detail.trial_ends_at).toLocaleDateString() : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-text-dim block">Meta Global SLA:</span>
                        <span className="font-bold text-accent-green font-mono">{detail.sla_target_percentage}%</span>
                      </div>
                      <div>
                        <span className="text-text-dim block">Fecha Registro:</span>
                        <span className="font-mono text-text-muted">{new Date(detail.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Limits & Quotas */}
                  <div className="p-4 rounded-2xl bg-bg-dark/70 border border-border-base space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
                      <Layers size={14} className="text-accent-blue" />
                      Límites de Cuota Asignados
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-text-dim block">Máx Targets Uptime/API:</span>
                        <span className="font-mono font-bold text-text-main">{detail.targets_count} / {detail.max_targets}</span>
                      </div>
                      <div>
                        <span className="text-text-dim block">Máx Agentes Satélite:</span>
                        <span className="font-mono font-bold text-accent-purple">{detail.probes_count} / {detail.max_probes}</span>
                      </div>
                      <div>
                        <span className="text-text-dim block">Máx Usuarios Equipo:</span>
                        <span className="font-mono font-bold text-text-main">{detail.users_count} / {detail.max_users}</span>
                      </div>
                      <div>
                        <span className="text-text-dim block">Frecuencia Mínima:</span>
                        <span className="font-mono font-bold text-text-main">{detail.limits?.min_interval}s</span>
                      </div>
                    </div>
                  </div>

                  {/* Billing & Contact */}
                  <div className="p-4 rounded-2xl bg-bg-dark/70 border border-border-base space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
                      <Mail size={14} className="text-accent-yellow" />
                      Contacto & Facturación
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-border-base/50 pb-1.5">
                        <span className="text-text-dim">Email de Facturación:</span>
                        <span className="font-mono text-text-main">{detail.billing_email || 'No registrado'}</span>
                      </div>
                      <div className="flex justify-between border-b border-border-base/50 pb-1.5">
                        <span className="text-text-dim">RUT / Tax ID:</span>
                        <span className="font-mono text-text-main">{detail.tax_id || 'No registrado'}</span>
                      </div>
                      <div className="flex justify-between border-b border-border-base/50 pb-1.5">
                        <span className="text-text-dim">Teléfono:</span>
                        <span className="font-mono text-text-main">{detail.contact_phone || 'No registrado'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-dim">Sitio Web:</span>
                        <span className="font-mono text-accent-green">{detail.website || 'No registrado'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'users' && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  {detail.users.map((u) => (
                    <div
                      key={u.id}
                      className="p-3.5 rounded-xl bg-bg-dark/70 border border-border-base flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-text-main">
                            {u.first_name} {u.last_name}
                          </span>
                          {u.is_staff && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-purple/20 text-accent-purple border border-accent-purple/30">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-text-dim font-mono truncate">{u.email}</p>
                      </div>
                      <div className="text-right font-mono text-[11px] text-text-dim shrink-0">
                        <span>Último login: {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Nunca'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'infrastructure' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                      Agentes Satélite On-Premise ({detail.probes.length})
                    </h4>
                    {detail.probes.length === 0 ? (
                      <p className="text-xs text-text-dim italic">No hay agentes satélite desplegados.</p>
                    ) : (
                      <div className="space-y-2">
                        {detail.probes.map((p) => (
                          <div
                            key={p.id}
                            className="p-3 rounded-xl bg-bg-dark border border-border-base flex items-center justify-between text-xs font-mono"
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${p.is_online ? 'bg-accent-green' : 'bg-zinc-600'}`} />
                              <span className="font-bold text-text-main">{p.name}</span>
                              <span className="text-text-dim">({p.ip_address || 'IP desconocida'})</span>
                            </div>
                            <span className="text-accent-purple text-[11px]">{p.version}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                      Targets Monitoreados ({detail.targets.length})
                    </h4>
                    {detail.targets.length === 0 ? (
                      <p className="text-xs text-text-dim italic">No hay objetivos de monitoreo registrados.</p>
                    ) : (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {detail.targets.map((t) => (
                          <div
                            key={t.id}
                            className="p-2.5 rounded-xl bg-bg-dark border border-border-base flex items-center justify-between text-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-text-main truncate max-w-[280px]">{t.name}</div>
                              <div className="text-[11px] text-text-dim font-mono truncate max-w-[280px]">{t.endpoint}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`font-mono text-xs font-bold ${t.last_status === 'up' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {t.last_latency !== null ? `${t.last_latency.toFixed(0)}ms` : '-'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'audit' && (
                <div className="space-y-2.5 animate-in fade-in duration-150">
                  {detail.recent_audits.length === 0 ? (
                    <p className="text-xs text-text-dim italic">Sin eventos de auditoría recientes.</p>
                  ) : (
                    detail.recent_audits.map((a) => (
                      <div
                        key={a.id}
                        className="p-3 rounded-xl bg-bg-dark/70 border border-border-base text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px] text-text-dim font-mono">
                          <span className="font-semibold text-text-muted">{a.user_email}</span>
                          <span>{new Date(a.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-text-main">{a.description}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
