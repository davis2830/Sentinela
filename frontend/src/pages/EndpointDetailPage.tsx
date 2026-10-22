import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, ExternalLink, Globe, ShieldCheck, AlertTriangle, Clock, Activity, Lock, Network, Info, ChevronDown } from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useConnectivityRefresh } from '../hooks/useConnectivityRefresh';
import AutomaticRefreshControl from '../components/common/AutomaticRefreshControl';
import ScanAction from '../components/common/ScanAction';
import ReloadDataButton from '../components/common/ReloadDataButton';
import MetricCard, { type UITone } from '../components/common/MetricCard';
import { coveragePresentation, finite, formatMetric, measuredAt, securityTone, uptimeTone } from '../utils/endpointPresentation';
import LatencyChart from '../components/monitoring/LatencyChart';
import UptimeAvailabilityBar from '../components/monitoring/UptimeAvailabilityBar';
import DowntimeIncidentsLog from '../components/monitoring/DowntimeIncidentsLog';
import RecentChecks from '../components/monitoring/RecentChecks';
import EndpointResourcePanel from '../components/monitoring/EndpointResourcePanel';
import EndpointActivityPanel from '../components/monitoring/EndpointActivityPanel';
import { resourceDate, resourceValue } from '../utils/resourcePresentation';
import { waitForFreshScan, type QueuedScan } from '../utils/scanPolling';
import type { MonitoringTarget, TimeseriesData, MonitoringCheck } from '../types/monitoring';
import type { CoverageModule, CoverageResource, CoverageSection, EndpointCoverage } from '../types/endpoint';

const meta: Record<CoverageModule, {title:string; route:string; modulePath:string; fields:[string,string][]}> = {
  ssl:{title:'SSL / TLS',route:'ssl-certificates',modulePath:'/ssl',fields:[['domain','Hostname'],['port','Puerto'],['issuer','Emisor'],['subject','Titular'],['is_valid','Certificado válido'],['expiration_date','Vencimiento'],['days_remaining','Días restantes'],['issued_at','Emitido'],['tls_version','Versión TLS'],['algorithm','Algoritmo'],['security_grade','Evaluación'],['fingerprint','Huella'],['san_domains','Nombres alternativos']]},
  dns:{title:'DNS',route:'dns-records',modulePath:'/dns',fields:[['domain','Hostname'],['record_type','Tipo'],['value','Valor registrado'],['ttl','TTL (segundos)'],['response_time_ms','Respuesta (ms)'],['last_change_at','Último cambio detectado']]},
  domain:{title:'Dominio / WHOIS',route:'domains',modulePath:'/domains',fields:[['domain','Dominio WHOIS configurado'],['registrar','Registrador'],['expiration_date','Vencimiento'],['days_until_expiration','Días restantes'],['creation_date','Registrado'],['last_updated','Actualizado en registro'],['is_locked','Dominio bloqueado'],['status','Estados del registro'],['name_servers','Servidores de nombres'],['registrant_country','País'],['dnssec','DNSSEC'],['whois_server','Servidor WHOIS']]},
  security:{title:'Seguridad web',route:'security-headers',modulePath:'/security-headers',fields:[['url','URL evaluada'],['last_score','Score / 100'],['last_grade','Evaluación'],['has_hsts','HSTS'],['has_csp','Content Security Policy'],['has_xfo','Protección de frames'],['info_leak_detected','Fuga de información'],['last_response_time_ms','Respuesta (ms)'],['server_header','Servidor declarado'],['powered_by_header','Tecnología declarada']]},
};
const tabs = ['summary','availability','ssl','dns','domain','security','activity','config'] as const;
type Tab = typeof tabs[number];
const labels: Record<Tab,string> = {summary:'Resumen',availability:'Disponibilidad',ssl:'SSL / TLS',dns:'DNS',domain:'Dominio',security:'Seguridad web',activity:'Actividad',config:'Configuración'};
const moduleIcons = { ssl: Lock, dns: Network, domain: Globe, security: ShieldCheck };
const date = (v:unknown) => typeof v==='string' && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleString() : 'Sin medición';
const sectionLabel = (s:CoverageSection) => ({linked:'Cobertura vinculada',unlinked:s.candidates.length?'Confirma la asociación':'No configurado',needs_review:'Revisar asociación',not_applicable:'No aplica'})[s.status];
function StateMessage({section}:{section:CoverageSection}) {
  return <div role="status" className="rounded-xl border border-border-base bg-bg-card p-5 text-sm text-text-muted">
    <p className="font-semibold text-text-main">{sectionLabel(section)}</p>
    <p className="mt-2">{section.status==='not_applicable'?'Esta cobertura no corresponde al protocolo o a la ejecución Senti9. No se ejecutan consultas Cloud sobre recursos privados.':section.status==='needs_review'?'El endpoint o el recurso cambió. La asociación anterior no se utiliza; confirma una coincidencia válida en Configuración.':section.candidates.length?'Hay recursos configurados que podrían corresponder a este endpoint. Un administrador debe confirmar la asociación en Configuración antes de mostrar sus resultados.':'No hay un recurso vinculado. Puedes configurarlo en su módulo y después asociarlo aquí; abrir esta ficha no crea recursos ni inicia escaneos.'}</p>
  </div>;
}

function CoverageEditor({module,section,onSaved,allowed}:{module:CoverageModule;section:CoverageSection;onSaved:()=>void;allowed:boolean}) {
  const {targetId}=useParams();
  const [ids,setIds]=useState(section.resources.map(r=>r.id));
  const [pending,setPending]=useState(false); const [error,setError]=useState('');
  return <section className="ui-card space-y-3" aria-label={`Asociación ${meta[module].title}`}>
    <h3 className="font-semibold">{meta[module].title}</h3>
    <p className="text-xs text-text-muted">{module==='domain'?'Elige el dominio registrable que tienes configurado. No se deduce recortando etiquetas del hostname ni se activa WHOIS automáticamente.':module==='security'?'Coincidencia de URL, ruta y parámetros; no se mezclan otras rutas.':module==='ssl'?'Coincidencia de hostname y puerto.':'Solo registros del hostname exacto; puedes asociar varios tipos.'}</p>
    {section.status==='not_applicable'?<p className="text-xs text-text-muted">No aplica</p>:<>
      {module==='dns'?<div className="space-y-2">{section.candidates.map(c=><label key={c.id} className="flex items-start gap-2 text-sm break-all"><input type="checkbox" checked={ids.includes(c.id)} onChange={e=>setIds(e.target.checked?[...ids,c.id]:ids.filter(id=>id!==c.id))}/>{c.label}</label>)}</div>:<select aria-label={`Recurso ${meta[module].title}`} className="w-full rounded-lg border p-2 text-sm" value={ids[0]||''} onChange={e=>setIds(e.target.value?[e.target.value]:[])}><option value="">Sin asociación</option>{section.candidates.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select>}
      {!section.candidates.length&&<p className="text-xs text-text-muted">Sin coincidencias configuradas.</p>}
      {section.candidates_truncated&&<p className="text-xs text-accent-yellow">Se muestran las primeras 50 coincidencias. Revisa el módulo para reducir duplicados.</p>}
      {error&&<p role="alert" className="text-sm text-accent-red">{error}</p>}
      <button type="button" disabled={pending||!allowed} className="rounded-lg border border-accent-green/40 px-3 py-2 text-sm text-accent-green disabled:opacity-50" onClick={async()=>{
        setPending(true);setError('');
        try {await api.patch(`monitoring/${targetId}/coverage/`,{[module]:ids});onSaved();}
        catch {setError('No se pudo guardar. Recarga las coincidencias y verifica que tu suscripción esté vigente.');}
        finally {setPending(false);}
      }}>{pending?'Guardando…':'Guardar asociación'}</button>
      {!allowed&&<p className="text-xs text-accent-yellow">Necesitas una suscripción vigente para modificar la cobertura.</p>}
    </>}
    <Link to={meta[module].modulePath} className="inline-flex items-center gap-2 text-xs text-accent-cyan">Abrir módulo <ExternalLink size={12}/></Link>
  </section>;
}

function ResourceHistory({module,resource,interval}:{module:CoverageModule;resource:CoverageResource;interval:ReturnType<typeof useConnectivityRefresh>['refetchInterval']}) {
  const org=useAuthStore(s=>s.user?.organization?.id);
  const enabled=module==='dns'||module==='security';
  const query=useQuery<Record<string,unknown>[]>({queryKey:['endpoint-resource-history',org,module,resource.id],queryFn:async()=>{
    const res=await api.get(`${meta[module].route}/${resource.id}/${module==='dns'?'history':'results'}/`,{params:{limit:10}});
    if(!Array.isArray(res.data?.data))throw new Error('Historial no disponible');return res.data.data;
  },enabled,refetchInterval:interval});
  if(!enabled)return null;
  if(query.isLoading)return <p role="status" className="text-sm text-text-muted">Cargando detalle…</p>;
  if(query.isError)return <p role="status" className="text-sm text-accent-yellow">No se pudo consultar el historial de esta sección. Los demás datos siguen disponibles.</p>;
  if(!query.data?.length)return <p className="text-xs text-text-muted">Sin historial registrado.</p>;
  const change=(r:Record<string,unknown>,i:number)=><li key={String(r.id||i)} className="border-b border-border-base py-2 text-sm"><p className="text-xs text-text-dim">{resourceDate(r.changed_at)}</p><p className="mt-1 break-all"><span className="text-text-dim">{resourceValue(r.old_value)}</span> → {resourceValue(r.new_value)}</p></li>;
  const latest=query.data[0];
  return <section className="resource-history space-y-3" aria-label={module==='dns'?'Historial DNS':'Hallazgos de cabeceras'}><h3 className="text-sm font-semibold">{module==='dns'?'Cambios recientes':'Hallazgos de cabeceras'}</h3>
    {module==='dns'?<><ul>{query.data.slice(0,3).map(change)}</ul>{query.data.length>3&&<details><summary className="min-h-11 cursor-pointer py-3 text-xs text-accent-cyan">Ver {query.data.length-3} cambios más</summary><ul>{query.data.slice(3).map(change)}</ul></details>}</>:<>
      <p className="text-xs text-text-dim">{resourceDate(latest.checked_at)}</p>
      {latest.error_message||resourceDate(latest.checked_at)==='—'?<p role="status" className="text-sm text-accent-yellow">Evaluación no disponible: {resourceValue(latest.error_message)}</p>:<>
        <p className="text-xs font-medium text-text-dim">Cabeceras ausentes</p>
        {Array.isArray(latest.headers_missing)?latest.headers_missing.length?<ul className="flex flex-wrap gap-2">{latest.headers_missing.map((item,i)=><li key={i} className="rounded-lg border border-accent-yellow/30 bg-accent-yellow/5 px-2 py-1 text-xs text-accent-yellow break-all">{resourceValue(item)}</li>)}</ul>:<p className="text-sm">Ninguna registrada.</p>:<p className="text-xs text-text-dim">Sin datos de cabeceras ausentes.</p>}
        <details><summary className="min-h-11 cursor-pointer py-3 text-xs text-accent-cyan">Análisis completo</summary><dl className="space-y-3 text-sm">{['headers_found','headers_missing','directives_analysis','info_leaks'].map(key=><div key={key}><dt className="text-xs text-text-dim">{{headers_found:'Cabeceras presentes',headers_missing:'Cabeceras ausentes',directives_analysis:'Análisis de directivas',info_leaks:'Fugas detectadas'}[key]}</dt><dd className="mt-1 break-all whitespace-pre-wrap">{resourceValue(latest[key])}</dd></div>)}</dl></details>
      </>}
    </>}
  </section>;
}

export default function EndpointDetailPage() {
  const {targetId}=useParams(); const [params,setParams]=useSearchParams();
  const rawTab=params.get('tab');const tab:Tab=tabs.includes(rawTab as Tab)?rawTab as Tab:'summary';
  const user=useAuthStore(s=>s.user);const org=user?.organization?.id;
  const canManage=Boolean(user?.is_staff||user?.is_superuser);
  const refresh=useConnectivityRefresh();const interval=refresh.refetchInterval;
  const client=useQueryClient(); const [pending,setPending]=useState<Set<string>>(()=>new Set());
  const [period,setPeriod]=useState<'24h'|'7d'|'30d'>('24h');
  const targetQuery=useQuery<MonitoringTarget>({queryKey:['endpoint-target',org,targetId],queryFn:async()=>(await api.get(`monitoring/${targetId}/`)).data.data,enabled:Boolean(targetId&&org),refetchInterval:interval});
  const target=targetQuery.data;
  const supported=target?.target_type==='http'||target?.target_type==='https';
  const coverageQuery=useQuery<EndpointCoverage>({queryKey:['endpoint-coverage',org,targetId],queryFn:async()=>(await api.get(`monitoring/${targetId}/coverage/`)).data.data,enabled:Boolean(target&&supported),refetchInterval:interval});
  const metrics=useQuery<TimeseriesData>({queryKey:['endpoint-timeseries',org,targetId,period],queryFn:async()=>(await api.get(`monitoring/${targetId}/timeseries/`,{params:{period}})).data.data,enabled:Boolean(target&&supported),refetchInterval:interval});
  const checks=useQuery<MonitoringCheck[]>({queryKey:['endpoint-checks',org,targetId],queryFn:async()=>(await api.get(`monitoring/${targetId}/checks/`,{params:{limit:20}})).data.data,enabled:Boolean(target&&tab==='availability'),refetchInterval:interval});
  const coverage=coverageQuery.isError?undefined:coverageQuery.data;
  const telemetry=metrics.isError?undefined:metrics.data;
  const refreshCoverage=()=>{client.invalidateQueries({queryKey:['endpoint-coverage',org,targetId]});};
  const scan=async(route:string,resource:CoverageResource|MonitoringTarget)=>{
    const key=`${route}:${resource.id}`;setPending(previous=>new Set(previous).add(key));
    try {
      const queued=(await api.post(`${route}/${resource.id}/scan/`)).data.data as QueuedScan;
      const fresh=await waitForFreshScan<CoverageResource>(queued,async()=>(await api.get(`${route}/${resource.id}/`)).data.data,r=>r.last_checked_at||r.last_scanned_at);
      window.dispatchEvent(new CustomEvent('sentinel:scan-feedback',{detail:fresh?'Nueva medición recibida.':'La comprobación sigue pendiente; los resultados anteriores no se presentan como nuevos.'}));
    } finally {
      await Promise.all(['endpoint-target','endpoint-coverage','endpoint-timeseries','endpoint-checks','endpoint-resource-history'].map(key=>client.invalidateQueries({queryKey:[key,org]})));
      setPending(previous=>{const next=new Set(previous);next.delete(key);return next;});
    }
  };
  if(targetQuery.isLoading)return <div role="status" className="animate-pulse rounded-xl bg-bg-card p-8">Cargando ficha del endpoint…</div>;
  if(targetQuery.isError||!target)return <div className="dashboard-panel space-y-4"><h1 className="text-xl font-semibold">{(targetQuery.error as {response?:{status?:number}})?.response?.status===404?'Endpoint no encontrado':'Endpoint no disponible'}</h1><p className="text-text-muted">{(targetQuery.error as {response?:{status?:number}})?.response?.status===404?'El recurso fue eliminado o no está disponible para tu organización.':'No se pudo consultar. Puedes volver a intentarlo.'}</p><button onClick={()=>targetQuery.refetch()} className="text-accent-green">Reintentar</button><Link to="/monitoring" className="block text-sm text-accent-cyan">Volver a Monitoring</Link></div>;
  const effectiveInterval=refresh.ready?Math.max(target.interval,refresh.intervalSeconds):null;
  const state=!target.enabled?'Pausado':!target.last_checked_at?'Sin mediciones':({up:'Operacional',down:'Caído',error:'Error',slow:'Degradado'}[target.last_status||'']||'Sin datos');
  const problems:{id:string;title:string;detail:string;tone:UITone;tab?:Tab;href?:string}[]=[];
  const activeIncidents=coverage?.activity.incidents.filter(i=>!['resolved','closed'].includes(i.status));
  const visibleAlerts=coverage?.activity.alerts.filter(a=>a.status!=='resolved'&&!coverage.activity.incidents.some(i=>i.id===a.incident_id))||[];
  if(coverage){
    for(const incident of activeIncidents||[])problems.push({id:incident.id,title:'Incidente activo',detail:incident.title.replace(/^Incidente:\s*/i,''),tone:'danger',href:`/incidents?resource=${incident.id}`});
    for(const alert of visibleAlerts)problems.push({id:alert.id,title:alert.severity==='critical'?'Alerta crítica':alert.severity==='info'?'Información':'Alerta activa',detail:alert.title,tone:alert.severity==='critical'?'danger':alert.severity==='info'?'info':'warning',href:`/alerts?resource=${alert.id}`});
  }
  if(target.enabled&&target.last_checked_at&&['down','error','slow'].includes(target.last_status||'')&&!activeIncidents?.length)problems.push({id:'target-state',title:state,detail:'Última comprobación',tone:target.last_status==='slow'?'warning':'danger',tab:'availability'});
  if(coverage)for(const module of Object.keys(meta) as CoverageModule[])for(const r of coverage.sections[module].resources){
    if(!measuredAt(r)||coverage.sections[module].status!=='linked')continue;
    // A structured alert already represents this resource; keep its direct action.
    if(visibleAlerts.some(a=>a.target_id===r.id&&a.target_type===({ssl:'ssl',dns:'dns',domain:'domain',security:'security_headers'}[module])))continue;
    const detail=r.error_message?'Error en la última medición':module==='ssl'&&(r.is_valid===false||finite(r.days_remaining)&&r.days_remaining<=30)?r.is_valid===false?'Certificado inválido':`${r.days_remaining} días de vigencia`:module==='domain'&&(r.is_locked===false||finite(r.days_until_expiration)&&r.days_until_expiration<=30)?r.is_locked===false?'Sin bloqueo de transferencia':`${r.days_until_expiration} días de vigencia`:module==='security'&&(r.info_leak_detected===true||finite(r.last_score)&&r.last_score<70)?r.info_leak_detected?'Fuga de información':`${r.last_score}/100`:module==='dns'&&typeof r.last_change_at==='string'&&Date.now()-Date.parse(r.last_change_at)<86400000?'Cambio reciente':null;
    if(detail)problems.push({id:`${module}:${r.id}`,title:meta[module].title,detail,tone:r.error_message||module==='ssl'&&r.is_valid===false||module==='security'&&securityTone(r.last_score)==='danger'?'danger':'warning',tab:module});
  }
  problems.sort((a,b)=>({danger:0,warning:1,info:2,muted:3,success:4}[a.tone])-({danger:0,warning:1,info:2,muted:3,success:4}[b.tone]));
  const choose=(next:Tab)=>setParams(p=>{const n=new URLSearchParams(p);n.set('tab',next);return n;});
  const requestedBack=params.get('returnTo')||'';
  const back=/^\/(monitoring|dashboard|gestion)(\?|$)/.test(requestedBack)?requestedBack:'/monitoring';
  const measuredSummary=telemetry?.summary?.total_checks ? telemetry.summary : undefined;
  const uptime=measuredSummary?.uptime_percentage;
  const latency=measuredSummary?.avg_latency;
  const measuredSecurity=coverage?.sections.security.status==='linked'?coverage.sections.security.resources.filter(r=>measuredAt(r)&&!r.error_message&&securityTone(r.last_score)!=='muted'):[];
  const securityScore=measuredSecurity?.length?Math.min(...measuredSecurity.map(r=>r.last_score as number)):null;
  const currentTone:UITone=!target.enabled||!target.last_checked_at?'muted':target.last_status==='up'?'success':target.last_status==='slow'?'warning':['down','error'].includes(target.last_status||'')?'danger':'muted';
  const periodLabel={ '24h':'24 h', '7d':'7 días', '30d':'30 días' }[period];
  const renderProblem=(problem:typeof problems[number])=>{
    const content=<><AlertTriangle size={18} className="ui-tone shrink-0" aria-hidden="true"/><span className="min-w-0 flex-1"><strong className="block text-sm font-semibold">{problem.title}</strong><span className="block truncate text-xs text-text-dim" title={problem.detail}>{problem.detail}</span></span><ArrowUpRight size={17} className="shrink-0 text-text-dim" aria-hidden="true"/></>;
    const className='endpoint-attention-row flex min-w-0 items-center gap-2 rounded-lg px-1 py-2 text-left hover:bg-bg-card-hover';
    return <li key={problem.id} className="min-w-0">{problem.href?<Link to={problem.href} className={className} data-tone={problem.tone}>{content}</Link>:<button type="button" className={`${className} w-full`} data-tone={problem.tone} onClick={()=>choose(problem.tab!)}>{content}</button>}</li>;
  };
  return <div data-testid="endpoint-dossier" className="compact-workspace endpoint-workspace min-w-0">
    <header className="endpoint-header">
      <Link to={back} className="inline-flex items-center gap-2 text-sm text-text-muted"><ArrowLeft size={16}/>Volver al listado</Link>
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1 basis-64"><div className="flex flex-wrap items-center gap-3"><h1 className="flex min-w-0 items-center gap-2 text-2xl font-bold sm:text-3xl"><Globe size={26} className="shrink-0 text-accent-cyan"/><span className="break-all">{target.name}</span></h1><span className="ui-status" data-tone={currentTone} title={`Estado actual. Última medición: ${date(target.last_checked_at)}`}><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"/>{state}</span></div><p className="mt-1 break-all text-sm text-text-dim">{target.endpoint}</p></div>
        <div className="flex max-w-full flex-wrap items-start gap-2"><ScanAction primary route="monitoring" resource={target} pending={pending.has(`monitoring:${target.id}`)} onScan={()=>scan('monitoring',target)}/><AutomaticRefreshControl compact {...refresh} onToggle={refresh.toggle} /><ReloadDataButton compact queryKeys={['endpoint-target','endpoint-coverage','endpoint-timeseries','endpoint-checks','endpoint-resource-history']} scanIntervalSeconds={refresh.intervalSeconds}/></div>
      </div>
      <details className="text-xs text-text-dim"><summary className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-1"><Info size={14}/>Detalles del monitoreo<ChevronDown size={13}/></summary><dl className="mt-2 grid gap-3 rounded-xl border border-border-base p-3 sm:grid-cols-3"><div><dt>Última medición</dt><dd className="mt-1 text-text-main">{date(target.last_checked_at)}</dd></div><div><dt>Frecuencia efectiva</dt><dd className="mt-1 text-text-main">{effectiveInterval==null?'No disponible':`Cada ${effectiveInterval>=60?`${formatMetric(effectiveInterval/60, effectiveInterval%60?1:0)} min`:`${effectiveInterval} s`}`}</dd></div><div><dt>Ejecutor</dt><dd className="mt-1 text-text-main">{target.runner_type==='agent'?`Senti9 · ${target.agent_probe_name||'Agente asignado'}`:'Sentinel Cloud'}</dd></div></dl></details>
    </header>
    {!supported?<div className="dashboard-panel"><p className="text-sm text-text-muted">Esta ficha integral está disponible para HTTP/HTTPS. Para este protocolo, utiliza su detalle operativo; no se asocian coberturas web automáticamente.</p><Link to={`/monitoring?resource=${target.id}`} className="text-accent-cyan text-sm">Abrir detalle operativo</Link></div>:<>
      <nav aria-label="Secciones del endpoint" className="endpoint-tabs border-b border-border-base">{tabs.map(t=><button type="button" key={t} aria-current={tab===t?'page':undefined} onClick={()=>choose(t)} className="ui-button ui-button-secondary">{labels[t]}</button>)}</nav>
      {(tab==='summary'||tab==='availability')&&<section className="endpoint-metric-strip" aria-label="Indicadores del endpoint" data-testid="endpoint-metrics">
        <MetricCard compact label="Disponibilidad" value={uptimeTone(uptime)==='muted'?'—':formatMetric(uptime!,uptime===100?0:2)} unit={uptimeTone(uptime)==='muted'?undefined:'%'} caption={measuredSummary?`${periodLabel} · ${formatMetric(measuredSummary.total_checks)} checks`:metrics.isLoading?'Consultando…':'Sin mediciones'} icon={Activity} tone={uptimeTone(uptime)}/>
        <MetricCard compact label="Latencia media" value={finite(latency)&&latency>=0?formatMetric(latency):'—'} unit={finite(latency)&&latency>=0?'ms':undefined} caption={`${periodLabel} · Histórico`} icon={Clock} tone="muted"/>
        <MetricCard compact label="Seguridad" value={securityScore==null?'—':formatMetric(securityScore)} unit={securityScore==null?undefined:'/100'} caption={securityScore==null?'Sin evaluación':'Último análisis'} icon={ShieldCheck} tone={securityTone(securityScore)==='success'&&measuredSecurity?.some(r=>r.info_leak_detected)?'warning':securityTone(securityScore)}/>
        <MetricCard compact label="Incidentes" value={activeIncidents?String(activeIncidents.length):'—'} caption={activeIncidents?'Activos vinculados':'Sin datos'} icon={AlertTriangle} tone={activeIncidents?.length?'danger':'muted'}/>
      </section>}
      {coverageQuery.isError&&<div role="status" className="flex items-start gap-2 rounded-xl border border-accent-yellow/30 bg-accent-yellow/10 p-3 text-sm text-accent-yellow"><AlertTriangle size={18} className="shrink-0"/>No se pudo consultar la cobertura. Disponibilidad e historial siguen disponibles; los datos ausentes no se consideran saludables.</div>}
      {(tab==='summary'||tab==='availability')&&<div className={tab==='summary'?'endpoint-overview':'space-y-3'}>
      {tab==='summary'&&<aside className="endpoint-overview-side ui-card">
        <section className="endpoint-attention" aria-label="Atención del endpoint"><div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle size={18} className="text-accent-yellow"/>Necesita atención</h2>{problems.length>0&&<span className="ui-status" data-tone={problems.some(p=>p.tone==='danger')?'danger':'warning'}>{problems.length}</span>}</div><ul>{problems.slice(0,2).map(renderProblem)}</ul>{problems.length>2&&<details><summary className="min-h-9 cursor-pointer py-2 text-xs text-accent-cyan">Ver {problems.length-2} más</summary><ul>{problems.slice(2).map(renderProblem)}</ul></details>}{!problems.length&&<p className="mt-2 text-xs text-text-dim">{coverage?'Sin incidencias registradas.':'Cobertura no disponible.'}</p>}</section>
        <section className="endpoint-links" aria-label="Cobertura del endpoint"><h2 className="mb-1 text-sm font-semibold">Vínculos del endpoint</h2>{(Object.keys(meta) as CoverageModule[]).map(module=>{
          const section=coverage?.sections[module];const card=coveragePresentation(module,section);const Icon=moduleIcons[module];
          const needsLink=section&&['unlinked','needs_review'].includes(section.status);
          const configure=canManage&&needsLink&&!section.candidates.length;
          const action=configure?'Configurar':canManage&&needsLink?'Vincular':section?.status==='linked'?'Ver detalle':'Ver cobertura';
          const content=<><Icon size={18} className="ui-tone shrink-0" aria-hidden="true"/><span className="text-xs font-semibold">{meta[module].title}</span><span className="ui-tone text-right text-sm font-semibold">{card.value}</span><span className="sr-only">{card.caption} · {action}</span><ArrowUpRight size={14} className="text-text-dim" aria-hidden="true"/></>;
          return configure?<Link key={module} to={meta[module].modulePath} className="endpoint-link" data-tone={card.tone} title={`${card.caption} · ${action}`}>{content}</Link>:<button type="button" key={module} onClick={()=>choose(canManage&&needsLink?'config':module)} className="endpoint-link" data-tone={card.tone} title={`${card.caption} · ${action}`}>{content}</button>;
        })}</section>
      </aside>}
      <div className="endpoint-overview-main space-y-3 min-w-0">
        {tab==='summary'&&!telemetry?.summary?.total_checks&&<div className="flex justify-end"><select aria-label="Período de disponibilidad" className="min-h-11 rounded-lg border px-2 text-xs" value={period} onChange={e=>setPeriod(e.target.value as typeof period)}><option value="24h">Últimas 24 horas</option><option value="7d">Últimos 7 días</option><option value="30d">Últimos 30 días</option></select></div>}
        {tab==='availability'&&<div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">Rendimiento histórico</h2><select aria-label="Período de disponibilidad" className="min-h-11 rounded-lg border px-3 text-sm" value={period} onChange={e=>setPeriod(e.target.value as typeof period)}><option value="24h">Últimas 24 horas</option><option value="7d">Últimos 7 días</option><option value="30d">Últimos 30 días</option></select></div>}
        {metrics.isLoading?<div role="status" className="h-56 animate-pulse bg-bg-card rounded-xl p-5">Cargando mediciones…</div>:!telemetry?<p role="status" className="dashboard-panel text-sm text-accent-yellow">No se pudo consultar la telemetría de este período.</p>:!telemetry.summary?.total_checks?<p className="dashboard-panel text-sm text-text-muted">Sin mediciones en este período. Todavía no hay datos para calcular la disponibilidad.</p>:<>
          <LatencyChart compact={tab==='summary'} periodControl={tab==='summary'?<select aria-label="Período de disponibilidad" className="min-h-11 rounded-lg border px-2 text-xs" value={period} onChange={e=>setPeriod(e.target.value as typeof period)}><option value="24h">Últimas 24 horas</option><option value="7d">Últimos 7 días</option><option value="30d">Últimos 30 días</option></select>:undefined} timeseries={telemetry.timeseries||[]} summary={telemetry.summary} period={period} thresholdMs={target.max_latency_ms??null}/>
          {tab==='availability'&&<><UptimeAvailabilityBar days={telemetry.daily_availability||[]} uptimePercentage={telemetry.summary.uptime_percentage}/><DowntimeIncidentsLog incidents={telemetry.incidents||[]} period={period}/></>}
        </>}
        {tab==='availability'&&<RecentChecks checks={checks.data||[]} loading={checks.isLoading} error={checks.isError} onRetry={() => { void checks.refetch(); }}/>}
      </div></div>}
      {(Object.keys(meta) as CoverageModule[]).includes(tab as CoverageModule)&&coverage&&(()=>{
        const module=tab as CoverageModule;const section=coverage.sections[module];
        return <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{meta[module].title}</h2>{section.status!=='linked'&&<Link to={meta[module].modulePath} className="ui-button ui-button-secondary text-xs">Abrir módulo <ExternalLink size={14}/></Link>}</div>
          {section.status!=='linked'?<StateMessage section={section}/>:<EndpointResourcePanel key={module} module={module} modulePath={meta[module].modulePath} resources={section.resources} fields={meta[module].fields} action={r=><ScanAction route={meta[module].route} resource={r} pending={pending.has(`${meta[module].route}:${r.id}`)} onScan={()=>scan(meta[module].route,r)}/>} history={r=><ResourceHistory key={r.id} module={module} resource={r} interval={interval}/>}/>}</div>;
      })()}
      {tab==='activity'&&coverage&&<EndpointActivityPanel activity={coverage.activity}/>}
      {tab==='config'&&<div className="space-y-3"><section className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Cobertura del endpoint</h2><p className="mt-1 text-xs text-text-dim">Vincula recursos existentes del mismo endpoint.</p>{!canManage&&<p className="mt-1 text-xs text-text-dim">Solo un administrador puede modificar asociaciones.</p>}</div><Link to={`/monitoring?resource=${target.id}`} className="ui-button ui-button-secondary text-xs">Ajustes del target <ExternalLink size={14}/></Link></section><div className="endpoint-config-grid">{coverage&&(Object.keys(meta) as CoverageModule[]).map(module=>canManage?<CoverageEditor key={`${target.id}:${module}`} module={module} section={coverage.sections[module]} onSaved={refreshCoverage} allowed={refresh.subscription?.monitoring_allowed===true}/>:<section className="ui-card" key={module}><h3 className="font-semibold">{meta[module].title}</h3><p className="mt-2 text-sm text-text-muted">{sectionLabel(coverage.sections[module])}</p></section>)}</div><p className="text-xs text-text-dim">Vincular no ejecuta comprobaciones. Desvincular conserva el recurso original.</p></div>}
      {coverageQuery.isLoading&&tab!=='summary'&&tab!=='availability'&&<p role="status" className="dashboard-panel text-sm text-text-muted">Consultando cobertura…</p>}
      {tab!=='summary'&&<p className="flex items-center gap-2 text-xs text-text-dim"><ShieldCheck size={14}/>Cada sección conserva su última medición y límite de comprobación. Abrir o recargar esta ficha solo consulta datos guardados.</p>}
    </>}
  </div>;
}
