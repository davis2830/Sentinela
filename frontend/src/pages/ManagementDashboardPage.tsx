import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ArrowRight, CalendarDays, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import ReloadDataButton from '../components/common/ReloadDataButton';
import CompactModuleSummary from '../components/common/CompactModuleSummary';
import { NOCPageHeader } from '../components/common/noc';
import { activeIncident, unresolvedAlert, recentFailure, managementPending, managementAgenda } from '../utils/managementModel';
import type { Alert } from '../types/alerts';
import type { Incident } from '../types/incidents';
import type { MaintenanceWindow } from '../types/maintenance';
import type { NotificationItem } from '../types/notifications';
import type { ReportItem } from '../types/reports';
import type { StatusPageSummaryItem } from '../types/status_page';

const keys = ['management-alerts','management-incidents','management-maintenance','management-notifications','management-reports','management-pages'];
const severityLabels: Record<string,string> = {critical:'Críticas',warning:'Advertencias',info:'Informativas'};
const stateLabels: Record<string,string> = {open:'Abiertos',investigating:'Investigando',identified:'Identificados',mitigated:'Mitigados'};
const colors = ['#ff7384','#fbbf24','#38d9f5','#b499ff'];
function useManagementSource<T>(key: string, endpoint: string) {
  const organizationId = useAuthStore(s=>s.user?.organization?.id);
  return useQuery<T[]>({queryKey:[key,organizationId,'all'],queryFn:async()=>{
    const response = await api.get(endpoint); const data = response.data?.data;
    if (!Array.isArray(data)) throw new Error('Respuesta no disponible'); return data as T[];
  },refetchInterval:30000});
}
export default function ManagementDashboardPage() {
  const navigate = useNavigate();
  const alerts = useManagementSource<Alert>(keys[0],'alerts/');
  const incidents = useManagementSource<Incident>(keys[1],'incidents/');
  const maintenance = useManagementSource<MaintenanceWindow>(keys[2],'maintenance/');
  const notifications = useManagementSource<NotificationItem>(keys[3],'notifications/?status=failed');
  const reports = useManagementSource<ReportItem>(keys[4],'reports/');
  const pages = useManagementSource<StatusPageSummaryItem>(keys[5],'status-page/pages/');
  const sources = [alerts,incidents,maintenance,notifications,reports,pages];
  const now = Date.now();
  const unresolved = alerts.isError ? undefined : alerts.data?.filter(unresolvedAlert);
  const active = incidents.isError ? undefined : incidents.data?.filter(activeIncident);
  const failedNotifications = notifications.isError ? undefined : notifications.data?.filter(n=>recentFailure(n,now));
  const pending = managementPending({alerts:unresolved,incidents:active,notifications:notifications.isError?undefined:notifications.data,reports:reports.isError?undefined:reports.data},now);
  const agenda = managementAgenda(maintenance.isError?undefined:maintenance.data,now);
  const severityData = Object.entries(severityLabels).map(([key,label])=>({key,label,value:unresolved?.filter(a=>a.severity===key).length ?? 0}));
  const stateData = Object.entries(stateLabels).map(([key,label])=>({key,label,value:active?.filter(i=>i.status===key).length ?? 0}));
  const loading = sources.some(s=>s.isLoading); const partial = sources.some(s=>s.isError);
  const modules = [
    {label:'Alertas',path:'/alerts?status=unresolved',text:unresolved ? `${unresolved.length} sin resolver` : 'No disponible'},
    {label:'Incidentes',path:'/incidents?status=active',text:active ? `${active.length} activos` : 'No disponible'},
    {label:'Mantenimientos',path:'/maintenance',text:maintenance.data && !maintenance.isError ? `${agenda.length} en agenda` : 'No disponible'},
    {label:'Status Page',path:'/status-page',text:pages.data && !pages.isError ? `${pages.data.length} configuradas · ${pages.data.filter(p=>p.is_public).length} públicas` : 'No disponible'},
    {label:'Notificaciones',path:'/notifications?status=failed',text:failedNotifications ? `${failedNotifications.length} fallidas en 24 h` : 'No disponible'},
    {label:'Reportes',path:'/reports?status=failed',text:reports.data && !reports.isError ? `${reports.data.filter(r=>recentFailure(r,now)).length} fallidos en 24 h` : 'No disponible'},
  ];
  return <div className="space-y-5 min-w-0" data-testid="management-dashboard">
    <NOCPageHeader title="Resumen de gestión" description="Pendientes actuales, coordinación operativa y agenda de los próximos siete días." actions={<ReloadDataButton queryKeys={keys} />} />
    <CompactModuleSummary items={[
      {label:'Alertas sin resolver',value:unresolved?.length,onClick:()=>navigate('/alerts?status=unresolved')},
      {label:'Incidentes activos',value:active?.length,onClick:()=>navigate('/incidents?status=active')},
      {label:'Mantenimientos en curso',value:maintenance.isError?null:maintenance.data?.filter(w=>w.status==='in_progress').length,onClick:()=>navigate('/maintenance?status=in_progress')},
      {label:'Notificaciones fallidas · 24 h',value:failedNotifications?.length,onClick:()=>navigate('/notifications?status=failed')},
    ]} />
    {partial && <div role="status" className="text-xs text-accent-yellow flex gap-2"><AlertTriangle size={16}/>Algunos módulos no respondieron. Los conteos ausentes no representan cero; recarga para volver a consultar.</div>}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <section className="order-2 lg:order-1 lg:col-span-7 dashboard-panel" data-testid="management-alert-chart">
        <h2 className="text-sm font-semibold mb-2">Alertas sin resolver por severidad</h2>
        {alerts.isLoading ? <div className="h-52 animate-pulse bg-bg-dark rounded-lg" aria-label="Cargando alertas"/> : !unresolved ? <p className="h-52 flex items-center text-sm text-text-muted">Datos no disponibles</p> : unresolved.length===0 ? <p className="h-52 flex items-center text-sm text-text-muted">No hay alertas sin resolver</p> : <ResponsiveContainer width="100%" height={200}><BarChart data={severityData} margin={{left:-20,right:8}}><XAxis dataKey="label" tick={{fill:'#e2e8f0',fontSize:12}}/><YAxis allowDecimals={false} tick={{fill:'#e2e8f0',fontSize:12}}/><Tooltip contentStyle={{background:'#111c2b',borderColor:'#304359',borderRadius:10,color:'#e6edf5'}}/><Bar dataKey="value" name="Alertas" isAnimationActive={false} radius={[5,5,0,0]} onClick={data=>navigate(`/alerts?status=unresolved&severity=${data.key}`)}>{severityData.map((d,i)=><Cell key={d.key} fill={colors[i]} cursor="pointer"/>)}</Bar></BarChart></ResponsiveContainer>}
        <div className="flex gap-2 flex-wrap">{severityData.map((d,i)=><Link key={d.key} to={`/alerts?status=unresolved&severity=${d.key}`} className="text-xs rounded-lg px-2 py-1 hover:bg-bg-card-hover" style={{color:colors[i]}}>{d.label} {unresolved ? d.value : '—'}</Link>)}</div>
      </section>
      <section className="order-3 lg:order-1 lg:col-span-5 dashboard-panel" data-testid="management-incident-chart">
        <h2 className="text-sm font-semibold mb-2">Incidentes activos por estado</h2>
        {incidents.isLoading ? <div className="h-52 animate-pulse bg-bg-dark rounded-lg" aria-label="Cargando incidentes"/> : !active ? <p className="h-52 flex items-center text-sm text-text-muted">Datos no disponibles</p> : active.length===0 ? <p className="h-52 flex items-center text-sm text-text-muted">No hay incidentes activos</p> : <div className="relative"><ResponsiveContainer width="100%" height={200}><PieChart><Pie data={stateData.filter(d=>d.value)} dataKey="value" nameKey="label" innerRadius={60} outerRadius={83} paddingAngle={3} isAnimationActive={false} onClick={data=>navigate(`/incidents?status=${data.key}`)}>{stateData.filter(d=>d.value).map(d=><Cell key={d.key} fill={colors[Object.keys(stateLabels).indexOf(d.key)]} cursor="pointer"/>)}</Pie><Tooltip contentStyle={{background:'#111c2b',borderColor:'#304359',borderRadius:10}}/></PieChart></ResponsiveContainer><div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><strong className="text-2xl">{active.length}</strong><span className="text-xs text-text-muted">activos</span></div></div>}
        <div className="flex gap-2 flex-wrap">{stateData.map((d,i)=><Link key={d.key} to={`/incidents?status=${d.key}`} className="text-xs rounded-lg px-2 py-1 hover:bg-bg-card-hover" style={{color:colors[i]}}>{d.label} {active ? d.value : '—'}</Link>)}</div>
      </section>
      <section className="order-1 lg:order-2 lg:col-span-7 dashboard-panel" data-testid="management-pending">
        <h2 className="text-sm font-semibold mb-3">Pendientes <span className="text-text-muted">{loading ? '…' : pending.length}{partial ? ' disponibles' : ''}</span></h2>
        {loading && !pending.length ? <div className="h-32 bg-bg-dark animate-pulse rounded-lg"/> : pending.length ? <div className="divide-y divide-border-base">{pending.slice(0,8).map(p=><Link key={p.key} to={p.path} className="flex items-center justify-between gap-3 py-3 hover:text-accent-green"><div className="min-w-0"><div className="flex items-center gap-2 text-sm font-medium"><span className={`h-2 w-2 rounded-full shrink-0 ${p.priority===0?'bg-accent-red':'bg-accent-yellow'}`}/><span className="truncate">{p.title}</span></div><p className="text-xs text-text-muted mt-1">{p.detail} · {new Date(p.at).toLocaleString()}</p></div><ArrowRight size={15} className="shrink-0"/></Link>)}</div> : <p className="text-sm text-text-muted py-4">{partial ? 'No hay pendientes en las fuentes disponibles.' : 'No hay pendientes actuales.'}</p>}
        {pending.length>8 && <p className="text-xs text-text-muted mt-2">Mostrando 8 de {pending.length}. Abre el módulo para ver todos.</p>}
      </section>
      <section className="order-4 lg:order-2 lg:col-span-5 dashboard-panel" data-testid="management-agenda">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><CalendarDays size={16}/>Agenda · próximos 7 días</h2>
        {maintenance.isLoading ? <div className="h-32 animate-pulse bg-bg-dark rounded-lg"/> : maintenance.isError ? <p className="text-sm text-text-muted">Agenda no disponible</p> : agenda.length ? <div className="divide-y divide-border-base">{agenda.slice(0,5).map(w=><Link key={w.id} to={`/maintenance?status=${w.status}&resource=${w.id}`} className="block py-3 hover:text-accent-green"><strong className="text-sm font-medium">{w.title}</strong><p className="text-xs text-text-muted mt-1">{w.status==='in_progress'?'En curso':'Programado'} · {new Date(w.start_time).toLocaleString()}</p></Link>)}</div> : <p className="text-sm text-text-muted py-4">No hay mantenimientos en esta agenda.</p>}
        <Link to="/maintenance" className="text-xs text-accent-green inline-block mt-3">Ver agenda completa →</Link>
      </section>
    </div>
    <section aria-label="Módulos de gestión" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-5">{modules.map(m=><Link key={m.label} to={m.path} className="flex justify-between items-center gap-3 border-t border-border-base py-3"><div><h2 className="text-sm font-medium">{m.label}</h2><p className="text-xs text-text-muted mt-1">{m.text}</p></div><ArrowRight size={15}/></Link>)}</section>
  </div>;
}
