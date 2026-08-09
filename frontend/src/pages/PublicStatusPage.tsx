import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { PublicStatusData } from '../types/status_page';
import UptimeBar90Days from '../components/status_page/UptimeBar90Days';
import StatusBadge from '../components/common/StatusBadge';
import PriorityBadge from '../components/common/PriorityBadge';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Loader2,
  Calendar,
  Clock,
  Mail,
  ExternalLink,
  Activity,
  CheckCircle2,
} from 'lucide-react';

export default function PublicStatusPage() {
  const { slug } = useParams<{ slug: string }>();

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
            {(error as any)?.response?.data?.message || 'La página de estado solicitada no existe o es privada.'}
          </p>
        </div>
      </div>
    );
  }

  const isOperational = statusData.system_status === 'operational';
  const isDegraded = statusData.system_status === 'degraded';

  return (
    <div className="min-h-screen bg-bg-dark text-text-main font-sans selection:bg-accent-green selection:text-black">
      {/* Header Banner */}
      <header className="border-b border-border-base bg-bg-card/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {statusData.logo_url ? (
              <img src={statusData.logo_url} alt={statusData.company_name} className="h-10 w-auto rounded object-contain" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-accent-green/10 border border-accent-green/30 flex items-center justify-center text-accent-green font-bold font-mono">
                <Activity size={22} />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-text-main">{statusData.company_name}</h1>
              <p className="text-xs text-text-muted">{statusData.description}</p>
            </div>
          </div>

          {statusData.support_email && (
            <a
              href={`mailto:${statusData.support_email}`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-dark border border-border-base rounded-lg text-xs font-mono text-text-muted hover:text-text-main transition-colors"
            >
              <Mail size={14} />
              Contacto de Soporte
            </a>
          )}
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Global Health Status Banner */}
        <div
          className={`p-6 rounded-2xl border flex items-center gap-4 shadow-xl transition-all ${
            isOperational
              ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
              : isDegraded
              ? 'bg-accent-yellow/10 border-accent-yellow/30 text-accent-yellow'
              : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
          }`}
        >
          {isOperational ? (
            <CheckCircle2 size={32} className="shrink-0" />
          ) : isDegraded ? (
            <AlertTriangle size={32} className="shrink-0" />
          ) : (
            <XCircle size={32} className="shrink-0" />
          )}

          <div>
            <h2 className="text-lg font-bold uppercase font-mono tracking-wide">{statusData.system_status_label}</h2>
            <p className="text-xs text-text-muted mt-0.5 font-mono">
              Última actualización: {new Date(statusData.updated_at).toLocaleString('es-ES')}
            </p>
          </div>
        </div>

        {/* Active Incidents Section */}
        {statusData.active_incidents && statusData.active_incidents.length > 0 && (
          <div className="bg-bg-card border border-accent-red/30 rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-accent-red mb-4 flex items-center gap-2 font-mono uppercase">
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
            <h3 className="text-base font-bold text-accent-yellow mb-4 flex items-center gap-2 font-mono uppercase">
              <Calendar size={18} />
              Mantenimientos Programados
            </h3>
            <div className="space-y-4">
              {statusData.maintenances.map((m) => (
                <div key={m.id} className="bg-bg-dark border border-border-base rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-text-main text-sm">{m.title}</h4>
                    <StatusBadge status={m.status === 'in_progress' ? 'investigating' : 'active'} label={m.status === 'in_progress' ? 'En Progreso' : 'Programado'} />
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

        {/* Monitored Services & 90-Day Uptime Bars */}
        <div className="bg-bg-card border border-border-base rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-border-base pb-4">
            <h3 className="text-base font-bold text-text-main flex items-center gap-2">
              <Activity size={20} className="text-accent-green" />
              Estado de Servicios y Disponibilidad de 90 Días
            </h3>
            <span className="text-xs font-mono text-text-dim">Actualización en tiempo real</span>
          </div>

          <div className="space-y-6 divide-y divide-border-base/40">
            {statusData.services.map((service) => (
              <div key={service.id} className="pt-6 first:pt-0 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-main text-sm">{service.name}</span>
                    <span className="text-[10px] font-mono uppercase bg-bg-dark border border-border-base px-2 py-0.5 rounded text-text-dim">
                      {service.type}
                    </span>
                  </div>
                  <StatusBadge status={service.current_status === 'up' ? 'pass' : 'fail'} label={service.current_status === 'up' ? 'Operacional' : 'Interrupción'} />
                </div>

                {/* 90-Day Uptime Bar Component */}
                <UptimeBar90Days history={service.history_90_days} overallPct={service.uptime_90_days_pct} />
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Public Footer */}
      <footer className="border-t border-border-base py-6 mt-12 bg-bg-dark text-center text-xs font-mono text-text-dim">
        <p>Plataforma de Observabilidad Sentinela &bull; Estado en tiempo real</p>
      </footer>
    </div>
  );
}
