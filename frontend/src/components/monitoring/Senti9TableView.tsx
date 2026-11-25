import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Laptop,
  MoreHorizontal,
  Plus,
  RotateCw,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import type { AgentProbe } from "../../types/agent_probe";
import RelativeTime, {
  formatExactDate,
  formatExactTime,
} from "../common/connectivity/RelativeTime";
import StatusPill from "../common/connectivity/StatusPill";
import {
  GUARDIAN_QUEUE_WARN_THRESHOLD,
  GUARDIAN_STATE_META,
  getGuardianHealthState,
  getGuardianPlatform,
  getGuardianQueueTotal,
  isGuardianVersionOutdated,
  type GuardianDensity,
  type GuardianGroup,
  type GuardianSortField,
} from "./useGuardians";

export type GuardianActionSection = "operation" | "install" | "security" | "revoke";

interface Senti9TableViewProps {
  sortedProbes: AgentProbe[];
  groupedProbes: GuardianGroup[] | null;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  density: GuardianDensity;
  sortField: GuardianSortField;
  sortAsc: boolean;
  onSortChange: (field: GuardianSortField) => void;
  admin: boolean;
  canCreateMonitor: boolean;
  onSelectProbe: (probe: AgentProbe, section?: GuardianActionSection) => void;
  onCreateMonitor: (probeId: string) => void;
}

export default function Senti9TableView({
  sortedProbes,
  groupedProbes,
  collapsedGroups,
  onToggleGroup,
  density,
  sortField,
  sortAsc,
  onSortChange,
  admin,
  canCreateMonitor,
  onSelectProbe,
  onCreateMonitor,
}: Senti9TableViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openMenuId) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuId(null);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [openMenuId]);

  const handleCopy = async (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const isCompact = density === "compact";
  const paddingY = isCompact ? "py-2.5" : "py-3.5";

  const renderRow = (probe: AgentProbe) => {
    const state = getGuardianHealthState(probe);
    const meta = GUARDIAN_STATE_META[state];
    const platform = getGuardianPlatform(probe);
    const isRevoked = state === "revoked";
    const isDisconnected = state === "disconnected";
    const isStale = state === "stale_signal";
    const isPending = state === "pending";
    const outdated = isGuardianVersionOutdated(probe);

    const assigned = probe.assigned_targets_count ?? 0;
    const activeAssigned = probe.active_targets_count ?? assigned;
    const downAssigned = probe.down_targets_count ?? 0;
    const queueTotal = getGuardianQueueTotal(probe);
    const queueWarn = queueTotal >= GUARDIAN_QUEUE_WARN_THRESHOLD;
    const draining = Boolean(probe.telemetry?.snapshot?.draining);
    const menuOpen = openMenuId === probe.id;

    const identifier = probe.hostname || probe.id.slice(0, 12);
    const rowBgClass = isRevoked
      ? "bg-bg-dark/25 opacity-70 hover:opacity-90 hover:bg-white/[0.02]"
      : isDisconnected
        ? "bg-[#1c1217] border-l-2 border-l-rose-500 hover:bg-[#25161e]"
        : isStale
          ? "bg-amber-500/[0.04] border-l-2 border-l-amber-400 hover:bg-amber-500/[0.08]"
          : "hover:bg-white/[0.03]";

    return (
      <tr
        key={probe.id}
        onClick={() => onSelectProbe(probe, "operation")}
        tabIndex={0}
        aria-label={probe.name}
        onKeyDown={(e) => {
          if (
            e.target === e.currentTarget &&
            (e.key === "Enter" || e.key === " ")
          ) {
            e.preventDefault();
            onSelectProbe(probe, "operation");
          }
        }}
        className={`group cursor-pointer transition-colors border-b border-border-base/60 ${rowBgClass}`}
      >
        {/* 1. Estado (Shape + color pill) */}
        <td className={`${paddingY} px-3 whitespace-nowrap w-[148px]`}>
          <StatusPill
            size="xs"
            label={meta.label}
            tone={meta.tone}
            shape={meta.shape}
            title={
              isDisconnected && probe.last_heartbeat
                ? `Desconectado desde las ${formatExactTime(probe.last_heartbeat)}`
                : isPending
                  ? `Esperando señal inicial desde ${formatExactDate(probe.created_at)}`
                  : isRevoked && probe.revoked_at
                    ? `Revocado el ${formatExactDate(probe.revoked_at)}`
                    : meta.label
            }
          />
        </td>

        {/* 2. Guardián: Name + hash + IP in a single compact line */}
        <td className={`${paddingY} px-3 w-full max-w-0`}>
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`shrink-0 font-semibold text-xs transition-colors ${
                isDisconnected
                  ? "text-rose-300 font-bold"
                  : isRevoked
                    ? "text-slate-400"
                    : "text-text-main group-hover:text-accent-green"
              }`}
              title={probe.name}
            >
              {probe.name}
            </span>
            <span
              className="truncate font-mono text-[11px] text-text-dim"
              title={`${identifier}${probe.ip_address ? ` · ${probe.ip_address}` : ""}`}
            >
              {identifier}
              {probe.ip_address ? ` · ${probe.ip_address}` : ""}
            </span>
            <button
              type="button"
              onClick={(e) => handleCopy(e, identifier, probe.id)}
              title="Copiar identificador"
              aria-label={`Copiar identificador de ${probe.name}`}
              className="shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 text-text-dim hover:text-text-main transition-opacity cursor-pointer !min-h-0 !min-w-0"
            >
              {copiedId === probe.id ? (
                <Check size={11} className="text-accent-green" />
              ) : (
                <Copy size={11} />
              )}
            </button>
          </div>

          {!isCompact && isDisconnected && probe.last_heartbeat && (
            <p className="mt-0.5 text-[11px] font-mono text-rose-400/90 truncate">
              desconectado desde las {formatExactTime(probe.last_heartbeat)}
            </p>
          )}
          {!isCompact && isRevoked && probe.revocation_reason && (
            <p className="mt-0.5 text-[11px] text-slate-500 truncate">
              Motivo: {probe.revocation_reason}
            </p>
          )}
        </td>

        {/* 3. Plataforma y versión en una línea */}
        <td className={`${paddingY} px-3 whitespace-nowrap w-[150px]`}>
          <div className="flex items-center gap-1.5 text-xs">
            {platform === "windows" ? (
              <Laptop size={13} className="text-sky-400 shrink-0" />
            ) : (
              <Terminal size={13} className="text-emerald-400 shrink-0" />
            )}
            <span className={isRevoked ? "text-slate-400" : "text-text-main font-medium"}>
              {platform === "windows" ? "Windows" : "Linux"}
            </span>
            {probe.version && (
              <span
                className="inline-flex items-center gap-1 font-mono text-[11px] text-text-dim"
                title={
                  outdated
                    ? `Actualización disponible (v${probe.latest_version || "1.8.0"})`
                    : `Versión v${probe.version} (actualizada)`
                }
              >
                <span>· v{probe.version}</span>
                {outdated && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
                    aria-label="Actualización disponible"
                  />
                )}
              </span>
            )}
          </div>
        </td>

        {/* 4. Monitores LAN (link directo a Uptime filtrado por este guardián) */}
        <td
          className={`${paddingY} px-3 whitespace-nowrap w-[170px]`}
          onClick={(e) => e.stopPropagation()}
        >
          {assigned > 0 ? (
            <Link
              to={`/monitoring?agent=${probe.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-mono hover:underline"
              title="Ver monitores LAN de este guardián en Uptime"
            >
              <span className={isRevoked ? "text-slate-400" : "text-text-main font-semibold"}>
                {assigned} {assigned === 1 ? "monitor" : "monitores"}
              </span>
              {(isDisconnected || isStale) && activeAssigned > 0 ? (
                <span className="text-[11px] font-semibold text-rose-400">
                  · {activeAssigned}{" "}
                  {activeAssigned === 1 ? "afectado" : "afectados"}
                </span>
              ) : !isRevoked && downAssigned > 0 ? (
                <span className="text-[11px] font-semibold text-rose-400">
                  · {downAssigned} {downAssigned === 1 ? "caído" : "caídos"}
                </span>
              ) : null}
            </Link>
          ) : (
            <span className="text-[11px] font-mono text-text-dim">
              Sin monitores
            </span>
          )}
        </td>

        {/* 5. Última señal (relativa + fecha exacta en tooltip) */}
        <td className={`${paddingY} px-3 whitespace-nowrap w-[135px]`}>
          {isPending ? (
            <RelativeTime
              value={probe.created_at}
              prefix="esperando"
              className="text-[11px] text-amber-300"
            />
          ) : isRevoked ? (
            <RelativeTime
              value={probe.revoked_at}
              emptyLabel="Revocado"
              className="text-[11px] text-slate-500"
            />
          ) : (
            <RelativeTime
              value={probe.last_heartbeat}
              className={`text-xs ${
                isDisconnected
                  ? "text-rose-400 font-semibold"
                  : isStale
                    ? "text-amber-400 font-semibold"
                    : "text-text-muted"
              }`}
            />
          )}
        </td>

        {/* 6. Telemetría (Cola 0 en gris, ámbar >= 50) */}
        <td className={`${paddingY} px-3 whitespace-nowrap w-[110px]`}>
          {isRevoked || isPending ? (
            <span className="font-mono text-[11px] text-text-dim">—</span>
          ) : probe.telemetry?.snapshot ? (
            <span
              className={`font-mono text-xs ${
                queueWarn || draining
                  ? "text-amber-400 font-semibold"
                  : "text-text-dim"
              }`}
              title={
                draining
                  ? "Guardián drenando cola antes de detenerse"
                  : "Mediciones pendientes de enviar a Sentinel"
              }
            >
              Cola {queueTotal}
              {draining ? " · Dren." : ""}
            </span>
          ) : (
            <span className="font-mono text-[11px] text-text-dim">—</span>
          )}
        </td>

        {/* 7. Acciones (mismo fondo que la fila, visibles en hover/focus/táctil + menú ⋯) */}
        <td
          className={`${paddingY} px-3 text-right whitespace-nowrap w-[110px] bg-inherit`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-end gap-1">
            {!isRevoked && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => onSelectProbe(probe, "operation")}
                  title="Ver estado y telemetría"
                  aria-label={`Ver detalle de ${probe.name}`}
                  className="table-action-btn h-6 w-6 grid place-items-center rounded text-text-dim hover:text-accent-green hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
                >
                  <Activity size={13} />
                </button>
                {admin && (
                  <button
                    type="button"
                    onClick={() => onSelectProbe(probe, "install")}
                    title="Instrucciones de despliegue Docker"
                    aria-label={`Instrucciones Docker de ${probe.name}`}
                    className="table-action-btn h-6 w-6 grid place-items-center rounded text-text-dim hover:text-sky-400 hover:bg-white/10 transition-colors cursor-pointer !min-h-0 !min-w-0"
                  >
                    <Terminal size={13} />
                  </button>
                )}
              </div>
            )}

            {/* Overflow ⋯ menu */}
            <div ref={menuOpen ? menuRef : undefined} className="relative">
              <button
                type="button"
                onClick={() => setOpenMenuId(menuOpen ? null : probe.id)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={`Más acciones para ${probe.name}`}
                title="Más acciones"
                className={`table-action-btn h-6 w-6 grid place-items-center rounded text-text-dim hover:text-text-main hover:bg-white/10 transition-all cursor-pointer !min-h-0 !min-w-0 ${
                  menuOpen
                    ? "opacity-100 bg-white/10 text-text-main"
                    : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
                }`}
              >
                <MoreHorizontal size={14} />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-7 z-30 w-48 rounded-xl border border-border-base bg-bg-dark/98 backdrop-blur-md p-1 shadow-2xl text-xs text-left animate-in fade-in zoom-in-95 duration-100"
                >
                  {!isRevoked && canCreateMonitor && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpenMenuId(null);
                        onCreateMonitor(probe.id);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text-main hover:bg-bg-card-hover transition-colors cursor-pointer !min-h-0"
                    >
                      <Plus size={13} className="text-accent-green shrink-0" />
                      <span>Agregar monitor LAN</span>
                    </button>
                  )}

                  {!isRevoked && admin && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpenMenuId(null);
                        onSelectProbe(probe, "install");
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text-main hover:bg-bg-card-hover transition-colors cursor-pointer !min-h-0"
                    >
                      <Terminal size={13} className="text-sky-400 shrink-0" />
                      <span>
                        {outdated
                          ? "Actualizar guardián"
                          : "Comando de instalación"}
                      </span>
                    </button>
                  )}

                  {!isRevoked && admin && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpenMenuId(null);
                        onSelectProbe(probe, "security");
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text-main hover:bg-bg-card-hover transition-colors cursor-pointer !min-h-0"
                    >
                      <RotateCw size={13} className="text-amber-400 shrink-0" />
                      <span>Rotar token</span>
                    </button>
                  )}

                  {!isRevoked && admin && (
                    <>
                      <div className="my-1 border-t border-border-base/70" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setOpenMenuId(null);
                          onSelectProbe(probe, "revoke");
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer !min-h-0"
                      >
                        <ShieldAlert size={13} className="shrink-0" />
                        <span>Revocar guardián</span>
                      </button>
                    </>
                  )}

                  {isRevoked && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpenMenuId(null);
                        onSelectProbe(probe, "security");
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text-main hover:bg-bg-card-hover transition-colors cursor-pointer !min-h-0"
                    >
                      <Activity size={13} className="text-slate-400 shrink-0" />
                      <span>Ver auditoría de retiro</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div
      data-testid="senti9-table"
      className="connectivity-directory-table w-full max-w-[1400px] mx-auto bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-xl font-sans"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-text-main border-collapse">
          <thead className="sticky top-0 z-10 bg-bg-dark/95 backdrop-blur-md border-b border-border-base">
            <tr className="bg-bg-dark/90 font-semibold text-text-dim select-none">
              <th
                scope="col"
                aria-sort={
                  sortField === "status"
                    ? sortAsc
                      ? "ascending"
                      : "descending"
                    : "none"
                }
                className="py-2 px-3 cursor-pointer hover:text-text-main w-[148px]"
                onClick={() => onSortChange("status")}
                title="Ordenar por estado (problemas primero)"
              >
                <div className="flex items-center gap-1">
                  <span>Estado</span>
                  <ArrowUpDown
                    size={11}
                    className={
                      sortField === "status"
                        ? "text-accent-green"
                        : "text-text-dim"
                    }
                  />
                </div>
              </th>
              <th
                scope="col"
                className="py-2 px-3 cursor-pointer hover:text-text-main w-full"
                onClick={() => onSortChange("name")}
                title="Ordenar por nombre"
              >
                <div className="flex items-center gap-1">
                  <span>Guardián</span>
                  <ArrowUpDown
                    size={11}
                    className={
                      sortField === "name"
                        ? "text-accent-green"
                        : "text-text-dim"
                    }
                  />
                </div>
              </th>
              <th scope="col" className="py-2 px-3 w-[150px]">
                Plataforma
              </th>
              <th
                scope="col"
                className="py-2 px-3 cursor-pointer hover:text-text-main w-[170px]"
                onClick={() => onSortChange("monitors")}
                title="Ordenar por monitores asignados"
              >
                <div className="flex items-center gap-1">
                  <span>Monitores</span>
                  <ArrowUpDown
                    size={11}
                    className={
                      sortField === "monitors"
                        ? "text-accent-green"
                        : "text-text-dim"
                    }
                  />
                </div>
              </th>
              <th
                scope="col"
                className="py-2 px-3 cursor-pointer hover:text-text-main w-[135px]"
                onClick={() => onSortChange("heartbeat")}
                title="Ordenar por última señal"
              >
                <div className="flex items-center gap-1">
                  <span>Última señal</span>
                  <ArrowUpDown
                    size={11}
                    className={
                      sortField === "heartbeat"
                        ? "text-accent-green"
                        : "text-text-dim"
                    }
                  />
                </div>
              </th>
              <th scope="col" className="py-2 px-3 w-[110px]">
                Telemetría
              </th>
              <th
                scope="col"
                className="py-2 px-3 text-right w-[110px] bg-inherit"
              >
                Acciones
              </th>
            </tr>
          </thead>

          {groupedProbes ? (
            groupedProbes.map((group) => {
              const isCollapsed = Boolean(collapsedGroups[group.key]);
              const GroupIcon = group.icon;

              return (
                <tbody
                  key={group.key}
                  className="border-b border-border-base/50"
                >
                  <tr
                    onClick={() => onToggleGroup(group.key)}
                    className="bg-bg-dark/70 hover:bg-bg-dark cursor-pointer transition-colors border-y border-border-base/60 select-none"
                  >
                    <td colSpan={7} className="py-1.5 px-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isCollapsed ? (
                            <ChevronRight size={13} className="text-text-dim" />
                          ) : (
                            <ChevronDown
                              size={13}
                              className="text-accent-green"
                            />
                          )}
                          <GroupIcon
                            size={13}
                            className="text-sky-400 shrink-0"
                          />
                          <span className="font-semibold text-text-main text-xs">
                            {group.label}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-bg-card border border-border-base text-text-muted">
                            {group.probes.length}{" "}
                            {group.probes.length === 1
                              ? "guardián"
                              : "guardianes"}
                          </span>
                          {group.problemCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400">
                              {group.problemCount} con alerta
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-text-dim">
                          {isCollapsed ? "Expandir" : "Colapsar"}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {!isCollapsed && group.probes.map(renderRow)}
                </tbody>
              );
            })
          ) : (
            <tbody>{sortedProbes.map(renderRow)}</tbody>
          )}
        </table>
      </div>
    </div>
  );
}
