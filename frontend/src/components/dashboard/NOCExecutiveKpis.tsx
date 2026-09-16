import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Activity, Layers, AlertTriangle, ShieldCheck, ChevronRight } from 'lucide-react';

interface NOCExecutiveKpisProps {
  slaPercentage: number | null;
  avgLatencyMs: number | null;
  totalTargets: number;
  onlineTargets: number;
  degradedTargets: number;
  downTargets: number;
  unknownTargets: number;
  activeIncidentsCount: number | null;
  criticalIncidentsCount: number | null;
  securityScore: number | null;
  securityVulnerabilitiesCount: number;
  telemetryPoints?: { uptime: number | null; latency: number | null }[];
  targetsAvailable: boolean;
  targetsLoading: boolean;
}

function NOCExecutiveKpis({
  slaPercentage,
  avgLatencyMs,
  totalTargets,
  onlineTargets,
  degradedTargets,
  downTargets,
  unknownTargets,
  activeIncidentsCount,
  criticalIncidentsCount,
  securityScore,
  securityVulnerabilitiesCount,
  telemetryPoints = [],
  targetsAvailable,
  targetsLoading,
}: NOCExecutiveKpisProps) {
  const navigate = useNavigate();

  const renderSparkline = (values: (number | null)[], color: string, label: string) => {
    const measured = values.filter((value): value is number => value !== null);
    if (measured.length < 2) return <span className="text-[10px] text-text-dim">Sin tendencia disponible</span>;
    const min = Math.min(...measured);
    const span = Math.max(1, Math.max(...measured) - min);
    let drawing = false;
    const path = values.map((value, index) => {
      if (value === null) { drawing = false; return ''; }
      const point = `${(index * 100 / Math.max(1, values.length - 1)).toFixed(1)},${(17 - (value - min) * 14 / span).toFixed(1)}`;
      const command = `${drawing ? 'L' : 'M'}${point}`;
      drawing = true;
      return command;
    }).join(' ');
    return <svg className="w-full h-6" viewBox="0 0 100 20" preserveAspectRatio="none" role="img" aria-label={label}><path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  };

  // Circular gauge calculations for Security KPI
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - ((securityScore ?? 0) / 100) * circumference;

  const safeTotal = Math.max(1, totalTargets);
  const onlineBarPct = Math.round((onlineTargets / safeTotal) * 100);
  const degradedBarPct = Math.round((degradedTargets / safeTotal) * 100);
  const downBarPct = Math.round((downTargets / safeTotal) * 100);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5">
      {/* 1. Disponibilidad Global (SLA) */}
      <div className="relative bg-bg-card border border-border-base rounded-2xl p-4 sm:p-5 shadow-sm hover:border-border-accent transition-all flex flex-col justify-between overflow-hidden group">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-xl bg-accent-green/10 text-accent-green border border-accent-green/20">
              <Shield size={16} />
            </div>
            <span className="text-xs font-semibold text-text-muted">Disponibilidad (SLA)</span>
          </div>

          <div className="flex items-baseline justify-between gap-1 mb-0.5">
            <span className="text-2xl lg:text-3xl font-bold font-mono text-text-main tracking-tight">
              {slaPercentage === null ? 'Sin datos' : `${slaPercentage.toFixed(2)}%`}
            </span>
          </div>
          <span className="text-[11px] text-text-dim block">Histórico</span>
        </div>
        <div className="mt-2">{renderSparkline(telemetryPoints.map((point) => point.uptime), '#10b981', 'Tendencia de disponibilidad')}</div>
      </div>

      {/* 2. Latencia Promedio */}
      <div className="relative bg-bg-card border border-border-base rounded-2xl p-4 sm:p-5 shadow-sm hover:border-border-accent transition-all flex flex-col justify-between overflow-hidden group">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-xl bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20">
              <Activity size={16} />
            </div>
            <span className="text-xs font-semibold text-text-muted">Latencia Promedio</span>
          </div>

          <div className="flex items-baseline justify-between gap-1 mb-0.5">
            <span className="text-2xl lg:text-3xl font-bold font-mono text-text-main tracking-tight">
              {avgLatencyMs === null ? 'Sin datos' : <>{avgLatencyMs} <span className="text-sm font-normal text-text-dim">ms</span></>}
            </span>
          </div>
          <span className="text-[11px] text-text-dim block">Histórico</span>
        </div>
        <div className="mt-2">{renderSparkline(telemetryPoints.map((point) => point.latency), '#06b6d4', 'Tendencia de latencia')}</div>
      </div>

      {/* 3. Targets Totales (Rich & Filled) */}
      <div className={`bg-bg-card border rounded-2xl p-4 sm:p-5 shadow-sm transition-all flex flex-col justify-between ${targetsAvailable && downTargets > 0 ? 'border-accent-red/50 shadow-accent-red/10' : targetsAvailable && degradedTargets > 0 ? 'border-accent-yellow/40' : 'border-border-base hover:border-border-accent'}`}>
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-accent-purple/10 text-accent-purple border border-accent-purple/20">
                <Layers size={16} />
              </div>
              <span className="text-xs font-semibold text-text-muted">Targets Totales</span>
            </div>
            <span className={`text-[11px] font-mono border px-2 py-0.5 rounded-full ${targetsAvailable ? 'text-accent-green bg-accent-green/10 border-accent-green/20' : 'text-text-dim bg-bg-dark border-border-base'}`}>
              {targetsAvailable ? `${onlineTargets}/${totalTargets} online` : targetsLoading ? 'Cargando' : 'Dato no disponible'}
            </span>
          </div>

          <div className="text-2xl lg:text-3xl font-bold font-mono text-text-main tracking-tight mb-1.5">
            {targetsAvailable ? totalTargets : '—'}
          </div>

          {/* Proportional Segmented Health Bar */}
          <div className="h-1.5 w-full bg-border-base/60 rounded-full overflow-hidden flex gap-0.5 my-2" aria-hidden={!targetsAvailable}>
            {targetsAvailable && <>
            <div
              style={{ width: `${onlineBarPct}%` }}
              className="bg-accent-green h-full transition-all duration-700"
              title={`Online: ${onlineTargets}`}
            />
            {degradedTargets > 0 && (
              <div
                style={{ width: `${degradedBarPct}%` }}
                className="bg-accent-yellow h-full transition-all duration-700"
                title={`Degradados: ${degradedTargets}`}
              />
            )}
            {downTargets > 0 && (
              <div
                style={{ width: `${downBarPct}%` }}
                className="bg-accent-red h-full transition-all duration-700"
                title={`Caídos: ${downTargets}`}
              />
            )}
            </>}
          </div>
          <span className="text-[11px] text-text-dim">Estado actual</span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border-base/50 text-xs">
          {!targetsAvailable ? <span className="text-text-dim">{targetsLoading ? 'Cargando estado actual' : 'No se pudo cargar el estado actual'}</span> : <>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent-green shadow-xs shadow-accent-green/50" />
            <span className="font-mono font-bold text-text-main">{onlineTargets}</span>
            <span className="text-[11px] text-text-dim">Up</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent-yellow shadow-xs shadow-accent-yellow/50" />
            <span className="font-mono font-bold text-text-main">{degradedTargets}</span>
            <span className="text-[11px] text-text-dim">Deg</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent-red shadow-xs shadow-accent-red/50" />
            <span className="font-mono font-bold text-text-main">{downTargets}</span>
            <span className="text-[11px] text-text-dim">Down</span>
          </div>
          {unknownTargets > 0 && <span className="text-[11px] text-text-dim font-mono" title="Sin check o pausados">{unknownTargets} sin datos</span>}
          </>}
        </div>
      </div>

      {/* 4. Incidentes Activos (Rich & Filled) */}
      <div className={`bg-bg-card border rounded-2xl p-4 sm:p-5 shadow-sm transition-all flex flex-col justify-between ${activeIncidentsCount !== null && activeIncidentsCount > 0 ? 'border-accent-red/50 shadow-accent-red/10' : 'border-border-base hover:border-border-accent'}`}>
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-accent-red/10 text-accent-red border border-accent-red/20">
                <AlertTriangle size={16} />
              </div>
              <span className="text-xs font-semibold text-text-muted">Incidentes Activos</span>
            </div>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                activeIncidentsCount === null
                  ? 'bg-bg-dark text-text-dim border-border-base'
                  : activeIncidentsCount > 0
                  ? 'bg-accent-red/10 text-accent-red border-accent-red/30 animate-pulse'
                  : 'bg-accent-green/10 text-accent-green border-accent-green/30'
              }`}
            >
              {activeIncidentsCount === null ? 'Sin datos' : activeIncidentsCount > 0 ? 'Requiere atención' : 'Sin incidentes activos'}
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-1 mb-0.5">
            <span
              className={`text-2xl lg:text-3xl font-bold font-mono tracking-tight ${
                activeIncidentsCount === null ? 'text-text-dim' : activeIncidentsCount > 0 ? 'text-accent-red' : 'text-accent-green'
              }`}
            >
              {activeIncidentsCount ?? '—'}
            </span>
            <span className="text-[11px] text-text-dim">
              {criticalIncidentsCount === null
                ? 'Estado no disponible'
                : criticalIncidentsCount > 0
                ? `${criticalIncidentsCount} críticos`
                : 'Sin incidentes críticos'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/incidents')}
          className="pt-2 border-t border-border-base/50 flex items-center justify-between text-xs text-text-muted hover:text-accent-red transition-colors group cursor-pointer"
        >
          <span>Ver incidentes</span>
          <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* 5. Estado de Seguridad (Radial Donut Gauge) */}
      <div className="bg-bg-card border border-border-base rounded-2xl p-4 sm:p-5 shadow-sm hover:border-border-accent transition-all flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-xl border ${securityScore === null ? 'bg-bg-dark text-text-dim border-border-base' : securityScore < 70 ? 'bg-accent-red/10 text-accent-red border-accent-red/20' : 'bg-accent-green/10 text-accent-green border-accent-green/20'}`}>
              <ShieldCheck size={16} />
            </div>
            <span className="text-xs font-semibold text-text-muted">Estado de Seguridad</span>
          </div>
          <div className="text-2xl lg:text-3xl font-bold font-mono text-text-main mb-0.5">
            {securityScore === null ? 'Sin datos' : `${securityScore}%`}
          </div>
          <span className="text-[11px] text-text-dim">Estado actual</span>
          <p className="text-[11px] text-text-dim mb-1">Certificados y cabeceras evaluados</p>
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
              securityScore === null
                ? 'bg-bg-dark text-text-dim border-border-base'
                : securityVulnerabilitiesCount === 0
                ? 'bg-accent-green/10 text-accent-green border-accent-green/30'
                : 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30'
            }`}
          >
            {securityScore === null
              ? 'Sin evaluaciones'
              : securityVulnerabilitiesCount === 0
              ? 'Sin observaciones detectadas'
              : `${securityVulnerabilitiesCount} observaciones`}
          </span>
        </div>

        {/* Circular Donut Gauge SVG */}
        <div className="relative shrink-0 flex items-center justify-center">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 64 64">
            <circle
              cx="32"
              cy="32"
              r={radius}
              stroke="#1e293b"
              strokeWidth="6"
              fill="transparent"
            />
            <circle
              cx="32"
              cy="32"
              r={radius}
              stroke={securityScore === null ? '#64748b' : securityScore < 70 ? '#ef4444' : '#10b981'}
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <ShieldCheck size={18} className={securityScore === null ? 'text-text-dim' : securityScore < 70 ? 'text-accent-red' : 'text-accent-green'} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(NOCExecutiveKpis);
