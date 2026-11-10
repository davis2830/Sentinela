import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import SentinelBrand from './SentinelBrand';

/** Shared visual shell; callers own their session, actions and search scope. */
export default function NavbarFrame({ badge, home, center, actions, leading }: {
  badge: string; home?: string; center?: ReactNode; actions: ReactNode; leading?: ReactNode;
}) {
  return <nav aria-label="Barra principal de Sentinel" className="relative z-30 flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border-base bg-bg-dark/95 px-4 py-1.5 backdrop-blur-md lg:px-6">
    <div className="flex shrink-0 items-center gap-4">
      {leading}
      {home ? <Link to={home} className="no-underline"><SentinelBrand /></Link> : <SentinelBrand />}
      <span className="hidden rounded-full border border-accent-green/30 bg-accent-green/10 px-2.5 py-0.5 text-xs font-semibold text-accent-green xl:inline">{badge}</span>
    </div>
    {center}
    <div className="flex min-w-0 items-center gap-3 sm:gap-4">{actions}</div>
  </nav>;
}
