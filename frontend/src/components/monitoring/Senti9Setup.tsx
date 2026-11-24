import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ChevronDown,
  Download,
  KeyRound,
  Loader2,
  Radio,
  RotateCw,
  Server,
  Settings2,
  ShieldCheck,
  Terminal,
  X,
  Plus,
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
  const [platform, setPlatform] = useState<InstallPlatform>("linux");
  const [distribution, setDistribution] = useState<"registry" | "local">(
    "registry",
  );
  const [probe, setProbe] = useState<AgentProbe | null>(null);
  const [profile, setProfile] = useState<ProbeInstallation | null>(null);
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

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
    setElapsedSeconds(0);
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
    setElapsedSeconds(0);
    setError("");
    setBusy(false);
    return invalidateRequests;
  }, [identity, isOpen, invalidateRequests]);

  // Polling beacon during Step 3
  useEffect(() => {
    if (!isOpen || step !== 3 || !probe?.id || verified) return;
    const controller = new AbortController();
    const startTime = Date.now();
    const deadline = startTime + 120_000;
    let checking = false;

    // Elapsed timer for radar UI
    const ticker = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

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
      } else {
        void check();
      }
    }, 10_000);

    return () => {
      controller.abort();
      clearInterval(timer);
      clearInterval(ticker);
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
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md grid place-items-center p-3 sm:p-5"
      onClick={close}
    >
      <ModalSurface
        label="Registrar Senti9"
        focusKey={step}
        onClose={close}
        className="bg-bg-card border border-border-base rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92dvh] flex flex-col text-sm overflow-hidden"
      >
        {/* Header */}
        <header className="flex items-center justify-between p-5 sm:p-6 border-b border-border-base bg-bg-dark/40">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-accent-green/10 border border-accent-green/20 text-accent-green grid place-items-center shrink-0">
              <Server size={22} />
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-wider uppercase text-accent-green">
                NUEVO AGENTE PRIVADO
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-text-main tracking-tight">
                Conectar Senti9
              </h2>
            </div>
          </div>
          <button
            aria-label="Cerrar instalación de Senti9"
            className="w-9 h-9 rounded-lg grid place-items-center text-text-muted hover:text-text-main hover:bg-white/5 transition-colors"
            onClick={close}
          >
            <X size={19} />
          </button>
        </header>

        {/* Stepper Progress Bar */}
        <ol aria-label="Progreso de instalación" className="grid grid-cols-3 border-b border-border-base/70 bg-bg-dark/60">
          {[
            { num: 1, label: "Registrar" },
            { num: 2, label: "Instalar" },
            { num: 3, label: "Verificar" },
          ].map(({ num, label }) => {
            const isCurrent = step === num;
            const isDone = step > num;
            return (
              <li
                key={label}
                aria-current={isCurrent ? "step" : undefined}
                className={`flex items-center justify-center gap-2.5 py-3 px-2 border-b-2 text-xs font-medium transition-colors ${
                  isCurrent
                    ? "border-accent-green text-accent-green bg-accent-green/5"
                    : isDone
                      ? "border-accent-green/40 text-text-muted"
                      : "border-transparent text-text-dim"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full grid place-items-center font-mono text-[11px] font-bold ${
                    isCurrent
                      ? "bg-accent-green text-black"
                      : isDone
                        ? "bg-accent-green/20 text-accent-green"
                        : "bg-white/5 border border-white/10 text-text-muted"
                  }`}
                >
                  {isDone ? <CheckCircle2 size={14} /> : num}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </li>
            );
          })}
        </ol>

        {/* Scrollable Content Body */}
        <div className="min-h-0 overflow-y-auto p-5 sm:p-6 space-y-5">
          {error && (
            <p
              role="alert"
              className="p-3.5 border border-accent-red/40 bg-accent-red/10 rounded-xl text-accent-red text-xs leading-relaxed"
            >
              {error}
            </p>
          )}

          {/* STEP 1: Registration Form */}
          {step === 1 && (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void register();
              }}
            >
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-text-main">
                  ¿Desde dónde vas a monitorear?
                </h3>
                <p className="text-text-muted text-xs sm:text-sm mt-1">
                  Usa un nombre que identifique la oficina, VM de Oracle, sucursal o datacenter.
                </p>
              </div>

              {/* Quota info */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-black/20 text-xs text-text-muted">
                <span className="w-2 h-2 rounded-full bg-accent-green" />
                <span>
                  {quota
                    ? quota.is_unlimited
                      ? `${quota.current} agentes registrados · sin límite de cupos.`
                      : `${quota.current} usados de ${quota.limit} cupos (${Math.max(0, quota.limit - quota.current)} disponibles).`
                    : "Consultando cuota disponible…"}
                </span>
              </div>

              {/* Agent Name input */}
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Nombre del agente
                </span>
                <input
                  required
                  maxLength={255}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: VM Oracle Cloud - US East"
                  className="w-full min-h-11 px-4 rounded-xl bg-bg-dark border border-border-base text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-accent-green text-sm"
                />
              </label>

              {/* Platform Picker */}
              <PlatformPicker value={platform} onChange={setPlatform} />

              <div className="p-3.5 rounded-xl border border-white/5 bg-white/5 text-xs text-text-muted flex items-start gap-2.5">
                <ShieldCheck size={16} className="text-accent-blue shrink-0 mt-0.5" />
                <span>
                  Senti9 inicia exclusivamente conexiones HTTPS salientes hacia Sentinel.
                  No necesitas abrir puertos entrantes ni configurar reglas de firewall en tu router.
                </span>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={
                    busy ||
                    !name.trim() ||
                    !!(
                      quota &&
                      !quota.is_unlimited &&
                      quota.current >= quota.limit
                    )
                  }
                  className="min-h-11 px-6 rounded-xl bg-accent-green hover:bg-emerald-400 text-black font-semibold text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:shadow-none"
                >
                  {busy ? (
                    <Loader2 className="animate-spin" size={17} />
                  ) : (
                    <Terminal size={16} />
                  )}
                  Registrar e ir a instalación
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Token Download & Installation Instructions */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Highlight Secret Token Box */}
              <section className="flex flex-col sm:flex-row items-start gap-4 p-5 rounded-xl border border-accent-green/30 bg-accent-green/5 shadow-[0_0_20px_rgba(16,185,129,0.06)]">
                <div className="w-11 h-11 rounded-xl bg-accent-green/10 border border-accent-green/20 text-accent-green grid place-items-center shrink-0">
                  <KeyRound size={22} />
                </div>
                <div className="space-y-3 min-w-0 flex-1">
                  <div>
                    <h3 className="font-semibold text-base text-text-main">
                      Guarda la llave de acceso de {probe?.name}
                    </h3>
                    <p className="text-text-muted text-xs leading-relaxed mt-1">
                      {token
                        ? "Este archivo contiene el token seguro que identifica a tu agente. Descárgalo ahora; por seguridad no volverá a mostrarse."
                        : "Usa el archivo de token que guardaste previamente."}
                    </p>
                  </div>

                  {token && (
                    <button
                      type="button"
                      className="min-h-10 px-4 rounded-xl bg-accent-green hover:bg-emerald-400 text-black font-semibold text-xs flex items-center gap-2 shadow-md transition-colors"
                      onClick={download}
                    >
                      <Download size={15} />
                      Descargar archivo de token (.txt)
                    </button>
                  )}

                  <label className="flex items-center gap-2.5 pt-1 text-xs text-text-main cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={saved}
                      disabled={!downloaded && !!token}
                      onChange={(e) => setSaved(e.target.checked)}
                      className="w-4 h-4 rounded border-border-base text-accent-green focus:ring-0 focus:ring-offset-0 bg-bg-dark"
                    />
                    <span>He guardado el archivo de token en una ubicación privada del servidor o VM.</span>
                  </label>
                </div>
              </section>

              {/* Distribution Switcher Accordion without browser arrows */}
              <details className="group rounded-xl border border-border-base/70 bg-bg-dark/30 overflow-hidden">
                <summary className="list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden flex items-center justify-between p-3.5 cursor-pointer text-xs font-medium text-text-muted hover:text-text-main transition-colors select-none">
                  <span className="flex items-center gap-2">
                    <Settings2 size={15} className="text-accent-blue" />
                    <span>Distribución avanzada de Docker</span>
                  </span>
                  <ChevronDown size={15} className="text-text-dim transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="p-3.5 pt-0 border-t border-white/5 mt-1">
                  <label className="block space-y-1.5 pt-2">
                    <span className="text-xs text-text-muted">Fuente de la imagen</span>
                    <select
                      value={distribution}
                      className="min-h-10 rounded-lg px-3 bg-bg-dark border border-border-base text-text-main text-xs"
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
                      <option value="registry">Docker Hub / Registro oficial (davis1924/senti9)</option>
                      <option value="local">Paquete local verificado</option>
                    </select>
                  </label>
                </div>
              </details>

              {/* Instructions */}
              {profile ? (
                <InstallationInstructions
                  key={`${profile.platform}:${profile.distribution}`}
                  profile={profile}
                  tokenReady={saved}
                />
              ) : (
                <div className="flex items-center gap-2 p-6 justify-center text-xs text-text-muted">
                  <Loader2 className="animate-spin text-accent-green" size={16} />
                  <span>Preparando instrucciones personalizadas para {platform}…</span>
                </div>
              )}

              {/* Footer action to go to Step 3 */}
              <div className="flex justify-between items-center pt-2 border-t border-white/5">
                <button
                  type="button"
                  className="text-xs text-text-muted hover:text-text-main font-medium"
                  onClick={() => setStep(1)}
                >
                  Volver a configurar nombre
                </button>
                <button
                  type="button"
                  disabled={!saved || !profile?.configured}
                  className="min-h-11 px-6 rounded-xl bg-accent-green hover:bg-emerald-400 text-black font-semibold text-sm flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:shadow-none"
                  onClick={() => {
                    setToken("");
                    setTimedOut(false);
                    setError("");
                    setStep(3);
                  }}
                >
                  Comprobar conexión <Radio size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Radar Beacon Real-Time Verification */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Radar Card Canvas */}
              <div className="relative overflow-hidden rounded-2xl border border-border-base bg-gradient-to-b from-bg-dark/90 via-black/80 to-bg-dark/95 p-8 text-center flex flex-col items-center justify-center min-h-[340px]">
                {/* Visual Radar Rings */}
                <div className="relative flex items-center justify-center w-52 h-52 mb-6">
                  {/* Concentric rings */}
                  <div className="absolute inset-0 rounded-full border border-white/5" />
                  <div className="absolute inset-6 rounded-full border border-white/10" />
                  <div className="absolute inset-12 rounded-full border border-white/10" />

                  {/* Pulsing beacon if active */}
                  {!verified && !timedOut && (
                    <>
                      <div className="absolute inset-0 rounded-full border-2 border-accent-green/20 animate-ping opacity-30" />
                      <div className="absolute inset-8 rounded-full border border-accent-blue/40 animate-pulse opacity-40" />
                      {/* Rotating sweep line */}
                      <div
                        className="absolute w-26 h-26 rounded-full border-t-2 border-r-2 border-accent-green/80 animate-spin"
                        style={{ animationDuration: "3s" }}
                      />
                    </>
                  )}

                  {/* Central Hub */}
                  <div
                    className={`relative w-20 h-20 rounded-full grid place-items-center transition-all ${
                      verified
                        ? "bg-accent-green/20 border-2 border-accent-green text-accent-green shadow-[0_0_35px_rgba(16,185,129,0.4)]"
                        : timedOut
                          ? "bg-amber-500/20 border-2 border-amber-500 text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.25)]"
                          : "bg-accent-green/10 border border-accent-green/50 text-accent-green shadow-[0_0_25px_rgba(16,185,129,0.2)]"
                    }`}
                  >
                    {verified ? (
                      <CheckCircle2 size={38} className="text-accent-green" />
                    ) : timedOut ? (
                      <Server size={34} className="text-amber-400" />
                    ) : (
                      <Radio size={34} className="text-accent-green animate-pulse" />
                    )}
                  </div>
                </div>

                {/* Status Text & Headings */}
                <div className="max-w-md space-y-2">
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-text-main">
                    {verified
                      ? "¡Conexión Confirmada con Éxito!"
                      : timedOut
                        ? "Señal sin confirmar todavía"
                        : "Buscando señal de Senti9…"}
                  </h3>
                  <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                    {verified
                      ? `El agente "${probe?.name}" ya se comunicó con Sentinel. Su telemetría y monitores están listos.`
                      : timedOut
                        ? "No se recibió el latido inicial durante los 2 minutos de espera. Revisa que el contenedor Docker esté corriendo en tu servidor."
                        : `Sondeando cada 10 segundos (${elapsedSeconds}s transcurridos). En cuanto Docker inicie el agente, aparecerá aquí.`}
                  </p>
                </div>

                {/* Live Polling Indicator Badge */}
                {!verified && !timedOut && (
                  <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent-green/30 bg-accent-green/5 text-xs text-accent-green font-mono">
                    <span className="w-2 h-2 rounded-full bg-accent-green animate-ping" />
                    <span>Esperando latido en HTTPS /api/v1/agent-probes/heartbeat/</span>
                  </div>
                )}

                {/* Agent Details Badge when verified */}
                {verified && probe && (
                  <div className="mt-6 p-4 rounded-xl border border-accent-green/30 bg-black/40 text-left w-full max-w-md text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-text-muted">ID Agente:</span>
                      <span className="font-mono text-text-main">{probe.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Estado:</span>
                      <span className="font-semibold text-accent-green">ONLINE (Activo)</span>
                    </div>
                    {probe.last_heartbeat && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">Primer latido:</span>
                        <span className="font-mono text-text-main">
                          {new Date(probe.last_heartbeat).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* In Case of Timeout: Diagnostic assistance */}
              {timedOut && (
                <div className="space-y-4">
                  <CommandBlock
                    label="Diagnóstico local (ejecutar dentro de la VM/servidor)"
                    command={
                      profile?.diagnostic_command ||
                      `docker exec senti9-${probe?.id.slice(0, 8)} python -m diagnostics`
                    }
                    description="Ejecuta este comando en la terminal donde corrió Docker para ver si el contenedor no pudo resolver el dominio o leer el token."
                  />
                  <div className="flex items-center gap-3 justify-center">
                    <button
                      type="button"
                      className="min-h-10 px-4 border border-border-base rounded-xl text-xs font-medium text-text-main hover:bg-white/5 transition-colors flex items-center gap-2"
                      onClick={() => {
                        setTimedOut(false);
                        setElapsedSeconds(0);
                        setAttempt((x) => x + 1);
                      }}
                    >
                      <RotateCw size={14} />
                      Reintentar verificación
                    </button>
                    <button
                      type="button"
                      className="text-xs text-accent-green hover:underline font-medium"
                      onClick={() => setStep(2)}
                    >
                      Volver a revisar comandos de instalación
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-white/5">
                {verified ? (
                  <>
                    <button
                      type="button"
                      className="w-full sm:w-auto min-h-11 px-5 rounded-xl border border-border-base hover:bg-white/5 text-text-main text-xs font-semibold transition-colors"
                      onClick={() => {
                        close();
                        void queryClient.invalidateQueries({ queryKey: ["agent-probes"] });
                      }}
                    >
                      Ver agentes en Senti9
                    </button>
                    <button
                      type="button"
                      className="w-full sm:w-auto min-h-11 px-6 rounded-xl bg-accent-green hover:bg-emerald-400 text-black font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-colors"
                      onClick={() => {
                        const id = probe?.id;
                        close();
                        navigate(`/monitoring?create=1&agent=${id}`);
                      }}
                    >
                      <Plus size={16} />
                      Crear primer monitor privado
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="text-xs text-text-muted hover:text-text-main"
                      onClick={close}
                    >
                      Cerrar y verificar después
                    </button>
                    <button
                      type="button"
                      className="min-h-10 px-4 rounded-xl border border-white/10 hover:bg-white/5 text-text-main text-xs font-medium"
                      onClick={() => {
                        const id = probe?.id;
                        close();
                        navigate(`/monitoring?create=1&agent=${id}`);
                      }}
                    >
                      Continuar a crear monitor privado
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </ModalSurface>
    </div>,
    document.body,
  );
}
