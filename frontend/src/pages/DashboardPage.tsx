import ScanAction from '../components/common/ScanAction';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, Info, RefreshCw, Rocket, Sparkles, X } from 'lucide-react';
import { api } from '../services/api';
import type { MonitoringTarget } from '../types/monitoring';
import type { SSLCertificate } from '../types/ssl';
import type { DomainInfo } from '../types/domain';
import type { APICheckTarget } from '../types/api_checks';
import type { SecurityHeaderTarget } from '../types/security_headers';
import type { DNSRecord } from '../types/dns';
import type { Alert } from '../types/alerts';
import type { Incident } from '../types/incidents';
import type { AgentProbe } from '../types/agent_probe';
import QuickStartWizardModal from '../components/onboarding/QuickStartWizardModal';
import TrialStatusBanner from '../components/common/TrialStatusBanner';
import TwoFactorReminderBanner from '../components/common/TwoFactorReminderBanner';
import { NOCDrawer } from '../components/common/noc';
import { useConnectivityRefresh } from '../hooks/useConnectivityRefresh';
import { latestTimestamp, scheduledFreshness } from '../utils/dashboardFreshness';
import { waitForFreshScan, type QueuedScan } from '../utils/scanPolling';
import { useAuthStore } from '../store/authStore';
import {
  buildDashboardActivityEvents,
  buildDashboardItems,
  isAttentionItem,
  type AuditLogItem,
  type DashboardAttentionItem,
  type DashboardFilterState,
  type DashboardModuleFilter,
  type DashboardRawItem,
  type DashboardSourceData,
} from '../utils/dashboardModel';
import NOCDashboardHeader from '../components/dashboard/NOCDashboardHeader';
import NOCExecutiveKpis from '../components/dashboard/NOCExecutiveKpis';
import NOCPerformanceSection from '../components/dashboard/NOCPerformanceSection';
import NOCServicesBar, { type ServiceCategoryMetric } from '../components/dashboard/NOCServicesBar';
import NOCInfraHealthDonut from '../components/dashboard/NOCInfraHealthDonut';
import NOCRecentActivityFeed from '../components/dashboard/NOCRecentActivityFeed';
import NOCOperationalInbox from '../components/dashboard/NOCOperationalInbox';

type TimeRange = '1h' | '6h' | '24h' | '7d';
interface GlobalPerformance {
  period: string;
  summary: { avg_uptime: number | null; avg_latency: number | null; total_checks: number; checks_per_minute: number };
  points: Array<{ timestamp: number; time: string; uptime: number | null; latency: number | null; checks: number; checks_per_minute: number }>;
}

const rangeMilliseconds: Record<TimeRange, number> = { '1h': 3_600_000, '6h': 21_600_000, '24h': 86_400_000, '7d': 604_800_000 };

function listFromResponse<T>(response: { data?: { data?: T[] } }) { return response.data?.data ?? []; }

function scanConfig(item: DashboardAttentionItem) {
  const config: Partial<Record<DashboardAttentionItem['type'], { endpoint: string; timestamp: (resource: DashboardRawItem) => string | null | undefined }>> = {
    monitoring: { endpoint: 'monitoring', timestamp: (resource) => (resource as MonitoringTarget).last_checked_at },
    api_check: { endpoint: 'api-checks', timestamp: (resource) => (resource as APICheckTarget).last_checked_at },
    ssl: { endpoint: 'ssl-certificates', timestamp: (resource) => (resource as SSLCertificate).last_scanned_at },
    domain: { endpoint: 'domains', timestamp: (resource) => (resource as DomainInfo).last_scanned_at },
    dns: { endpoint: 'dns-records', timestamp: (resource) => (resource as DNSRecord).last_scanned_at },
    security: { endpoint: 'security-headers', timestamp: (resource) => (resource as SecurityHeaderTarget).last_checked_at },
  };
  return config[item.type];
}

const scanResourceRoutes: Partial<Record<DashboardAttentionItem['type'], string>> = {monitoring:'monitoring',api_check:'api-checks',ssl:'ssl-certificates',domain:'domains',dns:'dns-records',security:'security-headers'};

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const canManage = Boolean(user?.is_staff);
  const autoRefresh = useConnectivityRefresh();
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [filters, setFilters] = useState<DashboardFilterState>({ view: 'attention', health: null, module: null });
  const [selectedItem, setSelectedItem] = useState<DashboardAttentionItem | null>(null);
  const [showQuickStartWizard, setShowQuickStartWizard] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    window.setTimeout(() => setNotification(null), 4500);
  }, []);

  const queryOptions = { refetchInterval: autoRefresh.refetchInterval };
  const monitoringQuery = useQuery<MonitoringTarget[]>({ queryKey: ['dash-monitoring', user?.organization?.id], queryFn: async () => listFromResponse<MonitoringTarget>(await api.get('monitoring/')), ...queryOptions });
  const subscriptionQuery = autoRefresh.subscriptionQuery;
  const onboardingKey = `sentinel_onboarding:${user?.id}`;
  const canSetup = canManage && subscriptionQuery.isSuccess && subscriptionQuery.data?.monitoring_allowed === true;
  useEffect(() => {
    if (!user?.id || !canSetup || !monitoringQuery.isSuccess || monitoringQuery.data.length !== 0) return;
    if (!localStorage.getItem(onboardingKey)) setShowQuickStartWizard(true);
  }, [user?.id, canSetup, monitoringQuery.isSuccess, monitoringQuery.data, onboardingKey]);
  const closeOnboarding = () => {
    if (localStorage.getItem(onboardingKey) !== 'completed') localStorage.setItem(onboardingKey, 'dismissed');
    localStorage.removeItem('sentinel_launch_onboarding');
    localStorage.removeItem('sentinela_launch_onboarding');
    setShowQuickStartWizard(false);
  };
  const apiQuery = useQuery<APICheckTarget[]>({ queryKey: ['dash-api-checks', user?.organization?.id], queryFn: async () => listFromResponse<APICheckTarget>(await api.get('api-checks/')), ...queryOptions });
  const sslQuery = useQuery<SSLCertificate[]>({ queryKey: ['dash-ssl', user?.organization?.id], queryFn: async () => listFromResponse<SSLCertificate>(await api.get('ssl-certificates/')), ...queryOptions });
  const domainQuery = useQuery<DomainInfo[]>({ queryKey: ['dash-domains', user?.organization?.id], queryFn: async () => listFromResponse<DomainInfo>(await api.get('domains/')), ...queryOptions });
  const dnsQuery = useQuery<DNSRecord[]>({ queryKey: ['dash-dns-records', user?.organization?.id], queryFn: async () => listFromResponse<DNSRecord>(await api.get('dns-records/')), ...queryOptions });
  const securityQuery = useQuery<SecurityHeaderTarget[]>({ queryKey: ['dash-sec-headers', user?.organization?.id], queryFn: async () => listFromResponse<SecurityHeaderTarget>(await api.get('security-headers/')), ...queryOptions });
  const alertsQuery = useQuery<Alert[]>({ queryKey: ['dash-active-alerts', user?.organization?.id], queryFn: async () => listFromResponse<Alert>(await api.get('alerts/?status=active')), ...queryOptions });
  const incidentsQuery = useQuery<Incident[]>({ queryKey: ['dash-open-incidents', user?.organization?.id], queryFn: async () => listFromResponse<Incident>(await api.get('incidents/')).filter((item) => item.status !== 'resolved' && item.status !== 'closed'), ...queryOptions });
  const agentsQuery = useQuery<AgentProbe[]>({ queryKey: ['dash-agents', user?.organization?.id], queryFn: async () => listFromResponse<AgentProbe>(await api.get('agent-probes/')), ...queryOptions });
  const auditQuery = useQuery<AuditLogItem[]>({ queryKey: ['dash-audit', user?.organization?.id], queryFn: async () => listFromResponse<AuditLogItem>(await api.get('audit-logs/?limit=25')), ...queryOptions });
  const performanceQuery = useQuery<GlobalPerformance>({ queryKey: ['dash-global-perf', user?.organization?.id, timeRange], queryFn: async () => (await api.get('monitoring/global-performance/', { params: { period: timeRange } })).data?.data, ...queryOptions });

  const source = useMemo<DashboardSourceData>(() => ({
    monitoring: monitoringQuery.data ?? [], apiChecks: apiQuery.data ?? [], ssl: sslQuery.data ?? [], domains: domainQuery.data ?? [], dns: dnsQuery.data ?? [], security: securityQuery.data ?? [], alerts: alertsQuery.data ?? [], incidents: incidentsQuery.data ?? [], agents: agentsQuery.data ?? [],
  }), [monitoringQuery.data, apiQuery.data, sslQuery.data, domainQuery.data, dnsQuery.data, securityQuery.data, alertsQuery.data, incidentsQuery.data, agentsQuery.data]);

  const allItems = useMemo(() => buildDashboardItems(source), [source]);
  const attentionItems = useMemo(() => allItems.filter(isAttentionItem), [allItems]);
  const visibleItems = useMemo(() => allItems.filter((item) => {
    if (filters.view === 'attention' && !isAttentionItem(item)) return false;
    if (filters.health && item.health !== filters.health) return false;
    if (filters.module && item.module !== filters.module) return false;
    return true;
  }), [allItems, filters]);

  const activityEvents = useMemo(() => {
    const cutoff = Date.now() - rangeMilliseconds[timeRange];
    return buildDashboardActivityEvents(source, auditQuery.data ?? []).filter((event) => event.occurredAt >= cutoff);
  }, [source, auditQuery.data, timeRange]);

  const queryList = [monitoringQuery, apiQuery, sslQuery, domainQuery, dnsQuery, securityQuery, alertsQuery, incidentsQuery, agentsQuery, auditQuery, performanceQuery];
  const hasTelemetryError = queryList.some((query) => query.isError);
  const hasOperationalStateError = [monitoringQuery, apiQuery, sslQuery, domainQuery, dnsQuery, securityQuery, agentsQuery].some((query) => query.isError);
  const isStateLoading = [monitoringQuery, apiQuery, sslQuery, domainQuery, dnsQuery, securityQuery, alertsQuery, incidentsQuery, agentsQuery].some((query) => query.isLoading);
  const operationalItems = allItems.filter((item) => item.type !== 'alert' && item.type !== 'incident');
  const healthCounts = {
    healthy: operationalItems.filter((item) => item.health === 'healthy').length,
    degraded: operationalItems.filter((item) => item.health === 'degraded').length,
    down: operationalItems.filter((item) => item.health === 'down').length,
    unknown: operationalItems.filter((item) => item.health === 'unknown').length,
  };
  const healthScore = !hasOperationalStateError && operationalItems.length ? Math.round(healthCounts.healthy / operationalItems.length * 100) : null;
  const criticalCount = attentionItems.filter((item) => item.severity === 'critical').length;

  const services = useMemo(() => {
    const keys: Array<Exclude<DashboardModuleFilter, 'alerts'>> = ['web', 'api', 'tcp', 'ssl', 'dns', 'domain', 'security', 'agent'];
    const queries = {web:monitoringQuery,api:apiQuery,tcp:monitoringQuery,ssl:sslQuery,dns:dnsQuery,domain:domainQuery,security:securityQuery,agent:agentsQuery};
    return Object.fromEntries(keys.map((key) => {
      const resources = operationalItems.filter((item) => item.module === key);
      return [key, { count: resources.filter((item) => item.health === 'healthy').length, total: resources.length, attention: resources.filter(isAttentionItem).length, degraded:resources.filter(item=>item.health==='degraded').length, down:resources.filter(item=>item.health==='down').length, unknown:resources.filter(item=>item.health==='unknown').length, unavailable:queries[key].isError, loading:queries[key].isLoading } satisfies ServiceCategoryMetric];
    })) as Record<Exclude<DashboardModuleFilter, 'alerts'>, ServiceCategoryMetric>;
  }, [operationalItems,monitoringQuery.isError,monitoringQuery.isLoading,apiQuery.isError,apiQuery.isLoading,sslQuery.isError,sslQuery.isLoading,dnsQuery.isError,dnsQuery.isLoading,domainQuery.isError,domainQuery.isLoading,securityQuery.isError,securityQuery.isLoading,agentsQuery.isError,agentsQuery.isLoading]);

  const lastSampleAt = latestTimestamp([
    ...source.monitoring.map((item) => item.last_checked_at), ...source.apiChecks.map((item) => item.last_checked_at), ...source.ssl.map((item) => item.last_scanned_at), ...source.domains.map((item) => item.last_scanned_at), ...source.dns.map((item) => item.last_scanned_at), ...source.security.map((item) => item.last_checked_at), ...source.agents.map((item) => item.last_heartbeat),
  ]);
  const headerFreshness = scheduledFreshness([
    ...source.monitoring.map((item) => ({ enabled: item.enabled, last_checked_at: item.last_checked_at, intervalSeconds: item.interval })),
    ...source.apiChecks.map((item) => ({ enabled: item.enabled, last_checked_at: item.last_checked_at, intervalSeconds: item.check_interval })),
  ], monitoringQuery.isError || apiQuery.isError);

  const refetchAll = useCallback(async () => {
    setIsRefreshing(true);
    const results = await Promise.all([...queryList, subscriptionQuery].map((query) => query.refetch()));
    const failed = results.some((result) => result.isError);
    notify(failed ? 'Actualización parcial: uno o más módulos no respondieron.' : 'Datos guardados consultados; no se ejecutaron sondeos.', failed ? 'error' : 'success');
    setIsRefreshing(false);
  }, [queryList, subscriptionQuery, notify]);

  const scanMutation = useMutation({
    mutationFn: async (item: DashboardAttentionItem) => {
      const config = scanConfig(item);
      if (!config) throw new Error('Este recurso no admite re-escaneo desde el dashboard.');
      setPendingKey(item.key);
      const response = await api.post(`${config.endpoint}/${item.id}/scan/`);
      const queued = response.data?.data as QueuedScan;
      return waitForFreshScan<DashboardRawItem>(queued, async () => (await api.get(`${config.endpoint}/${item.id}/`)).data?.data as DashboardRawItem, config.timestamp);
    },
    onSuccess: (fresh) => {
      queryClient.invalidateQueries({ queryKey: ['dash-monitoring', user?.organization?.id] }); queryClient.invalidateQueries({ queryKey: ['dash-api-checks', user?.organization?.id] }); queryClient.invalidateQueries({ queryKey: ['dash-ssl', user?.organization?.id] }); queryClient.invalidateQueries({ queryKey: ['dash-domains', user?.organization?.id] }); queryClient.invalidateQueries({ queryKey: ['dash-dns-records', user?.organization?.id] }); queryClient.invalidateQueries({ queryKey: ['dash-sec-headers', user?.organization?.id] }); queryClient.invalidateQueries({ queryKey: ['dash-global-perf', user?.organization?.id] });
      notify(fresh ? 'Re-escaneo completado y datos actualizados.' : 'El escaneo continúa en cola; el auto-refresh actualizará el resultado.', fresh ? 'success' : 'info');
    },
    onError: (error: any) => notify(error.response?.data?.message || 'No fue posible solicitar el re-escaneo.', error.response?.status === 429 ? 'info' : 'error'),
    onSettled: () => setPendingKey(null),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (item: DashboardAttentionItem) => api.patch(`alerts/${item.id}/`, { status: 'acknowledged' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dash-active-alerts', user?.organization?.id] }); queryClient.invalidateQueries({ queryKey: ['dash-audit', user?.organization?.id] }); setSelectedItem(null); notify('Alerta reconocida.', 'success'); },
    onError: () => notify('No fue posible reconocer la alerta.', 'error'),
  });

  const setHealthFilter = (health: DashboardFilterState['health']) => setFilters((current) => ({ ...current, health, view: health === 'healthy' ? 'all' : current.view }));
  const setModuleFilter = (module: DashboardModuleFilter | null) => setFilters((current) => ({ ...current, module }));
  const openModule = (path: string) => navigate(path);

  return <div className="space-y-3 pb-6" data-testid="dashboard-page">
    <NOCDashboardHeader lastConsultedAt={Math.max(0, ...queryList.map(query => query.dataUpdatedAt))} onRefreshAll={refetchAll} isRefreshing={isRefreshing} activeAlertsCount={source.alerts.length} timeRange={timeRange} onTimeRangeChange={setTimeRange} hasTelemetryError={hasTelemetryError} lastSampleAt={lastSampleAt} freshnessState={headerFreshness.state} autoRefresh={autoRefresh} />

    {notification && <div role="status" className={`fixed right-5 top-5 z-[70] flex max-w-sm items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl ${notification.type === 'success' ? 'border-accent-green/40 bg-bg-card text-accent-green' : notification.type === 'error' ? 'border-accent-red/40 bg-bg-card text-accent-red' : 'border-accent-blue/40 bg-bg-card text-accent-blue'}`}>{notification.type === 'success' ? <CheckCircle2 size={16} /> : notification.type === 'error' ? <AlertTriangle size={16} /> : <Info size={16} />}<span className="text-xs text-text-main">{notification.message}</span><button type="button" onClick={() => setNotification(null)}><X size={14} /></button></div>}

    <div className="space-y-1.5"><TrialStatusBanner /><TwoFactorReminderBanner /></div>
    {hasTelemetryError && <div className="rounded-xl border border-accent-yellow/30 bg-accent-yellow/5 px-4 py-2.5 text-xs text-accent-yellow">Telemetría parcial: Sentinel mantiene visibles los módulos disponibles y marca los datos faltantes como no disponibles.</div>}

    {canSetup && !isStateLoading && operationalItems.length === 0 && !hasTelemetryError && <div className="rounded-2xl border border-accent-green/30 bg-gradient-to-r from-accent-green/10 to-bg-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"><div><span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-accent-green"><Sparkles size={12} />Primeros pasos</span><h3 className="mt-1 text-lg font-bold text-text-main">Activa la observabilidad de tu infraestructura</h3><p className="mt-1 text-xs text-text-muted">Agrega un sitio, API o servicio para comenzar a recibir estado operativo.</p></div><button type="button" onClick={() => setShowQuickStartWizard(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent-green px-5 py-2.5 text-xs font-bold text-black"><Rocket size={16} />Crear primer monitor</button></div>}

    <NOCExecutiveKpis healthScore={healthScore} totalTargets={operationalItems.length} healthyTargets={healthCounts.healthy} degradedTargets={healthCounts.degraded} downTargets={healthCounts.down} unknownTargets={healthCounts.unknown} availability={performanceQuery.data?.summary.avg_uptime ?? null} avgLatencyMs={performanceQuery.data?.summary.avg_latency ?? null} attentionCount={attentionItems.length} criticalAttentionCount={criticalCount} activeIncidentsCount={source.incidents.length} telemetryPoints={performanceQuery.data?.points} isLoading={isStateLoading} />

    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
      <div className="order-1 xl:order-4 xl:col-span-7 min-w-0"><NOCOperationalInbox items={visibleItems} total={visibleItems.length} filters={filters} loading={isStateLoading} partialError={hasTelemetryError} canManage={canManage} pendingKey={pendingKey} onViewChange={(view) => setFilters((current) => ({ ...current, view }))} onClearHealth={() => setHealthFilter(null)} onClearModule={() => setModuleFilter(null)} onSelect={setSelectedItem} onScan={(item) => scanMutation.mutate(item)} onAcknowledge={(item) => acknowledgeMutation.mutate(item)} onNavigate={openModule} /></div>
      <div className="order-2 xl:order-1 xl:col-span-8 min-w-0"><NOCPerformanceSection timeRange={timeRange} checksPerMinute={performanceQuery.data?.summary.total_checks ? performanceQuery.data.summary.checks_per_minute : null} historicalData={performanceQuery.data?.points} isLoading={performanceQuery.isLoading} isError={performanceQuery.isError} /></div>
      <div className="order-3 xl:order-2 xl:col-span-4 min-w-0"><NOCInfraHealthDonut total={operationalItems.length} online={healthCounts.healthy} degraded={healthCounts.degraded} down={healthCounts.down} unknown={healthCounts.unknown} healthScore={healthScore} dataUnavailable={hasTelemetryError && operationalItems.length === 0} isLoading={isStateLoading} selectedHealth={filters.health} onHealthSelect={setHealthFilter} /></div>
      <div className="order-4 xl:order-3 xl:col-span-12 min-w-0"><NOCServicesBar services={services} selectedModule={filters.module} onModuleSelect={setModuleFilter} /></div>
      <div className="order-5 xl:order-5 xl:col-span-5 min-w-0"><NOCRecentActivityFeed events={activityEvents} loading={isStateLoading || auditQuery.isLoading} partialError={hasTelemetryError} onNavigate={openModule} /></div>
    </div>

    <NOCDrawer isOpen={Boolean(selectedItem)} onClose={() => setSelectedItem(null)} title={selectedItem?.title ?? ''} subtitle={selectedItem?.subtitle} statusBadge={selectedItem && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${selectedItem.severity === 'critical' ? 'border-accent-red/30 bg-accent-red/10 text-accent-red' : selectedItem.severity === 'warning' ? 'border-accent-yellow/30 bg-accent-yellow/10 text-accent-yellow' : selectedItem.severity === 'healthy' ? 'border-accent-green/30 bg-accent-green/10 text-accent-green' : 'border-border-base text-text-dim'}`}>{selectedItem.statusLabel}</span>} headerActions={selectedItem && <button type="button" onClick={() => openModule(selectedItem.path)} className="inline-flex items-center gap-1.5 rounded-full border border-accent-green/30 bg-accent-green/10 px-3 py-1.5 text-xs font-semibold text-accent-green">Abrir módulo <ExternalLink size={12} /></button>} quickKpis={selectedItem && <div className="grid grid-cols-2 gap-2">{selectedItem.details.map((detail) => <div key={detail.label} className="rounded-xl border border-border-base/60 bg-bg-dark/70 p-2.5"><span className="block text-[10px] text-text-dim">{detail.label}</span><strong className="mt-0.5 block truncate text-xs text-text-main">{detail.value}</strong></div>)}</div>} footerActions={selectedItem && <>{canManage && selectedItem.canScan && <ScanAction resource={selectedItem.raw as {id:string; scan_availability?: import('../types/scan').ScanAvailability}} route={scanResourceRoutes[selectedItem.type] || ''} pending={pendingKey === selectedItem.key} onScan={()=>scanMutation.mutateAsync(selectedItem)} />}{canManage && selectedItem.type === 'alert' && <button type="button" onClick={() => acknowledgeMutation.mutate(selectedItem)} className="rounded-xl bg-accent-yellow px-4 py-2 text-xs font-bold text-black">Reconocer alerta</button>}<button type="button" onClick={() => openModule(selectedItem.path)} className="inline-flex items-center gap-1.5 rounded-xl bg-accent-green px-4 py-2 text-xs font-bold text-black">Ver detalle <ArrowRight size={13} /></button></>} maxWidthClass="max-w-xl">
      {selectedItem && <div className="space-y-4"><div className="rounded-2xl border border-border-base bg-bg-dark/60 p-4"><p className="text-[10px] uppercase tracking-wider text-text-dim">Resumen operativo</p><h4 className="mt-2 text-sm font-semibold text-text-main">{selectedItem.statusLabel}</h4><p className="mt-1 text-xs leading-relaxed text-text-muted">{selectedItem.subtitle}</p></div><div className="rounded-2xl border border-border-base p-4"><dl className="space-y-3 text-xs"><div className="flex justify-between gap-4"><dt className="text-text-dim">Módulo</dt><dd className="font-semibold text-text-main">{selectedItem.moduleLabel}</dd></div><div className="flex justify-between gap-4"><dt className="text-text-dim">Identificador</dt><dd className="font-mono text-text-muted">{selectedItem.id}</dd></div><div className="flex justify-between gap-4"><dt className="text-text-dim">Última señal</dt><dd className="text-text-main">{selectedItem.occurredAt ? new Date(selectedItem.occurredAt).toLocaleString('es-GT') : 'Sin datos'}</dd></div></dl></div><p className="text-[11px] text-text-dim">Las acciones de resolución, edición, pausa y gestión de incidentes se realizan en el módulo correspondiente.</p></div>}
    </NOCDrawer>

    <QuickStartWizardModal isOpen={showQuickStartWizard && canSetup} onClose={closeOnboarding} onComplete={() => { localStorage.setItem(onboardingKey, 'completed'); setShowQuickStartWizard(false); }} />
  </div>;
}
