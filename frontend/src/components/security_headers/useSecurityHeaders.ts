import { useMemo } from "react";
import type {
  SecurityGrade,
  SecurityHeaderRecentResult,
  SecurityHeaderTarget,
} from "../../types/security_headers";
import type {
  StatusIconShape,
  StatusTone,
} from "../common/connectivity/StatusPill";
import type { TableDensity } from "../common/connectivity/tableTokens";

export type SecurityHeaderHealthState =
  | "critical"
  | "warning"
  | "healthy"
  | "unmeasured"
  | "paused";

export type SecurityHeaderSortField =
  | "status"
  | "name"
  | "score"
  | "latency"
  | "checked";

export type SecurityHeaderGroupBy = "none" | "grade" | "host";
export type SecurityHeaderLeakFilter = "all" | "with_leaks" | "clean";
export type SecurityHeaderProtectionFilter =
  | "all"
  | "missing_hsts"
  | "missing_csp"
  | "missing_xfo";
export type SecurityHeaderDensity = TableDensity;

export const STANDARD_SECURITY_HEADERS = [
  {
    key: "content-security-policy",
    name: "Content-Security-Policy",
    weight: 25,
    description:
      "Previene XSS, inyección de datos y clickjacking restringiendo los orígenes de contenido.",
  },
  {
    key: "strict-transport-security",
    name: "Strict-Transport-Security (HSTS)",
    weight: 20,
    description:
      "Fuerza conexiones HTTPS seguras y protege contra ataques de degradación SSL/TLS.",
  },
  {
    key: "x-frame-options",
    name: "X-Frame-Options",
    weight: 15,
    description:
      "Protege contra Clickjacking evitando que el sitio sea embebido en iframes no autorizados.",
  },
  {
    key: "x-content-type-options",
    name: "X-Content-Type-Options",
    weight: 10,
    description:
      "Previene el MIME-sniffing obligando al navegador a respetar el Content-Type declarado.",
  },
  {
    key: "referrer-policy",
    name: "Referrer-Policy",
    weight: 10,
    description:
      "Controla cuánta información de referencia (URL previa) se transmite en peticiones salientes.",
  },
  {
    key: "permissions-policy",
    name: "Permissions-Policy",
    weight: 10,
    description:
      "Restringe el acceso del navegador a características de hardware (cámara, micrófono, geolocalización).",
  },
  {
    key: "cross-origin-opener-policy",
    name: "Cross-Origin-Opener-Policy (COOP)",
    weight: 5,
    description:
      "Aísla el contexto de navegación impidiendo accesos maliciosos entre orígenes.",
  },
  {
    key: "cross-origin-resource-policy",
    name: "Cross-Origin-Resource-Policy (CORP)",
    weight: 5,
    description:
      "Bloquea lectura no autorizada de recursos estáticos desde otros dominios.",
  },
] as const;

export function calculateSecurityGrade(
  score: number | null,
): SecurityGrade | null {
  if (score === null || score === undefined) return null;
  if (score >= 95) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

export function getSecurityHeaderHost(url: string): string {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url.replace(/^https?:\/\//i, "").split("/")[0] || url;
  }
}

export function getSecurityHeaderDisplayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/+$/, "") || url;
}

export function getSecurityHeaderHealthState(
  target: SecurityHeaderTarget,
): SecurityHeaderHealthState {
  if (!target.enabled) return "paused";
  if (!target.last_checked_at || target.last_score === null) {
    return "unmeasured";
  }
  if (target.last_error_message || target.last_score < 50) return "critical";
  if (target.last_score < 70 || target.info_leak_detected) return "warning";
  return "healthy";
}

export function getSecurityHeaderIssueLabel(
  target: SecurityHeaderTarget,
): string | null {
  if (!target.enabled || !target.last_checked_at) return null;
  if (target.last_error_message) {
    const low = target.last_error_message.toLowerCase();
    if (low.includes("timeout")) return "sin respuesta · tiempo agotado";
    if (low.includes("connection") || low.includes("resolve") || low.includes("dns")) {
      return "sin respuesta · error de conexión";
    }
    return "error al auditar destino";
  }
  if (target.info_leak_detected) {
    const exposed =
      target.server_header || target.powered_by_header || "cabecera de stack";
    return `fuga: ${exposed}`;
  }
  if (target.last_score !== null && target.last_score < 50) {
    const missing = target.headers_missing_count;
    return missing
      ? `${missing} cabeceras críticas ausentes`
      : `puntuación baja (${target.last_score}/100)`;
  }
  if (target.last_score !== null && target.last_score < 70) {
    const missing = target.headers_missing_count;
    return missing
      ? `faltan ${missing} cabeceras`
      : `puntuación media (${target.last_score}/100)`;
  }
  return null;
}

export function getSecurityLatencyColorClass(
  ms: number | null | undefined,
): string {
  if (ms === null || ms === undefined) return "text-text-dim";
  if (ms > 1500) return "text-rose-400 font-semibold";
  if (ms > 800) return "text-amber-300";
  return "text-text-main";
}

export function getSecurityHistorySlotMeta(
  result: SecurityHeaderRecentResult | null,
): { cls: string; tooltip: string } {
  if (!result) {
    return {
      cls: "bg-slate-800/70 border border-slate-700/60",
      tooltip: "Sin medición",
    };
  }
  const timeStr = result.checked_at
    ? new Date(result.checked_at).toLocaleString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  if (result.error_message) {
    return {
      cls: "bg-rose-500",
      tooltip: `${timeStr} · Error: ${result.error_message}`,
    };
  }
  const suffix = result.leaks_count > 0 ? ` · ${result.leaks_count} fuga(s)` : "";
  if (result.score < 50) {
    return {
      cls: "bg-rose-500",
      tooltip: `${timeStr} · ${result.grade || "F"} (${result.score}/100)${suffix}`,
    };
  }
  if (result.score < 70 || result.leaks_count > 0) {
    return {
      cls: "bg-amber-400",
      tooltip: `${timeStr} · ${result.grade || "C"} (${result.score}/100)${suffix}`,
    };
  }
  return {
    cls: "bg-emerald-500",
    tooltip: `${timeStr} · ${result.grade || "A"} (${result.score}/100)`,
  };
}

export const SECURITY_STATE_META: Record<
  SecurityHeaderHealthState,
  {
    label: string;
    tone: StatusTone;
    shape: StatusIconShape;
    iconClassName: string;
  }
> = {
  critical: {
    label: "Crítico",
    tone: "danger",
    shape: "error",
    iconClassName: "text-rose-400",
  },
  warning: {
    label: "Advertencia",
    tone: "warning",
    shape: "alert",
    iconClassName: "text-amber-400",
  },
  healthy: {
    label: "Saludable",
    tone: "success",
    shape: "check",
    iconClassName: "text-emerald-400",
  },
  unmeasured: {
    label: "Sin medir",
    tone: "muted",
    shape: "clock",
    iconClassName: "text-slate-400",
  },
  paused: {
    label: "Pausado",
    tone: "muted",
    shape: "pause",
    iconClassName: "text-slate-400",
  },
};

const STATE_PRIORITY: Record<SecurityHeaderHealthState, number> = {
  critical: 0,
  warning: 1,
  unmeasured: 2,
  healthy: 3,
  paused: 4,
};

export interface SecurityHeaderSummary {
  total: number;
  criticalCount: number;
  warningCount: number;
  healthyCount: number;
  unmeasuredCount: number;
  pausedCount: number;
  leaksCount: number;
  avgScore: number | null;
}

export interface SecurityHeaderGroup {
  key: string;
  label: string;
  targets: SecurityHeaderTarget[];
  problemCount: number;
}

export function useSecurityHeaders({
  targets,
  leakFilter,
  protectionFilter,
  hostFilter,
  sortField,
  sortAsc,
  groupBy,
}: {
  targets: SecurityHeaderTarget[];
  leakFilter: SecurityHeaderLeakFilter;
  protectionFilter: SecurityHeaderProtectionFilter;
  hostFilter: string;
  sortField: SecurityHeaderSortField;
  sortAsc: boolean;
  groupBy: SecurityHeaderGroupBy;
}) {
  const facets = useMemo(() => {
    const hosts = Array.from(
      new Set(targets.map((t) => getSecurityHeaderHost(t.url))),
    ).sort();
    return { hosts };
  }, [targets]);

  const summary = useMemo<SecurityHeaderSummary>(() => {
    let criticalCount = 0;
    let warningCount = 0;
    let healthyCount = 0;
    let unmeasuredCount = 0;
    let pausedCount = 0;
    let leaksCount = 0;
    let scoreSum = 0;
    let scoreCount = 0;

    for (const t of targets) {
      const state = getSecurityHeaderHealthState(t);
      if (state === "critical") criticalCount++;
      else if (state === "warning") warningCount++;
      else if (state === "healthy") healthyCount++;
      else if (state === "unmeasured") unmeasuredCount++;
      else pausedCount++;

      if (t.enabled && t.last_checked_at && t.info_leak_detected) {
        leaksCount++;
      }
      if (t.enabled && t.last_checked_at && t.last_score !== null && !t.last_error_message) {
        scoreSum += t.last_score;
        scoreCount++;
      }
    }

    return {
      total: targets.length,
      criticalCount,
      warningCount,
      healthyCount,
      unmeasuredCount,
      pausedCount,
      leaksCount,
      avgScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null,
    };
  }, [targets]);

  const sortedTargets = useMemo(() => {
    const filtered = targets.filter((t) => {
      if (leakFilter === "with_leaks" && !t.info_leak_detected) return false;
      if (leakFilter === "clean" && (t.info_leak_detected || !t.last_checked_at)) {
        return false;
      }
      if (
        protectionFilter === "missing_hsts" &&
        (t.has_hsts || !t.last_checked_at)
      ) {
        return false;
      }
      if (
        protectionFilter === "missing_csp" &&
        (t.has_csp || !t.last_checked_at)
      ) {
        return false;
      }
      if (
        protectionFilter === "missing_xfo" &&
        (t.has_xfo || !t.last_checked_at)
      ) {
        return false;
      }
      if (hostFilter !== "all" && getSecurityHeaderHost(t.url) !== hostFilter) {
        return false;
      }
      return true;
    });

    const dir = sortAsc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortField === "status") {
        const diff =
          STATE_PRIORITY[getSecurityHeaderHealthState(a)] -
          STATE_PRIORITY[getSecurityHeaderHealthState(b)];
        if (diff !== 0) return diff * dir;
        const sa = a.last_score ?? -1;
        const sb = b.last_score ?? -1;
        if (sa !== sb) return (sa - sb) * dir;
        return a.name.localeCompare(b.name);
      }
      if (sortField === "name") {
        return a.name.localeCompare(b.name) * dir;
      }
      if (sortField === "score") {
        const sa = a.last_score ?? -1;
        const sb = b.last_score ?? -1;
        return (sa - sb) * dir;
      }
      if (sortField === "latency") {
        const la = a.last_response_time_ms ?? Number.MAX_SAFE_INTEGER;
        const lb = b.last_response_time_ms ?? Number.MAX_SAFE_INTEGER;
        return (la - lb) * dir;
      }
      if (sortField === "checked") {
        const ta = a.last_checked_at ? Date.parse(a.last_checked_at) : 0;
        const tb = b.last_checked_at ? Date.parse(b.last_checked_at) : 0;
        return (tb - ta) * dir;
      }
      return 0;
    });
  }, [targets, leakFilter, protectionFilter, hostFilter, sortField, sortAsc]);

  const groupedTargets = useMemo<SecurityHeaderGroup[] | null>(() => {
    if (groupBy === "none") return null;
    const map = new Map<string, SecurityHeaderGroup>();
    for (const t of sortedTargets) {
      const state = getSecurityHeaderHealthState(t);
      let key: string;
      let label: string;
      if (groupBy === "grade") {
        const grade = t.last_grade || calculateSecurityGrade(t.last_score);
        key = !t.enabled
          ? "__paused__"
          : t.last_error_message
            ? "__error__"
            : grade || "__none__";
        label = !t.enabled
          ? "Pausados"
          : t.last_error_message
            ? "Error de conexión"
            : grade
              ? `Calificación ${grade}`
              : "Sin evaluar";
      } else {
        key = getSecurityHeaderHost(t.url);
        label = key;
      }

      let grp = map.get(key);
      if (!grp) {
        grp = { key, label, targets: [], problemCount: 0 };
        map.set(key, grp);
      }
      grp.targets.push(t);
      if (state === "critical" || state === "warning") {
        grp.problemCount++;
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.problemCount > 0 && b.problemCount === 0) return -1;
      if (b.problemCount > 0 && a.problemCount === 0) return 1;
      return a.label.localeCompare(b.label);
    });
  }, [sortedTargets, groupBy]);

  return { facets, summary, sortedTargets, groupedTargets };
}
