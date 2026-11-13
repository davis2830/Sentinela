export function bulkOutcome(payload: unknown, selected: string[]) {
  if (!payload || typeof payload !== "object")
    return {
      pending: selected,
      message:
        "Resultado sin detalle. Revisa los recursos antes de reintentar.",
    };
  const value = payload as {
    results?: { id: string; state: string }[];
    message?: string;
  };
  const applied = new Set(
    Array.isArray(value.results)
      ? value.results.filter((r) => r.state === "applied").map((r) => r.id)
      : [],
  );
  return {
    pending: selected.filter((id) => !applied.has(id)),
    message:
      value.message ||
      "Resultado sin confirmar. No se reintentaron operaciones.",
  };
}
