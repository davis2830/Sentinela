import type { MonitoringTarget } from '../../types/monitoring';
import { finite, formatMetric, latencyTone } from '../../utils/endpointPresentation';

export function latestTargetCheck(target: MonitoringTarget) {
  return [...(target.recent_checks || [])].reverse().find(
    (c) => target.last_checked_at != null && Date.parse(c.checked_at) === Date.parse(target.last_checked_at)
  );
}

export function TargetDiagnostic({
  target,
  compact = false,
}: {
  target: MonitoringTarget;
  compact?: boolean;
}) {
  if (!target.enabled || !['slow', 'down', 'error'].includes(target.last_status || '')) return null;
  const check = latestTargetCheck(target);
  const message = check?.diagnostic || (target.last_status === 'slow' ? 'Respuesta lenta registrada' : 'Comprobación fallida');

  if (compact) {
    return (
      <span
        title={message}
        className="inline-flex items-center text-[11px] font-mono font-medium text-rose-400 truncate max-w-[280px]"
      >
        ⚠️ {message}
      </span>
    );
  }

  return (
    <p
      title={message}
      className="text-xs mt-0.5 text-accent-red font-mono truncate max-w-[320px]"
    >
      ⚠️ {message}
    </p>
  );
}

export default function TargetLatency({
  target,
  compact = true,
}: {
  target: MonitoringTarget;
  compact?: boolean;
}) {
  const isDown = ['down', 'error'].includes(target.last_status || '');
  const measured = Boolean(target.last_checked_at && Number.isFinite(Date.parse(target.last_checked_at)));
  const value = !isDown && measured && finite(target.last_latency) && target.last_latency >= 0
    ? `${formatMetric(target.last_latency)} ms`
    : '—';
  const tone = isDown || !measured || !target.enabled
    ? 'muted'
    : latencyTone(target.last_latency, target.max_latency_ms, target.last_status);
  const limitText = finite(target.max_latency_ms) && target.max_latency_ms > 0
    ? `${formatMetric(target.max_latency_ms)} ms`
    : 'Sin configurar';

  // Last known latency when down
  const lastUpCheck = isDown
    ? [...(target.recent_checks || [])].reverse().find((c) => c.status === 'up' && finite(c.latency))
    : null;
  const lastKnownLat = lastUpCheck?.latency ? `${formatMetric(lastUpCheck.latency)} ms` : null;

  if (compact) {
    if (isDown && target.enabled) {
      return (
        <div data-testid="target-latency" className="inline-flex items-center whitespace-nowrap">
          <span
            className="font-mono text-text-dim text-xs"
            title={`Servicio caído • Última latencia registrada: ${lastKnownLat || 'N/A'}`}
          >
            {lastKnownLat ? `(últ. ${lastKnownLat})` : '—'}
          </span>
        </div>
      );
    }

    return (
      <div data-testid="target-latency" className="inline-flex items-center whitespace-nowrap">
        <span
          className="ui-tone font-mono font-bold text-xs"
          data-tone={tone}
          title={`Latencia: ${value} (Límite: ${limitText})`}
        >
          {value}
        </span>
      </div>
    );
  }

  const applied = latestTargetCheck(target)?.applied_max_latency_ms;
  return (
    <div className="space-y-1" data-testid="target-latency">
      <span className="ui-tone font-mono font-bold" data-tone={tone}>
        {value}
      </span>
      <p className="text-xs font-normal text-text-dim">
        Límite actual: {limitText}
      </p>
      {finite(applied) && applied !== target.max_latency_ms && (
        <p className="text-xs font-normal text-text-dim">Aplicado: {formatMetric(applied)} ms</p>
      )}
    </div>
  );
}
