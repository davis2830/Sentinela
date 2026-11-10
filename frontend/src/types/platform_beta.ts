import type { paths } from "./generated/api";
export type BetaAttention =
  | "failed_delivery"
  | "expired"
  | "verification"
  | "blocked"
  | "unconfigured"
  | "unmeasured";
export const betaAttention: Record<
  BetaAttention,
  { label: string; hint: string }
> = {
  failed_delivery: {
    label: "Envíos fallidos",
    hint: "Último envío de invitación o verificación con fallo.",
  },
  expired: {
    label: "Invitaciones vencidas",
    hint: "Participantes cuyo registro sigue pendiente.",
  },
  verification: {
    label: "Correos por verificar",
    hint: "Registros con invitación vigente.",
  },
  blocked: {
    label: "Accesos bloqueados",
    hint: "Cuenta, organización o participación beta suspendida.",
  },
  unconfigured: {
    label: "Sin recursos configurados",
    hint: "Organización registrada sin recursos en los seis módulos.",
  },
  unmeasured: {
    label: "Sin mediciones registradas",
    hint: "Tiene recursos actuales pero aún no consta una comprobación.",
  },
};

export type BetaOverview =
  paths["/api/v1/platform-admin/beta/overview/"]["get"]["responses"][200]["content"]["application/json"]["data"];
export type BetaDirectory =
  paths["/api/v1/platform-admin/beta/"]["get"]["responses"][200]["content"]["application/json"]["data"];
export type BetaParticipant = BetaDirectory["invitations"][number];
export type BetaDelivery = NonNullable<BetaParticipant["delivery"]>;
export type ResourcePage =
  paths["/api/v1/platform-admin/organizations/{org_id}/resources/"]["get"]["responses"][200]["content"]["application/json"]["data"];
export type PlanPreview =
  paths["/api/v1/platform-admin/organizations/{org_id}/plan-preview/"]["post"]["responses"][200]["content"]["application/json"]["data"];
export type PlatformHealth =
  paths["/api/v1/platform-admin/health/"]["get"]["responses"][200]["content"]["application/json"]["data"];
export interface ResourceUsage {
  module: string;
  label: string;
  limit_key: string;
  limit: number;
  total: number;
  measured: number;
}
