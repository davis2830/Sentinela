import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import {
  X,
  RefreshCw,
  Download,
  Bell,
  Pencil,
  Globe,
  Server,
  Plug,
  Lock,
  Activity,
  ShieldCheck,
  Settings,
  List,
} from 'lucide-react';
import type { MonitoringTarget, TimeseriesData, TimeseriesSummary } from '../../types/monitoring';
import LatencyChart from './LatencyChart';
import SLACard from './SLACard';
import UptimeAvailabilityBar from './UptimeAvailabilityBar';
import DowntimeIncidentsLog from './DowntimeIncidentsLog';
import ChecksList from './ChecksList';

const defaultSummary: TimeseriesSummary = {
  uptime_percentage: 100,
  total_checks: 0,
  up_checks: 0,
  down_checks: 0,
  avg_latency: 0,
  p50_latency: 0,
  p90_latency: 0,
  p99_latency: 0,
  max_latency: 0,
  min_latency: 0,
  total_downtime_seconds: 0,
  incidents_count: 0,
};

const typeIcons: Record<string, typeof Globe> = {
  http: Globe,
  https: Globe,
  tcp: Server,
  dns: Globe,
  api: Plug,
  ssl: Lock,
};

interface TargetDetailDrawerProps {
  target: MonitoringTarget;
  onClose: () => void;
  onScan: (target: MonitoringTarget) => void;
  onEdit: (target: MonitoringTarget) => void;
  onAlert: (target: MonitoringTarget) => void;
  onExport: (targetId: string, targetName: string) => void;
  isScanning: boolean;
}

export default function TargetDetailDrawer({
  target,
  onClose,
  onScan,
  onEdit,
  onAlert,
  onExport,
  isScanning,
}: TargetDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'metrics' | 'history' | 'config'>('metrics');
  const [selectedPeriod, setSelectedPeriod] = useState<'24h' | '7d' | '30d'>('24h');

  // Unified Timeseries & Incidents Query
  const { data: tsData, isLoading: isLoadingTimeseries } = useQuery({
    queryKey: ['target-timeseries', target.id, selectedPeriod],
    queryFn: async () => {
      const res = await api.get(`monitoring/${target.id}/timeseries/`, {
        params: { period: selectedPeriod },
      });
      return res.data?.data as TimeseriesData;
    },
    refetchInterval: 30000,
  });

  const summary = tsData?.summary || defaultSummary;
  const Icon = typeIcons[target.target_type] || Globe;
  const status = target.last_status || 'unknown';

  const getStatusBadge = () => {
    if (!target.enabled) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
          <span className="w-2 h-2 rounded-full bg-zinc-500" />
          Pausado
        </span>
      );
    }
    if (status === 'up') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Operacional
        </span>
      );
    }
    if (status === 'slow') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          Degradado / Lento
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
        </span>
        Interrupción (Caído)
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-bg-card border-l border-border-base h-full overflow-y-auto flex flex-col shadow-2xl animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="sticky top-0 bg-bg-card/95 backdrop-blur border-b border-border-base px-6 py-4 z-10 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-accent-green/10 border border-accent-green/30 flex items-center justify-center shrink-0">
              <Icon className="text-accent-green" size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-text-main truncate" title={target.name}>
                  {target.name}
                </h2>
                {getStatusBadge()}
              </div>
              <p className="text-xs text-text-dim font-mono truncate max-w-sm">{target.endpoint}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-main hover:bg-bg-dark rounded-lg transition-colors"
            title="Cerrar panel"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-6 py-3 bg-bg-dark/50 border-b border-border-base flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onScan(target)}
              disabled={isScanning}
              className="flex items-center gap-1.5 bg-accent-green/10 border border-accent-green text-accent-green font-semibold px-3 py-1.5 rounded-lg text-xs hover:bg-accent-green/20 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={isScanning ? 'animate-spin' : ''} />
              Escanear Ahora
            </button>
            <button
              onClick={() => onExport(target.id, target.name)}
              className="flex items-center gap-1.5 bg-bg-card border border-border-base text-text-muted hover:text-text-main px-3 py-1.5 rounded-lg text-xs transition-colors"
            >
              <Download size={13} />
              Exportar CSV
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onAlert(target)}
              className="flex items-center gap-1.5 bg-accent-yellow/10 border border-accent-yellow/30 text-accent-yellow px-3 py-1.5 rounded-lg text-xs hover:bg-accent-yellow/20 transition-colors"
            >
              <Bell size={13} />
              Alerta
            </button>
            <button
              onClick={() => onEdit(target)}
              className="flex items-center gap-1.5 bg-accent-blue/10 border border-accent-blue/30 text-accent-blue px-3 py-1.5 rounded-lg text-xs hover:bg-accent-blue/20 transition-colors"
            >
              <Pencil size={13} />
              Editar
            </button>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 border-b border-border-base bg-bg-dark/20">
          <div className="bg-bg-card border border-border-base rounded-xl p-3">
            <div className="text-[11px] font-medium text-text-muted">Protocolo</div>
            <div className="text-base font-bold text-text-main mt-1">{target.target_type.toUpperCase()}</div>
          </div>
          <div className="bg-bg-card border border-border-base rounded-xl p-3">
            <div className="text-[11px] font-medium text-text-muted">Frecuencia</div>
            <div className="text-base font-bold font-mono text-text-main mt-1">cada {target.interval}s</div>
          </div>
          <div className="bg-bg-card border border-border-base rounded-xl p-3">
            <div className="text-[11px] font-medium text-text-muted">Latencia Actual</div>
            <div className="text-base font-bold font-mono text-accent-green mt-1">
              {target.last_latency !== null ? `${target.last_latency.toFixed(0)}ms` : '-'}
            </div>
          </div>
          <div className="bg-bg-card border border-border-base rounded-xl p-3">
            <div className="text-[11px] font-medium text-text-muted">Último Check</div>
            <div className="text-xs font-mono text-text-muted mt-1.5 truncate">
              {target.last_checked_at
                ? new Date(target.last_checked_at).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                : 'Pendiente'}
            </div>
          </div>
        </div>

        {/* Drawer Tabs */}
        <div className="flex border-b border-border-base px-6 bg-bg-dark/40">
          <button
            onClick={() => setActiveTab('metrics')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'metrics'
                ? 'border-accent-green text-accent-green bg-accent-green/5'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <Activity size={14} />
            Métricas & SLA
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-accent-green text-accent-green bg-accent-green/5'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <List size={14} />
            Historial de Checks
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'config'
                ? 'border-accent-green text-accent-green bg-accent-green/5'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <Settings size={14} />
            Configuración
          </button>
        </div>

        {/* Drawer Body Content */}
        <div className="p-6 flex-1 space-y-6">
          {activeTab === 'metrics' && (
            <>
              {/* 1. SLA Availability Card with Period Selector */}
              <SLACard
                period={selectedPeriod}
                onPeriodChange={setSelectedPeriod}
                summary={summary}
                targetInterval={target.interval}
              />

              {/* 2. 30-Day Daily Availability Heatmap Bar */}
              <UptimeAvailabilityBar
                days={tsData?.daily_availability || []}
                uptimePercentage={summary.uptime_percentage}
              />

              {/* 3. Recharts Continuous Latency Curve */}
              <LatencyChart
                timeseries={tsData?.timeseries || []}
                summary={summary}
                period={selectedPeriod}
                isLoading={isLoadingTimeseries}
              />

              {/* 4. Exact Downtime Incidents Log */}
              <DowntimeIncidentsLog
                incidents={tsData?.incidents || []}
                period={selectedPeriod}
              />
            </>
          )}

          {activeTab === 'history' && (
            <div>
              <h4 className="text-xs font-semibold text-text-muted mb-3">
                Registro de Verificaciones Recientes
              </h4>
              <ChecksList targetId={target.id} />
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-4">
              <div className="bg-bg-dark/50 border border-border-base rounded-xl p-4 space-y-3 font-mono text-xs">
                <div className="flex justify-between py-1.5 border-b border-border-base/40">
                  <span className="text-text-muted">Método HTTP:</span>
                  <span className="text-text-main font-bold">{target.http_method || 'GET'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border-base/40">
                  <span className="text-text-muted">Código Esperado:</span>
                  <span className="text-accent-green font-bold">{target.expected_status || 200}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border-base/40">
                  <span className="text-text-muted">Umbral Latencia Máxima:</span>
                  <span className="text-accent-yellow font-bold">{target.max_latency_ms || 2000}ms</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border-base/40">
                  <span className="text-text-muted">Estado de Monitoreo:</span>
                  <span className={target.enabled ? 'text-accent-green' : 'text-zinc-400'}>
                    {target.enabled ? 'Activo' : 'Pausado'}
                  </span>
                </div>
              </div>

              {target.custom_headers && Object.keys(target.custom_headers).length > 0 && (
                <div className="bg-bg-dark/50 border border-border-base rounded-xl p-4">
                  <div className="text-xs font-mono font-bold text-text-muted mb-2">Encabezados Personalizados (JSON):</div>
                  <pre className="text-xs font-mono text-accent-green bg-black/40 p-3 rounded-lg overflow-x-auto">
                    {JSON.stringify(target.custom_headers, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
