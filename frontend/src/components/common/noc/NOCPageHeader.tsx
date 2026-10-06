import React from 'react';
import { Radio, Pause } from 'lucide-react';
import ReloadDataButton from '../ReloadDataButton';
import { formatRefreshCountdown } from '../../../hooks/useAutoRefresh';

export interface NOCPageHeaderProps {
  title: string;
  badgeText?: string;
  description?: string;
  icon?: React.ReactNode;
  autoRefresh?: {
    enabled: boolean;
    countdown: number;
    onToggle: () => void;
    intervalSeconds?: number;
    resetCountdown?: () => void;
    ready?: boolean;
  };
  actions?: React.ReactNode;
  queryKeys?: string[];
}

export default function NOCPageHeader({
  title,
  badgeText,
  description,
  icon,
  autoRefresh,
  actions,
  queryKeys,
}: NOCPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {icon && <div className="text-accent-green">{icon}</div>}
          <h1 className="text-xl font-semibold tracking-tight text-text-main font-sans">
            {title}
          </h1>
          {badgeText && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-green/10 text-accent-green border border-accent-green/30">
              {badgeText}
            </span>
          )}
        </div>
        {description && (
          <p className="text-text-muted text-xs mt-1 font-sans">
            {description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
        {autoRefresh && (
          <button
            type="button"
            onClick={autoRefresh.onToggle}
            aria-label={autoRefresh.enabled ? 'Pausar auto-refresco' : 'Activar auto-refresco'}
            disabled={autoRefresh.ready === false}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-medium transition-colors ${
              autoRefresh.enabled
                ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                : 'bg-bg-dark/80 border-border-base/80 text-text-dim'
            }`}
            title="Recarga automática de datos guardados, no ejecuta sondeos. La frecuencia sigue el plan."
          >
            {autoRefresh.enabled ? (
              <Radio size={13} className="animate-pulse text-accent-green" />
            ) : (
              <Pause size={13} />
            )}
            <span>
              {autoRefresh.ready === false ? 'Frecuencia no disponible' : autoRefresh.enabled ? `En vivo: ${formatRefreshCountdown(autoRefresh.countdown)}` : 'Pausado'}
            </span>
          </button>
        )}

        {queryKeys && <ReloadDataButton queryKeys={queryKeys} scanIntervalSeconds={autoRefresh?.ready === false ? undefined : autoRefresh?.intervalSeconds} onReload={autoRefresh?.resetCountdown} />}
        {actions}
      </div>
    </div>
  );
}
