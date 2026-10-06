import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Clock3, Pause, Radio, RefreshCw } from 'lucide-react';
import { formatTime } from '../../utils/date';
import type { FreshnessState } from '../../utils/dashboardFreshness';

interface Props {
  onRefreshAll: () => void;
  isRefreshing: boolean;
  activeAlertsCount: number;
  timeRange: '1h' | '6h' | '24h' | '7d';
  onTimeRangeChange: (range: Props['timeRange']) => void;
  hasTelemetryError: boolean;
  lastSampleAt: string | null;
  freshnessState: FreshnessState;
  autoRefresh: { enabled: boolean; countdown: number; toggle: () => void };
}

function NOCDashboardHeader({ onRefreshAll, isRefreshing, activeAlertsCount, timeRange, onTimeRangeChange, hasTelemetryError, lastSampleAt, freshnessState, autoRefresh }: Props) {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(() => formatTime(new Date()));
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(formatTime(new Date())), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const labels: Record<FreshnessState, string> = { current: 'Al día', stale: 'Dato atrasado', pending: 'Sin checks', paused: 'Pausado', error: 'Error de carga' };
  const status = hasTelemetryError ? 'Error parcial' : labels[freshnessState];
  const statusColor = hasTelemetryError || freshnessState === 'error' ? 'text-accent-red' : freshnessState === 'stale' ? 'text-accent-yellow' : freshnessState === 'current' ? 'text-accent-green' : 'text-text-muted';

  return <header className="flex flex-col gap-3 border-b border-border-base/60 pb-3 lg:flex-row lg:items-center lg:justify-between" data-testid="dashboard-header">
    <div className="min-w-0">
      <h1 className="text-xl font-semibold text-text-main">Centro de Conectividad</h1>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
        <span role="status" className={`flex items-center gap-1.5 ${statusColor}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>
        <span title={lastSampleAt ? new Date(lastSampleAt).toLocaleString('es-GT') : undefined}>{lastSampleAt ? `Última señal ${new Date(lastSampleAt).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}` : 'Esperando primera señal'}</span>
        <span className="hidden items-center gap-1.5 xl:inline-flex"><Clock3 size={11} />{currentTime}</span>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-border-base bg-bg-card/60 p-0.5" aria-label="Período de telemetría">
        {(['1h', '6h', '24h', '7d'] as const).map((range) => <button key={range} type="button" aria-pressed={timeRange === range} onClick={() => onTimeRangeChange(range)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${timeRange === range ? 'bg-accent-green/15 text-accent-green' : 'text-text-muted hover:text-text-main'}`}>{range}</button>)}
      </div>
      <button type="button" onClick={autoRefresh.toggle} aria-label={autoRefresh.enabled ? 'Pausar auto-refresco' : 'Activar auto-refresco'} aria-pressed={autoRefresh.enabled} title={autoRefresh.enabled ? 'Pausar auto-refresco' : 'Activar auto-refresco'} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] ${autoRefresh.enabled ? 'text-accent-green' : 'text-text-muted'}`}>
        {autoRefresh.enabled ? <Radio size={13} /> : <Pause size={13} />}{autoRefresh.enabled ? `${autoRefresh.countdown}s` : 'Pausado'}
      </button>
      <button type="button" onClick={onRefreshAll} disabled={isRefreshing} aria-label="Actualizar datos" title="Consultar resultados guardados sin ejecutar nuevos sondeos" className="inline-flex items-center gap-2 rounded-lg border border-border-base px-3 py-2 text-xs text-text-muted hover:border-border-accent hover:text-text-main disabled:opacity-50"><RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} /><span className="hidden sm:inline">Actualizar</span></button>
      <button type="button" onClick={() => navigate('/alerts')} aria-label={`Ver alertas (${activeAlertsCount})`} className="relative rounded-lg p-2 text-text-muted hover:bg-bg-card hover:text-text-main"><Bell size={16} />{activeAlertsCount > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-accent-red px-1 text-[9px] text-white">{activeAlertsCount}</span>}</button>
    </div>
  </header>;
}

export default React.memo(NOCDashboardHeader);
