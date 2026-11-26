import { useMemo } from "react";
import {
  Building2,
  Calendar,
  Link2,
  Shield,
  type LucideIcon,
} from "lucide-react";
import type { SSLCertificate } from "../../types/ssl";
import type {
  StatusIconShape,
  StatusTone,
} from "../common/connectivity/StatusPill";

export interface SSLThresholds {
  warningDays: number;
  criticalDays: number;
}

export const DEFAULT_SSL_THRESHOLDS: SSLThresholds = {
  warningDays: 14,
  criticalDays: 7,
};

export const SSL_THRESHOLDS_STORAGE_KEY = "sentinel_ssl_thresholds_v1";

export function loadSSLThresholds(): SSLThresholds {
  if (typeof window === "undefined") return DEFAULT_SSL_THRESHOLDS;
  try {
    const raw = window.localStorage.getItem(SSL_THRESHOLDS_STORAGE_KEY);
    if (!raw) return DEFAULT_SSL_THRESHOLDS;
    const parsed = JSON.parse(raw) as Partial<SSLThresholds>;
    const warningDays = Math.min(
      90,
      Math.max(2, Number(parsed.warningDays) || DEFAULT_SSL_THRESHOLDS.warningDays),
    );
    const criticalDays = Math.min(
      warningDays - 1,
      Math.max(1, Number(parsed.criticalDays) || DEFAULT_SSL_THRESHOLDS.criticalDays),
    );
    return { warningDays, criticalDays };
  } catch {
    return DEFAULT_SSL_THRESHOLDS;
  }
}

export function saveSSLThresholds(next: SSLThresholds): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SSL_THRESHOLDS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

export type SSLHealthState =
  | "expired"
  | "problem"
  | "critical"
  | "expiring"
  | "valid"
  | "pending";

export type SSLSortField = "expiry" | "status" | "domain" | "grade";
export type SSLGroupBy = "none" | "expiry_bucket" | "issuer" | "tls" | "origin";
export type SSLDensity = "compact" | "comfortable";
export type SSLOriginFilter = "all" | "linked" | "manual";

const SPANISH_MONTHS_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** Unambiguous Spanish date format: "3 ene 2027", "26 dic 2026". */
export function formatSSLDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${SPANISH_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function parseIssuerOrganization(issuerStr: string | null | undefined): string {
  if (!issuerStr) return "Desconocido";
  const orgMatch = issuerStr.match(/organizationName=([^,]+)/i);
  if (orgMatch && orgMatch[1]) return orgMatch[1].trim();
  const cnMatch = issuerStr.match(/commonName=([^,]+)/i);
  if (cnMatch && cnMatch[1]) return cnMatch[1].trim();
  return issuerStr.split(",")[0].replace(/^CN=/i, "").trim() || "Desconocido";
}

export function parseIssuerCommonName(issuerStr: string | null | undefined): string {
  if (!issuerStr) return "";
  const cnMatch = issuerStr.match(/commonName=([^,]+)/i);
  return cnMatch && cnMatch[1] ? cnMatch[1].trim() : "";
}

export function formatTLSVersion(tls: string | null | undefined): string {
  if (!tls) return "";
  return tls.replace(/^TLSv/i, "TLS ").replace(/^SSLv/i, "SSL ").trim();
}

export function isLegacyTLS(tls: string | null | undefined): boolean {
  if (!tls) return false;
  const norm = tls.toLowerCase().replace(/\s+/g, "");
  return (
    norm === "tlsv1" ||
    norm === "tlsv1.0" ||
    norm === "tlsv1.1" ||
    norm === "tls1.0" ||
    norm === "tls1.1" ||
    norm.startsWith("sslv")
  );
}

/** Concise 1-line problem reason (analogous to "404 ≠ 200" in Uptime). */
export function getSSLProblemReason(cert: SSLCertificate): string | null {
  const err = (cert.error_message || "").trim();
  const lower = err.toLowerCase();
  const code = (cert.last_error_code || "").toUpperCase();

  if (lower.includes("autofirmado") || lower.includes("self-signed") || lower.includes("self signed")) {
    return "Autofirmado";
  }
  if (lower.includes("no coincide") || lower.includes("hostname") || lower.includes("mismatch")) {
    return "Dominio no coincide";
  }
  if (lower.includes("cadena") || lower.includes("issuer") || lower.includes("chain")) {
    return "Cadena incompleta";
  }
  if (code === "DNS_FAILED" || lower.includes("resolver")) {
    return "DNS sin respuesta";
  }
  if (code === "CONNECTION_FAILED" || lower.includes("establecer la conexión")) {
    return "Dominio inalcanzable";
  }
  if (code === "TLS_HANDSHAKE_FAILED" || lower.includes("negociación")) {
    return "Fallo de negociación TLS";
  }
  if (code === "INVALID_CERTIFICATE" || lower.includes("validación tls")) {
    return "Certificado no confiable";
  }
  if (isLegacyTLS(cert.tls_version)) {
    return `TLS antiguo (${formatTLSVersion(cert.tls_version)})`;
  }
  if (err) {
    return err.length > 36 ? `${err.slice(0, 34)}…` : err;
  }
  if (cert.last_scanned_at && !cert.is_valid) {
    return "Certificado inválido";
  }
  return null;
}

export function getSSLHealthState(
  cert: SSLCertificate,
  thresholds: SSLThresholds = DEFAULT_SSL_THRESHOLDS,
): SSLHealthState {
  const hasScan = Boolean(
    cert.last_scanned_at && Number.isFinite(Date.parse(cert.last_scanned_at)),
  );
  const errLower = (cert.error_message || "").toLowerCase();

  // Expired takes top priority if clearly past expiration
  if (
    (cert.days_remaining !== null &&
      cert.days_remaining !== undefined &&
      cert.days_remaining <= 0) ||
    errLower.includes("vencido") ||
    errLower.includes("expired")
  ) {
    return "expired";
  }

  // Non-expiry certificate / TLS / connectivity problems
  if (
    cert.last_error_code ||
    cert.error_message ||
    (hasScan && !cert.is_valid) ||
    isLegacyTLS(cert.tls_version)
  ) {
    return "problem";
  }

  if (!hasScan || cert.days_remaining === null || cert.days_remaining === undefined) {
    return "pending";
  }

  if (cert.days_remaining <= thresholds.criticalDays) {
    return "critical";
  }
  if (cert.days_remaining <= thresholds.warningDays) {
    return "expiring";
  }
  return "valid";
}

export const SSL_STATE_META: Record<
  SSLHealthState,
  { label: string; shortLabel: string; tone: StatusTone; shape: StatusIconShape }
> = {
  expired: {
    label: "Vencido",
    shortLabel: "Vencido",
    tone: "danger",
    shape: "error",
  },
  problem: {
    label: "Con problemas",
    shortLabel: "Con problemas",
    tone: "danger",
    shape: "error",
  },
  critical: {
    label: "Por expirar",
    shortLabel: "Crítico",
    tone: "danger",
    shape: "alert",
  },
  expiring: {
    label: "Por expirar",
    shortLabel: "Por expirar",
    tone: "warning",
    shape: "alert",
  },
  valid: {
    label: "Válido",
    shortLabel: "Válido",
    tone: "success",
    shape: "check",
  },
  pending: {
    label: "Sin datos",
    shortLabel: "Sin datos",
    tone: "muted",
    shape: "clock",
  },
};

export function formatExpiredAgo(days: number, short = false): string {
  if (days >= 0) return "venció hoy";
  const abs = Math.abs(days);
  if (short) return `venció hace ${abs} d`;
  return `venció hace ${abs} ${abs === 1 ? "día" : "días"}`;
}

const GRADE_RANK: Record<string, number> = {
  "A+": 0,
  A: 1,
  "A-": 2,
  B: 3,
  C: 4,
  D: 5,
  E: 6,
  F: 7,
};

/**
 * Remaining lifetime percentage (100% = freshly issued, 0% = expired).
 * Drains toward 0% as expiration approaches so less remaining time always shows a shorter bar.
 */
export function getCertRemainingPercent(cert: SSLCertificate): number | null {
  if (cert.days_remaining !== null && cert.days_remaining !== undefined && cert.days_remaining <= 0) {
    return 0;
  }
  if (cert.issued_at && cert.expiration_date) {
    const start = Date.parse(cert.issued_at);
    const end = Date.parse(cert.expiration_date);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      const remainingMs = Math.max(0, end - Date.now());
      return Math.min(100, Math.max(2, Math.round((remainingMs / (end - start)) * 100)));
    }
  }
  if (cert.days_remaining !== null && cert.days_remaining !== undefined) {
    // Fallback assuming a 90-day standard certificate window
    return Math.min(100, Math.max(2, Math.round((cert.days_remaining / 90) * 100)));
  }
  return null;
}

export function getSSLGradeTooltip(cert: SSLCertificate): string {
  const grade = cert.security_grade || "—";
  const tls = formatTLSVersion(cert.tls_version) || "TLS sin medir";
  const key = cert.key_info ? `, clave (${cert.key_info})` : "";
  const days =
    cert.days_remaining !== null && cert.days_remaining !== undefined
      ? cert.days_remaining <= 0
        ? "vencido"
        : `${cert.days_remaining} d restantes`
      : "vigencia sin medir";
  return `Grado ${grade} — Evalúa protocolo (${tls})${key}, cadena de confianza y vigencia (${days}). Baja si hay TLS antiguo (1.0/1.1), cadena incompleta, clave débil o vencimiento próximo.`;
}

export interface SSLChainStep {
  label: string;
  tooltip: string;
}

export function getCertificateChainSteps(cert: SSLCertificate): {
  steps: SSLChainStep[];
  complete: boolean;
} {
  const leaf = cert.domain;
  const intermediate = parseIssuerCommonName(cert.issuer);
  const org = parseIssuerOrganization(cert.issuer);
  const expiryNote = cert.expiration_date
    ? ` · válido hasta ${formatSSLDate(cert.expiration_date)}`
    : "";

  const steps: SSLChainStep[] = [
    {
      label: leaf,
      tooltip: `Certificado hoja del dominio ${leaf}${expiryNote}`,
    },
  ];
  if (intermediate && intermediate.toLowerCase() !== leaf.toLowerCase()) {
    steps.push({
      label: intermediate,
      tooltip:
        org && org !== "Desconocido"
          ? `${org} ${intermediate} (intermedio)`
          : `${intermediate} (intermedio)`,
    });
  }
  if (
    org &&
    org !== "Desconocido" &&
    org.toLowerCase() !== intermediate.toLowerCase() &&
    org.toLowerCase() !== leaf.toLowerCase()
  ) {
    const isLE = org.toLowerCase().includes("let's encrypt");
    const rootLabel = isLE && intermediate ? "ISRG Root X1" : org;
    steps.push({
      label: rootLabel,
      tooltip: isLE
        ? "ISRG Root X1 · Autoridad raíz de confianza de Let's Encrypt"
        : `${org} · Autoridad certificadora raíz`,
    });
  }
  const complete = Boolean(
    cert.last_scanned_at && cert.is_valid && !cert.error_message && !cert.last_error_code,
  );
  return { steps, complete };
}

/**
 * Estimates expected automatic renewal window for short-lived (~90d) ACME certificates
 * (e.g. Let's Encrypt, Google Trust Services, ZeroSSL) which renew ~30 days before expiry.
 */
export function getExpectedRenewalInfo(
  cert: SSLCertificate,
  thresholds: SSLThresholds = DEFAULT_SSL_THRESHOLDS,
): {
  label: string;
  tone: "muted" | "info" | "warning";
  tooltip: string;
} | null {
  if (!cert.expiration_date || !cert.is_valid || cert.days_remaining == null || cert.days_remaining <= 0) {
    return null;
  }
  const orgName = parseIssuerOrganization(cert.issuer);
  const org = orgName.toLowerCase();
  const isAutoCA =
    org.includes("let's encrypt") ||
    org.includes("google trust") ||
    org.includes("zerossl") ||
    org.includes("buypass");

  let totalDays: number | null = null;
  if (cert.issued_at) {
    const start = Date.parse(cert.issued_at);
    const end = Date.parse(cert.expiration_date);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      totalDays = Math.round((end - start) / 86400000);
    }
  }

  if (!isAutoCA && (totalDays === null || totalDays > 100)) {
    return null;
  }

  const state = getSSLHealthState(cert, thresholds);
  const endMs = Date.parse(cert.expiration_date);
  const renewMs = endMs - 30 * 86400000;
  const renewDateStr = formatSSLDate(new Date(renewMs).toISOString());

  if (cert.days_remaining > 30) {
    return {
      label: `Renovación esperada ~${renewDateStr}`,
      tone: "muted",
      tooltip: `Los certificados de ${totalDays ?? 90} días (${orgName}) suelen renovarse automáticamente ~30 días antes del vencimiento.`,
    };
  }

  // Within <= 30 days: match visual tone with active threshold state so there is never a contradiction
  if (state === "valid") {
    return {
      label: "Renovación automática prevista",
      tone: "info",
      tooltip: `Dentro de la ventana habitual de renovación automática de ${orgName} (≤ 30 d). Escalará a aviso ámbar si llega a ≤ ${thresholds.warningDays} d sin renovarse.`,
    };
  }

  return {
    label: "Sin renovación automática aún · revisar ACME",
    tone: "warning",
    tooltip: `El certificado ya alcanzó tu umbral de aviso (≤ ${thresholds.warningDays} d) sin renovarse automáticamente. Verifica Certbot/ACME en el servidor.`,
  };
}

export function formatShortFingerprint(fp: string | null | undefined): string {
  if (!fp) return "—";
  const clean = fp.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (clean.length <= 12) return clean;
  const pairs = clean.match(/.{1,2}/g) || [];
  if (pairs.length <= 6) return pairs.join(":");
  return `${pairs.slice(0, 3).join(":")}…${pairs.slice(-3).join(":")}`;
}

export function isCertLinkedToUptime(cert: SSLCertificate): boolean {
  return Boolean(cert.linked_targets && cert.linked_targets.length > 0);
}

export interface SSLSummaryMetrics {
  totalCount: number;
  expiredCount: number;
  problemCount: number;
  expiringCount: number;
  validCount: number;
  pendingCount: number;
  nextExpiring: { cert: SSLCertificate; days: number } | null;
}

export interface SSLGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  certs: SSLCertificate[];
  urgentCount: number;
}

const STATE_PRIORITY: Record<SSLHealthState, number> = {
  expired: 0,
  problem: 1,
  critical: 2,
  expiring: 3,
  valid: 4,
  pending: 5,
};

interface UseSSLCertificatesParams {
  certificates: SSLCertificate[];
  thresholds: SSLThresholds;
  statusFilter: string;
  issuerFilter: string;
  tlsFilter: string;
  gradeFilter: string;
  originFilter: SSLOriginFilter;
  search: string;
  sortField: SSLSortField;
  sortAsc: boolean;
  groupBy: SSLGroupBy;
}

export function useSSLCertificates({
  certificates,
  thresholds,
  statusFilter,
  issuerFilter,
  tlsFilter,
  gradeFilter,
  originFilter,
  search,
  sortField,
  sortAsc,
  groupBy,
}: UseSSLCertificatesParams) {
  // 1. Summary over loaded certificates (using configurable thresholds!)
  const summary = useMemo<SSLSummaryMetrics>(() => {
    let expiredCount = 0;
    let problemCount = 0;
    let expiringCount = 0;
    let validCount = 0;
    let pendingCount = 0;
    let nextExpiring: { cert: SSLCertificate; days: number } | null = null;

    for (const c of certificates) {
      const state = getSSLHealthState(c, thresholds);
      if (state === "expired") expiredCount++;
      else if (state === "problem") problemCount++;
      else if (state === "critical" || state === "expiring") expiringCount++;
      else if (state === "valid") validCount++;
      else pendingCount++;

      if (
        c.days_remaining !== null &&
        c.days_remaining !== undefined &&
        c.days_remaining > 0 &&
        state !== "problem"
      ) {
        if (!nextExpiring || c.days_remaining < nextExpiring.days) {
          nextExpiring = { cert: c, days: c.days_remaining };
        }
      }
    }

    return {
      totalCount: certificates.length,
      expiredCount,
      problemCount,
      expiringCount,
      validCount,
      pendingCount,
      nextExpiring,
    };
  }, [certificates, thresholds]);

  // 2. Facet options for Filtros popover
  const facets = useMemo(() => {
    const issuers = new Set<string>();
    const tlsVersions = new Set<string>();
    const grades = new Set<string>();
    for (const c of certificates) {
      if (c.issuer) issuers.add(parseIssuerOrganization(c.issuer));
      if (c.tls_version) tlsVersions.add(formatTLSVersion(c.tls_version));
      if (c.security_grade) grades.add(c.security_grade.toUpperCase());
    }
    return {
      issuers: Array.from(issuers).sort(),
      tlsVersions: Array.from(tlsVersions).sort().reverse(),
      grades: Array.from(grades).sort(),
    };
  }, [certificates]);

  // 3. Filter & sort (default: expired/problems first, then soonest expiring first!)
  const sortedCertificates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = certificates.filter((c) => {
      const state = getSSLHealthState(c, thresholds);

      if (statusFilter !== "all") {
        if (statusFilter === "expiring") {
          if (state !== "expiring" && state !== "critical") return false;
        } else if (statusFilter === "expired") {
          if (state !== "expired") return false;
        } else if (statusFilter === "problem") {
          if (state !== "problem") return false;
        } else if (statusFilter === "valid") {
          if (state !== "valid") return false;
        } else if (state !== statusFilter) {
          return false;
        }
      }

      if (issuerFilter !== "all" && parseIssuerOrganization(c.issuer) !== issuerFilter) {
        return false;
      }

      if (tlsFilter !== "all" && formatTLSVersion(c.tls_version) !== tlsFilter) {
        return false;
      }

      if (gradeFilter !== "all" && (c.security_grade || "").toUpperCase() !== gradeFilter) {
        return false;
      }

      if (originFilter === "linked" && !isCertLinkedToUptime(c)) return false;
      if (originFilter === "manual" && isCertLinkedToUptime(c)) return false;

      if (q) {
        const hay = [
          c.domain,
          c.issuer || "",
          parseIssuerOrganization(c.issuer),
          c.algorithm || "",
          c.tls_version || "",
          ...(c.san_domains || []),
          ...(c.linked_targets?.map((t) => t.name) || []),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      const aState = getSSLHealthState(a, thresholds);
      const bState = getSSLHealthState(b, thresholds);

      if (sortField === "expiry") {
        // Always prioritize expired & problems above healthy, then sort by days remaining
        const aExpiredOrProb = aState === "expired" ? 0 : aState === "problem" ? 1 : aState === "pending" ? 3 : 2;
        const bExpiredOrProb = bState === "expired" ? 0 : bState === "problem" ? 1 : bState === "pending" ? 3 : 2;
        if (aExpiredOrProb !== bExpiredOrProb) {
          return sortAsc ? aExpiredOrProb - bExpiredOrProb : bExpiredOrProb - aExpiredOrProb;
        }
        const aDays = a.days_remaining ?? Number.POSITIVE_INFINITY;
        const bDays = b.days_remaining ?? Number.POSITIVE_INFINITY;
        if (aDays !== bDays) return sortAsc ? aDays - bDays : bDays - aDays;
        return a.domain.localeCompare(b.domain);
      }

      if (sortField === "status") {
        const diff = STATE_PRIORITY[aState] - STATE_PRIORITY[bState];
        if (diff !== 0) return sortAsc ? diff : -diff;
        const aDays = a.days_remaining ?? Number.POSITIVE_INFINITY;
        const bDays = b.days_remaining ?? Number.POSITIVE_INFINITY;
        if (aDays !== bDays) return aDays - bDays;
        return a.domain.localeCompare(b.domain);
      }

      if (sortField === "grade") {
        const aRank = GRADE_RANK[(a.security_grade || "").toUpperCase()] ?? 99;
        const bRank = GRADE_RANK[(b.security_grade || "").toUpperCase()] ?? 99;
        if (aRank !== bRank) return sortAsc ? aRank - bRank : bRank - aRank;
        return a.domain.localeCompare(b.domain);
      }

      return sortAsc
        ? a.domain.localeCompare(b.domain)
        : b.domain.localeCompare(a.domain);
    });

    return filtered;
  }, [
    certificates,
    thresholds,
    statusFilter,
    issuerFilter,
    tlsFilter,
    gradeFilter,
    originFilter,
    search,
    sortField,
    sortAsc,
  ]);

  // 4. Optional Grouping
  const groupedCertificates = useMemo<SSLGroup[] | null>(() => {
    if (groupBy === "none") return null;
    const map = new Map<string, SSLGroup & { order: number }>();

    for (const c of sortedCertificates) {
      const state = getSSLHealthState(c, thresholds);
      const days = c.days_remaining;
      let key: string;
      let label: string;
      let icon: LucideIcon;
      let order = 50;

      if (groupBy === "expiry_bucket") {
        if (state === "expired" || state === "problem") {
          key = "urgent";
          label = "Vencidos y con problemas";
          order = 0;
        } else if (state === "pending" || days === null || days === undefined) {
          key = "pending";
          label = "Sin chequeo aún";
          order = 4;
        } else if (days <= 7) {
          key = "week";
          label = "Vencen esta semana (≤ 7 días)";
          order = 1;
        } else if (days <= 30) {
          key = "month";
          label = "Vencen este mes (8–30 días)";
          order = 2;
        } else {
          key = "later";
          label = "Más adelante (> 30 días)";
          order = 3;
        }
        icon = Calendar;
      } else if (groupBy === "issuer") {
        const org = parseIssuerOrganization(c.issuer);
        key = org;
        label = org;
        icon = Building2;
      } else if (groupBy === "tls") {
        const tls = formatTLSVersion(c.tls_version) || "Sin protocolo";
        key = tls;
        label = tls;
        icon = Shield;
      } else {
        const linked = isCertLinkedToUptime(c);
        key = linked ? "linked" : "manual";
        label = linked ? "Vinculados a Uptime" : "Agregados manualmente";
        order = linked ? 0 : 1;
        icon = Link2;
      }

      let group = map.get(key);
      if (!group) {
        group = { key, label, icon, certs: [], urgentCount: 0, order };
        map.set(key, group);
      }
      group.certs.push(c);
      if (state === "expired" || state === "problem" || state === "critical") {
        group.urgentCount++;
      }
    }

    return Array.from(map.values())
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        if (a.urgentCount > 0 && b.urgentCount === 0) return -1;
        if (b.urgentCount > 0 && a.urgentCount === 0) return 1;
        return a.label.localeCompare(b.label);
      })
      .map(({ order: _order, ...rest }) => rest);
  }, [sortedCertificates, groupBy, thresholds]);

  return {
    summary,
    facets,
    sortedCertificates,
    groupedCertificates,
  };
}
