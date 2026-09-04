import React from 'react';
import type { StatusPageSummaryItem } from '../../types/status_page';
import {
  X,
  Building,
  Layers,
  Users,
  Calendar,
  ExternalLink,
  Star,
  Trash2,
  Plus,
  Radio,
  Check,
  Globe,
  Lock,
} from 'lucide-react';

interface StatusPageDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  pages: StatusPageSummaryItem[];
  activePageId: string;
  onSelectPage: (pageId: string) => void;
  onOpenCreate: () => void;
  onSetDefault: (pageId: string) => Promise<void>;
  onDeletePage: (pageId: string) => Promise<void>;
}

export default function StatusPageDirectoryModal({
  isOpen,
  onClose,
  pages,
  activePageId,
  onSelectPage,
  onOpenCreate,
  onSetDefault,
  onDeletePage,
}: StatusPageDirectoryModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200 font-sans"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border-base rounded-3xl p-6 w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border-base/60 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
              <Building size={20} className="text-accent-green" />
              Directorio de Status Pages ({pages.length})
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Administra múltiples páginas de estado públicas o privadas para diferentes clientes y marcas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenCreate();
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-sm cursor-pointer"
            >
              <Plus size={14} />
              Nueva Status Page
            </button>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-main p-1.5 rounded-full hover:bg-bg-dark transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* List of Status Pages */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
          {pages.map((p) => {
            const isActive = p.id === activePageId;
            return (
              <div
                key={p.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isActive
                    ? 'bg-accent-green/5 border-accent-green/40 shadow-sm'
                    : 'bg-bg-dark/70 border-border-base hover:border-border-accent'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Left: Info */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-bg-card border border-border-base flex items-center justify-center shrink-0 overflow-hidden">
                      {p.logo_url ? (
                        <img
                          src={p.logo_url}
                          alt={p.company_name}
                          className="w-full h-full object-contain p-1"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Building size={18} className="text-accent-green" />
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-text-main">{p.company_name}</h3>
                        {p.is_default && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Star size={10} className="fill-amber-400" />
                            Principal
                          </span>
                        )}
                        {p.is_public ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Globe size={10} />
                            Pública
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/10 text-text-muted border border-border-base">
                            <Lock size={10} />
                            Privada
                          </span>
                        )}
                        {isActive && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent-green/20 text-accent-green border border-accent-green/40">
                            <Check size={10} />
                            Seleccionada
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <a
                          href={`/status/${p.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-text-dim hover:text-accent-green flex items-center gap-1 transition-colors"
                        >
                          <span>/status/{p.slug}</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>

                      {p.description && (
                        <p className="text-xs text-text-muted mt-1 line-clamp-1 max-w-xl">
                          {p.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Middle: Stats */}
                  <div className="flex items-center gap-3 shrink-0 py-1 md:py-0 border-y md:border-y-0 border-border-base/40">
                    <div className="text-center px-2.5">
                      <span className="text-[10px] text-text-dim block uppercase tracking-wider font-mono">
                        Componentes
                      </span>
                      <span className="text-xs font-bold font-mono text-text-main flex items-center justify-center gap-1">
                        <Layers size={11} className="text-accent-green" />
                        {p.published_components_count}
                      </span>
                    </div>

                    <div className="w-px h-6 bg-border-base" />

                    <div className="text-center px-2.5">
                      <span className="text-[10px] text-text-dim block uppercase tracking-wider font-mono">
                        Suscriptores
                      </span>
                      <span className="text-xs font-bold font-mono text-text-main flex items-center justify-center gap-1">
                        <Users size={11} className="text-sky-400" />
                        {p.subscribers_count}
                      </span>
                    </div>

                    <div className="w-px h-6 bg-border-base" />

                    <div className="text-center px-2.5">
                      <span className="text-[10px] text-text-dim block uppercase tracking-wider font-mono">
                        Mantenimientos
                      </span>
                      <span className="text-xs font-bold font-mono text-text-main flex items-center justify-center gap-1">
                        <Calendar size={11} className="text-amber-400" />
                        {p.active_maintenances_count}
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectPage(p.id);
                        onClose();
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-accent-green/20 text-accent-green border border-accent-green/40'
                          : 'bg-bg-dark hover:bg-bg-dark/80 text-text-main border border-border-base hover:border-accent-green/40'
                      }`}
                    >
                      {isActive ? 'Activa' : 'Gestionar'}
                    </button>

                    {!p.is_default && (
                      <button
                        type="button"
                        onClick={() => onSetDefault(p.id)}
                        title="Marcar como Principal"
                        className="p-1.5 text-text-dim hover:text-amber-400 rounded-lg hover:bg-bg-card transition-colors cursor-pointer"
                      >
                        <Star size={15} />
                      </button>
                    )}

                    {pages.length > 1 && !p.is_default && (
                      <button
                        type="button"
                        onClick={() => onDeletePage(p.id)}
                        title="Eliminar Status Page"
                        className="p-1.5 text-text-dim hover:text-accent-red rounded-lg hover:bg-bg-card transition-colors cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-border-base/60 flex items-center justify-between text-xs text-text-dim">
          <span>
            Total: <strong>{pages.length}</strong> Status Pages configuradas
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-bg-dark hover:bg-bg-dark/80 text-text-muted hover:text-text-main border border-border-base rounded-full text-xs font-semibold transition-colors cursor-pointer"
          >
            Cerrar Directorio
          </button>
        </div>
      </div>
    </div>
  );
}
