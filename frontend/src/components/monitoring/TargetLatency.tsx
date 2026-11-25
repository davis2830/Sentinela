import type { MonitoringTarget } from '../../types/monitoring';
import { finite, formatMetric, latencyTone } from '../../utils/endpointPresentation';
import { AlertTriangle } from 'lucide-react';

export function latestTargetCheck(target: MonitoringTarget) {
  return [...(target.recent_checks || [])].reverse().find(
    (c) => target.last_checked_at != null && Date.parse(c.checked_at) === Date.parse(target.last_checked_at)
  );
}

export function formatDowntimeDuration(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Desconocido';
  const diffMs = Math.max(0, Date.now() - Date.parse(dateStr));
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return '< 1 minuto';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minuto${diffMin === 1 ? '' : 's'}`;
  const diffHours = Math.floor(diffMin / 60);
  const remMin = diffMin % 60;
  if (diffHours < 24) return `${diffHours} h ${remMin} m`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} día${diffDays === 1 ? '' : 's'}`;
}

export function getDownSinceDuration(target: MonitoringTarget): string {
  if (target.down_since) {
    return formatDowntimeDuration(target.down_since);
  }
  if (!target.recent_checks || target.recent_checks.length === 0) {
    return formatDowntimeDuration(target.last_checked_at || target.updated_at);
  }
  const checks = [...target.recent_checks].sort(
    (a, b) => Date.parse(b.checked_at) - Date.parse(a.checked_at)
  );
  let earliestDown = checks[0];
  for (let i = 0; i < checks.length; i++) {
    if (checks[i].status === 'down' || checks[i].status === 'error') {
      earliestDown = checks[i];
    } else {
      break;
    }
  }
  return formatDowntimeDuration(earliestDown.checked_at);
}

export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'caído';
  const diffMs = Math.max(0, Date.now() - Date.parse(dateStr));
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'caído <1 min';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `caído ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `caído ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `caído ${diffDays} d`;
}

export function formatPausedSince(target: MonitoringTarget, verbose = false): string {
  const refDate = target.updated_at || target.last_checked_at || target.created_at;
  const prefix = verbose ? 'Pausado desde hace' : 'Pausado';
  if (!refDate || !Number.isFinite(Date.parse(refDate))) return 'Pausado';
  const diffMs = Math.max(0, Date.now() - Date.parse(refDate));
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${prefix} <1 min`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${prefix} ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${prefix} ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${prefix} ${diffDays} d`;
}

export function getDownSinceText(target: MonitoringTarget): string {
  if (target.down_since) {
    return formatRelativeTime(target.down_since);
  }
  if (!target.recent_checks || target.recent_checks.length === 0) {
    return formatRelativeTime(target.last_checked_at || target.updated_at);
  }
  const checks = [...target.recent_checks].sort(
    (a, b) => Date.parse(b.checked_at) - Date.parse(a.checked_at)
  );
  let earliestDown = checks[0];
  for (let i = 0; i < checks.length; i++) {
    if (checks[i].status === 'down' || checks[i].status === 'error') {
      earliestDown = checks[i];
    } else {
      break;
    }
  }
  return formatRelativeTime(earliestDown.checked_at);
}

export function formatShortDiagnostic(diagnostic: string, expectedStatus?: number): string {
  const match = diagnostic.match(/HTTP\s*(\d+)/i);
  if (match) {
    const code = match[1];
    const exp = expectedStatus || 200;
    return `${code} ≠ ${exp}`;
  }
  if (diagnostic.length > 20) {
    return diagnostic.slice(0, 18) + '…';
  }
  return diagnostic;
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
    const shortText = formatShortDiagnostic(message, target.expected_status);
    return (
      <span
        title={message}
        className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-rose-400 truncate max-w-[280px]"
      >
        <AlertTriangle size={11} className="shrink-0 text-rose-400" />
        <span>{shortText}</span>
      </span>
    );
  }

  return (
    <p
      title={message}
      className="text-xs mt-0.5 text-accent-red font-mono truncate max-w-[320px] flex items-center gap-1.5"
    >
      <AlertTriangle size={12} className="shrink-0 text-rose-400" />
      <span>{message}</span>
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
    const guardianPaused =
      target.enabled &&
      target.runner_type === "agent" &&
      target.agent_probe_enabled === false;

    if (guardianPaused) {
      return (
        <div data-testid="target-latency" className="inline-flex items-center whitespace-nowrap">
          <span
            className="font-mono text-slate-400 text-[11px] font-medium"
            title={`Pausado: guardián detenido (${target.agent_probe_name || "LAN"})`}
          >
            Pausado
          </span>
        </div>
      );
    }

    if (!target.enabled) {
      const pausedText = formatPausedSince(target, false);
      return (
        <div data-testid="target-latency" className="inline-flex items-center whitespace-nowrap">
          <span
            className="font-mono text-slate-400 text-[11px] font-medium"
            title={formatPausedSince(target, true)}
          >
            {pausedText}
          </span>
        </div>
      );
    }

    const guardianOffline =
      target.enabled &&
      target.runner_type === "agent" &&
      (target.agent_probe_online === false ||
        target.agent_probe_status === "offline");

    if (guardianOffline) {
      return (
        <div data-testid="target-latency" className="inline-flex items-center whitespace-nowrap">
          <span
            className="font-mono text-amber-400 text-[11px] font-medium"
            title={`Sin datos: guardián Senti9 (${target.agent_probe_name || "LAN"}) desconectado`}
          >
            Sin datos
          </span>
        </div>
      );
    }

    if (isDown && target.enabled) {
      const downSince = getDownSinceText(target);
      return (
        <div data-testid="target-latency" className="inline-flex items-center whitespace-nowrap">
          <span
            className="font-mono text-rose-400 text-xs font-semibold"
            title={`Servicio caído (${downSince}) • Última latencia registrada: ${lastKnownLat || 'N/A'}`}
          >
            Caído
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
