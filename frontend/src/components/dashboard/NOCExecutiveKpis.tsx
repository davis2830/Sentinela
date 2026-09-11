import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Activity, Layers, AlertTriangle, ShieldCheck, ArrowUpRight, ArrowDownRight, ChevronRight } from 'lucide-react';

interface NOCExecutiveKpisProps {
  slaPercentage: number;
  avgLatencyMs: number;
  totalTargets: number;
  onlineTargets: number;
  degradedTargets: number;
  downTargets: number;
  activeIncidentsCount: number;
  criticalIncidentsCount: number;
  securityScore: number;
  securityVulnerabilitiesCount: number;
}

function NOCExecutiveKpis({
  slaPercentage,
  avgLatencyMs,
  totalTargets,
  onlineTargets,
  degradedTargets,
  downTargets,
  activeIncidentsCount,
  criticalIncidentsCount,
  securityScore,
  securityVulnerabilitiesCount,
}: NOCExecutiveKpisProps) {
  const navigate = useNavigate();

  // SVG mini sparkline path generator
  const renderSparkline = (color: string, pathData: string, id: string) => (
    <svg className="w-full h-6 overflow-visible" viewBox="0 0 100 20" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={`${pathData} L100,20 L0,20 Z`} fill={`url(#${id})`} />
      <path d={pathData} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  // Circular gauge calculations for Security KPI
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (securityScore / 100) * circumference;

  const safeTotal = Math.max(1, totalTargets);
  const onlineBarPct = Math.round((onlineTargets / safeTotal) * 100);
  const degradedBarPct = Math.round((degradedTargets / safeTotal) * 100);
  const downBarPct = Math.max(0, 100 - onlineBarPct - degradedBarPct);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
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
              {slaPercentage.toFixed(2)}%
            </span>
            <div className="flex items-center text-xs font-semibold text-accent-green shrink-0">
              <ArrowUpRight size={13} />
              <span>+0.02%</span>
            </div>
          </div>
          <span className="text-[11px] text-text-dim block">vs. periodo anterior</span>
        </div>

        <div className="mt-2 pt-1">
          {renderSparkline(
            '#10b981',
            'M0,16 Q15,12 25,6 T50,8 T75,4 T100,3',
            'sparkline-sla'
          )}
        </div>
      </div>

      {/* 2. Latencia Promedio */}
      <div className="relative bg-bg-card border border-border-base rounded-2xl p-4 sm:p-5 shadow-sm hover:border-border-accent transition-all flex flex-col justify-between overflow-hidden group">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-xl bg-accent-blue/10 text-accent-blue border border-accent-blue/20">
              <Activity size={16} />
            </div>
            <span className="text-xs font-semibold text-text-muted">Latencia Promedio</span>
          </div>

          <div className="flex items-baseline justify-between gap-1 mb-0.5">
            <span className="text-2xl lg:text-3xl font-bold font-mono text-text-main tracking-tight">
              {avgLatencyMs} <span className="text-sm font-normal text-text-dim">ms</span>
            </span>
            <div className="flex items-center text-xs font-semibold text-accent-green shrink-0">
              <ArrowDownRight size={13} />
              <span>-18ms</span>
            </div>
          </div>
          <span className="text-[11px] text-text-dim block">vs. última hora</span>
        </div>

        <div className="mt-2 pt-1">
          {renderSparkline(
            '#38bdf8',
            'M0,14 Q20,17 40,8 T70,13 T100,5',
            'sparkline-latency'
          )}
        </div>
      </div>

      {/* 3. Targets Totales (Rich & Filled) */}
      <div className="bg-bg-card border border-border-base rounded-2xl p-4 sm:p-5 shadow-sm hover:border-border-accent transition-all flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-accent-purple/10 text-accent-purple border border-accent-purple/20">
                <Layers size={16} />
              </div>
              <span className="text-xs font-semibold text-text-muted">Targets Totales</span>
            </div>
            <span className="text-[11px] font-mono text-accent-green bg-accent-green/10 border border-accent-green/20 px-2 py-0.5 rounded-full">
              {onlineTargets}/{safeTotal} activos
            </span>
          </div>

          <div className="text-2xl lg:text-3xl font-bold font-mono text-text-main tracking-tight mb-1.5">
            {totalTargets}
          </div>

          {/* Proportional Segmented Health Bar */}
          <div className="h-1.5 w-full bg-border-base/60 rounded-full overflow-hidden flex gap-0.5 my-2">
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
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border-base/50 text-xs">
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
        </div>
      </div>

      {/* 4. Incidentes Activos (Rich & Filled) */}
      <div className="bg-bg-card border border-border-base rounded-2xl p-4 sm:p-5 shadow-sm hover:border-border-accent transition-all flex flex-col justify-between">
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
                activeIncidentsCount > 0
                  ? 'bg-accent-red/10 text-accent-red border-accent-red/30 animate-pulse'
                  : 'bg-accent-green/10 text-accent-green border-accent-green/30'
              }`}
            >
              {activeIncidentsCount > 0 ? 'Requiere Atención' : 'SLA Óptimo'}
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-1 mb-0.5">
            <span
              className={`text-2xl lg:text-3xl font-bold font-mono tracking-tight ${
                activeIncidentsCount > 0 ? 'text-accent-red' : 'text-accent-green'
              }`}
            >
              {activeIncidentsCount}
            </span>
            <span className="text-[11px] text-text-dim">
              {criticalIncidentsCount > 0
                ? `${criticalIncidentsCount} críticos`
                : 'Sin incidentes críticos'}
            </span>
          </div>
        </div>

        {/* Dynamic Sparkline indicator for incident trends */}
        <div className="my-1.5">
          {renderSparkline(
            activeIncidentsCount > 0 ? '#ef4444' : '#10b981',
            activeIncidentsCount > 0
              ? 'M0,15 Q30,6 50,14 T80,5 T100,12'
              : 'M0,16 Q20,15 40,14 T70,15 T100,15',
            'sparkline-incidents'
          )}
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
            <div className="p-1.5 rounded-xl bg-accent-green/10 text-accent-green border border-accent-green/20">
              <ShieldCheck size={16} />
            </div>
            <span className="text-xs font-semibold text-text-muted">Estado de Seguridad</span>
          </div>
          <div className="text-2xl lg:text-3xl font-bold font-mono text-text-main mb-0.5">
            {securityScore}%
          </div>
          <p className="text-[11px] text-text-dim mb-1">Servicios protegidos</p>
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
              securityVulnerabilitiesCount === 0
                ? 'bg-accent-green/10 text-accent-green border-accent-green/30'
                : 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30'
            }`}
          >
            {securityVulnerabilitiesCount === 0
              ? 'Sin vulnerabilidades'
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
              stroke="#10b981"
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <ShieldCheck size={18} className="text-accent-green" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(NOCExecutiveKpis);
