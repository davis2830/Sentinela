import React from 'react';
import AutomaticRefreshControl from '../AutomaticRefreshControl';
import ReloadDataButton from '../ReloadDataButton';


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
    ready?: boolean;
    blockedReason?: string;
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
        {autoRefresh && <AutomaticRefreshControl {...autoRefresh} />}

        {queryKeys && <ReloadDataButton queryKeys={queryKeys} scanIntervalSeconds={autoRefresh?.ready === false ? undefined : autoRefresh?.intervalSeconds} />}
        {actions}
      </div>
    </div>
  );
}
