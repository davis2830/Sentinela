/** Presentation only: never infer health from a percentage threshold. */
export function dashboardHealthTone({ total, down, degraded, unknown, score, unavailable = false }: {
  total: number; down: number; degraded: number; unknown: number; score: number | null; unavailable?: boolean;
}) {
  if (unavailable || score == null || total === 0) return 'text-text-muted';
  if (down > 0) return 'text-accent-red';
  if (degraded > 0) return 'text-accent-yellow';
  if (unknown > 0) return 'text-text-muted';
  return 'text-emerald-400';
}
