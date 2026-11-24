import { useState } from "react";
import {
  Activity,
  Check,
  Clock,
  Copy,
  Laptop,
  Layers,
  Plus,
  Server,
  Terminal,
} from "lucide-react";
import type { AgentProbe } from "../../types/agent_probe";

interface Senti9TableViewProps {
  probes: AgentProbe[];
  onSelectProbe: (probe: AgentProbe, initialTab?: "operation" | "install") => void;
  onCreateMonitor: (probeId: string) => void;
}

function formatHeartbeat(value: string | null): string {
  if (!value) return "Sin señal";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin señal";
  return date.toLocaleString();
}

export default function Senti9TableView({
  probes,
  onSelectProbe,
  onCreateMonitor,
}: Senti9TableViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      data-testid="senti9-table"
      className="connectivity-directory-table min-w-0 max-w-full bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-sm font-sans"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border-base text-text-muted text-xs bg-bg-dark/80">
              <th scope="col" className="py-3 px-4 w-32">
                Estado
              </th>
              <th scope="col" className="py-3 px-4 min-w-[220px]">
                Agente & Hostname
              </th>
              <th scope="col" className="py-3 px-4">
                Plataforma / Versión
              </th>
              <th scope="col" className="py-3 px-4 text-center w-28">
                Monitores LAN
              </th>
              <th scope="col" className="py-3 px-4">
                Última Señal (Heartbeat)
              </th>
              <th scope="col" className="py-3 px-4">
                Telemetría Local
              </th>
              <th scope="col" className="py-3 px-4 text-right min-w-[160px]">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base/40">
            {probes.map((probe) => {
              const isRevoked = Boolean(probe.revoked_at);
              const isPending = !probe.last_heartbeat;
              const isOnline = !isRevoked && probe.is_online;

              const platformIsWindows =
                probe.os_info?.toLowerCase().includes("windows") ||
                probe.installation?.platform === "windows";

              const queue = probe.telemetry?.snapshot?.queue;
              const queueTotal = queue ? queue.queued + queue.running + queue.ready : 0;

              return (
                <tr
                  key={probe.id}
                  onClick={() => onSelectProbe(probe, "operation")}
                  tabIndex={0}
                  className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectProbe(probe, "operation");
                    }
                  }}
                >
                  {/* Status Badge */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {isRevoked ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Revocado
                      </span>
                    ) : isOnline ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        Online
                      </span>
                    ) : isPending ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Esperando señal
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Desconectado
                      </span>
                    )}
                  </td>

                  {/* Name & Hostname */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-main group-hover:text-accent-green transition-colors text-sm">
                        {probe.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-muted font-mono">
                      <span>{probe.hostname || probe.id.slice(0, 8)}</span>
                      <button
                        type="button"
                        onClick={(e) => handleCopy(e, probe.hostname || probe.id, probe.id)}
                        title="Copiar identificador"
                        className="opacity-0 group-hover:opacity-100 hover:text-text-main transition-opacity"
                      >
                        {copiedId === probe.id ? (
                          <Check size={11} className="text-accent-green" />
                        ) : (
                          <Copy size={11} />
                        )}
                      </button>
                    </div>
                  </td>

                  {/* Platform & Version */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {platformIsWindows ? (
                        <Laptop size={14} className="text-accent-blue shrink-0" />
                      ) : (
                        <Terminal size={14} className="text-emerald-400 shrink-0" />
                      )}
                      <span className="text-text-main font-medium">
                        {platformIsWindows ? "Windows" : "Linux"}
                      </span>
                      {probe.version && (
                        <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-text-muted">
                          v{probe.version}
                        </span>
                      )}
                    </div>
                    {probe.ip_address && (
                      <div className="text-[11px] text-text-muted font-mono mt-0.5">
                        {probe.ip_address}
                      </div>
                    )}
                  </td>

                  {/* Assigned Targets */}
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/30 border border-white/5 font-mono text-xs text-text-main font-medium">
                      <Server size={12} className="text-accent-blue" />
                      {probe.assigned_targets_count ?? 0}
                    </span>
                  </td>

                  {/* Heartbeat */}
                  <td className="py-3.5 px-4 whitespace-nowrap text-text-muted">
                    <div className="flex items-center gap-1.5">
                      <Clock size={13} className="text-text-dim" />
                      <span className="font-mono text-xs">
                        {formatHeartbeat(probe.last_heartbeat)}
                      </span>
                    </div>
                  </td>

                  {/* Local Telemetry */}
                  <td className="py-3.5 px-4 whitespace-nowrap text-text-muted">
                    {probe.telemetry?.snapshot ? (
                      <div className="flex items-center gap-1.5">
                        <Layers size={13} className="text-accent-purple" />
                        <span className="font-mono text-xs text-text-main">
                          Cola: {queueTotal}
                        </span>
                        {probe.telemetry.snapshot.draining && (
                          <span className="text-[10px] text-amber-400 font-medium">(Drenando)</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-text-dim text-[11px]">Sin telemetría</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td
                    className="py-3.5 px-4 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onCreateMonitor(probe.id)}
                        title="Crear monitor privado en este agente"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent-green/10 hover:bg-accent-green hover:text-black text-accent-green text-xs font-medium border border-accent-green/20 transition-all"
                      >
                        <Plus size={13} />
                        <span>Monitor</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectProbe(probe, "operation")}
                        title="Ver detalle y operaciones"
                        className="p-1.5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/5 text-text-muted hover:text-text-main transition-colors"
                      >
                        <Activity size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectProbe(probe, "install")}
                        title="Comandos de instalación Docker"
                        className="p-1.5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/5 text-text-muted hover:text-text-main transition-colors"
                      >
                        <Terminal size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
