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
  | "rate_limited"
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
  rate_limited: {
    label: "Limitado",
    tone: "warning",
    shape: "alert",
    textClass: "text-amber-400",
    rank: 1,
  },
  slow: {
    label: "Lento",
    tone: "warning",
    shape: "alert",
    textClass: "text-amber-400",
    rank: 2,
  },
  pass: {
    label: "Correcto",
    tone: "success",
    shape: "check",
    textClass: "text-emerald-400",
    rank: 3,
  },
  paused: {
    label: "Pausado",
    tone: "muted",
    shape: "pause",
    textClass: "text-slate-400",
    rank: 4,
  },
  pending: {
    label: "Pendiente",
    tone: "neutral",
    shape: "clock",
    textClass: "text-slate-400",
    rank: 5,
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
  if (s === "rate_limited") return "rate_limited";
  if (target.last_http_status === 429 && target.expected_status !== 429) {
    return "rate_limited";
  }
  if (s === "fail" || s === "error" || s === "down") return "fail";
  if (s === "slow" || s === "degraded") return "slow";
  if (s === "pass" || s === "up" || s === "ok") return "pass";
  return "pending";
}

/**
 * Neutral non-semantic badge for all HTTP methods so GET/DELETE never collide
 * visually with green/red health status pills.
 */
export function getMethodBadgeClass(): string {
  return "bg-bg-dark text-text-muted border-border-base/90";
}

/**
 * Colors latency strictly against its OWN threshold (never inherited from row failure).
 * - > limit: rose
 * - >= 75% of limit: amber
 * - < 75% of limit: neutral main text
 */
export function getLatencyOwnColor(
  latencyMs: number | null | undefined,
  maxLatencyMs: number,
): string {
  if (latencyMs === null || latencyMs === undefined) return "text-text-dim";
  const limit = Math.max(1, maxLatencyMs || 2000);
  if (latencyMs > limit) return "text-rose-400 font-semibold";
  if (latencyMs >= limit * 0.75) return "text-amber-400 font-semibold";
  return "text-text-main";
}

export function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
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
  if (sec < 60) return `cada ${sec} s`;
  if (sec % 3600 === 0) return `cada ${sec / 3600} h`;
  if (sec % 60 === 0) return `cada ${sec / 60} min`;
  return `cada ${sec} s`;
}

export function formatResultStatusEs(status: string): string {
  const s = (status || "").toLowerCase();
  if (s === "pass" || s === "up" || s === "ok") return "Correcto";
  if (s === "slow") return "Lento";
  if (s === "rate_limited") return "Limitado";
  if (s === "fail") return "Fallo";
  if (s === "error") return "Error";
  return status || "Desconocido";
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

export interface SchemaContractSummary {
  total: number;
  failed: number;
  passed: number;
  valid: boolean | null;
  label: string;
}

export function getSchemaContractSummary(
  target: APICheckTarget,
): SchemaContractSummary | null {
  const total = getSchemaFieldCount(target);
  if (total === 0) return null;
  const failures = target.last_schema_failures || [];
  const valid = target.last_schema_valid ?? null;
  if (valid === true) {
    return {
      total,
      failed: 0,
      passed: total,
      valid: true,
      label: `${total} ${total === 1 ? "campo" : "campos"} ✓`,
    };
  }
  if (valid === false) {
    const failed = Math.min(total, Math.max(1, failures.length));
    const passed = Math.max(0, total - failed);
    return {
      total,
      failed,
      passed,
      valid: false,
      label: `${passed} de ${total} ✗`,
    };
  }
  return {
    total,
    failed: 0,
    passed: 0,
    valid: null,
    label: `${total} ${total === 1 ? "campo" : "campos"}`,
  };
}

export function getApiFailureReason(target: APICheckTarget): string | null {
  if (!target.enabled) return null;
  if (target.failure_reason) return target.failure_reason;
  const state = getAPICheckHealthState(target);
  if (state === "pass" || state === "paused" || state === "pending") {
    return null;
  }
  if (state === "rate_limited") return "429 · límite de velocidad";
  if (target.last_http_status === null || target.last_http_status === undefined) {
    return "sin respuesta";
  }
  if (target.last_http_status !== target.expected_status) {
    return `${target.last_http_status} ≠ ${target.expected_status}`;
  }
  if (
    state === "slow" &&
    target.last_response_time_ms !== null &&
    target.last_response_time_ms !== undefined
  ) {
    return `${Math.round(target.last_response_time_ms)} ms > ${target.expected_response_time_ms} ms`;
  }
  return null;
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
  rateLimitedCount: number;
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
    let rateLimitedCount = 0;
    let slowCount = 0;
    let passCount = 0;
    let pausedCount = 0;
    let pendingCount = 0;
    let latencySum = 0;
    let latencyCount = 0;

    for (const t of targets) {
      const st = getAPICheckHealthState(t);
      if (st === "fail") failCount++;
      else if (st === "rate_limited") rateLimitedCount++;
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
      rateLimitedCount,
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
      if (state === "fail" || state === "slow" || state === "rate_limited") {
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
      .map((item) => ({
        key: item.key,
        label: item.label,
        icon: item.icon,
        targets: item.targets,
        problemCount: item.problemCount,
      }));
  }, [sortedTargets, groupBy]);

  return { facets, summary, sortedTargets, groupedTargets };
}
