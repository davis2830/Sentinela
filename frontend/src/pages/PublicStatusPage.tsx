import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { PublicStatusData, ServiceStatusItem } from '../types/status_page';
import UptimeBar90Days from '../components/status_page/UptimeBar90Days';
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
} from 'lucide-react';

export default function PublicStatusPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const { data: statusData, isLoading, isError, error } = useQuery({
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
      <div className="min-h-screen bg-bg-dark text-text-main flex flex-col items-center justify-center p-4 font-sans">
        <Loader2 className="animate-spin text-accent-green mb-3" size={36} />
        <p className="text-text-muted font-mono text-sm">Cargando estado del servicio...</p>
      </div>
    );
  }

  if (isError || !statusData) {
    return (
      <div className="min-h-screen bg-bg-dark text-text-main flex flex-col items-center justify-center p-4 font-sans">
        <div className="bg-bg-card border border-border-base rounded-2xl p-8 max-w-md text-center shadow-2xl">
          <XCircle className="mx-auto text-accent-red mb-4" size={48} />
          <h2 className="text-xl font-bold mb-2">Status Page No Disponible</h2>
          <p className="text-text-muted text-sm mb-4">
            {(error as any)?.response?.data?.message || (error as any)?.message || 'La página de estado solicitada no existe o es privada.'}
          </p>
        </div>
      </div>
    );
  }

  const isOperational = statusData.system_status === 'operational';
  const isDegraded = statusData.system_status === 'degraded';

  // Group services by category
  const filteredServices = statusData.services.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedServices: Record<string, ServiceStatusItem[]> = {};
  filteredServices.forEach((service) => {
    const cat = service.category || 'Servicios Generales';
    if (!groupedServices[cat]) groupedServices[cat] = [];
    groupedServices[cat].push(service);
  });

  return (
    <div className="min-h-screen bg-bg-dark text-text-main font-sans selection:bg-accent-green selection:text-black">
      {/* Header Banner */}
      <header className="border-b border-border-base bg-bg-card/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={statusData.logo_url || '/logo.png'}
              alt={statusData.company_name}
              className="h-10 w-auto rounded-xl object-contain shadow-sm border border-border-base/50 bg-bg-dark/80 p-1"
            />
            <div>
              <h1 className="text-lg font-bold text-text-main">{statusData.company_name}</h1>
              <p className="text-xs text-text-muted">{statusData.description}</p>
            </div>
          </div>

          {statusData.support_email && (
            <a
              href={`mailto:${statusData.support_email}`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-dark border border-border-base rounded-lg text-xs font-mono text-text-muted hover:text-text-main hover:border-accent-green/50 transition-colors"
            >
              <Mail size={14} />
              Soporte Técnico
            </a>
          )}
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Global Health Status Banner */}
        <div
          className={`p-6 rounded-2xl border flex items-center justify-between gap-4 shadow-xl transition-all ${
            isOperational
              ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
              : isDegraded
              ? 'bg-accent-yellow/10 border-accent-yellow/30 text-accent-yellow'
              : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
          }`}
        >
          <div className="flex items-center gap-4">
            {isOperational ? (
              <CheckCircle2 size={36} className="shrink-0" />
            ) : isDegraded ? (
              <AlertTriangle size={36} className="shrink-0" />
            ) : (
              <XCircle size={36} className="shrink-0" />
            )}

            <div>
              <h2 className="text-lg font-bold text-text-main">{statusData.system_status_label}</h2>
              <p className="text-xs text-text-muted mt-0.5">
                Monitoreo activo &bull; Actualización automática cada 30 segundos
              </p>
            </div>
          </div>

          <div className="hidden md:flex flex-col items-end text-xs text-text-dim">
            <span>Último chequeo:</span>
            <span className="text-text-main font-bold mt-0.5 font-mono">
              {new Date(statusData.updated_at).toLocaleTimeString('es-ES')}
            </span>
          </div>
        </div>

        {/* High-Level KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-bg-card border border-border-base rounded-2xl p-4 flex items-center gap-3.5 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-accent-green/10 border border-accent-green/30 flex items-center justify-center text-accent-green font-bold">
              <ShieldCheck size={20} />
            </div>
            <div>
              <span className="text-xs font-medium text-text-muted">Disponibilidad 90 días</span>
              <div className="text-lg font-bold text-accent-green font-mono mt-0.5">{statusData.global_uptime_pct || 100}%</div>
            </div>
          </div>

          <div className="bg-bg-card border border-border-base rounded-2xl p-4 flex items-center gap-3.5 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center text-accent-blue font-bold">
              <Activity size={20} />
            </div>
            <div>
              <span className="text-xs font-medium text-text-muted">Servicios Operacionales</span>
              <div className="text-lg font-bold text-text-main font-mono mt-0.5">
                {statusData.operational_services_count} / {statusData.total_services_count} Activos
              </div>
            </div>
          </div>

          <div className="bg-bg-card border border-border-base rounded-2xl p-4 flex items-center gap-3.5 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-accent-yellow/10 border border-accent-yellow/30 flex items-center justify-center text-accent-yellow font-bold">
              <Calendar size={20} />
            </div>
            <div>
              <span className="text-xs font-medium text-text-muted">Mantenimientos</span>
              <div className="text-lg font-bold text-text-main font-mono mt-0.5">
                {statusData.maintenances?.length || 0} Programados
              </div>
            </div>
          </div>
        </div>

        {/* Active Incidents Section */}
        {statusData.active_incidents && statusData.active_incidents.length > 0 && (
          <div className="bg-bg-card border border-accent-red/30 rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-accent-red mb-4 flex items-center gap-2">
              <AlertTriangle size={18} />
              Incidentes Activos en Curso ({statusData.active_incidents.length})
            </h3>
            <div className="space-y-4">
              {statusData.active_incidents.map((inc) => (
                <div key={inc.id} className="bg-bg-dark border border-border-base rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-text-main text-sm">{inc.title}</h4>
                    <StatusBadge status={inc.status} />
                  </div>
                  <p className="text-xs text-text-muted">{inc.description || 'Analizando impacto técnico.'}</p>
                  <p className="text-[10px] font-mono text-text-dim">
                    Iniciado el: {new Date(inc.opened_at).toLocaleString('es-ES')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scheduled Maintenances Section */}
        {statusData.maintenances && statusData.maintenances.length > 0 && (
          <div className="bg-bg-card border border-accent-yellow/30 rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-accent-yellow mb-4 flex items-center gap-2">
              <Calendar size={18} />
              Mantenimientos Programados
            </h3>
            <div className="space-y-4">
              {statusData.maintenances.map((m) => (
                <div key={m.id} className="bg-bg-dark border border-border-base rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-text-main text-sm">{m.title}</h4>
                    <StatusBadge
                      status={m.status === 'in_progress' ? 'investigating' : 'active'}
                      label={m.status === 'in_progress' ? 'En Progreso' : 'Programado'}
                    />
                  </div>
                  <p className="text-xs text-text-muted">{m.description || 'Mantenimiento planificado de infraestructura.'}</p>
                  <div className="flex items-center gap-4 text-[11px] font-mono text-text-dim pt-1 border-t border-border-base/40">
                    <span>Inicio: {new Date(m.start_time).toLocaleString('es-ES')}</span>
                    <span>Fin estimado: {new Date(m.end_time).toLocaleString('es-ES')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Services Grouped Section */}
        <div className="bg-bg-card border border-border-base rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-base pb-4">
            <div>
              <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                <Layers size={20} className="text-accent-green" />
                Estado por Servicios y Disponibilidad de 90 Días
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Organizado por categoría para una lectura rápida y clara del estado operativo
              </p>
            </div>

            {/* Quick Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 text-text-dim" size={14} />
              <input
                type="text"
                placeholder="Buscar servicio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-bg-dark border border-border-base rounded-lg pl-9 pr-3 py-1.5 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
              />
            </div>
          </div>

          {/* Color Legend for Digestibility */}
          <div className="flex flex-wrap items-center gap-4 bg-bg-dark/80 p-3 rounded-xl border border-border-base/60 text-xs font-mono text-text-dim">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-green inline-block" /> Operacional (&ge;99%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-yellow inline-block" /> Latencia / Degradado (80%-98%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-red inline-block" /> Interrupción (&lt;80%)
            </span>
          </div>

          {/* Categorized List */}
          <div className="space-y-6">
            {Object.keys(groupedServices).length > 0 ? (
              Object.entries(groupedServices).map(([category, servicesList]) => {
                const isCollapsed = collapsedCategories[category];
                const catUpCount = servicesList.filter((s) => s.current_status === 'up').length;

                return (
                  <div key={category} className="border border-border-base/80 rounded-xl overflow-hidden bg-bg-dark/40">
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full bg-bg-dark px-4 py-3 flex items-center justify-between border-b border-border-base/60 text-left hover:bg-bg-card transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text-main text-sm font-mono">{category}</span>
                        <span className="text-[10px] font-mono bg-accent-green/10 text-accent-green border border-accent-green/30 px-2 py-0.5 rounded font-semibold">
                          {catUpCount} de {servicesList.length} Operacionales
                        </span>
                      </div>
                      {isCollapsed ? <ChevronDown size={16} className="text-text-dim" /> : <ChevronUp size={16} className="text-text-dim" />}
                    </button>

                    {/* Category Services */}
                    {!isCollapsed && (
                      <div className="p-4 space-y-5 divide-y divide-border-base/40">
                        {servicesList.map((service) => (
                          <div key={service.id} className="pt-5 first:pt-0 space-y-2">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-text-main text-sm">{service.name}</span>
                                <span className="text-[10px] bg-bg-dark border border-border-base px-2 py-0.5 rounded-full text-text-dim font-medium">
                                  {service.type}
                                </span>
                              </div>
                              <StatusBadge
                                status={service.current_status === 'up' ? 'pass' : 'fail'}
                                label={service.current_status === 'up' ? 'Operacional' : 'Interrupción'}
                              />
                            </div>

                            {/* 90-Day Uptime Bar */}
                            <UptimeBar90Days history={service.history_90_days} overallPct={service.uptime_90_days_pct} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-text-dim text-xs font-mono py-6 text-center">
                No se encontraron servicios que coincidan con la búsqueda.
              </p>
            )}
          </div>
        </div>

        {/* Recent Past Incidents History Section (Transparency) */}
        {statusData.past_incidents && statusData.past_incidents.length > 0 && (
          <div className="bg-bg-card border border-border-base rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-text-main flex items-center gap-2 border-b border-border-base pb-3">
              <History size={18} className="text-accent-blue" />
              Historial de Incidentes Recientes Resueltos (Últimos 30 días)
            </h3>
            <div className="space-y-3 font-mono text-xs">
              {statusData.past_incidents.map((pInc) => (
                <div key={pInc.id} className="bg-bg-dark border border-border-base/70 rounded-xl p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-text-main text-sm font-sans">{pInc.title}</h4>
                    <StatusBadge status="resolved" label="Resuelto" />
                  </div>
                  <p className="text-xs text-text-muted font-sans">{pInc.description || 'Incidente resuelto satisfactoriamente por el equipo técnico.'}</p>
                  <div className="flex items-center justify-between text-[10px] text-text-dim border-t border-border-base/40 pt-1.5">
                    <span>Abierto: {new Date(pInc.opened_at).toLocaleDateString('es-ES')}</span>
                    {pInc.closed_at && <span>Resuelto: {new Date(pInc.closed_at).toLocaleDateString('es-ES')}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Public Footer */}
      <footer className="border-t border-border-base py-6 mt-12 bg-bg-dark text-center text-xs font-mono text-text-dim">
        <p>Plataforma de Observabilidad Sentinela &bull; Monitoreo de disponibilidad en tiempo real</p>
      </footer>
    </div>
  );
}
