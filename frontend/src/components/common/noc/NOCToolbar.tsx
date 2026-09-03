import React from 'react';
import { Search, X, LayoutGrid, List as ListIcon } from 'lucide-react';

export interface NOCStatusPill {
  id: string;
  label: string;
  count?: number;
  variant?: 'all' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export interface NOCCategoryChip {
  id: string;
  label: string;
}

export interface NOCToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  // View Mode Switcher
  viewMode?: 'grid' | 'table';
  onViewModeChange?: (mode: 'grid' | 'table') => void;

  // Category chips (e.g. HTTP, TCP, DNS, GET, POST, etc.)
  categories?: NOCCategoryChip[];
  categoryLabel?: string;
  selectedCategory?: string;
  onCategoryChange?: (id: string) => void;

  // Status pills (e.g. Todos, Online, Lentos, Caídos)
  statusPills?: NOCStatusPill[];
  selectedStatus?: string;
  onStatusChange?: (id: string) => void;

  // Optional extra filters or controls
  extraFilters?: React.ReactNode;
  className?: string;
}

export default function NOCToolbar({
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Buscar por nombre, URL o dirección IP...',
  viewMode,
  onViewModeChange,
  categories,
  categoryLabel = 'Tipo:',
  selectedCategory,
  onCategoryChange,
  statusPills,
  selectedStatus,
  onStatusChange,
  extraFilters,
  className = '',
}: NOCToolbarProps) {
  const getPillClasses = (
    pillId: string,
    variant: string = 'neutral',
    isSelected: boolean
  ) => {
    if (!isSelected) {
      return 'bg-bg-dark/60 border-border-base/70 text-text-muted hover:text-text-main hover:border-border-base';
    }

    switch (variant) {
      case 'success':
        return 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-semibold shadow-sm';
      case 'warning':
        return 'bg-amber-500/20 border-amber-500 text-amber-400 font-semibold shadow-sm';
      case 'danger':
        return 'bg-rose-500/20 border-rose-500 text-rose-400 font-semibold shadow-sm';
      case 'info':
        return 'bg-sky-500/20 border-sky-500 text-sky-400 font-semibold shadow-sm';
      case 'all':
      default:
        return 'bg-accent-green/20 border-accent-green text-accent-green font-semibold shadow-sm';
    }
  };

  const hasBottomRow =
    (categories && categories.length > 0) ||
    (statusPills && statusPills.length > 0);

  return (
    <div
      className={`bg-bg-card/90 border border-border-base/70 rounded-2xl p-4 shadow-md space-y-3.5 ${className}`}
    >
      {/* Top row: Search input + View Switcher + Extra Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Omnibar */}
        <div className="relative flex-1">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim"
            size={16}
          />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-bg-dark/80 border border-border-base/80 rounded-full pl-10 pr-9 py-2 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green focus:ring-2 focus:ring-accent-green/20 transition-all font-sans"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-main p-0.5 rounded-full"
              title="Limpiar búsqueda"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Extra Filters slot (e.g. tag dropdown) */}
        {extraFilters}

        {/* View Mode Switcher */}
        {viewMode && onViewModeChange && (
          <div className="flex items-center gap-1 bg-bg-dark/80 p-1 rounded-full border border-border-base/80 shrink-0 self-end md:self-auto">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              className={`p-1.5 rounded-full transition-all ${
                viewMode === 'grid'
                  ? 'bg-accent-green text-black font-semibold shadow-sm'
                  : 'text-text-muted hover:text-text-main'
              }`}
              title="Vista de Cuadrícula (Cards)"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('table')}
              className={`p-1.5 rounded-full transition-all ${
                viewMode === 'table'
                  ? 'bg-accent-green text-black font-semibold shadow-sm'
                  : 'text-text-muted hover:text-text-main'
              }`}
              title="Vista de Tabla Compacta (NOC)"
            >
              <ListIcon size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Bottom row: Category Chips & Status Pills */}
      {hasBottomRow && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-border-base/40">
          {/* Categories */}
          {categories && categories.length > 0 && onCategoryChange && (
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-0.5">
              <span className="text-[11px] text-text-dim font-semibold mr-1 shrink-0 font-sans">
                {categoryLabel}
              </span>
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => onCategoryChange(cat.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all border shrink-0 ${
                      isSelected
                        ? 'bg-accent-green/20 border-accent-green text-accent-green font-semibold shadow-sm'
                        : 'bg-bg-dark/60 border-border-base/70 text-text-muted hover:text-text-main hover:border-border-base'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Status Pills */}
          {statusPills && statusPills.length > 0 && onStatusChange && (
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-0.5 ml-auto">
              {statusPills.map((pill) => {
                const isSelected = selectedStatus === pill.id;
                const pillClasses = getPillClasses(
                  pill.id,
                  pill.variant,
                  isSelected
                );
                return (
                  <button
                    type="button"
                    key={pill.id}
                    onClick={() => onStatusChange(pill.id)}
                    className={`px-3.5 py-1 rounded-full border transition-all font-medium shrink-0 ${pillClasses}`}
                  >
                    {pill.label}
                    {pill.count !== undefined && (
                      <span className="ml-1 text-[11px] opacity-80">
                        ({pill.count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
