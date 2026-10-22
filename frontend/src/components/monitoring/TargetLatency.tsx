import type { MonitoringTarget } from '../../types/monitoring';
import { finite, formatMetric, latencyTone } from '../../utils/endpointPresentation';
export function latestTargetCheck(target:MonitoringTarget) {
 return [...(target.recent_checks||[])].reverse().find(c=>target.last_checked_at!=null&&Date.parse(c.checked_at)===Date.parse(target.last_checked_at));
}
export function TargetDiagnostic({target}:{target:MonitoringTarget}) {
 if(!target.enabled||!['slow','down','error'].includes(target.last_status||''))return null;
 const check=latestTargetCheck(target);
 const message=check?.diagnostic||(target.last_status==='slow'?'Respuesta lenta registrada':'Comprobación fallida · ver detalle');
 return <p title={message} className="text-xs mt-1 ui-tone truncate max-w-[280px]" data-tone={target.last_status==='slow'?'warning':'danger'}>{message}</p>;
}
export default function TargetLatency({target}:{target:MonitoringTarget}) {
 const failed=['down','error'].includes(target.last_status||'');
 const measured=Boolean(target.last_checked_at&&Number.isFinite(Date.parse(target.last_checked_at)));
 const value=!failed&&measured&&finite(target.last_latency)&&target.last_latency>=0?`${formatMetric(target.last_latency)} ms`:'—';
 const applied=latestTargetCheck(target)?.applied_max_latency_ms;
 return <div className="space-y-1" data-testid="target-latency"><span className="ui-tone font-mono font-bold" data-tone={failed||!measured||!target.enabled?'muted':latencyTone(target.last_latency,target.max_latency_ms,target.last_status)}>{value}</span><p className="text-xs font-normal text-text-dim">Límite actual: {finite(target.max_latency_ms)&&target.max_latency_ms>0?`${formatMetric(target.max_latency_ms)} ms`:'Sin configurar'}</p>{finite(applied)&&applied!==target.max_latency_ms&&<p className="text-xs font-normal text-text-dim">Aplicado: {formatMetric(applied)} ms</p>}{!finite(applied)&&target.last_status==='up'&&finite(target.last_latency)&&finite(target.max_latency_ms)&&target.last_latency>target.max_latency_ms&&<p className="text-xs font-normal text-text-dim">Límite aplicado: no registrado</p>}</div>;
}
