import type { LucideIcon } from 'lucide-react';

export type UITone = 'success' | 'warning' | 'danger' | 'info' | 'muted';

/** UI standard: one prominent value, an explicit scope and no inferred health. */
export default function MetricCard({ label, value, unit, caption, icon: Icon, tone = 'muted', compact = false, textValue = false }: {
  label: string; value: string; unit?: string; caption: string; icon: LucideIcon; tone?: UITone; compact?: boolean; textValue?: boolean;
}) {
  return <article className={compact ? 'ui-metric ui-metric-inline' : 'ui-card ui-metric'} data-tone={tone} aria-label={label}>
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-xs font-medium text-text-muted">{label}</h2>
      <Icon size={18} className="ui-tone shrink-0" aria-hidden="true" />
    </div>
    <p className="ui-metric-value ui-tone" data-text-value={textValue || undefined}><span>{value}</span>{unit && <span className="ui-metric-unit">{unit}</span>}</p>
    <p className="text-xs text-text-dim">{caption}</p>
  </article>;
}
