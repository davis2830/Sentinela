import React from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Eye, RefreshCw, ShieldAlert, X } from 'lucide-react';
import type {
  DashboardAttentionItem,
  DashboardFilterState,
  DashboardHealthFilter,
  DashboardModuleFilter,
} from '../../utils/dashboardModel';
import { dashboardModuleMeta } from '../../utils/dashboardModel';

interface NOCOperationalInboxProps {
  items: DashboardAttentionItem[];
  total: number;
  filters: DashboardFilterState;
  loading: boolean;
  partialError: boolean;
  canManage: boolean;
  pendingKey: string | null;
  onViewChange: (view: DashboardFilterState['view']) => void;
  onClearHealth: () => void;
  onClearModule: () => void;
  onSelect: (item: DashboardAttentionItem) => void;
  onScan: (item: DashboardAttentionItem) => void;
  onAcknowledge: (item: DashboardAttentionItem) => void;
  onNavigate: (path: string) => void;
}

const healthLabels: Record<DashboardHealthFilter, string> = {
  healthy: 'Saludable',
  degraded: 'Degradado',
  down: 'Caído',
  unknown: 'Sin datos',
};

const severityStyle = {
  critical: 'border-accent-red/35 bg-accent-red/5 text-accent-red',
  warning: 'border-accent-yellow/35 bg-accent-yellow/5 text-accent-yellow',
  healthy: 'border-accent-green/30 bg-accent-green/5 text-accent-green',
  unknown: 'border-border-base bg-bg-dark/40 text-text-dim',
};

function relativeTime(timestamp: number | null) {
  if (!timestamp) return 'Sin medición';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'Hace menos de 1 min';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return `Hace ${Math.floor(hours / 24)} d`;
}

function NOCOperationalInbox({
  items,
  total,
  filters,
  loading,
  partialError,
  canManage,
  pendingKey,
  onViewChange,
  onClearHealth,
  onClearModule,
  onSelect,
  onScan,
  onAcknowledge,
  onNavigate,
}: NOCOperationalInboxProps) {
  const visible = items.slice(0, 10);

  return (
    <section className="bg-bg-card border border-border-base rounded-2xl p-5 md:p-6 shadow-sm h-full" data-testid="dashboard-attention-inbox">
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert size={17} className="text-accent-yellow" />
            <h3 className="text-sm font-bold tracking-wide text-text-main">Necesita atención</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-bg-dark border border-border-base text-text-muted">
              {total}
            </span>
          </div>
          <div className="flex rounded-lg border border-border-base bg-bg-dark p-0.5">
            {(['attention', 'all'] as const).map((view) => (
              <button
                key={view}
                type="button"
                data-testid={`dashboard-view-${view}`}
                onClick={() => onViewChange(view)}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  filters.view === view ? 'bg-bg-card text-text-main shadow-sm' : 'text-text-dim hover:text-text-main'
                }`}
              >
                {view === 'attention' ? 'Atención' : 'Todos'}
              </button>
            ))}
          </div>
        </div>

        {(filters.health || filters.module) && (
          <div className="flex flex-wrap items-center gap-2" data-testid="dashboard-filter-chips">
            <span className="text-[10px] uppercase tracking-wider text-text-dim">Filtros</span>
            {filters.health && (
              <button type="button" onClick={onClearHealth} className="inline-flex items-center gap-1 rounded-full border border-accent-green/30 bg-accent-green/10 px-2.5 py-1 text-[11px] text-accent-green">
                {healthLabels[filters.health]} <X size={11} />
              </button>
            )}
            {filters.module && (
              <button type="button" onClick={onClearModule} className="inline-flex items-center gap-1 rounded-full border border-accent-purple/30 bg-accent-purple/10 px-2.5 py-1 text-[11px] text-accent-purple">
                {dashboardModuleMeta[filters.module].label} <X size={11} />
              </button>
            )}
          </div>
        )}
      </div>

      {partialError && (
        <div className="mb-3 rounded-xl border border-accent-yellow/30 bg-accent-yellow/5 px-3 py-2 text-[11px] text-accent-yellow">
          Algunos módulos no respondieron. La bandeja muestra los datos disponibles sin asumir que faltan problemas.
        </div>
      )}

      {loading ? (
        <div className="space-y-2" aria-label="Cargando bandeja">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-20 rounded-xl bg-bg-dark/70 animate-pulse border border-border-base/40" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="min-h-52 flex flex-col items-center justify-center text-center px-5">
          <CheckCircle2 size={30} className="text-accent-green mb-3" />
          <p className="text-sm font-semibold text-text-main">No hay elementos para estos filtros</p>
          <p className="text-xs text-text-dim mt-1">Prueba retirar un filtro o cambiar a la vista Todos.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[40rem] overflow-y-auto pr-1 scrollbar-thin">
          {visible.map((item) => (
            <article
              key={item.key}
              data-testid="dashboard-attention-item"
              className={`group rounded-xl border p-3 transition-colors hover:border-border-accent ${severityStyle[item.severity]}`}
            >
              <button type="button" onClick={() => onSelect(item)} className="w-full text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3 min-w-0">
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.severity === 'critical' ? 'bg-accent-red shadow-sm shadow-accent-red/50' : item.severity === 'warning' ? 'bg-accent-yellow' : item.severity === 'healthy' ? 'bg-accent-green' : 'bg-zinc-500'}`} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-xs font-bold text-text-main">{item.title}</h4>
                        <span className="rounded-full border border-current/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">{item.moduleLabel}</span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-text-muted">{item.subtitle}</p>
                    </div>
                  </div>
                  <ChevronRight size={15} className="mt-1 shrink-0 text-text-dim transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-5 text-[10px]">
                  <span className="font-semibold">{item.statusLabel}</span>
                  {item.metricLabel && <span className="font-mono text-text-main">{item.metricLabel}</span>}
                  <span className="text-text-dim">{relativeTime(item.occurredAt)}</span>
                  {item.linkedAlertsCount ? <span>{item.linkedAlertsCount} alertas agrupadas</span> : null}
                </div>
              </button>

              <div className="mt-2 flex flex-wrap justify-end gap-2 border-t border-current/10 pt-2">
                
                {canManage && item.type === 'alert' && (
                  <button type="button" onClick={() => onAcknowledge(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-accent-yellow/25 bg-accent-yellow/10 px-2.5 py-1 text-[10px] font-semibold text-accent-yellow">
                    <AlertTriangle size={11} /> Reconocer
                  </button>
                )}
                <button type="button" onClick={() => onNavigate(item.path)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold text-text-muted hover:text-text-main">
                  <Eye size={11} /> Ver módulo
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {items.length > 10 && <p className="mt-3 text-center text-[11px] text-text-dim">Mostrando 10 de {items.length} elementos filtrados</p>}
    </section>
  );
}

export default React.memo(NOCOperationalInbox);
