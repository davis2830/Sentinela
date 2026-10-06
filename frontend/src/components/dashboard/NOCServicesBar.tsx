import React from 'react';
import { Bot, Code2, Globe, Lock, Network, Server, ShieldCheck, Waypoints } from 'lucide-react';
import type { DashboardModuleFilter } from '../../utils/dashboardModel';

export interface ServiceCategoryMetric { count: number; total: number; attention: number; avgLatency?: number }
interface Props { services: Record<Exclude<DashboardModuleFilter, 'alerts'>, ServiceCategoryMetric>; selectedModule: DashboardModuleFilter | null; onModuleSelect: (module: DashboardModuleFilter | null) => void }
const meta = {
  web: { name: 'Web', icon: Globe, color: 'text-sky-400 bg-sky-500/10' }, api: { name: 'API', icon: Code2, color: 'text-accent-purple bg-accent-purple/10' }, tcp: { name: 'TCP', icon: Server, color: 'text-accent-green bg-accent-green/10' }, ssl: { name: 'SSL', icon: Lock, color: 'text-amber-400 bg-amber-500/10' }, dns: { name: 'DNS', icon: Network, color: 'text-indigo-400 bg-indigo-500/10' }, domain: { name: 'Dominios', icon: Waypoints, color: 'text-cyan-400 bg-cyan-500/10' }, security: { name: 'Seguridad', icon: ShieldCheck, color: 'text-rose-400 bg-rose-500/10' }, agent: { name: 'Sentinine', icon: Bot, color: 'text-teal-400 bg-teal-500/10' },
} as const;

function NOCServicesBar({ services, selectedModule, onModuleSelect }: Props) {
  return <section data-testid="dashboard-module-filters">
    <div className="flex items-end justify-between mb-2"><div><h3 className="text-sm font-bold text-text-main">Estado por módulo</h3><p className="text-[10px] text-text-dim">Filtra la bandeja por área operativa</p></div>{selectedModule && <button type="button" onClick={() => onModuleSelect(null)} className="text-[10px] text-accent-green">Limpiar filtro</button>}</div>
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5">{(Object.keys(meta) as Array<keyof typeof meta>).map((key) => { const item = services[key]; const Icon = meta[key].icon; const selected = selectedModule === key; const healthyPct = item.total ? Math.round(item.count / item.total * 100) : 0; return <button key={key} type="button" data-testid={`dashboard-module-${key}`} onClick={() => onModuleSelect(selected ? null : key)} className={`rounded-xl border bg-bg-card p-3 text-left transition-all ${selected ? 'border-accent-green ring-1 ring-accent-green/30' : 'border-border-base hover:border-border-accent'}`}><div className="flex items-center justify-between gap-2"><span className={`p-1.5 rounded-lg ${meta[key].color}`}><Icon size={14} /></span><span className={`h-2 w-2 rounded-full ${item.attention ? 'bg-accent-red' : item.total ? 'bg-accent-green' : 'bg-zinc-500'}`} /></div><strong className="mt-2 block text-xs text-text-main">{meta[key].name}</strong><div className="mt-1 flex items-end justify-between"><span className="font-mono text-sm text-text-main">{item.count}<span className="text-[10px] font-normal text-text-dim">/{item.total}</span></span>{item.attention > 0 && <span className="text-[9px] text-accent-red">{item.attention} atención</span>}</div><div className="mt-2 h-1 overflow-hidden rounded-full bg-bg-dark"><div className="h-full bg-accent-green" style={{ width: `${healthyPct}%` }} /></div></button>; })}</div>
  </section>;
}
export default React.memo(NOCServicesBar);
