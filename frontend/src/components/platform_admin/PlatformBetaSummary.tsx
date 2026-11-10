import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowRight,
  Building2,
  BarChart3,
  ChevronDown,
  CircleHelp,
  Clock3,
  Fingerprint,
  Layers3,
  Mail,
  MailWarning,
  MessageSquare,
  ShieldAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import { platformApi } from "../../services/platformApi";
import {
  betaAttention,
  type BetaAttention,
  type BetaOverview,
} from "../../types/platform_beta";
import type { PlatformStats } from "../../types/platform_admin";
import { ActionButton } from "./PlatformUI";
import PlatformSummary from "./PlatformSummary";
import PlatformRefresh from "./PlatformRefresh";

const priorities: {
  id: BetaAttention;
  icon: LucideIcon;
  color: string;
  iconSurface: string;
}[] = [
  {
    id: "failed_delivery",
    icon: MailWarning,
    color: "text-accent-red",
    iconSurface: "bg-accent-red/10",
  },
  {
    id: "blocked",
    icon: ShieldAlert,
    color: "text-accent-red",
    iconSurface: "bg-accent-red/10",
  },
  {
    id: "expired",
    icon: Clock3,
    color: "text-accent-yellow",
    iconSurface: "bg-accent-yellow/10",
  },
  {
    id: "verification",
    icon: Fingerprint,
    color: "text-accent-yellow",
    iconSurface: "bg-accent-yellow/10",
  },
  {
    id: "unconfigured",
    icon: Layers3,
    color: "text-text-main",
    iconSurface: "bg-white/[.05]",
  },
  {
    id: "unmeasured",
    icon: BarChart3,
    color: "text-text-main",
    iconSurface: "bg-white/[.05]",
  },
];

export default function PlatformBetaSummary({
  active,
  onOpenBeta,
  onOpenDirectory,
}: {
  active: boolean;
  onOpenBeta: (attention: BetaAttention) => void;
  onOpenDirectory: (plan: string, status: string, expiring?: boolean) => void;
}) {
  const [commercial, setCommercial] = useState(false);
  const beta = useQuery<BetaOverview>({
    queryKey: ["beta-overview"],
    enabled: active,
    queryFn: async ({ signal }) =>
      (await platformApi.get("platform-admin/beta/overview/", { signal })).data
        .data,
    refetchOnWindowFocus: false,
  });
  const stats = useQuery<PlatformStats>({
    queryKey: ["platform-admin-stats"],
    enabled: active && commercial,
    queryFn: async ({ signal }) =>
      (await platformApi.get("platform-admin/stats/", { signal })).data.data,
    refetchOnWindowFocus: false,
  });
  const data = beta.data;
  const metrics = data
    ? [
        {
          label: "Cupos disponibles",
          value: data.available,
          note: "Para nuevos participantes",
          icon: Users,
        },
        {
          label: "Invitaciones vigentes",
          value: data.invited,
          note: "Esperando el registro",
          icon: Mail,
        },
        {
          label: "Correos por verificar",
          value: data.verification,
          note: "Registro aún incompleto",
          icon: Fingerprint,
        },
        {
          label: "Organizaciones registradas",
          value: data.registered,
          note: "Con organización creada",
          icon: Building2,
        },
      ]
    : [];
  const reservation =
    data && data.capacity > 0
      ? Math.min(100, Math.max(0, (data.reserved / data.capacity) * 100))
      : 0;

  return (
    <div className="beta-overview space-y-5">
      {beta.isPending && <p role="status">Cargando seguimiento de beta…</p>}
      {beta.isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-red/30 bg-accent-red/5 p-4 text-sm"
        >
          <p>
            No se pudo consultar la beta.{" "}
            {data ? "Los datos anteriores pueden estar desactualizados." : ""}
          </p>
          <ActionButton onClick={() => void beta.refetch()}>
            Reintentar resumen
          </ActionButton>
        </div>
      )}
      {data && (
        <>
          <section
            className="beta-overview-metrics grid grid-cols-2 gap-x-4 gap-y-5 border-y border-border-base py-5 lg:grid-cols-4"
            aria-label="Indicadores de beta"
          >
            {metrics.map(({ label, value, note, icon: Icon }) => (
              <div
                key={label}
                className="min-w-0 lg:border-r lg:border-border-base lg:pr-4 lg:last:border-0"
              >
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <Icon
                    size={16}
                    className="shrink-0 text-accent-green"
                    aria-hidden="true"
                  />
                  <p>{label}</p>
                </div>
                <p className="mt-2 text-[34px] font-semibold leading-none tracking-tight tabular-nums">
                  {value}
                </p>
                <p className="mt-2 text-xs text-text-muted">{note}</p>
              </div>
            ))}
          </section>
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
            <section
              aria-labelledby="beta-attention-title"
              className="beta-priorities min-w-0 overflow-hidden rounded-2xl border border-border-base bg-bg-card"
            >
              <header className="flex items-start justify-between gap-3 border-b border-border-base px-5 py-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-text-muted">
                    Mesa de seguimiento
                  </p>
                  <h2
                    id="beta-attention-title"
                    className="mt-1 text-xl font-semibold tracking-tight"
                  >
                    Requiere atención
                  </h2>
                </div>
                <span className="mt-1 rounded-full border border-border-base px-2.5 py-1 text-xs text-text-muted">
                  6 criterios
                </span>
              </header>
              <div className="divide-y divide-border-base">
                {priorities
                  .slice(0, 3)
                  .map(({ id, icon: Icon, color, iconSurface }) => {
                    const item = betaAttention[id],
                      count = data.attention[id];
                    return (
                      <div
                        key={id}
                        className="beta-priority-row flex items-center gap-3 px-4 py-3 sm:px-5"
                      >
                        <div
                          className={
                            "grid h-9 w-9 shrink-0 place-items-center rounded-xl " +
                            (count
                              ? iconSurface + " " + color
                              : "bg-white/[.03] text-text-muted")
                          }
                        >
                          <Icon size={18} aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-medium">{item.label}</h3>
                          <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
                            {item.hint}
                          </p>
                        </div>
                        <strong
                          className={
                            "min-w-5 text-right text-xl font-semibold tabular-nums " +
                            (count ? color : "text-text-muted")
                          }
                        >
                          {count}
                        </strong>
                        {count > 0 ? (
                          <ActionButton
                            tone="tertiary"
                            aria-label={"Revisar " + item.label.toLowerCase()}
                            onClick={() => onOpenBeta(id)}
                            className="!min-w-11 !px-2 text-accent-green"
                          >
                            <span className="hidden sm:inline">Revisar</span>
                            <ArrowRight size={17} aria-hidden="true" />
                          </ActionButton>
                        ) : (
                          <span
                            aria-label="Sin pendientes en este criterio"
                            className="grid min-h-11 min-w-11 place-items-center text-text-muted"
                          >
                            —
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
              <details className="border-t border-border-base">
                <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-5 py-3">
                  <span>
                    <span className="block text-sm font-medium">
                      Continuar incorporación
                    </span>
                    <span className="mt-0.5 block text-xs text-text-muted">
                      {data.attention.verification} por verificar ·{" "}
                      {data.attention.unconfigured} sin recursos ·{" "}
                      {data.attention.unmeasured} sin medición
                    </span>
                  </span>
                  <ChevronDown
                    size={16}
                    className="shrink-0 text-text-muted"
                    aria-hidden="true"
                  />
                </summary>
                <div className="divide-y divide-border-base border-t border-border-base">
                  {priorities
                    .slice(3)
                    .map(({ id, icon: Icon, color, iconSurface }) => {
                      const item = betaAttention[id],
                        count = data.attention[id];
                      return (
                        <div
                          key={id}
                          className="beta-priority-row flex items-center gap-3 px-4 py-3 sm:px-5"
                        >
                          <div
                            className={
                              "grid h-9 w-9 shrink-0 place-items-center rounded-xl " +
                              (count
                                ? iconSurface + " " + color
                                : "bg-white/[.03] text-text-muted")
                            }
                          >
                            <Icon size={18} aria-hidden="true" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-medium">
                              {item.label}
                            </h3>
                            <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
                              {item.hint}
                            </p>
                          </div>
                          <strong
                            className={
                              "min-w-5 text-right text-xl font-semibold tabular-nums " +
                              (count ? color : "text-text-muted")
                            }
                          >
                            {count}
                          </strong>
                          {count > 0 ? (
                            <ActionButton
                              tone="tertiary"
                              aria-label={"Revisar " + item.label.toLowerCase()}
                              onClick={() => onOpenBeta(id)}
                              className="!min-w-11 !px-2 text-accent-green"
                            >
                              <span className="hidden sm:inline">Revisar</span>
                              <ArrowRight size={17} aria-hidden="true" />
                            </ActionButton>
                          ) : (
                            <span
                              aria-label="Sin pendientes en este criterio"
                              className="grid min-h-11 min-w-11 place-items-center text-text-muted"
                            >
                              —
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </details>
              <p className="border-t border-border-base px-5 py-3 text-xs leading-relaxed text-text-muted">
                Una persona puede aparecer en varios criterios. Estos grupos no
                se suman.
              </p>
            </section>
            <aside className="beta-onboarding min-w-0 space-y-4">
              <section className="rounded-2xl border border-border-base bg-bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">
                    Admisiones de la beta
                  </h2>
                  <span
                    className={
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium " +
                      (data.admissions_open
                        ? "bg-accent-green/10 text-accent-green"
                        : "bg-white/[.05] text-text-muted")
                    }
                  >
                    <span
                      className={
                        "h-1.5 w-1.5 rounded-full " +
                        (data.admissions_open
                          ? "bg-accent-green"
                          : "bg-text-muted")
                      }
                    />
                    {data.admissions_open ? "Abiertas" : "Cerradas"}
                  </span>
                </div>
                <div className="mt-4 flex items-baseline justify-between gap-3">
                  <p className="text-sm text-text-muted">Cupos reservados</p>
                  <p className="font-semibold tabular-nums">
                    {data.reserved}
                    <span className="font-normal text-text-muted">
                      {" "}
                      / {data.capacity}
                    </span>
                  </p>
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-dark"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-accent-green"
                    style={{ width: reservation + "%" }}
                  />
                </div>
              </section>
              <section className="px-1">
                <h2 className="text-base font-semibold">
                  Recorrido del participante
                </h2>
                <p className="mt-1 text-xs text-text-muted">
                  Qué significa cada etapa del directorio.
                </p>
                <ol className="mt-4 space-y-1">
                  {[
                    {
                      title: "Invitación enviada",
                      text: "Debe abrir el enlace y registrarse.",
                      icon: Mail,
                    },
                    {
                      title: "Verificación del correo",
                      text: "Confirma su identidad para continuar.",
                      icon: Fingerprint,
                    },
                    {
                      title: "Organización registrada",
                      text: "Puede configurar recursos y obtener mediciones.",
                      icon: Building2,
                    },
                  ].map(({ title, text, icon: Icon }, index) => (
                    <li key={title} className="flex gap-3">
                      <div className="flex w-8 shrink-0 flex-col items-center">
                        <span className="grid h-8 w-8 place-items-center rounded-lg border border-border-base bg-bg-card text-text-muted">
                          <Icon size={15} aria-hidden="true" />
                        </span>
                        {index < 2 && (
                          <ArrowDown
                            size={13}
                            className="my-2 text-text-muted"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <div className="pb-3">
                        <p className="text-sm font-medium">{title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
                          {text}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                {!data.feedback_configured && (
                  <div className="mt-1 flex items-start gap-2 border-t border-border-base pt-3 text-xs leading-relaxed text-text-muted">
                    <MessageSquare size={16} className="mt-0.5 shrink-0" />
                    <p>
                      Canal de comentarios pendiente. Configúralo desde Beta.
                    </p>
                  </div>
                )}
              </section>
            </aside>
          </div>
          <details className="beta-scope border-t border-border-base pt-1 text-xs text-text-muted">
            <summary className="flex min-h-11 w-fit cursor-pointer items-center gap-2">
              <CircleHelp size={14} aria-hidden="true" />
              Alcance de este resumen
            </summary>
            <p className="max-w-3xl pb-3 leading-relaxed">
              {data.scope} Los recursos y mediciones describen su estado actual,
              no un historial de adopción.
            </p>
          </details>
        </>
      )}
      <details
        className="beta-commercial border-t border-border-base pt-2"
        onToggle={(e) => setCommercial(e.currentTarget.open)}
      >
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
          <span className="flex items-center gap-3">
            <BarChart3
              size={18}
              className="text-text-muted"
              aria-hidden="true"
            />
            <span>
              <span className="block font-medium">Contexto comercial</span>
              <span className="block text-xs text-text-muted">
                Planes, suscripciones y estimaciones
              </span>
            </span>
          </span>
          <ChevronDown
            size={16}
            className="text-text-muted"
            aria-hidden="true"
          />
        </summary>
        {commercial && (
          <div className="space-y-4 pt-4">
            <p className="text-xs text-text-muted">
              Clientes; excluye organizaciones marcadas manualmente como prueba.
              Las estimaciones no representan pagos cobrados.
            </p>
            <PlatformRefresh prefix="platform-admin-stats" />
            {stats.isPending && (
              <p role="status">Consultando información comercial…</p>
            )}
            {stats.isError && (
              <p role="alert">No se pudo consultar el contexto comercial.</p>
            )}
            {stats.data && (
              <PlatformSummary
                stats={stats.data}
                onOpenDirectory={onOpenDirectory}
              />
            )}
          </div>
        )}
      </details>
    </div>
  );
}
