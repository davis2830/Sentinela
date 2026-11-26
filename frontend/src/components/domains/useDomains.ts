import { useEffect, useMemo, useState } from "react";
import type { DomainInfo } from "../../types/domain";
import type {
  StatusIconShape,
  StatusTone,
} from "../common/connectivity/StatusPill";

export type DomainHealthState =
  | "expired"
  | "changed"
  | "critical"
  | "expiring"
  | "no_data"
  | "valid"
  | "pending";

export type DomainSortKey = "expiry" | "status" | "domain";
export type DomainSortDir = "asc" | "desc";
export type DomainGroupBy = "none" | "registrar" | "tld" | "status";
export type DomainDensity = "compact" | "comfortable";
export type DomainLockFilter = "all" | "locked" | "unlocked" | "unknown";

export interface DomainThresholds {
  warningDays: number;
  criticalDays: number;
}

export const DEFAULT_DOMAIN_THRESHOLDS: DomainThresholds = {
  warningDays: 60,
  criticalDays: 14,
};

export interface DomainStateMeta {
  label: string;
  tone: StatusTone;
  shape: StatusIconShape;
  severityRank: number;
  textClass: string;
  borderClass: string;
}

export const DOMAIN_STATE_META: Record<DomainHealthState, DomainStateMeta> = {
  expired: {
    label: "Vencido",
    tone: "danger",
    shape: "error",
    severityRank: 0,
    textClass: "text-rose-400",
    borderClass: "border-rose-500/45",
  },
  changed: {
    label: "Con cambios",
    tone: "warning",
    shape: "alert",
    severityRank: 1,
    textClass: "text-amber-400",
    borderClass: "border-amber-500/45",
  },
  critical: {
    label: "Por expirar",
    tone: "danger",
    shape: "alert",
    severityRank: 2,
    textClass: "text-rose-400",
    borderClass: "border-rose-500/45",
  },
  expiring: {
    label: "Por expirar",
    tone: "warning",
    shape: "alert",
    severityRank: 3,
    textClass: "text-amber-400",
    borderClass: "border-amber-500/45",
  },
  no_data: {
    label: "Sin datos",
    tone: "muted",
    shape: "unknown",
    severityRank: 4,
    textClass: "text-text-dim",
    borderClass: "border-border-base/80",
  },
  valid: {
    label: "Vigente",
    tone: "success",
    shape: "check",
    severityRank: 5,
    textClass: "text-emerald-400",
    borderClass: "border-border-base/80",
  },
  pending: {
    label: "Sin medición",
    tone: "muted",
    shape: "clock",
    severityRank: 6,
    textClass: "text-text-dim",
    borderClass: "border-border-base/70",
  },
};

export function parseDomainNameServers(nsData: unknown): string[] {
  if (!nsData) return [];
  if (Array.isArray(nsData)) {
    return nsData
      .map((item) => String(item).trim().toLowerCase().replace(/\.$/, ""))
      .filter(Boolean);
  }
  if (typeof nsData === "string") {
    try {
      const parsed = JSON.parse(nsData);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim().toLowerCase().replace(/\.$/, ""))
          .filter(Boolean);
      }
    } catch {
      return nsData
        .split(/[\s,]+/)
        .map((s) => s.trim().toLowerCase().replace(/\.$/, ""))
        .filter(Boolean);
    }
  }
  return [];
}

export function parseDomainStatuses(statusData: unknown): string[] {
  if (!statusData) return [];
  if (Array.isArray(statusData)) {
    return statusData.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof statusData === "string") {
    return statusData
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function extractDomainTld(domain: string): string {
  const clean = domain.trim().toLowerCase().replace(/\.$/, "");
  const parts = clean.split(".").filter(Boolean);
  if (parts.length < 2) return clean;
  return `.${parts[parts.length - 1]}`;
}

export function extractNsProvider(nsList: string[]): string {
  if (nsList.length === 0) return "";
  const first = nsList[0];
  const parts = first.split(".").filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(-2).join(".");
  }
  return first;
}

export function getEffectiveExpirationIso(domain: DomainInfo): string | null {
  return (
    domain.effective_expiration_date ||
    domain.expiration_date ||
    (domain.manual_expiration_date
      ? `${domain.manual_expiration_date}T00:00:00Z`
      : null)
  );
}

export function getEffectiveDaysRemaining(domain: DomainInfo): number | null {
  if (
    domain.effective_days_until_expiration !== undefined &&
    domain.effective_days_until_expiration !== null
  ) {
    return domain.effective_days_until_expiration;
  }
  if (domain.days_until_expiration !== null && domain.days_until_expiration !== undefined) {
    return domain.days_until_expiration;
  }
  const iso = getEffectiveExpirationIso(domain);
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  return Math.floor((end - Date.now()) / (24 * 60 * 60 * 1000));
}

/**
 * Remaining percentage (100% -> 0%, empties as expiration nears, matching SSL Certificates).
 */
export function getDomainRemainingPercent(domain: DomainInfo): number | null {
  const expIso = getEffectiveExpirationIso(domain);
  if (!expIso) return null;
  const end = new Date(expIso).getTime();
  if (Number.isNaN(end)) return null;
  const now = Date.now();
  if (end <= now) return 0;

  if (domain.creation_date) {
    const start = new Date(domain.creation_date).getTime();
    if (!Number.isNaN(start) && end > start) {
      const total = end - start;
      const remaining = end - now;
      return Math.min(100, Math.max(0, Math.round((remaining / total) * 100)));
    }
  }

  const daysLeft = getEffectiveDaysRemaining(domain);
  if (daysLeft == null) return null;
  return Math.min(100, Math.max(0, Math.round((daysLeft / 365) * 100)));
}

export function getDomainHealthState(
  domain: DomainInfo,
  thresholds: DomainThresholds = DEFAULT_DOMAIN_THRESHOLDS,
): DomainHealthState {
  const days = getEffectiveDaysRemaining(domain);
  const hasScanned = Boolean(domain.last_scanned_at);

  if (!hasScanned && days === null && !domain.error_message) {
    return "pending";
  }

  if (days !== null) {
    if (days <= 0) return "expired";
    if (domain.has_unacknowledged_changes) return "changed";
    if (days <= thresholds.criticalDays) return "critical";
    if (days <= thresholds.warningDays) return "expiring";
    return "valid";
  }

  if (domain.has_unacknowledged_changes) return "changed";
  return "no_data";
}

/** Unambiguous Spanish date: "4 may 2027" (never "4/5/2027"). */
export function formatDomainDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d
    .toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    .replace(/\.$/, "");
}

export function formatDomainExpiredAgo(days: number): string {
  const abs = Math.abs(days);
  if (abs === 0) return "vence hoy";
  return `venció hace ${abs} d`;
}

export function formatEPPStatusHuman(raw: string): {
  label: string;
  raw: string;
  protective: boolean;
} {
  const code = raw.trim();
  const low = code.toLowerCase().replace(/\s+/g, "");
  if (low.includes("clienttransferprohibited")) {
    return {
      label: "Bloqueo de transferencia (registrador)",
      raw: code,
      protective: true,
    };
  }
  if (low.includes("servertransferprohibited")) {
    return {
      label: "Bloqueo de transferencia (registro TLD)",
      raw: code,
      protective: true,
    };
  }
  if (low.includes("clientdeleteprohibited") || low.includes("serverdeleteprohibited")) {
    return {
      label: "Eliminación bloqueada",
      raw: code,
      protective: true,
    };
  }
  if (low.includes("clientupdateprohibited") || low.includes("serverupdateprohibited")) {
    return {
      label: "Cambios bloqueados",
      raw: code,
      protective: true,
    };
  }
  if (low === "ok" || low === "active") {
    return { label: "Activo", raw: code, protective: false };
  }
  return { label: code, raw: code, protective: false };
}

export function formatChangeFieldLabel(field: string): string {
  switch (field) {
    case "registrar":
      return "Registrador";
    case "name_servers":
      return "Nameservers";
    case "is_locked":
      return "Bloqueo de transferencia";
    case "expiration_date":
      return "Vencimiento";
    default:
      return field;
  }
}

export function getRegistrarPortalInfo(
  registrar: string | null | undefined,
  sourceUrl: string | null | undefined,
): { label: string; url: string } | null {
  const low = (registrar || "").toLowerCase();
  if (low.includes("cloudflare")) {
    return {
      label: "Abrir en Cloudflare",
      url: "https://dash.cloudflare.com/",
    };
  }
  if (low.includes("godaddy")) {
    return { label: "Abrir en GoDaddy", url: "https://dcc.godaddy.com/" };
  }
  if (low.includes("namecheap")) {
    return {
      label: "Abrir en Namecheap",
      url: "https://ap.www.namecheap.com/domains/list/",
    };
  }
  if (low.includes("porkbun")) {
    return {
      label: "Abrir en Porkbun",
      url: "https://porkbun.com/account/domainsSpeedy",
    };
  }
  if (low.includes("amazon") || low.includes("route 53")) {
    return {
      label: "Abrir en Route 53",
      url: "https://console.aws.amazon.com/route53/domains/",
    };
  }
  if (sourceUrl) {
    return { label: "Ver registro RDAP", url: sourceUrl };
  }
  return null;
}

export function formatDataSourceLabel(domain: DomainInfo): string {
  const src = (domain.data_source || "").toLowerCase();
  if (src === "rdap") return "fuente RDAP";
  if (src === "whois") return "fuente WHOIS";
  if (src === "manual" || (!domain.expiration_date && domain.manual_expiration_date)) {
    return "fecha manual";
  }
  return "registro público";
}

export interface DomainSummaryMetrics {
  total: number;
  expiredCount: number;
  changedCount: number;
  expiringCount: number;
  noDataCount: number;
  validCount: number;
  nextExpiring: { domain: DomainInfo; days: number } | null;
}

export interface DomainGroup {
  key: string;
  label: string;
  domains: DomainInfo[];
}

const THRESHOLDS_STORAGE_KEY = "sentinela_domain_thresholds_v1";
const DENSITY_STORAGE_KEY = "sentinela_domain_density_v1";

export function useDomains(domains: DomainInfo[]) {
  const [thresholds, setThresholdsState] = useState<DomainThresholds>(() => {
    try {
      const raw = localStorage.getItem(THRESHOLDS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          typeof parsed.warningDays === "number" &&
          typeof parsed.criticalDays === "number"
        ) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_DOMAIN_THRESHOLDS;
  });

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [registrarFilter, setRegistrarFilter] = useState<string>("all");
  const [tldFilter, setTldFilter] = useState<string>("all");
  const [lockFilter, setLockFilter] = useState<DomainLockFilter>("all");
  const [nsFilter, setNsFilter] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<DomainGroupBy>("none");
  const [sortKey, setSortKey] = useState<DomainSortKey>("expiry");
  const [sortDir, setSortDir] = useState<DomainSortDir>("asc");
  const [density, setDensityState] = useState<DomainDensity>(() => {
    try {
      const saved = localStorage.getItem(DENSITY_STORAGE_KEY);
      return saved === "comfortable" ? "comfortable" : "compact";
    } catch {
      return "compact";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(THRESHOLDS_STORAGE_KEY, JSON.stringify(thresholds));
    } catch {
      // ignore
    }
  }, [thresholds]);

  useEffect(() => {
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, density);
    } catch {
      // ignore
    }
  }, [density]);

  const setThresholds = (next: DomainThresholds) => setThresholdsState(next);
  const setDensity = (next: DomainDensity) => setDensityState(next);

  const handleSort = (key: DomainSortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const summary: DomainSummaryMetrics = useMemo(() => {
    let expiredCount = 0;
    let changedCount = 0;
    let expiringCount = 0;
    let noDataCount = 0;
    let validCount = 0;
    let nextExpiring: { domain: DomainInfo; days: number } | null = null;

    for (const d of domains) {
      const st = getDomainHealthState(d, thresholds);
      if (st === "expired") expiredCount += 1;
      else if (st === "changed") changedCount += 1;
      else if (st === "critical" || st === "expiring") expiringCount += 1;
      else if (st === "no_data") noDataCount += 1;
      else if (st === "valid") validCount += 1;

      const days = getEffectiveDaysRemaining(d);
      if (days !== null && days > 0) {
        if (!nextExpiring || days < nextExpiring.days) {
          nextExpiring = { domain: d, days };
        }
      }
    }

    return {
      total: domains.length,
      expiredCount,
      changedCount,
      expiringCount,
      noDataCount,
      validCount,
      nextExpiring,
    };
  }, [domains, thresholds]);

  const facets = useMemo(() => {
    const registrars = new Set<string>();
    const tlds = new Set<string>();
    const nsProviders = new Set<string>();

    for (const d of domains) {
      if (d.registrar) registrars.add(d.registrar);
      tlds.add(extractDomainTld(d.domain));
      const ns = parseDomainNameServers(d.name_servers);
      const prov = extractNsProvider(ns);
      if (prov) nsProviders.add(prov);
    }

    return {
      registrars: Array.from(registrars).sort(),
      tlds: Array.from(tlds).sort(),
      nsProviders: Array.from(nsProviders).sort(),
    };
  }, [domains]);

  const filteredDomains = useMemo(() => {
    return domains.filter((d) => {
      if (registrarFilter !== "all" && (d.registrar || "") !== registrarFilter) {
        return false;
      }
      if (tldFilter !== "all" && extractDomainTld(d.domain) !== tldFilter) {
        return false;
      }
      if (lockFilter !== "all") {
        if (lockFilter === "locked" && d.is_locked !== true) return false;
        if (lockFilter === "unlocked" && d.is_locked !== false) return false;
        if (lockFilter === "unknown" && d.is_locked != null) return false;
      }
      if (nsFilter !== "all") {
        const prov = extractNsProvider(parseDomainNameServers(d.name_servers));
        if (prov !== nsFilter) return false;
      }
      if (statusFilter !== "all") {
        const st = getDomainHealthState(d, thresholds);
        if (statusFilter === "expiring") {
          if (st !== "expiring" && st !== "critical") return false;
        } else if (st !== statusFilter) {
          return false;
        }
      }
      return true;
    });
  }, [
    domains,
    registrarFilter,
    tldFilter,
    lockFilter,
    nsFilter,
    statusFilter,
    thresholds,
  ]);

  const sortedDomains = useMemo(() => {
    const copy = [...filteredDomains];
    const dir = sortDir === "asc" ? 1 : -1;

    copy.sort((a, b) => {
      if (sortKey === "expiry") {
        const dA = getEffectiveDaysRemaining(a);
        const dB = getEffectiveDaysRemaining(b);
        const vA = dA ?? 999999;
        const vB = dB ?? 999999;
        if (vA !== vB) return (vA - vB) * dir;
        return a.domain.localeCompare(b.domain);
      }
      if (sortKey === "status") {
        const rA = DOMAIN_STATE_META[getDomainHealthState(a, thresholds)].severityRank;
        const rB = DOMAIN_STATE_META[getDomainHealthState(b, thresholds)].severityRank;
        if (rA !== rB) return (rA - rB) * dir;
        const dA = getEffectiveDaysRemaining(a) ?? 999999;
        const dB = getEffectiveDaysRemaining(b) ?? 999999;
        return dA - dB;
      }
      return a.domain.localeCompare(b.domain) * dir;
    });

    return copy;
  }, [filteredDomains, sortKey, sortDir, thresholds]);

  const groupedDomains: DomainGroup[] = useMemo(() => {
    if (groupBy === "none") {
      return [{ key: "all", label: "", domains: sortedDomains }];
    }
    const map = new Map<string, DomainGroup>();
    for (const d of sortedDomains) {
      let key = "";
      let label = "";
      if (groupBy === "registrar") {
        key = d.registrar || "sin_registrador";
        label = d.registrar || "Sin registrador";
      } else if (groupBy === "tld") {
        key = extractDomainTld(d.domain);
        label = key;
      } else if (groupBy === "status") {
        const st = getDomainHealthState(d, thresholds);
        key = st;
        label = DOMAIN_STATE_META[st].label;
      }
      const existing = map.get(key);
      if (existing) existing.domains.push(d);
      else map.set(key, { key, label, domains: [d] });
    }
    const groups = Array.from(map.values());
    if (groupBy === "status") {
      groups.sort(
        (a, b) =>
          (DOMAIN_STATE_META[a.key as DomainHealthState]?.severityRank ?? 9) -
          (DOMAIN_STATE_META[b.key as DomainHealthState]?.severityRank ?? 9),
      );
    } else {
      groups.sort((a, b) => a.label.localeCompare(b.label));
    }
    return groups;
  }, [sortedDomains, groupBy, thresholds]);

  return {
    thresholds,
    setThresholds,
    statusFilter,
    setStatusFilter,
    registrarFilter,
    setRegistrarFilter,
    tldFilter,
    setTldFilter,
    lockFilter,
    setLockFilter,
    nsFilter,
    setNsFilter,
    groupBy,
    setGroupBy,
    sortKey,
    sortDir,
    handleSort,
    density,
    setDensity,
    summary,
    facets,
    sortedDomains,
    groupedDomains,
  };
}
