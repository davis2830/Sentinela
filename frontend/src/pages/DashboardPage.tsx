import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import {
  Activity,
  Lock,
  ShieldCheck,
  Zap,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';

export default function DashboardPage() {
  const { data: summaryData, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const response = await api.get('/reports/', {
        params: { type: 'summary' },
      });
      const reports = response.data?.data || [];
      const completed = reports.find((r: any) => r.status === 'completed');
      return completed?.data || null;
    },
    refetchInterval: 30000,
  });

  const summary = summaryData?.summary || {
    monitoring_targets: 0,
    ssl_certificates: 0,
    active_alerts: 0,
    open_incidents: 0,
  };

  const metrics = [
    {
      title: 'Targets Activos',
      value: summary.monitoring_targets,
      subtitle: 'Monitoreo habilitado',
      icon: Activity,
      color: 'text-accent-green',
    },
    {
      title: 'Certificados SSL',
      value: summary.ssl_certificates,
      subtitle: 'Certificados monitoreados',
      icon: Lock,
      color: 'text-accent-blue',
    },
    {
      title: 'Alertas Activas',
      value: summary.active_alerts,
      subtitle: 'Requieren atencion',
      icon: Zap,
      color: summary.active_alerts > 0 ? 'text-accent-yellow' : 'text-accent-green',
    },
    {
      title: 'Incidentes Abiertos',
      value: summary.open_incidents,
      subtitle: 'En investigacion',
      icon: ShieldCheck,
      color: summary.open_incidents > 0 ? 'text-accent-red' : 'text-accent-green',
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Observabilidad Global</h1>
          <p className="text-text-muted text-sm mt-1">
            Estado de disponibilidad y salud en tiempo real
          </p>
        </div>
        <button className="flex items-center gap-2 bg-accent-green text-black font-semibold px-4 py-2 rounded-md text-sm hover:opacity-90 transition-opacity">
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.title}
              className="bg-bg-card border border-border-base rounded-xl p-5 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-accent-green to-transparent"></div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-muted uppercase tracking-wide">
                  {metric.title}
                </span>
                <Icon className={metric.color} size={18} />
              </div>
              <div className={`text-3xl font-bold font-mono ${metric.color}`}>
                {isLoading ? '...' : metric.value}
              </div>
              <div className="text-xs text-text-muted mt-1">{metric.subtitle}</div>
            </div>
          );
        })}
      </div>

      {/* Panels Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Latency Chart Placeholder */}
        <div className="lg:col-span-2 bg-bg-card border border-border-base rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 font-semibold">
              <TrendingUp size={18} className="text-accent-green" />
              Latencia de Respuesta (ms)
            </div>
            <span className="font-mono text-xs text-text-dim">Ultimas 12 lecturas</span>
          </div>
          <div className="h-44 flex items-end gap-2 pt-8">
            {[30, 25, 35, 28, 60, 32, 24, 22, 27, 30, 25, 28].map((h, i) => (
              <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-1.5">
                <div
                  className={`w-full rounded-t-sm transition-all ${
                    h > 50
                      ? 'bg-accent-yellow/30 border-t-2 border-accent-yellow'
                      : 'bg-accent-green/20 border-t-2 border-accent-green'
                  }`}
                  style={{ height: `${h}%` }}
                ></div>
                <span className="text-xs text-text-dim font-mono">
                  {i === 11 ? 'Ahora' : `${12 - i}:00`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Security Headers Panel */}
        <div className="bg-bg-card border border-border-base rounded-xl p-6">
          <div className="flex items-center gap-2 font-semibold mb-4">
            <ShieldCheck size={18} className="text-accent-green" />
            Security Headers
          </div>
          <div className="flex flex-col gap-2">
            {[
              { name: 'Strict-Transport-Security', status: 'MAX-AGE=31536000' },
              { name: 'Content-Security-Policy', status: 'ACTIVE' },
              { name: 'X-Frame-Options', status: 'DENY' },
              { name: 'X-Content-Type-Options', status: 'NOSNIFF' },
            ].map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between px-3 py-2 bg-white/[0.02] rounded-md border border-white/[0.04] text-sm"
              >
                <span className="text-text-muted">{item.name}</span>
                <span className="bg-accent-green/10 text-accent-green border border-accent-green px-2 py-0.5 rounded text-xs font-mono">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Endpoints Table */}
      <div className="bg-bg-card border border-border-base rounded-xl p-6">
        <div className="flex items-center gap-2 font-semibold mb-4">
          <Activity size={18} className="text-accent-green" />
          Monitoreo de Endpoints
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="text-text-dim font-medium py-3 px-2 border-b border-border-base font-mono text-xs uppercase">Recurso</th>
              <th className="text-text-dim font-medium py-3 px-2 border-b border-border-base font-mono text-xs uppercase">Tipo</th>
              <th className="text-text-dim font-medium py-3 px-2 border-b border-border-base font-mono text-xs uppercase">Estado</th>
              <th className="text-text-dim font-medium py-3 px-2 border-b border-border-base font-mono text-xs uppercase">Latencia</th>
              <th className="text-text-dim font-medium py-3 px-2 border-b border-border-base font-mono text-xs uppercase">Ultima revision</th>
            </tr>
          </thead>
          <tbody>
            <tr className="hover:bg-bg-card-hover transition-colors">
              <td className="py-3 px-2 border-b border-border-base font-mono text-text-main">/api/v1/auth/login/</td>
              <td className="py-3 px-2 border-b border-border-base text-text-muted">API Endpoint</td>
              <td className="py-3 px-2 border-b border-border-base">
                <span className="bg-accent-green/10 text-accent-green border border-accent-green px-2 py-0.5 rounded text-xs font-mono">200 OK</span>
              </td>
              <td className="py-3 px-2 border-b border-border-base text-text-muted">28ms</td>
              <td className="py-3 px-2 border-b border-border-base text-text-muted">Hace 15 segs</td>
            </tr>
            <tr className="hover:bg-bg-card-hover transition-colors">
              <td className="py-3 px-2 border-b border-border-base font-mono text-text-main">/api/v1/auth/me/</td>
              <td className="py-3 px-2 border-b border-border-base text-text-muted">API Endpoint</td>
              <td className="py-3 px-2 border-b border-border-base">
                <span className="bg-accent-green/10 text-accent-green border border-accent-green px-2 py-0.5 rounded text-xs font-mono">200 OK</span>
              </td>
              <td className="py-3 px-2 border-b border-border-base text-text-muted">18ms</td>
              <td className="py-3 px-2 border-b border-border-base text-text-muted">Hace 15 segs</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}