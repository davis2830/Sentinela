import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { PublicStatusData, ServiceStatusItem, ScheduledMaintenanceItem } from '../types/status_page';
import UptimeBar90Days from '../components/status_page/UptimeBar90Days';
import SubscribeModal from '../components/status_page/SubscribeModal';
import StatusBadge from '../components/common/StatusBadge';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Loader2,
  Calendar,
  Clock,
  Mail,
  Activity,
  CheckCircle2,
  Search,
  ChevronDown,
  ChevronUp,
  Layers,
  History,
  Info,
  ExternalLink,
  Bell,
  Radio,
  Globe,
  Plug,
  Lock,
  Server,
  Sparkles,
} from 'lucide-react';

export default function PublicStatusPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);

  const { data: statusData, isLoading, isError, error } = useQuery<PublicStatusData>({
    queryKey: ['public-status-page', slug],
    queryFn: async () => {
      if (!slug) throw new Error('Slug no provisto');
      const response = await api.get(`status-page/public/${slug}/`);
      const resData = response.data?.data;
      if (!resData) {
        throw new Error('Página de estado no encontrada.');
      }
      return resData as PublicStatusData;
    },
    enabled: !!slug,
    refetchInterval: 30000,
  });

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#090D11] text-[#F8FAFC] flex flex-col items-center justify-center p-4 font-sans">
        <div className="relative mb-4">
          <div className="w-12 h-12 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
          <Activity size={22} className="text-emerald-400 absolute inset-0 m-auto" />
        </div>
        <p className="text-[#94A3B8] font-mono text-xs tracking-wider uppercase">
          Consultando telemetría de servicios...
        </p>
      </div>
    );
  }

  if (isError || !statusData) {
    return (
      <div className="min-h-screen bg-[#090D11] text-[#F8FAFC] flex flex-col items-center justify-center p-4 font-sans">
        <div className="bg-[#111720] border border-[#1E293B] rounded-3xl p-8 max-w-md text-center shadow-2xl space-y-4">
          <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
            <XCircle size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Status Page No Disponible</h2>
            <p className="text-[#94A3B8] text-xs mt-1.5 leading-relaxed">
              {(error as any)?.response?.data?.message ||
                (error as any)?.message ||
                'La página de estado solicitada no existe, es privada o ha sido suspendida.'}
            </p>
          </div>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#17202C] hover:bg-[#1E293B] border border-[#1E293B] text-xs text-[#94A3B8] hover:text-[#F8FAFC] transition-colors"
          >
            Volver al Inicio
          </a>
        </div>
      </div>
    );
  }

  const isOperational = statusData.system_status === 'operational';
  const isDegraded = statusData.system_status === 'degraded';

  // Filter and group services
  const filteredServices = statusData.services.filter((s: ServiceStatusItem) => {
    const query = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(query) ||
      (s.category && s.category.toLowerCase().includes(query))
    );
  });

  const groupedServices: Record<string, ServiceStatusItem[]> = {};
  filteredServices.forEach((service: ServiceStatusItem) => {
    const cat = service.category || 'Servicios Generales';
    if (!groupedServices[cat]) groupedServices[cat] = [];
    groupedServices[cat].push(service);
  });

  const getServiceTypeIcon = (type: string) => {
    switch (type) {
      case 'uptime':
        return <Globe size={14} className="text-emerald-400 shrink-0" />;
      case 'api':
        return <Plug size={14} className="text-amber-400 shrink-0" />;
      default:
        return <Server size={14} className="text-[#94A3B8] shrink-0" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#090D11] text-[#F8FAFC] font-sans selection:bg-emerald-500 selection:text-black">
      {/* 1. Header Navigation Bar */}
      <header className="border-b border-[#1E293B]/80 bg-[#111720]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo & Company Title */}
          <div className="flex items-center gap-3">
            {statusData.logo_url ? (
              <img
                src={statusData.logo_url}
                alt={statusData.company_name}
                className="h-9 w-auto max-w-[140px] rounded-xl object-contain border border-[#1E293B] bg-[#090D11] p-1"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-sm">
                <Activity size={18} />
              </div>
            )}

            <div>
              <h1 className="text-base font-bold text-[#F8FAFC] tracking-tight">
                {statusData.company_name}
              </h1>
              {statusData.description && (
                <p className="text-[11px] text-[#94A3B8] line-clamp-1">{statusData.description}</p>
              )}
            </div>
          </div>

          {/* Quick External Links & Subscribe */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {statusData.website_url && (
              <a
                href={statusData.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#090D11] border border-[#1E293B] text-[11px] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-emerald-500/40 transition-colors"
                title="Visitar sitio oficial"
              >
                <span>Sitio Oficial</span>
                <ExternalLink size={11} />
              </a>
            )}

            {statusData.support_email && (
              <a
                href={`mailto:${statusData.support_email}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#090D11] border border-[#1E293B] text-[11px] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-emerald-500/40 transition-colors"
                title="Contactar soporte técnico"
              >
                <Mail size={12} />
                <span>Soporte</span>
              </a>
            )}

            <button
              type="button"
              onClick={() => setShowSubscribeModal(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500 text-black font-semibold text-xs hover:bg-emerald-400 transition-all shadow-sm shadow-emerald-500/20 cursor-pointer"
            >
              <Bell size={13} />
              <span>Suscribirse</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Broadcast Announcement Banner (if active) */}
        {statusData.announcement_active && statusData.custom_announcement && (
          <div
            className={`p-4 rounded-2xl border shadow-lg flex items-start gap-3 text-xs animate-in fade-in duration-300 ${
              statusData.announcement_type === 'critical'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : statusData.announcement_type === 'warning'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
            }`}
          >
            <Radio size={16} className="shrink-0 mt-0.5 animate-pulse" />
            <div className="flex-1 min-w-0">
              <span className="font-bold uppercase tracking-wider text-[10px] block mb-0.5">
                Comunicado Oficial en Vivo
              </span>
              <p className="text-[#F8FAFC] leading-relaxed text-xs">
                {statusData.custom_announcement}
              </p>
            </div>
          </div>
        )}

        {/* Global Health Status Hero */}
        <div
          className={`p-6 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl transition-all ${
            isOperational
              ? 'bg-emerald-500/[0.07] border-emerald-500/30 text-emerald-400 ring-1 ring-emerald-500/20'
              : isDegraded
              ? 'bg-amber-500/[0.07] border-amber-500/30 text-amber-400 ring-1 ring-amber-500/20'
              : 'bg-rose-500/[0.07] border-rose-500/30 text-rose-400 ring-1 ring-rose-500/20'
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${
                isOperational
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : isDegraded
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {isOperational ? (
                <CheckCircle2 size={32} />
              ) : isDegraded ? (
                <AlertTriangle size={32} />
              ) : (
                <XCircle size={32} />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#F8FAFC] tracking-tight">
                  {statusData.system_status_label}
                </h2>
                {isOperational && (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                )}
              </div>
              <p className="text-xs text-[#94A3B8] mt-1">
                Monitoreo continuo en tiempo real &bull; Auto-refresco cada 30 segundos
              </p>
            </div>
          </div>

          <div className="text-right text-xs text-[#64748B] sm:border-l sm:border-[#1E293B] sm:pl-6">
            <span>Última verificación:</span>
            <div className="text-[#F8FAFC] font-mono font-bold mt-0.5 text-xs">
              {new Date(statusData.updated_at).toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </div>
          </div>
        </div>

        {/* High-Level KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* KPI 1: Uptime 90d */}
          <div className="bg-[#111720]/90 border border-[#1E293B] rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div>
              <span className="text-[11px] font-medium text-[#94A3B8] block">Disponibilidad 90d</span>
              <div className="text-base font-bold text-emerald-400 font-mono">
                {statusData.global_uptime_pct || 100}%
              </div>
            </div>
          </div>

          {/* KPI 2: Global Latency 24h */}
          <div className="bg-[#111720]/90 border border-[#1E293B] rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              <Clock size={18} />
            </div>
            <div>
              <span className="text-[11px] font-medium text-[#94A3B8] block">Latencia Media 24h</span>
              <div className="text-base font-bold text-sky-400 font-mono">
                {statusData.global_avg_latency_ms ? `${statusData.global_avg_latency_ms}ms` : '< 50ms'}
              </div>
            </div>
          </div>

          {/* KPI 3: Operational Services */}
          <div className="bg-[#111720]/90 border border-[#1E293B] rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Activity size={18} />
            </div>
            <div>
              <span className="text-[11px] font-medium text-[#94A3B8] block">Servicios Activos</span>
              <div className="text-base font-bold text-[#F8FAFC] font-mono">
                {statusData.operational_services_count} / {statusData.total_services_count}
              </div>
            </div>
          </div>

          {/* KPI 4: Maintenances */}
          <div className="bg-[#111720]/90 border border-[#1E293B] rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Calendar size={18} />
            </div>
            <div>
              <span className="text-[11px] font-medium text-[#94A3B8] block">Mantenimientos</span>
              <div className="text-base font-bold text-[#F8FAFC] font-mono">
                {statusData.maintenances?.length || 0} Registrados
              </div>
            </div>
          </div>
        </div>

        {/* Active Incidents Section */}
        {statusData.active_incidents && statusData.active_incidents.length > 0 && (
          <div className="bg-[#111720] border border-rose-500/40 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
                <AlertTriangle size={18} />
                Incidentes Operativos en Curso ({statusData.active_incidents.length})
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse">
                Investigación Activa
              </span>
            </div>

            <div className="space-y-3">
              {statusData.active_incidents.map((inc: any) => (
                <div
                  key={inc.id}
                  className="bg-[#090D11] border border-[#1E293B] rounded-2xl p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-[#F8FAFC] text-sm">{inc.title}</h4>
                      {inc.impacted_service && (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-[#111720] text-[10px] text-[#94A3B8] border border-[#1E293B] mt-1">
                          Servicio: {inc.impacted_service}
                        </span>
                      )}
                    </div>
                    <StatusBadge status={inc.status} />
                  </div>

                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    {inc.description || 'El equipo de operaciones está conteniendo la incidencia.'}
                  </p>

                  <div className="text-[10px] font-mono text-[#64748B] pt-2 border-t border-[#1E293B]/60">
                    Reportado: {new Date(inc.opened_at).toLocaleString('es-ES')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scheduled Maintenances Section */}
        {statusData.maintenances && statusData.maintenances.length > 0 && (
          <div className="bg-[#111720] border border-amber-500/40 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
                <Calendar size={18} />
                Ventanas de Mantenimiento Programadas ({statusData.maintenances.length})
              </h3>
              <span className="text-xs text-[#94A3B8]">Intervención planificada</span>
            </div>

            <div className="space-y-4">
              {statusData.maintenances.map((m: ScheduledMaintenanceItem) => (
                <div
                  key={m.id}
                  className="bg-[#090D11] border border-[#1E293B] rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-bold text-[#F8FAFC] text-sm">{m.title}</h4>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        m.status === 'in_progress'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                          : 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                      }`}
                    >
                      {m.status === 'in_progress' ? 'En Progreso Ahora' : 'Programado'}
                    </span>
                  </div>

                  {m.description && (
                    <p className="text-xs text-[#94A3B8] leading-relaxed">{m.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-[11px] font-mono text-[#64748B] pt-2 border-t border-[#1E293B]/60 flex-wrap">
                    <span>
                      Inicio:{' '}
                      <strong className="text-[#F8FAFC]">
                        {new Date(m.start_time).toLocaleString('es-ES')}
                      </strong>
                    </span>
                    <span>&bull;</span>
                    <span>
                      Fin estimado:{' '}
                      <strong className="text-[#F8FAFC]">
                        {new Date(m.end_time).toLocaleString('es-ES')}
                      </strong>
                    </span>
                  </div>

                  {/* Nested Live Updates */}
                  {m.updates && m.updates.length > 0 && (
                    <div className="pt-2 border-t border-[#1E293B]/40 space-y-2">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-[#64748B] block">
                        Bitácora de Avance en Vivo:
                      </span>
                      <div className="space-y-1.5">
                        {m.updates.map((up: any) => (
                          <div
                            key={up.id}
                            className="bg-[#111720]/80 rounded-xl p-2.5 border border-[#1E293B]/60 text-xs"
                          >
                            <div className="flex items-center justify-between text-[10px] text-[#64748B] font-mono mb-0.5">
                              <span className="text-purple-400 font-semibold uppercase">
                                {up.status}
                              </span>
                              <span>{new Date(up.posted_at).toLocaleTimeString('es-ES')}</span>
                            </div>
                            <p className="text-[#94A3B8] text-[11px] leading-relaxed">
                              {up.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Services Grouped by Category */}
        <div className="bg-[#111720] border border-[#1E293B] rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1E293B] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
                <Layers size={18} className="text-emerald-400" />
                Estado por Servicios & Disponibilidad Histórica
              </h3>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Desglose en tiempo real y porcentaje de disponibilidad acumulado en los últimos 90 días.
              </p>
            </div>

            {/* Quick Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 text-[#64748B]" size={14} />
              <input
                type="text"
                placeholder="Buscar servicio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#090D11] border border-[#1E293B] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-emerald-500 font-sans"
              />
            </div>
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-4 bg-[#090D11] p-3 rounded-2xl border border-[#1E293B] text-xs font-mono text-[#94A3B8]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Operacional (&ge;99%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Latencia / Degradado (80%-98%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Interrupción (&lt;80%)
            </span>
          </div>

          {/* Categorized List */}
          <div className="space-y-4">
            {Object.keys(groupedServices).length > 0 ? (
              Object.entries(groupedServices).map(([category, servicesList]) => {
                const isCollapsed = collapsedCategories[category];
                const catUpCount = servicesList.filter((s) => s.current_status === 'up').length;

                return (
                  <div
                    key={category}
                    className="border border-[#1E293B] rounded-2xl overflow-hidden bg-[#090D11]/50"
                  >
                    {/* Category Header */}
                    <button
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className="w-full bg-[#090D11] px-5 py-3.5 flex items-center justify-between border-b border-[#1E293B]/70 text-left hover:bg-[#17202C]/40 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-[#F8FAFC] text-sm">{category}</span>
                        <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-semibold">
                          {catUpCount} de {servicesList.length} Operacionales
                        </span>
                      </div>
                      {isCollapsed ? (
                        <ChevronDown size={16} className="text-[#64748B]" />
                      ) : (
                        <ChevronUp size={16} className="text-[#64748B]" />
                      )}
                    </button>

                    {/* Category Services */}
                    {!isCollapsed && (
                      <div className="p-5 space-y-6 divide-y divide-[#1E293B]/50">
                        {servicesList.map((service) => (
                          <div key={service.id} className="pt-6 first:pt-0 space-y-3">
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                              <div className="flex items-center gap-2">
                                {getServiceTypeIcon(service.type)}
                                <span className="font-bold text-[#F8FAFC] text-sm">
                                  {service.name}
                                </span>
                              </div>

                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                                  service.current_status === 'up'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                }`}
                              >
                                {service.current_status === 'up' ? (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    Operacional
                                  </>
                                ) : (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                    Interrupción
                                  </>
                                )}
                              </span>
                            </div>

                            {/* 90-Day Uptime Bar with 24h Latency */}
                            <UptimeBar90Days
                              history={service.history_90_days}
                              overallPct={service.uptime_90_days_pct}
                              avgLatencyMs={
                                statusData.show_latency_24h ? service.avg_latency_24h_ms : undefined
                              }
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-[#64748B] text-xs font-mono">
                No se encontraron servicios que coincidan con la búsqueda.
              </div>
            )}
          </div>
        </div>

        {/* Past Resolved Incidents History (Last 30 Days) */}
        {statusData.past_incidents && statusData.past_incidents.length > 0 && (
          <div className="bg-[#111720] border border-[#1E293B] rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2 border-b border-[#1E293B] pb-3">
              <History size={18} className="text-sky-400" />
              Historial de Incidentes Resueltos (Últimos 30 días)
            </h3>
            <div className="space-y-3 text-xs">
              {statusData.past_incidents.map((pInc: any) => (
                <div
                  key={pInc.id}
                  className="bg-[#090D11] border border-[#1E293B] rounded-2xl p-4 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-[#F8FAFC] text-sm">{pInc.title}</h4>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      Resuelto
                    </span>
                  </div>
                  {pInc.impacted_service && (
                    <span className="text-[10px] text-[#94A3B8]">
                      Servicio: {pInc.impacted_service}
                    </span>
                  )}
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    {pInc.description || 'Incidente resuelto satisfactoriamente.'}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-[#64748B] border-t border-[#1E293B]/60 pt-2 font-mono">
                    <span>Abierto: {new Date(pInc.opened_at).toLocaleDateString('es-ES')}</span>
                    {pInc.closed_at && (
                      <span>Resuelto: {new Date(pInc.closed_at).toLocaleDateString('es-ES')}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* 3. Public Footer */}
      <footer className="border-t border-[#1E293B] py-8 mt-12 bg-[#090D11] text-center text-xs font-mono text-[#64748B] space-y-2">
        <p>
          Powered by <strong className="text-[#F8FAFC]">Sentinel NOC Observability</strong> &bull; Monitorización continua
        </p>
        <p className="text-[11px] text-[#64748B]/80">
          Los datos de disponibilidad se actualizan cada 30 segundos automáticamente.
        </p>
      </footer>

      {/* Subscribe Modal */}
      {slug && (
        <SubscribeModal
          isOpen={showSubscribeModal}
          onClose={() => setShowSubscribeModal(false)}
          slug={slug}
          companyName={statusData.company_name}
        />
      )}
    </div>
  );
}
