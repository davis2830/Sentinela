import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import DataConsultationAge from "../common/DataConsultationAge";
import { ActionButton } from "./PlatformUI";
import { RefreshCw } from "lucide-react";

export default function PlatformRefresh({ prefix }: { prefix: string }) {
  const client = useQueryClient();
  const [, redraw] = useState(0);
  useEffect(() => {
    let active = true;
    let scheduled = false;
    const unsubscribe = client.getQueryCache().subscribe(() => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        if (active) redraw((n) => n + 1);
      });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [client]);
  const queries = client
    .getQueryCache()
    .getAll()
    .filter((q) => q.queryKey[0] === prefix && q.isActive());
  const pending = queries.some((q) => q.state.fetchStatus === "fetching");
  const failed = queries.some((q) => q.state.status === "error");
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <DataConsultationAge
        updatedAt={Math.max(0, ...queries.map((q) => q.state.dataUpdatedAt))}
      />
      {failed && (
        <span role="status">
          Error de consulta; los datos anteriores pueden estar desactualizados.
        </span>
      )}
      <ActionButton
        tone="tertiary"
        aria-label={
          pending
            ? "Actualizando…"
            : prefix === "platform-admin-stats"
              ? "Actualizar resumen"
              : "Actualizar datos"
        }
        title={
          prefix === "platform-admin-stats"
            ? "Actualizar resumen"
            : "Actualizar datos"
        }
        disabled={pending}
        onClick={() =>
          void client.refetchQueries({ queryKey: [prefix], type: "active" })
        }
      >
        <RefreshCw
          size={15}
          aria-hidden="true"
          className={pending ? "animate-spin" : ""}
        />
        <span className="hidden sm:inline">
          {pending
            ? "Actualizando…"
            : prefix === "platform-admin-stats"
              ? "Actualizar resumen"
              : "Actualizar datos"}
        </span>
      </ActionButton>
    </div>
  );
}
