import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Sliders } from 'lucide-react';
import type { DashboardHealthFilter } from '../../utils/dashboardModel';

interface Props {
  total: number; online: number; degraded: number; down: number; unknown: number;
  healthScore: number | null; dataUnavailable: boolean; isLoading: boolean;
  selectedHealth: DashboardHealthFilter | null;
  onHealthSelect: (health: DashboardHealthFilter | null) => void;
}
interface Slice { key: DashboardHealthFilter; name: string; value: number; color: string; pct: number }
function NOCInfraHealthDonut({total,online,degraded,down,unknown,healthScore,dataUnavailable,isLoading,selectedHealth,onHealthSelect}:Props) {
  const states=useMemo<Slice[]>(()=>[
    {key:'healthy',name:'Saludables',value:online,color:'#4ade80',pct:total?online/total*100:0},
    {key:'degraded',name:'Degradados',value:degraded,color:'#fbbf24',pct:total?degraded/total*100:0},
    {key:'down',name:'Caídos',value:down,color:'#ff7384',pct:total?down/total*100:0},
    {key:'unknown',name:'Sin datos',value:unknown,color:'#94a3b8',pct:total?unknown/total*100:0},
  ],[total,online,degraded,down,unknown]);
  const data=states.filter(state=>state.value>0);
  const available=!dataUnavailable&&total>0;
  const scoreColor=healthScore==null?'text-text-muted':healthScore>=90?'text-accent-green':healthScore>=70?'text-accent-yellow':'text-accent-red';
  return <section className="bg-bg-card border border-border-base rounded-2xl p-4 h-full" data-testid="dashboard-health-donut">
    <header className="flex items-center gap-2 mb-3"><Sliders size={16} className="text-accent-green"/><div><h3 className="text-sm font-bold text-text-main">Estado actual</h3><p className="text-xs text-text-muted">Selecciona un estado para filtrar</p></div></header>
    {isLoading?<div role="status" className="h-64 rounded-xl bg-bg-dark/60 animate-pulse"><span className="sr-only">Consultando estado…</span></div>:<>
      <div className="relative h-44 w-44 mx-auto my-2">
        {available?<ResponsiveContainer width="100%" height="100%"><PieChart>
          <Pie isAnimationActive={false} data={data} dataKey="value" innerRadius={56} outerRadius={78} paddingAngle={data.length>1?3:0} cornerRadius={4} stroke="#111c2b" strokeWidth={2} onClick={entry=>onHealthSelect((entry as unknown as {payload:Slice}).payload.key)}>
            {data.map(entry=><Cell key={entry.key} fill={entry.color} opacity={selectedHealth&&selectedHealth!==entry.key?0.3:1} className="cursor-pointer"/>)}
          </Pie>
          <Tooltip wrapperStyle={{zIndex:30,pointerEvents:'none'}} content={({active,payload})=>active&&payload?.[0]?<div role="tooltip" data-testid="dashboard-health-tooltip" className="rounded-lg border border-border-accent bg-bg-dark p-3 text-xs text-text-main shadow-xl"><strong>{(payload[0].payload as Slice).name}</strong><p className="mt-1">{(payload[0].payload as Slice).value} recursos · {(payload[0].payload as Slice).pct.toFixed(1)}%</p></div>:null}/>
        </PieChart></ResponsiveContainer>:<div className="absolute inset-[10px] rounded-full border-[20px] border-border-base/60" aria-hidden="true"/>}
        <button type="button" data-testid="dashboard-donut-reset" onClick={()=>onHealthSelect(null)} className="absolute inset-8 rounded-full flex flex-col items-center justify-center hover:bg-bg-dark/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-green" title="Restablecer filtro" style={{clipPath:'circle(48% at 50% 50%)'}}>
          <strong className={'text-2xl tabular-nums font-semibold '+scoreColor}>{available&&healthScore!=null?healthScore+'%':'—'}</strong>
          <span className="text-xs text-text-muted">Salud actual</span>
          <span className="mt-1 text-xs text-text-muted">{dataUnavailable?'No disponible':total+' recursos'}</span>
        </button>
      </div>
      {!available&&<p role="status" className="mb-3 text-center text-xs text-text-muted">{dataUnavailable?'Estado incompleto: uno o más módulos no respondieron.':'Todavía no hay recursos configurados.'}</p>}
      <div className="grid grid-cols-2 gap-2">{states.map(entry=><button key={entry.key} type="button" data-testid={'dashboard-health-'+entry.key} aria-pressed={selectedHealth===entry.key} disabled={!available} onClick={()=>onHealthSelect(entry.key)} className={'rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-default '+(selectedHealth===entry.key?'border-border-accent bg-bg-dark':'border-border-base/60 hover:border-border-accent')}>
        <span className="flex items-center gap-1.5 text-xs text-text-muted"><span className="h-2 w-2 rounded-full" style={{background:entry.color}}/>{entry.name}</span>
        <span className="mt-1 flex justify-between items-baseline gap-2"><strong className="text-lg tabular-nums">{dataUnavailable?'—':entry.value}</strong><span className="text-xs text-text-muted">{dataUnavailable?'—':Math.round(entry.pct)+'%'}</span></span>
      </button>)}</div>
    </>}
    <p className="mt-3 border-t border-border-base/50 pt-3 text-xs text-text-muted">Los recursos sin medición no cuentan como saludables.</p>
  </section>;
}
export default React.memo(NOCInfraHealthDonut);
