import { useId, useState } from "react";
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Laptop,
  Package,
  ShieldCheck,
  Terminal,
  X,
  Layers,
  Wrench,
} from "lucide-react";
import { createPortal } from "react-dom";
import ModalSurface from "../common/ModalSurface";
import type { ProbeInstallation } from "../../types/agent_probe";

export type InstallPlatform = "linux" | "windows";

export function PlatformPicker({
  value,
  onChange,
}: {
  value: InstallPlatform;
  onChange: (value: InstallPlatform) => void;
}) {
  const name = useId();
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-text-muted uppercase tracking-wider">
        Plataforma de instalación
      </legend>
      <div className="grid sm:grid-cols-2 gap-3">
        {(
          [
            ["windows", "Windows", "Docker Desktop · PowerShell", Laptop],
            ["linux", "Linux", "Docker Engine · Bash", Terminal],
          ] as const
        ).map(([id, title, caption, Icon]) => {
          const selected = value === id;
          return (
            <label
              key={id}
              className={`relative flex items-center gap-3.5 p-3.5 rounded-xl border transition-all cursor-pointer ${
                selected
                  ? "border-accent-green/60 bg-accent-green/5 shadow-[0_0_15px_rgba(16,185,129,0.08)]"
                  : "border-border-base bg-bg-dark/40 hover:border-white/20 hover:bg-white/5"
              }`}
            >
              <input
                className="sr-only"
                type="radio"
                name={name}
                value={id}
                checked={selected}
                onChange={() => onChange(id)}
              />
              <div
                className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${
                  selected
                    ? "bg-accent-green/20 text-accent-green"
                    : "bg-white/5 text-text-muted"
                }`}
              >
                <Icon size={20} aria-hidden="true" />
              </div>
              <span className="min-w-0 flex-1">
                <strong className={`block text-sm font-semibold ${selected ? "text-text-main" : "text-text-muted"}`}>
                  {title}
                </strong>
                <span className="text-text-muted text-xs block truncate">{caption}</span>
              </span>
              <span
                className={`w-4 h-4 rounded-full border grid place-items-center shrink-0 ${
                  selected
                    ? "border-accent-green bg-accent-green text-black"
                    : "border-white/20 bg-black/30"
                }`}
                aria-hidden="true"
              >
                {selected && <Check size={11} strokeWidth={3} />}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function InstallationPrerequisites({
  platform,
}: {
  platform: InstallPlatform;
}) {
  return (
    <section className="rounded-xl border border-border-base bg-bg-dark/50 p-4 space-y-3 text-xs" aria-label="Antes de instalar">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-text-main flex items-center gap-2">
          <ShieldCheck size={15} className="text-accent-blue" />
          Requisitos previos
        </h3>
        <a
          className="text-accent-green hover:underline inline-flex items-center gap-1 font-medium"
          href={
            platform === "windows"
              ? "https://docs.docker.com/desktop/setup/install/windows-install/"
              : "https://docs.docker.com/engine/install/"
          }
          target="_blank"
          rel="noopener noreferrer"
        >
          Instalar Docker <ExternalLink size={12} />
        </a>
      </div>
      <ul className="space-y-2 text-text-muted">
        <li className="flex items-start gap-2">
          <CheckCircle2 size={15} className="text-accent-green shrink-0 mt-0.5" />
          <span>
            {platform === "windows"
              ? "Docker Desktop iniciado, en modo contenedores Linux."
              : "Docker Engine iniciado y tu usuario autorizado para utilizarlo."}
          </span>
        </li>
        <li className="flex items-start gap-2">
          <CheckCircle2 size={15} className="text-accent-green shrink-0 mt-0.5" />
          <span>
            Instala en un equipo que permanezca encendido y alcance los servicios de tu red.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <ShieldCheck size={15} className="text-accent-blue shrink-0 mt-0.5" />
          <span>
            Permite conexiones salientes hacia Sentinel. No necesitas abrir puertos entrantes.
          </span>
        </li>
      </ul>
    </section>
  );
}

export function CommandBlock({
  label,
  command,
  description,
  disabled = false,
  compact = false,
}: {
  label: string;
  command: string;
  description?: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [feedback, setFeedback] = useState("");
  const heading = useId();
  return (
    <section className="rounded-xl border border-border-base bg-bg-dark/80 overflow-hidden" aria-labelledby={heading}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-black/25">
        <h4 id={heading} className="font-medium text-xs text-text-main flex items-center gap-2">
          <Terminal size={14} className="text-accent-green" />
          {label}
        </h4>
        <button
          type="button"
          disabled={disabled || !command}
          aria-label={`Copiar: ${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(command);
              setFeedback("Copiado");
              setTimeout(() => setFeedback(""), 2500);
            } catch {
              setFeedback("Error al copiar");
              setTimeout(() => setFeedback(""), 2500);
            }
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-text-muted hover:text-text-main hover:bg-white/10 transition-colors disabled:opacity-40"
        >
          <Copy size={13} />
          {feedback || "Copiar"}
        </button>
      </div>
      {description && (
        <p className="px-4 pt-3 text-text-muted text-xs leading-relaxed">{description}</p>
      )}
      <div className="p-3">
        {command && compact ? (
          <details className="group rounded-lg border border-white/5 bg-black/40 overflow-hidden">
            <summary className="list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden flex items-center justify-between p-3 cursor-pointer text-xs font-mono text-text-muted hover:text-text-main transition-colors select-none">
              <span className="flex items-center gap-2">
                <Terminal size={13} className="text-accent-green" />
                <span>Ver script completo que se ejecutará</span>
              </span>
              <ChevronDown size={14} className="text-text-dim transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="p-3 pt-0 border-t border-white/5 mt-1">
              <pre tabIndex={0} className="mt-2 overflow-x-auto font-mono text-[11px] text-emerald-400/90 whitespace-pre p-2 rounded bg-black/60">
                <code>{command}</code>
              </pre>
            </div>
          </details>
        ) : command ? (
          <pre tabIndex={0} className="p-3 rounded-lg bg-black/50 border border-white/5 overflow-x-auto font-mono text-xs text-emerald-400/95 leading-relaxed">
            <code>{command}</code>
          </pre>
        ) : (
          <p className="p-4 border border-dashed border-border-base rounded-lg text-text-muted text-xs text-center">
            Indica la ruta del archivo para preparar este comando.
          </p>
        )}
      </div>
    </section>
  );
}

/** A local filesystem path is never sent to Sentinel or persisted in browser storage. */
function tokenPreparation(path: string, platform: InstallPlatform) {
  const value = path.trim();
  if (!value || /[\r\n\0,]/.test(value)) return "";
  if (platform === "windows") {
    if (!/^(?:[a-zA-Z]:[\\/]|\\\\[^\\])/.test(value)) return "";
    return `$TokenPath = (Resolve-Path -LiteralPath '${value.replace(/'/g, "''")}').Path`;
  }
  if (!value.startsWith("/")) return "";
  return `TOKEN_PATH='${value.replace(/'/g, `'"'"'`)}'\nsudo chown 10001:10001 "$TOKEN_PATH"\nsudo chmod 0400 "$TOKEN_PATH"`;
}

function quickInstall(profile: ProbeInstallation, filename: string) {
  if (profile.platform === "windows") {
    return `& {
  $ErrorActionPreference = 'Stop'
  if ((docker info --format '{{.OSType}}') -ne 'linux') { throw 'Inicia Docker Desktop con contenedores Linux.' }
  $TokenPath = (Resolve-Path -LiteralPath './${filename}').Path
  if (!(Test-Path -LiteralPath $TokenPath -PathType Leaf) -or (Get-Item -LiteralPath $TokenPath).Length -eq 0) { throw 'El archivo de token está vacío o no es un archivo.' }
  if ($TokenPath.Contains(',')) { throw 'Usa una carpeta sin comas en su nombre.' }
  if ((docker ps -a --format '{{.Names}}') -contains '${profile.container_name}') { throw 'El contenedor ya existe. Revisa su estado en Docker.' }
  ${profile.command}
  if ($LASTEXITCODE -ne 0) { throw 'Docker no pudo iniciar Senti9. Revisa el mensaje anterior.' }
}`;
  }
  return `(
  set -eu
  fail() { printf '%s\\n' "$1" >&2; exit 1; }
  [ "$(docker info --format '{{.OSType}}')" = linux ] || fail 'Comprueba que Docker esté iniciado y tu usuario tenga acceso.'
  TOKEN_PATH="$(pwd -P)/${filename}"
  [ -f "$TOKEN_PATH" ] && [ -s "$TOKEN_PATH" ] && [ ! -L "$TOKEN_PATH" ] || fail 'Abre la carpeta privada que contiene el archivo de token descargado.'
  case "$TOKEN_PATH" in *','*|*'"'*) fail 'Usa una carpeta sin comas ni comillas dobles.' ;; esac
  if docker container inspect ${profile.container_name} >/dev/null 2>&1; then fail 'El contenedor ya existe. Revisa su estado en Docker.'; fi
  sudo chmod 0400 -- "$TOKEN_PATH"
  sudo chown --no-dereference 10001:10001 -- "$TOKEN_PATH"
  ${profile.command}
)`;
}

export function InstallationInstructions({
  profile,
  tokenReady = true,
  verificationHint,
}: {
  profile: ProbeInstallation;
  tokenReady?: boolean;
  verificationHint?: string;
}) {
  const [path, setPath] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const preparation = tokenPreparation(path, profile.platform);
  const publicImage = /^(?:docker\.io\/)?davis1924\/senti9(?::|@)/.test(
    profile.image,
  );
  const filename = `${profile.container_name}-token.txt`;
  const quickCommand = quickInstall(profile, filename);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 rounded-xl border border-border-base bg-bg-dark/50">
        <div className="w-10 h-10 rounded-xl bg-accent-blue/10 border border-accent-blue/20 text-accent-blue grid place-items-center shrink-0">
          <Package size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-text-main text-sm">Instalar Senti9 {profile.version}</h3>
          <p className="text-xs text-text-muted">
            {profile.platform === "windows"
              ? "PowerShell · Docker Desktop"
              : "Bash · Docker Engine"}{" "}
            · Linux AMD64 / ARM64
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-mono font-medium border border-white/10 bg-white/5 text-text-muted">
          {profile.distribution === "local"
            ? "Paquete local"
            : publicImage
              ? "Imagen pública"
              : "Registro"}
        </span>
      </div>

      {/* Prerequisites Dropdown without browser arrows */}
      <details className="group rounded-xl border border-border-base/70 bg-bg-dark/30 overflow-hidden">
        <summary className="list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden flex items-center justify-between p-3.5 cursor-pointer text-xs font-medium text-text-muted hover:text-text-main transition-colors select-none">
          <span className="flex items-center gap-2">
            <ShieldCheck size={15} className="text-accent-blue" />
            <span>Requisitos de Docker y red</span>
          </span>
          <ChevronDown size={15} className="text-text-dim transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <div className="p-3.5 pt-0 border-t border-white/5 mt-1">
          <InstallationPrerequisites platform={profile.platform} />
        </div>
      </details>

      {!profile.configured ? (
        <div role="alert" className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs space-y-1">
          <strong>La dirección de Sentinel está pendiente.</strong>
          <p>
            Solicita al administrador que configure el servidor de control antes de instalar.
            Registrar otro agente no resolverá este paso.
          </p>
        </div>
      ) : (
        <>
          {!profile.distribution_ready && (
            <p className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs">
              La disponibilidad de esta distribución aún no está confirmada por el administrador.
            </p>
          )}
          {profile.server_url?.startsWith("http:") && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs space-y-1">
              <strong>Instrucciones de laboratorio local</strong>
              <p>
                El destino es {profile.server_url}. Para clientes fuera de este equipo, incluida una
                VM de Oracle, configura SENTI9_CONTROL_URL con la dirección HTTPS de Sentinel accesible
                desde la VM y vuelve a abrir la instalación.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {profile.distribution === "registry" && (
              <CommandBlock
                label="Instalar con Docker (Pega y ejecuta una sola vez)"
                command={quickCommand}
                compact
                disabled={!tokenReady}
                description={`Guarda ${filename} en una carpeta privada permanente del equipo donde correrá Senti9. ${
                  profile.platform === "linux"
                    ? "Para una VM, transfiere el archivo por SSH (SFTP o SCP). Abre Bash en esa carpeta"
                    : "Abre PowerShell en esa carpeta"
                } y pega el bloque una sola vez. Comprueba Docker, localiza el token y arranca el agente con la imagen configurada.`}
              />
            )}

            {/* Manual Instructions Dropdown without browser arrows */}
            <details className="group rounded-xl border border-border-base/70 bg-bg-dark/30 overflow-hidden" open={profile.distribution === "local" || undefined}>
              <summary className="list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden flex items-center justify-between p-3.5 cursor-pointer text-xs font-medium text-text-muted hover:text-text-main transition-colors select-none">
                <span className="flex items-center gap-2">
                  <Layers size={15} className="text-accent-purple" />
                  <span>
                    {profile.distribution === "local"
                      ? "Instalar desde el paquete local"
                      : "Instalación manual paso a paso o token en otra carpeta"}
                  </span>
                </span>
                <ChevronDown size={15} className="text-text-dim transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <div className="space-y-4 p-4 border-t border-white/5">
                <CommandBlock
                  label="1. Comprueba Docker"
                  command={`docker info --format '{{.OSType}}'`}
                  description="Debe responder “linux”. Si falla, inicia Docker antes de continuar."
                />
                {profile.distribution === "registry" ? (
                  <CommandBlock
                    label="2. Descarga la imagen"
                    command={`docker pull ${profile.image}`}
                    description={
                      publicImage
                        ? "Descarga pública: no necesitas una cuenta de Docker ni ejecutar docker login."
                        : profile.registry_instruction
                    }
                  />
                ) : (
                  <section className="rounded-xl border border-border-base bg-bg-dark/60 p-4">
                    <h4 className="font-medium text-text-main">2. Carga el paquete verificado</h4>
                    <p className="text-text-muted text-xs mt-1">
                      Verifica los hashes del paquete autorizado antes de usar docker image load. Si incluye
                      una firma, valídala con la clave publicada. El comando siguiente utiliza la imagen ya cargada.
                    </p>
                  </section>
                )}
                <section className="p-4 rounded-xl border border-white/10 bg-black/20 space-y-3">
                  <div>
                    <h4 className="font-medium text-text-main text-xs">3. Prepara tu archivo de token</h4>
                    <p className="text-text-muted text-xs mt-0.5">
                      Usa el archivo <code>{filename}</code> que guardaste.
                    </p>
                  </div>
                  <label className="block space-y-1.5">
                    <span className="text-xs text-text-muted">Ruta del archivo de token</span>
                    <input
                      value={path}
                      onChange={(e) => setPath(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full min-h-10 px-3 py-2 rounded-lg bg-bg-dark border border-border-base font-mono text-xs text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-accent-green"
                      placeholder={
                        profile.platform === "windows"
                          ? `C:\\Sentinel\\Senti9\\${filename}`
                          : `/home/usuario/.config/senti9/${filename}`
                      }
                    />
                  </label>
                  <p className="text-text-muted text-[11px]">
                    {profile.platform === "windows"
                      ? "Copia la ruta completa desde las propiedades del archivo."
                      : "Introduce una ruta absoluta. El comando limita su lectura al UID 10001."}{" "}
                    Evita comas y saltos de línea.
                  </p>
                  {path && !preparation && (
                    <p role="alert" className="text-amber-400 text-xs">
                      Introduce una ruta absoluta válida para{" "}
                      {profile.platform === "windows" ? "Windows" : "Linux"}.
                    </p>
                  )}
                  <CommandBlock
                    key={preparation}
                    label="Preparar archivo guardado"
                    command={preparation}
                    disabled={!tokenReady}
                  />
                </section>
                <CommandBlock
                  label="4. Inicia el agente"
                  command={profile.command}
                  disabled={!preparation || !tokenReady}
                  description={
                    !tokenReady
                      ? "Guarda primero el archivo de token y confirma su ubicación privada."
                      : !preparation
                        ? "Completa la ruta del archivo y ejecuta su preparación antes de copiar este comando."
                        : "Ejecuta una sola vez en este equipo. Se conserva la identidad y los pendientes en un volumen propio."
                  }
                />
              </div>
            </details>

            <div className="flex items-start gap-3 p-4 rounded-xl border border-accent-green/20 bg-accent-green/5 text-xs text-text-muted">
              <CheckCircle2 size={17} className="text-accent-green shrink-0 mt-0.5" />
              <p>
                {verificationHint || (
                  <>
                    Al terminar, pulsa <strong>Comprobar conexión</strong>. Que Docker inicie el
                    contenedor todavía no confirma una medición.
                  </>
                )}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Advanced Options Dropdown without browser arrows */}
      <details className="group rounded-xl border border-border-base/70 bg-bg-dark/30 overflow-hidden">
        <summary className="list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden flex items-center justify-between p-3.5 cursor-pointer text-xs font-medium text-text-muted hover:text-text-main transition-colors select-none">
          <span className="flex items-center gap-2">
            <Wrench size={15} className="text-amber-400" />
            <span>Diagnóstico, actualización y opciones avanzadas</span>
          </span>
          <ChevronDown size={15} className="text-text-dim transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <div className="space-y-4 p-4 border-t border-white/5">
          <p className="text-text-muted text-xs">
            Si el contenedor ya existe, evita repetir <code>docker run</code>. Para actualizar, drena,
            espera a que no haya pendientes y detén el anterior. Conserva el archivo de token y el volumen{" "}
            <code className="text-accent-green break-all">{profile.volume_name}</code>.
          </p>
          <CommandBlock
            label="Diagnóstico sin ejecutar monitores"
            command={profile.diagnostic_command}
          />
          <CommandBlock
            label="Consultar entrega local"
            command={profile.status_command}
          />
          <CommandBlock
            label="Drenar antes de actualizar o rotar"
            command={profile.drain_command}
          />
          <CommandBlock
            label="Reanudar tras comprobar la configuración"
            command={profile.resume_command}
          />
          <dl className="grid gap-2 sm:grid-cols-2 p-3 rounded-lg bg-black/20 text-xs text-text-muted">
            <div>
              <dt>Servidor de control</dt>
              <dd className="break-all font-mono text-text-main">{profile.server_url || "Pendiente"}</dd>
            </div>
            <div>
              <dt>Imagen configurada</dt>
              <dd className="break-all font-mono text-text-main">{profile.image}</dd>
            </div>
          </dl>
          <button
            type="button"
            className="text-xs text-accent-green hover:underline inline-flex items-center gap-1.5 font-medium"
            onClick={() => {
              let url: string | undefined;
              try {
                url = URL.createObjectURL(
                  new Blob([JSON.stringify(profile, null, 2)], {
                    type: "application/json",
                  }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = `${profile.container_name}-perfil.json`;
                a.click();
                setDownloadError("");
              } catch {
                setDownloadError("No se pudo preparar la descarga del perfil. Reintenta.");
              } finally {
                if (url) URL.revokeObjectURL(url);
              }
            }}
          >
            <Download size={14} />
            Descargar perfil para instalador avanzado (JSON)
          </button>
          {downloadError && (
            <p role="alert" className="text-amber-400 text-xs">
              {downloadError}
            </p>
          )}
        </div>
      </details>
    </div>
  );
}

export function Senti9InstallGuide({
  onClose,
  onRegister,
}: {
  onClose: () => void;
  onRegister?: () => void;
}) {
  const [platform, setPlatform] = useState<InstallPlatform>("windows");
  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm grid place-items-center p-3"
      onClick={onClose}
    >
      <ModalSurface
        label="Guía de instalación de Senti9"
        onClose={onClose}
        className="bg-bg-card border border-border-base rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92dvh] flex flex-col text-sm"
      >
        <header className="flex items-center justify-between p-5 border-b border-border-base">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-accent-blue/10 border border-accent-blue/20 text-accent-blue grid place-items-center shrink-0">
              <BookOpen size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-accent-blue">GUÍA DE INSTALACIÓN</p>
              <h2 className="text-xl font-bold text-text-main">Conecta tu red con Sentinel</h2>
            </div>
          </div>
          <button
            className="w-9 h-9 rounded-lg grid place-items-center text-text-muted hover:text-text-main hover:bg-white/5 transition-colors"
            aria-label="Cerrar guía de instalación"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="overflow-y-auto min-h-0 p-5 sm:p-6 space-y-5">
          <PlatformPicker value={platform} onChange={setPlatform} />
          <InstallationPrerequisites platform={platform} />
          <ol className="space-y-3">
            {[
              [
                "Registra la ubicación",
                "Dale un nombre reconocible: oficina central, sucursal o datacenter.",
              ],
              [
                "Instala el contenedor",
                "Guarda el token y sigue los comandos personalizados. La imagen pública no requiere una cuenta de Docker.",
              ],
              [
                "Confirma y mide",
                "Espera la primera señal; después crea un monitor privado y comprueba su resultado.",
              ],
            ].map(([title, text], i) => (
              <li key={title} className="flex items-start gap-3 p-3.5 rounded-xl border border-border-base/60 bg-bg-dark/30">
                <span className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-text-main font-mono text-xs font-semibold grid place-items-center shrink-0">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-text-main text-sm">{title}</h3>
                  <p className="text-text-muted text-xs mt-0.5">{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="p-3.5 rounded-xl border border-white/5 bg-white/5 text-xs text-text-muted">
            ¿Ya registraste el agente? Abre <strong>Instalar</strong> en su tarjeta. Usa tu archivo de token existente; las instrucciones no generan otro.
          </p>
        </div>
        <footer className="flex items-center justify-between p-4 sm:p-5 border-t border-border-base bg-black/20">
          <p className="text-text-muted text-xs">
            El equipo debe permanecer encendido.
          </p>
          {onRegister ? (
            <button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-green hover:bg-emerald-400 text-black font-semibold text-xs transition-colors"
              onClick={onRegister}
            >
              Registrar Senti9 <Terminal size={14} />
            </button>
          ) : (
            <p className="text-xs text-text-muted">
              Un administrador puede registrar e instalar agentes.
            </p>
          )}
        </footer>
      </ModalSurface>
    </div>,
    document.body,
  );
}
