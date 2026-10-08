import { useEffect, useState } from 'react';

export default function DataConsultationAge({updatedAt}:{updatedAt:number}) {
  const [now,setNow] = useState(Date.now());
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),30000);return ()=>window.clearInterval(timer);},[]);
  const seconds=Math.max(0,Math.floor((now-updatedAt)/1000));
  const age=seconds<60?'menos de 1 min':seconds<3600?`${Math.floor(seconds/60)} min`:`${Math.floor(seconds/3600)} h`;
  return <span title={updatedAt?`Última consulta de datos guardados: ${new Date(updatedAt).toLocaleString()}. No es una nueva medición.`:'Aún no se han consultado datos.'}>
    {updatedAt?`Datos consultados hace ${age}`:'Sin consulta'}
  </span>;
}
