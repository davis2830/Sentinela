import type { SecurityGrade } from "../../types/security_headers";
import { healthPalette } from "../../utils/healthPresentation";
import type { UITone } from "./MetricCard";

interface GradeBadgeProps {
  grade: SecurityGrade | string | null;
  score?: number | null;
  className?: string;
  tone?: UITone;
}

export default function GradeBadge({
  grade,
  score,
  className = "",
  tone,
}: GradeBadgeProps) {
  const normGrade = (grade || "-").toString().toUpperCase().trim();

  let styles: string = healthPalette.muted.badge;

  switch (normGrade) {
    case "A+":
    case "A":
      styles = healthPalette.success.badge;
      break;
    case "B":
      styles = healthPalette.success.badge;
      break;
    case "C":
      styles = healthPalette.warning.badge;
      break;
    case "D":
      styles = healthPalette.warning.badge;
      break;
    case "F":
      styles = healthPalette.danger.badge;
      break;
  }

  if (tone) styles = healthPalette[tone].badge;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold border ${styles} ${className}`}
    >
      <span>Grado {normGrade}</span>
      {score !== undefined && score !== null && (
        <span className="opacity-75 font-normal">({score} pts)</span>
      )}
    </span>
  );
}
