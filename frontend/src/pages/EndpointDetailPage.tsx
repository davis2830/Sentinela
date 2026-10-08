import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Globe, ShieldCheck, AlertTriangle, Clock } from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useConnectivityRefresh } from '../hooks/useConnectivityRefresh';
import AutomaticRefreshControl from '../components/common/AutomaticRefreshControl';
import ScanAction from '../components/common/ScanAction';
import ReloadDataButton from '../components/common/ReloadDataButton';
import LatencyChart from '../components/monitoring/LatencyChart';
import UptimeAvailabilityBar from '../components/monitoring/UptimeAvailabilityBar';
import DowntimeIncidentsLog from '../components/monitoring/DowntimeIncidentsLog';
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
const stamp = (r:CoverageResource) => r.last_scanned_at || r.last_checked_at;
const date = (v:unknown) => typeof v==='string' && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleString() : 'Sin medición';
const value = (v:unknown):string => v==null || v==='' ? 'No disponible' : typeof v==='boolean' ? v?'Sí':'No' : Array.isArray(v) ? v.length?v.map(value).join(' · '):'Sin valores registrados' : typeof v==='object' ? Object.entries(v).map(([key,item])=>`${key}: ${value(item)}`).join('\n')||'Sin valores registrados' : String(v);
const sectionLabel = (s:CoverageSection) => ({linked:'Cobertura vinculada',unlinked:s.candidates.length?'Confirma la asociación':'No configurado',needs_review:'Revisar asociación',not_applicable:'No aplica'})[s.status];
function StateMessage({section}:{section:CoverageSection}) {
  return <div role="status" className="rounded-xl border border-border-base bg-bg-card p-5 text-sm text-text-muted">
    <p className="font-semibold text-text-main">{sectionLabel(section)}</p>
    <p className="mt-2">{section.status==='not_applicable'?'Esta cobertura no corresponde al protocolo o a la ejecución Sentinine. No se ejecutan consultas Cloud sobre recursos privados.':section.status==='needs_review'?'El endpoint o el recurso cambió. La asociación anterior no se utiliza; confirma una coincidencia válida en Configuración.':section.candidates.length?'Hay recursos configurados que podrían corresponder a este endpoint. Un administrador debe confirmar la asociación en Configuración antes de mostrar sus resultados.':'No hay un recurso vinculado. Puedes configurarlo en su módulo y después asociarlo aquí; abrir esta ficha no crea recursos ni inicia escaneos.'}</p>
  </div>;
}

function CoverageEditor({module,section,onSaved,allowed}:{module:CoverageModule;section:CoverageSection;onSaved:()=>void;allowed:boolean}) {
  const {targetId}=useParams();
  const [ids,setIds]=useState(section.resources.map(r=>r.id));
  const [pending,setPending]=useState(false); const [error,setError]=useState('');
  return <section className="dashboard-panel space-y-3" aria-label={`Asociación ${meta[module].title}`}>
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
  return <section className="dashboard-panel space-y-3"><h3 className="text-sm font-semibold">{module==='dns'?'Cambios DNS recientes':'Última evaluación de cabeceras'}</h3>
    {module==='dns'?query.data.map((r,i)=><div key={String(r.id||i)} className="border-b border-border-base py-2 text-sm break-words"><p className="text-xs text-text-muted">{date(r.changed_at)}</p><p>{value(r.old_value)} → {value(r.new_value)}</p></div>):<>
      <p className="text-xs text-text-muted">Evaluación: {date(query.data[0].checked_at)}</p>
      <dl className="space-y-3 text-sm">{['headers_found','headers_missing','directives_analysis','info_leaks','error_message'].map(key=><div key={key}><dt className="text-text-muted">{{headers_found:'Cabeceras presentes',headers_missing:'Cabeceras ausentes',directives_analysis:'Análisis de directivas',info_leaks:'Fugas detectadas',error_message:'Error de medición'}[key]}</dt><dd className="mt-1 break-all whitespace-pre-wrap">{value(query.data![0][key])}</dd></div>)}</dl>
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
  if(targetQuery.isError||!target)return <div className="dashboard-panel space-y-4"><h1 className="text-xl font-semibold">Endpoint no disponible</h1><p className="text-text-muted">No se pudo consultar o no pertenece a tu organización.</p><button onClick={()=>targetQuery.refetch()} className="text-accent-green">Reintentar</button><Link to="/monitoring" className="block text-sm text-accent-cyan">Volver a Monitoring</Link></div>;
  const effectiveInterval=refresh.ready?Math.max(target.interval,refresh.intervalSeconds):null;
  const state=!target.enabled?'Pausado':!target.last_checked_at?'Sin mediciones':({up:'Operacional',down:'Caído',error:'Error',slow:'Degradado'}[target.last_status||'']||'Sin datos');
  const problems:string[]=[];
  if(coverage){
    for(const incident of coverage.activity.incidents.filter(i=>!['resolved','closed'].includes(i.status)))problems.push(`Incidente activo: ${incident.title}`);
    for(const alert of coverage.activity.alerts.filter(a=>a.status!=='resolved'&&!coverage.activity.incidents.some(i=>i.id===a.incident_id)))problems.push(`Alerta: ${alert.title}`);
  }
  if(target.enabled&&['down','error','slow'].includes(target.last_status||''))problems.push(`Disponibilidad: ${state}`);
  if(coverage)for(const module of Object.keys(meta) as CoverageModule[])for(const r of coverage.sections[module].resources){
    if(!stamp(r))continue;
    if(r.error_message)problems.push(`${meta[module].title}: error en la última medición`);
    else if(module==='ssl'&&(r.is_valid===false||typeof r.days_remaining==='number'&&r.days_remaining<=30))problems.push(`SSL: ${r.is_valid===false?'certificado inválido':`${r.days_remaining} días de vigencia`}`);
    else if(module==='domain'&&(r.is_locked===false||typeof r.days_until_expiration==='number'&&r.days_until_expiration<=30))problems.push(`Dominio: ${r.is_locked===false?'sin bloqueo de transferencia':`${r.days_until_expiration} días de vigencia`}`);
    else if(module==='security'&&(r.info_leak_detected===true||typeof r.last_score==='number'&&r.last_score<70))problems.push(`Seguridad: ${r.info_leak_detected?'fuga detectada':`score ${r.last_score}/100`}`);
    else if(module==='dns'&&typeof r.last_change_at==='string'&&Date.now()-Date.parse(r.last_change_at)<86400000)problems.push('DNS: cambio detectado en las últimas 24 horas');
  }
  const choose=(next:Tab)=>setParams(p=>{const n=new URLSearchParams(p);n.set('tab',next);return n;});
  const requestedBack=params.get('returnTo')||'';
  const back=/^\/(monitoring|dashboard|gestion)(\?|$)/.test(requestedBack)?requestedBack:'/monitoring';
  return <div data-testid="endpoint-dossier" className="compact-workspace space-y-5 min-w-0">
    <header className="space-y-3 border-b border-border-base pb-4">
      <Link to={back} className="inline-flex items-center gap-2 text-sm text-text-muted"><ArrowLeft size={16}/>Volver al listado</Link>
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h1 className="flex items-center gap-2 text-xl font-semibold"><Globe size={22} className="text-accent-cyan"/>{target.name}</h1><p className="mt-2 text-sm text-text-muted break-all">{target.endpoint}</p><p className="mt-2 text-xs text-text-muted">{state} · {effectiveInterval==null?'Frecuencia no disponible':`cada ${effectiveInterval>=60?`${effectiveInterval/60} min`:`${effectiveInterval} s`}`} · {target.runner_type==='agent'?`Sentinine: ${target.agent_probe_name||'Agente asignado'}`:'Sentinel Cloud'} · Última medición: {date(target.last_checked_at)}</p></div>
        <div className="flex flex-wrap items-center gap-3"><AutomaticRefreshControl {...refresh} onToggle={refresh.toggle} /><ReloadDataButton queryKeys={['endpoint-target','endpoint-coverage','endpoint-timeseries','endpoint-checks','endpoint-resource-history']} scanIntervalSeconds={refresh.intervalSeconds}/></div>
      </div>
      <ScanAction route="monitoring" resource={target} pending={pending.has(`monitoring:${target.id}`)} onScan={()=>scan('monitoring',target)}/>
    </header>
    {!supported?<div className="dashboard-panel"><p className="text-sm text-text-muted">Esta ficha integral está disponible para HTTP/HTTPS. Para este protocolo, utiliza su detalle operativo; no se asocian coberturas web automáticamente.</p><Link to={`/monitoring?resource=${target.id}`} className="text-accent-cyan text-sm">Abrir detalle operativo</Link></div>:<>
      <nav aria-label="Secciones del endpoint" className="flex flex-wrap gap-1 border-b border-border-base pb-2">{tabs.map(t=><button type="button" key={t} aria-current={tab===t?'page':undefined} onClick={()=>choose(t)} className={`rounded-lg px-3 py-2 text-sm ${tab===t?'bg-accent-green/10 text-accent-green border border-accent-green/30':'text-text-muted hover:bg-bg-card'}`}>{labels[t]}</button>)}</nav>
      {coverageQuery.isError&&<div role="status" className="flex items-start gap-2 rounded-xl border border-accent-yellow/30 bg-accent-yellow/10 p-3 text-sm text-accent-yellow"><AlertTriangle size={18} className="shrink-0"/>No se pudo consultar la cobertura. Disponibilidad e historial siguen disponibles; los datos ausentes no se consideran saludables.</div>}
      {tab==='summary'&&<>
        <section className="rounded-xl border border-border-base bg-bg-card px-4 py-3"><h2 className="flex items-center gap-2 font-semibold"><AlertTriangle size={18} className="text-accent-yellow"/>Necesita atención</h2><ul className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-1 text-sm">{problems.map((p,i)=><li key={i} className="text-accent-yellow">{p}</li>)}</ul>{!problems.length&&<p className="mt-3 text-sm text-text-muted">{coverage?'Sin problemas detectados en las mediciones disponibles. Revisa la cobertura y su frescura; los recursos sin medición no se consideran saludables.':'Cobertura todavía no disponible. No se puede concluir una salud global.'}</p>}</section>
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3" aria-label="Cobertura del endpoint">{(Object.keys(meta) as CoverageModule[]).map(module=><button key={module} onClick={()=>choose(module)} className="min-w-0 rounded-xl border border-border-base bg-bg-card p-3 text-left hover:border-border-accent"><span className="text-sm font-semibold">{meta[module].title}</span><p className="mt-2 text-xs text-text-muted">{coverage?sectionLabel(coverage.sections[module]):coverageQuery.isError?'No disponible':'Consultando…'}</p><p className="mt-1 text-xs text-text-dim break-all">{coverage?.sections[module].resources[0]&&`${value(coverage.sections[module].resources[0].domain||coverage.sections[module].resources[0].url)} · ${date(stamp(coverage.sections[module].resources[0]))}${coverage.sections[module].resources.length>1?` · +${coverage.sections[module].resources.length-1} registros`:""}`}</p></button>)}</section>
      </>}
      {(tab==='summary'||tab==='availability')&&<>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Disponibilidad y rendimiento</h2><select aria-label="Período de disponibilidad" className="rounded-lg border p-2 text-sm" value={period} onChange={e=>setPeriod(e.target.value as typeof period)}><option value="24h">Últimas 24 horas</option><option value="7d">Últimos 7 días</option><option value="30d">Últimos 30 días</option></select></div>
        {metrics.isLoading?<div role="status" className="h-56 animate-pulse bg-bg-card rounded-xl p-5">Cargando mediciones…</div>:!telemetry?<p role="status" className="dashboard-panel text-sm text-accent-yellow">No se pudo consultar la telemetría de este período.</p>:!telemetry.summary?.total_checks?<p className="dashboard-panel text-sm text-text-muted">Sin mediciones en este período. Todavía no hay datos para calcular la disponibilidad.</p>:<>
          <div className="flex flex-wrap gap-5 text-sm text-text-muted border-y border-border-base py-3"><span>Disponibilidad: <strong className="text-accent-green">{telemetry.summary.uptime_percentage}%</strong></span><span>Latencia: <strong className="text-accent-cyan">{telemetry.summary.avg_latency} ms</strong></span><span>{telemetry.summary.total_checks} comprobaciones</span></div>
          <LatencyChart timeseries={telemetry.timeseries||[]} summary={telemetry.summary} period={period}/>
          {tab==='availability'&&<><UptimeAvailabilityBar days={telemetry.daily_availability||[]} uptimePercentage={telemetry.summary.uptime_percentage}/><DowntimeIncidentsLog incidents={telemetry.incidents||[]} period={period}/></>}
        </>}
        {tab==='availability'&&<section className="dashboard-panel space-y-3"><h3 className="font-semibold">Últimas comprobaciones</h3>{checks.isError?<p className="text-sm text-accent-yellow">Historial no disponible.</p>:checks.isLoading?<p className="text-sm text-text-muted">Consultando…</p>:!checks.data?.length?<p className="text-sm text-text-muted">Sin comprobaciones registradas.</p>:checks.data.map(c=><div key={c.id} className="flex flex-wrap gap-3 justify-between border-b border-border-base py-2 text-sm"><span>{date(c.checked_at)}</span><span>{({up:'Operacional',down:'Caído',slow:'Degradado',error:'Error'}[c.status])||c.status}</span><span className="text-accent-cyan">{c.latency==null?'Sin latencia':`${c.latency} ms`}</span></div>)}</section>}
      </>}
      {(Object.keys(meta) as CoverageModule[]).includes(tab as CoverageModule)&&coverage&&(()=>{const module=tab as CoverageModule;const section=coverage.sections[module];return <div className="space-y-4"><div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold">{meta[module].title}</h2><Link to={section.resources[0]?`${meta[module].modulePath}?resource=${section.resources[0].id}`:meta[module].modulePath} className="text-sm text-accent-cyan">Abrir módulo <ExternalLink size={12} className="inline"/></Link></div>{section.status!=='linked'?<StateMessage section={section}/>:section.resources.map(r=><section key={r.id} className="space-y-4"><div className="dashboard-panel"><p className="flex items-center gap-2 text-xs text-text-muted"><Clock size={14}/>Última medición: {date(stamp(r))}</p>{!stamp(r)?<p className="mt-3 text-sm text-accent-yellow">Sin mediciones. Los valores de configuración no representan una evaluación de salud.</p>:<>{Boolean(r.error_message)&&<p role="status" className="mt-3 text-sm text-accent-red">Error de medición: {value(r.error_message)}</p>}<dl className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">{meta[module].fields.map(([key,label])=><div key={key}><dt className="text-xs text-text-muted">{label}</dt><dd className="mt-1 break-all whitespace-pre-wrap">{value(r[key])}</dd></div>)}</dl></>}<div className="mt-4"><ScanAction route={meta[module].route} resource={r} pending={pending.has(`${meta[module].route}:${r.id}`)} onScan={()=>scan(meta[module].route,r)}/></div></div><ResourceHistory module={module} resource={r} interval={interval}/></section>)}</div>;})()}
      {tab==='activity'&&coverage&&<section className="dashboard-panel space-y-4"><h2 className="font-semibold">Actividad vinculada</h2><p className="text-xs text-text-muted">Alertas, incidentes y cambios con asociación explícita. No se incluyen eventos por coincidencia de texto.</p>{coverage.activity.incidents.map(i=><Link className="block border-b border-border-base py-3 text-sm" key={i.id} to={`/incidents?resource=${i.id}`}><strong>{i.title}</strong><p className="mt-1 text-text-muted">{i.status} · {date(i.opened_at)}</p></Link>)}{coverage.activity.alerts.filter(a=>!coverage.activity.incidents.some(i=>i.id===a.incident_id)).map(a=><Link className="block border-b border-border-base py-3 text-sm" key={a.id} to={`/alerts?resource=${a.id}`}><strong>{a.title}</strong><p className="mt-1 text-text-muted">{a.severity} · {a.status} · {date(a.triggered_at)}</p></Link>)}{coverage.activity.changes.map(c=><div key={c.id} className="border-b border-border-base py-3 text-sm"><p>{c.description}</p><p className="mt-1 text-xs text-text-muted">{date(c.timestamp)}</p></div>)}{!coverage.activity.alerts.length&&!coverage.activity.incidents.length&&!coverage.activity.changes.length&&<p className="text-sm text-text-muted">Sin actividad vinculada registrada.</p>}</section>}
      {tab==='config'&&<div className="space-y-4"><section className="dashboard-panel space-y-2"><h2 className="font-semibold">Cobertura del endpoint</h2><p className="text-sm text-text-muted">Vincular no crea recursos ni ejecuta comprobaciones. Desvincular no borra el recurso del módulo.</p><Link to={`/monitoring?resource=${target.id}`} className="text-sm text-accent-cyan">Abrir ajustes operativos del target</Link>{!canManage&&<p className="text-xs text-text-muted">Solo un administrador puede modificar asociaciones.</p>}</section>{coverage&&(Object.keys(meta) as CoverageModule[]).map(module=>canManage?<CoverageEditor key={`${target.id}:${module}`} module={module} section={coverage.sections[module]} onSaved={refreshCoverage} allowed={refresh.subscription?.monitoring_allowed===true}/>:<section className="dashboard-panel" key={module}><h3 className="font-semibold">{meta[module].title}</h3><p className="mt-2 text-sm text-text-muted">{sectionLabel(coverage.sections[module])}</p></section>)}</div>}
      {coverageQuery.isLoading&&tab!=='summary'&&tab!=='availability'&&<p role="status" className="dashboard-panel text-sm text-text-muted">Consultando cobertura…</p>}
      <p className="flex items-center gap-2 text-xs text-text-dim"><ShieldCheck size={14}/>Cada sección conserva su última medición y límite de comprobación. Abrir o recargar esta ficha solo consulta datos guardados.</p>
    </>}
  </div>;
}
