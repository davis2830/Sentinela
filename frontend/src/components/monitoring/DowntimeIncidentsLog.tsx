import { useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import type { DowntimeIncident } from '../../types/monitoring';
import { resourceDate } from '../../utils/resourcePresentation';
export default function DowntimeIncidentsLog({incidents,period}:{incidents:DowntimeIncident[];period:'24h'|'7d'|'30d'}) {
 const [expanded,setExpanded]=useState(false);
 const ordered=[...incidents].sort((a,b)=>Date.parse(b.started_at)-Date.parse(a.started_at));
 return <section className="ui-card space-y-3" aria-label="Bitácora de interrupciones">
 <header className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold flex items-center gap-2"><AlertTriangle size={18}/>Bitácora de interrupciones</h3><span className="text-xs text-text-muted">{period} · {incidents.length} registradas</span></header>
 {!ordered.length?<p className="text-sm text-text-muted py-3">Sin interrupciones registradas en este período.</p>:<>
 <p className="text-xs text-text-muted">Duración e intervalo estimados a partir de las comprobaciones.</p>
 {(expanded?ordered:ordered.slice(0,5)).map(i=><details className="availability-event" key={i.id}><summary><span className="availability-event-title"><span className="ui-status" data-tone="danger">Interrupción</span><time>{resourceDate(i.started_at)}</time></span><strong className="flex items-center gap-2 text-xl whitespace-nowrap"><Clock size={14}/>{i.duration_formatted||'—'}</strong></summary>
 <div className="availability-event-detail"><dl className="grid sm:grid-cols-2 gap-3 mb-3"><div><dt>Inicio</dt><dd>{resourceDate(i.started_at)}</dd></div><div><dt>Fin del intervalo estimado</dt><dd>{resourceDate(i.resolved_at)}</dd></div><div><dt>Comprobaciones fallidas</dt><dd>{i.checks_failed}</dd></div>{i.status_code!=null&&<div><dt>HTTP</dt><dd>{i.status_code}</dd></div>}</dl><p>{i.error_message||'Sin diagnóstico registrado.'}</p></div></details>)}
 {ordered.length>5&&<button className="ui-button" onClick={()=>setExpanded(!expanded)}>{expanded?'Ver menos':`Ver las ${ordered.length} interrupciones`}</button>}
 </>}
 </section>;
}
