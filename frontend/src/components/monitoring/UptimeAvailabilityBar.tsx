import { useState } from 'react';
import type { DailyAvailabilityItem } from '../../types/monitoring';
import { uptimeTone, finite, formatMetric } from '../../utils/endpointPresentation';
interface Props { days:DailyAvailabilityItem[]; uptimePercentage?:number|null }
export default function UptimeAvailabilityBar({days}:Props) {
 const [selected,setSelected]=useState<DailyAvailabilityItem|null>(null);
 const total=days.reduce((n,d)=>n+d.total_checks,0);const failed=days.reduce((n,d)=>n+d.down_checks,0);
 const uptime=total>0?(total-failed)*100/total:null;
 const tone=(d:DailyAvailabilityItem)=>!d.total_checks||d.status==='no_data'?'muted':d.status==='down'?'danger':d.status==='degraded'?'warning':d.status==='operational'?'success':'muted';
 return <section className="ui-card space-y-3" aria-label="Disponibilidad diaria de 30 días">
 <header className="flex flex-wrap justify-between items-center gap-2"><h3 className="font-semibold text-sm">Disponibilidad diaria · 30 días</h3><span className="ui-status" data-tone={uptimeTone(uptime)}>{uptime==null?'Sin mediciones':`${formatMetric(uptime,2)}%`}</span></header>
 <p className="text-xs text-text-muted">Verde: operacional · Amarillo: lentitud · Rojo: hubo fallos · Gris: sin datos</p>
 <div className="flex gap-1">{days.map(d=><button type="button" key={d.date} aria-label={`${d.label}: ${!d.total_checks?'Sin datos':d.status==='down'?'Hubo fallos':d.status==='degraded'?'Degradado':'Operacional'}`} onFocus={()=>setSelected(d)} onMouseEnter={()=>setSelected(d)} onClick={()=>setSelected(d)} className="min-w-0 flex-1 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-green rounded" data-tone={tone(d)}><span className="block h-9 rounded-sm" style={{backgroundColor:'rgb(var(--ui-tone))',opacity:tone(d)==='muted'?.2:.85}}/></button>)}</div>
 {selected&&<div className="text-xs border-t border-border-base pt-3 space-y-1" aria-live="polite"><p className="font-semibold">{selected.label} · {selected.date}</p><p className="ui-tone" data-tone={uptimeTone(selected.uptime_percentage)}>{!selected.total_checks||selected.uptime_percentage==null?'Sin mediciones':`${formatMetric(selected.uptime_percentage,2)}% disponible por comprobaciones`}</p>{selected.total_checks>0&&<p>{selected.total_checks} comprobaciones · {selected.down_checks} fallidas{finite(selected.avg_latency)?` · ${formatMetric(selected.avg_latency)} ms de media`:''}</p>}</div>}
 <footer className="flex justify-between text-xs text-text-dim"><span>Hace 30 días</span><span>Hoy</span></footer>
 </section>;
}
