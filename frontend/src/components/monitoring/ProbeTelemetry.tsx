import type { AgentProbe } from "../../types/agent_probe";
import { Layers } from "lucide-react";
import {
  DetailBadge,
  DetailCard,
  DetailNote,
  DetailStat,
  DetailTimestamp,
} from "./Senti9DetailUI";

const diagnostics: Record<string, string> = {
  local_storage:
    "No se pudo procesar el almacenamiento local. Revisar disco y permisos.",
  delivery_unconfirmed:
    "Envío sin confirmación. Los resultados se conservan para reintentar.",
  receipt_incomplete:
    "Acuse incompleto o no válido. Los resultados pendientes se conservan.",
  control_unconfirmed:
    "Una consulta de tareas no fue confirmada. El agente está reintentando.",
};

export default function ProbeTelemetry({
  probe,
  queryFailed,
  variant = "compact",
}: {
  probe: AgentProbe;
  queryFailed: boolean;
  variant?: "compact" | "card";
}) {
  const telemetry = probe.telemetry;
  const snapshot = telemetry?.snapshot;
  const current =
    !queryFailed &&
    probe.is_online &&
    telemetry?.state === "current" &&
    !!snapshot;
  const queue = current ? snapshot.queue : null;
  const errors = current ? snapshot.errors : [];
  const pending = queue ? queue.queued + queue.running + queue.ready : 0;
  const label = !current
    ? snapshot
      ? "Telemetría interna desactualizada"
      : "Sin telemetría interna"
    : errors.length
      ? "Revisar agente"
      : snapshot.draining
        ? "Modo drenaje"
        : !queue
          ? "Cola desconocida"
          : pending
            ? "Procesando comprobaciones"
            : "Sin errores reportados";
  const tone =
    !current || !queue
      ? "text-text-muted"
      : errors.length
        ? "text-accent-red"
        : snapshot?.draining || pending
          ? "text-accent-yellow"
          : "text-accent-green";
  if (variant === "card") {
    const statusTone = !current
      ? "muted"
      : errors.length
        ? "danger"
        : !queue
          ? "muted"
          : snapshot.draining || pending
            ? "warning"
            : "success";
    const limit =
      current &&
      queue &&
      Number.isFinite(snapshot.queue_limit) &&
      snapshot.queue_limit > 0
        ? snapshot.queue_limit
        : null;
    const progress = limit
      ? Math.min(100, Math.max(0, (pending / limit) * 100))
      : 0;
    return (
      <DetailCard
        title="Cola local reportada"
        icon={<Layers size={17} />}
        badge={
          <DetailBadge tone={statusTone} pulse={statusTone === "success"}>
            {label}
          </DetailBadge>
        }
      >
        <dl className="grid grid-cols-3 gap-3">
          {(
            [
              ["En espera", "queued"],
              ["Ejecutando", "running"],
              ["Por enviar", "ready"],
            ] as const
          ).map(([title, key]) => (
            <DetailStat
              key={key}
              label={title}
              warning={key === "ready" && !!queue?.ready}
            >
              {queue?.[key] ?? "—"}
            </DetailStat>
          ))}
        </dl>
        <div className="senti9-queue-capacity rounded-lg border border-white/5 bg-black/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>Capacidad de la cola</span>
            <span className="font-mono text-slate-200">
              {limit ? `Cola ${pending}/${limit}` : "Sin datos actuales"}
            </span>
          </div>
          {limit ? (
            <div
              className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
              role="progressbar"
              aria-label="Capacidad de la cola local"
              aria-valuemin={0}
              aria-valuemax={limit}
              aria-valuenow={Math.min(limit, pending)}
              aria-valuetext={`${pending} de ${limit} comprobaciones`}
            >
              <div
                className={`h-full rounded-full ${progress >= 90 ? "bg-amber-400" : "bg-emerald-400"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : (
            <div
              className="mt-2.5 h-1.5 w-full rounded-full bg-slate-800"
              aria-hidden="true"
            />
          )}
          <div className="mt-3 flex flex-wrap items-start justify-between gap-2 text-xs text-slate-400">
            <span>Último acuse recibido por el agente</span>
            <span className="font-mono text-slate-200">
              <DetailTimestamp value={snapshot?.last_ack_at} />
            </span>
          </div>
        </div>
        {current && snapshot.draining && (
          <p className="text-xs text-amber-300">
            Termina lo pendiente sin solicitar tareas nuevas.
          </p>
        )}
        {errors.map((error) => (
          <p
            key={error.component}
            className="rounded-lg border border-rose-500/15 bg-rose-500/5 p-3 text-xs text-rose-300"
          >
            {diagnostics[error.code] || "Diagnóstico no reconocido."} ·{" "}
            {error.failures} fallo(s) consecutivos
          </p>
        ))}
        <DetailNote>
          {current ? (
            "Reportado por el agente. El acuse confirma que recibió la aceptación del servidor."
          ) : telemetry?.received_at ? (
            <>
              Último reporte:{" "}
              <span className="font-mono">
                {new Date(telemetry.received_at).toLocaleString()}
              </span>
              . Los contadores actuales no están disponibles.
            </>
          ) : (
            "Requiere Senti9 1.7.0 o posterior."
          )}
        </DetailNote>
        {!!snapshot?.rejected_retained && (
          <details className="text-xs text-slate-400">
            <summary className="min-h-11 content-center cursor-pointer">
              {snapshot.rejected_retained} rechazo(s) conservados en el
              historial local
            </summary>
            <p>
              Último rechazo:{" "}
              <span className="font-mono">
                {snapshot.last_rejection_at
                  ? new Date(snapshot.last_rejection_at).toLocaleString()
                  : "Sin fecha"}
              </span>
              . Revisar el diario local; este contador histórico no indica un
              error activo.
            </p>
          </details>
        )}
      </DetailCard>
    );
  }
  return (
    <section
      aria-label="Telemetría interna del agente"
      className="border-t border-border-base/60 pt-3 space-y-2"
    >
      <div
        className={`text-sm font-semibold ${errors.length ? "text-accent-red" : tone}`}
      >
        {label}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-xs text-text-muted">
        {(
          [
            ["En espera", "queued"],
            ["Ejecutando", "running"],
            ["Por enviar", "ready"],
          ] as const
        ).map(([title, key]) => (
          <div key={key}>
            <dt>{title}</dt>
            <dd
              className={`text-xl font-bold ${current && key === "ready" && queue?.ready ? "text-accent-yellow" : "text-text-main"}`}
            >
              {queue?.[key] ?? "—"}
            </dd>
          </div>
        ))}
      </dl>
      {current && snapshot.draining && (
        <p className="text-xs text-accent-yellow">
          Termina lo pendiente sin solicitar tareas nuevas.
        </p>
      )}
      {errors.map((error) => (
        <p key={error.component} className="text-xs text-accent-red">
          {diagnostics[error.code] || "Diagnóstico no reconocido."} ·{" "}
          {error.failures} fallo(s) consecutivos
        </p>
      ))}
      <p className="text-xs text-text-muted">
        Último acuse recibido por el agente:{" "}
        <span className="text-text-main">
          {snapshot?.last_ack_at
            ? new Date(snapshot.last_ack_at).toLocaleString()
            : "Sin registro"}
        </span>
      </p>
      <p className="text-xs text-text-dim">
        {current
          ? "Reportado por el agente"
          : telemetry?.received_at
            ? `Último reporte: ${new Date(telemetry.received_at).toLocaleString()}`
            : "Requiere Senti9 1.7.0 o posterior"}
        {current && queue ? ` · Cola ${pending}/${snapshot.queue_limit}` : ""}
      </p>
      {!!snapshot?.rejected_retained && (
        <details className="text-xs text-text-muted">
          <summary className="cursor-pointer">
            {snapshot.rejected_retained} rechazo(s) conservados en el historial
            local
          </summary>
          <p className="mt-1">
            Último rechazo:{" "}
            {snapshot.last_rejection_at
              ? new Date(snapshot.last_rejection_at).toLocaleString()
              : "Sin fecha"}
            . Revisar el diario local; este contador histórico no indica un
            error activo.
          </p>
        </details>
      )}
    </section>
  );
}
