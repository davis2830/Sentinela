import React from 'react';
import { Trash2, Loader2 } from 'lucide-react';

interface ConfirmDeleteProps {
  title?: string;
  itemName: string;
  isOpen: boolean;
  isDeleting?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDelete({
  title = 'Confirmar Eliminación',
  itemName,
  isOpen,
  isDeleting = false,
  onConfirm,
  onClose,
}: ConfirmDeleteProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border-base rounded-xl p-6 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-accent-red/10 border border-accent-red/20 flex items-center justify-center">
            <Trash2 className="text-accent-red" size={20} />
          </div>
          <h2 className="text-lg font-bold text-text-main">{title}</h2>
        </div>
        <p className="text-text-muted text-sm mb-6 leading-relaxed">
          ¿Seguro que deseas eliminar <strong className="text-text-main font-semibold">{itemName}</strong>? Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="flex-1 py-2.5 border border-border-base rounded-lg text-sm font-medium text-text-muted hover:bg-bg-card-hover hover:text-text-main transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-accent-red text-white font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              'Eliminar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
