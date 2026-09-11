import { Loader2 } from 'lucide-react';

export default function ModuleLoadingSkeleton() {
  return (
    <div className="h-[65vh] w-full flex flex-col items-center justify-center gap-3 animate-in fade-in duration-200">
      <div className="relative flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border border-border-base bg-bg-card/60 backdrop-blur-sm flex items-center justify-center shadow-lg">
          <Loader2 className="w-6 h-6 text-accent-green animate-spin" />
        </div>
        <div className="absolute -inset-1 rounded-full bg-accent-green/10 blur-sm pointer-events-none" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs font-semibold text-text-muted tracking-wide font-sans">
          Cargando telemetría...
        </span>
        <span className="text-[10px] font-mono text-text-dim">
          Sentinel NOC
        </span>
      </div>
    </div>
  );
}
