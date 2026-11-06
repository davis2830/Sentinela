interface DistributionRow {
  id: string;
  label: string;
  tone?: 'success' | 'warning' | 'danger';
}

export const subscriptionStates: DistributionRow[] = [
  { id: 'active', label: 'Activas', tone: 'success' },
  { id: 'trialing', label: 'En prueba', tone: 'warning' },
  { id: 'past_due', label: 'Pago pendiente', tone: 'danger' },
  { id: 'suspended', label: 'Suspendidas', tone: 'danger' },
  { id: 'canceled', label: 'Canceladas' },
];

interface Props {
  title: string;
  rows: DistributionRow[];
  counts: Record<string, number>;
  total: number;
  onSelect: (id: string) => void;
}

const percent = new Intl.NumberFormat('es', { style: 'percent', maximumFractionDigits: 1 });

export default function OrganizationDistribution({ title, rows, counts, total, onSelect }: Props) {
  return <section className="ui-card min-w-0 p-4" aria-label={title}>
    <h2 className="text-base font-bold">{title}</h2>
    <p className="mt-1 text-xs text-text-muted">Selecciona una fila para abrir el directorio filtrado.</p>
    <ul className="mt-3">
      {rows.map(({ id, label, tone }) => {
        const count = counts[id] ?? 0;
        const share = total > 0 ? count / total : null;
        return <li key={id}>
          <button type="button" onClick={() => onSelect(id)}
            className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4.5rem] items-center gap-3 rounded-lg px-2 text-left text-sm hover:bg-bg-card-hover">
            <span>{label}</span>
            <span aria-hidden="true" data-tone={tone} className="h-2 overflow-hidden rounded-full bg-bg-dark">
              <span className="block h-full rounded-full"
                style={{ width: `${Math.min(share ?? 0, 1) * 100}%`, backgroundColor: tone ? 'rgb(var(--ui-tone))' : 'rgb(var(--sentinel-accent-green))' }} />
            </span>
            <span className="flex items-baseline justify-end gap-2 tabular-nums">
              <strong>{count}</strong><span className="text-xs text-text-muted">{share === null ? '—' : percent.format(share)}</span>
            </span>
          </button>
        </li>;
      })}
    </ul>
  </section>;
}
