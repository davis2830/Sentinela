import { createContext, useContext, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

export const platformSections = {
  resumen: {
    title: "Resumen de plataforma",
    description:
      "Acompaña a los participantes de la beta y resuelve sus pendientes.",
  },
  organizaciones: {
    title: "Organizaciones",
    description: "Busca clientes y administra sus planes, pruebas y acceso.",
  },
  usuarios: {
    title: "Usuarios",
    description: "Revisa cuentas, permisos y seguridad de acceso.",
  },
  beta: {
    title: "Beta privada",
    description: "Invita clientes y administra cupos y admisiones.",
  },
  salud: {
    title: "Salud de plataforma",
    description:
      "Consulta dependencias y colas de Sentinel sin ejecutar acciones sobre la infraestructura.",
  },
  auditoria: {
    title: "Auditoría de plataforma",
    description: "Investiga actividad por usuario, organización o período.",
  },
};
export type PlatformSection = keyof typeof platformSections;
type Navigation = {
  section: PlatformSection;
  setSection: (section: string) => void;
};
const Context = createContext<Navigation | null>(null);
export function PlatformNavigationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [params, setParams] = useSearchParams();
  const candidate = params.get("tab") || "resumen";
  const section = (
    Object.prototype.hasOwnProperty.call(platformSections, candidate)
      ? candidate
      : "resumen"
  ) as PlatformSection;
  return (
    <Context.Provider
      value={{ section, setSection: (value) => setParams({ tab: value }) }}
    >
      {children}
    </Context.Provider>
  );
}
export function usePlatformNavigation() {
  const context = useContext(Context);
  if (!context) throw new Error("PlatformNavigationProvider is required");
  return context;
}
