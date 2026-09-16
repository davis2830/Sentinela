export type FreshnessState = 'current' | 'stale' | 'pending' | 'paused' | 'error';

export interface ServiceFreshness {
  state: FreshnessState;
  lastAt: string | null;
}

interface ScheduledCheck {
  enabled: boolean;
  last_checked_at: string | null;
  intervalSeconds: number;
}

export function latestTimestamp(values: (string | null | undefined)[]): string | null {
  const valid = values.filter((value): value is string => Boolean(value) && Number.isFinite(Date.parse(value!)));
  return valid.length ? valid.reduce((latest, value) => Date.parse(value) > Date.parse(latest) ? value : latest) : null;
}

export function scheduledFreshness(checks: ScheduledCheck[] | undefined, error: boolean, now = Date.now()): ServiceFreshness {
  if (error) return { state: 'error', lastAt: null };
  if (!checks?.length) return { state: 'pending', lastAt: null };
  const active = checks.filter((check) => check.enabled);
  if (!active.length) return { state: 'paused', lastAt: latestTimestamp(checks.map((check) => check.last_checked_at)) };
  const lastAt = latestTimestamp(active.map((check) => check.last_checked_at));
  if (active.some((check) => !check.last_checked_at || !Number.isFinite(Date.parse(check.last_checked_at)))) {
    return { state: 'pending', lastAt };
  }
  const stale = active.some((check) => now - Date.parse(check.last_checked_at!) > Math.max(60000, check.intervalSeconds * 2000));
  return { state: stale ? 'stale' : 'current', lastAt };
}

export function scannedFreshness(scans: (string | null)[] | undefined, error: boolean): ServiceFreshness {
  if (error) return { state: 'error', lastAt: null };
  const lastAt = latestTimestamp(scans || []);
  return { state: lastAt ? 'current' : 'pending', lastAt };
}

export function formatFreshness(freshness: ServiceFreshness): string {
  if (freshness.state === 'error') return 'Error de carga';
  if (freshness.state === 'paused') return 'Pausado';
  if (freshness.state === 'pending') return 'Sin datos';
  if (freshness.state === 'stale') return 'Dato atrasado';
  if (!freshness.lastAt) return 'Sin datos';
  const checked = new Date(freshness.lastAt);
  const today = new Date();
  const sameDay = checked.toDateString() === today.toDateString();
  return `Último ${checked.toLocaleString('es-ES', sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
}
