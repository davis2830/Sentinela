import { useState } from 'react';
import type { MonitoringCheck } from '../../types/monitoring';
import { resourceDate } from '../../utils/resourcePresentation';
import { finite, formatMetric } from '../../utils/endpointPresentation';
const states: Record<string, [string,string]> = {up:['Operacional','success'],slow:['Degradado','warning'],down:['Caído','danger'],error:['Error','danger']};
export default function RecentChecks({checks,loading,error,onRetry}:{checks:MonitoringCheck[];loading:boolean;error:boolean;onRetry:()=>void}) {
 const [filter,setFilter]=useState('all'); const [limit,setLimit]=useState(5);
 const filtered=[...checks].sort((a,b)=>Date.parse(b.checked_at)-Date.parse(a.checked_at)).filter(c=>filter==='all'||(filter==='failed'?['down','error'].includes(c.status):c.status===filter));
 return <section className="ui-card space-y-3" aria-label="Últimas comprobaciones">
 <header className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">Últimas comprobaciones</h3><span className="text-xs text-text-muted">Últimos {checks.length} registros</span></header>
 {error?<div role="alert">Historial no disponible. <button className="ui-button" onClick={onRetry}>Reintentar</button></div>:loading?<p role="status">Consultando…</p>:!checks.length?<p>Sin comprobaciones registradas.</p>:<>
 <label className="flex items-center gap-3 text-sm">Estado<select className="bg-bg-dark border border-border-base rounded-lg p-2 min-h-11" aria-label="Filtrar comprobaciones por estado" value={filter} onChange={e=>{setFilter(e.target.value);setLimit(5);}}><option value="all">Todos</option><option value="failed">Fallidas</option><option value="slow">Degradadas</option><option value="up">Operacionales</option></select></label>
 {!filtered.length&&<p className="text-sm text-text-muted">Sin coincidencias en los registros cargados.</p>}
 {filtered.slice(0,limit).map(c=>{const [label,tone]=states[c.status]||['Sin estado','muted'];const diagnostic=c.details?.error||c.details?.error_message;return <details className="availability-event" key={c.id}>
 <summary><span className="availability-event-title"><time>{resourceDate(c.checked_at)}</time><span className="ui-status" data-tone={tone}>{label}</span></span><strong className="text-2xl tabular-nums whitespace-nowrap ui-tone" data-tone={finite(c.latency)?tone:'muted'}>{finite(c.latency)?<>{formatMetric(c.latency)} <small className="text-xs">ms</small></>:<small className="text-xs">Sin latencia</small>}</strong></summary>
 <div className="availability-event-detail"><p>Tiempo del intento: {finite(c.latency)?`${formatMetric(c.latency)} ms`:'No disponible'}</p><p>Límite aplicado: {finite(c.applied_max_latency_ms)?`${formatMetric(c.applied_max_latency_ms)} ms`:'No registrado'}</p><p>{typeof c.details?.status_code==='number'?`HTTP ${c.details.status_code}`:'Sin código HTTP registrado.'}</p><p>{typeof diagnostic==='string'?diagnostic:'Sin diagnóstico adicional.'}</p></div></details>;})}
 <footer className="flex items-center gap-3 text-xs"><span>{Math.min(limit,filtered.length)} de {filtered.length}</span>{filtered.length>limit&&<button className="ui-button" onClick={()=>setLimit(limit+5)}>Ver más</button>}{limit>5&&<button className="ui-button" onClick={()=>setLimit(5)}>Ver menos</button>}</footer>
 </>}
 </section>;
}
