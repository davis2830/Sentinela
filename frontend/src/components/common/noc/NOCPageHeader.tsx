import React from 'react';
import { Radio, Pause } from 'lucide-react';

export interface NOCPageHeaderProps {
  title: string;
  badgeText?: string;
  description?: string;
  icon?: React.ReactNode;
  autoRefresh?: {
    enabled: boolean;
    countdown: number;
    onToggle: () => void;
  };
  actions?: React.ReactNode;
}

export default function NOCPageHeader({
  title,
  badgeText,
  description,
  icon,
  autoRefresh,
  actions,
}: NOCPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {icon && <div className="text-accent-green">{icon}</div>}
          <h1 className="text-2xl font-extrabold tracking-tight text-text-main font-sans">
            {title}
          </h1>
          {badgeText && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-green/10 text-accent-green border border-accent-green/30">
              {badgeText}
            </span>
          )}
        </div>
        {description && (
          <p className="text-text-muted text-sm mt-1 font-sans">
            {description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
        {autoRefresh && (
          <button
            type="button"
            onClick={autoRefresh.onToggle}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-medium transition-colors ${
              autoRefresh.enabled
                ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                : 'bg-bg-dark/80 border-border-base/80 text-text-dim'
            }`}
            title={autoRefresh.enabled ? 'Pausar auto-refresco' : 'Activar auto-refresco'}
          >
            {autoRefresh.enabled ? (
              <Radio size={13} className="animate-pulse text-accent-green" />
            ) : (
              <Pause size={13} />
            )}
            <span>
              {autoRefresh.enabled ? `En vivo: ${autoRefresh.countdown}s` : 'Pausado'}
            </span>
          </button>
        )}

        {actions}
      </div>
    </div>
  );
}
