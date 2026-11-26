import { useEffect, useMemo, useState } from "react";
import type { DNSRecord, DNSRecordType } from "../../types/dns";
import type {
  StatusIconShape,
  StatusTone,
} from "../common/connectivity/StatusPill";

export type DNSHealthState =
  | "error"
  | "mismatch"
  | "propagating"
  | "mutation"
  | "resolved"
  | "pending";

export type DNSSortKey = "status" | "domain" | "latency" | "checked";
export type DNSSortDir = "asc" | "desc";
export type DNSGroupBy = "none" | "zone" | "type" | "status";
export type DNSDensity = "comfortable" | "compact";

export interface DNSStateMeta {
  label: string;
  tone: StatusTone;
  shape: StatusIconShape;
  severityRank: number;
  textClass: string;
  borderClass: string;
  badgeClass: string;
}

export const DNS_STATE_META: Record<DNSHealthState, DNSStateMeta> = {
  error: {
    label: "Error",
    tone: "danger",
    shape: "error",
    severityRank: 0,
    textClass: "text-rose-400",
    borderClass: "border-rose-500/45",
    badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/35",
  },
  mismatch: {
    label: "Fuera de ref.",
    tone: "danger",
    shape: "alert",
    severityRank: 1,
    textClass: "text-rose-400",
    borderClass: "border-rose-500/45",
    badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/35",
  },
  propagating: {
    label: "Propagando",
    tone: "warning",
    shape: "alert",
    severityRank: 2,
    textClass: "text-amber-400",
    borderClass: "border-amber-500/45",
    badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/35",
  },
  mutation: {
    label: "Mutación",
    tone: "warning",
    shape: "alert",
    severityRank: 3,
    textClass: "text-amber-400",
    borderClass: "border-amber-500/45",
    badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/35",
  },
  resolved: {
    label: "Resuelto",
    tone: "success",
    shape: "check",
    severityRank: 4,
    textClass: "text-emerald-400",
    borderClass: "border-border-base/80",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  pending: {
    label: "Sin medición",
    tone: "muted",
    shape: "clock",
    severityRank: 5,
    textClass: "text-text-dim",
    borderClass: "border-border-base/70",
    badgeClass: "bg-bg-dark text-text-dim border-border-base",
  },
};

export const DNS_TYPE_TOOLTIPS: Record<DNSRecordType, string> = {
  A: "Registro A: dirección IPv4",
  AAAA: "Registro AAAA: dirección IPv6",
  CNAME: "Registro CNAME: alias hacia otro dominio",
  MX: "Registro MX: servidor de correo electrónico",
  TXT: "Registro TXT: texto, verificación, SPF o DMARC",
  NS: "Registro NS: servidor de nombres autoritativo",
  SOA: "Registro SOA: inicio de autoridad de la zona",
  SRV: "Registro SRV: ubicación de servicio (host y puerto)",
  PTR: "Registro PTR: resolución inversa de IP a dominio",
  CAA: "Registro CAA: autoridades autorizadas a emitir certificados SSL",
};

const MULTIPART_TLDS = new Set([
  "co.uk",
  "org.uk",
  "com.mx",
  "org.mx",
  "gob.mx",
  "com.ar",
  "com.br",
  "com.co",
  "com.es",
  "com.pe",
  "com.au",
  "co.jp",
]);

export function getTypeBadgeClass(type: string): string {
  switch (type) {
    case "A":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    case "AAAA":
      return "bg-teal-500/10 text-teal-400 border-teal-500/30";
    case "CNAME":
      return "bg-sky-500/10 text-sky-400 border-sky-500/30";
    case "MX":
      return "bg-violet-500/10 text-violet-400 border-violet-500/30";
    case "TXT":
      return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "NS":
      return "bg-rose-500/10 text-rose-400 border-rose-500/30";
    case "SOA":
      return "bg-purple-500/10 text-purple-400 border-purple-500/30";
    case "PTR":
      return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    case "CAA":
      return "bg-indigo-500/10 text-indigo-400 border-indigo-500/30";
    default:
      return "bg-zinc-800 text-zinc-300 border-zinc-700";
  }
}

export function isRecentMutation(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const changeTime = new Date(dateStr).getTime();
  if (Number.isNaN(changeTime)) return false;
  return Date.now() - changeTime < 24 * 60 * 60 * 1000;
}

export function getDNSHealthState(record: DNSRecord): DNSHealthState {
  const hasValue = Boolean(record.value && record.value.trim().length > 0);
  const hasScanned = Boolean(record.last_scanned_at);

  if (!hasScanned && !record.last_error_code && !hasValue) {
    return "pending";
  }
  if (
    record.last_attempt_status === "error" ||
    (record.last_error_code && !hasValue) ||
    (!hasValue && hasScanned)
  ) {
    return "error";
  }
  if (record.matches_expected === false) {
    return "mismatch";
  }
  if (record.propagation_status === "propagating") {
    return "propagating";
  }
  // If user accepted the current value as expected reference, silence the 24h mutation flag
  if (isRecentMutation(record.last_change_at) && record.matches_expected !== true) {
    return "mutation";
  }
  return "resolved";
}

export function getDNSErrorLabel(record: DNSRecord): string {
  const code = (record.last_error_code || "").toUpperCase();
  switch (code) {
    case "NXDOMAIN":
      return "NXDOMAIN";
    case "SERVFAIL":
      return "SERVFAIL";
    case "TIMEOUT":
      return "Timeout";
    case "NOANSWER":
      return "Sin respuesta";
    case "INVALID_DOMAIN":
      return "Dominio inválido";
    default:
      return code ? code : "Error DNS";
  }
}

export function getDNSStateLabel(record: DNSRecord, state?: DNSHealthState): string {
  const s = state ?? getDNSHealthState(record);
  if (s === "error") {
    return getDNSErrorLabel(record);
  }
  return DNS_STATE_META[s].label;
}

export function parseDNSValues(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function computeDNSDiff(
  oldValue: string | null | undefined,
  newValue: string | null | undefined,
): { removed: string[]; added: string[]; summary: string } {
  const oldSet = new Set(parseDNSValues(oldValue));
  const newSet = new Set(parseDNSValues(newValue));
  const removed = Array.from(oldSet).filter((v) => !newSet.has(v));
  const added = Array.from(newSet).filter((v) => !oldSet.has(v));

  let summary = "";
  if (removed.length === 1 && added.length === 1) {
    summary = `${removed[0]} → ${added[0]}`;
  } else if (removed.length > 0 && added.length > 0) {
    summary = `${removed[0]} → ${added[0]}${
      removed.length > 1 || added.length > 1
        ? ` (+${Math.max(removed.length, added.length) - 1})`
        : ""
    }`;
  } else if (added.length > 0) {
    summary = `+ ${added[0]}${added.length > 1 ? ` (+${added.length - 1})` : ""}`;
  } else if (removed.length > 0) {
    summary = `− ${removed[0]}${removed.length > 1 ? ` (+${removed.length - 1})` : ""}`;
  }
  return { removed, added, summary };
}

export function formatDNSTTL(ttl: number | null | undefined): string {
  if (ttl == null || ttl <= 0) return "—";
  if (ttl < 120) return `${ttl} s`;
  if (ttl < 3600) {
    const mins = Math.floor(ttl / 60);
    const rem = ttl % 60;
    return rem === 0 ? `${mins} min` : `${mins}m ${rem}s`;
  }
  if (ttl < 86400) {
    const hrs = Math.floor(ttl / 3600);
    const remMins = Math.floor((ttl % 3600) / 60);
    return remMins === 0 ? `${hrs} h` : `${hrs}h ${remMins}m`;
  }
  const days = Math.floor(ttl / 86400);
  return `${days} d`;
}

export function formatDNSLatency(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return "—";
  const rounded = Math.round(ms);
  return rounded < 1 ? "<1 ms" : `${rounded} ms`;
}

export function getDNSLatencyToneClass(ms: number | null | undefined): string {
  if (ms == null) return "text-text-dim";
  if (ms >= 1000) return "text-rose-400 font-semibold";
  if (ms >= 400) return "text-amber-400 font-semibold";
  return "text-text-main";
}

export function formatDNSDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

export function formatDNSDateFull(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function extractDNSZone(domain: string): string {
  const clean = domain.trim().toLowerCase().replace(/\.$/, "");
  const parts = clean.split(".").filter(Boolean);
  if (parts.length <= 2) return clean;
  const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  if (MULTIPART_TLDS.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}

export function formatResolverLabel(resolver: string | null | undefined): string {
  if (!resolver) return "1.1.1.1";
  if (resolver === "1.1.1.1") return "1.1.1.1 (Cloudflare)";
  if (resolver === "8.8.8.8") return "8.8.8.8 (Google)";
  return resolver;
}

export interface DNSSummaryMetrics {
  total: number;
  errorCount: number;
  mutationCount: number;
  stableCount: number;
  avgLatencyMs: number | null;
}

export interface DNSRecordGroup {
  key: string;
  label: string;
  records: DNSRecord[];
}

const DENSITY_STORAGE_KEY = "sentinela_dns_density";

export function useDNSRecords(
  records: DNSRecord[],
  externalTypeFilter?: string,
) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [resolverFilter, setResolverFilter] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<DNSGroupBy>("none");
  const [sortKey, setSortKey] = useState<DNSSortKey>("status");
  const [sortDir, setSortDir] = useState<DNSSortDir>("asc");
  const [density, setDensityState] = useState<DNSDensity>(() => {
    try {
      const saved = localStorage.getItem(DENSITY_STORAGE_KEY);
      return saved === "compact" ? "compact" : "comfortable";
    } catch {
      return "comfortable";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, density);
    } catch {
      // ignore storage errors
    }
  }, [density]);

  const setDensity = (next: DNSDensity) => setDensityState(next);

  const handleSort = (key: DNSSortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "latency" || key === "checked" ? "desc" : "asc");
    }
  };

  // Summary metrics across all loaded records (before status chip filter)
  const summary: DNSSummaryMetrics = useMemo(() => {
    let errorCount = 0;
    let mutationCount = 0;
    let stableCount = 0;
    let latencySum = 0;
    let latencyCount = 0;

    for (const rec of records) {
      const state = getDNSHealthState(rec);
      if (state === "error" || state === "mismatch") {
        errorCount += 1;
      } else if (state === "mutation" || state === "propagating") {
        mutationCount += 1;
      } else if (state === "resolved") {
        stableCount += 1;
      }
      if (rec.response_time_ms != null && !Number.isNaN(rec.response_time_ms)) {
        latencySum += rec.response_time_ms;
        latencyCount += 1;
      }
    }

    return {
      total: records.length,
      errorCount,
      mutationCount,
      stableCount,
      avgLatencyMs:
        latencyCount > 0 ? Math.round(latencySum / latencyCount) : null,
    };
  }, [records]);

  const facets = useMemo(() => {
    const typesSet = new Set<DNSRecordType>();
    const zonesSet = new Set<string>();
    const resolversSet = new Set<string>();

    for (const rec of records) {
      typesSet.add(rec.record_type);
      zonesSet.add(extractDNSZone(rec.domain));
      if (rec.resolver) resolversSet.add(rec.resolver);
      for (const rr of rec.resolver_results || []) {
        if (rr.resolver) resolversSet.add(rr.resolver);
      }
    }

    return {
      types: Array.from(typesSet).sort(),
      zones: Array.from(zonesSet).sort(),
      resolvers: Array.from(resolversSet).sort(),
    };
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      if (
        externalTypeFilter &&
        externalTypeFilter !== "all" &&
        rec.record_type !== externalTypeFilter
      ) {
        return false;
      }
      if (zoneFilter !== "all" && extractDNSZone(rec.domain) !== zoneFilter) {
        return false;
      }
      if (resolverFilter !== "all") {
        const hasResolver =
          rec.resolver === resolverFilter ||
          (rec.resolver_results || []).some(
            (rr) => rr.resolver === resolverFilter,
          );
        if (!hasResolver) return false;
      }
      if (statusFilter !== "all") {
        const state = getDNSHealthState(rec);
        if (
          statusFilter === "error" &&
          state !== "error" &&
          state !== "mismatch"
        ) {
          return false;
        }
        if (
          statusFilter === "mutation" &&
          state !== "mutation" &&
          state !== "propagating"
        ) {
          return false;
        }
        if (statusFilter === "stable" && state !== "resolved") {
          return false;
        }
      }
      return true;
    });
  }, [records, externalTypeFilter, zoneFilter, resolverFilter, statusFilter]);

  const sortedRecords = useMemo(() => {
    const copy = [...filteredRecords];
    const dir = sortDir === "asc" ? 1 : -1;

    copy.sort((a, b) => {
      if (sortKey === "status") {
        const rankA = DNS_STATE_META[getDNSHealthState(a)].severityRank;
        const rankB = DNS_STATE_META[getDNSHealthState(b)].severityRank;
        if (rankA !== rankB) return (rankA - rankB) * dir;
        return a.domain.localeCompare(b.domain);
      }
      if (sortKey === "domain") {
        const cmp = a.domain.localeCompare(b.domain);
        if (cmp !== 0) return cmp * dir;
        return a.record_type.localeCompare(b.record_type);
      }
      if (sortKey === "latency") {
        const latA = a.response_time_ms ?? -1;
        const latB = b.response_time_ms ?? -1;
        if (latA !== latB) return (latA - latB) * dir;
        return a.domain.localeCompare(b.domain);
      }
      if (sortKey === "checked") {
        const tA = a.last_scanned_at ? new Date(a.last_scanned_at).getTime() : 0;
        const tB = b.last_scanned_at ? new Date(b.last_scanned_at).getTime() : 0;
        if (tA !== tB) return (tA - tB) * dir;
        return a.domain.localeCompare(b.domain);
      }
      return 0;
    });

    return copy;
  }, [filteredRecords, sortKey, sortDir]);

  const groupedRecords: DNSRecordGroup[] = useMemo(() => {
    if (groupBy === "none") {
      return [{ key: "all", label: "", records: sortedRecords }];
    }
    const map = new Map<string, DNSRecordGroup>();
    for (const rec of sortedRecords) {
      let key = "";
      let label = "";
      if (groupBy === "zone") {
        key = extractDNSZone(rec.domain);
        label = key;
      } else if (groupBy === "type") {
        key = rec.record_type;
        label = `Registros ${rec.record_type}`;
      } else if (groupBy === "status") {
        const st = getDNSHealthState(rec);
        key = st;
        label = DNS_STATE_META[st].label;
      }
      const existing = map.get(key);
      if (existing) {
        existing.records.push(rec);
      } else {
        map.set(key, { key, label, records: [rec] });
      }
    }
    const groups = Array.from(map.values());
    if (groupBy === "status") {
      groups.sort(
        (a, b) =>
          (DNS_STATE_META[a.key as DNSHealthState]?.severityRank ?? 9) -
          (DNS_STATE_META[b.key as DNSHealthState]?.severityRank ?? 9),
      );
    } else {
      groups.sort((a, b) => a.label.localeCompare(b.label));
    }
    return groups;
  }, [sortedRecords, groupBy]);

  return {
    statusFilter,
    setStatusFilter,
    zoneFilter,
    setZoneFilter,
    resolverFilter,
    setResolverFilter,
    groupBy,
    setGroupBy,
    sortKey,
    sortDir,
    handleSort,
    density,
    setDensity,
    summary,
    facets,
    sortedRecords,
    groupedRecords,
  };
}
