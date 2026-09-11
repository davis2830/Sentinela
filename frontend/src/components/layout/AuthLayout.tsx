import React, { ReactNode } from 'react';
import { ShieldCheck, Zap, Shield, Radar } from 'lucide-react';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="h-full w-full bg-bg-dark text-text-main flex flex-col relative overflow-x-hidden overflow-y-auto selection:bg-accent-green selection:text-black font-sans">

      {/* ── Decorative Diagonal Bars (top-left corner) ── */}
      <div className="absolute top-0 left-0 pointer-events-none z-10 hidden lg:block">
        <div className="relative w-24 h-64">
          <div
            className="absolute w-3 h-40 bg-accent-green rounded-sm opacity-80"
            style={{ top: '-20px', left: '12px', transform: 'skewY(-45deg)' }}
          />
          <div
            className="absolute w-2.5 h-32 bg-accent-green rounded-sm opacity-50"
            style={{ top: '-10px', left: '28px', transform: 'skewY(-45deg)' }}
          />
          <div
            className="absolute w-2 h-24 bg-accent-green rounded-sm opacity-30"
            style={{ top: '0px', left: '42px', transform: 'skewY(-45deg)' }}
          />
          <div
            className="absolute w-1.5 h-16 bg-accent-green rounded-sm opacity-15"
            style={{ top: '10px', left: '54px', transform: 'skewY(-45deg)' }}
          />
        </div>
      </div>

      {/* ── Mobile Top Brand Header (Visible on < lg) ── */}
      <div className="lg:hidden flex flex-col items-center text-center pt-8 pb-5 w-full max-w-sm mx-auto px-4">
        <div className="flex items-center gap-3 mb-3">
          <img
            src="/logo.webp"
            alt="Sentinel Logo"
            width={44}
            height={44}
            className="h-11 w-auto object-contain drop-shadow-[0_0_15px_rgba(16,185,129,0.35)]"
          />
          <span className="text-3xl font-extrabold tracking-tight text-text-main font-sans">
            Sentinel
          </span>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-accent-green/10 border border-accent-green/30 text-accent-green text-xs font-semibold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green" />
          </span>
          <span>Plataforma Operativa</span>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 lg:px-12 xl:px-16 py-6 lg:py-0">
        <div className="w-full max-w-[1400px] grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-14 items-center">

          {/* ═══ Left Hero Panel (Visible on Large Screens) ═══ */}
          <div className="hidden lg:flex lg:col-span-7 flex-col justify-center py-4 pr-4 xl:pr-8 relative">

            {/* Brand Header */}
            <div className="flex items-center gap-4 mb-8">
              <img
                src="/logo.webp"
                alt="Sentinel Logo"
                width={56}
                height={56}
                className="h-12 xl:h-14 w-auto object-contain drop-shadow-[0_0_18px_rgba(16,185,129,0.35)]"
              />
              <div>
                <span className="text-3xl xl:text-4xl font-extrabold tracking-tight text-text-main font-sans block">
                  Sentinel
                </span>
                <span className="text-[11px] xl:text-xs font-semibold text-text-dim tracking-[0.2em] uppercase font-sans">
                  Observabilidad &bull; Monitoreo &bull; Seguridad
                </span>
              </div>
            </div>

            {/* Hero Title */}
            <h1 className="text-4xl xl:text-[3.5rem] 2xl:text-6xl font-extrabold leading-[1.1] tracking-tight text-text-main mb-5">
              Tu infraestructura.
              <br />
              <span className="text-accent-green">Bajo vigilancia.</span>
            </h1>

            {/* Subtitle */}
            <p className="text-text-muted text-sm xl:text-base max-w-md leading-relaxed font-sans mb-8">
              Observabilidad centralizada para detectar, diagnosticar y responder antes de que un incidente afecte tus servicios.
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap items-center gap-4 xl:gap-6 mb-8">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-accent-green/10 border border-accent-green/30 flex items-center justify-center">
                  <Radar size={17} className="text-accent-green" />
                </div>
                <div>
                  <div className="text-sm font-bold text-text-main font-sans leading-tight">Telemetría</div>
                  <div className="text-[11px] text-text-dim font-sans">en tiempo real</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-accent-green/10 border border-accent-green/30 flex items-center justify-center">
                  <Zap size={17} className="text-accent-green" />
                </div>
                <div>
                  <div className="text-sm font-bold text-text-main font-sans leading-tight">Detección</div>
                  <div className="text-[11px] text-text-dim font-sans">de incidentes</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-accent-green/10 border border-accent-green/30 flex items-center justify-center">
                  <Shield size={17} className="text-accent-green" />
                </div>
                <div>
                  <div className="text-sm font-bold text-text-main font-sans leading-tight">Protección</div>
                  <div className="text-[11px] text-text-dim font-sans">de servicios</div>
                </div>
              </div>
            </div>

            {/* Globe Visualization with Floating Badges */}
            <div className="relative w-full max-w-2xl mt-2">
              <picture>
                <source srcSet="/globe.webp" type="image/webp" />
                <img
                  src="/globe.jpg"
                  alt="Global monitoring network"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-auto object-contain opacity-90 select-none pointer-events-none"
                  draggable={false}
                />
              </picture>

              {/* Floating Status Badge: SERVIDORES */}
              <div className="absolute top-[30%] left-[18%] flex items-center gap-2 bg-bg-card/90 backdrop-blur-sm border border-border-base/60 rounded-xl px-3.5 py-2 shadow-lg animate-in fade-in">
                <div>
                  <div className="text-[10px] font-bold text-text-muted tracking-wider uppercase font-sans">Servidores</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green" />
                    </span>
                    <span className="text-[10px] font-bold text-accent-green font-sans">ONLINE</span>
                  </div>
                </div>
              </div>

              {/* Floating Status Badge: APIs */}
              <div className="absolute top-[15%] right-[22%] flex items-center gap-2 bg-bg-card/90 backdrop-blur-sm border border-border-base/60 rounded-xl px-3.5 py-2 shadow-lg animate-in fade-in">
                <div>
                  <div className="text-[10px] font-bold text-text-muted tracking-wider uppercase font-sans">APIs</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green" />
                    </span>
                    <span className="text-[10px] font-bold text-accent-green font-sans">ONLINE</span>
                  </div>
                </div>
              </div>

              {/* Floating Status Badge: BASES DE DATOS */}
              <div className="absolute bottom-[18%] right-[12%] flex items-center gap-2 bg-bg-card/90 backdrop-blur-sm border border-border-base/60 rounded-xl px-3.5 py-2 shadow-lg animate-in fade-in">
                <div>
                  <div className="text-[10px] font-bold text-text-muted tracking-wider uppercase font-sans">Bases de datos</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green" />
                    </span>
                    <span className="text-[10px] font-bold text-accent-green font-sans">ONLINE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ Right Form Card Panel ═══ */}
          <div className="w-full lg:col-span-5 max-w-[480px] xl:max-w-[500px] mx-auto">
            {children}
          </div>
        </div>
      </div>

      {/* ── Footer Bar ── */}
      <div className="w-full px-6 sm:px-8 lg:px-12 xl:px-16 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-xs text-text-dim font-sans">
          <ShieldCheck size={16} className="text-accent-green shrink-0" />
          <span>
            <span className="font-semibold text-text-muted">Sentinel</span>
            {' '}&bull; Observabilidad &bull; Monitoreo &bull; Seguridad
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-dim font-sans">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green" />
          </span>
          <span>Plataforma operativa</span>
        </div>
      </div>
    </div>
  );
}