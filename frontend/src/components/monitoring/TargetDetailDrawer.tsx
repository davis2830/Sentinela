import { TargetDiagnostic, latestTargetCheck } from './TargetLatency';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Globe, Server, Plug, Lock, Activity, Clock, AlertTriangle, MoreHorizontal, Download, Bell, Pencil } from 'lucide-react';
import { useConnectivityRefresh } from '../../hooks/useConnectivityRefresh';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import ScanAction from '../common/ScanAction';
import AdminButton from '../common/AdminButton';
import MetricCard from '../common/MetricCard';
import LatencyChart from './LatencyChart';
import { finite, formatMetric, uptimeTone, latencyTone } from '../../utils/endpointPresentation';
import { resourceDate } from '../../utils/resourcePresentation';
import type { MonitoringTarget, MonitoringCheck, TimeseriesData } from '../../types/monitoring';

const icons: Record<string, typeof Globe> = {http:Globe, https:Globe, tcp:Server, dns:Globe, api:Plug, ssl:Lock};
const states: Record<string, [string,string]> = {up:['Operacional','success'],slow:['Degradado','warning'],down:['Caído','danger'],error:['Error','danger']};
interface Props {
 target:MonitoringTarget; onClose:()=>void; onScan:(target:MonitoringTarget)=>void|Promise<unknown>;
 onEdit:(target:MonitoringTarget)=>void; onAlert:(target:MonitoringTarget)=>void;
 onExport:(id:string,name:string)=>void; isScanning:boolean;
}
export default function TargetDetailDrawer({target,onClose,onScan,onEdit,onAlert,onExport,isScanning}:Props) {
 const dialogRef=useDialogFocus(true);
 const location=useLocation(); const organizationId=useAuthStore(s=>s.user?.organization?.id);
 const refresh=useConnectivityRefresh();
 useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[onClose]);
 const telemetry=useQuery<TimeseriesData>({queryKey:['target-timeseries',organizationId,target.id,'24h'],queryFn:async()=>(await api.get(`monitoring/${target.id}/timeseries/`,{params:{period:'24h'}})).data.data,refetchInterval:refresh.refetchInterval,refetchOnWindowFocus:false});
 const checks=useQuery<MonitoringCheck[]>({queryKey:['drawer-checks',organizationId,target.id],queryFn:async()=>{const data=(await api.get(`monitoring/${target.id}/checks/`,{params:{limit:3}})).data.data;return Array.isArray(data)?data:[];},refetchInterval:refresh.refetchInterval,refetchOnWindowFocus:false});
 const summary=telemetry.isError?null:telemetry.data?.summary;
 const measured=Boolean(summary&&summary.total_checks>0);
 const failedCurrent=['down','error'].includes(target.last_status||'');
 const currentMeasured=Boolean(target.last_checked_at&&Number.isFinite(Date.parse(target.last_checked_at)));
 const [status,tone]=!target.enabled?['Pausado','muted']:currentMeasured?(states[target.last_status||'']||['Sin datos','muted']):['Sin datos','muted'];
 const Icon=icons[target.target_type]||Globe;
 const full=['http','https'].includes(target.target_type);
 const url=(tab='summary')=>`/monitoring/${target.id}?returnTo=${encodeURIComponent(location.pathname+location.search)}&tab=${tab}`;
 const recent=checks.isError?[]:[...(checks.data||[])].sort((a,b)=>Date.parse(b.checked_at)-Date.parse(a.checked_at)).slice(0,3);
 const failed=recent.find(c=>['down','error'].includes(c.status));
 const failure=failed?.details?.error||failed?.details?.error_message;
 const offline=target.runner_type==='agent'&&(target.agent_probe_online===false||target.agent_probe_status==='offline');
 const content=<div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-end" onClick={onClose}>
 <div role="dialog" aria-modal="true" aria-label={target.name} ref={dialogRef} tabIndex={-1} className="endpoint-quick-panel" onClick={e=>e.stopPropagation()}>
 <header className="quick-panel-header"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Icon size={22} className="text-text-muted shrink-0"/><h2 className="text-xl font-bold break-all">{target.name}</h2><span className="ui-status" data-tone={tone}>{status}</span></div><p className="text-sm text-text-dim break-all mt-1">{target.endpoint}</p><p className="text-xs text-text-muted mt-2">{target.target_type.toUpperCase()} · Cada {target.interval} s · Última medición: {resourceDate(target.last_checked_at)}</p></div><button className="ui-button ui-button-icon shrink-0" onClick={onClose} aria-label="Cerrar panel"><X size={20}/></button></header>
 <div className="quick-panel-body">
 <div className="flex flex-wrap items-center gap-2"><ScanAction resource={target} route="monitoring" pending={isScanning} onScan={()=>onScan(target)}/>{full&&<Link className="ui-button ui-button-secondary" to={url()}>Abrir vista completa del endpoint →</Link>}
 <details className="quick-panel-actions"><summary className="ui-button" aria-label="Más acciones"><MoreHorizontal size={18}/><span>Más</span></summary><div className="quick-panel-action-list"><button className="ui-button" onClick={()=>onExport(target.id,target.name)}><Download size={16}/>Exportar CSV</button><AdminButton className="ui-button" onClick={()=>onAlert(target)}><Bell size={16}/>Crear alerta</AdminButton><AdminButton className="ui-button" onClick={()=>onEdit(target)}><Pencil size={16}/>Editar</AdminButton>{full&&<Link className="ui-button" to={url('config')}>Configurar cobertura</Link>}</div></details></div>
 <div className="endpoint-metric-strip quick-panel-metrics">
 <MetricCard compact label="Disponibilidad" value={measured&&finite(summary?.uptime_percentage)?formatMetric(summary.uptime_percentage,2):'—'} unit={measured?'%':undefined} caption="Últimas 24 h" icon={Activity} tone={measured?uptimeTone(summary?.uptime_percentage):'muted'}/>
 <MetricCard compact label="Latencia actual" value={!failedCurrent&&currentMeasured&&finite(target.last_latency)?formatMetric(target.last_latency):'—'} unit={!failedCurrent&&currentMeasured&&finite(target.last_latency)?'ms':undefined} caption={finite(target.max_latency_ms)?`Límite actual: ${formatMetric(target.max_latency_ms)} ms`:'Límite sin configurar'} icon={Clock} tone={!failedCurrent&&currentMeasured?latencyTone(target.last_latency,target.max_latency_ms,target.last_status):'muted'}/>
 <MetricCard compact label="Interrupciones" value={measured&&finite(summary?.incidents_count)?formatMetric(summary.incidents_count):'—'} caption="Últimas 24 h · estimadas" icon={AlertTriangle} tone={measured&&summary?.incidents_count?'danger':'muted'}/>
 </div>
 <TargetDiagnostic target={target}/>

 {offline&&<p role="alert" className="quick-panel-attention">Guardián {target.agent_probe_name||'Senti9'} desconectado. Sin telemetría reciente.</p>}
 {telemetry.isLoading?<p role="status">Cargando mediciones…</p>:telemetry.isError||!summary?<div role="alert" className="ui-card"><p>Datos no disponibles. No pudimos consultar las mediciones.</p><button className="ui-button" onClick={()=>void telemetry.refetch()}>Volver a consultar historial</button></div>:!measured?<p className="ui-card text-sm text-text-muted">Sin mediciones en las últimas 24 h.</p>:<LatencyChart compact preview timeseries={telemetry.data?.timeseries||[]} summary={summary} period="24h" thresholdMs={target.max_latency_ms??null} periodControl={<span className="text-xs text-text-muted">24 h</span>}/>}
 {failed&&<div className="quick-panel-attention"><p className="font-semibold text-sm">Último fallo entre las comprobaciones recientes</p><p className="text-xs mt-1 break-words">{resourceDate(failed.checked_at)} · {typeof failure==='string'?failure:'Sin diagnóstico registrado.'}</p></div>}
 <section aria-label="Comprobaciones recientes" className="quick-panel-checks"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold text-sm">Últimas comprobaciones</h3>{full&&<Link className="text-sm text-accent-cyan" to={url('availability')}>Ver historial →</Link>}</div>
 {checks.isLoading?<p role="status">Consultando…</p>:checks.isError?<div role="alert"><p>Historial no disponible.</p><button className="ui-button" onClick={()=>void checks.refetch()}>Reintentar</button></div>:!recent.length?<p className="text-sm text-text-muted">Sin comprobaciones registradas.</p>:recent.map(c=>{const [label,checkTone]=states[c.status]||['Sin estado','muted'];return <div className="quick-panel-check" key={c.id}><time>{resourceDate(c.checked_at)}</time><span className="ui-status" data-tone={checkTone}>{label}</span><strong className="tabular-nums ui-tone" data-tone={['down','error'].includes(c.status)?'muted':latencyTone(c.latency,target.max_latency_ms,c.status)}>{['down','error'].includes(c.status)?'—':finite(c.latency)?`${formatMetric(c.latency)} ms`:'Sin latencia'}</strong></div>;})}
 </section>
 {full&&<nav aria-label="Detalle del endpoint" className="flex flex-wrap gap-4 text-sm text-accent-cyan"><Link to={url('availability')}>Ver disponibilidad →</Link><Link to={url('config')}>Ver configuración →</Link></nav>}
 {!full&&<details className="ui-card text-sm"><summary className="cursor-pointer">Detalles del monitoreo</summary><dl className="grid grid-cols-2 gap-3 mt-3"><div><dt>Método</dt><dd>{target.http_method||'—'}</dd></div><div><dt>Código esperado</dt><dd>{target.expected_status??'—'}</dd></div><div><dt>Umbral</dt><dd>{target.max_latency_ms==null?'Sin configurar':`${target.max_latency_ms} ms`}</dd></div></dl></details>}
 {failedCurrent&&finite(target.last_latency)&&<details className="text-xs text-text-muted"><summary className="min-h-9 cursor-pointer flex items-center">Detalles del intento fallido</summary><p>Tiempo del intento: {formatMetric(target.last_latency)} ms</p><p>Límite aplicado: {finite(latestTargetCheck(target)?.applied_max_latency_ms)?`${formatMetric(latestTargetCheck(target)!.applied_max_latency_ms!)} ms`:'No registrado'}</p></details>}
 {target.runner_type==='agent'&&!offline&&<p className="text-xs text-text-muted">Ejecutor: {target.agent_probe_name||'Guardián Senti9'} · Red interna</p>}
 </div></div></div>;
 return typeof document==='undefined'?null:createPortal(content,document.body);
}
