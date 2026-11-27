import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpDown,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Cpu,
  Laptop,
  Plus,
  Server,
} from "lucide-react";
import type { AgentProbe } from "../../types/agent_probe";
import RelativeTime, {
  formatExactDate,
  formatExactTime,
} from "../common/connectivity/RelativeTime";
import StatusPill from "../common/connectivity/StatusPill";
import {
  TABLE_HEAD_CELL,
  TABLE_HEAD_ROW,
  getTableRowClass,
} from "../common/connectivity/tableTokens";
import GuardianRowActions from "./GuardianRowActions";
import {
  GUARDIAN_STATE_META,
  getGuardianDeliverySummary,
  getGuardianHealthState,
  getGuardianPlatform,
  isGuardianVersionOutdated,
  type GuardianDensity,
  type GuardianGroup,
  type GuardianSortField,
} from "./useGuardians";

export type GuardianActionSection =
  | "operation"
  | "install"
  | "security"
  | "revoke";

interface Senti9TableViewProps {
  sortedProbes: AgentProbe[];
  groupedProbes: GuardianGroup[] | null;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  density: GuardianDensity;
  hasFilters: boolean;
  sortField: GuardianSortField;
  sortAsc: boolean;
  onSortChange: (field: GuardianSortField) => void;
  admin: boolean;
  canCreateMonitor: boolean;
  onSelectProbe: (probe: AgentProbe, section?: GuardianActionSection) => void;
  onCreateMonitor: (probeId: string) => void;
  onToggleProbe: (probe: AgentProbe) => void;
}

export default function Senti9TableView({
  sortedProbes,
  groupedProbes,
  collapsedGroups,
  onToggleGroup,
  density,
  hasFilters,
  sortField,
  sortAsc,
  onSortChange,
  admin,
  canCreateMonitor,
  onSelectProbe,
  onCreateMonitor,
  onToggleProbe,
}: Senti9TableViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
  const rowHeightClass = getTableRowClass(density);
  const paddingY = "py-0 align-middle";

  const renderRow = (probe: AgentProbe) => {
    const state = getGuardianHealthState(probe);
    const meta = GUARDIAN_STATE_META[state];
    const platform = getGuardianPlatform(probe);
    const isRevoked = state === "revoked";
    const isPaused = state === "paused";
    const isMuted = isRevoked || isPaused;
    const isDisconnected = state === "disconnected";
    const isStale = state === "stale_signal";
    const isPending = state === "pending";
    const outdated = isGuardianVersionOutdated(probe);

    const assigned = probe.assigned_targets_count ?? 0;
    const activeAssigned = probe.active_targets_count ?? assigned;
    const downAssigned = probe.down_targets_count ?? 0;
    const deliverySummary = getGuardianDeliverySummary(probe);
    const deliveryToneClass =
      deliverySummary.tone === "danger"
        ? "text-rose-400 font-semibold"
        : deliverySummary.tone === "warning"
          ? "text-amber-400 font-semibold"
          : deliverySummary.tone === "ok"
            ? "text-text-muted"
            : "text-text-dim";

    const identifier = probe.hostname || probe.id.slice(0, 12);
    const rowBgClass = isMuted
      ? "bg-bg-dark/25 opacity-75 hover:opacity-95 hover:bg-white/[0.03]"
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
        className={`group ${rowHeightClass} cursor-pointer transition-colors border-b border-border-base/60 ${rowBgClass}`}
      >
        {/* 1. Estado */}
        <td className={`${paddingY} px-3 whitespace-nowrap w-[144px]`}>
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

        {/* 2. Guardián (absorbe el espacio disponible con truncate; columnas derechas fijas) */}
        <td className={`${paddingY} px-3 max-w-0`}>
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`shrink-0 max-w-[45%] truncate font-semibold text-xs transition-colors ${isMuted
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
              className="compact-btn shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 text-text-dim hover:text-text-main transition-opacity cursor-pointer"
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

        {/* 3. Plataforma (Cpu para Linux, Laptop para Windows; nunca >_) */}
        <td className={`${paddingY} px-3 whitespace-nowrap w-[132px]`}>
          <div className="flex items-center gap-1.5 text-xs">
            {platform === "windows" ? (
              <Laptop size={13} className="text-sky-400 shrink-0" />
            ) : (
              <Cpu size={13} className="text-emerald-400 shrink-0" />
            )}
            <span
              className={
                isMuted ? "text-slate-400" : "text-text-main font-medium"
              }
            >
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

        {/* 4. Monitores LAN (enlace clicable directo a Uptime filtrado por este guardián) */}
        <td
          className={`${paddingY} px-3 whitespace-nowrap w-[150px]`}
          onClick={(e) => e.stopPropagation()}
        >
          {assigned > 0 ? (
            <Link
              to={`/monitoring?agent=${probe.id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2 py-0.5 -ml-2 rounded-md text-xs font-mono hover:bg-accent-green/10 hover:text-accent-green transition-colors group/link"
              title="Ver monitores LAN de este guardián en Uptime"
            >
              <span
                className={
                  isMuted
                    ? "text-slate-400"
                    : "text-text-main font-semibold group-hover/link:text-accent-green"
                }
              >
                {assigned} {assigned === 1 ? "monitor" : "monitores"}
              </span>
              {(isDisconnected || isStale) && activeAssigned > 0 ? (
                <span className="text-[11px] font-semibold text-rose-400">
                  · {activeAssigned}{" "}
                  {activeAssigned === 1 ? "afectado" : "afectados"}
                </span>
              ) : !isMuted && downAssigned > 0 ? (
                <span className="text-[11px] font-semibold text-rose-400">
                  · {downAssigned} {downAssigned === 1 ? "caído" : "caídos"}
                </span>
              ) : null}
              <ArrowUpRight
                size={11}
                className="text-text-dim opacity-60 group-hover/link:opacity-100 group-hover/link:text-accent-green shrink-0"
              />
            </Link>
          ) : (
            <span className="text-[11px] font-mono text-text-dim">
              Sin monitores
            </span>
          )}
        </td>

        {/* 5. Señal (RelativeTime en una sola línea) */}
        <td className={`${paddingY} px-3 whitespace-nowrap w-[112px]`}>
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
          ) : isPaused ? (
            <span
              className="font-mono text-[11px] text-slate-400"
              title={
                probe.last_heartbeat
                  ? `Pausado · último latido ${formatExactDate(probe.last_heartbeat)}`
                  : "Guardián pausado"
              }
            >
              Pausado
            </span>
          ) : (
            <RelativeTime
              value={probe.last_heartbeat}
              className={`text-xs ${isDisconnected
                ? "text-rose-400 font-semibold"
                : isStale
                  ? "text-amber-400 font-semibold"
                  : "text-text-muted"
                }`}
            />
          )}
        </td>

        {/* 6. Entrega & Cola (datos reales del ledger del servidor y telemetría) */}
        <td className={`${paddingY} px-3 whitespace-nowrap`}>
          <span
            className={`font-mono text-xs ${deliveryToneClass}`}
            title={deliverySummary.tooltip}
          >
            {deliverySummary.label}
          </span>
        </td>

        {/* 7. Acciones (fondo transparente para heredar exactamente el bg de la fila sin duplicar alfa) */}
        <td
          className={`${paddingY} px-3 text-right whitespace-nowrap w-[144px] bg-transparent`}
          onClick={(e) => e.stopPropagation()}
        >
          <GuardianRowActions
            probe={probe}
            admin={admin}
            canCreateMonitor={canCreateMonitor}
            variant="table"
            onSelect={onSelectProbe}
            onCreateMonitor={onCreateMonitor}
            onToggle={onToggleProbe}
          />
        </td>
      </tr>
    );
  };

  const emptyGuardians =
    !hasFilters && canCreateMonitor
      ? sortedProbes.filter(
          (p) =>
            (p.assigned_targets_count ?? 0) === 0 &&
            !p.revoked_at &&
            p.enabled !== false,
        )
      : [];

  return (
    <div
      data-testid="senti9-table"
      className="connectivity-directory-table w-full max-w-[1400px] mx-auto bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-xl font-sans"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] table-fixed text-left text-xs text-text-main border-collapse">
          <colgroup>
            <col className="w-[144px]" />
            <col />
            <col className="w-[144px]" />
            <col className="w-[156px]" />
            <col className="w-[118px]" />
            <col className="w-[132px]" />
            <col className="w-[168px]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-bg-dark/95 backdrop-blur-md border-b border-border-base">
            <tr
              className={`${TABLE_HEAD_ROW} bg-bg-dark/90 font-semibold text-text-dim select-none`}
            >
              <th
                scope="col"
                aria-sort={
                  sortField === "status"
                    ? sortAsc
                      ? "ascending"
                      : "descending"
                    : "none"
                }
                className={`${TABLE_HEAD_CELL} whitespace-nowrap cursor-pointer hover:text-text-main`}
                onClick={() => onSortChange("status")}
                title="Ordenar por estado (problemas primero)"
              >
                <div className="inline-flex items-center gap-1 whitespace-nowrap">
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
                aria-sort={
                  sortField === "name"
                    ? sortAsc
                      ? "ascending"
                      : "descending"
                    : "none"
                }
                className={`${TABLE_HEAD_CELL} whitespace-nowrap cursor-pointer hover:text-text-main`}
                onClick={() => onSortChange("name")}
                title="Ordenar por nombre"
              >
                <div className="inline-flex items-center gap-1 whitespace-nowrap">
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
              <th scope="col" className={`${TABLE_HEAD_CELL} whitespace-nowrap`}>
                Plataforma
              </th>
              <th
                scope="col"
                aria-sort={
                  sortField === "monitors"
                    ? sortAsc
                      ? "ascending"
                      : "descending"
                    : "none"
                }
                className={`${TABLE_HEAD_CELL} whitespace-nowrap cursor-pointer hover:text-text-main`}
                onClick={() => onSortChange("monitors")}
                title="Ordenar por monitores asignados"
              >
                <div className="inline-flex items-center gap-1 whitespace-nowrap">
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
                aria-sort={
                  sortField === "heartbeat"
                    ? sortAsc
                      ? "ascending"
                      : "descending"
                    : "none"
                }
                className={`${TABLE_HEAD_CELL} whitespace-nowrap cursor-pointer hover:text-text-main`}
                onClick={() => onSortChange("heartbeat")}
                title="Ordenar por última señal"
              >
                <div className="inline-flex items-center gap-1 whitespace-nowrap">
                  <span>Señal</span>
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
              <th scope="col" className={`${TABLE_HEAD_CELL} whitespace-nowrap`}>
                Entrega / Cola
              </th>
              <th
                scope="col"
                className={`${TABLE_HEAD_CELL} text-right whitespace-nowrap bg-transparent`}
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

      {/* Conditional notice row below table ONLY when 1+ active guardians have 0 monitors */}
      {emptyGuardians.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-t border-border-base/60 bg-bg-dark/35 text-xs">
          <div className="flex items-center gap-2 text-text-muted min-w-0">
            <Server size={13} className="text-text-dim shrink-0" />
            <span className="truncate">
              {emptyGuardians.length === 1
                ? `${emptyGuardians[0].name} no tiene monitores asignados todavía.`
                : `${emptyGuardians.length} guardianes (${emptyGuardians
                    .slice(0, 2)
                    .map((g) => g.name)
                    .join(", ")}${emptyGuardians.length > 2 ? "…" : ""}) no tienen monitores asignados.`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onCreateMonitor(emptyGuardians[0].id)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-accent-green/15 hover:bg-accent-green text-accent-green hover:text-black border border-accent-green/35 transition-colors cursor-pointer shrink-0 !min-h-0"
          >
            <Plus size={12} />
            <span>Crear monitor</span>
          </button>
        </div>
      )}
    </div>
  );
}
