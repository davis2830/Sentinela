import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { platformApi } from '../services/platformApi';
import type { PlatformStats, PlatformOrganization } from '../types/platform_admin';
import { usePlatformSession } from '../services/platformApi';
import {
  NOCPageHeader,
  NOCKpiGrid,
  NOCKpiCard,
  NOCToolbar,
} from '../components/common/noc';
import ExtendTrialModal from '../components/platform_admin/ExtendTrialModal';
import ChangeTenantPlanModal from '../components/platform_admin/ChangeTenantPlanModal';
import TenantDetailDrawer from '../components/platform_admin/TenantDetailDrawer';
import BetaAdminPanel from '../components/platform_admin/BetaAdminPanel';
import PlatformUsers from '../components/platform_admin/PlatformUsers';
import PlatformAudit from '../components/platform_admin/PlatformAudit';
import OrganizationDistribution, { subscriptionStates } from '../components/platform_admin/OrganizationDistribution';
import {
  Building,
  TrendingUp,
  DollarSign,
  Server,
  Users,
  Activity,
  Clock,
  Crown,
  PauseCircle,
  PlayCircle,
  Download,
  Search,
  Eye,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Radio,
  Sliders,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export default function PlatformAdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = usePlatformSession(state => state.session?.user);
  const [section, setSection] = useState('resumen');

  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals & Drawer State
  const [selectedForTrial, setSelectedForTrial] = useState<PlatformOrganization | null>(null);
  const [selectedForPlan, setSelectedForPlan] = useState<PlatformOrganization | null>(null);
  const [inspectedOrgId, setInspectedOrgId] = useState<string | null>(null);

  // Shared area clock; only stored data is consulted.

  // Query: Stats
  const { data: stats, isError: statsError, refetch: refreshStats } = useQuery<PlatformStats>({
    queryKey: ['platform-admin-stats', user?.id],
    enabled: section === 'resumen',
    queryFn: async () => {
      const res = await platformApi.get('/platform-admin/stats/');
      return res.data?.data;
    },
  });

  // Query: Organizations List
  const { data: organizations, isLoading: isLoadingOrgs, isError: organizationsError, refetch: refreshOrganizations } = useQuery<PlatformOrganization[]>({
    queryKey: ['platform-admin-orgs', user?.id, searchTerm, planFilter, statusFilter],
    enabled: section === 'organizaciones',
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      if (planFilter !== 'all') params.set('plan_tier', planFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await platformApi.get(`/platform-admin/organizations/?${params.toString()}`, { signal });
      return res.data?.data || [];
    },
  });

  // Toggle Status Mutation (Suspend/Reactivate)
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ orgId, action }: { orgId: string; action: 'suspend' | 'reactivate' }) => {
      await platformApi.post(`/platform-admin/organizations/${orgId}/toggle-status/`, { action });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-admin-orgs'] });
      queryClient.invalidateQueries({ queryKey: ['platform-admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['platform-admin-org-detail'] });
      queryClient.invalidateQueries({ queryKey: ['platform-admin-audit'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Error al cambiar estado.');
    },
  });

  function openDirectory(plan: string, status: string) {
    setPlanFilter(plan);
    setStatusFilter(status);
    setSearchTerm('');
    setSection('organizaciones');
  }

  const handleExportCSV = async () => {
    try {
      const res = await platformApi.get('/platform-admin/export-csv/', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sentinel_tenants_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      alert('Error al exportar CSV de clientes.');
    }
  };

  // Plan styling helper
  const getPlanBadge = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'business':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'pro':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans pb-10">
      {/* 1. TOP HEADER */}
      <NOCPageHeader queryKeys={["platform-admin-stats","platform-admin-orgs","platform-admin-users","platform-admin-audit"]}
        title="Administración SaaS"
        badgeText="SUPERADMIN"
        description="Gestiona organizaciones, suscripciones, usuarios y actividad de Sentinel."
        icon={<Crown size={26} className="text-accent-yellow" />}

        actions={section === 'organizaciones' &&
          <>
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-2 bg-bg-card border border-border-base text-text-muted hover:text-text-main font-medium px-4 py-2 rounded-full text-sm hover:bg-bg-dark transition-all shadow-sm"
              title="Descargar reporte completo de organizaciones en CSV"
            >
              <Download size={15} />
              <span>Exportar Reporte CSV</span>
            </button>
          </>
        }
      />

      <nav aria-label="Secciones de administración SaaS" className="flex flex-wrap gap-1 rounded-2xl border border-border-base bg-bg-card p-1.5">
        {[
          ['resumen', 'Resumen SaaS'], ['organizaciones', 'Organizaciones'], ['usuarios', 'Usuarios'],
          ['beta', 'Beta'], ['auditoria', 'Auditoría'],
        ].map(([id, label]) => <button type="button" key={id} aria-pressed={section === id}
          onClick={() => setSection(id)}
          className={`min-h-11 rounded-xl border px-4 text-sm font-medium ${section === id ? 'border-accent-green/40 bg-accent-green/10 text-accent-green' : 'border-transparent text-text-muted hover:bg-bg-card-hover hover:text-text-main'}`}>
          {label}
        </button>)}
      </nav>
      {section === 'beta' && <BetaAdminPanel />}
      {section === 'usuarios' && user && <PlatformUsers operatorId={user.id} onOpenOrganization={setInspectedOrgId} />}
      {section === 'auditoria' && user && <PlatformAudit operatorId={user.id} onOpenOrganization={setInspectedOrgId} />}
      {section === 'resumen' && statsError && <p role="alert">No se pudo cargar el resumen. <button onClick={() => void refreshStats()}>Reintentar</button></p>}
      {section === 'resumen' && !stats && !statsError && <p role="status">Cargando resumen SaaS…</p>}
      {section === 'resumen' && stats && <>
      <section className="ui-card p-4" aria-labelledby="customer-follow-up">
        <h2 id="customer-follow-up" className="text-base font-bold">Seguimiento de clientes</h2>
        <p className="mt-1 text-sm text-text-muted">Estados de suscripción. Los pagos confirmados y las fechas de cobro aún no están disponibles.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {['past_due', 'trialing', 'active'].map(id => {
            const state = subscriptionStates.find(item => item.id === id)!;
            return <li key={id}>
              <button type="button" data-tone={state.tone} onClick={() => openDirectory('all', id)}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-border-base px-3 text-left text-sm hover:bg-bg-card-hover">
                <span aria-hidden="true" className="ui-tone">●</span>
                <span className="flex-1">{state.label}</span>
                <strong className="ui-tone tabular-nums">{stats.organizations.by_status[id] ?? 0}</strong>
              </button>
            </li>;
          })}
        </ul>
      </section>

      {/* 2. SUPERADMIN FINANCIAL & PLATFORM KPI GRID */}
      <NOCKpiGrid columns={4}>
        {/* KPI 1: MRR Estimado */}
        <NOCKpiCard
          title="MRR estimado (no cobrado)"
          icon={<DollarSign size={16} className="text-accent-green" />}
          badge={{
            text: `ARR: $${(stats?.financials.arr_usd || 0).toLocaleString()} USD`,
            variant: 'success',
          }}
          value={`$${(stats?.financials.mrr_usd || 0).toLocaleString()} USD`}
          subtitle={`Estimación de suscripciones activas y con pago pendiente. ${stats.financials.quoted_organizations} bajo cotización.`}
        />

        {/* KPI 2: Total Organizaciones */}
        <NOCKpiCard
          title="Organizaciones y usuarios"
          icon={<Building size={16} className="text-sky-400" />}
          badge={{
            text: `+${stats.organizations.recent_signups_30d} en 30 días`,
            variant: 'info',
          }}
          value={`${stats.organizations.total} organizaciones`}
          subtitle={`${stats.infrastructure.total_users} usuarios registrados en la plataforma.`}
        />

        {/* KPI 3: Carga Global de Monitoreo */}
        <NOCKpiCard
          title="Monitores Activos Globales"
          icon={<Activity size={16} className="text-accent-green" />}
          badge={{
            text: `${stats?.infrastructure.active_targets || 0} habilitados`,
            variant: 'success',
          }}
          value={`${stats?.infrastructure.total_targets || 0} Targets`}
          subtitle="Recursos registrados en Uptime y Latencia."
        />

        {/* KPI 4: Red de Agentes Privados */}
        <NOCKpiCard
          title="Agentes Satélite LAN"
          icon={<Server size={16} className="text-accent-purple" />}
          badge={{
            text: `${stats?.infrastructure.online_probes || 0} Online`,
            variant: 'success',
          }}
          value={`${stats?.infrastructure.total_probes || 0} Probes`}
          subtitle="Agentes satélite desplegados en datacenters privados."
        />
      </NOCKpiGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <OrganizationDistribution title="Organizaciones por plan"
          rows={[{ id: 'free', label: 'Free' }, { id: 'pro', label: 'Pro' }, { id: 'business', label: 'Business' }, { id: 'enterprise', label: 'Enterprise' }]}
          counts={stats.organizations.by_plan} total={stats.organizations.total}
          onSelect={plan => openDirectory(plan, 'all')} />
        <OrganizationDistribution title="Estado de las suscripciones" rows={subscriptionStates}
          counts={stats.organizations.by_status} total={stats.organizations.total}
          onSelect={status => openDirectory('all', status)} />
      </div>
      </>}

      {section === 'organizaciones' && <>
      {/* 3. TOOLBAR WITH FILTERS & SEARCH */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por nombre de empresa, slug o email de facturación..."
        categories={[
          { id: 'all', label: 'Todos' },
          { id: 'enterprise', label: 'Enterprise' },
          { id: 'business', label: 'Business' },
          { id: 'pro', label: 'Pro' },
          { id: 'free', label: 'Free' },
        ]}
        categoryLabel="Plan:"
        selectedCategory={planFilter}
        onCategoryChange={setPlanFilter}
        statusPills={[
          { id: 'all', label: 'Todos los estados', variant: 'all' },
          ...subscriptionStates.map(({ id, label, tone }) => ({ id, label, variant: tone })),
        ]}
        selectedStatus={statusFilter}
        onStatusChange={setStatusFilter}
      />

      {/* 4. TENANTS TABLE */}
      <div className="bg-bg-card border border-border-base rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-main border-collapse">
            <thead>
              <tr className="border-b border-border-base bg-bg-dark/80 font-medium text-xs text-text-muted">
                <th className="py-3.5 px-4">Empresa & Inquilino</th>
                <th className="py-3.5 px-4">Plan</th>
                <th className="py-3.5 px-4">Suscripción</th>
                <th className="py-3.5 px-4">Periodo de Prueba</th>
                <th className="py-3.5 px-4">Consumo de Cuotas</th>
                <th className="py-3.5 px-4">Fecha Registro</th>
                <th className="py-3.5 px-4 text-right">Acciones Superadmin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-base/50">
              {organizationsError ? (
                <tr><td colSpan={7} className="p-6" role="alert">No se pudieron cargar las organizaciones. <button onClick={() => void refreshOrganizations()}>Reintentar</button></td></tr>
              ) : isLoadingOrgs ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-dim text-xs">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-accent-green" />
                    Cargando directorio de organizaciones...
                  </td>
                </tr>
              ) : organizations?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-dim text-xs">
                    No se encontraron organizaciones coincidentes con los filtros.
                  </td>
                </tr>
              ) : (
                organizations?.map((org) => {
                  const subscription = subscriptionStates.find(state => state.id === org.subscription_status);
                  const isSuspended = org.subscription_status === 'suspended';
                  return (
                    <tr
                      key={org.id}
                      className="hover:bg-bg-dark/50 transition-colors cursor-pointer"
                      onClick={() => setInspectedOrgId(org.id)}
                    >
                      {/* Company Name & Slug */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-accent-green/10 border border-accent-green/20 flex items-center justify-center text-accent-green font-bold text-xs shrink-0">
                            {org.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-text-main text-sm truncate max-w-[200px]" title={org.name}>
                              {org.name}
                            </div>
                            <div className="text-xs text-text-dim font-mono truncate max-w-[200px]">
                              {org.slug} &bull; {org.billing_email || 'Sin email'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Plan Tier */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase font-mono ${getPlanBadge(org.plan_tier)}`}>
                          {org.plan_tier}
                        </span>
                      </td>

                      {/* Subscription Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="ui-status" data-tone={subscription?.tone ?? 'muted'}>
                          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                          {subscription?.label ?? 'Estado desconocido'}
                        </span>
                      </td>

                      {/* Trial Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {org.is_in_trial ? (
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold font-mono text-accent-yellow">
                              {org.trial_days_remaining} días restantes
                            </span>
                            <div className="text-xs text-text-dim font-mono">
                              Vence: {org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString() : 'N/A'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-text-dim font-mono">Sin prueba vigente</span>
                        )}
                      </td>

                      {/* Usage */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs font-mono">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-text-dim text-xs">Targets:</span>
                            <span className="font-bold text-text-main">{org.targets_count}/{org.max_targets}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-text-dim text-xs">Probes:</span>
                            <span className="font-bold text-accent-purple">{org.probes_count}/{org.max_probes}</span>
                          </div>
                        </div>
                      </td>

                      {/* Created At */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-text-dim">
                        {new Date(org.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Extend Trial */}
                          <button
                            type="button"
                            onClick={() => setSelectedForTrial(org)}
                            className="p-1.5 rounded-lg bg-bg-dark border border-border-base text-accent-yellow hover:bg-accent-yellow/10 hover:border-accent-yellow/30 transition-all"
                            title="Extender periodo de prueba"
                          >
                            <Clock size={15} />
                          </button>

                          {/* Set Plan */}
                          <button
                            type="button"
                            onClick={() => setSelectedForPlan(org)}
                            className="p-1.5 rounded-lg bg-bg-dark border border-border-base text-accent-purple hover:bg-accent-purple/10 hover:border-accent-purple/30 transition-all"
                            title="Asignar Plan (Enterprise/Business/Pro)"
                          >
                            <Crown size={15} />
                          </button>

                          {/* Suspend / Reactivate */}
                          <button
                            type="button"
                            disabled={toggleStatusMutation.isPending}
                            onClick={() => {
                              const actionLabel = isSuspended ? 'reactivar' : 'suspender';
                              if (!window.confirm(`¿Quieres ${actionLabel} la suscripción de ${org.name}?`)) return;
                              toggleStatusMutation.mutate({
                                orgId: org.id,
                                action: isSuspended ? 'reactivate' : 'suspend',
                              });
                            }}
                            className={`p-1.5 rounded-lg bg-bg-dark border transition-all ${
                              isSuspended
                                ? 'border-accent-green/30 text-accent-green hover:bg-accent-green/10'
                                : 'border-accent-red/30 text-accent-red hover:bg-accent-red/10'
                            }`}
                            title={isSuspended ? 'Reactivar suscripción' : 'Suspender suscripción'}
                          >
                            {isSuspended ? <PlayCircle size={15} /> : <PauseCircle size={15} />}
                          </button>

                          {/* Inspect Detail */}
                          <button
                            type="button"
                            onClick={() => setInspectedOrgId(org.id)}
                            className="p-1.5 rounded-lg bg-bg-dark border border-border-base text-text-muted hover:text-text-main hover:border-zinc-600 transition-all"
                            title="Inspeccionar inquilino"
                          >
                            <Eye size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>}

      {/* Modals & Drawer */}
      {inspectedOrgId && (
        <TenantDetailDrawer
          orgId={inspectedOrgId}
          onClose={() => setInspectedOrgId(null)}
          onChangePlan={setSelectedForPlan}
          onExtendTrial={setSelectedForTrial}
        />
      )}

      {selectedForTrial && (
        <ExtendTrialModal
          organization={selectedForTrial}
          onClose={() => setSelectedForTrial(null)}
        />
      )}

      {selectedForPlan && (
        <ChangeTenantPlanModal
          organization={selectedForPlan}
          onClose={() => setSelectedForPlan(null)}
        />
      )}

    </div>
  );
}
