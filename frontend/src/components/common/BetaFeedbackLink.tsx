import { useQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { api } from "../../services/api";
import { useAuthStore } from "../../store/authStore";

export default function BetaFeedbackLink() {
  const beta = useAuthStore((s) => s.user?.organization?.beta_managed === true);
  const query = useQuery<{ enabled: boolean; submission_url: string | null }>({
    queryKey: ["beta-feedback"],
    enabled: beta,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) =>
      (await api.get("organizations/current/beta-feedback/", { signal })).data
        .data,
  });
  if (!beta) return null;
  if (query.isError)
    return (
      <button
        type="button"
        className="min-h-11 text-xs text-text-muted"
        onClick={() => void query.refetch()}
      >
        Reintentar canal de comentarios
      </button>
    );
  if (query.data?.enabled && query.data.submission_url)
    return (
      <a
        className="flex min-h-11 min-w-11 items-center justify-center gap-2 text-xs text-accent-green"
        href={query.data.submission_url}
        target="_blank"
        rel="noopener noreferrer"
      >
        <MessageSquare size={17} />
        <span className="hidden sm:inline">Enviar comentario</span>
        <span className="sr-only sm:hidden">Enviar comentario</span>
      </a>
    );
  return (
    <span className="text-xs text-text-muted">
      {query.isPending
        ? "Consultando comentarios…"
        : "Comentarios: pendiente de configurar"}
    </span>
  );
}
