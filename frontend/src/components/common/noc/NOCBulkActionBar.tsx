import React from 'react';
import { CheckSquare, X } from 'lucide-react';

export interface NOCBulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  itemLabel?: string;
  actions: React.ReactNode;
}

export default function NOCBulkActionBar({
  selectedCount,
  onClearSelection,
  itemLabel = 'elementos',
  actions,
}: NOCBulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-4 z-20 bg-bg-dark/95 border border-accent-green/50 backdrop-blur-md rounded-2xl p-3 px-5 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-3">
        <CheckSquare size={18} className="text-accent-green shrink-0" />
        <span className="text-sm font-semibold text-text-main font-sans">
          {selectedCount} {itemLabel} seleccionado{selectedCount > 1 ? 's' : ''}
        </span>
        <button
          type="button"
          onClick={onClearSelection}
          className="text-xs text-text-dim hover:text-text-main hover:underline flex items-center gap-1 font-sans"
        >
          <X size={12} /> Deseleccionar
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
        {actions}
      </div>
    </div>
  );
}
