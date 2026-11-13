import { LayoutGrid, List, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import type { NOCToolbarProps } from "./NOCToolbar";
import ResourceActions, { type ResourceAction } from "../ResourceActions";
import "./connectivity-toolbar.css";

export interface ConnectivityToolbarProps extends NOCToolbarProps {
  testId?: string;
  searchLabel?: string;
  categoryAriaLabel?: string;
  statusAriaLabel?: string;
  countsScope?: string;
  utilities?: ResourceAction[];
}

const tones: Record<string, string> = {
  success: "text-emerald-400",
  warning: "text-amber-400",
  danger: "text-rose-400",
  info: "text-text-dim",
  all: "text-text-muted",
  neutral: "text-text-dim",
};

/** Shared inline directory controls for all Connectivity modules. */
export default function ConnectivityToolbar({
  searchTerm,
  onSearchChange,
  searchPlaceholder = "Buscar por nombre, URL o IP…",
  searchLabel = searchPlaceholder,
  viewMode,
  onViewModeChange,
  categories,
  categoryLabel = "Tipo",
  selectedCategory,
  onCategoryChange,
  categoryAriaLabel = `Filtrar por ${categoryLabel.replace(/:$/, "").toLowerCase()}`,
  statusPills,
  selectedStatus,
  onStatusChange,
  statusAriaLabel = "Filtrar por estado",
  extraFilters,
  className = "",
  testId = "connectivity-toolbar",
  countsScope,
  utilities,
}: ConnectivityToolbarProps) {
  const hasCategories = !!categories?.length && !!onCategoryChange;
  const hasStatuses = !!statusPills?.length && !!onStatusChange;
  const hasView = !!viewMode && !!onViewModeChange;
  const selectClasses =
    "h-11 min-w-0 rounded-full border border-border-base bg-bg-dark px-3 text-xs font-medium text-text-main focus:border-accent-green";
  const controls: ReactNode = (
    <>
      {hasView && (
        <div
          className="flex h-11 items-center rounded-full border border-border-base bg-bg-dark"
          role="group"
          aria-label="Presentación de monitores"
        >
          {(
            [
              ["grid", "Cuadrícula", LayoutGrid],
              ["table", "Lista", List],
            ] as const
          ).map(([mode, label, Icon]) => (
            <button
              key={mode}
              type="button"
              onClick={() => onViewModeChange!(mode)}
              title={label}
              aria-label={label}
              aria-pressed={viewMode === mode}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${viewMode === mode ? "bg-accent-green text-bg-dark" : "text-text-dim hover:bg-bg-card-hover hover:text-text-main"}`}
              >
                <Icon size={16} aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>
      )}
      {!!utilities?.length && (
        <ResourceActions
          label="Más opciones del directorio"
          actions={utilities}
        />
      )}
    </>
  );
  return (
    <section
      data-testid={testId}
      aria-label="Buscar y filtrar recursos"
      className={`connectivity-toolbar ${hasCategories ? "has-category" : ""} ${hasStatuses ? "has-states" : ""} ${extraFilters ? "has-extra" : ""} ${className}`}
    >
      <div className="connectivity-toolbar-search relative min-w-0">
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim"
        />
        <input
          type="search"
          aria-label={searchLabel}
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-11 w-full min-w-0 rounded-full border border-border-base bg-bg-dark pl-10 pr-11 text-sm text-text-main placeholder:text-text-dim focus:border-accent-green focus:outline-none focus:ring-2 focus:ring-accent-green/20"
        />
        {searchTerm && (
          <button
            type="button"
            aria-label="Limpiar búsqueda de monitores"
            title="Limpiar búsqueda"
            onClick={() => onSearchChange("")}
            className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-full text-text-dim hover:text-text-main"
          >
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </div>
      {hasCategories && (
        <select
          aria-label={categoryAriaLabel}
          value={selectedCategory}
          onChange={(event) => onCategoryChange!(event.target.value)}
          className={`connectivity-toolbar-category ${selectClasses}`}
        >
          {categories!.map((category) => (
            <option key={category.id} value={category.id}>
              {category.id === "all"
                ? categoryLabel.replace(/:$/, "")
                : category.label}
            </option>
          ))}
        </select>
      )}
      {hasStatuses && (
        <>
          <div
            role="group"
            aria-label={
              countsScope
                ? `${statusAriaLabel}; ${countsScope}`
                : statusAriaLabel
            }
            className="connectivity-toolbar-states"
          >
            {statusPills!.map((state) => (
              <button
                key={state.id}
                type="button"
                aria-pressed={selectedStatus === state.id}
                aria-label={
                  state.description
                    ? `${state.description}${state.count !== undefined ? ` (${state.count})` : ""}`
                    : undefined
                }
                title={
                  countsScope
                    ? `${state.description || state.label}: ${countsScope}`
                    : state.description || state.label
                }
                onClick={() => onStatusChange!(state.id)}
                className="flex min-h-11 shrink-0 items-center rounded-full text-xs font-medium"
              >
                <span
                  className={`inline-flex min-h-8 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 transition-colors ${selectedStatus === state.id ? "border-accent-green bg-accent-green/10 text-accent-green" : "border-border-base/70 bg-bg-dark text-text-muted hover:border-border-accent hover:text-text-main"}`}
                >
                  {state.label}
                  {state.count !== undefined && (
                    <span
                      className={`monitoring-state-count ${tones[state.variant || "neutral"]}`}
                    >
                      ({state.count})
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
          <select
            aria-label={statusAriaLabel}
            value={selectedStatus}
            onChange={(event) => onStatusChange!(event.target.value)}
            className={`connectivity-toolbar-mobile-state ${selectClasses}`}
          >
            {statusPills!.map((state) => (
              <option key={state.id} value={state.id}>
                {state.label}
              </option>
            ))}
          </select>
        </>
      )}
      {extraFilters && (
        <div className="connectivity-toolbar-extra">{extraFilters}</div>
      )}
      <div className="connectivity-toolbar-controls flex shrink-0 items-center gap-1">
        {controls}
      </div>
    </section>
  );
}
