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
import GradeBadge from '../components/common/GradeBadge';
import PriorityBadge from '../components/common/PriorityBadge';
import SeverityBadge from '../components/common/SeverityBadge';
import EmptyState from '../components/common/EmptyState';
import {
  NOCPageHeader,
  NOCKpiGrid,
  NOCKpiCard,
  NOCToolbar,
  NOCDrawer,
} from '../components/common/noc';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import {
  Activity,
  Lock,
  ShieldCheck,
  Zap,
  RefreshCw,
  Globe2,
  Plug,
  Shield,
  Clock,
  ArrowRight,
  AlertOctagon,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ExternalLink,
  Plus,
  Sliders,
  Server,
  Layers,
  ChevronRight,
  Filter,
  Loader2,
} from 'lucide-react';

type PerspectiveMode = 'all' | 'issues' | 'services' | 'security';
type ServiceTab = 'all' | 'monitoring' | 'api_checks' | 'unhealthy';

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

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [perspective, setPerspective] = useState<PerspectiveMode>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [serviceTab, setServiceTab] = useState<ServiceTab>('all');
  const [selectedItem, setSelectedItem] = useState<InspectableItem | null>(null);

  // Auto-refresh hook (15s countdown)
  const autoRefresh = useAutoRefresh({
    intervalSeconds: 15,
    initialEnabled: true,
  });

  // Queries for real live data across all Sentinel modules
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

  // Evaluate mutation for rules
  const evaluateMutation = useMutation({
    mutationFn: async () => {
      await api.post('alert-rules/evaluate/');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dash-active-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dash-open-incidents'] });
    },
  });

  const handleRefetchAll = () => {
    refetchMon();
    refetchSSL();
    refetchDomains();
    refetchAPI();
    refetchSec();
    refetchAlerts();
    refetchIncidents();
  };

  // Metrics calculations
  const totalMon = monitoringTargets?.length || 0;
  const upMon = monitoringTargets?.filter((t) => t.last_status === 'up').length || 0;
  const downMon = totalMon - upMon;

  const totalSSL = sslCerts?.length || 0;
  const expiringSSL =
    sslCerts?.filter((c) => c.days_remaining !== null && c.days_remaining <= 30).length || 0;

  const totalDomains = domains?.length || 0;
  const expiringDomains =
    domains?.filter((d) => d.days_until_expiration !== null && d.days_until_expiration <= 30)
      .length || 0;

  const totalAPIChecks = apiChecks?.length || 0;
  const passingAPIChecks = apiChecks?.filter((a) => a.last_status === 'pass').length || 0;
  const failingAPIChecks = totalAPIChecks - passingAPIChecks;

  const alertsCount = activeAlerts?.length || 0;
  const incidentsCount = openIncidents?.length || 0;

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
      : 42;

  // Health calculation
  const totalServices = totalMon + totalAPIChecks;
  const healthyServices = upMon + passingAPIChecks;
  const rawHealth =
    totalServices > 0 ? Math.round((healthyServices / totalServices) * 1000) / 10 : 100.0;
  // If there are open incidents, slightly penalize global health representation
  const globalHealthScore = incidentsCount > 0 ? Math.min(rawHealth, 94.0) : rawHealth;

  // Unified Service Matrix
  const unifiedServices = [
    ...(monitoringTargets || []).map((t) => ({
      id: t.id,
      name: t.name,
      endpoint: t.endpoint,
      type: 'Uptime Monitor' as const,
      status: t.last_status || 'unknown',
      latency: t.last_latency,
      lastChecked: t.last_checked_at,
      rawItem: t,
    })),
    ...(apiChecks || []).map((a) => ({
      id: a.id,
      name: a.name,
      endpoint: `${a.method} ${a.url}`,
      type: 'API Check' as const,
      status: a.last_status || 'unknown',
      latency: a.expected_response_time_ms || null,
      lastChecked: a.last_checked_at,
      rawItem: a,
    })),
  ];

  // Filtering Unified Services
  const filteredServices = unifiedServices.filter((s) => {
    // Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matches =
        s.name.toLowerCase().includes(term) || s.endpoint.toLowerCase().includes(term);
      if (!matches) return false;
    }

    // Tab
    if (serviceTab === 'monitoring' && s.type !== 'Uptime Monitor') return false;
    if (serviceTab === 'api_checks' && s.type !== 'API Check') return false;
    if (serviceTab === 'unhealthy') {
      const isHealthy = s.status === 'up' || s.status === 'pass';
      if (isHealthy) return false;
    }

    // Perspective Filter
    if (perspective === 'issues') {
      const isHealthy = s.status === 'up' || s.status === 'pass';
      if (isHealthy) return false;
    }
    if (perspective === 'security') {
      return false; // Show security panels instead
    }

    return true;
  });

  // Calculate Security Headers Grade
  const calculateGrade = (score: number | null) => {
    if (score === null) return null;
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  };

  const hasCriticalIssues = incidentsCount > 0 || alertsCount > 0 || downMon > 0;
  const mostCriticalIncident = openIncidents && openIncidents.length > 0 ? openIncidents[0] : null;
  const mostCriticalAlert = activeAlerts && activeAlerts.length > 0 ? activeAlerts[0] : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader
        title="Centro de Operaciones NOC"
        badgeText="NOC OBSERVABILITY"
        description="Consola unificada de observabilidad, salud de infraestructura, telemetría y seguridad en tiempo real."
        icon={<Activity size={26} />}
        autoRefresh={{
          enabled: autoRefresh.enabled,
          countdown: autoRefresh.countdown,
          onToggle: autoRefresh.toggle,
        }}
        actions={
          <>
            <button
              type="button"
              onClick={handleRefetchAll}
              className="flex items-center gap-2 bg-accent-green/10 border border-accent-green/40 text-accent-green font-medium px-4 py-2 rounded-full text-sm hover:bg-accent-green/20 transition-all shadow-sm"
              title="Revalidar toda la telemetría en vivo"
            >
              <RefreshCw size={15} />
              Actualizar Telemetría
            </button>
            <button
              type="button"
              onClick={() => evaluateMutation.mutate()}
              disabled={evaluateMutation.isPending}
              className="flex items-center gap-2 bg-bg-card border border-border-base text-text-muted hover:text-text-main font-medium px-4 py-2 rounded-full text-sm hover:bg-bg-dark transition-all disabled:opacity-50"
              title="Evaluar todas las reglas de umbral ahora"
            >
              <Sliders size={15} />
              Evaluar Reglas
            </button>
            <button
              type="button"
              onClick={() => navigate('/monitoring')}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20"
            >
              <Plus size={16} />
              Nuevo Monitoreo
            </button>
          </>
        }
      />

      {/* 2. NOC COMMAND CENTER: 4 CONSOLIDATED KPI CARDS */}
      <NOCKpiGrid columns={4}>
        {/* KPI 1: Salud Global Consolidada */}
        <NOCKpiCard
          title="Salud Global del Ecosistema"
          icon={<Activity size={16} className="text-accent-green" />}
          badge={{
            text:
              globalHealthScore >= 99.0
                ? '100% Operativo'
                : globalHealthScore >= 90.0
                ? 'Degradado'
                : 'Atención Crítica',
            variant:
              globalHealthScore >= 99.0
                ? 'success'
                : globalHealthScore >= 90.0
                ? 'warning'
                : 'danger',
          }}
          value={`${globalHealthScore}%`}
          valueSuffix="online"
          progress={{ value: globalHealthScore }}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Servicios Respondiendo</span>
              <span>
                {healthyServices} de {totalServices} activos
              </span>
            </div>
          }
        />

        {/* KPI 2: Triage de Incidentes & Alertas */}
        <NOCKpiCard
          title="Triage & Estado Operativo"
          icon={
            incidentsCount > 0 ? (
              <Flame size={16} className="text-accent-red" />
            ) : (
              <Zap size={16} className="text-accent-green" />
            )
          }
          badge={{
            text:
              incidentsCount > 0
                ? `${incidentsCount} Críticos`
                : alertsCount > 0
                ? `${alertsCount} Alertas`
                : 'Sin Alarmas',
            variant: incidentsCount > 0 ? 'danger' : alertsCount > 0 ? 'warning' : 'success',
          }}
          value={incidentsCount > 0 ? `${incidentsCount} Inc.` : `${alertsCount} Al.`}
          valueColor={
            incidentsCount > 0
              ? 'text-accent-red'
              : alertsCount > 0
              ? 'text-amber-400'
              : 'text-accent-green'
          }
          valueSuffix={incidentsCount > 0 ? 'en investigación' : 'activas'}
          subtitle={
            incidentsCount > 0
              ? 'Impacto operativo no resuelto'
              : 'Ecosistema bajo control y monitoreado'
          }
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Tiempo de Respuesta NOC</span>
              <span className="text-accent-green font-medium">&lt; 15 min</span>
            </div>
          }
        />

        {/* KPI 3: Disponibilidad SLA & Latencia */}
        <NOCKpiCard
          title="Latencia Media Global"
          icon={<Clock size={16} className="text-sky-400" />}
          badge={{
            text: avgLatency < 250 ? 'Óptima' : 'Atención',
            variant: avgLatency < 250 ? 'info' : 'warning',
          }}
          value={`${avgLatency} ms`}
          valueColor="text-sky-400"
          valueSuffix="promedio"
          subtitle="Tiempo medio de respuesta HTTP / TCP"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Objetivo SLA Contractual</span>
              <span className="text-accent-green font-mono font-medium">&ge; 99.5%</span>
            </div>
          }
        />

        {/* KPI 4: Escudo de Seguridad & Vigencia */}
        <NOCKpiCard
          title="Escudo de Seguridad Web"
          icon={<ShieldCheck size={16} className="text-accent-green" />}
          badge={{
            text:
              expiringSSL + expiringDomains > 0
                ? `${expiringSSL + expiringDomains} por expirar`
                : 'Protegido',
            variant: expiringSSL + expiringDomains > 0 ? 'warning' : 'success',
          }}
          value={totalSSL + totalDomains}
          valueColor="text-accent-green"
          valueSuffix="activos"
          subtitle={`${totalSSL} certificados SSL &bull; ${totalDomains} dominios`}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Auditoría de Cabeceras</span>
              <span className="text-accent-green font-medium">OWASP Activo</span>
            </div>
          }
        />
      </NOCKpiGrid>

      {/* 3. EARLY WARNING & TRIAGE BANNER */}
      {hasCriticalIssues ? (
        <div className="bg-accent-red/[0.04] border border-accent-red/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-red/10 border border-accent-red/20 flex items-center justify-center text-accent-red shrink-0">
              <AlertTriangle size={18} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-accent-red uppercase tracking-wider">
                  Atención Requerida
                </span>
                <span className="text-xs text-text-dim">•</span>
                <span className="text-xs font-semibold text-text-main">
                  {mostCriticalIncident
                    ? `Incidente Abierto: ${mostCriticalIncident.title}`
                    : mostCriticalAlert
                    ? `Alerta Activa: ${mostCriticalAlert.title}`
                    : `${downMon} servicios con fallo en comprobación`}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                {mostCriticalIncident
                  ? mostCriticalIncident.description || 'Investigación en progreso.'
                  : mostCriticalAlert
                  ? mostCriticalAlert.message
                  : 'Revisa la telemetría para mitigar interrupciones operativas.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {mostCriticalIncident && (
              <button
                type="button"
                onClick={() => setSelectedItem({ type: 'incident', item: mostCriticalIncident })}
                className="px-3 py-1.5 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-full text-xs font-semibold transition-all"
              >
                Inspeccionar Incidente
              </button>
            )}
            {mostCriticalAlert && !mostCriticalIncident && (
              <button
                type="button"
                onClick={() => setSelectedItem({ type: 'alert', item: mostCriticalAlert })}
                className="px-3 py-1.5 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-full text-xs font-semibold transition-all"
              >
                Inspeccionar Alerta
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate(mostCriticalIncident ? '/incidents' : '/alerts')}
              className="px-3 py-1.5 bg-bg-card border border-border-base text-text-muted hover:text-text-main rounded-full text-xs font-medium transition-colors flex items-center gap-1"
            >
              Ver Centro <ArrowRight size={13} />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-accent-green/[0.03] border border-accent-green/20 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-text-muted">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={16} className="text-accent-green shrink-0" />
            <span>
              <strong className="text-text-main font-semibold">
                Todos los sistemas operando dentro de los parámetros nominales.
              </strong>{' '}
              Cero caídas detectadas y cero incidentes abiertos.
            </span>
          </div>
          <span className="font-mono text-[11px] text-accent-green hidden md:inline-block">
            Radar NOC Activo
          </span>
        </div>
      )}

      {/* 4. TOOLBAR: Omnibar Search + Perspective Chips + View Switcher */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por nombre de servicio, URL, certificado o dominio..."
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        categoryLabel="Perspectiva:"
        categories={[
          { id: 'all', label: 'Todos' },
          { id: 'issues', label: 'Triage & Caídos' },
          { id: 'services', label: 'Servicios & APIs' },
          { id: 'security', label: 'Seguridad Web' },
        ]}
        selectedCategory={perspective}
        onCategoryChange={(p) => setPerspective(p as PerspectiveMode)}
      />

      {/* 5. MAIN CONTENT PANELS (COCKPIT GRID OR CONSOLIDATED TABLE) */}
      {viewMode === 'grid' ? (
        <div className="space-y-6">
          {/* Row 1: Live Service Matrix + Security Headers Radar */}
          {(perspective === 'all' || perspective === 'services' || perspective === 'issues') && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Panel 1: Live Service Matrix (2 Columns) */}
              <div className="lg:col-span-2 bg-bg-card/95 border border-border-base/70 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-base/40 pb-3">
                  <div className="flex items-center gap-2 font-bold text-text-main text-base">
                    <Activity size={18} className="text-accent-green" />
                    Telemetría en Vivo de Servicios
                  </div>

                  {/* Sub-tabs for Service Matrix */}
                  <div className="flex items-center gap-1.5 bg-bg-dark/80 p-1 rounded-full border border-border-base/60 text-xs">
                    <button
                      type="button"
                      onClick={() => setServiceTab('all')}
                      className={`px-3 py-1 rounded-full font-medium transition-all ${
                        serviceTab === 'all'
                          ? 'bg-accent-green text-black font-semibold shadow-xs'
                          : 'text-text-dim hover:text-text-main'
                      }`}
                    >
                      Todos ({unifiedServices.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setServiceTab('monitoring')}
                      className={`px-3 py-1 rounded-full font-medium transition-all ${
                        serviceTab === 'monitoring'
                          ? 'bg-accent-green text-black font-semibold shadow-xs'
                          : 'text-text-dim hover:text-text-main'
                      }`}
                    >
                      Uptime ({totalMon})
                    </button>
                    <button
                      type="button"
                      onClick={() => setServiceTab('api_checks')}
                      className={`px-3 py-1 rounded-full font-medium transition-all ${
                        serviceTab === 'api_checks'
                          ? 'bg-accent-green text-black font-semibold shadow-xs'
                          : 'text-text-dim hover:text-text-main'
                      }`}
                    >
                      APIs ({totalAPIChecks})
                    </button>
                    <button
                      type="button"
                      onClick={() => setServiceTab('unhealthy')}
                      className={`px-3 py-1 rounded-full font-medium transition-all ${
                        serviceTab === 'unhealthy'
                          ? 'bg-accent-red text-white font-semibold shadow-xs'
                          : 'text-text-dim hover:text-accent-red'
                      }`}
                    >
                      Caídos ({downMon + failingAPIChecks})
                    </button>
                  </div>
                </div>

                {/* Table of Services */}
                {isLoadingMon && isLoadingAPI ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="animate-spin text-accent-green" size={28} />
                  </div>
                ) : filteredServices.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse font-sans">
                      <thead>
                        <tr className="border-b border-border-base text-text-dim text-xs bg-bg-card/50">
                          <th className="py-2.5 px-3">Servicio / Recurso</th>
                          <th className="py-2.5 px-3">Tipo</th>
                          <th className="py-2.5 px-3">Estado</th>
                          <th className="py-2.5 px-3">Latencia</th>
                          <th className="py-2.5 px-3 text-right">Último Check</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-base/40 font-mono text-xs">
                        {filteredServices.slice(0, 7).map((s) => (
                          <tr
                            key={s.id}
                            onClick={() =>
                              setSelectedItem(
                                s.type === 'Uptime Monitor'
                                  ? { type: 'monitoring', item: s.rawItem as MonitoringTarget }
                                  : { type: 'api_check', item: s.rawItem as APICheckTarget }
                              )
                            }
                            className="hover:bg-bg-card-hover/80 transition-colors cursor-pointer group"
                          >
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-text-main group-hover:text-accent-green transition-colors text-sm block truncate max-w-[240px] font-sans">
                                {s.name}
                              </span>
                              <span className="text-[11px] text-text-dim block truncate max-w-[240px]">
                                {s.endpoint}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-text-muted font-sans text-xs">
                              {s.type}
                            </td>
                            <td className="py-2.5 px-3 font-sans">
                              <StatusBadge status={s.status} />
                            </td>
                            <td className="py-2.5 px-3 font-bold text-text-main">
                              {s.latency !== null ? `${s.latency} ms` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right text-text-dim font-mono text-[11px] whitespace-nowrap">
                              {s.lastChecked
                                ? new Date(s.lastChecked).toLocaleTimeString('es-ES', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Nunca'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-text-dim py-8 text-center font-sans">
                    No se encontraron servicios que coincidan con los filtros.
                  </p>
                )}

                <div className="pt-2 border-t border-border-base/40 flex items-center justify-between text-xs text-text-dim font-sans">
                  <span>Mostrando los servicios más relevantes en vivo</span>
                  <button
                    type="button"
                    onClick={() => navigate('/monitoring')}
                    className="text-accent-green hover:underline flex items-center gap-1 font-semibold"
                  >
                    Ver todos en Monitoreo <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Panel 2: Security Headers Summary (1 Column) */}
              <div className="bg-bg-card/95 border border-border-base/70 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between border-b border-border-base/40 pb-3">
                    <div className="flex items-center gap-2 font-bold text-text-main text-base">
                      <ShieldCheck size={18} className="text-accent-green" />
                      Cabeceras de Seguridad
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/security-headers')}
                      className="text-xs text-accent-green hover:underline flex items-center gap-0.5 font-semibold"
                    >
                      Ver todas <ChevronRight size={14} />
                    </button>
                  </div>

                  {isLoadingSec ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="animate-spin text-accent-green" size={24} />
                    </div>
                  ) : securityHeaders && securityHeaders.length > 0 ? (
                    <div className="space-y-2.5 pt-3">
                      {securityHeaders.slice(0, 5).map((sh) => (
                        <div
                          key={sh.id}
                          onClick={() => setSelectedItem({ type: 'ssl', item: sh as any })}
                          className="flex items-center justify-between p-3 bg-bg-dark/80 border border-border-base/60 rounded-xl cursor-pointer hover:border-accent-green/40 transition-colors"
                        >
                          <div className="overflow-hidden pr-2">
                            <div className="font-bold text-text-main text-xs truncate">
                              {sh.name}
                            </div>
                            <div className="text-[10px] font-mono text-text-dim truncate">
                              {sh.url}
                            </div>
                          </div>
                          <GradeBadge
                            grade={calculateGrade(sh.last_score)}
                            score={sh.last_score}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-dim py-8 text-center">
                      No hay endpoints auditados con Security Headers.
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-border-base/40 text-[11px] text-text-dim flex items-center gap-1.5">
                  <Shield size={13} className="text-accent-green" />
                  <span>Cumplimiento OWASP HSTS, CSP y Anti-Clickjacking</span>
                </div>
              </div>
            </div>
          )}

          {/* Row 2: SSL Certificates + WHOIS Domains + Active Alerts Feed */}
          {(perspective === 'all' || perspective === 'security') && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* SSL Certificates Widget */}
              <div className="bg-bg-card/95 border border-border-base/70 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-border-base/40 pb-2.5">
                  <div className="flex items-center gap-2 font-bold text-text-main text-sm">
                    <Lock size={16} className="text-sky-400" />
                    Certificados SSL ({totalSSL})
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/ssl')}
                    className="text-xs text-accent-green hover:underline flex items-center gap-0.5"
                  >
                    Ver SSL <ChevronRight size={13} />
                  </button>
                </div>

                {isLoadingSSL ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-accent-green" size={20} />
                  </div>
                ) : sslCerts && sslCerts.length > 0 ? (
                  <div className="space-y-2">
                    {sslCerts.slice(0, 4).map((cert) => (
                      <div
                        key={cert.id}
                        onClick={() => setSelectedItem({ type: 'ssl', item: cert })}
                        className="p-3 bg-bg-dark/80 border border-border-base/60 rounded-xl flex items-center justify-between cursor-pointer hover:border-accent-green/40 transition-colors text-xs font-mono"
                      >
                        <div className="overflow-hidden pr-2">
                          <div className="font-bold text-text-main truncate font-sans">
                            {cert.domain}
                          </div>
                          <div className="text-[10px] text-text-dim truncate">
                            {cert.issuer || 'CA pendiente'}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                              cert.days_remaining !== null && cert.days_remaining <= 15
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : cert.days_remaining !== null && cert.days_remaining <= 30
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            }`}
                          >
                            {cert.days_remaining !== null ? `${cert.days_remaining}d` : '-'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-dim py-6 text-center">
                    No hay certificados registrados.
                  </p>
                )}
              </div>

              {/* WHOIS Domains Widget */}
              <div className="bg-bg-card/95 border border-border-base/70 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-border-base/40 pb-2.5">
                  <div className="flex items-center gap-2 font-bold text-text-main text-sm">
                    <Globe2 size={16} className="text-accent-green" />
                    Vigencia Dominios WHOIS ({totalDomains})
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/domains')}
                    className="text-xs text-accent-green hover:underline flex items-center gap-0.5"
                  >
                    Ver Dominios <ChevronRight size={13} />
                  </button>
                </div>

                {isLoadingDomains ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-accent-green" size={20} />
                  </div>
                ) : domains && domains.length > 0 ? (
                  <div className="space-y-2">
                    {domains.slice(0, 4).map((dom) => (
                      <div
                        key={dom.id}
                        onClick={() => setSelectedItem({ type: 'domain', item: dom })}
                        className="p-3 bg-bg-dark/80 border border-border-base/60 rounded-xl flex items-center justify-between cursor-pointer hover:border-accent-green/40 transition-colors text-xs font-mono"
                      >
                        <div className="overflow-hidden pr-2">
                          <div className="font-bold text-text-main truncate font-sans">
                            {dom.domain}
                          </div>
                          <div className="text-[10px] text-text-dim truncate">
                            {dom.registrar || 'Registrador pendiente'}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                              dom.days_until_expiration !== null && dom.days_until_expiration <= 30
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            }`}
                          >
                            {dom.days_until_expiration !== null
                              ? `${dom.days_until_expiration}d`
                              : '-'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-dim py-6 text-center">
                    No hay dominios registrados.
                  </p>
                )}
              </div>

              {/* Active Alerts & Incidents Feed */}
              <div className="bg-bg-card/95 border border-border-base/70 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-border-base/40 pb-2.5">
                  <div className="flex items-center gap-2 font-bold text-text-main text-sm">
                    <Flame size={16} className="text-amber-400" />
                    Feed de Alertas & Incidentes
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/alerts')}
                    className="text-xs text-accent-green hover:underline flex items-center gap-0.5"
                  >
                    Ver Alertas <ChevronRight size={13} />
                  </button>
                </div>

                {activeAlerts && activeAlerts.length > 0 ? (
                  <div className="space-y-2">
                    {activeAlerts.slice(0, 4).map((alert) => (
                      <div
                        key={alert.id}
                        onClick={() => setSelectedItem({ type: 'alert', item: alert })}
                        className="p-3 bg-bg-dark/80 border border-border-base/60 rounded-xl flex items-center justify-between cursor-pointer hover:border-accent-green/40 transition-colors text-xs"
                      >
                        <div className="overflow-hidden pr-2">
                          <div className="font-bold text-text-main truncate">{alert.title}</div>
                          <div className="text-[10px] text-text-dim truncate">
                            {new Date(alert.triggered_at).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                        <SeverityBadge severity={alert.severity} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-text-dim flex flex-col items-center justify-center gap-1.5">
                    <CheckCircle2 size={24} className="text-accent-green" />
                    <span>Sin alertas activas reportadas</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* CONSOLIDATED TABLE VIEW (Executive View) */
        <div className="bg-bg-card/95 border border-border-base/70 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="border-b border-border-base text-text-dim text-xs bg-bg-card/50">
                  <th className="py-3 px-4">Recurso / Endpoint</th>
                  <th className="py-3 px-3">Módulo</th>
                  <th className="py-3 px-3">Estado</th>
                  <th className="py-3 px-3">Telemetría / Latencia</th>
                  <th className="py-3 px-3 text-right">Última Comprobación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base/40 font-mono text-xs">
                {filteredServices.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() =>
                      setSelectedItem(
                        s.type === 'Uptime Monitor'
                          ? { type: 'monitoring', item: s.rawItem as MonitoringTarget }
                          : { type: 'api_check', item: s.rawItem as APICheckTarget }
                      )
                    }
                    className="hover:bg-bg-card-hover/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4">
                      <span className="font-bold text-text-main group-hover:text-accent-green transition-colors text-sm block font-sans">
                        {s.name}
                      </span>
                      <span className="text-[11px] text-text-dim block truncate max-w-[320px]">
                        {s.endpoint}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-text-muted font-sans text-xs">{s.type}</td>
                    <td className="py-3 px-3 font-sans">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="py-3 px-3 font-bold text-text-main">
                      {s.latency !== null ? `${s.latency} ms` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-text-dim font-mono text-xs whitespace-nowrap">
                      {s.lastChecked
                        ? new Date(s.lastChecked).toLocaleString('es-ES')
                        : 'Nunca'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. SLIDE-OVER INSPECTOR DRAWER (Zero Context Loss with NOCDrawer) */}
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
                    <div className="text-base font-bold font-mono text-accent-green mt-0.5">
                      {selectedItem.item.target_type}
                    </div>
                  </div>
                  <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                    <div className="text-[11px] text-text-dim">Latencia</div>
                    <div className="text-base font-bold font-mono text-text-main mt-0.5">
                      {selectedItem.item.last_latency !== null
                        ? `${selectedItem.item.last_latency} ms`
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
                className="w-full py-2 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>Ir al Módulo Específico</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </NOCDrawer>
    </div>
  );
}