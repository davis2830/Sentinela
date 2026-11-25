import { useMemo } from "react";
import {
  Globe,
  ShieldCheck,
  Network,
  Waypoints,
  Webhook,
  Lock,
  Server,
  Cloud,
  Tag,
  type LucideIcon,
} from "lucide-react";
import type { MonitoringTarget, RecentCheckItem } from "../../types/monitoring";

export type TargetGroupBy = "none" | "senti9" | "type" | "tag";
export type TargetDensity = "compact" | "comfortable";
export type TargetSortField = "name" | "latency" | "status";
export type TargetStatusKind = "down" | "slow" | "up" | "paused" | "unknown";

export const TARGET_TYPE_ICONS: Record<string, LucideIcon> = {
  http: Globe,
  https: ShieldCheck,
  tcp: Network,
  dns: Waypoints,
  api: Webhook,
  ssl: Lock,
};

export const TARGET_TYPE_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  https: {
    bg: "bg-sky-500/10",
    text: "text-sky-400",
    border: "border-sky-500/30",
  },
  http: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/30",
  },
  tcp: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/30",
  },
  dns: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
  },
  api: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
  },
  ssl: {
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/30",
  },
};

export function isTargetGuardianPaused(target: MonitoringTarget): boolean {
  return (
    target.enabled &&
    target.runner_type === "agent" &&
    target.agent_probe_enabled === false
  );
}

export function isTargetGuardianOffline(target: MonitoringTarget): boolean {
  if (isTargetGuardianPaused(target)) return false;
  return (
    target.enabled &&
    target.runner_type === "agent" &&
    (target.agent_probe_online === false ||
      target.agent_probe_status === "offline")
  );
}

export function getTargetStatusKind(target: MonitoringTarget): TargetStatusKind {
  if (!target.enabled || isTargetGuardianPaused(target)) return "paused";
  if (isTargetGuardianOffline(target)) return "unknown";
  if (target.last_status === "down" || target.last_status === "error") return "down";
  if (target.last_status === "slow") return "slow";
  if (target.last_status === "up") return "up";
  return "unknown";
}

export interface TargetUptimeInfo {
  pct: number | null;
  pctText: string | null;
  windowLabel: string;
  isPartial: boolean;
  checks24h: number;
  coveragePct: number;
  tooltip: string;
}

function formatMonitoredDuration(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  return `${Math.max(1, hours)} h`;
}

export function getTargetUptimeInfo(target: MonitoringTarget): TargetUptimeInfo {
  if (!target.enabled || isTargetGuardianPaused(target)) {
    const byGuardian = isTargetGuardianPaused(target);
    return {
      pct: null,
      pctText: null,
      windowLabel: byGuardian ? "guardián detenido" : "en pausa",
      isPartial: true,
      checks24h: target.checks_24h ?? 0,
      coveragePct: target.coverage_24h_pct ?? 0,
      tooltip: byGuardian
        ? `Pausado: guardián detenido (${target.agent_probe_name || "LAN"})`
        : "Monitoreo pausado",
    };
  }

  // Prefer real 24h aggregated metrics from backend when available
  if (target.uptime_24h !== undefined || target.checks_24h !== undefined) {
    const checks24h = target.checks_24h ?? 0;
    const pct = target.uptime_24h ?? null;
    const coveragePct = target.coverage_24h_pct ?? 0;
    const monitoredMinutes = target.monitored_minutes_24h ?? 0;

    if (pct === null || checks24h <= 0) {
      return {
        pct: null,
        pctText: null,
        windowLabel: "Sin datos · 24 h",
        isPartial: true,
        checks24h: 0,
        coveragePct: 0,
        tooltip:
          "Sin comprobaciones registradas en las últimas 24 h (los huecos sin datos no cuentan como caída).",
      };
    }

    const pctText = `${pct === 100 ? "100" : pct.toFixed(1)} %`;
    const isPartial = coveragePct < 90;
    const durationText = formatMonitoredDuration(monitoredMinutes);

    if (!isPartial) {
      return {
        pct,
        pctText,
        windowLabel: "24 h",
        isPartial: false,
        checks24h,
        coveragePct,
        tooltip: `${pctText} sobre ${checks24h} comprobaciones en las últimas 24 h (${coveragePct}% de cobertura).`,
      };
    }

    return {
      pct,
      pctText,
      windowLabel: `parcial (${durationText})`,
      isPartial: true,
      checks24h,
      coveragePct,
      tooltip: `${pctText} sobre ${durationText} medidos (${checks24h} checks · ${coveragePct}% de las últimas 24 h). Los huecos sin datos no cuentan como caída.`,
    };
  }

  // Fallback when backend 24h annotations are not yet present in payload
  const checks = target.recent_checks;
  if (!checks || checks.length === 0) {
    return {
      pct: null,
      pctText: null,
      windowLabel: "Sin datos",
      isPartial: true,
      checks24h: 0,
      coveragePct: 0,
      tooltip: "Sin comprobaciones recientes registradas.",
    };
  }
  let up = 0;
  for (const c of checks) {
    if (c.status === "up" || c.status === "slow") up++;
  }
  const pct = (up / checks.length) * 100;
  const pctText = `${pct === 100 ? "100" : pct.toFixed(1)} %`;
  return {
    pct,
    pctText,
    windowLabel: `parcial (${checks.length} checks)`,
    isPartial: true,
    checks24h: checks.length,
    coveragePct: 0,
    tooltip: `${pctText} sobre las últimas ${checks.length} comprobaciones registradas. Los huecos sin datos no cuentan como caída.`,
  };
}

export function getTargetUptimePct(target: MonitoringTarget): number | null {
  return getTargetUptimeInfo(target).pct;
}

export interface HistorySlot {
  status: "up" | "slow" | "down" | "paused" | "no_data";
  latency: number | null;
  checked_at: string | null;
  diagnostic: string | null;
}

export function getTargetHistorySlots(
  target: MonitoringTarget,
  count: number,
): HistorySlot[] {
  if (!target.enabled || isTargetGuardianPaused(target)) {
    return Array.from({ length: count }).map(() => ({
      status: "paused",
      latency: null,
      checked_at: null,
      diagnostic: null,
    }));
  }

  const checks: RecentCheckItem[] = target.recent_checks || [];
  if (checks.length === 0) {
    return Array.from({ length: count }).map(() => ({
      status: "no_data",
      latency: null,
      checked_at: null,
      diagnostic: null,
    }));
  }

  const sliced = checks.slice(-count);
  const padCount = Math.max(0, count - sliced.length);
  const leading: HistorySlot[] = Array.from({ length: padCount }).map(() => ({
    status: "no_data",
    latency: null,
    checked_at: null,
    diagnostic: null,
  }));

  const mapped: HistorySlot[] = sliced.map((c) => ({
    status:
      c.status === "up"
        ? "up"
        : c.status === "slow"
          ? "slow"
          : c.status === "down" || c.status === "error"
            ? "down"
            : "no_data",
    latency: c.latency,
    checked_at: c.checked_at,
    diagnostic: c.diagnostic ?? null,
  }));

  return [...leading, ...mapped];
}

export interface TargetSummaryMetrics {
  totalCount: number;
  downCount: number;
  slowCount: number;
  upCount: number;
  pausedCount: number;
  avgLatency: number | null;
  uptime24h: string | null;
  uptimePartial: boolean;
  uptimeCoveragePct: number;
}

export interface TargetGroup {
  key: string;
  label: string;
  isAgent: boolean;
  icon: LucideIcon;
  targets: MonitoringTarget[];
  downCount: number;
}

interface UseTargetsParams {
  targets: MonitoringTarget[];
  sortField: TargetSortField;
  sortAsc: boolean;
  groupBy: TargetGroupBy;
  totalOrgSummary?: Record<string, number>;
}

const STATUS_PRIORITY: Record<TargetStatusKind, number> = {
  down: 0,
  slow: 1,
  unknown: 2,
  up: 3,
  paused: 4,
};

export function useTargets({
  targets,
  sortField,
  sortAsc,
  groupBy,
  totalOrgSummary,
}: UseTargetsParams) {
  // 1. Sort targets: Down first, Paused always at the end when sorting by status
  const sortedTargets = useMemo(() => {
    const list = [...targets];
    list.sort((a, b) => {
      if (sortField === "status") {
        // Paused always sinks to the bottom regardless of asc/desc when viewing by status
        if (!a.enabled && b.enabled) return 1;
        if (a.enabled && !b.enabled) return -1;

        const aWeight = STATUS_PRIORITY[getTargetStatusKind(a)];
        const bWeight = STATUS_PRIORITY[getTargetStatusKind(b)];
        if (aWeight !== bWeight) {
          return sortAsc ? aWeight - bWeight : bWeight - aWeight;
        }
        return a.name.localeCompare(b.name);
      }
      if (sortField === "name") {
        return sortAsc
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      if (sortField === "latency") {
        if (!a.enabled && b.enabled) return 1;
        if (a.enabled && !b.enabled) return -1;
        const aLat = a.last_latency ?? -1;
        const bLat = b.last_latency ?? -1;
        return sortAsc ? aLat - bLat : bLat - aLat;
      }
      return 0;
    });
    return list;
  }, [targets, sortField, sortAsc]);

  // 2. Shared summary metrics & weighted Uptime 24h
  const summary = useMemo<TargetSummaryMetrics>(() => {
    const totalCount = totalOrgSummary?.total ?? targets.length;
    const downCount =
      totalOrgSummary?.down ??
      targets.filter((t) => getTargetStatusKind(t) === "down").length;
    const slowCount =
      totalOrgSummary?.slow ??
      targets.filter((t) => getTargetStatusKind(t) === "slow").length;
    const upCount =
      totalOrgSummary?.up ??
      targets.filter((t) => getTargetStatusKind(t) === "up").length;
    const pausedCount =
      totalOrgSummary?.paused ?? targets.filter((t) => !t.enabled).length;

    const activeLatencies = targets
      .filter(
        (t) =>
          t.enabled &&
          getTargetStatusKind(t) !== "down" &&
          typeof t.last_latency === "number" &&
          t.last_latency >= 0,
      )
      .map((t) => t.last_latency as number);

    const avgLatency = activeLatencies.length
      ? Math.round(
          activeLatencies.reduce((acc, v) => acc + v, 0) / activeLatencies.length,
        )
      : null;

    // Compute weighted 24h uptime & coverage across active targets (never fabricate 100% if 0 checks)
    let totalChecks = 0;
    let upChecks = 0;
    let coverageSum = 0;
    let coverageTargets = 0;

    for (const t of targets) {
      if (!t.enabled) continue;
      if (t.checks_24h !== undefined && t.uptime_24h !== undefined) {
        const count = t.checks_24h || 0;
        if (count > 0 && t.uptime_24h !== null) {
          totalChecks += count;
          upChecks += (t.uptime_24h / 100) * count;
        }
        coverageSum += t.coverage_24h_pct ?? 0;
        coverageTargets++;
      } else if (t.recent_checks?.length) {
        for (const c of t.recent_checks) {
          totalChecks++;
          if (c.status === "up" || c.status === "slow") upChecks++;
        }
        coverageSum += 0;
        coverageTargets++;
      }
    }

    const uptime24h =
      totalChecks > 0 ? ((upChecks / totalChecks) * 100).toFixed(1) : null;
    const uptimeCoveragePct =
      coverageTargets > 0 ? Math.round(coverageSum / coverageTargets) : 0;
    const uptimePartial = uptimeCoveragePct < 90;

    return {
      totalCount,
      downCount,
      slowCount,
      upCount,
      pausedCount,
      avgLatency,
      uptime24h,
      uptimePartial,
      uptimeCoveragePct,
    };
  }, [targets, totalOrgSummary]);

  // 3. Shared grouping (Senti9/Cloud, Protocol, Tag)
  const groupedTargets = useMemo<TargetGroup[] | null>(() => {
    if (groupBy === "none") return null;
    const map = new Map<string, TargetGroup>();

    const pushToGroup = (
      key: string,
      label: string,
      icon: LucideIcon,
      isAgent: boolean,
      target: MonitoringTarget,
    ) => {
      let existing = map.get(key);
      if (!existing) {
        existing = { key, label, icon, isAgent, targets: [], downCount: 0 };
        map.set(key, existing);
      }
      existing.targets.push(target);
      if (getTargetStatusKind(target) === "down") {
        existing.downCount++;
      }
    };

    for (const t of sortedTargets) {
      if (groupBy === "senti9") {
        const isAgent = t.runner_type === "agent";
        const key = isAgent ? `agent:${t.agent_probe_name || "LAN"}` : "cloud";
        const label = isAgent
          ? `Guardián Senti9: ${(t.agent_probe_name || "LAN").replace(/^Senti9:\s*/i, "")}`
          : "Monitoreo Nube Sentinel";
        pushToGroup(key, label, isAgent ? Server : Cloud, isAgent, t);
      } else if (groupBy === "type") {
        const key = t.target_type;
        const label = `Protocolo ${t.target_type.toUpperCase()}`;
        pushToGroup(key, label, TARGET_TYPE_ICONS[t.target_type] || Globe, false, t);
      } else if (groupBy === "tag") {
        const cleanTags = (t.tags || [])
          .map((tag) => tag.replace(/^Senti9:\s*/i, "").trim())
          .filter(Boolean);
        if (cleanTags.length === 0) {
          pushToGroup("__untagged__", "Sin etiqueta", Tag, false, t);
        } else {
          // Primary tag determines the group so each target renders once
          const primaryTag = cleanTags[0];
          pushToGroup(`tag:${primaryTag}`, `#${primaryTag}`, Tag, false, t);
        }
      }
    }

    // Order groups with down targets first, then alphabetically (Sin etiqueta last)
    return Array.from(map.values()).sort((a, b) => {
      if (a.downCount > 0 && b.downCount === 0) return -1;
      if (b.downCount > 0 && a.downCount === 0) return 1;
      if (a.key === "__untagged__") return 1;
      if (b.key === "__untagged__") return -1;
      return a.label.localeCompare(b.label);
    });
  }, [sortedTargets, groupBy]);

  return { sortedTargets, summary, groupedTargets };
}
