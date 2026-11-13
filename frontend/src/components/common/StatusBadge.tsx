import { healthPalette } from "../../utils/healthPresentation";
export type StatusType =
  | "up"
  | "down"
  | "expiring"
  | "expired"
  | "valid"
  | "invalid"
  | "slow"
  | "error"
  | "active"
  | "inactive";

interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  className?: string;
}

export default function StatusBadge({
  status,
  label,
  className = "",
}: StatusBadgeProps) {
  const raw = (status || "").toString().toLowerCase();
  const normalized =
    (
      {
        valido: "valid",
        expirado: "expired",
        por_expirar: "expiring",
        fallo: "error",
        activo: "active",
        desconocido: "unknown",
      } as Record<string, string>
    )[raw] || raw;

  let styles = `${healthPalette.muted.badge} font-medium`;
  let defaultLabel = normalized
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
    : "";

  switch (normalized) {
    case "unknown":
      defaultLabel = "Sin medición";
      break;
    case "critical":
      defaultLabel = "Vence en 7 días o menos";
      styles = `${healthPalette.danger.badge} font-semibold`;
      break;
    case "error_medicion":
      defaultLabel = "Error de medición";
      styles = healthPalette.warning.badge;
      break;
    case "certificado_invalido":
      defaultLabel = "Certificado inválido";
      styles = healthPalette.danger.badge;
      break;
    case "up":
    case "pass":
    case "valid":
    case "active":
    case "ok":
      styles = `${healthPalette.success.badge} font-semibold`;
      if (normalized === "valid") defaultLabel = "Válido";
      if (normalized === "active") defaultLabel = "Activo";
      if (normalized === "up") defaultLabel = "Online";
      if (normalized === "pass") defaultLabel = "Pass";
      if (normalized === "ok") defaultLabel = "OK";
      break;

    case "expiring":
      styles = `${healthPalette.warning.badge} font-semibold`;
      defaultLabel = "Por expirar";
      break;

    case "down":
    case "fail":
    case "expired":
    case "invalid":
    case "error":
      styles = `${healthPalette.danger.badge} font-semibold`;
      if (normalized === "expired") defaultLabel = "Expirado";
      if (normalized === "invalid") defaultLabel = "Inválido";
      if (normalized === "down") defaultLabel = "Caído";
      if (normalized === "fail") defaultLabel = "Fallo";
      if (normalized === "error") defaultLabel = "Error";
      break;

    case "slow":
      styles = `${healthPalette.warning.badge} font-semibold`;
      defaultLabel = "Lento";
      break;

    case "open":
      styles = `${healthPalette.danger.badge} font-semibold`;
      defaultLabel = "Abierto";
      break;

    case "investigating":
      styles = `${healthPalette.warning.badge} font-semibold`;
      defaultLabel = "Investigando";
      break;

    case "identified":
      styles = `${healthPalette.info.badge} font-semibold`;
      defaultLabel = "Identificado";
      break;

    case "mitigated":
      styles = `${healthPalette.warning.badge} font-semibold`;
      defaultLabel = "Mitigado";
      break;

    case "resolved":
      styles = `${healthPalette.success.badge} font-semibold`;
      defaultLabel = "Resuelto";
      break;

    case "closed":
      styles = "bg-bg-dark text-text-muted border-border-base font-semibold";
      defaultLabel = "Cerrado";
      break;

    case "inactive":
      styles = `${healthPalette.muted.badge} font-semibold`;
      defaultLabel = "Inactivo";
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles} ${className}`}
    >
      {label || defaultLabel}
    </span>
  );
}
