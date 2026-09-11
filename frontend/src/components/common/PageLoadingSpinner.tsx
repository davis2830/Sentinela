import { Loader2 } from 'lucide-react';

export default function PageLoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full animate-in fade-in duration-200">
      <div className="relative flex items-center justify-center">
        {/* Glow halo */}
        <div className="absolute w-12 h-12 rounded-full bg-accent-green/10 blur-xl animate-pulse" />
        {/* Spinner */}
        <Loader2 className="w-8 h-8 text-accent-green animate-spin" />
      </div>
      <div className="mt-4 flex flex-col items-center gap-1">
        <span className="text-xs font-mono font-medium text-text-muted tracking-wider uppercase">
          Cargando vista...
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green/60 animate-ping" />
          <span className="text-[11px] font-mono text-text-dim">Sentinel NOC Telemetry</span>
        </div>
      </div>
    </div>
  );
}
