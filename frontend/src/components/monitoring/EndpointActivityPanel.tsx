import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, Bell, ArrowUpRight } from 'lucide-react';
import type { EndpointCoverage } from '../../types/endpoint';
import type { UITone } from '../common/MetricCard';
import MetricCard from '../common/MetricCard';
import { resourceDate } from '../../utils/resourcePresentation';

const states:Record<string,string>={open:'Abierto',investigating:'Investigando',identified:'Identificado',mitigated:'Mitigado',resolved:'Resuelto',closed:'Cerrado',active:'Activa',acknowledged:'Reconocida'};
interface Event {id:string;title:string;timestamp:string;state?:string;tone:UITone;href?:string}
export default function EndpointActivityPanel({activity}:{activity:EndpointCoverage['activity']}) {
  const alerts=activity.alerts.filter(a=>!activity.incidents.some(i=>i.id===a.incident_id));
  const activeIncidents=activity.incidents.filter(i=>!['resolved','closed'].includes(i.status)).length;
  const activeAlerts=alerts.filter(a=>a.status!=='resolved').length;
  const groups:{title:string;events:Event[]}[]=[
    {title:'Incidentes',events:activity.incidents.map(i=>({id:i.id,title:i.title,timestamp:i.opened_at,state:states[i.status]||i.status,tone:['resolved','closed'].includes(i.status)?'muted':'danger',href:`/incidents?resource=${i.id}`}))},
    {title:'Alertas',events:alerts.map(a=>({id:a.id,title:a.title,timestamp:a.triggered_at,state:states[a.status]||a.status,tone:a.status==='resolved'?'muted':a.severity==='critical'?'danger':a.severity==='info'?'info':'warning',href:`/alerts?resource=${a.id}`}))},
    {title:'Cambios',events:activity.changes.map(c=>({id:c.id,title:c.description,timestamp:c.timestamp,tone:'info'}))},
  ];
  const event=(e:Event)=>{
    const content=<><span className="flex min-w-0 items-start gap-2"><span className="ui-tone mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current"/><span className="min-w-0 flex-1 break-words text-sm">{e.title}</span>{e.href&&<ArrowUpRight size={15} className="shrink-0 text-text-dim"/>}</span><span className="mt-1 flex flex-wrap gap-x-2 text-xs text-text-dim"><span>{e.state}</span><span>{resourceDate(e.timestamp)}</span></span></>;
    return <li key={e.id} data-tone={e.tone} className="border-b border-border-base py-3">{e.href?<Link to={e.href} className="block rounded-lg hover:bg-bg-card-hover">{content}</Link>:<div>{content}</div>}</li>;
  };
  return <section className="space-y-3" aria-label="Actividad vinculada">
    <h2 className="text-base font-semibold">Actividad vinculada</h2>
    <div className="endpoint-metric-strip endpoint-activity-metrics">
      <MetricCard compact label="Incidentes activos" value={String(activeIncidents)} caption="Vinculados" icon={AlertTriangle} tone={activeIncidents?'danger':'muted'}/>
      <MetricCard compact label="Alertas activas" value={String(activeAlerts)} caption="Fuera de incidentes" icon={Bell} tone={activeAlerts?'warning':'muted'}/>
      <MetricCard compact label="Cambios registrados" value={String(activity.changes.length)} caption="Actividad disponible" icon={Activity} tone="muted"/>
    </div>
    <div className="endpoint-activity-columns">{groups.map(group=><section key={group.title} className="ui-card"><h3 className="text-sm font-semibold">{group.title}</h3>{!group.events.length?<p className="mt-3 text-xs text-text-dim">Sin registros vinculados.</p>:<><ul>{group.events.slice(0,3).map(event)}</ul>{group.events.length>3&&<details><summary className="min-h-11 cursor-pointer py-3 text-xs text-accent-cyan">Ver {group.events.length-3} más</summary><ul>{group.events.slice(3).map(event)}</ul></details>}</>}</section>)}</div>
  </section>;
}
