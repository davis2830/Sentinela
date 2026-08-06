import { ReactNode } from 'react';
import { ShieldCheck, Lock, HeartPulse, Network, Plug, ShieldAlert } from 'lucide-react';

const monitorItems = [
  { icon: Lock, label: 'SSL Monitoring' },
  { icon: HeartPulse, label: 'Uptime Monitoring' },
  { icon: Network, label: 'DNS Monitoring' },
  { icon: Plug, label: 'API Monitoring' },
  { icon: ShieldAlert, label: 'Security Headers' },
];

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        {/* Hero Panel */}
        <div className="hidden lg:block">
          <h1 className="text-5xl font-bold leading-tight mb-5">
            <span className="text-accent-green" style={{ textShadow: '0 0 15px rgba(52, 211, 153, 0.5)' }}>
              Sentinel:
            </span>{' '}
            Generando Confianza mediante{' '}
            <span style={{ background: 'linear-gradient(90deg, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Observabilidad
            </span>
          </h1>
          <p className="text-text-muted text-lg mb-10 max-w-xl">
            Vigilancia avanzada para SSL, Uptime, DNS y APIs con Smart Alerts integradas para tu infraestructura critica.
          </p>

          <div className="flex flex-col gap-3 w-64">
            {monitorItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-3 bg-bg-card border border-border-base px-5 py-3 rounded-lg cursor-pointer transition-colors hover:border-accent-green"
                >
                  <Icon className="text-accent-green" size={20} />
                  <span className="text-text-main font-semibold">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Panel */}
        <div className="relative bg-bg-card border border-border-base p-8 sm:p-12 rounded-xl">
          <div className="absolute -top-8 left-1/2 -translate-x-1/2">
            <ShieldCheck
              className="text-accent-green"
              size={64}
              style={{ filter: 'drop-shadow(0 0 20px rgba(52, 211, 153, 0.5))' }}
            />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}