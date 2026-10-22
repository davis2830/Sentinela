import { finite, formatMetric } from '../../utils/endpointPresentation';
export interface CheckOutcomeCounts {operational_checks?:number;degraded_checks?:number;failed_checks?:number;total_checks?:number}
export default function CheckOutcomes({counts,period}:{counts?:CheckOutcomeCounts;period:string}) {
 const values=[counts?.operational_checks,counts?.degraded_checks,counts?.failed_checks];
 const valid=values.every(v=>finite(v)&&Number.isInteger(v)&&v>=0);
 const total=valid?values.reduce<number>((n,v)=>n+(v||0),0):null;
 const consistent=valid&&(counts?.total_checks==null||counts.total_checks===total);
 const labels=['Operacionales','Degradadas','Fallidas'];const tones=['success','warning','danger'];
 return <section className="dashboard-check-outcomes" aria-label="Resultados de las comprobaciones"><div className="flex flex-wrap justify-between gap-2 text-xs"><h4 className="font-semibold">Resultados de comprobaciones · {period}</h4><span className="text-text-dim">{consistent&&total!=null?`${formatMetric(total)} en total`:'Desglose no disponible'}</span></div>{consistent&&total!=null&&<><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1">{values.map((v,i)=><span key={tones[i]} className="ui-tone" data-tone={tones[i]}>{labels[i]}: <strong>{formatMetric(v!)}</strong></span>)}</div><div className="flex h-1.5 rounded overflow-hidden bg-bg-dark mt-2" role="img" aria-label={`${total} comprobaciones: ${values[0]} operacionales, ${values[1]} degradadas, ${values[2]} fallidas`}>{total>0&&values.map((v,i)=><span key={tones[i]} data-tone={tones[i]} style={{width:`${v!*100/total}%`,backgroundColor:'rgb(var(--ui-tone))'}}/>)}</div>{total===0&&<p className="text-xs text-text-muted">Sin comprobaciones en este período.</p>}</>}</section>;
}
