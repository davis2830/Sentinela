import type { ReactNode } from 'react';

/** Shared login surface; authentication and permissions remain owned by each page. */
export default function AuthCard({title,subtitle,children}:{title:string;subtitle:string;children:ReactNode}) {
  return <section aria-label={title} className="relative w-full overflow-hidden rounded-3xl border border-border-base bg-bg-card p-7 font-sans shadow-2xl sm:p-9 xl:p-10">
    <div aria-hidden="true" className="absolute left-0 right-0 top-0 h-[2.5px] bg-gradient-to-r from-transparent via-accent-green to-transparent opacity-90" />
    <div className="mb-7 text-center sm:mb-8">
      <div className="mb-3.5 hidden rounded-2xl border border-border-base bg-bg-dark p-3.5 shadow-inner lg:inline-flex">
        <img src="/logo.webp" alt="Sentinel Logo" width={44} height={44} className="h-11 w-auto object-contain drop-shadow-[0_0_15px_rgba(16,185,129,0.35)]" />
      </div>
      <h2 className="font-sans text-2xl font-extrabold tracking-tight text-text-main sm:text-3xl">{title}</h2>
      <p className="mt-1.5 font-sans text-sm text-text-muted">{subtitle}</p>
    </div>
    {children}
  </section>;
}
