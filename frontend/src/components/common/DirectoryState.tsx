import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DirectoryMeta } from "../../hooks/useConnectivityDirectory";

export function ReadFailure({
  retry,
  stale = false,
}: {
  retry: () => unknown;
  stale?: boolean;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-accent-red/40 bg-bg-card p-4 text-sm flex flex-wrap items-center justify-between gap-3"
    >
      <p>
        {stale
          ? "No se pudo actualizar. Se conservan los datos de la consulta anterior."
          : "No se pudieron consultar los recursos. No se puede determinar si la lista está vacía."}
      </p>
      <button className="ui-button" onClick={() => void retry()}>
        Reintentar consulta
      </button>
    </div>
  );
}
export function DirectoryPagination({
  directory,
}: {
  directory: {
    page: number;
    setPage: (p: number) => void;
    meta?: DirectoryMeta | null;
    isFetching: boolean;
    isError: boolean;
  };
}) {
  const { page, setPage, meta, isFetching, isError } = directory;
  const size = meta?.page_size || 25;
  const pages = meta ? Math.max(1, Math.ceil(meta.total / size)) : page;
  // Navigation only adds value when a second page exists (26+ at size 25).
  if (page === 1 && (!meta || (pages === 1 && !meta.has_next))) return null;
  const first = meta?.total ? (page - 1) * size + 1 : 0;
  const last = meta ? Math.min(page * size, meta.total) : 0;
  return (
    <nav
      aria-label="Páginas de recursos"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border-base/70 py-3 text-sm"
      aria-busy={isFetching}
    >
      <span className="text-xs text-text-dim" aria-live="polite">
        {isFetching
          ? "Consultando resultados…"
          : meta
            ? `Mostrando ${first}–${last} de ${meta.total} resultados`
            : "Total no disponible"}
      </span>
      <div className="flex items-center gap-1 rounded-xl border border-border-base/80 bg-bg-card p-1">
        <button
          type="button"
          className="inline-flex h-11 items-center gap-1 rounded-lg px-3 text-xs font-medium text-text-muted transition-colors hover:bg-bg-card-hover disabled:cursor-not-allowed disabled:opacity-40"
          disabled={page === 1 || isFetching}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Anterior
        </button>
        <span
          className="inline-flex h-11 items-center rounded-lg bg-accent-green/10 px-3 font-mono text-xs text-accent-green"
          aria-label={`Página ${page} de ${pages}`}
        >
          {page} <span className="mx-1.5 text-text-dim">/</span> {pages}
        </span>
        <button
          type="button"
          className="inline-flex h-11 items-center gap-1 rounded-lg px-3 text-xs font-medium text-text-muted transition-colors hover:bg-bg-card-hover disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!meta?.has_next || isFetching || isError}
          onClick={() => setPage(page + 1)}
        >
          Siguiente
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
export function ActionFeedback({ children }: { children: ReactNode }) {
  return children ? (
    <p
      role="status"
      className="rounded-xl border border-border-base p-3 text-sm text-text-muted"
    >
      {children}
    </p>
  ) : null;
}
