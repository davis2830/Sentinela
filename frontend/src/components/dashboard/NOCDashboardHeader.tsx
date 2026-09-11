import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Clock, RefreshCw, Calendar, Bell, ChevronDown } from 'lucide-react';

import { formatTime } from '../../utils/date';

interface NOCDashboardHeaderProps {
  onRefreshAll: () => void;
  isRefreshing: boolean;
  activeAlertsCount: number;
  timeRange: '1h' | '6h' | '24h' | '7d';
  onTimeRangeChange: (range: '1h' | '6h' | '24h' | '7d') => void;
}

function NOCDashboardHeader({
  onRefreshAll,
  isRefreshing,
  activeAlertsCount,
  timeRange,
  onTimeRangeChange,
}: NOCDashboardHeaderProps) {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState<string>(() => formatTime(new Date()));
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(formatTime(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeRangeLabels: Record<'1h' | '6h' | '24h' | '7d', string> = {
    '1h': 'Última hora',
    '6h': 'Últimas 6 horas',
    '24h': 'Últimas 24 horas',
    '7d': 'Últimos 7 días',
  };

  return (
    <header className="relative w-full rounded-2xl bg-gradient-to-r from-bg-card via-bg-card-hover/80 to-bg-card border border-border-base p-5 md:p-6 shadow-xl mb-6 z-20">
      {/* Background Holographic Network Map Texture */}
      <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden rounded-2xl">
        <svg
          className="absolute right-0 top-0 h-full w-2/3 text-accent-green"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 800 300"
          fill="none"
        >
          <circle cx="150" cy="80" r="3" fill="currentColor" opacity="0.6" />
          <circle cx="280" cy="50" r="4" fill="currentColor" opacity="0.8" />
          <circle cx="340" cy="120" r="3" fill="currentColor" opacity="0.7" />
          <circle cx="480" cy="90" r="5" fill="currentColor" opacity="0.9" />
          <circle cx="560" cy="140" r="3" fill="currentColor" opacity="0.6" />
          <circle cx="680" cy="80" r="4" fill="currentColor" opacity="0.8" />
          <circle cx="730" cy="160" r="3" fill="currentColor" opacity="0.5" />
          <circle cx="240" cy="190" r="4" fill="currentColor" opacity="0.7" />
          <circle cx="420" cy="220" r="4" fill="currentColor" opacity="0.6" />
          <circle cx="620" cy="210" r="5" fill="currentColor" opacity="0.8" />
          {/* Interconnecting telemetry arcs */}
          <path
            d="M150,80 Q215,65 280,50 T480,90 T680,80"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.3"
          />
          <path
            d="M280,50 Q310,85 340,120 T480,90 T560,140"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.35"
          />
          <path
            d="M340,120 Q380,170 420,220 T620,210 T730,160"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="5 5"
            opacity="0.25"
          />
          <path
            d="M240,190 Q330,205 420,220 T560,140"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.2"
          />
        </svg>
      </div>

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Title and Subtitle */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-accent-green/10 border border-accent-green/30 text-accent-green shadow-sm shadow-accent-green/20">
              <Activity size={22} className="animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-text-main">
              Centro de Operaciones
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-accent-green/15 text-accent-green border border-accent-green/40 shadow-sm">
              Observabilidad
            </span>
          </div>
          <p className="text-xs text-text-muted max-w-xl">
            Vista general del estado de tu infraestructura, servicios y seguridad en tiempo real.
          </p>
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
          {/* Live Digital Clock */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-dark/80 border border-border-base text-xs shadow-inner">
            <Clock size={14} className="text-accent-green" />
            <span className="text-[11px] text-text-dim">Hora NOC</span>
            <span className="font-mono font-bold text-text-main tracking-wider">{currentTime}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent-green/15 text-accent-green border border-accent-green/30 font-semibold">
              GTM
            </span>
          </div>

          {/* Telemetría en Vivo Button */}
          <button
            type="button"
            onClick={onRefreshAll}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-accent-green/15 hover:bg-accent-green/25 border border-accent-green/40 text-accent-green text-xs font-semibold tracking-wide transition-all shadow-sm shadow-accent-green/10 cursor-pointer disabled:opacity-50"
            title="Forzar refresco manual de telemetría"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green"></span>
            </span>
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Telemetría en vivo</span>
          </button>

          {/* Time Range Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-bg-dark/80 hover:bg-bg-dark border border-border-base hover:border-border-accent text-xs font-medium text-text-main transition-all cursor-pointer shadow-sm"
            >
              <Calendar size={13} className="text-accent-green" />
              <span className="font-semibold">{timeRangeLabels[timeRange] || 'Últimas 24 horas'}</span>
              <ChevronDown size={13} className={`text-text-dim transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-bg-card border border-border-base shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3.5 py-1 text-[10px] font-semibold tracking-wider uppercase text-text-dim border-b border-border-base/50 mb-1">
                    Ventana de Telemetría
                  </div>
                  {(['1h', '6h', '24h', '7d'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        onTimeRangeChange(r);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                        timeRange === r
                          ? 'bg-accent-green/10 text-accent-green font-semibold'
                          : 'text-text-muted hover:text-text-main hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${timeRange === r ? 'bg-accent-green' : 'bg-transparent'}`} />
                        <span>{timeRangeLabels[r]}</span>
                      </div>
                      <span className="font-mono text-[10px] text-text-dim uppercase">{r}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Active Alerts Bell */}
          <button
            type="button"
            onClick={() => navigate('/alerts')}
            className="relative p-2.5 rounded-xl bg-bg-dark/80 hover:bg-bg-dark border border-border-base hover:border-border-accent text-text-muted hover:text-text-main transition-all cursor-pointer shadow-sm"
            title="Ver Centro de Alertas"
          >
            <Bell size={16} />
            {activeAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-accent-red text-white text-[10px] font-extrabold border-2 border-bg-card animate-pulse">
                {activeAlertsCount > 9 ? '9+' : activeAlertsCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

export default React.memo(NOCDashboardHeader);
