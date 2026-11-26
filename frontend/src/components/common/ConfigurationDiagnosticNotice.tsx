export default function ConfigurationDiagnosticNotice({
  notice,
  remaining,
  hint = "Probamos la configuración antes de guardar. No se guarda nada.",
}: {
  notice: string;
  remaining: number;
  hint?: string;
}) {
  const wait =
    remaining >= 3600
      ? `${Math.ceil(remaining / 3600)} h`
      : remaining >= 60
        ? `${Math.ceil(remaining / 60)} min`
        : `${remaining} s`;

  return (
    <div
      className="text-[11px] text-text-dim space-y-1"
      data-testid="configuration-diagnostic-notice"
    >
      {hint && <p>{hint}</p>}
      {notice && (
        <p role="status" className="text-amber-300">
          {notice}
          {remaining > 0 && (
            <span className="block text-text-muted">
              Puedes volver a probar en {wait}. Guardar sigue disponible.
            </span>
          )}
        </p>
      )}
    </div>
  );
}
