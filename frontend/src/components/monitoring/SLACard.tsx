import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { UptimeStats } from '../../types/monitoring';
import { ShieldCheck, Clock, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

interface SLACardProps {
  targetId: string;
}

export default function SLACard({ targetId }: SLACardProps) {
  const [hours, setHours] = useState<number>(24);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['target-uptime-sla', targetId, hours],
    queryFn: async () => {
      const res = await api.get(`monitoring/${targetId}/uptime/`, {
        params: { hours },
      });
      return res.data?.data as UptimeStats;
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="bg-bg-card border border-border-base rounded-xl p-6 mb-6 flex items-center justify-center py-10">
        <RefreshCw className="animate-spin text-accent-green" size={24} />
      </div>
    );
  }

  const uptimePct = stats?.uptime_percentage !== undefined ? stats.uptime_percentage : 100;
  const totalChecks = stats?.total_checks || 0;
  const upChecks = stats?.up_checks || 0;
  const downChecks = totalChecks - upChecks;

  const isCompliant = uptimePct >= 99.0;

  return (
    <div className="bg-bg-card border border-border-base rounded-xl p-6 mb-6 shadow-xl">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-border-base pb-4">
        <div className="flex items-center gap-2 font-bold text-text-main text-base">
          <ShieldCheck size={20} className="text-accent-blue" />
          Nivel de Servicio (SLA) & Disponibilidad
        </div>

        {/* Time Selector */}
        <div className="flex items-center gap-1 bg-bg-dark border border-border-base rounded-lg p-1 font-mono text-xs">
          <button
            onClick={() => setHours(24)}
            className={`px-3 py-1 rounded transition-colors ${
              hours === 24 ? 'bg-accent-green text-black font-bold' : 'text-text-muted hover:text-text-main'
            }`}
          >
            24 Horas
          </button>
          <button
            onClick={() => setHours(168)}
            className={`px-3 py-1 rounded transition-colors ${
              hours === 168 ? 'bg-accent-green text-black font-bold' : 'text-text-muted hover:text-text-main'
            }`}
          >
            7 Días
          </button>
          <button
            onClick={() => setHours(720)}
            className={`px-3 py-1 rounded transition-colors ${
              hours === 720 ? 'bg-accent-green text-black font-bold' : 'text-text-muted hover:text-text-main'
            }`}
          >
            30 Días
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* % Uptime */}
        <div className="p-4 bg-bg-dark border border-border-base rounded-xl">
          <span className="text-[11px] text-text-muted font-mono uppercase tracking-wide">
            % Disponibilidad SLA
          </span>
          <div
            className={`text-2xl font-bold font-mono mt-1 ${
              uptimePct >= 99 ? 'text-accent-green' : uptimePct >= 95 ? 'text-accent-yellow' : 'text-accent-red'
            }`}
          >
            {uptimePct.toFixed(2)}%
          </div>
          <div className="text-[10px] text-text-dim mt-1 font-mono">
            {isCompliant ? 'Cumple meta SLA (≥99%)' : 'Desviación de SLA'}
          </div>
        </div>

        {/* Total Checks */}
        <div className="p-4 bg-bg-dark border border-border-base rounded-xl">
          <span className="text-[11px] text-text-muted font-mono uppercase tracking-wide flex items-center gap-1">
            <Clock size={12} /> Total Chequeos
          </span>
          <div className="text-2xl font-bold font-mono mt-1 text-text-main">{totalChecks}</div>
          <div className="text-[10px] text-text-dim mt-1 font-mono">Últimas {hours} horas</div>
        </div>

        {/* Up Checks */}
        <div className="p-4 bg-bg-dark border border-border-base rounded-xl">
          <span className="text-[11px] text-text-muted font-mono uppercase tracking-wide flex items-center gap-1">
            <CheckCircle2 size={12} className="text-accent-green" /> Chequeos Exitosos
          </span>
          <div className="text-2xl font-bold font-mono mt-1 text-accent-green">{upChecks}</div>
          <div className="text-[10px] text-text-dim mt-1 font-mono">Sin interrupciones</div>
        </div>

        {/* Down Checks */}
        <div className="p-4 bg-bg-dark border border-border-base rounded-xl">
          <span className="text-[11px] text-text-muted font-mono uppercase tracking-wide flex items-center gap-1">
            <XCircle size={12} className="text-accent-red" /> Caídas / Interrupciones
          </span>
          <div className={`text-2xl font-bold font-mono mt-1 ${downChecks > 0 ? 'text-accent-red' : 'text-accent-green'}`}>
            {downChecks}
          </div>
          <div className="text-[10px] text-text-dim mt-1 font-mono">
            {downChecks === 0 ? '0 caídas detectadas' : `${downChecks} eventos de falla`}
          </div>
        </div>
      </div>
    </div>
  );
}
