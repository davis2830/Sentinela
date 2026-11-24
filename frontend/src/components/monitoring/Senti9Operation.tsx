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
    <div className="space-y-4">
      {/* 1. Tarjeta de Conectividad con Sentinel */}
      <DetailCard title="Conectividad y Señal LAN" icon={<Radio size={16} />}>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <DetailStat label="Último Latido" compact>
            <DetailTimestamp value={probe.last_heartbeat} />
          </DetailStat>
          <DetailStat label="Versión del Agente" compact={!probe.version}>
            {probe.version ? `v${probe.version}` : "Sin reporte"}
          </DetailStat>
          <DetailStat label="Monitores en Custodia">
            {probe.assigned_targets_count}
          </DetailStat>
        </dl>
        <DetailNote>
          El latido acredita comunicación bidireccional con Sentinel. Las mediciones se ejecutan independientemente en la red del host.
        </DetailNote>
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {canCreateMonitor && !probe.revoked_at && (
            <Link
              to={`/monitoring?create=1&agent=${probe.id}`}
              onClick={onNavigate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-accent-green hover:bg-accent-green-hover text-bg-dark transition-colors shadow-sm"
            >
              <Plus size={15} aria-hidden="true" />
              <span>Crear Monitor Privado</span>
            </Link>
          )}
          <Link
            to={`/monitoring?agent=${probe.id}`}
            onClick={onNavigate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-text-main transition-colors"
          >
            <ExternalLink size={14} aria-hidden="true" />
            <span>Ver Monitores Asignados ({probe.assigned_targets_count})</span>
          </Link>
        </div>
      </DetailCard>

      {/* 2. Entrega y Cola de Tareas en Servidor */}
      <DetailCard
        title="Cola de Tareas en Servidor"
        icon={<Server size={16} />}
      >
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <DetailStat label="Tareas Pendientes">
            {probe.delivery?.pending ?? "0"}
          </DetailStat>
          <DetailStat label="Vencidas" warning={!!probe.delivery?.overdue}>
            {probe.delivery?.overdue ?? "0"}
          </DetailStat>
          <DetailStat label="Última Entrega" compact>
            <DetailTimestamp value={probe.delivery?.last_received_at} />
          </DetailStat>
        </dl>
        <DetailNote>
          Métrica de sincronización en servidor. Las tareas se despachan en cada latido y se ejecutan en memoria local del host.
        </DetailNote>
      </DetailCard>

      {/* 3. Telemetría de Recursos del Host */}
      <ProbeTelemetry probe={probe} queryFailed={queryFailed} variant="card" />

      {/* 4. Especificaciones del Sistema y Red */}
      <details className="group rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all">
        <summary className="flex items-center justify-between cursor-pointer list-none text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text-main">
          <span className="inline-flex items-center gap-2">
            <Network size={15} className="text-accent-green" aria-hidden="true" />
            <span>Parámetros de Red y Entorno del Host</span>
          </span>
          <span className="text-[11px] text-text-muted font-normal group-open:rotate-180 transition-transform">
            ▼
          </span>
        </summary>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-xs">
          <div className="p-3 rounded-xl bg-bg-dark/50 border border-white/5">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
              Hostname
            </dt>
            <dd className="font-mono text-text-main break-all font-medium">
              {probe.hostname || "Sin reporte"}
            </dd>
          </div>
          <div className="p-3 rounded-xl bg-bg-dark/50 border border-white/5">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
              IP Reportada
            </dt>
            <dd className="font-mono text-text-main break-all font-medium">
              {probe.ip_address || "Sin reporte"}
            </dd>
          </div>
          <div className="p-3 rounded-xl bg-bg-dark/50 border border-white/5">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
              Sistema Operativo
            </dt>
            <dd className="font-mono text-text-main break-all font-medium">
              {probe.os_info || "Sin reporte"}
            </dd>
          </div>
        </dl>
      </details>
    </div>
  );
}
