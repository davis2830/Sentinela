import React from 'react';

export interface NOCKpiDistributionItem {
  label: string;
  count: number | string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export interface NOCKpiCardProps {
  title: string;
  icon?: React.ReactNode;
  badge?: {
    text: string;
    variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  };
  value?: string | number;
  valueSuffix?: string;
  valueColor?: string;
  subtitle?: string;
  progress?: {
    value: number; // percentage 0 - 100
    color?: string;
  };
  distribution?: NOCKpiDistributionItem[];
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export default function NOCKpiCard({
  title,
  icon,
  badge,
  value,
  valueSuffix,
  valueColor = 'text-text-main',
  subtitle,
  progress,
  distribution,
  footer,
  children,
  className = '',
}: NOCKpiCardProps) {
  const getBadgeClasses = (variant: string = 'neutral') => {
    switch (variant) {
      case 'success':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'warning':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'danger':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'info':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  const getDistributionClasses = (variant: string = 'neutral') => {
    switch (variant) {
      case 'success':
        return {
          box: 'bg-emerald-500/10 border-emerald-500/20',
          num: 'text-emerald-400',
          lbl: 'text-emerald-400/80',
        };
      case 'warning':
        return {
          box: 'bg-amber-500/10 border-amber-500/20',
          num: 'text-amber-400',
          lbl: 'text-amber-400/80',
        };
      case 'danger':
        return {
          box: 'bg-rose-500/10 border-rose-500/20',
          num: 'text-rose-400',
          lbl: 'text-rose-400/80',
        };
      case 'info':
        return {
          box: 'bg-sky-500/10 border-sky-500/20',
          num: 'text-sky-400',
          lbl: 'text-sky-400/80',
        };
      default:
        return {
          box: 'bg-bg-dark border-border-base',
          num: 'text-text-main',
          lbl: 'text-text-dim',
        };
    }
  };

  return (
    <div
      className={`bg-bg-card/95 border border-border-base/70 rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[148px] hover:border-border-base transition-colors ${className}`}
    >
      {/* Top row: Title + Icon and optional Badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-text-muted flex items-center gap-1.5 truncate">
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="truncate">{title}</span>
        </span>
        {badge && (
          <span
            className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border shrink-0 ${getBadgeClasses(
              badge.variant
            )}`}
          >
            {badge.text}
          </span>
        )}
      </div>

      {/* Main Content */}
      {children ? (
        <div className="my-2">{children}</div>
      ) : (
        <>
          {value !== undefined && (
            <div className="my-2 flex items-baseline gap-2">
              <span
                className={`text-3xl font-extrabold font-mono tracking-tight ${valueColor}`}
              >
                {value}
              </span>
              {valueSuffix && (
                <span className="text-xs text-text-dim font-medium font-sans">
                  {valueSuffix}
                </span>
              )}
            </div>
          )}

          {/* Optional Progress / Gauge Bar */}
          {progress && (
            <div className="w-full bg-bg-dark h-2 rounded-full overflow-hidden mt-1 mb-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  progress.color ||
                  (progress.value >= 99
                    ? 'bg-emerald-400'
                    : progress.value >= 95
                    ? 'bg-amber-400'
                    : 'bg-rose-500')
                }`}
                style={{ width: `${Math.min(Math.max(progress.value, 0), 100)}%` }}
              />
            </div>
          )}

          {/* Optional Sub-grid Distribution (Online / Lento / Caído) */}
          {distribution && distribution.length > 0 && (
            <div
              className={`grid gap-2 text-center pt-1 mt-1 grid-cols-${distribution.length}`}
              style={{
                gridTemplateColumns: `repeat(${distribution.length}, minmax(0, 1fr))`,
              }}
            >
              {distribution.map((item, idx) => {
                const styles = getDistributionClasses(item.variant);
                return (
                  <div
                    key={idx}
                    className={`${styles.box} border rounded-xl py-1.5 px-1`}
                  >
                    <div className={`text-base font-bold ${styles.num}`}>
                      {item.count}
                    </div>
                    <div className={`text-[10px] font-medium ${styles.lbl} truncate`}>
                      {item.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {subtitle && (
            <p className="text-[11px] text-text-muted truncate mt-0.5 font-sans">
              {subtitle}
            </p>
          )}
        </>
      )}

      {/* Footer slot */}
      {footer && (
        <div className="text-[11px] text-text-muted pt-2 mt-2 border-t border-border-base/40">
          {footer}
        </div>
      )}
    </div>
  );
}
