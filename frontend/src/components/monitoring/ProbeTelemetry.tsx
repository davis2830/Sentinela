import type { AgentProbe } from '../../types/agent_probe';

const diagnostics: Record<string, string> = {
  local_storage: 'No se pudo procesar el almacenamiento local. Revisar disco y permisos.',
  delivery_unconfirmed: 'Envío sin confirmación. Los resultados se conservan para reintentar.',
  receipt_incomplete: 'Acuse incompleto o no válido. Los resultados pendientes se conservan.',
  control_unconfirmed: 'Una consulta de tareas no fue confirmada. El agente está reintentando.',
};

export default function ProbeTelemetry({ probe, queryFailed }: { probe: AgentProbe; queryFailed: boolean }) {
  const telemetry = probe.telemetry;
  const snapshot = telemetry?.snapshot;
  const current = !queryFailed && probe.is_online && telemetry?.state === 'current' && !!snapshot;
  const queue = current ? snapshot.queue : null;
  const errors = current ? snapshot.errors : [];
  const pending = queue ? queue.queued + queue.running + queue.ready : 0;
  const label = !current ? snapshot ? 'Telemetría interna desactualizada' : 'Sin telemetría interna'
    : errors.length ? 'Revisar agente' : snapshot.draining ? 'Modo drenaje'
    : !queue ? 'Cola desconocida' : pending ? 'Procesando comprobaciones' : 'Sin errores reportados';
  const tone = !current || !queue ? 'text-text-muted' : errors.length ? 'text-accent-red'
    : snapshot?.draining || pending ? 'text-accent-yellow' : 'text-accent-green';
  return <section aria-label="Telemetría interna del agente" className="border-t border-border-base/60 pt-3 space-y-2">
    <div className={`text-sm font-semibold ${errors.length ? 'text-accent-red' : tone}`}>{label}</div>
    <dl className="grid grid-cols-3 gap-2 text-xs text-text-muted">
      {([['En espera', 'queued'], ['Ejecutando', 'running'], ['Por enviar', 'ready']] as const).map(([title, key]) =>
        <div key={key}><dt>{title}</dt><dd className={`text-xl font-bold ${current && key === 'ready' && queue?.ready ? 'text-accent-yellow' : 'text-text-main'}`}>{queue?.[key] ?? '—'}</dd></div>)}
    </dl>
    {current && snapshot.draining && <p className="text-xs text-accent-yellow">Termina lo pendiente sin solicitar tareas nuevas.</p>}
    {errors.map(error => <p key={error.component} className="text-xs text-accent-red">{diagnostics[error.code] || 'Diagnóstico no reconocido.'} · {error.failures} fallo(s) consecutivos</p>)}
    <p className="text-xs text-text-muted">Último acuse recibido por el agente: <span className="text-text-main">{snapshot?.last_ack_at ? new Date(snapshot.last_ack_at).toLocaleString() : 'Sin registro'}</span></p>
    <p className="text-[11px] text-text-dim">{current ? 'Reportado por el agente' : telemetry?.received_at ? `Último reporte: ${new Date(telemetry.received_at).toLocaleString()}` : 'Requiere Senti9 1.7.0 o posterior'}{current && queue ? ` · Cola ${pending}/${snapshot.queue_limit}` : ''}</p>
    {!!snapshot?.rejected_retained && <details className="text-xs text-text-muted"><summary className="cursor-pointer">{snapshot.rejected_retained} rechazo(s) conservados en el historial local</summary><p className="mt-1">Último rechazo: {snapshot.last_rejection_at ? new Date(snapshot.last_rejection_at).toLocaleString() : 'Sin fecha'}. Revisar el diario local; este contador histórico no indica un error activo.</p></details>}
  </section>;
}
