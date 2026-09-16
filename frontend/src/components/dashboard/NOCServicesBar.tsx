import React from 'react';
import { Globe, Code2, Lock, Network, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatFreshness, type ServiceFreshness } from '../../utils/dashboardFreshness';

export interface ServiceCategoryMetric {
  count: number;
  total: number;
  avg_latency?: number;
}

export interface NOCServicesBarProps {
  freshness: Record<'web' | 'api' | 'tcp' | 'ssl' | 'dns', ServiceFreshness>;
  services: {
    web: ServiceCategoryMetric;
    api: ServiceCategoryMetric;
    tcp?: ServiceCategoryMetric;
    db?: ServiceCategoryMetric;
    ssl: ServiceCategoryMetric;
    dns: ServiceCategoryMetric;
  };
}

function NOCServicesBar({ services, freshness }: NOCServicesBarProps) {
  const navigate = useNavigate();

  const items = [
    {
      id: 'web',
      freshness: freshness.web,
      name: 'Web',
      count: services.web.count,
      total: services.web.total,
      latency: services.web.avg_latency ? `${services.web.avg_latency}ms` : null,
      icon: Globe,
      iconBg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
      path: '/monitoring',
      hint: 'Sitios y endpoints HTTP/HTTPS',
    },
    {
      id: 'api',
      freshness: freshness.api,
      name: 'APIs',
      count: services.api.count,
      total: services.api.total,
      latency: services.api.avg_latency ? `${services.api.avg_latency}ms` : null,
      icon: Code2,
      iconBg: 'bg-accent-purple/10 text-accent-purple border-accent-purple/20',
      path: '/api-checks',
      hint: 'Checks sintéticos de API',
    },
    {
      id: 'tcp',
      freshness: freshness.tcp,
      name: 'Red / TCP',
      count: services.tcp?.count ?? services.db?.count ?? 0,
      total: services.tcp?.total ?? services.db?.total ?? 0,
      latency: (services.tcp?.avg_latency || services.db?.avg_latency) ? `${services.tcp?.avg_latency || services.db?.avg_latency}ms` : null,
      icon: Network,
      iconBg: 'bg-accent-green/10 text-accent-green border-accent-green/20',
      path: '/monitoring',
      hint: 'Sockets y puertos TCP',
    },
    {
      id: 'ssl',
      freshness: freshness.ssl,
      name: 'SSL',
      count: services.ssl.count,
      total: services.ssl.total,
      latency: services.ssl.count === services.ssl.total && services.ssl.total > 0 ? 'Válidos' : null,
      icon: Lock,
      iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      path: '/ssl',
      hint: 'Certificados TLS vigentes',
    },
    {
      id: 'dns',
      freshness: freshness.dns,
      name: 'DNS',
      count: services.dns.count,
      total: services.dns.total,
      latency: services.dns.avg_latency ? `${services.dns.avg_latency}ms` : null,
      icon: Network,
      iconBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      path: '/dns',
      hint: 'Registros y resolución DNS',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((item) => {
        const Icon = item.icon;
        const isOptimal = item.total > 0 && item.count === item.total;
        const hasWarning = item.total > 0 && item.count < item.total;
        const state = item.freshness.state;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(item.path)}
            className="group relative bg-bg-card border border-border-base hover:border-border-accent rounded-xl p-3.5 shadow-sm transition-all hover:shadow-md cursor-pointer flex flex-col justify-between overflow-hidden text-left"
          >
            {/* Top row: Icon, Name and Status Ratio */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`p-1.5 rounded-lg border ${item.iconBg} shrink-0`}>
                  <Icon size={14} />
                </div>
                <div className="truncate">
                  <span className="text-xs font-semibold text-text-main group-hover:text-accent-green transition-colors truncate block">
                    {item.name}
                  </span>
                  <span className="text-[10px] text-text-dim truncate block">
                    {item.hint}
                  </span>
                </div>
              </div>

              {/* Real count */}
              <div className="text-right shrink-0">
                <span className="text-sm font-mono font-bold text-text-main">
                  {state === 'error' ? '—' : item.count}
                  {state !== 'error' && <span className="text-text-dim text-xs font-normal">/{item.total}</span>}
                </span>
              </div>
            </div>

            {/* Bottom row: measured latency or status */}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-border-base/40">
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    state === 'error'
                      ? 'bg-accent-red'
                      : state === 'stale'
                      ? 'bg-accent-yellow'
                      : state === 'pending' || state === 'paused' || item.total === 0
                      ? 'bg-zinc-500'
                      : isOptimal
                      ? 'bg-accent-green'
                      : hasWarning
                      ? 'bg-accent-yellow'
                      : 'bg-accent-red'
                  }`}
                />
                <span className="text-[10px] font-mono text-text-dim">
                  {state === 'error' ? 'Error de carga' : item.total === 0 ? 'Sin targets' : state === 'pending' ? 'Sin checks' : state === 'current' ? item.latency || (isOptimal ? 'Óptimo' : 'Atención') : formatFreshness(item.freshness)}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <ArrowRight
                  size={12}
                  className="text-text-dim group-hover:text-text-main group-hover:translate-x-0.5 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                />
              </div>
            </div>
            {state === 'current' && <span className="mt-1 text-[10px] text-text-dim font-mono">{formatFreshness(item.freshness)}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default React.memo(NOCServicesBar);
