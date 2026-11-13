import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Loader2,
  Server,
  X,
} from "lucide-react";
import ModalSurface from "../common/ModalSurface";
import { api } from "../../services/api";
import type { AgentProbe, ProbeInstallation } from "../../types/agent_probe";
import { useAuthStore } from "../../store/authStore";
import { useConnectivityRefresh } from "../../hooks/useConnectivityRefresh";
import {
  CommandBlock,
  InstallationInstructions,
  PlatformPicker,
  type InstallPlatform,
} from "./Senti9Installation";
export { CommandBlock, InstallationInstructions } from "./Senti9Installation";

export default function Senti9Setup({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const quota = useConnectivityRefresh().subscription?.usage?.private_agents;
  const identity = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<InstallPlatform>("windows");
  const [distribution, setDistribution] = useState<"registry" | "local">(
    "registry",
  );
  const [probe, setProbe] = useState<AgentProbe | null>(null);
  const [profile, setProfile] = useState<ProbeInstallation | null>(null);
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const active = useRef(0);
  const profileRequest = useRef<AbortController | null>(null);
  const invalidateRequests = useCallback(() => {
    active.current++;
    profileRequest.current?.abort();
  }, []);
  const close = () => {
    active.current++;
    profileRequest.current?.abort();
    setToken("");
    setProbe(null);
    setProfile(null);
    setStep(1);
    setName("");
    setError("");
    setSaved(false);
    setDownloaded(false);
    setVerified(false);
    setTimedOut(false);
    onClose();
  };
  useEffect(() => {
    active.current++;
    setToken("");
    setProbe(null);
    setProfile(null);
    setStep(1);
    setSaved(false);
    setDownloaded(false);
    setVerified(false);
    setTimedOut(false);
    setError("");
    setBusy(false);
    return invalidateRequests;
  }, [identity, isOpen, invalidateRequests]);
  useEffect(() => {
    if (!isOpen || step !== 3 || !probe?.id || verified) return;
    const controller = new AbortController();
    const deadline = Date.now() + 120_000;
    let checking = false;
    const check = async () => {
      if (Date.now() >= deadline) {
        setTimedOut(true);
        return;
      }
      if (document.hidden || checking) return;
      checking = true;
      try {
        const r = await api.get(`agent-probes/${probe.id}/detail/`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const current = r.data.data as AgentProbe;
        if (current.last_heartbeat) {
          setVerified(true);
          setProbe(current);
          void queryClient.invalidateQueries({ queryKey: ["agent-probes"] });
        }
        setError("");
      } catch {
        if (!controller.signal.aborted)
          setError(
            "No se pudo leer la conexión. Reintenta sin registrar otro agente.",
          );
      } finally {
        checking = false;
      }
    };
    void check();
    const timer = setInterval(() => {
      if (Date.now() >= deadline) {
        setTimedOut(true);
        controller.abort();
        clearInterval(timer);
      } else void check();
    }, 10_000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [isOpen, step, probe?.id, attempt, queryClient, verified]);
  if (!isOpen) return null;
  const register = async () => {
    const generation = active.current;
    setBusy(true);
    setError("");
    try {
      const r = await api.post("agent-probes/", {
        name: name.trim(),
        platform,
        distribution,
      });
      if (generation !== active.current) return;
      const data = r.data.data as AgentProbe;
      setToken(data.raw_token || "");
      setProbe({ ...data, raw_token: undefined });
      setProfile(data.installation || null);
      setStep(2);
      void queryClient.invalidateQueries({ queryKey: ["agent-probes"] });
      void queryClient.invalidateQueries({ queryKey: ["org-subscription"] });
      onSuccess?.();
    } catch {
      if (generation === active.current)
        setError(
          "No se pudo registrar. Comprueba el nombre, tu cuota y la conexión.",
        );
    } finally {
      if (generation === active.current) setBusy(false);
    }
  };
  const download = () => {
    let url: string | undefined;
    try {
      if (!token) throw new Error();
      url = URL.createObjectURL(new Blob([token], { type: "text/plain" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `senti9-${probe?.id.slice(0, 8)}-token.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setDownloaded(true);
    } catch {
      setError(
        "No se pudo preparar la descarga. Mantén este diálogo abierto y reintenta.",
      );
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  };
  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm grid place-items-center p-3"
      onClick={close}
    >
      <ModalSurface
        label="Registrar Senti9"
        focusKey={step}
        onClose={close}
        className="senti9-modal bg-bg-card border border-border-base rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92dvh] flex flex-col text-sm"
      >
        <header className="senti9-modal-header">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="senti9-title-icon">
              <Server size={23} />
            </span>
            <div>
              <p className="senti9-eyebrow">NUEVO AGENTE PRIVADO</p>
              <h2 className="text-2xl font-bold">Conectar Senti9</h2>
            </div>
          </div>
          <button
            aria-label="Cerrar instalación de Senti9"
            className="min-h-11 min-w-11 grid place-items-center"
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        <ol aria-label="Progreso de instalación" className="senti9-stepper">
          {["Registrar", "Instalar", "Verificar"].map((label, i) => (
            <li
              key={label}
              aria-current={step === i + 1 ? "step" : undefined}
              className={
                step === i + 1 ? "is-current" : step > i + 1 ? "is-done" : ""
              }
            >
              <span>{step > i + 1 ? <CheckCircle2 size={17} /> : i + 1}</span>
              <strong>{label}</strong>
            </li>
          ))}
        </ol>
        <div className="min-h-0 overflow-y-auto p-5 sm:p-6 space-y-5">
          {error && (
            <p
              role="alert"
              className="p-3 border border-accent-red/40 rounded-xl text-accent-red"
            >
              {error}
            </p>
          )}
          {step === 1 && (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void register();
              }}
            >
              <div>
                <h3 className="text-lg font-semibold">
                  ¿Desde dónde vas a monitorear?
                </h3>
                <p className="text-text-muted mt-1">
                  Usa un nombre que identifique la oficina, sucursal o
                  datacenter.
                </p>
              </div>
              <p className="senti9-inline-help">
                {quota
                  ? quota.is_unlimited
                    ? `${quota.current} agentes registrados · sin límite de cupos.`
                    : `${quota.current} usados de ${quota.limit} cupos · ${Math.max(0, quota.limit - quota.current)} disponibles.`
                  : "Cuota disponible sin confirmar."}
              </p>
              <label className="block space-y-2">
                <span>Nombre del agente</span>
                <input
                  required
                  maxLength={255}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Oficina central"
                  className="w-full min-h-11 p-3 rounded-xl bg-bg-main border border-border-base"
                />
              </label>
              <PlatformPicker value={platform} onChange={setPlatform} />
              <p className="text-text-muted">
                El agente inicia conexiones salientes. No necesitas publicar
                puertos de tu red.
              </p>
              <button
                disabled={
                  busy ||
                  !name.trim() ||
                  !!(
                    quota &&
                    !quota.is_unlimited &&
                    quota.current >= quota.limit
                  )
                }
                className="min-h-11 px-5 rounded-xl bg-accent-green text-black font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <ArrowRight size={18} />
                )}
                Registrar agente
              </button>
            </form>
          )}
          {step === 2 && (
            <>
              <section className="senti9-secret-step">
                <div className="senti9-title-icon">
                  <Download size={22} />
                </div>
                <div className="space-y-3 min-w-0 flex-1">
                  <h3 className="font-semibold">
                    Guarda la llave de acceso de {probe?.name}
                  </h3>
                  <p className="text-text-muted">
                    {token
                      ? "Este archivo identifica a tu agente. Sólo puedes descargarlo en este paso; guárdalo en una carpeta privada."
                      : "Usa el archivo que ya guardaste. La copia temporal se eliminó al iniciar la verificación; volver aquí no genera otro token."}
                  </p>
                  {token && (
                    <button
                      className="min-h-11 px-4 rounded-xl bg-accent-green text-black font-semibold flex items-center gap-2"
                      onClick={download}
                    >
                      <Download size={18} />
                      Descargar archivo de token
                    </button>
                  )}
                  {token && (
                    <p className="text-text-muted">
                      {downloaded
                        ? "Descarga preparada. Confirma que guardaste el archivo antes de continuar."
                        : "Descarga el archivo antes de ejecutar comandos."}
                    </p>
                  )}
                  <label className="flex items-center gap-3 min-h-11">
                    <input
                      type="checkbox"
                      checked={saved}
                      disabled={!downloaded}
                      onChange={(e) => setSaved(e.target.checked)}
                    />
                    Guardé el archivo en una ubicación privada.
                  </label>
                </div>
              </section>
              <details className="senti9-disclosure">
                <summary>Otra fuente de instalación</summary>
                <label className="block space-y-2 pt-3">
                  <span>Fuente de la imagen</span>
                  <select
                    value={distribution}
                    className="min-h-11 rounded-xl p-3 bg-bg-main border border-border-base"
                    onChange={async (e) => {
                      const value = e.target.value as typeof distribution;
                      setDistribution(value);
                      setProfile(null);
                      profileRequest.current?.abort();
                      const controller = new AbortController();
                      profileRequest.current = controller;
                      const generation = active.current;
                      try {
                        const r = await api.get(
                          `agent-probes/${probe?.id}/installation/`,
                          {
                            params: { platform, distribution: value },
                            signal: controller.signal,
                          },
                        );
                        if (
                          !controller.signal.aborted &&
                          generation === active.current
                        )
                          setProfile(r.data.data);
                      } catch {
                        if (
                          controller.signal.aborted ||
                          generation !== active.current
                        )
                          return;
                        setError(
                          "No se pudo leer el perfil de instalación. El token no cambió.",
                        );
                      }
                    }}
                  >
                    <option value="registry">Docker Hub / registro</option>
                    <option value="local">Paquete local verificado</option>
                  </select>
                </label>
              </details>
              {profile ? (
                <InstallationInstructions
                  key={`${profile.platform}:${profile.distribution}`}
                  profile={profile}
                  tokenReady={saved}
                />
              ) : (
                <p role="status">Preparando instrucciones de instalación…</p>
              )}
              <div className="flex justify-end">
                <button
                  disabled={!saved || !profile?.configured}
                  className="min-h-11 px-5 rounded-xl bg-accent-green text-black font-semibold disabled:opacity-50"
                  onClick={() => {
                    setToken("");
                    setTimedOut(false);
                    setError("");
                    setStep(3);
                  }}
                >
                  Comprobar conexión
                </button>
              </div>
            </>
          )}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex gap-3 p-4 rounded-xl bg-bg-main border border-border-base">
                {verified ? (
                  <CheckCircle2 className="text-accent-green shrink-0" />
                ) : !timedOut ? (
                  <Loader2 className="animate-spin text-accent-purple shrink-0" />
                ) : (
                  <Server className="text-text-muted shrink-0" />
                )}
                <div>
                  <h3 className="font-semibold">
                    {verified
                      ? "Conexión confirmada"
                      : timedOut
                        ? "Conexión sin confirmar"
                        : "Esperando la primera señal"}
                  </h3>
                  <p className="text-text-muted mt-2">
                    {verified
                      ? "Senti9 ya se comunicó con Sentinel. La primera medición se obtiene al asignar un monitor."
                      : timedOut
                        ? "No llegó una señal durante dos minutos. Revisa el servidor, archivo de token, CA y conectividad saliente."
                        : "Consultamos cada diez segundos durante un máximo de dos minutos. Puedes cerrar y revisar después."}
                  </p>
                </div>
              </div>
              {timedOut && (
                <>
                  <CommandBlock
                    label="Diagnóstico local sin ejecutar monitores"
                    command={profile?.diagnostic_command || ""}
                  />
                  <button
                    className="min-h-11 px-4 border border-border-base rounded-xl"
                    onClick={() => {
                      setTimedOut(false);
                      setAttempt((x) => x + 1);
                    }}
                  >
                    Reintentar verificación
                  </button>
                </>
              )}
              <button
                className="min-h-11 px-5 rounded-xl bg-accent-green text-black font-semibold"
                onClick={() => {
                  const id = probe?.id;
                  close();
                  navigate(`/monitoring?create=1&agent=${id}`);
                }}
              >
                Crear monitor privado
              </button>
              {!verified && (
                <p className="text-text-muted">
                  Puedes guardarlo ahora; su primera comprobación quedará
                  pendiente hasta la conexión.
                </p>
              )}
              {!verified && (
                <button
                  className="senti9-text-action"
                  onClick={() => setStep(2)}
                >
                  Volver a las instrucciones de instalación
                </button>
              )}
            </div>
          )}
        </div>
      </ModalSurface>
    </div>,
    document.body,
  );
}
