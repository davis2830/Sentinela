import React from 'react';
import { Globe, Code2, Database, Lock, Network, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface ServiceCategoryMetric {
  count: number;
  total: number;
  avg_latency?: number;
}

export interface NOCServicesBarProps {
  services: {
    web: ServiceCategoryMetric;
    api: ServiceCategoryMetric;
    db: ServiceCategoryMetric;
    ssl: ServiceCategoryMetric;
    dns: ServiceCategoryMetric;
  };
}

export default function NOCServicesBar({ services }: NOCServicesBarProps) {
  const navigate = useNavigate();

  const renderMiniSpark = (color: string, healthyRatio: number) => {
    // Generate a mini sparkline path based on real health ratio
    const y1 = Math.max(4, Math.round(18 - healthyRatio * 12));
    const y2 = Math.max(3, Math.round(16 - healthyRatio * 13));
    const d = `M0,15 Q15,${y1} 30,${Math.round((y1 + y2) / 2)} T60,${y2}`;
    return (
      <svg className="w-14 h-4 shrink-0" viewBox="0 0 60 20">
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  };

  const items = [
    {
      id: 'web',
      name: 'Web',
      count: services.web.count,
      total: services.web.total,
      latency: services.web.avg_latency ? `${services.web.avg_latency}ms` : null,
      icon: Globe,
      color: '#38bdf8',
      iconBg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
      path: '/monitoring',
      hint: 'Sitios y endpoints HTTP/HTTPS',
    },
    {
      id: 'api',
      name: 'APIs',
      count: services.api.count,
      total: services.api.total,
      latency: services.api.avg_latency ? `${services.api.avg_latency}ms` : null,
      icon: Code2,
      color: '#a855f7',
      iconBg: 'bg-accent-purple/10 text-accent-purple border-accent-purple/20',
      path: '/api-checks',
      hint: 'Checks sintéticos de API',
    },
    {
      id: 'db',
      name: 'Base de Datos',
      count: services.db.count,
      total: services.db.total,
      latency: services.db.avg_latency ? `${services.db.avg_latency}ms` : null,
      icon: Database,
      color: '#10b981',
      iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      path: '/monitoring',
      hint: 'Sockets y puertos TCP',
    },
    {
      id: 'ssl',
      name: 'SSL',
      count: services.ssl.count,
      total: services.ssl.total,
      latency: services.ssl.count === services.ssl.total && services.ssl.total > 0 ? 'Válidos' : null,
      icon: Lock,
      color: '#f59e0b',
      iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      path: '/ssl',
      hint: 'Certificados TLS vigentes',
    },
    {
      id: 'dns',
      name: 'DNS',
      count: services.dns.count,
      total: services.dns.total,
      latency: services.dns.avg_latency ? `${services.dns.avg_latency}ms` : null,
      icon: Network,
      color: '#6366f1',
      iconBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      path: '/dns',
      hint: 'Registros y resolución DNS',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((item) => {
        const Icon = item.icon;
        const healthyRatio = item.total > 0 ? item.count / item.total : 1;
        const isOptimal = item.total > 0 && item.count === item.total;
        const hasWarning = item.total > 0 && item.count < item.total;

        return (
          <div
            key={item.id}
            onClick={() => navigate(item.path)}
            className="group relative bg-bg-card border border-border-base hover:border-border-accent rounded-xl p-3.5 shadow-sm transition-all hover:shadow-md cursor-pointer flex flex-col justify-between overflow-hidden"
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
                  {item.count}
                  <span className="text-text-dim text-xs font-normal">/{item.total}</span>
                </span>
              </div>
            </div>

            {/* Bottom row: Real latency / badge + Mini Sparkline */}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-border-base/40">
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    item.total === 0
                      ? 'bg-zinc-500'
                      : isOptimal
                      ? 'bg-accent-green'
                      : hasWarning
                      ? 'bg-accent-yellow'
                      : 'bg-accent-red'
                  }`}
                />
                <span className="text-[10px] font-mono text-text-dim">
                  {item.total === 0 ? 'Sin targets' : item.latency || (isOptimal ? 'Óptimo' : 'Atención')}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {renderMiniSpark(item.color, healthyRatio)}
                <ArrowRight
                  size={12}
                  className="text-text-dim group-hover:text-text-main group-hover:translate-x-0.5 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
