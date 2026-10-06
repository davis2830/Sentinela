import React, { useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, ChevronRight, Clock3, FileClock } from 'lucide-react';
import type { DashboardActivityEvent } from '../../utils/dashboardModel';

interface Props { events: DashboardActivityEvent[]; loading: boolean; partialError: boolean; onNavigate: (path: string) => void }
type Filter = 'all' | 'operations' | 'changes';

function relativeTime(timestamp: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'Ahora'; if (minutes < 60) return `Hace ${minutes} min`; const hours = Math.floor(minutes / 60); if (hours < 24) return `Hace ${hours} h`; return `Hace ${Math.floor(hours / 24)} d`;
}

function NOCRecentActivityFeed({ events, loading, partialError, onNavigate }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const filtered = useMemo(() => events.filter((event) => filter === 'all' || event.category === filter).slice(0, 8), [events, filter]);
  return <section className="bg-bg-card border border-border-base rounded-2xl p-5 md:p-6 shadow-sm h-full" data-testid="dashboard-activity">
    <div className="flex flex-col gap-3 mb-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Activity size={16} className="text-accent-blue" /><h3 className="text-sm font-bold text-text-main">Actividad operativa</h3></div><button type="button" onClick={() => onNavigate('/audit-logs')} className="flex items-center gap-1 text-[10px] text-text-muted hover:text-accent-blue">Historial <ChevronRight size={12} /></button></div><div className="flex gap-1 rounded-lg border border-border-base bg-bg-dark p-0.5 self-start">{(['all', 'operations', 'changes'] as Filter[]).map((value) => <button key={value} type="button" data-testid={`dashboard-activity-${value}`} onClick={() => setFilter(value)} className={`rounded-md px-2.5 py-1 text-[10px] font-semibold ${filter === value ? 'bg-bg-card text-text-main' : 'text-text-dim'}`}>{value === 'all' ? 'Todo' : value === 'operations' ? 'Operación' : 'Cambios'}</button>)}</div></div>
    {partialError && <p className="mb-2 text-[10px] text-accent-yellow">Actividad parcial: uno o más orígenes no respondieron.</p>}
    <div className="space-y-2 max-h-[40rem] overflow-y-auto pr-1 scrollbar-thin">{loading ? [0,1,2,3].map((value) => <div key={value} className="h-16 rounded-xl bg-bg-dark/60 animate-pulse" />) : filtered.length === 0 ? <div className="py-12 text-center text-xs text-text-dim"><Clock3 size={24} className="mx-auto mb-2" />Sin actividad en este período.</div> : filtered.map((event) => {
      const Icon = event.category === 'changes' ? FileClock : event.severity === 'critical' || event.severity === 'warning' ? AlertTriangle : CheckCircle2;
      const color = event.severity === 'critical' ? 'text-accent-red' : event.severity === 'warning' ? 'text-accent-yellow' : 'text-accent-green';
      return <button key={event.id} type="button" onClick={() => onNavigate(event.path)} className="w-full rounded-xl border border-border-base/50 bg-bg-dark/40 p-2.5 text-left hover:border-border-accent"><div className="flex gap-2.5"><Icon size={14} className={`${color} mt-0.5 shrink-0`} /><div className="min-w-0"><p className="truncate text-xs font-semibold text-text-main">{event.title}</p><p className="mt-0.5 line-clamp-2 text-[10px] text-text-dim">{event.description}</p><p className="mt-1 text-[9px] font-mono text-text-muted">{relativeTime(event.occurredAt)} · {event.category === 'changes' ? 'Cambio auditado' : 'Operación'}</p></div></div></button>;
    })}</div>
    <div className="mt-4 flex items-center justify-between border-t border-border-base/50 pt-3 text-[10px] text-text-dim"><span>Máximo 8 eventos</span><span className="flex items-center gap-1 text-accent-green"><span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse" />Auto-refresh</span></div>
  </section>;
}
export default React.memo(NOCRecentActivityFeed);
