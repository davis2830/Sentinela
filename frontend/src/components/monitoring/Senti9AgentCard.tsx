import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Plus,
  Server,
  Tag,
  Terminal,
} from "lucide-react";
import type { AgentProbe } from "../../types/agent_probe";
import { DetailBadge } from "./Senti9DetailUI";

function lastSignal(value: string | null) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Sin señal registrada";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

export default function Senti9AgentCard({
  probe,
  stale,
  admin,
  canCreateMonitor,
  onDetail,
  onInstall,
}: {
  probe: AgentProbe;
  stale: boolean;
  admin: boolean;
  canCreateMonitor: boolean;
  onDetail: () => void;
  onInstall: () => void;
}) {
  const [copyResult, setCopyResult] = useState<{
    value: string;
    ok: boolean;
  } | null>(null);
  // A Docker hostname is an equipment identifier, distinct from the agent UUID.
  const identifier = probe.hostname || probe.id;
  const copied = copyResult?.value === identifier && copyResult.ok;
  const copyFailed = copyResult?.value === identifier && !copyResult.ok;
  const connected = probe.is_online && !probe.revoked_at && !stale;
  const state = probe.revoked_at
    ? "revoked"
    : stale
      ? "stale"
      : connected
        ? "connected"
        : probe.last_heartbeat
          ? "disconnected"
          : "pending";
  const label = probe.revoked_at
    ? "Revocado"
    : !probe.last_heartbeat
      ? "Sin conexión inicial"
      : probe.is_online
        ? "Conectado"
        : "Desconectado";
  const note = probe.revoked_at
    ? "Acceso revocado; historial conservado."
    : stale
      ? "Datos anteriores. Actualiza para comprobar la conexión."
      : !probe.last_heartbeat
        ? "Pendiente: instala el agente para recibir su primera señal."
        : !probe.is_online
          ? "Sin conexión reciente. Revisa el equipo y su acceso a Sentinel."
          : probe.assigned_targets_count
            ? "Conexión activa. Revisa los resultados en sus monitores."
            : "Listo para crear tu primer monitor privado.";
  return (
    <article
      className="senti9-agent-row"
      data-connection={state}
      aria-label={probe.name}
    >
      <div className="senti9-agent-identity">
        <span className="senti9-agent-icon">
          <Server size={23} aria-hidden="true" />
        </span>
        <div className="senti9-agent-heading">
          <h3 className="text-base font-semibold break-words">{probe.name}</h3>
          <button
            type="button"
            className="senti9-copy-identifier"
            aria-label={`Copiar ${probe.hostname ? "identificador del equipo" : "ID del agente"}: ${identifier}`}
            title={`${probe.hostname ? "Equipo" : "Agente"}: ${identifier}. ID del agente: ${probe.id}`}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(identifier);
                setCopyResult({ value: identifier, ok: true });
              } catch {
                setCopyResult({ value: identifier, ok: false });
              }
            }}
          >
            <span>
              <span className="truncate">{identifier}</span>
              {copied ? (
                <Check size={12} aria-hidden="true" />
              ) : (
                <Copy size={12} aria-hidden="true" />
              )}
            </span>
          </button>
          {copyFailed ? (
            <p role="status" className="text-xs text-amber-300">
              No se pudo copiar el identificador.
            </p>
          ) : (
            <span role="status" className="sr-only">
              {copied ? "Identificador copiado" : ""}
            </span>
          )}
        </div>
        <DetailBadge
          tone={
            probe.revoked_at
              ? "muted"
              : stale
                ? "warning"
                : connected
                  ? "success"
                  : probe.last_heartbeat
                    ? "warning"
                    : "muted"
          }
          pulse={connected}
        >
          {label}
          {stale && " · dato anterior"}
        </DetailBadge>
      </div>
      <dl className="senti9-agent-metric-strip">
        <div>
          <dt>
            <Activity size={13} aria-hidden="true" />
            Monitores asignados
          </dt>
          <dd className="font-mono">{probe.assigned_targets_count}</dd>
        </div>
        <div>
          <dt>
            <Clock size={13} aria-hidden="true" />
            Última señal
          </dt>
          <dd className="font-mono senti9-agent-signal">
            {probe.last_heartbeat ? (
              <time dateTime={probe.last_heartbeat}>
                {lastSignal(probe.last_heartbeat)}
              </time>
            ) : (
              "Sin señal registrada"
            )}
          </dd>
        </div>
        <div>
          <dt>
            <Tag size={13} aria-hidden="true" />
            Versión reportada
          </dt>
          <dd
            className={`font-mono ${!probe.version ? "senti9-agent-unknown" : ""}`}
          >
            {probe.version || "Sin reporte"}
          </dd>
        </div>
      </dl>
      <footer className="senti9-agent-footer">
        <p
          className={`senti9-agent-message ${connected ? "is-connected" : ""}`}
        >
          {connected ? (
            <CheckCircle2 size={16} aria-hidden="true" />
          ) : state === "disconnected" || stale ? (
            <AlertCircle size={16} aria-hidden="true" />
          ) : (
            <Clock size={16} aria-hidden="true" />
          )}
          <span>{note}</span>
        </p>
        <div className="senti9-agent-actions">
          {!probe.revoked_at && canCreateMonitor && probe.is_online && (
            <Link
              className="senti9-card-action is-primary"
              to={`/monitoring?create=1&agent=${probe.id}`}
            >
              <Plus size={16} aria-hidden="true" />
              Crear monitor
            </Link>
          )}
          <button
            type="button"
            className="senti9-card-action is-secondary"
            aria-label={`Ver detalle de ${probe.name}`}
            onClick={onDetail}
          >
            Ver detalle
            <ChevronRight size={14} aria-hidden="true" />
          </button>
          {!probe.revoked_at && admin && (
            <button
              type="button"
              className="senti9-card-action is-ghost"
              aria-label={`Instalar ${probe.name}`}
              onClick={onInstall}
            >
              <Terminal size={15} aria-hidden="true" />
              Instalar
            </button>
          )}
          {!probe.revoked_at && probe.assigned_targets_count > 0 && (
            <Link
              className="senti9-card-action is-ghost"
              to={`/monitoring?agent=${probe.id}`}
            >
              Ver monitores
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          )}
        </div>
      </footer>
    </article>
  );
}
