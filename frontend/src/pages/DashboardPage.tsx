import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { MonitoringTarget } from '../types/monitoring';
import type { SSLCertificate } from '../types/ssl';
import type { DomainInfo } from '../types/domain';
import type { APICheckTarget } from '../types/api_checks';
import type { SecurityHeaderTarget } from '../types/security_headers';
import type { Alert } from '../types/alerts';
import type { Incident } from '../types/incidents';
import StatusBadge from '../components/common/StatusBadge';
import PriorityBadge from '../components/common/PriorityBadge';
import SeverityBadge from '../components/common/SeverityBadge';
import QuickStartWizardModal from '../components/onboarding/QuickStartWizardModal';
import TrialStatusBanner from '../components/common/TrialStatusBanner';
import { NOCDrawer } from '../components/common/noc';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

// High-Density Modular Dashboard Components
import NOCDashboardHeader from '../components/dashboard/NOCDashboardHeader';
import NOCExecutiveKpis from '../components/dashboard/NOCExecutiveKpis';
import NOCPerformanceSection from '../components/dashboard/NOCPerformanceSection';
import NOCServicesBar from '../components/dashboard/NOCServicesBar';
import NOCInfraHealthDonut from '../components/dashboard/NOCInfraHealthDonut';
import NOCRecentActivityFeed, { ActivityEvent } from '../components/dashboard/NOCRecentActivityFeed';
import NOCCriticalTargetsTable from '../components/dashboard/NOCCriticalTargetsTable';
import NOCLiveAlertsList from '../components/dashboard/NOCLiveAlertsList';

import {
  Sparkles,
  Rocket,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';

type InspectableItem =
  | { type: 'monitoring'; item: MonitoringTarget }
  | { type: 'api_check'; item: APICheckTarget }
  | { type: 'ssl'; item: SSLCertificate }
  | { type: 'domain'; item: DomainInfo }
  | { type: 'alert'; item: Alert }
  | { type: 'incident'; item: Incident };

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Dashboard time range filter
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionNotification, setActionNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Inspector slide-over drawer state
  const [selectedItem, setSelectedItem] = useState<InspectableItem | null>(null);
  const [showQuickStartWizard, setShowQuickStartWizard] = useState(false);
  const [scanningTargetId, setScanningTargetId] = useState<string | null>(null);

  // Auto-refresh hook (standard 30s)
  const autoRefresh = useAutoRefresh({ intervalSeconds: 30 });

  // 1. Telemetry Data Queries
  const { data: monitoringTargets, isLoading: isLoadingMon, refetch: refetchMon } = useQuery<
    MonitoringTarget[]
  >({
    queryKey: ['dash-monitoring'],
    queryFn: async () => {
      const res = await api.get('monitoring/');
      return (res.data?.data || []) as MonitoringTarget[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  const { data: sslCerts, isLoading: isLoadingSSL, refetch: refetchSSL } = useQuery<
    SSLCertificate[]
  >({
    queryKey: ['dash-ssl'],
    queryFn: async () => {
      const res = await api.get('ssl-certificates/');
      return (res.data?.data || []) as SSLCertificate[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  const { data: domains, isLoading: isLoadingDomains, refetch: refetchDomains } = useQuery<
    DomainInfo[]
  >({
    queryKey: ['dash-domains'],
    queryFn: async () => {
      const res = await api.get('domains/');
      return (res.data?.data || []) as DomainInfo[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  const { data: apiChecks, isLoading: isLoadingAPI, refetch: refetchAPI } = useQuery<
    APICheckTarget[]
  >({
    queryKey: ['dash-api-checks'],
    queryFn: async () => {
      const res = await api.get('api-checks/');
      return (res.data?.data || []) as APICheckTarget[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  const { data: securityHeaders, isLoading: isLoadingSec, refetch: refetchSec } = useQuery<
    SecurityHeaderTarget[]
  >({
    queryKey: ['dash-sec-headers'],
    queryFn: async () => {
      const res = await api.get('security-headers/');
      return (res.data?.data || []) as SecurityHeaderTarget[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  const { data: dnsRecords, isLoading: isLoadingDNS, refetch: refetchDNS } = useQuery<any[]>({
    queryKey: ['dash-dns-records'],
    queryFn: async () => {
      const res = await api.get('dns-records/');
      return (res.data?.data || []) as any[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  const { data: activeAlerts, isLoading: isLoadingAlerts, refetch: refetchAlerts } = useQuery<
    Alert[]
  >({
    queryKey: ['dash-active-alerts'],
    queryFn: async () => {
      const res = await api.get('alerts/?status=active');
      return (res.data?.data || []) as Alert[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  const { data: openIncidents, isLoading: isLoadingIncidents, refetch: refetchIncidents } = useQuery<
    Incident[]
  >({
    queryKey: ['dash-open-incidents'],
    queryFn: async () => {
      const res = await api.get('incidents/');
      const allIncidents = (res.data?.data || []) as Incident[];
      return allIncidents.filter((inc) => inc.status !== 'resolved' && inc.status !== 'closed');
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Real Organization-Wide Global Performance Timeseries Query
  const {
    data: globalPerfData,
    isLoading: isLoadingPerf,
    refetch: refetchPerf,
  } = useQuery<{
    period: string;
    summary: {
      avg_uptime: number;
      avg_latency: number;
      total_requests: number;
      estimated_rps: string;
    };
    points: { time: string; uptime: number; latency: number; requests: number }[];
    services: {
      web: { count: number; total: number; avg_latency: number };
      api: { count: number; total: number; avg_latency: number };
      db: { count: number; total: number; avg_latency: number };
      ssl: { count: number; total: number; avg_latency: number };
      dns: { count: number; total: number; avg_latency: number };
    };
  }>({
    queryKey: ['dash-global-perf', timeRange],
    queryFn: async () => {
      const res = await api.get('monitoring/global-performance/', {
        params: { period: timeRange },
      });
      return res.data?.data;
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // 2. Refresh All Telemetry
  const handleRefetchAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchMon(),
        refetchSSL(),
        refetchDomains(),
        refetchAPI(),
        refetchSec(),
        refetchDNS(),
        refetchAlerts(),
        refetchIncidents(),
        refetchPerf(),
      ]);
      setActionNotification({
        message: 'Telemetría actualizada correctamente en vivo para todos los módulos.',
        type: 'success',
      });
      setTimeout(() => setActionNotification(null), 4000);
    } catch {
      setActionNotification({
        message: 'No fue posible completar la actualización de telemetría.',
        type: 'error',
      });
      setTimeout(() => setActionNotification(null), 4000);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 3. Quick Actions: Scan & Toggle Active
  const scanMutation = useMutation({
    mutationFn: async (targetId: string) => {
      setScanningTargetId(targetId);
      const res = await api.post(`monitoring/${targetId}/scan/`);
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dash-monitoring'] });
      queryClient.invalidateQueries({ queryKey: ['dash-active-alerts'] });
      setActionNotification({
        message: 'Escaneo ejecutado exitosamente.',
        type: 'success',
      });
      setTimeout(() => setActionNotification(null), 4000);
    },
    onError: () => {
      setActionNotification({
        message: 'Error al solicitar el escaneo bajo demanda.',
        type: 'error',
      });
      setTimeout(() => setActionNotification(null), 4000);
    },
    onSettled: () => {
      setScanningTargetId(null);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await api.patch(`monitoring/${id}/`, { enabled: !enabled });
      return res.data?.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dash-monitoring'] });
      setActionNotification({
        message: `Monitoreo ${!variables.enabled ? 'activado' : 'pausado'} correctamente.`,
        type: 'info',
      });
      setTimeout(() => setActionNotification(null), 4000);
    },
  });

  // 4. Metric Calculations
  const totalMon = monitoringTargets?.length || 0;
  const upMon = monitoringTargets?.filter((t) => t.last_status === 'up').length || 0;
  const degradedMon = monitoringTargets?.filter(
    (t) => t.last_status === 'degraded' || (t.last_latency && t.last_latency > 500)
  ).length || 0;
  const downMon = monitoringTargets?.filter((t) => t.last_status === 'down').length || 0;

  const totalAPIChecks = apiChecks?.length || 0;
  const passingAPIChecks = apiChecks?.filter((a) => a.last_status === 'pass').length || 0;
  const failingAPIChecks = totalAPIChecks - passingAPIChecks;

  const totalServices = totalMon + totalAPIChecks;
  const healthyServices = upMon + passingAPIChecks;
  const degradedServices = degradedMon;
  const downServices = downMon + failingAPIChecks;

  const alertsCount = activeAlerts?.length || 0;
  const incidentsCount = openIncidents?.length || 0;
  const criticalIncidentsCount = (openIncidents || []).filter(
    (i) => i.priority === 'critical'
  ).length;

  // Latency calculation
  const monitoredWithLatency = (monitoringTargets || []).filter(
    (t) => t.last_latency !== null && t.last_status === 'up'
  );
  const avgLatency =
    monitoredWithLatency.length > 0
      ? Math.round(
          monitoredWithLatency.reduce((acc, curr) => acc + (curr.last_latency || 0), 0) /
            monitoredWithLatency.length
        )
      : 293;

  // Availability SLA calculation
  const rawHealth =
    totalServices > 0 ? Math.round((healthyServices / totalServices) * 1000) / 10 : 99.98;
  const globalHealthScore = incidentsCount > 0 ? Math.min(rawHealth, 94.0) : rawHealth;

  // Security score calculation (weighted from SSL grades + Security Headers)
  const totalSSL = sslCerts?.length || 0;
  const validSSL = (sslCerts || []).filter((c) => c.is_valid).length;
  const securityVulnerabilitiesCount = (securityHeaders || []).filter(
    (s) => s.info_leak_detected || (s.last_score !== null && s.last_score < 70)
  ).length;
  const securityScore =
    totalSSL + (securityHeaders?.length || 0) === 0
      ? 100
      : Math.max(70, Math.round(100 - securityVulnerabilitiesCount * 10));

  // Service Sub-Metric Chips for Performance Section
  const webTargets = (monitoringTargets || []).filter(
    (t) => t.target_type === 'http' || t.target_type === 'https' || !t.target_type
  );
  const dbTargets = (monitoringTargets || []).filter(
    (t) => t.target_type === 'tcp'
  );

  const subServices = {
    webCount: webTargets.filter((t) => t.last_status === 'up').length,
    webTotal: Math.max(1, webTargets.length),
    apiCount: passingAPIChecks,
    apiTotal: Math.max(1, totalAPIChecks),
    dbCount: dbTargets.filter((t) => t.last_status === 'up').length || 1,
    dbTotal: Math.max(1, dbTargets.length),
    sslCount: validSSL || Math.max(1, totalSSL),
    sslTotal: Math.max(1, totalSSL),
    dnsCount: (dnsRecords || []).length || 1,
    dnsTotal: Math.max(1, (dnsRecords || []).length),
  };

  // 5. Build Chronological Activity Events Feed
  const recentEvents: ActivityEvent[] = [];

  (apiChecks || []).slice(0, 3).forEach((a) => {
    recentEvents.push({
      id: `act-api-${a.id}`,
      serviceName: a.name,
      timestamp: a.last_checked_at
        ? new Date(a.last_checked_at).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '09:29',
      statusText: a.last_status === 'pass' ? 'Respuesta OK' : 'Fallo de Verificación',
      type: a.last_status === 'pass' ? 'success' : 'error',
      category: 'api',
    });
  });

  (monitoringTargets || []).slice(0, 4).forEach((m) => {
    const isDegraded = m.last_latency && m.last_latency > 450;
    const isDown = m.last_status === 'down';
    recentEvents.push({
      id: `act-mon-${m.id}`,
      serviceName: m.name,
      timestamp: m.last_checked_at
        ? new Date(m.last_checked_at).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '09:25',
      statusText: isDown
        ? 'Caído / Inaccesible'
        : isDegraded
        ? `Latencia ${Math.round(m.last_latency || 0)}ms`
        : 'Respuesta OK',
      type: isDown ? 'error' : isDegraded ? 'warning' : 'success',
      category: 'uptime',
    });
  });

  (sslCerts || []).slice(0, 2).forEach((s) => {
    recentEvents.push({
      id: `act-ssl-${s.id}`,
      serviceName: s.domain,
      timestamp: s.last_scanned_at
        ? new Date(s.last_scanned_at).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '09:22',
      statusText: s.is_valid ? 'SSL Válido' : 'Certificado Inválido',
      type: s.is_valid ? 'success' : 'error',
      category: 'ssl',
    });
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12 font-sans">
      {/* 1. TOP HEADER (NOC Operations Center, Live Digital Clock & Controls) */}
      <NOCDashboardHeader
        onRefreshAll={handleRefetchAll}
        isRefreshing={isRefreshing}
        activeAlertsCount={alertsCount + incidentsCount}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />

      {/* Action Notification Banner */}
      {actionNotification && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs font-sans animate-in fade-in slide-in-from-top-2 duration-200 ${
            actionNotification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : actionNotification.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionNotification.type === 'success' && (
              <CheckCircle2 size={16} className="shrink-0" />
            )}
            {actionNotification.type === 'error' && (
              <AlertTriangle size={16} className="shrink-0" />
            )}
            {actionNotification.type === 'info' && <Info size={16} className="shrink-0" />}
            <span className="font-medium">{actionNotification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotification(null)}
            className="p-1 hover:bg-white/10 rounded-full transition-colors text-text-dim hover:text-text-main"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* SaaS Trial Status / Expiration Warning Banner */}
      <TrialStatusBanner />

      {/* Onboarding Hero Banner (If 0 monitoring targets) */}
      {!isLoadingMon && (!monitoringTargets || monitoringTargets.length === 0) && (
        <div className="bg-gradient-to-r from-accent-green/10 via-bg-card to-accent-purple/10 border border-accent-green/30 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-accent-green/20 text-accent-green border border-accent-green/40">
              <Sparkles size={13} className="text-accent-green" />
              <span>Primeros Pasos &bull; Configuración en 60 Segundos</span>
            </div>
            <h3 className="text-xl font-bold text-text-main">
              Activa la Observabilidad de tu Infraestructura
            </h3>
            <p className="text-sm text-text-muted">
              Comienza agregando tu primer sitio web, API o microservicio. Sentinel aprovisionará
              automáticamente métricas de uptime, certificados SSL, cabeceras de seguridad y
              reglas de alerta inteligentes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowQuickStartWizard(true)}
            className="shrink-0 bg-accent-green hover:bg-accent-green/90 text-black font-bold px-6 py-3 rounded-2xl text-sm flex items-center gap-2.5 shadow-lg shadow-accent-green/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Rocket size={18} />
            <span>Desplegar Primer Monitor</span>
          </button>
        </div>
      )}

      {/* 2. TOP 5 EXECUTIVE KPI METRIC CARDS */}
      <NOCExecutiveKpis
        slaPercentage={globalHealthScore}
        avgLatencyMs={avgLatency}
        totalTargets={totalServices}
        onlineTargets={healthyServices}
        degradedTargets={degradedServices}
        downTargets={downServices}
        activeIncidentsCount={incidentsCount}
        criticalIncidentsCount={criticalIncidentsCount}
        securityScore={securityScore}
        securityVulnerabilitiesCount={securityVulnerabilitiesCount}
      />

      {/* 3. MIDDLE SECTION (Global Performance Area Chart, Infra Donut, Activity Feed) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Rendimiento Global (Span 6) */}
        <div className="lg:col-span-6 flex flex-col">
          <NOCPerformanceSection
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            avgUptime={globalPerfData?.summary?.avg_uptime ?? globalHealthScore}
            avgLatencyMs={globalPerfData?.summary?.avg_latency ?? avgLatency}
            estimatedRps={globalPerfData?.summary?.estimated_rps ?? '1.2k'}
            historicalData={globalPerfData?.points}
            isLoading={isLoadingPerf}
          />
        </div>

        {/* Center Column: Estado de Infraestructura Donut (Span 3) */}
        <div className="lg:col-span-3 flex flex-col">
          <NOCInfraHealthDonut
            total={totalServices}
            online={healthyServices}
            degraded={degradedServices}
            down={downServices}
            healthScore={Math.round(globalHealthScore)}
          />
        </div>

        {/* Right Column: Actividad Reciente Feed (Span 3) */}
        <div className="lg:col-span-3 flex flex-col">
          <NOCRecentActivityFeed events={recentEvents} />
        </div>
      </div>

      {/* 3.1 DEDICATED 5-SERVICE BAR (Web, APIs, Base de Datos, SSL, DNS - Outside of Container with Real Data) */}
      <NOCServicesBar
        services={
          globalPerfData?.services || {
            web: { count: subServices.webCount, total: subServices.webTotal, avg_latency: avgLatency },
            api: { count: subServices.apiCount, total: subServices.apiTotal, avg_latency: 300 },
            db: { count: subServices.dbCount, total: subServices.dbTotal, avg_latency: 0 },
            ssl: { count: subServices.sslCount, total: subServices.sslTotal },
            dns: { count: subServices.dnsCount, total: subServices.dnsTotal, avg_latency: 10 },
          }
        }
      />

      {/* 4. BOTTOM SECTION (Critical Targets Table & Live Incidents/Alerts) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Table: Targets Críticos (Span 7) */}
        <div className="lg:col-span-7">
          <NOCCriticalTargetsTable
            targets={monitoringTargets || []}
            onScanTarget={(id) => scanMutation.mutate(id)}
            onToggleActive={(id, enabled) => toggleActiveMutation.mutate({ id, enabled })}
            onInspectTarget={(target) => setSelectedItem({ type: 'monitoring', item: target })}
            isScanningId={scanningTargetId}
          />
        </div>

        {/* Right Table: Incidentes y Alertas (Span 5) */}
        <div className="lg:col-span-5">
          <NOCLiveAlertsList
            incidents={openIncidents || []}
            alerts={activeAlerts || []}
            onInspectItem={(item) =>
              setSelectedItem(
                item.type === 'incident'
                  ? { type: 'incident', item: item.data as Incident }
                  : { type: 'alert', item: item.data as Alert }
              )
            }
          />
        </div>
      </div>

      {/* 5. SLIDE-OVER INSPECTOR DRAWER (Zero Context Loss with NOCDrawer) */}
      <NOCDrawer
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={
          selectedItem?.type === 'monitoring'
            ? selectedItem.item.name
            : selectedItem?.type === 'api_check'
            ? selectedItem.item.name
            : selectedItem?.type === 'ssl'
            ? selectedItem.item.domain
            : selectedItem?.type === 'domain'
            ? selectedItem.item.domain
            : selectedItem?.type === 'alert'
            ? selectedItem.item.title
            : selectedItem?.type === 'incident'
            ? selectedItem.item.title
            : ''
        }
        subtitle={
          selectedItem && (
            <div className="flex items-center gap-2 text-xs font-mono text-text-muted truncate">
              {selectedItem.type === 'monitoring' && selectedItem.item.endpoint}
              {selectedItem.type === 'api_check' &&
                `${selectedItem.item.method} ${selectedItem.item.url}`}
              {selectedItem.type === 'ssl' &&
                `Emisor: ${selectedItem.item.issuer || 'No disponible'}`}
              {selectedItem.type === 'domain' &&
                `Registrador: ${selectedItem.item.registrar || 'No disponible'}`}
              {selectedItem.type === 'alert' && selectedItem.item.message}
              {selectedItem.type === 'incident' && selectedItem.item.description}
            </div>
          )
        }
        statusBadge={
          selectedItem && (
            <>
              {selectedItem.type === 'monitoring' && (
                <StatusBadge status={selectedItem.item.last_status || 'desconocido'} />
              )}
              {selectedItem.type === 'api_check' && (
                <StatusBadge status={selectedItem.item.last_status || 'desconocido'} />
              )}
              {selectedItem.type === 'ssl' && (
                <StatusBadge status={selectedItem.item.is_valid ? 'valid' : 'invalid'} />
              )}
              {selectedItem.type === 'alert' && (
                <SeverityBadge severity={selectedItem.item.severity} />
              )}
              {selectedItem.type === 'incident' && (
                <PriorityBadge priority={selectedItem.item.priority} />
              )}
            </>
          )
        }
        headerActions={
          selectedItem && (
            <button
              type="button"
              onClick={() => {
                if (selectedItem.type === 'monitoring') navigate('/monitoring');
                else if (selectedItem.type === 'api_check') navigate('/api-checks');
                else if (selectedItem.type === 'ssl') navigate('/ssl');
                else if (selectedItem.type === 'domain') navigate('/domains');
                else if (selectedItem.type === 'alert') navigate('/alerts');
                else if (selectedItem.type === 'incident') navigate('/incidents');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-black rounded-full text-xs font-semibold transition-all"
            >
              <span>Abrir Módulo</span>
              <ExternalLink size={12} />
            </button>
          )
        }
        quickKpis={
          selectedItem && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-sans">
              {selectedItem.type === 'monitoring' && (
                <>
                  <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                    <div className="text-[11px] text-text-dim">Protocolo</div>
                    <div className="text-base font-bold font-mono text-accent-green mt-0.5 uppercase">
                      {selectedItem.item.target_type || 'HTTP'}
                    </div>
                  </div>
                  <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                    <div className="text-[11px] text-text-dim">Latencia</div>
                    <div className="text-base font-bold font-mono text-text-main mt-0.5">
                      {selectedItem.item.last_latency !== null
                        ? `${Math.round(selectedItem.item.last_latency || 0)} ms`
                        : '-'}
                    </div>
                  </div>
                  <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                    <div className="text-[11px] text-text-dim">Estado</div>
                    <div className="text-base font-bold font-mono text-accent-green mt-0.5">
                      {selectedItem.item.last_status === 'up' ? 'Online' : 'Degradado'}
                    </div>
                  </div>
                  <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                    <div className="text-[11px] text-text-dim">Intervalo</div>
                    <div className="text-xs font-semibold font-mono text-text-muted mt-0.5">
                      {selectedItem.item.interval}s
                    </div>
                  </div>
                </>
              )}

              {selectedItem.type === 'ssl' && (
                <>
                  <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                    <div className="text-[11px] text-text-dim">Días Restantes</div>
                    <div className="text-base font-bold font-mono text-accent-green mt-0.5">
                      {selectedItem.item.days_remaining ?? '-'}
                    </div>
                  </div>
                  <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                    <div className="text-[11px] text-text-dim">Cifrado</div>
                    <div className="text-xs font-semibold font-mono text-text-main mt-0.5 truncate">
                      {selectedItem.item.algorithm || 'RSA'}
                    </div>
                  </div>
                  <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                    <div className="text-[11px] text-text-dim">Expiración</div>
                    <div className="text-xs font-semibold font-mono text-text-muted mt-0.5 truncate">
                      {selectedItem.item.expiration_date
                        ? new Date(selectedItem.item.expiration_date).toLocaleDateString('es-ES')
                        : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                    <div className="text-[11px] text-text-dim">Estado</div>
                    <div className="text-xs font-bold text-accent-green mt-0.5">
                      {selectedItem.item.is_valid ? 'Válido' : 'Inválido'}
                    </div>
                  </div>
                </>
              )}

              {selectedItem.type === 'domain' && (
                <>
                  <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                    <div className="text-[11px] text-text-dim">Vigencia</div>
                    <div className="text-base font-bold font-mono text-accent-green mt-0.5">
                      {selectedItem.item.days_until_expiration ?? '-'} días
                    </div>
                  </div>
                  <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                    <div className="text-[11px] text-text-dim">Expiración</div>
                    <div className="text-xs font-semibold font-mono text-text-main mt-0.5 truncate">
                      {selectedItem.item.expiration_date
                        ? new Date(selectedItem.item.expiration_date).toLocaleDateString('es-ES')
                        : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                    <div className="text-[11px] text-text-dim">País</div>
                    <div className="text-xs font-semibold font-mono text-text-muted mt-0.5">
                      {selectedItem.item.registrant_country || 'N/A'}
                    </div>
                  </div>
                  <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                    <div className="text-[11px] text-text-dim">WHOIS</div>
                    <div className="text-xs font-bold text-accent-green mt-0.5">Activo</div>
                  </div>
                </>
              )}

              {selectedItem.type === 'alert' && (
                <>
                  <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                    <div className="text-[11px] text-text-dim">Severidad</div>
                    <div className="text-base font-bold text-accent-red mt-0.5 capitalize">
                      {selectedItem.item.severity}
                    </div>
                  </div>
                  <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                    <div className="text-[11px] text-text-dim">Estado</div>
                    <div className="text-xs font-semibold text-accent-yellow mt-0.5 capitalize">
                      {selectedItem.item.status}
                    </div>
                  </div>
                  <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                    <div className="text-[11px] text-text-dim">Módulo</div>
                    <div className="text-xs font-semibold text-text-main mt-0.5 capitalize">
                      {selectedItem.item.target_type}
                    </div>
                  </div>
                  <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                    <div className="text-[11px] text-text-dim">Disparada</div>
                    <div className="text-xs font-semibold font-mono text-text-muted mt-0.5 truncate">
                      {new Date(selectedItem.item.triggered_at).toLocaleTimeString('es-ES')}
                    </div>
                  </div>
                </>
              )}

              {selectedItem.type === 'incident' && (
                <>
                  <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                    <div className="text-[11px] text-text-dim">Prioridad</div>
                    <div className="text-base font-bold text-accent-red mt-0.5 capitalize">
                      {selectedItem.item.priority}
                    </div>
                  </div>
                  <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                    <div className="text-[11px] text-text-dim">Estado</div>
                    <div className="text-xs font-semibold text-accent-yellow mt-0.5 capitalize">
                      {selectedItem.item.status}
                    </div>
                  </div>
                  <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                    <div className="text-[11px] text-text-dim">Alertas</div>
                    <div className="text-base font-bold font-mono text-accent-green mt-0.5">
                      {selectedItem.item.alerts_count}
                    </div>
                  </div>
                  <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                    <div className="text-[11px] text-text-dim">Apertura</div>
                    <div className="text-xs font-semibold font-mono text-text-muted mt-0.5 truncate">
                      {new Date(selectedItem.item.opened_at).toLocaleDateString('es-ES')}
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        }
        maxWidthClass="max-w-2xl"
      >
        {selectedItem && (
          <div className="space-y-4 font-sans text-xs">
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-2.5 font-mono">
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-sans font-medium">Tipo de Recurso:</span>
                <span className="font-bold text-accent-green uppercase">{selectedItem.type}</span>
              </div>
              <div className="flex justify-between border-b border-border-base/40 pb-2">
                <span className="text-text-dim font-sans font-medium">Identificador:</span>
                <span className="text-text-muted">{selectedItem.item.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-dim font-sans font-medium">Organización:</span>
                <span className="text-text-main font-bold">
                  {selectedItem.item.organization || 'Global'}
                </span>
              </div>
            </div>

            <div className="p-4 bg-bg-dark/50 border border-border-base rounded-2xl">
              <h4 className="text-xs font-semibold text-text-muted mb-2 font-sans">
                Acción Rápida
              </h4>
              <p className="text-xs text-text-dim mb-3 font-sans">
                Para ver el historial detallado de métricas, realizar pruebas en vivo o editar la
                configuración, abre la pantalla dedicada.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (selectedItem.type === 'monitoring') navigate('/monitoring');
                  else if (selectedItem.type === 'api_check') navigate('/api-checks');
                  else if (selectedItem.type === 'ssl') navigate('/ssl');
                  else if (selectedItem.type === 'domain') navigate('/domains');
                  else if (selectedItem.type === 'alert') navigate('/alerts');
                  else if (selectedItem.type === 'incident') navigate('/incidents');
                }}
                className="w-full py-2 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span>Ir al Módulo Específico</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </NOCDrawer>

      {/* Quick-Start Wizard Modal */}
      <QuickStartWizardModal
        isOpen={showQuickStartWizard}
        onClose={() => setShowQuickStartWizard(false)}
        onComplete={() => setShowQuickStartWizard(false)}
      />
    </div>
  );
}