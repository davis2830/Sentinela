import { ExternalLink, Network, Plus, Radio, Server } from "lucide-react";
import { Link } from "react-router-dom";
import type { AgentProbe } from "../../types/agent_probe";
import ProbeTelemetry from "./ProbeTelemetry";
import {
  DetailCard,
  DetailNote,
  DetailStat,
  DetailTimestamp,
} from "./Senti9DetailUI";

export default function Senti9Operation({
  probe,
  queryFailed,
  canCreateMonitor,
  onNavigate,
}: {
  probe: AgentProbe;
  queryFailed: boolean;
  canCreateMonitor: boolean;
  onNavigate: () => void;
}) {
  return (
    <div className="senti9-operation space-y-4">
      <DetailCard title="Conexión con Sentinel" icon={<Radio size={17} />}>
        <dl className="grid grid-cols-3 gap-3">
          <DetailStat label="Última señal" compact>
            <DetailTimestamp value={probe.last_heartbeat} />
          </DetailStat>
          <DetailStat label="Versión reportada" compact={!probe.version}>
            {probe.version || "Sin reporte"}
          </DetailStat>
          <DetailStat label="Monitores asignados">
            {probe.assigned_targets_count}
          </DetailStat>
        </dl>
        <DetailNote>
          La señal acredita comunicación. El estado de cada servicio depende de
          sus mediciones.
        </DetailNote>
        <div className="flex flex-wrap gap-3 pt-1">
          {canCreateMonitor && !probe.revoked_at && (
            <Link
              className="senti9-detail-action senti9-detail-action-primary"
              to={`/monitoring?create=1&agent=${probe.id}`}
              onClick={onNavigate}
            >
              <Plus size={17} aria-hidden="true" />
              Crear monitor privado
            </Link>
          )}
          <Link
            className="senti9-detail-action senti9-detail-action-secondary"
            to={`/monitoring?agent=${probe.id}`}
            onClick={onNavigate}
          >
            <ExternalLink size={16} aria-hidden="true" />
            Ver monitores asignados
          </Link>
        </div>
      </DetailCard>
      <DetailCard
        title="Entrega registrada en el servidor"
        icon={<Server size={17} />}
      >
        <dl className="grid grid-cols-3 gap-3">
          <DetailStat label="Pendientes">
            {probe.delivery?.pending ?? "—"}
          </DetailStat>
          <DetailStat label="Vencidos" warning={!!probe.delivery?.overdue}>
            {probe.delivery?.overdue ?? "—"}
          </DetailStat>
          <DetailStat label="Última recepción" compact>
            <DetailTimestamp value={probe.delivery?.last_received_at} />
          </DetailStat>
        </dl>
        <DetailNote>
          Registro del servidor. No se suma a la cola local del agente.
        </DetailNote>
      </DetailCard>
      <ProbeTelemetry probe={probe} queryFailed={queryFailed} variant="card" />
      <details className="senti9-operation-network rounded-xl border border-white/5 bg-white/[0.02] px-5">
        <summary className="min-h-11 cursor-pointer text-slate-400">
          <span className="inline-flex items-center gap-2">
            <Network size={15} aria-hidden="true" />
            Red y sistema
          </span>
        </summary>
        <dl className="grid gap-4 pb-5 text-sm sm:grid-cols-2">
          {[
            ["Host", probe.hostname],
            ["IP reportada", probe.ip_address],
            ["Sistema", probe.os_info],
          ].map(([label, value]) => (
            <div className="min-w-0" key={label}>
              <dt className="mb-1 text-xs uppercase tracking-wider text-slate-400">
                {label}
              </dt>
              <dd className="break-all font-mono text-slate-200">
                {value || "Sin reporte"}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
