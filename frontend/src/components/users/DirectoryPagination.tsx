import type { DirectoryMeta } from "../../hooks/useMemberDirectory";

export default function DirectoryPagination({
  meta,
  onPage,
}: {
  meta?: DirectoryMeta;
  onPage: (page: number) => void;
}) {
  if (!meta) return null;
  return (
    <nav
      aria-label="Páginas del directorio"
      className="flex flex-col items-start gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <span>
        {meta.total} {meta.total === 1 ? "resultado" : "resultados"} · Página{" "}
        {meta.page} de {meta.total_pages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className="min-h-11 px-3 border border-border-base rounded-xl disabled:opacity-40"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
        >
          Anterior
        </button>
        <button
          type="button"
          className="min-h-11 px-3 border border-border-base rounded-xl disabled:opacity-40"
          disabled={!meta.has_next}
          onClick={() => onPage(meta.page + 1)}
        >
          Siguiente
        </button>
      </div>
    </nav>
  );
}
