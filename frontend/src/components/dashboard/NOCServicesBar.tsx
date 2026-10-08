import React from 'react';
import { Bot, Code2, Globe, Lock, Network, Server, ShieldCheck, Waypoints } from 'lucide-react';
import type { DashboardModuleFilter } from '../../utils/dashboardModel';

export interface ServiceCategoryMetric { count:number; total:number; attention:number; degraded?:number; down?:number; unknown?:number; unavailable?:boolean; loading?:boolean; avgLatency?:number }
interface Props { services:Record<Exclude<DashboardModuleFilter,'alerts'>,ServiceCategoryMetric>; selectedModule:DashboardModuleFilter|null; onModuleSelect:(module:DashboardModuleFilter|null)=>void }
const meta={
  web:{name:'Web',icon:Globe},api:{name:'API',icon:Code2},tcp:{name:'TCP',icon:Server},ssl:{name:'SSL',icon:Lock},
  dns:{name:'DNS',icon:Network},domain:{name:'Dominios',icon:Waypoints},security:{name:'Seguridad',icon:ShieldCheck},agent:{name:'Sentinine',icon:Bot},
} as const;
const states=[{name:'Saludables',color:'#4ade80'},{name:'Degradados',color:'#fbbf24'},{name:'Caídos',color:'#ff7384'},{name:'Sin datos',color:'#94a3b8'}];
function NOCServicesBar({services,selectedModule,onModuleSelect}:Props) {
  return <section data-testid="dashboard-module-filters">
    <header className="flex flex-wrap items-end justify-between gap-2 mb-3"><div><h3 className="text-sm font-bold">Estado por módulo</h3><p className="text-xs text-text-muted mt-1">Filtra la bandeja por área operativa</p></div>
      <div className="flex flex-wrap gap-3 text-xs text-text-muted">{states.map(state=><span key={state.name} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{background:state.color}}/>{state.name}</span>)}{selectedModule&&<button type="button" onClick={()=>onModuleSelect(null)} className="text-accent-green">Limpiar filtro</button>}</div>
    </header>
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5">{(Object.keys(meta) as Array<keyof typeof meta>).map(key=>{
      const item=services[key],Icon=meta[key].icon,selected=selectedModule===key;
      const counts=[item.count,item.degraded??0,item.down??0,item.unknown??Math.max(0,item.total-item.count-(item.degraded??0)-(item.down??0))];
      const absent=item.unavailable||item.loading;
      const label=item.loading?'Consultando…':item.unavailable?'No disponible':!item.total?'Sin recursos':item.attention?item.attention+' requieren atención':item.unknown?'Sin mediciones completas':'Sin pendientes';
      return <button key={key} type="button" data-testid={'dashboard-module-'+key} aria-pressed={selected} onClick={()=>onModuleSelect(selected?null:key)} className={'min-w-0 rounded-xl border bg-bg-card p-3 text-left transition-colors '+(selected?'border-accent-green ring-1 ring-accent-green/30':'border-border-base hover:border-border-accent')}>
        <div className="flex items-center gap-2"><Icon size={16} aria-hidden="true" className={selected?'text-accent-green':'text-text-muted'}/><strong className="text-xs">{meta[key].name}</strong></div>
        <div className="mt-3 text-lg tabular-nums font-semibold">{absent?'—':item.count}<span className="ml-1 text-xs font-normal text-text-muted">{absent?'': '/'+item.total+' saludables'}</span></div>
        <div role="img" aria-label={absent?label:states.map((state,index)=>state.name+': '+counts[index]).join(', ')} className="my-2 flex h-2 overflow-hidden rounded-full bg-bg-dark">{!absent&&item.total>0&&states.map((state,index)=><span key={state.name} style={{background:state.color,width:counts[index]/item.total*100+'%'}}/>)}</div>
        <p className={'text-xs '+(item.attention&&!absent?'text-accent-yellow':'text-text-muted')}>{label}</p>
      </button>;
    })}</div>
  </section>;
}
export default React.memo(NOCServicesBar);
