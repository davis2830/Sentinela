import { Pause, Radio } from 'lucide-react';
import { formatRefreshCountdown } from '../../hooks/useAutoRefresh';

export interface AutomaticRefreshProps {
  enabled: boolean;
  countdown: number;
  onToggle: () => void;
  ready?: boolean;
  blockedReason?: string;
}

/** Consults saved results, never starts a measurement or promises real time. */
export default function AutomaticRefreshControl({ enabled, countdown, onToggle, ready = true, blockedReason }: AutomaticRefreshProps) {
  return <button type="button" onClick={onToggle} disabled={!ready || Boolean(blockedReason)}
    aria-label={enabled ? 'Pausar auto-refresco' : 'Activar auto-refresco'} aria-pressed={enabled}
    data-testid="automatic-refresh-control"
    title={enabled ? `Consulta datos guardados; no ejecuta sondeos. Próxima consulta en ${formatRefreshCountdown(countdown)}` : 'Consulta automática de datos guardados pausada o no disponible; puedes actualizar manualmente.'}
    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed ${enabled ? 'border-accent-green/30 bg-accent-green/10 text-accent-green' : 'border-border-base bg-bg-card text-text-muted'}`}>
    {enabled ? <Radio size={13} /> : <Pause size={13} />}
    {blockedReason || (!ready ? 'Frecuencia no disponible' : enabled ? 'Actualización automática activa' : 'Actualización automática pausada')}
  </button>;
}
