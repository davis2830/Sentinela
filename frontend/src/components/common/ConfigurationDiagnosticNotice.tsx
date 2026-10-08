export default function ConfigurationDiagnosticNotice({notice,remaining}:{notice:string;remaining:number}) {
  const wait=remaining>=3600?`${Math.ceil(remaining/3600)} h`:remaining>=60?`${Math.ceil(remaining/60)} min`:`${remaining} s`;
  return <div className="text-xs text-text-muted space-y-1" data-testid="configuration-diagnostic-notice">
    <p>Comprueba que podemos conectarnos antes de guardar. No activa el monitoreo ni genera históricos. La prueba es opcional.</p>
    {notice && <p role="status" className="text-text-main">{notice}{remaining > 0 && <span className="block">Puedes volver a probar en {wait}. Guardar sigue disponible.</span>}</p>}
  </div>;
}
