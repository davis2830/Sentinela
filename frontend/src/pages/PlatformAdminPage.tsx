import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { PlatformStats, PlatformOrganization } from '../types/platform_admin';
import { useAuthStore } from '../store/authStore';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import {
  NOCPageHeader,
  NOCKpiGrid,
  NOCKpiCard,
  NOCToolbar,
} from '../components/common/noc';
import ExtendTrialModal from '../components/platform_admin/ExtendTrialModal';
import ChangeTenantPlanModal from '../components/platform_admin/ChangeTenantPlanModal';
import TenantDetailDrawer from '../components/platform_admin/TenantDetailDrawer';
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
  const user = useAuthStore((state) => state.user);

  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals & Drawer State
  const [selectedForTrial, setSelectedForTrial] = useState<PlatformOrganization | null>(null);
  const [selectedForPlan, setSelectedForPlan] = useState<PlatformOrganization | null>(null);
  const [inspectedOrgId, setInspectedOrgId] = useState<string | null>(null);

  // Auto-refresh hook (15s countdown)
  const autoRefresh = useAutoRefresh({
    intervalSeconds: 15,
    initialEnabled: true,
  });

  // Query: Stats
  const { data: stats, isLoading: isLoadingStats } = useQuery<PlatformStats>({
    queryKey: ['platform-admin-stats'],
    queryFn: async () => {
      const res = await api.get('/platform-admin/stats/');
      return res.data?.data;
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Query: Organizations List
  const { data: organizations, isLoading: isLoadingOrgs } = useQuery<PlatformOrganization[]>({
    queryKey: ['platform-admin-orgs', searchTerm, planFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      if (planFilter !== 'all') params.set('plan_tier', planFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await api.get(`/platform-admin/organizations/?${params.toString()}`);
      return res.data?.data || [];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Toggle Status Mutation (Suspend/Reactivate)
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ orgId, action }: { orgId: string; action: 'suspend' | 'reactivate' }) => {
      await api.post(`/platform-admin/organizations/${orgId}/toggle-status/`, { action });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-admin-orgs'] });
      queryClient.invalidateQueries({ queryKey: ['platform-admin-stats'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Error al cambiar estado.');
    },
  });

  const handleExportCSV = async () => {
    try {
      const res = await api.get('/platform-admin/export-csv/', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sentinel_tenants_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
      <NOCPageHeader
        title="Torre de Control de Plataforma"
        badgeText="SUPERADMIN CONSOLE"
        description="Centro de mando de organizaciones corporativas, gestión de planes, métricas financieras y salud de la plataforma."
        icon={<Crown size={26} className="text-accent-yellow" />}
        autoRefresh={{
          enabled: autoRefresh.enabled,
          countdown: autoRefresh.countdown,
          onToggle: autoRefresh.toggle,
        }}
        actions={
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

      {/* 2. SUPERADMIN FINANCIAL & PLATFORM KPI GRID */}
      <NOCKpiGrid columns={4}>
        {/* KPI 1: MRR Estimado */}
        <NOCKpiCard
          title="MRR Estimado"
          icon={<DollarSign size={16} className="text-accent-green" />}
          badge={{
            text: `ARR: $${(stats?.financials.arr_usd || 0).toLocaleString()} USD`,
            variant: 'success',
          }}
          value={`$${(stats?.financials.mrr_usd || 0).toLocaleString()} USD`}
          subtitle="Ingreso recurrente mensual estimado de suscripciones activas."
          progress={{
            value: Math.min(100, ((stats?.financials.mrr_usd || 0) / 5000) * 100),
            color: 'emerald',
          }}
        />

        {/* KPI 2: Total Organizaciones */}
        <NOCKpiCard
          title="Empresas & Tenants"
          icon={<Building size={16} className="text-sky-400" />}
          badge={{
            text: `+${stats?.organizations.recent_signups_30d || 0} este mes`,
            variant: 'info',
          }}
          value={`${stats?.organizations.total || 0} Tenants`}
          subtitle={`Pro: ${stats?.organizations.by_plan?.pro || 0} • Ent: ${stats?.organizations.by_plan?.enterprise || 0} • Free: ${stats?.organizations.by_plan?.free || 0}`}
        />

        {/* KPI 3: Carga Global de Monitoreo */}
        <NOCKpiCard
          title="Monitores Activos Globales"
          icon={<Activity size={16} className="text-accent-green" />}
          badge={{
            text: `${stats?.infrastructure.active_targets || 0} en ejecución`,
            variant: 'success',
          }}
          value={`${stats?.infrastructure.total_targets || 0} Targets`}
          subtitle="Total de endpoints HTTP/S y APIs monitoreados continuamente."
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
          { id: 'all', label: 'Todos los Estados', count: organizations?.length || 0, variant: 'all' },
          { id: 'active', label: 'Activos', count: organizations?.filter((o) => o.subscription_status === 'active').length || 0, variant: 'success' },
          { id: 'trialing', label: 'En Trial', count: organizations?.filter((o) => o.subscription_status === 'trialing').length || 0, variant: 'warning' },
          { id: 'suspended', label: 'Suspendidos', count: organizations?.filter((o) => o.subscription_status === 'suspended').length || 0, variant: 'danger' },
        ]}
        selectedStatus={statusFilter}
        onStatusChange={setStatusFilter}
      />

      {/* 4. TENANTS TABLE */}
      <div className="bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-main border-collapse">
            <thead>
              <tr className="border-b border-border-base bg-bg-dark/80 font-medium text-xs text-text-muted">
                <th className="py-3.5 px-4">Empresa & Inquilino</th>
                <th className="py-3.5 px-4">Plan</th>
                <th className="py-3.5 px-4">Estado / Facturación</th>
                <th className="py-3.5 px-4">Periodo de Prueba</th>
                <th className="py-3.5 px-4">Consumo de Cuotas</th>
                <th className="py-3.5 px-4">Fecha Registro</th>
                <th className="py-3.5 px-4 text-right">Acciones Superadmin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-base/50">
              {isLoadingOrgs ? (
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
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Suspendido
                          </span>
                        ) : org.subscription_status === 'active' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Trialing
                          </span>
                        )}
                      </td>

                      {/* Trial Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {org.is_in_trial ? (
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold font-mono text-accent-yellow">
                              {org.trial_days_remaining} días restantes
                            </span>
                            <div className="text-[11px] text-text-dim font-mono">
                              Vence: {org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString() : 'N/A'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-text-dim font-mono">Vencido / Activo</span>
                        )}
                      </td>

                      {/* Usage */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs font-mono">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-text-dim text-[11px]">Targets:</span>
                            <span className="font-bold text-text-main">{org.targets_count}/{org.max_targets}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-text-dim text-[11px]">Probes:</span>
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
                            onClick={() =>
                              toggleStatusMutation.mutate({
                                orgId: org.id,
                                action: isSuspended ? 'reactivate' : 'suspend',
                              })
                            }
                            className={`p-1.5 rounded-lg bg-bg-dark border transition-all ${
                              isSuspended
                                ? 'border-accent-green/30 text-accent-green hover:bg-accent-green/10'
                                : 'border-accent-red/30 text-accent-red hover:bg-accent-red/10'
                            }`}
                            title={isSuspended ? 'Reactivar organización' : 'Suspender organización'}
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

      {/* Modals & Drawer */}
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

      {inspectedOrgId && (
        <TenantDetailDrawer
          orgId={inspectedOrgId}
          onClose={() => setInspectedOrgId(null)}
        />
      )}
    </div>
  );
}
