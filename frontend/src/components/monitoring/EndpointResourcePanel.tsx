import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, Minus, XCircle, ExternalLink } from 'lucide-react';
import type { CoverageModule, CoverageResource } from '../../types/endpoint';
import { measuredAt } from '../../utils/endpointPresentation';
import { issuerName, resourceDate, resourceField, resourceMetrics, resourceValue } from '../../utils/resourcePresentation';
import MetricCard from '../common/MetricCard';

export default function EndpointResourcePanel({module,modulePath,resources,fields,action,history}:{
  module:CoverageModule;modulePath:string;resources:CoverageResource[];fields:[string,string][];
  action:(r:CoverageResource)=>ReactNode;history:(r:CoverageResource)=>ReactNode;
}) {
  const [selectedId,setSelectedId]=useState('');
  const r=resources.find(item=>item.id===selectedId)||resources[0];
  if(!r)return <p role="status">Sin recursos vinculados.</p>;
  const measured=Boolean(measuredAt(r))&&!r.error_message;
  const primary:[string,string][] = module==='ssl' ? [['domain','Hostname'],['issuer','Emisor'],['expiration_date','Vence'],['issued_at','Emitido']]
    : module==='domain' ? [['domain','Dominio'],['registrar','Registrador'],['expiration_date','Vence'],['name_servers','Servidores de nombres']]
    : module==='dns' ? [['domain','Hostname'],['value','Valor registrado']]
    : [['url','URL evaluada']];
  const label=module==='ssl'?'Certificado':module==='domain'?'Registro WHOIS':module==='dns'?'Registro DNS':'Evaluación web';
  return <section className="ui-card endpoint-resource-panel" aria-label={`Detalle ${label}`} data-testid={`resource-panel-${module}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="flex items-center gap-1.5 text-xs text-text-dim"><Clock size={14}/>Última medición: {resourceDate(measuredAt(r))}</p>
      <div className="flex max-w-full flex-wrap items-center gap-2">{action(r)}<Link to={`${modulePath}?resource=${r.id}`} className="ui-button ui-button-secondary text-xs">Abrir módulo <ExternalLink size={14}/></Link></div>
    </div>
    {resources.length>1&&<label className="flex flex-wrap items-center gap-2 text-sm">Recurso mostrado<select aria-label="Recurso mostrado" className="min-h-11 max-w-full rounded-lg border px-2" value={r.id} onChange={e=>setSelectedId(e.target.value)}>{resources.map(item=><option key={item.id} value={item.id}>{module==='dns'?`${resourceValue(item.record_type)} · `:''}{resourceValue(item.domain||item.url)}</option>)}</select><span className="text-xs text-text-dim">{resources.length} vinculados</span></label>}
    {!measuredAt(r)&&<p role="status" className="text-sm text-text-dim">Sin mediciones. Los valores de configuración no representan una evaluación de salud.</p>}
    {Boolean(r.error_message)&&<p role="status" className="flex items-start gap-2 text-sm text-accent-red"><AlertTriangle size={18} className="shrink-0"/>Error de medición: {resourceValue(r.error_message)}</p>}
    <div className="endpoint-metric-strip resource-highlights" aria-label={`Indicadores ${label}`}>
      {resourceMetrics(module,r).map(metric=><MetricCard key={metric.label} compact {...metric}/>)}
    </div>
    <div className={`resource-content-grid ${module==='dns'||module==='security'?'resource-with-history':''}`}>
      <div className="min-w-0 space-y-3">
        <h3 className="text-sm font-semibold">{label}</h3>
        <dl className="resource-primary-fields">
          {primary.map(([key,title])=><div key={key}><dt className="text-xs text-text-dim">{title}</dt><dd className="mt-1 break-words text-sm" title={key==='issuer'?resourceValue(r[key]):undefined}>{!measured&&key!=='domain'&&key!=='url'?'—':key==='issuer'?issuerName(r[key]):resourceField(key,r[key])}</dd></div>)}
        </dl>
        {module==='security'&&<ul className="space-y-2" aria-label="Controles básicos de cabeceras">{([['has_hsts','HSTS'],['has_csp','Content Security Policy'],['has_xfo','X-Frame-Options']] as const).map(([key,title])=>{
          const known=measured&&typeof r[key]==='boolean';const Icon=!known?Minus:r[key]?CheckCircle2:XCircle;
          return <li key={key} className="flex items-center gap-2 text-sm"><Icon size={17} className={!known?'text-text-dim':r[key]?'text-emerald-400':'text-accent-yellow'}/><span className="min-w-0 flex-1">{title}</span><span className="text-xs text-text-dim">{!known?'Sin dato':r[key]?'Presente':'Ausente'}</span></li>;
        })}</ul>}
      </div>
      {(module==='dns'||module==='security')&&<div className="min-w-0">{history(r)}</div>}
    </div>
    <details className="resource-technical">
      <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-accent-cyan">Detalles técnicos<ChevronDown size={15}/></summary>
      <dl className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-2">{fields.map(([key,title])=><div key={key}><dt className="text-xs text-text-dim">{title}</dt><dd className="mt-1 whitespace-pre-wrap break-all text-sm">{measured?resourceField(key,r[key]):'—'}</dd></div>)}</dl>
    </details>
  </section>;
}
