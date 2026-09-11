/**
 * Centralized Date & Timezone Utilities for Sentinel NOC
 * Default Project Timezone: America/Guatemala (GTM / UTC-6)
 */

export const PROJECT_TIMEZONE = 'America/Guatemala';
export const PROJECT_TIMEZONE_LABEL = 'GTM (UTC-6)';

/**
 * Format date & time into localized Spanish string in America/Guatemala timezone.
 */
export function formatDateTime(
  date: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '-';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  return d.toLocaleString('es-GT', {
    timeZone: PROJECT_TIMEZONE,
    ...options,
  });
}

/**
 * Format date only into localized Spanish string (dd/mm/yyyy).
 */
export function formatDate(
  date: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '-';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  return d.toLocaleDateString('es-GT', {
    timeZone: PROJECT_TIMEZONE,
    ...options,
  });
}

/**
 * Format time only into localized Spanish string (HH:mm:ss).
 */
export function formatTime(
  date: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '-';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  return d.toLocaleTimeString('es-GT', {
    timeZone: PROJECT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    ...options,
  });
}
