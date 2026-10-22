import { CalendarClock, CheckCircle2, Clock, Lock, Network, ShieldCheck, ShieldAlert, Activity, Globe } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CoverageModule, CoverageResource } from '../types/endpoint';
import type { UITone } from '../components/common/MetricCard';
import { finite, formatMetric, measuredAt, securityTone } from './endpointPresentation';

export interface ResourceMetric { label:string; value:string; unit?:string; caption:string; tone:UITone; icon:LucideIcon; textValue?:boolean }
export const resourceValue = (v:unknown):string => v == null || v === '' ? '—' : typeof v === 'boolean' ? v ? 'Sí' : 'No' : Array.isArray(v) ? v.length ? v.map(resourceValue).join(' · ') : 'Sin valores registrados' : typeof v === 'object' ? Object.entries(v).map(([k,item])=>`${k}: ${resourceValue(item)}`).join('\n') || 'Sin valores registrados' : String(v);
const dateKeys = new Set(['expiration_date','issued_at','creation_date','last_updated','last_change_at','changed_at','checked_at','last_scanned_at','last_checked_at']);
export const resourceDate = (v:unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Intl.DateTimeFormat('es-GT',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)) : '—';
export const resourceField = (key:string,v:unknown) => dateKeys.has(key) ? resourceDate(v) : resourceValue(v);
export function issuerName(v:unknown) {
  if(typeof v!=='string')return resourceValue(v);
  const organization=v.match(/(?:^|[,/])\s*(?:O|organizationName)=([^,/]+)/i)?.[1]?.trim();
  const common=v.match(/(?:^|[,/])\s*(?:CN|commonName)=([^,/]+)/i)?.[1]?.trim();
  return organization ? [organization,common].filter(Boolean).join(' · ') : v;
}

/** Highlights require a successful timestamped measurement, including booleans. */
export function resourceMetrics(module:CoverageModule,r:CoverageResource):ResourceMetric[] {
  const measured=Boolean(measuredAt(r))&&!r.error_message;
  const number=(label:string,n:unknown,unit:string,caption:string,icon:LucideIcon,tone:UITone='muted'):ResourceMetric=>({label,value:measured&&finite(n)?formatMetric(n):'—',unit:measured&&finite(n)?unit:undefined,caption:measured?caption:'Sin medición válida',icon,tone:measured&&finite(n)?tone:'muted'});
  const text=(label:string,v:unknown,caption:string,icon:LucideIcon,tone:UITone='muted'):ResourceMetric=>({label,value:measured?resourceValue(v):'—',caption:measured?caption:'Sin medición válida',icon,tone:measured&&v!=null&&v!==''?tone:'muted',textValue:true});
  const expiry=(days:unknown)=>!finite(days)?'muted':days<=7?'danger':days<=30?'warning':'success';
  const boolean=(v:unknown,yes:string,no:string)=>typeof v==='boolean'?v?yes:no:null;
  if(module==='ssl')return [
    number('Vigencia',r.days_remaining,'días','Hasta el vencimiento',CalendarClock,expiry(r.days_remaining)),
    text('Certificado',boolean(r.is_valid,'Válido','Inválido'),'Última evaluación',CheckCircle2,r.is_valid===false?'danger':'success'),
    text('Versión TLS',r.tls_version,'Conexión medida',Lock),
    text('Evaluación TLS',r.security_grade,'Calificación registrada',ShieldCheck),
  ];
  if(module==='dns')return [
    // Record type is configuration; TTL is measured by the DNS resolver.
    {label:'Resolución DNS',value:!measuredAt(r)?'Sin medición':r.error_message?'Error':typeof r.value==='string'&&r.value.trim()?'Resuelve':'Sin respuesta',caption:`Registro ${resourceValue(r.record_type)}`,icon:Network,tone:!measuredAt(r)?'muted':r.error_message?'danger':typeof r.value==='string'&&r.value.trim()?'success':'warning',textValue:true},
    number('Respuesta DNS',r.response_time_ms,'ms','Tiempo de consulta · Sin umbral propio',Activity),
    number('TTL',r.ttl,'s','Tiempo de caché',Clock),
    text('Último cambio',typeof r.last_change_at==='string'&&Number.isFinite(Date.parse(r.last_change_at))?new Intl.DateTimeFormat('es-GT',{day:'numeric',month:'short'}).format(new Date(r.last_change_at)):null,'Cambio registrado',CalendarClock),
  ];
  if(module==='domain')return [
    number('Vigencia',r.days_until_expiration,'días','Hasta el vencimiento',CalendarClock,expiry(r.days_until_expiration)),
    text('Transferencia',boolean(r.is_locked,'Bloqueada','Sin bloqueo'),'Bloqueo del registrador',Lock,r.is_locked===false?'warning':'success'),
    text('DNSSEC',r.dnssec,'Según el registro WHOIS',ShieldCheck),
    text('País',r.registrant_country,'Dato del registro',Globe),
  ];
  const knownControls=['has_hsts','has_csp','has_xfo'].filter(k=>typeof r[k]==='boolean');
  const present=knownControls.filter(k=>r[k]===true).length;
  const scoreTone=securityTone(r.last_score);
  return [
    number('Puntuación',scoreTone==='muted'?null:r.last_score,'/100','Evaluación de cabeceras',ShieldCheck,scoreTone==='success'&&r.info_leak_detected===true?'warning':scoreTone),
    text('Evaluación',r.last_grade,'Calificación registrada',ShieldCheck,scoreTone),
    {label:'Controles presentes',value:measured&&knownControls.length?`${present}/${knownControls.length}`:'—',caption:'HSTS · CSP · Frames',icon:CheckCircle2,tone:measured&&knownControls.length?present===knownControls.length?'success':'warning':'muted'},
    text('Fuga detectada',boolean(r.info_leak_detected,'Sí','No'),'Última evaluación',ShieldAlert,r.info_leak_detected===true?'danger':'success'),
  ];
}
