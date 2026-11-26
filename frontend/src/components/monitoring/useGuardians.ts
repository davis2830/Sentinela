import { useMemo } from "react";
import { Cpu, Laptop, Tag, type LucideIcon } from "lucide-react";
import type { AgentProbe } from "../../types/agent_probe";
import type {
  StatusIconShape,
  StatusTone,
} from "../common/connectivity/StatusPill";

export const GUARDIAN_HEARTBEAT_INTERVAL_SEC = 30;
export const GUARDIAN_QUEUE_WARN_THRESHOLD = 50;

export type GuardianHealthState =
  | "connected"
  | "stale_signal"
  | "disconnected"
  | "pending"
  | "paused"
  | "revoked";

export type GuardianPlatform = "linux" | "windows";
export type GuardianGroupBy = "none" | "platform" | "version";
export type GuardianDensity = "compact" | "comfortable";
export type GuardianSignalRange = "all" | "5m" | "1h" | "24h" | "stale";
export type GuardianSortField = "status" | "name" | "monitors" | "heartbeat";

export function getGuardianPlatform(probe: AgentProbe): GuardianPlatform {
  const os = (probe.os_info || "").toLowerCase();
  if (os.includes("windows") || probe.installation?.platform === "windows") {
    return "windows";
  }
  return "linux";
}

export function getGuardianHeartbeatAgeSec(probe: AgentProbe): number | null {
  if (!probe.last_heartbeat) return null;
  const ts = Date.parse(probe.last_heartbeat);
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / 1000));
}

/**
 * 3-tier heartbeat state detection (heartbeat interval = 30 s):
 * - < 2 intervals (< 60 s) or backend is_online: connected (emerald)
 * - 2 to 5 intervals (60–150 s): stale_signal ("Sin señal reciente", amber early warning)
 * - > 5 intervals (> 150 s): disconnected (rose)
 */
export function getGuardianHealthState(probe: AgentProbe): GuardianHealthState {
  if (probe.revoked_at) return "revoked";
  if (probe.enabled === false) return "paused";
  if (!probe.last_heartbeat) return "pending";

  const ageSec = getGuardianHeartbeatAgeSec(probe);
  if (ageSec === null) return probe.is_online ? "connected" : "disconnected";

  if (ageSec < GUARDIAN_HEARTBEAT_INTERVAL_SEC * 2 || probe.is_online) {
    return "connected";
  }
  if (ageSec <= GUARDIAN_HEARTBEAT_INTERVAL_SEC * 5) {
    return "stale_signal";
  }
  return "disconnected";
}

export const GUARDIAN_STATE_META: Record<
  GuardianHealthState,
  { label: string; shortLabel: string; tone: StatusTone; shape: StatusIconShape }
> = {
  connected: {
    label: "Conectado",
    shortLabel: "Conectado",
    tone: "success",
    shape: "check",
  },
  stale_signal: {
    label: "Sin señal reciente",
    shortLabel: "Sin señal",
    tone: "warning",
    shape: "alert",
  },
  disconnected: {
    label: "Desconectado",
    shortLabel: "Desconectado",
    tone: "danger",
    shape: "error",
  },
  pending: {
    label: "Esperando señal",
    shortLabel: "Esperando",
    tone: "warning",
    shape: "clock",
  },
  paused: {
    label: "Pausado",
    shortLabel: "Pausado",
    tone: "muted",
    shape: "pause",
  },
  revoked: {
    label: "Revocado",
    shortLabel: "Revocado",
    tone: "muted",
    shape: "revoked",
  },
};

export function getGuardianQueueTotal(probe: AgentProbe): number {
  const q = probe.telemetry?.snapshot?.queue;
  if (!q) return 0;
  return (q.queued || 0) + (q.running || 0) + (q.ready || 0);
}

export function isGuardianVersionOutdated(probe: AgentProbe): boolean {
  if (!probe.version || probe.revoked_at) return false;
  const latest = probe.latest_version || "1.8.0";
  const parse = (v: string) =>
    v
      .replace(/^v/i, "")
      .split(".")
      .map((n) => parseInt(n, 10) || 0);
  const a = parse(probe.version);
  const b = parse(latest);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av < bv) return true;
    if (av > bv) return false;
  }
  return false;
}

export interface GuardianSummaryMetrics {
  totalCount: number;
  connectedCount: number;
  staleCount: number;
  disconnectedCount: number;
  pendingCount: number;
  pausedCount: number;
  revokedCount: number;
  totalQueue: number;
  totalMonitors: number;
  impactedMonitors: number;
  hasAnyProblem: boolean;
}

export interface GuardianGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  probes: AgentProbe[];
  problemCount: number;
}

const STATE_PRIORITY: Record<GuardianHealthState, number> = {
  disconnected: 0,
  stale_signal: 1,
  pending: 2,
  connected: 3,
  paused: 4,
  revoked: 5,
};

interface UseGuardiansParams {
  probes: AgentProbe[];
  statusFilter: string;
  platformFilter: string;
  versionFilter: string;
  signalRangeFilter: GuardianSignalRange;
  sortField: GuardianSortField;
  sortAsc: boolean;
  groupBy: GuardianGroupBy;
}

export function useGuardians({
  probes,
  statusFilter,
  platformFilter,
  versionFilter,
  signalRangeFilter,
  sortField,
  sortAsc,
  groupBy,
}: UseGuardiansParams) {
  // 1. Summary over all loaded probes (before local status/platform/version filtering so chips stay accurate)
  const summary = useMemo<GuardianSummaryMetrics>(() => {
    let connectedCount = 0;
    let staleCount = 0;
    let disconnectedCount = 0;
    let pendingCount = 0;
    let pausedCount = 0;
    let revokedCount = 0;
    let totalQueue = 0;
    let totalMonitors = 0;
    let impactedMonitors = 0;

    for (const p of probes) {
      const state = getGuardianHealthState(p);
      if (state === "connected") connectedCount++;
      else if (state === "stale_signal") staleCount++;
      else if (state === "disconnected") disconnectedCount++;
      else if (state === "pending") pendingCount++;
      else if (state === "paused") pausedCount++;
      else if (state === "revoked") revokedCount++;

      if (state !== "revoked" && state !== "paused") {
        totalQueue += getGuardianQueueTotal(p);
      }
      const assigned = p.assigned_targets_count ?? 0;
      const activeAssigned = p.active_targets_count ?? assigned;
      totalMonitors += assigned;
      if (state === "disconnected" || state === "stale_signal") {
        impactedMonitors += activeAssigned;
      }
    }

    return {
      totalCount: probes.length,
      connectedCount,
      staleCount,
      disconnectedCount,
      pendingCount,
      pausedCount,
      revokedCount,
      totalQueue,
      totalMonitors,
      impactedMonitors,
      hasAnyProblem: disconnectedCount > 0 || staleCount > 0 || pendingCount > 0,
    };
  }, [probes]);

  // 2. Available versions for the filter dropdown
  const availableVersions = useMemo(() => {
    const set = new Set<string>();
    for (const p of probes) {
      if (p.version) set.add(p.version);
    }
    return Array.from(set).sort().reverse();
  }, [probes]);

  // 3. Filter & sort probes
  const sortedProbes = useMemo(() => {
    const filtered = probes.filter((p) => {
      const state = getGuardianHealthState(p);
      if (statusFilter !== "all" && state !== statusFilter) return false;

      if (platformFilter !== "all" && getGuardianPlatform(p) !== platformFilter) {
        return false;
      }

      if (versionFilter !== "all" && (p.version || "none") !== versionFilter) {
        return false;
      }

      if (signalRangeFilter !== "all") {
        const age = getGuardianHeartbeatAgeSec(p);
        if (signalRangeFilter === "5m" && (age === null || age > 300)) return false;
        if (signalRangeFilter === "1h" && (age === null || age > 3600)) return false;
        if (signalRangeFilter === "24h" && (age === null || age > 86400)) return false;
        if (signalRangeFilter === "stale" && (age === null || age < 60)) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      const aState = getGuardianHealthState(a);
      const bState = getGuardianHealthState(b);

      if (sortField === "status") {
        if (aState === "revoked" && bState !== "revoked") return 1;
        if (aState !== "revoked" && bState === "revoked") return -1;
        const diff = STATE_PRIORITY[aState] - STATE_PRIORITY[bState];
        if (diff !== 0) return sortAsc ? diff : -diff;
        return a.name.localeCompare(b.name);
      }
      if (sortField === "name") {
        return sortAsc
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      if (sortField === "monitors") {
        const diff =
          (a.assigned_targets_count ?? 0) - (b.assigned_targets_count ?? 0);
        return sortAsc ? diff : -diff;
      }
      if (sortField === "heartbeat") {
        const aTs = a.last_heartbeat ? Date.parse(a.last_heartbeat) : 0;
        const bTs = b.last_heartbeat ? Date.parse(b.last_heartbeat) : 0;
        return sortAsc ? bTs - aTs : aTs - bTs;
      }
      return 0;
    });

    return filtered;
  }, [
    probes,
    statusFilter,
    platformFilter,
    versionFilter,
    signalRangeFilter,
    sortField,
    sortAsc,
  ]);

  // 4. Optional grouping (Platform or Version)
  const groupedProbes = useMemo<GuardianGroup[] | null>(() => {
    if (groupBy === "none") return null;
    const map = new Map<string, GuardianGroup>();

    for (const p of sortedProbes) {
      const state = getGuardianHealthState(p);
      let key: string;
      let label: string;
      let icon: LucideIcon;

      if (groupBy === "platform") {
        const plat = getGuardianPlatform(p);
        key = plat;
        label = plat === "windows" ? "Windows" : "Linux";
        icon = plat === "windows" ? Laptop : Cpu;
      } else {
        key = p.version || "__none__";
        label = p.version ? `Versión v${p.version}` : "Sin versión reportada";
        icon = Tag;
      }

      let group = map.get(key);
      if (!group) {
        group = { key, label, icon, probes: [], problemCount: 0 };
        map.set(key, group);
      }
      group.probes.push(p);
      if (state === "disconnected" || state === "stale_signal") {
        group.problemCount++;
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.problemCount > 0 && b.problemCount === 0) return -1;
      if (b.problemCount > 0 && a.problemCount === 0) return 1;
      return a.label.localeCompare(b.label);
    });
  }, [sortedProbes, groupBy]);

  return { summary, availableVersions, sortedProbes, groupedProbes };
}

export interface GuardianHeartbeatSlot {
  status: "ok" | "stale" | "missed" | "pending" | "paused" | "revoked" | "no_data";
  cls: string;
  tooltip: string;
}

/**
 * Generates timestamped heartbeat slots (each representing 1 heartbeat interval of 30 s)
 * so every bar displays an exact local time and explicitly marks missed heartbeats in amber/red.
 */
export function getGuardianHeartbeatSlots(
  probe: AgentProbe,
  count: number,
): GuardianHeartbeatSlot[] {
  const now = Date.now();
  const intervalMs = GUARDIAN_HEARTBEAT_INTERVAL_SEC * 1000;
  const state = getGuardianHealthState(probe);
  const createdMs = probe.created_at ? Date.parse(probe.created_at) : 0;
  const lastHbMs = probe.last_heartbeat ? Date.parse(probe.last_heartbeat) : 0;

  return Array.from({ length: count }).map((_, idx) => {
    const slotEnd = now - (count - 1 - idx) * intervalMs;
    const slotStart = slotEnd - intervalMs;
    const timeStr = new Date(slotEnd).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    if (state === "revoked") {
      return {
        status: "revoked",
        cls: "bg-slate-600/75",
        tooltip: `${timeStr} · Guardián revocado`,
      };
    }

    if (state === "paused") {
      return {
        status: "paused",
        cls: "bg-slate-600/75",
        tooltip: `${timeStr} · Guardián pausado`,
      };
    }

    if (createdMs > 0 && slotEnd < createdMs) {
      return {
        status: "no_data",
        cls: "bg-slate-900/50 border border-slate-700/75",
        tooltip: `${timeStr} · Sin datos (guardián aún no registrado)`,
      };
    }

    if (state === "pending" || !Number.isFinite(lastHbMs) || lastHbMs <= 0) {
      return {
        status: "pending",
        cls: "bg-slate-900/50 border border-slate-700/75",
        tooltip: `${timeStr} · Esperando primera señal`,
      };
    }

    // Slot is after the last received heartbeat -> missed heartbeat!
    if (slotStart > lastHbMs) {
      const missedSec = Math.floor((slotEnd - lastHbMs) / 1000);
      if (missedSec <= GUARDIAN_HEARTBEAT_INTERVAL_SEC * 5) {
        return {
          status: "stale",
          cls: "bg-amber-400 hover:bg-amber-300",
          tooltip: `${timeStr} · Latido atrasado (sin señal reciente)`,
        };
      }
      return {
        status: "missed",
        cls: "bg-rose-500 hover:bg-rose-400",
        tooltip: `${timeStr} · Latido perdido (guardián desconectado)`,
      };
    }

    return {
      status: "ok",
      cls: "bg-emerald-500 hover:bg-emerald-400",
      tooltip: `${timeStr} · Latido recibido`,
    };
  });
}
