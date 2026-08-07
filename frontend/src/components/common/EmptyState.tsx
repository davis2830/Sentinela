import React from 'react';
import { Plus } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-bg-card border border-border-base rounded-xl">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-bg-main border border-border-base flex items-center justify-center mb-4 text-text-dim">
          <Icon size={32} />
        </div>
      )}
      <h3 className="text-lg font-semibold text-text-main mb-1">{title}</h3>
      {description && <p className="text-text-muted text-sm max-w-md mb-6">{description}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 bg-accent-green text-black font-semibold px-4 py-2 rounded-md text-sm hover:opacity-90 transition-opacity"
        >
          <Plus size={18} />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
