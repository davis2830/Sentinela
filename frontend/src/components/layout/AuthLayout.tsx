import React, { ReactNode } from 'react';
import { ShieldCheck, Zap, Lock, Globe, Bell, CheckCircle2 } from 'lucide-react';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-bg-dark text-text-main flex items-center justify-center p-4 sm:p-8 relative overflow-hidden selection:bg-accent-green selection:text-black">
      {/* Ambient background glowing orbs */}
      <div className="absolute top-1/4 left-1/6 w-96 h-96 bg-accent-green/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-1/6 w-96 h-96 bg-accent-blue/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Decorative Grid Overlay */}
      <div
        className="absolute inset-0 pointer-events-none -z-10 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.08) 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Hero & Telemetry Showcase (Visible on Large Screens) */}
        <div className="hidden lg:flex lg:col-span-7 flex-col justify-between py-4 pr-6 space-y-8">
          {/* Brand Header */}
          <div>
            <div className="flex items-center gap-3.5 mb-5">
              <img
                src="/logo.png"
                alt="Sentinela Logo"
                className="h-11 w-auto object-contain drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              />
              <div>
                <span className="text-2xl font-bold tracking-tight text-text-main">
                  Sentinela
                </span>
                <span className="block text-[11px] font-mono text-text-dim tracking-wider uppercase">
                  NOC & Observabilidad Operativa
                </span>
              </div>
            </div>

            {/* Live Status Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-green/10 border border-accent-green/30 text-accent-green text-xs font-mono font-semibold mb-6 shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green" />
              </span>
              <span>Plataforma Operativa &bull; 99.98% SLA Global</span>
            </div>

            <h1 className="text-4xl xl:text-5xl font-extrabold leading-tight tracking-tight text-text-main mb-4">
              Control central para tu{' '}
              <span className="bg-gradient-to-r from-accent-green via-accent-green-glow to-accent-blue bg-clip-text text-transparent">
                infraestructura crítica
              </span>
            </h1>

            <p className="text-text-muted text-base xl:text-lg max-w-lg leading-relaxed">
              Vigilancia continua de alta resolución, detección instantánea de interrupciones, análisis de certificados SSL y telemetría de red 24/7.
            </p>
          </div>

          {/* Live Telemetry Showcase Card */}
          <div className="bg-bg-card/70 border border-border-base/80 backdrop-blur-md rounded-2xl p-5 shadow-2xl space-y-3">
            <div className="text-[11px] font-mono font-bold text-text-dim tracking-wider uppercase flex items-center justify-between">
              <span>Capacidades del Centro de Operaciones</span>
              <span className="text-accent-green flex items-center gap-1">
                <CheckCircle2 size={13} />
                <span>En Línea</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-bg-dark/70 border border-border-base/50 rounded-xl hover:border-accent-green/30 transition-all">
                <div className="flex items-center gap-2 text-xs font-semibold text-text-main">
                  <Zap size={15} className="text-accent-green shrink-0" />
                  <span>Uptime & Latencia</span>
                </div>
                <div className="text-[11px] font-mono text-text-muted mt-1">
                  Muestreo cada 20s &bull; SLA 99.98%
                </div>
              </div>

              <div className="p-3 bg-bg-dark/70 border border-border-base/50 rounded-xl hover:border-accent-green/30 transition-all">
                <div className="flex items-center gap-2 text-xs font-semibold text-text-main">
                  <Lock size={15} className="text-accent-green shrink-0" />
                  <span>Monitoreo SSL</span>
                </div>
                <div className="text-[11px] font-mono text-text-muted mt-1">
                  Alertas tempranas de expiración
                </div>
              </div>

              <div className="p-3 bg-bg-dark/70 border border-border-base/50 rounded-xl hover:border-accent-blue/30 transition-all">
                <div className="flex items-center gap-2 text-xs font-semibold text-text-main">
                  <Globe size={15} className="text-accent-blue shrink-0" />
                  <span>Registros DNS</span>
                </div>
                <div className="text-[11px] font-mono text-text-muted mt-1">
                  Detección de mutaciones de zona
                </div>
              </div>

              <div className="p-3 bg-bg-dark/70 border border-border-base/50 rounded-xl hover:border-accent-yellow/30 transition-all">
                <div className="flex items-center gap-2 text-xs font-semibold text-text-main">
                  <Bell size={15} className="text-accent-yellow shrink-0" />
                  <span>Smart Alerts</span>
                </div>
                <div className="text-[11px] font-mono text-text-muted mt-1">
                  Escalado a incidentes en tiempo real
                </div>
              </div>
            </div>
          </div>

          {/* Trust Footprint */}
          <div className="flex items-center gap-2 text-xs font-mono text-text-dim">
            <ShieldCheck size={16} className="text-accent-green shrink-0" />
            <span>Conexión segura cifrada con TLS 1.3 &bull; Monitoreo de alta disponibilidad</span>
          </div>
        </div>

        {/* Right Form Card Panel */}
        <div className="w-full lg:col-span-5 max-w-md mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}