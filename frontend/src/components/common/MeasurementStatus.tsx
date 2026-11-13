import type { ScanAvailability } from "../../types/scan";
export default function MeasurementStatus({
  snapshot,
}: {
  snapshot?: ScanAvailability;
}) {
  const measurement = snapshot?.measurement;
  const execution = snapshot?.execution;
  return (
    <section
      aria-label="Estado de la medición"
      className="text-sm border border-border-base rounded-xl p-3 space-y-1 text-text-muted"
    >
      <p>
        {measurement?.at
          ? `Medición ${measurement.origin === "agent" ? "desde Senti9" : "cloud"} · ${new Date(measurement.at).toLocaleString()}`
          : "Sin medición confirmada"}
        {measurement?.freshness === "stale"
          ? " · Dato anterior a la cadencia esperada"
          : ""}
      </p>
      {execution && (
        <p
          className={
            execution.state === "failed" || execution.state === "expired"
              ? "text-accent-yellow"
              : ""
          }
        >
          Última ejecución:{" "}
          {
            (
              {
                queued: "aceptada, pendiente de resultado",
                running: "ejecutando",
                completed: "terminada",
                failed: "falló al realizar la medición",
                expired: "vencida sin resultado confirmado",
              } as const
            )[execution.state]
          }
          .{" "}
          {execution.state === "failed" || execution.state === "expired"
            ? "Esto no acredita una caída del servicio."
            : ""}
        </p>
      )}
    </section>
  );
}
