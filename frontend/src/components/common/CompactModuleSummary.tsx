import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type SummaryItem = { label: string; value: ReactNode; onClick?: () => void; active?: boolean; icon?: LucideIcon; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'muted' };
export default function CompactModuleSummary({ items, variant = 'plain' }: { items: SummaryItem[]; variant?: 'plain' | 'status' }) {
  return <div className={`compact-summary ${variant === 'status' ? 'compact-summary-status' : ''}`} aria-label="Resumen del módulo">
    {items.map(item => {
      const Icon = item.icon;
      const content = <>{Icon && <Icon size={15} aria-hidden="true" className="summary-icon" />}<span>{item.label}</span><strong>{item.value ?? '—'}</strong></>;
      const tone = item.value == null ? 'muted' : item.tone ?? 'neutral';
      return item.onClick ? <button type="button" key={item.label} onClick={item.onClick} aria-pressed={item.active} data-tone={tone} className="compact-summary-item hover:bg-bg-card-hover">{content}</button> : <div key={item.label} data-tone={tone} className="compact-summary-item">{content}</div>;
    })}
  </div>;
}
