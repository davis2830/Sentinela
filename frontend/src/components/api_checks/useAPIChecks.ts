import { useMemo } from "react";
import { Globe, Plug, ShieldAlert, type LucideIcon } from "lucide-react";
import type { APICheckTarget, HTTPMethod } from "../../types/api_checks";
import { hasMeasurement } from "../../utils/healthPresentation";
import type {
  StatusIconShape,
  StatusTone,
} from "../common/connectivity/StatusPill";
import type { TableDensity } from "../common/connectivity/tableTokens";

export type APICheckHealthState =
  | "fail"
  | "slow"
  | "pass"
  | "paused"
  | "pending";

export type APICheckSortField =
  | "status"
  | "name"
  | "method"
  | "latency"
  | "last_checked";

export type APICheckGroupBy = "none" | "status" | "method" | "host";
export type APICheckSchemaFilter = "all" | "with_schema" | "without_schema";
export type APICheckDensity = TableDensity;

export interface APICheckStateMeta {
  label: string;
  tone: StatusTone;
  shape: StatusIconShape;
  textClass: string;
  rank: number;
}

export const API_STATE_META: Record<APICheckHealthState, APICheckStateMeta> = {
  fail: {
    label: "Con fallo",
    tone: "danger",
    shape: "error",
    textClass: "text-rose-400",
    rank: 0,
  },
  slow: {
    label: "Lento",
    tone: "warning",
    shape: "alert",
    textClass: "text-amber-400",
    rank: 1,
  },
  pass: {
    label: "Exitoso",
    tone: "success",
    shape: "check",
    textClass: "text-emerald-400",
    rank: 2,
  },
  paused: {
    label: "Pausado",
    tone: "muted",
    shape: "pause",
    textClass: "text-slate-400",
    rank: 3,
  },
  pending: {
    label: "Pendiente",
    tone: "neutral",
    shape: "clock",
    textClass: "text-slate-400",
    rank: 4,
  },
};

export const ALL_HTTP_METHODS: HTTPMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
];

export function getAPICheckHealthState(
  target: APICheckTarget,
): APICheckHealthState {
  if (!target.enabled) return "paused";
  if (!hasMeasurement(target.last_checked_at) || !target.last_status) {
    return "pending";
  }
  const s = target.last_status.toLowerCase();
  if (s === "fail" || s === "error" || s === "down") return "fail";
  if (s === "slow" || s === "degraded") return "slow";
  if (s === "pass" || s === "up" || s === "ok") return "pass";
  return "pending";
}

export function getMethodBadgeClass(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    case "POST":
      return "bg-sky-500/10 text-sky-400 border-sky-500/30";
    case "PUT":
    case "PATCH":
      return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "DELETE":
      return "bg-rose-500/10 text-rose-400 border-rose-500/30";
    case "HEAD":
      return "bg-purple-500/10 text-purple-400 border-purple-500/30";
    default:
      return "bg-zinc-800 text-zinc-300 border-zinc-700";
  }
}

export function extractApiHost(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url.replace(/^https?:\/\//i, "").split("/")[0] || url;
  }
}

export function formatApiInterval(seconds?: number | null): string {
  const sec = seconds || 60;
  if (sec < 60) return `Cada ${sec}s`;
  if (sec % 3600 === 0) return `Cada ${sec / 3600}h`;
  if (sec % 60 === 0) return `Cada ${sec / 60}m`;
  return `Cada ${sec}s`;
}

export function hasExpectedSchema(target: APICheckTarget): boolean {
  return Boolean(
    target.expected_schema &&
      typeof target.expected_schema === "object" &&
      Object.keys(target.expected_schema).length > 0,
  );
}

export function getSchemaFieldCount(target: APICheckTarget): number {
  if (!hasExpectedSchema(target)) return 0;
  return Object.keys(target.expected_schema || {}).length;
}

export function buildSafeCurl(target: APICheckTarget): string {
  let curl = `curl -X ${target.method} "${target.url}"`;
  if (target.request_headers) {
    Object.entries(target.request_headers).forEach(([k, v]) => {
      const redacted = /authorization|cookie|token|api.?key|secret/i.test(k)
        ? "<CREDENCIAL>"
        : v;
      curl += ` \\\n  -H "${k}: ${redacted}"`;
    });
  }
  if (
    target.method !== "GET" &&
    target.method !== "HEAD" &&
    target.request_body &&
    Object.keys(target.request_body).length > 0
  ) {
    curl += ` \\\n  -d '${JSON.stringify(target.request_body)}'`;
  }
  return curl;
}

export interface APICheckGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  targets: APICheckTarget[];
  problemCount: number;
}

export interface APICheckSummaryMetrics {
  total: number;
  failCount: number;
  slowCount: number;
  passCount: number;
  pausedCount: number;
  pendingCount: number;
  avgLatencyMs: number | null;
}

interface UseAPIChecksArgs {
  targets: APICheckTarget[];
  hostFilter: string;
  schemaFilter: APICheckSchemaFilter;
  sortField: APICheckSortField;
  sortAsc: boolean;
  groupBy: APICheckGroupBy;
}

export function useAPIChecks({
  targets,
  hostFilter,
  schemaFilter,
  sortField,
  sortAsc,
  groupBy,
}: UseAPIChecksArgs) {
  const facets = useMemo(() => {
    const hosts = new Set<string>();
    const methods = new Set<HTTPMethod>();
    for (const t of targets) {
      hosts.add(extractApiHost(t.url));
      if (t.method) methods.add(t.method);
    }
    return {
      hosts: Array.from(hosts).sort((a, b) => a.localeCompare(b)),
      methods: Array.from(methods),
    };
  }, [targets]);

  const summary = useMemo<APICheckSummaryMetrics>(() => {
    let failCount = 0;
    let slowCount = 0;
    let passCount = 0;
    let pausedCount = 0;
    let pendingCount = 0;
    let latencySum = 0;
    let latencyCount = 0;

    for (const t of targets) {
      const st = getAPICheckHealthState(t);
      if (st === "fail") failCount++;
      else if (st === "slow") slowCount++;
      else if (st === "pass") passCount++;
      else if (st === "paused") pausedCount++;
      else pendingCount++;

      if (
        t.last_response_time_ms !== null &&
        t.last_response_time_ms !== undefined &&
        t.enabled
      ) {
        latencySum += t.last_response_time_ms;
        latencyCount++;
      }
    }

    return {
      total: targets.length,
      failCount,
      slowCount,
      passCount,
      pausedCount,
      pendingCount,
      avgLatencyMs:
        latencyCount > 0 ? Math.round(latencySum / latencyCount) : null,
    };
  }, [targets]);

  const sortedTargets = useMemo(() => {
    const filtered = targets.filter((t) => {
      if (hostFilter !== "all" && extractApiHost(t.url) !== hostFilter) {
        return false;
      }
      if (schemaFilter === "with_schema" && !hasExpectedSchema(t)) {
        return false;
      }
      if (schemaFilter === "without_schema" && hasExpectedSchema(t)) {
        return false;
      }
      return true;
    });

    const dir = sortAsc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === "status") {
        cmp =
          API_STATE_META[getAPICheckHealthState(a)].rank -
          API_STATE_META[getAPICheckHealthState(b)].rank;
      } else if (sortField === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === "method") {
        cmp = a.method.localeCompare(b.method);
      } else if (sortField === "latency") {
        const la = a.last_response_time_ms ?? Number.MAX_SAFE_INTEGER;
        const lb = b.last_response_time_ms ?? Number.MAX_SAFE_INTEGER;
        cmp = la - lb;
      } else if (sortField === "last_checked") {
        const ta = a.last_checked_at ? new Date(a.last_checked_at).getTime() : 0;
        const tb = b.last_checked_at ? new Date(b.last_checked_at).getTime() : 0;
        cmp = ta - tb;
      }
      if (cmp !== 0) return cmp * dir;
      return a.name.localeCompare(b.name);
    });
  }, [targets, hostFilter, schemaFilter, sortField, sortAsc]);

  const groupedTargets = useMemo<APICheckGroup[] | null>(() => {
    if (groupBy === "none") return null;
    const map = new Map<string, APICheckGroup & { order: number }>();

    for (const t of sortedTargets) {
      const state = getAPICheckHealthState(t);
      let key: string;
      let label: string;
      let icon: LucideIcon;
      let order = 50;

      if (groupBy === "status") {
        key = state;
        label = API_STATE_META[state].label;
        icon = ShieldAlert;
        order = API_STATE_META[state].rank;
      } else if (groupBy === "method") {
        key = t.method;
        label = `Método ${t.method}`;
        icon = Plug;
        order = Math.max(0, ALL_HTTP_METHODS.indexOf(t.method));
      } else {
        const host = extractApiHost(t.url);
        key = host;
        label = host;
        icon = Globe;
      }

      let group = map.get(key);
      if (!group) {
        group = { key, label, icon, targets: [], problemCount: 0, order };
        map.set(key, group);
      }
      group.targets.push(t);
      if (state === "fail" || state === "slow") {
        group.problemCount++;
      }
    }

    return Array.from(map.values())
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        if (a.problemCount > 0 && b.problemCount === 0) return -1;
        if (b.problemCount > 0 && a.problemCount === 0) return 1;
        return a.label.localeCompare(b.label);
      })
      .map(({ order: _order, ...rest }) => rest);
  }, [sortedTargets, groupBy]);

  return { facets, summary, sortedTargets, groupedTargets };
}
