import React from 'react';
import { Activity, AlertTriangle, HeartPulse, Shield } from 'lucide-react';
import { uptimeTone } from '../../utils/endpointPresentation';
import { dashboardHealthTone } from '../../utils/dashboardHealthTone';
interface Props {
 healthScore:number|null;totalTargets:number;healthyTargets:number;degradedTargets:number;downTargets:number;unknownTargets:number;
 availability:number|null;avgLatencyMs:number|null;attentionCount:number;criticalAttentionCount:number;activeIncidentsCount:number;
 telemetryPoints?:{uptime:number|null;latency:number|null}[];isLoading:boolean;period:string;onAttention:()=>void;
}
const palette={success:'#4ade80',warning:'#fbbf24',danger:'#ff7384',muted:'#cbd5e1',info:'#cbd5e1'};
const sparkline=(values:(number|null)[],color:string,label:string)=>{
 const measured=values.filter((v):v is number=>v!=null&&Number.isFinite(v));if(measured.length<2)return null;
 const min=Math.min(...measured),span=Math.max(1,Math.max(...measured)-min);let drawing=false;
 const path=values.map((v,i)=>{if(v==null||!Number.isFinite(v)){drawing=false;return '';}const point=`${i*100/Math.max(1,values.length-1)},${17-(v-min)*14/span}`;const command=`${drawing?'L':'M'}${point}`;drawing=true;return command;}).join(' ');
 return <svg className="h-6 w-full" viewBox="0 0 100 20" preserveAspectRatio="none" role="img" aria-label={label}><path d={path} fill="none" stroke={color} strokeWidth="2"/></svg>;
};
function NOCExecutiveKpis({healthScore,totalTargets,healthyTargets,degradedTargets,downTargets,unknownTargets,availability,avgLatencyMs,attentionCount,criticalAttentionCount,activeIncidentsCount,telemetryPoints=[],isLoading,period,onAttention}:Props){
 const healthColor=dashboardHealthTone({total:totalTargets,down:downTargets,degraded:degradedTargets,unknown:unknownTargets,score:healthScore,unavailable:isLoading});
 const cards=[
 {title:'Recursos saludables ahora',scope:'Todos los módulos · Ahora',icon:HeartPulse,color:healthColor,value:isLoading||healthScore==null?'—':`${healthyTargets}/${totalTargets}`,detail:`${degradedTargets} degradados · ${downTargets} caídos · ${unknownTargets} sin datos`,chart:null},
 {title:`Disponibilidad · ${period}`,scope:'Solo Monitoring · Por comprobaciones',icon:Shield,color:`ui-tone`,tone:uptimeTone(availability),value:availability==null?'Sin datos':`${availability.toFixed(2)}%`,detail:'Respuestas correctas, incluidas las lentas',chart:sparkline(telemetryPoints.map(p=>p.uptime),palette[uptimeTone(availability)],'Tendencia de disponibilidad')},
 {title:`Tiempo medio · ${period}`,scope:'Solo Monitoring · Con tiempo registrado',icon:Activity,color:'text-text-main',value:avgLatencyMs==null?'Sin datos':`${Math.round(avgLatencyMs)} ms`,detail:'Incluye intentos fallidos',chart:sparkline(telemetryPoints.map(p=>p.latency),'#cbd5e1','Tendencia del tiempo medio')},
 {title:'Pendientes de atención',scope:'Todos los módulos · Ahora',icon:AlertTriangle,color:criticalAttentionCount?'text-accent-red':attentionCount?'text-accent-yellow':'text-accent-green',value:String(attentionCount),detail:`${criticalAttentionCount} críticos · ${activeIncidentsCount} incidentes activos`,chart:null},
 ];
 return <section className="dashboard-kpi-strip" data-testid="dashboard-kpis">{cards.map((card,i)=>{const Icon=card.icon;const body=<><div className="flex items-center gap-2 text-xs text-text-muted"><Icon size={15} className={card.color}/>{card.title}</div><div className="flex items-center justify-between gap-3 my-1"><strong className={`text-[28px] leading-tight font-bold tabular-nums ${card.color}`} data-testid={i===0?'dashboard-kpi-health-count':undefined}>{card.value}</strong>{i===0&&<span className={`text-sm ${healthColor}`} data-testid="dashboard-kpi-health-score">{healthScore==null?'Sin datos':`${healthScore}%`}</span>}{card.chart&&<span className="hidden w-20 shrink-0 sm:block">{card.chart}</span>}</div><p className="text-xs text-text-dim">{card.scope}</p><p className="text-xs text-text-muted mt-1">{card.detail}</p></>;
 return i===3?<button type="button" key={card.title} className="dashboard-kpi-cell text-left hover:bg-bg-card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-green" onClick={onAttention} aria-label="Ver pendientes de atención">{body}</button>:<div key={card.title} className="dashboard-kpi-cell" data-tone={card.tone}>{body}</div>;})}</section>;
}
export default React.memo(NOCExecutiveKpis);
