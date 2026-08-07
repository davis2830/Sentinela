import React from 'react';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();

  // Queries for real live data across all Sentinel modules
  const { data: monitoringTargets, isLoading: isLoadingMon, refetch: refetchMon } = useQuery({
    queryKey: ['dash-monitoring'],
    queryFn: async () => {
      const res = await api.get('monitoring/');
      return (res.data?.data || []) as MonitoringTarget[];
    },
    refetchInterval: 15000,
  });

  const { data: sslCerts, isLoading: isLoadingSSL, refetch: refetchSSL } = useQuery({
    queryKey: ['dash-ssl'],
    queryFn: async () => {
      const res = await api.get('ssl-certificates/');
      return (res.data?.data || []) as SSLCertificate[];
    },
    refetchInterval: 30000,
  });

  const { data: domains, isLoading: isLoadingDomains } = useQuery({
    queryKey: ['dash-domains'],
    queryFn: async () => {
      const res = await api.get('domains/');
      return (res.data?.data || []) as DomainInfo[];
    },
    refetchInterval: 30000,
  });

  const { data: apiChecks, isLoading: isLoadingAPI, refetch: refetchAPI } = useQuery({
    queryKey: ['dash-api-checks'],
    queryFn: async () => {
      const res = await api.get('api-checks/');
      return (res.data?.data || []) as APICheckTarget[];
    },
    refetchInterval: 15000,
  });

  const { data: securityHeaders, isLoading: isLoadingSec } = useQuery({
    queryKey: ['dash-sec-headers'],
    queryFn: async () => {
      const res = await api.get('security-headers/');
      return (res.data?.data || []) as SecurityHeaderTarget[];
    },
    refetchInterval: 30000,
  });

  const { data: activeAlerts, isLoading: isLoadingAlerts } = useQuery({
    queryKey: ['dash-active-alerts'],
    queryFn: async () => {
      const res = await api.get('alerts/?status=active');
      return (res.data?.data || []) as Alert[];
    },
    refetchInterval: 15000,
  });

  const { data: openIncidents, isLoading: isLoadingIncidents } = useQuery({
    queryKey: ['dash-open-incidents'],
    queryFn: async () => {
      const res = await api.get('incidents/');
      const allIncidents = (res.data?.data || []) as Incident[];
      return allIncidents.filter((inc) => inc.status === 'open' || inc.status === 'investigating');
    },
    refetchInterval: 15000,
  });

  const handleRefetchAll = () => {
    refetchMon();
    refetchSSL();
    refetchAPI();
  };

  // Metrics calculations
  const totalMon = monitoringTargets?.length || 0;
  const upMon = monitoringTargets?.filter((t) => t.last_status === 'up').length || 0;
  const monPercentage = totalMon > 0 ? Math.round((upMon / totalMon) * 100) : 100;

  const totalSSL = sslCerts?.length || 0;
  const expiringSSL = sslCerts?.filter((c) => c.days_remaining !== null && c.days_remaining <= 30).length || 0;

  const totalAPIChecks = apiChecks?.length || 0;
  const passingAPIChecks = apiChecks?.filter((a) => a.last_status === 'pass').length || 0;

  const alertsCount = activeAlerts?.length || 0;
  const incidentsCount = openIncidents?.length || 0;

  const metrics = [
    {
      title: 'Uptime Targets',
      value: `${upMon}/${totalMon}`,
      subtitle: `${monPercentage}% operacional online`,
      icon: Activity,
      color: upMon === totalMon && totalMon > 0 ? 'text-accent-green' : 'text-accent-yellow',
      onClick: () => navigate('/monitoring'),
    },
    {
      title: 'Certificados SSL',
      value: totalSSL,
      subtitle: expiringSSL > 0 ? `${expiringSSL} por expirar` : 'Todos los SSL vigentes',
      icon: Lock,
      color: expiringSSL > 0 ? 'text-accent-yellow' : 'text-accent-blue',
      onClick: () => navigate('/ssl'),
    },
    {
      title: 'API Endpoints',
      value: `${passingAPIChecks}/${totalAPIChecks}`,
      subtitle: 'Validación HTTP & Esquemas',
      icon: Plug,
      color: passingAPIChecks === totalAPIChecks && totalAPIChecks > 0 ? 'text-accent-green' : 'text-accent-yellow',
      onClick: () => navigate('/api-checks'),
    },
    {
      title: 'Alertas Activas',
      value: alertsCount,
      subtitle: alertsCount > 0 ? 'Atención requerida' : 'Sin alertas activas',
      icon: Zap,
      color: alertsCount > 0 ? 'text-accent-yellow' : 'text-accent-green',
      onClick: () => navigate('/alerts'),
    },
    {
      title: 'Incidentes En Curso',
      value: incidentsCount,
      subtitle: incidentsCount > 0 ? 'Investigación abierta' : 'Sin incidentes abiertos',
      icon: AlertOctagon,
      color: incidentsCount > 0 ? 'text-accent-red' : 'text-accent-green',
      onClick: () => navigate('/incidents'),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            <Activity className="text-accent-green" size={28} />
            Observabilidad Global NOC
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Consola centralizada de salud, telemetría y estado operativo en tiempo real
          </p>
        </div>
        <button
          onClick={handleRefetchAll}
          className="flex items-center gap-2 bg-accent-green text-black font-semibold px-4 py-2 rounded-md text-sm hover:opacity-90 transition-opacity self-start sm:self-auto"
        >
          <RefreshCw size={16} />
          Actualizar Telemetría
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.title}
              onClick={metric.onClick}
              className="bg-bg-card border border-border-base rounded-xl p-5 relative overflow-hidden cursor-pointer hover:border-accent-green/50 transition-all group shadow-lg"
            >
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-accent-green to-transparent"></div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-muted uppercase tracking-wide font-mono font-semibold">
                  {metric.title}
                </span>
                <Icon className={`${metric.color} group-hover:scale-110 transition-transform`} size={18} />
              </div>
              <div className={`text-2xl font-bold font-mono ${metric.color}`}>
                {metric.value}
              </div>
              <div className="text-[11px] text-text-muted mt-1 truncate">{metric.subtitle}</div>
            </div>
          );
        })}
      </div>

      {/* Panels Grid: Live Telemetry Endpoints & Security Headers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Real Live Endpoints Telemetry Table */}
        <div className="lg:col-span-2 bg-bg-card border border-border-base rounded-xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4 border-b border-border-base pb-3">
            <div className="flex items-center gap-2 font-bold text-text-main">
              <Activity size={18} className="text-accent-green" />
              Telemetría Real de Servicios Monitoreados
            </div>
            <button
              onClick={() => navigate('/monitoring')}
              className="text-xs text-accent-green hover:underline flex items-center gap-1 font-mono font-semibold"
            >
              Ver todos <ArrowRight size={14} />
            </button>
          </div>

          {isLoadingMon && isLoadingAPI ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="animate-spin text-accent-green" size={24} />
            </div>
          ) : (monitoringTargets && monitoringTargets.length > 0) || (apiChecks && apiChecks.length > 0) ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border-base bg-bg-dark/50 text-text-muted font-mono text-xs uppercase">
                    <th className="py-3 px-3 font-semibold">Servicio / Recurso</th>
                    <th className="py-3 px-3 font-semibold">Tipo</th>
                    <th className="py-3 px-3 font-semibold">Estado</th>
                    <th className="py-3 px-3 font-semibold">Latencia</th>
                    <th className="py-3 px-3 font-semibold text-right">Último Escaneo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-base/50 font-mono text-xs">
                  {/* Real Monitoring Targets */}
                  {monitoringTargets?.slice(0, 4).map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => navigate('/monitoring')}
                      className="hover:bg-bg-card-hover/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-3 font-bold text-text-main">
                        <div className="truncate max-w-[200px]" title={t.name}>
                          {t.name}
                        </div>
                        <div className="text-[10px] text-text-dim truncate max-w-[200px] font-normal">
                          {t.endpoint}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-text-muted">Uptime Monitor</td>
                      <td className="py-3 px-3">
                        <StatusBadge status={t.last_status || 'desconocido'} />
                      </td>
                      <td className="py-3 px-3 text-text-main font-semibold">
                        {t.last_latency !== null ? `${t.last_latency} ms` : '-'}
                      </td>
                      <td className="py-3 px-3 text-right text-text-dim">
                        {t.last_checked_at
                          ? new Date(t.last_checked_at).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Nunca'}
                      </td>
                    </tr>
                  ))}

                  {/* Real API Check Targets */}
                  {apiChecks?.slice(0, 4).map((apiCheck) => (
                    <tr
                      key={apiCheck.id}
                      onClick={() => navigate('/api-checks')}
                      className="hover:bg-bg-card-hover/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-3 font-bold text-text-main">
                        <div className="truncate max-w-[200px]" title={apiCheck.name}>
                          {apiCheck.name}
                        </div>
                        <div className="text-[10px] text-text-dim truncate max-w-[200px] font-normal">
                          {apiCheck.method} {apiCheck.url}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-text-muted">API Check</td>
                      <td className="py-3 px-3">
                        <StatusBadge status={apiCheck.last_status || 'desconocido'} />
                      </td>
                      <td className="py-3 px-3 text-text-main font-semibold">
                        {apiCheck.expected_response_time_ms} ms max
                      </td>
                      <td className="py-3 px-3 text-right text-text-dim">
                        {apiCheck.last_checked_at
                          ? new Date(apiCheck.last_checked_at).toLocaleTimeString('es-ES', {
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
            <p className="text-text-dim text-xs py-8 text-center font-mono">
              No hay recursos monitoreados activos actualmente.
            </p>
          )}
        </div>

        {/* Real Security Headers Summary Panel */}
        <div className="bg-bg-card border border-border-base rounded-xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-border-base pb-3">
              <div className="flex items-center gap-2 font-bold text-text-main">
                <ShieldCheck size={18} className="text-accent-green" />
                Security Headers Reales
              </div>
              <button
                onClick={() => navigate('/security-headers')}
                className="text-xs text-accent-green hover:underline flex items-center gap-1 font-mono font-semibold"
              >
                Ver todos <ArrowRight size={14} />
              </button>
            </div>

            {isLoadingSec ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="animate-spin text-accent-green" size={24} />
              </div>
            ) : securityHeaders && securityHeaders.length > 0 ? (
              <div className="space-y-3">
                {securityHeaders.map((target) => (
                  <div
                    key={target.id}
                    onClick={() => navigate('/security-headers')}
                    className="flex items-center justify-between p-3 bg-bg-dark border border-border-base rounded-xl cursor-pointer hover:border-accent-green/40 transition-colors"
                  >
                    <div className="overflow-hidden pr-2">
                      <div className="font-bold text-text-main text-xs truncate">{target.name}</div>
                      <div className="text-[10px] font-mono text-text-dim truncate">{target.url}</div>
                    </div>
                    <GradeBadge
                      grade={
                        target.last_score !== null
                          ? target.last_score >= 90
                            ? 'A+'
                            : target.last_score >= 80
                            ? 'A'
                            : target.last_score >= 70
                            ? 'B'
                            : 'F'
                          : null
                      }
                      score={target.last_score}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-text-dim font-mono text-xs">
                No hay escaneos de Security Headers registrados.
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-border-base text-xs text-text-dim font-mono flex items-center gap-1.5">
            <Shield size={14} className="text-accent-green" />
            <span>Auditoría HSTS, CSP y X-Frame-Options en vivo</span>
          </div>
        </div>
      </div>

      {/* SSL & WHOIS Expiration Watch Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Real SSL Certificates Panel */}
        <div className="bg-bg-card border border-border-base rounded-xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4 border-b border-border-base pb-3">
            <div className="flex items-center gap-2 font-bold text-text-main">
              <Lock size={18} className="text-accent-blue" />
              Estado Real de Certificados SSL
            </div>
            <button
              onClick={() => navigate('/ssl')}
              className="text-xs text-accent-green hover:underline flex items-center gap-1 font-mono font-semibold"
            >
              Ver SSL <ArrowRight size={14} />
            </button>
          </div>

          {isLoadingSSL ? (
            <div className="flex items-center justify-center py-6">
              <RefreshCw className="animate-spin text-accent-green" size={20} />
            </div>
          ) : sslCerts && sslCerts.length > 0 ? (
            <div className="space-y-3 font-mono text-xs">
              {sslCerts.map((cert) => (
                <div
                  key={cert.id}
                  onClick={() => navigate('/ssl')}
                  className="p-3 bg-bg-dark border border-border-base rounded-xl flex items-center justify-between cursor-pointer hover:border-accent-green/40 transition-colors"
                >
                  <div>
                    <div className="font-bold text-text-main">{cert.domain}</div>
                    <div className="text-[10px] text-text-dim">{cert.issuer || 'Emisor pendiente'}</div>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={cert.is_valid ? 'valid' : 'invalid'} />
                    <div className="text-[10px] text-text-muted mt-1 font-bold">
                      {cert.days_remaining !== null ? `${cert.days_remaining} días` : '-'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-dim text-xs py-4 text-center font-mono">No hay certificados registrados.</p>
          )}
        </div>

        {/* Real WHOIS Domains Panel */}
        <div className="bg-bg-card border border-border-base rounded-xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4 border-b border-border-base pb-3">
            <div className="flex items-center gap-2 font-bold text-text-main">
              <Globe2 size={18} className="text-accent-green" />
              Vigencia Real de Dominios WHOIS
            </div>
            <button
              onClick={() => navigate('/domains')}
              className="text-xs text-accent-green hover:underline flex items-center gap-1 font-mono font-semibold"
            >
              Ver Dominios <ArrowRight size={14} />
            </button>
          </div>

          {isLoadingDomains ? (
            <div className="flex items-center justify-center py-6">
              <RefreshCw className="animate-spin text-accent-green" size={20} />
            </div>
          ) : domains && domains.length > 0 ? (
            <div className="space-y-3 font-mono text-xs">
              {domains.map((dom) => (
                <div
                  key={dom.id}
                  onClick={() => navigate('/domains')}
                  className="p-3 bg-bg-dark border border-border-base rounded-xl flex items-center justify-between cursor-pointer hover:border-accent-green/40 transition-colors"
                >
                  <div>
                    <div className="font-bold text-text-main">{dom.domain}</div>
                    <div className="text-[10px] text-text-dim">{dom.registrar || 'Registrar pendiente'}</div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`font-bold ${
                        dom.days_until_expiration !== null && dom.days_until_expiration <= 30
                          ? 'text-accent-red'
                          : 'text-accent-green'
                      }`}
                    >
                      {dom.days_until_expiration !== null ? `${dom.days_until_expiration} días` : '-'}
                    </span>
                    <div className="text-[10px] text-text-muted mt-1">
                      {dom.expiration_date ? new Date(dom.expiration_date).toLocaleDateString('es-ES') : 'N/A'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-dim text-xs py-4 text-center font-mono">No hay dominios registrados.</p>
          )}
        </div>
      </div>
    </div>
  );
}