import type { UITone } from "../components/common/MetricCard";
import type { SSLCertificate } from "../types/ssl";
import type { DomainInfo } from "../types/domain";
import type { APICheckTarget } from "../types/api_checks";
import type { DNSRecord } from "../types/dns";
import type { SecurityHeaderTarget } from "../types/security_headers";
import { securityTone } from "./endpointPresentation";

/** Operational colors are independent of the turquoise brand/action token. */
export const healthPalette = {
  success: {
    text: "text-emerald-400",
    fill: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  warning: {
    text: "text-amber-400",
    fill: "bg-amber-400",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  danger: {
    text: "text-rose-400",
    fill: "bg-rose-500",
    badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  },
  muted: {
    text: "text-text-dim",
    fill: "bg-slate-500",
    badge: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  },
  info: {
    text: "text-sky-400",
    fill: "bg-sky-400",
    badge: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  },
} satisfies Record<UITone, { text: string; fill: string; badge: string }>;

export function hasMeasurement(stamp?: string | null) {
  return !!stamp && Number.isFinite(Date.parse(stamp));
}

export function expirationTone(
  days: number | null | undefined,
  known = true,
): UITone {
  if (!known || typeof days !== "number" || !Number.isFinite(days))
    return "muted";
  return days <= 7 ? "danger" : days <= 30 ? "warning" : "success";
}

export function sslStatus(cert: SSLCertificate) {
  if (cert.last_error_code === "INVALID_CERTIFICATE")
    return "certificado_invalido";
  if (cert.error_message) return "error_medicion";
  if (!hasMeasurement(cert.last_scanned_at)) return "desconocido";
  if (!cert.is_valid) return "fallo";
  if (cert.days_remaining !== null && cert.days_remaining < 0)
    return "expirado";
  const tone = expirationTone(cert.days_remaining);
  return tone === "danger"
    ? "critical"
    : tone === "warning"
      ? "por_expirar"
      : "valido";
}

export function domainExpiryTone(domain: DomainInfo): UITone {
  return expirationTone(
    domain.days_until_expiration,
    hasMeasurement(domain.last_scanned_at) &&
      domain.status !== "error" &&
      !domain.error_message,
  );
}

export function domainStatus(domain: DomainInfo) {
  if (domain.status === "error" || domain.error_message)
    return "error_medicion";
  if (!hasMeasurement(domain.last_scanned_at)) return "Sin consulta";
  if (domain.days_until_expiration == null) return "Vigencia desconocida";
  if (domain.days_until_expiration <= 0) return "expirado";
  const tone = domainExpiryTone(domain);
  return tone === "danger"
    ? "critical"
    : tone === "warning"
      ? "por_expirar"
      : "valido";
}

export function sslExpiryTone(cert: SSLCertificate): UITone {
  const known =
    hasMeasurement(cert.last_scanned_at) &&
    !cert.error_message &&
    cert.last_error_code !== "INVALID_CERTIFICATE";
  const tone = expirationTone(cert.days_remaining, known);
  return !cert.is_valid && tone === "success" ? "muted" : tone;
}

export function sslGradeTone(
  grade: string | null | undefined,
  measured = true,
): UITone {
  if (!measured || !grade) return "muted";
  const normalized = grade.trim().toUpperCase();
  return ["A+", "A"].includes(normalized)
    ? "success"
    : ["B", "C"].includes(normalized)
      ? "warning"
      : ["D", "E", "F", "T", "M"].includes(normalized)
        ? "danger"
        : "muted";
}

export function apiResponseTone(target: APICheckTarget): UITone {
  const value = target.last_response_time_ms;
  if (
    !hasMeasurement(target.last_checked_at) ||
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  )
    return "muted";
  if (["fail", "error"].includes(target.last_status || "")) return "danger";
  return value > target.expected_response_time_ms ? "warning" : "success";
}

export function dnsResponseTone(record: DNSRecord): UITone {
  const value = record.response_time_ms;
  if (
    !hasMeasurement(record.last_successful_at || record.last_scanned_at) ||
    record.last_error_code ||
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  )
    return "muted";
  return value < 400 ? "success" : value < 1000 ? "warning" : "danger";
}

export function securityHealthTone(target: SecurityHeaderTarget): UITone {
  if (!hasMeasurement(target.last_checked_at)) return "muted";
  const tone = securityTone(target.last_score);
  return target.info_leak_detected && tone === "success" ? "warning" : tone;
}

export function securityResponseTone(target: SecurityHeaderTarget): UITone {
  const value = target.last_response_time_ms;
  if (
    !hasMeasurement(target.last_checked_at) ||
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  )
    return "muted";
  return value < 400 ? "success" : value < 1000 ? "warning" : "danger";
}
