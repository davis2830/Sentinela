import React from 'react';
import type { DowntimeIncident } from '../../types/monitoring';
import { ShieldCheck, AlertTriangle, Clock, ArrowRight, XCircle } from 'lucide-react';

interface DowntimeIncidentsLogProps {
  incidents: DowntimeIncident[];
  period: '24h' | '7d' | '30d';
}

export default function DowntimeIncidentsLog({
  incidents,
  period,
}: DowntimeIncidentsLogProps) {
  const periodLabel =
    period === '24h' ? 'últimas 24 horas' : period === '7d' ? 'últimos 7 días' : 'últimos 30 días';

  return (
    <div className="bg-bg-card border border-border-base rounded-xl p-6 mb-6 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4 border-b border-border-base/50 pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              incidents.length > 0
                ? 'bg-accent-red/10 text-accent-red border border-accent-red/30'
                : 'bg-accent-green/10 text-accent-green border border-accent-green/30'
            }`}
          >
            {incidents.length > 0 ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
          </div>
          <div>
            <h3 className="font-bold text-sm text-text-main">
              Bitácora de Caídas e Interrupciones ({periodLabel})
            </h3>
            <p className="text-[11px] text-text-dim">
              Historial detallado de cortes, fallos de conexión y tiempos de recuperación
            </p>
          </div>
        </div>

        <span
          className={`text-xs px-2.5 py-1 rounded-full font-mono font-bold ${
            incidents.length > 0
              ? 'bg-accent-red/10 text-accent-red border border-accent-red/30'
              : 'bg-accent-green/10 text-accent-green border border-accent-green/30'
          }`}
        >
          {incidents.length} {incidents.length === 1 ? 'caída registrada' : 'caídas registradas'}
        </span>
      </div>

      {/* Incidents List */}
      {incidents.length > 0 ? (
        <div className="space-y-3">
          {incidents.map((incident, idx) => {
            const startDate = new Date(incident.started_at);
            const endDate = new Date(incident.resolved_at);

            return (
              <div
                key={incident.id || idx}
                className="p-4 bg-bg-dark border border-border-base hover:border-accent-red/50 rounded-xl transition-all shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 text-xs text-text-main font-semibold">
                    <span className="w-2 h-2 rounded-full bg-accent-red animate-pulse" />
                    <span>Interrupción #{idx + 1}</span>
                    <span className="text-text-dim">&bull;</span>
                    <span className="font-mono text-accent-red font-bold">
                      {incident.duration_formatted}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-mono text-text-muted">
                    <span>
                      {startDate.toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                      })}{' '}
                      {startDate.toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                    <ArrowRight size={12} className="text-text-dim" />
                    <span>
                      {endDate.toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="bg-bg-card/70 border border-border-base/50 rounded-lg p-2.5 mt-2 flex items-start gap-2.5 text-xs font-mono text-text-muted">
                  <XCircle size={15} className="text-accent-red shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-text-main font-semibold break-all">
                      {incident.error_message}
                    </div>
                    <div className="text-[11px] text-text-dim mt-0.5">
                      {incident.checks_failed} chequeos consecutivos fallidos &bull; Recuperado automáticamente al responder exitosamente
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-8 text-center bg-bg-dark border border-border-base/50 rounded-xl flex flex-col items-center justify-center p-4">
          <div className="w-12 h-12 rounded-2xl bg-accent-green/10 border border-accent-green/30 flex items-center justify-center text-accent-green mb-3">
            <ShieldCheck size={24} />
          </div>
          <p className="text-sm font-bold text-text-main">
            Sin caídas registradas en las {periodLabel}
          </p>
          <p className="text-xs text-text-dim font-mono mt-1 max-w-sm">
            Todos los escaneos periódicos respondieron dentro de los parámetros esperados de disponibilidad.
          </p>
        </div>
      )}
    </div>
  );
}
