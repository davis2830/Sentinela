import React, { ReactNode } from 'react';
import { ShieldCheck, Zap, Lock, Globe, Bell, CheckCircle2 } from 'lucide-react';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-[100dvh] w-full bg-bg-dark text-text-main flex flex-col justify-center items-center px-4 sm:px-8 lg:px-12 xl:px-16 py-8 lg:py-12 relative overflow-x-hidden overflow-y-auto selection:bg-accent-green selection:text-black font-sans">
      {/* Ambient background glowing orbs */}
      <div className="absolute top-1/4 left-1/12 w-96 lg:w-[32rem] h-96 lg:h-[32rem] bg-accent-green/6 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-1/12 w-96 lg:w-[32rem] h-96 lg:h-[32rem] bg-accent-blue/6 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Decorative Grid Overlay */}
      <div
        className="absolute inset-0 pointer-events-none -z-10 opacity-25"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1.5px 1.5px, rgba(255, 255, 255, 0.1) 1px, transparent 0)',
          backgroundSize: '36px 36px',
        }}
      />

      {/* Mobile Top Brand Header (Visible on < lg) */}
      <div className="lg:hidden flex flex-col items-center text-center mb-7 w-full max-w-sm mx-auto">
        <div className="flex items-center gap-3 mb-3">
          <img
            src="/logo.png"
            alt="Sentinela Logo"
            className="h-11 w-auto object-contain drop-shadow-[0_0_15px_rgba(16,185,129,0.35)]"
          />
          <span className="text-3xl font-extrabold tracking-tight text-text-main font-sans">
            Sentinela
          </span>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-accent-green/10 border border-accent-green/30 text-accent-green text-xs font-semibold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green" />
          </span>
          <span>Plataforma Operativa &bull; <span className="font-mono">99.98% SLA</span></span>
        </div>
      </div>

      {/* Main Expansive Container */}
      <div className="w-full max-w-[1400px] grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 xl:gap-16 items-center my-auto">
        {/* Left Hero & Telemetry Showcase (Visible on Large Screens) */}
        <div className="hidden lg:flex lg:col-span-7 flex-col justify-between py-4 pr-4 xl:pr-8 space-y-8 xl:space-y-10">
          {/* Brand Header */}
          <div>
            <div className="flex items-center gap-4 mb-6">
              <img
                src="/logo.png"
                alt="Sentinela Logo"
                className="h-12 xl:h-14 w-auto object-contain drop-shadow-[0_0_18px_rgba(16,185,129,0.35)]"
              />
              <div>
                <span className="text-3xl xl:text-4xl font-extrabold tracking-tight text-text-main font-sans block">
                  Sentinela
                </span>
                <span className="text-xs xl:text-sm font-medium text-text-dim tracking-wider uppercase font-sans">
                  Centro de Operaciones &bull; NOC y Observabilidad
                </span>
              </div>
            </div>

            {/* Live Status Pill */}
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-accent-green/10 border border-accent-green/30 text-accent-green text-xs font-semibold mb-6 shadow-xs">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-green" />
              </span>
              <span>Plataforma Operativa &bull; SLA Global <span className="font-mono font-bold">99.98%</span></span>
            </div>

            <h1 className="text-4xl xl:text-6xl font-extrabold leading-[1.12] tracking-tight text-text-main mb-5">
              Control central para tu{' '}
              <span className="bg-gradient-to-r from-accent-green via-accent-green-glow to-accent-blue bg-clip-text text-transparent">
                infraestructura crítica
              </span>
            </h1>

            <p className="text-text-muted text-base xl:text-xl max-w-xl leading-relaxed font-sans">
              Vigilancia continua de alta resolución, detección instantánea de interrupciones, análisis de certificados SSL y telemetría de red 24/7.
            </p>
          </div>

          {/* Live Telemetry Showcase Card */}
          <div className="bg-bg-card/80 border border-border-base backdrop-blur-md rounded-3xl p-6 xl:p-7 shadow-2xl space-y-4">
            <div className="text-xs xl:text-sm font-bold text-text-dim tracking-wider uppercase flex items-center justify-between font-sans">
              <span>Capacidades del Centro de Operaciones</span>
              <span className="text-accent-green flex items-center gap-1.5 font-semibold">
                <CheckCircle2 size={16} />
                <span>En Línea</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 xl:gap-5 pt-1">
              <div className="p-4 bg-bg-dark/70 border border-border-base/70 rounded-2xl hover:border-accent-green/40 transition-all group">
                <div className="flex items-center gap-2.5 text-sm xl:text-base font-bold text-text-main font-sans">
                  <Zap size={18} className="text-accent-green shrink-0 group-hover:scale-110 transition-transform" />
                  <span>Uptime & Latencia</span>
                </div>
                <div className="text-xs xl:text-sm text-text-muted mt-1.5 font-sans">
                  Muestreo continuo cada <span className="font-mono text-accent-green">20s</span> &bull; SLA <span className="font-mono text-accent-green">99.98%</span>
                </div>
              </div>

              <div className="p-4 bg-bg-dark/70 border border-border-base/70 rounded-2xl hover:border-accent-green/40 transition-all group">
                <div className="flex items-center gap-2.5 text-sm xl:text-base font-bold text-text-main font-sans">
                  <Lock size={18} className="text-accent-green shrink-0 group-hover:scale-110 transition-transform" />
                  <span>Monitoreo SSL</span>
                </div>
                <div className="text-xs xl:text-sm text-text-muted mt-1.5 font-sans">
                  Detección proactiva de expiración y dominios SANs
                </div>
              </div>

              <div className="p-4 bg-bg-dark/70 border border-border-base/70 rounded-2xl hover:border-accent-blue/40 transition-all group">
                <div className="flex items-center gap-2.5 text-sm xl:text-base font-bold text-text-main font-sans">
                  <Globe size={18} className="text-accent-blue shrink-0 group-hover:scale-110 transition-transform" />
                  <span>Registros DNS</span>
                </div>
                <div className="text-xs xl:text-sm text-text-muted mt-1.5 font-sans">
                  Resolución de zonas y detección de mutaciones
                </div>
              </div>

              <div className="p-4 bg-bg-dark/70 border border-border-base/70 rounded-2xl hover:border-accent-yellow/40 transition-all group">
                <div className="flex items-center gap-2.5 text-sm xl:text-base font-bold text-text-main font-sans">
                  <Bell size={18} className="text-accent-yellow shrink-0 group-hover:scale-110 transition-transform" />
                  <span>Smart Alerts</span>
                </div>
                <div className="text-xs xl:text-sm text-text-muted mt-1.5 font-sans">
                  Escalado automático a incidentes en tiempo real
                </div>
              </div>
            </div>
          </div>

          {/* Trust Footprint */}
          <div className="flex items-center gap-2.5 text-xs xl:text-sm text-text-dim font-sans">
            <ShieldCheck size={18} className="text-accent-green shrink-0" />
            <span>Conexión cifrada de extremo a extremo con <span className="font-mono">TLS 1.3</span> &bull; Monitoreo de alta disponibilidad</span>
          </div>
        </div>

        {/* Right Form Card Panel */}
        <div className="w-full lg:col-span-5 max-w-[480px] xl:max-w-[500px] mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}