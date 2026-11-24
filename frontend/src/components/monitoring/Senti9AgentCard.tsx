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
  Cpu,
  Plus,
  Server,
  Terminal,
} from "lucide-react";
import type { AgentProbe } from "../../types/agent_probe";
import ProbeConnectionCheck from "./ProbeConnectionCheck";

function formatRelativeTime(value: string | null): string {
  if (!value) return "Sin señal registrada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin señal registrada";

  const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSeconds < 15) return "hace unos segundos";
  if (diffSeconds < 60) return `hace ${diffSeconds}s`;
  if (diffSeconds < 3600) return `hace ${Math.floor(diffSeconds / 60)}m`;
  if (diffSeconds < 86400) return `hace ${Math.floor(diffSeconds / 3600)}h`;
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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
  const [copied, setCopied] = useState(false);
  const identifier = probe.hostname || probe.id;
  const connected = probe.is_online && !probe.revoked_at && !stale;

  const copyIdentifier = async () => {
    try {
      await navigator.clipboard.writeText(identifier);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback
    }
  };

  const getStatusBadge = () => {
    if (probe.revoked_at) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
          Revocado
        </span>
      );
    }
    if (stale) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Dato desactualizado
        </span>
      );
    }
    if (connected) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          ONLINE
        </span>
      );
    }
    if (probe.last_heartbeat) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          OFFLINE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        Esperando conexión
      </span>
    );
  };

  const getStatusMessage = () => {
    if (probe.revoked_at) return "Acceso revocado; historial conservado.";
    if (stale) return "Datos anteriores. Actualiza para verificar conexión en vivo.";
    if (!probe.last_heartbeat) return "Sin señal inicial. Esperando primer latido desde el host.";
    if (!probe.is_online) return "Sin latidos recientes. Revisa el contenedor o firewall del host.";
    if (probe.assigned_targets_count > 0) return `Sondeo activo en ${probe.assigned_targets_count} servicio(s) de red local.`;
    return "Listo para vincular tu primer monitor privado LAN.";
  };

  return (
    <article
      aria-label={probe.name}
      className={`group relative flex flex-col justify-between rounded-2xl border transition-all duration-200 bg-bg-card p-5 ${
        connected
          ? "border-white/10 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-950/20"
          : probe.revoked_at
            ? "border-white/5 opacity-60 bg-bg-dark/40"
            : "border-white/10 hover:border-border-accent"
      }`}
    >
      {/* 1. Encabezado de la Tarjeta */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`p-2.5 rounded-xl border shrink-0 transition-colors ${
                connected
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/20"
                  : probe.revoked_at
                    ? "bg-zinc-800/50 border-zinc-700/50 text-zinc-500"
                    : "bg-white/5 border-white/10 text-text-muted"
              }`}
            >
              <Server size={22} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-text-main truncate group-hover:text-emerald-400 transition-colors">
                {probe.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <button
                  type="button"
                  onClick={copyIdentifier}
                  title={`Copiar ${probe.hostname ? "hostname" : "ID"}: ${identifier}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono text-text-muted bg-bg-dark border border-white/5 hover:border-white/20 hover:text-text-main transition-colors max-w-[200px]"
                >
                  <span className="truncate">{identifier}</span>
                  {copied ? (
                    <Check size={11} className="text-emerald-400 shrink-0" />
                  ) : (
                    <Copy size={11} className="shrink-0 opacity-60" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="shrink-0">{getStatusBadge()}</div>
        </div>

        {/* 2. Métricas y Telemetría Resumida */}
        <div className="grid grid-cols-3 gap-2.5 my-4">
          <div className="p-3 rounded-xl bg-bg-dark/70 border border-white/5 flex flex-col justify-center">
            <span className="text-[10px] font-semibold tracking-wider uppercase text-text-muted flex items-center gap-1 mb-1">
              <Activity size={12} className="text-emerald-400" />
              Monitores
            </span>
            <span className="text-lg font-bold font-mono text-text-main">
              {probe.assigned_targets_count}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-bg-dark/70 border border-white/5 flex flex-col justify-center">
            <span className="text-[10px] font-semibold tracking-wider uppercase text-text-muted flex items-center gap-1 mb-1">
              <Clock size={12} className="text-sky-400" />
              Último Latido
            </span>
            <span className="text-xs font-mono text-text-main truncate" title={probe.last_heartbeat || undefined}>
              {formatRelativeTime(probe.last_heartbeat)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-bg-dark/70 border border-white/5 flex flex-col justify-center">
            <span className="text-[10px] font-semibold tracking-wider uppercase text-text-muted flex items-center gap-1 mb-1">
              <Cpu size={12} className="text-purple-400" />
              Versión
            </span>
            <span className="text-xs font-mono text-text-muted truncate">
              {probe.version ? `v${probe.version}` : "Sin datos"}
            </span>
          </div>
        </div>

        {/* 3. Comprobación y Nota de Conexión */}
        {!probe.revoked_at && (
          <div className="mb-3">
            <ProbeConnectionCheck id={probe.id} />
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-text-muted pb-3">
          {connected ? (
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={14} className="text-amber-400 shrink-0" />
          )}
          <span className="truncate">{getStatusMessage()}</span>
        </div>
      </div>

      {/* 4. Pie de Tarjeta con Acciones Rápidas */}
      <footer className="pt-3 border-t border-white/5 flex items-center justify-between gap-2 flex-wrap">
        <div>
          {!probe.revoked_at && probe.assigned_targets_count > 0 && (
            <Link
              to={`/monitoring?agent=${probe.id}`}
              className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            >
              <span>Ver {probe.assigned_targets_count} servicios</span>
              <ArrowUpRight size={13} />
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!probe.revoked_at && admin && (
            <button
              type="button"
              onClick={onInstall}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-text-main bg-white/5 hover:bg-white/10 transition-colors"
              title="Instrucciones de despliegue Docker"
            >
              <Terminal size={13} />
              <span>Desplegar</span>
            </button>
          )}

          {!probe.revoked_at && canCreateMonitor && connected && (
            <Link
              to={`/monitoring?create=1&agent=${probe.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
              title="Crear nuevo monitor LAN asignado a este agente"
            >
              <Plus size={13} />
              <span>Nuevo Monitor</span>
            </Link>
          )}

          <button
            type="button"
            onClick={onDetail}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-text-main bg-white/10 hover:bg-white/15 transition-colors"
          >
            <span>Detalle</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </footer>
    </article>
  );
}
