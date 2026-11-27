import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Download,
  LayoutGrid,
  List,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { TableDensity } from "./tableTokens";

export type ToolbarChipTone =
  | "danger"
  | "warning"
  | "info"
  | "success"
  | "neutral";

export interface ToolbarStatusChip {
  key: string;
  label: string;
  count: number;
  tone: ToolbarChipTone;
  title?: string;
  pulse?: boolean;
  /** Hide chip completely when count is 0 (default false: renders muted gray chip) */
  hideWhenZero?: boolean;
}

export interface ConnectivityModuleToolbarProps {
  testId?: string;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchAriaLabel?: string;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  statusChips: ToolbarStatusChip[];
  /** Optional right-side slot inside the left group (e.g. "Próximo vencimiento" shortcut) */
  leftExtra?: ReactNode;
  /** Popover accessibility label & button tooltip */
  filtersDialogLabel?: string;
  filtersButtonTitle?: string;
  activeFiltersCount: number;
  onResetFilters: () => void;
  /** Module-specific filter controls rendered inside the Filters popover */
  filterContent?: ReactNode;
  /** Built-in Density toggle inside the Filters popover */
  density: TableDensity;
  onDensityChange: (next: TableDensity) => void;
  /** Optional Export CSV button at bottom of Filters popover */
  onExportCSV?: () => void;
  canExport?: boolean;
  /** View switcher (Cards / Table) */
  viewMode: "grid" | "table";
  onViewModeChange: (next: "grid" | "table") => void;
  /** Optional extra controls rendered next to Filtros / View Switcher */
  rightExtra?: ReactNode;
}

const CHIP_ACTIVE_CLASSES: Record<ToolbarChipTone, string> = {
  danger: "bg-rose-500 text-white ring-2 ring-rose-500/40",
  warning: "bg-amber-500 text-black ring-2 ring-amber-500/40",
  info: "bg-sky-500 text-black ring-2 ring-sky-500/40",
  success: "bg-emerald-500 text-black ring-2 ring-emerald-500/40",
  neutral: "bg-slate-400 text-black ring-2 ring-slate-400/40",
};

const CHIP_NONZERO_CLASSES: Record<ToolbarChipTone, string> = {
  danger:
    "bg-rose-500/15 border border-rose-500/40 text-rose-400 hover:bg-rose-500/25",
  warning:
    "bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25",
  info: "bg-sky-500/15 border border-sky-500/35 text-sky-300 hover:bg-sky-500/25",
  success:
    "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20",
  neutral:
    "bg-bg-dark border border-border-base text-text-muted hover:text-text-main",
};

const CHIP_DOT_ACTIVE: Record<ToolbarChipTone, string> = {
  danger: "bg-white",
  warning: "bg-black",
  info: "bg-black",
  success: "bg-black",
  neutral: "bg-black",
};

const CHIP_DOT_NONZERO: Record<ToolbarChipTone, string> = {
  danger: "bg-rose-500",
  warning: "bg-amber-400",
  info: "bg-sky-400",
  success: "bg-emerald-400",
  neutral: "bg-slate-500",
};

/**
 * Shared single-row module toolbar shell for Sentinel connectivity modules.
 * Standardizes search, clickable status chips, Filters popover (with Density + Export CSV),
 * and Cards/Table view switcher while allowing module-specific filter slots.
 */
export default function ConnectivityModuleToolbar({
  testId,
  search,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  statusFilter,
  onStatusFilterChange,
  statusChips,
  leftExtra,
  filtersDialogLabel = "Filtros",
  filtersButtonTitle = "Filtros y preferencias",
  activeFiltersCount,
  onResetFilters,
  filterContent,
  density,
  onDensityChange,
  onExportCSV,
  canExport = true,
  viewMode,
  onViewModeChange,
  rightExtra,
}: ConnectivityModuleToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!filtersOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setFiltersOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [filtersOpen]);

  const toggleChip = (key: string) => {
    onStatusFilterChange(statusFilter === key ? "all" : key);
  };

  return (
    <div
      data-testid={testId}
      className="w-full max-w-[1400px] mx-auto bg-bg-card border border-border-base rounded-2xl px-3 py-2 shadow-lg text-xs select-none"
    >
      <div className="flex items-center justify-between gap-2.5 flex-wrap md:flex-nowrap">
        {/* Left: Search + Clickable Status Chips + Optional Shortcut */}
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto no-scrollbar">
          <div className="relative w-[180px] sm:w-[225px] shrink-0">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim"
            />
            <input
              type="search"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label={searchAriaLabel || searchPlaceholder}
              className="h-7 w-full rounded-lg border border-border-base bg-bg-dark pl-7 pr-6 text-xs text-text-main placeholder:text-text-dim focus:border-accent-green focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-text-dim hover:text-text-main cursor-pointer !min-h-0 !min-w-0"
                title="Limpiar búsqueda"
                aria-label="Limpiar búsqueda"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {statusChips.length > 0 && (
            <>
              <span
                aria-hidden="true"
                className="hidden sm:block h-4 w-px bg-border-base/80 shrink-0"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                {statusChips.map((chip) => {
                  if (chip.hideWhenZero && chip.count === 0) return null;
                  const isActive = statusFilter === chip.key;
                  const chipClass = isActive
                    ? CHIP_ACTIVE_CLASSES[chip.tone]
                    : chip.count > 0
                      ? CHIP_NONZERO_CLASSES[chip.tone]
                      : "bg-bg-dark border border-border-base text-text-dim hover:text-text-main";
                  const dotClass = isActive
                    ? CHIP_DOT_ACTIVE[chip.tone]
                    : chip.count > 0
                      ? `${CHIP_DOT_NONZERO[chip.tone]}${chip.pulse ? " animate-pulse" : ""}`
                      : "bg-slate-600";

                  return (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => toggleChip(chip.key)}
                      title={chip.title}
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap !min-h-0 !min-w-0 ${chipClass}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`}
                      />
                      <span>{chip.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {leftExtra}
        </div>

        {/* Right: Optional extra + Filtros Popover + View Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          {rightExtra}

          <div ref={popoverRef} className="relative">
            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              aria-expanded={filtersOpen}
              aria-haspopup="dialog"
              className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer !min-h-0 !min-w-0 ${
                filtersOpen || activeFiltersCount > 0
                  ? "bg-accent-green/10 border-accent-green/50 text-accent-green"
                  : "bg-bg-dark border-border-base text-text-muted hover:text-text-main hover:bg-bg-card-hover"
              }`}
              title={filtersButtonTitle}
            >
              <SlidersHorizontal size={12} className="shrink-0" />
              <span>Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-accent-green text-black font-mono text-[10px] font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {filtersOpen && (
              <div
                role="dialog"
                aria-label={filtersDialogLabel}
                className="absolute right-0 top-9 z-40 w-80 max-h-[80vh] overflow-y-auto rounded-2xl border border-border-accent/70 bg-bg-card p-3.5 shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="flex items-center justify-between border-b border-border-base/70 pb-2">
                  <span className="text-xs font-semibold text-text-main">
                    Filtros y preferencias
                  </span>
                  {activeFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={onResetFilters}
                      className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-accent-green transition-colors cursor-pointer !min-h-0 !min-w-0"
                    >
                      <RotateCcw size={11} />
                      <span>Restablecer</span>
                    </button>
                  )}
                </div>

                {filterContent}

                {/* Densidad */}
                <div className="space-y-1 pt-2 border-t border-border-base/70">
                  <span className="block text-[11px] font-medium text-text-muted">
                    Densidad
                  </span>
                  <div
                    className="grid grid-cols-2 gap-1 border border-border-base rounded-lg p-0.5 bg-bg-dark"
                    role="group"
                    aria-label="Selector de densidad"
                  >
                    <button
                      type="button"
                      onClick={() => onDensityChange("comfortable")}
                      className={`py-1 rounded-md text-[11px] transition-colors cursor-pointer !min-h-0 !min-w-0 ${
                        density === "comfortable"
                          ? "bg-accent-green/20 text-accent-green font-semibold"
                          : "text-text-dim hover:text-text-main"
                      }`}
                    >
                      Cómodo
                    </button>
                    <button
                      type="button"
                      onClick={() => onDensityChange("compact")}
                      className={`py-1 rounded-md text-[11px] transition-colors cursor-pointer !min-h-0 !min-w-0 ${
                        density === "compact"
                          ? "bg-accent-green/20 text-accent-green font-semibold"
                          : "text-text-dim hover:text-text-main"
                      }`}
                    >
                      Compacto
                    </button>
                  </div>
                </div>

                {/* Exportar CSV */}
                {onExportCSV && (
                  <div className="pt-2 border-t border-border-base/70">
                    <button
                      type="button"
                      disabled={!canExport}
                      onClick={() => {
                        setFiltersOpen(false);
                        onExportCSV();
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-border-base bg-bg-dark hover:bg-bg-card-hover text-xs font-medium text-text-main disabled:opacity-40 cursor-pointer transition-colors !min-h-0"
                    >
                      <Download
                        size={13}
                        className="text-accent-green shrink-0"
                      />
                      <span>Exportar CSV</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* View Switcher */}
          <div
            className="flex items-center border border-border-base rounded-lg p-0.5 bg-bg-dark shrink-0 h-7"
            role="group"
            aria-label="Cambiar vista"
          >
            <button
              type="button"
              onClick={(e) => {
                if (e.detail > 0) e.currentTarget.blur();
                onViewModeChange("grid");
              }}
              className={`p-1 rounded transition-colors cursor-pointer !min-h-0 !min-w-0 ${
                viewMode === "grid"
                  ? "bg-accent-green text-bg-dark"
                  : "text-text-dim hover:text-text-main"
              }`}
              title="Vista Tarjetas"
              aria-label="Vista Tarjetas"
            >
              <LayoutGrid size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                if (e.detail > 0) e.currentTarget.blur();
                onViewModeChange("table");
              }}
              className={`p-1 rounded transition-colors cursor-pointer !min-h-0 !min-w-0 ${
                viewMode === "table"
                  ? "bg-accent-green text-bg-dark"
                  : "text-text-dim hover:text-text-main"
              }`}
              title="Vista Lista"
              aria-label="Vista Lista"
            >
              <List size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
