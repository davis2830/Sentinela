import { useId, useState } from "react";
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Laptop,
  Package,
  ShieldCheck,
  Terminal,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import ModalSurface from "../common/ModalSurface";
import type { ProbeInstallation } from "../../types/agent_probe";
import "./senti9.css";

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
    <fieldset className="space-y-3">
      <legend className="font-medium">Plataforma de instalación</legend>
      <div className="grid sm:grid-cols-2 gap-3">
        {(
          [
            ["windows", "Windows", "Docker Desktop · PowerShell", Laptop],
            ["linux", "Linux", "Docker Engine · Bash", Terminal],
          ] as const
        ).map(([id, title, caption, Icon]) => (
          <label
            key={id}
            className={`senti9-platform ${value === id ? "is-selected" : ""}`}
          >
            <input
              className="senti9-platform-input"
              type="radio"
              name={name}
              value={id}
              checked={value === id}
              onChange={() => onChange(id)}
            />
            <Icon size={24} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <strong className="block">{title}</strong>
              <span className="text-text-muted text-sm">{caption}</span>
            </span>
            <span className="senti9-radio" aria-hidden="true">
              {value === id && <Check size={12} />}
            </span>
          </label>
        ))}
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
    <section className="senti9-prerequisites" aria-label="Antes de instalar">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold">Antes de instalar</h3>
        <a
          className="senti9-text-action"
          href={
            platform === "windows"
              ? "https://docs.docker.com/desktop/setup/install/windows-install/"
              : "https://docs.docker.com/engine/install/"
          }
          target="_blank"
          rel="noopener noreferrer"
        >
          Instalar Docker <ExternalLink size={14} />
        </a>
      </div>
      <ul className="space-y-2 text-text-muted">
        <li>
          <CheckCircle2 size={16} />
          <span>
            {platform === "windows"
              ? "Docker Desktop iniciado, en modo contenedores Linux."
              : "Docker Engine iniciado y tu usuario autorizado para utilizarlo."}
          </span>
        </li>
        <li>
          <CheckCircle2 size={16} />
          <span>
            Instala en un equipo que permanezca encendido y alcance los
            servicios de tu red.
          </span>
        </li>
        <li>
          <ShieldCheck size={16} />
          <span>
            Permite conexiones salientes hacia Sentinel. No necesitas abrir
            puertos entrantes.
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
}: {
  label: string;
  command: string;
  description?: string;
  disabled?: boolean;
}) {
  const [feedback, setFeedback] = useState("");
  const heading = useId();
  return (
    <section className="senti9-command" aria-labelledby={heading}>
      <div className="senti9-command-heading">
        <h4 id={heading} className="font-medium">
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
            } catch {
              setFeedback("No se pudo copiar. Selecciona el comando.");
            }
          }}
        >
          <Copy size={15} />
          {feedback === "Copiado" ? "Copiado" : "Copiar"}
        </button>
      </div>
      {description && (
        <p className="text-text-muted text-sm mb-3">{description}</p>
      )}
      {command ? (
        <pre tabIndex={0}>
          <code>{command}</code>
        </pre>
      ) : (
        <p className="senti9-command-placeholder">
          Indica la ruta del archivo para preparar este comando.
        </p>
      )}
      <span role="status" className="block text-sm text-text-muted">
        {feedback}
      </span>
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
  return (
    <div className="senti9-installation space-y-5">
      <div className="senti9-install-context">
        <Package size={22} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Instalar Senti9 {profile.version}</h3>
          <p className="text-sm text-text-muted">
            {profile.platform === "windows"
              ? "PowerShell · Docker Desktop"
              : "Bash · Docker Engine"}{" "}
            · Linux AMD64 / ARM64
          </p>
        </div>
        <span className="ui-status" data-tone="muted">
          {profile.distribution === "local"
            ? "Paquete local"
            : publicImage
              ? "Imagen pública"
              : "Registro"}
        </span>
      </div>
      <InstallationPrerequisites platform={profile.platform} />
      {!profile.configured ? (
        <div role="alert" className="senti9-notice">
          <strong>La dirección de Sentinel está pendiente.</strong>
          <p>
            Solicita al administrador que configure el servidor de control antes
            de instalar. Registrar otro agente no resolverá este paso.
          </p>
        </div>
      ) : (
        <>
          {!profile.distribution_ready && (
            <p className="senti9-notice">
              La disponibilidad de esta distribución aún no está confirmada por
              el administrador.
            </p>
          )}
          {profile.server_url?.startsWith("http:") && (
            <div className="senti9-notice">
              <strong>Instrucciones de laboratorio local</strong>
              <p>
                El destino es {profile.server_url}. Para clientes fuera de este
                equipo, el administrador debe proporcionar una dirección HTTPS
                accesible desde su red.
              </p>
            </div>
          )}
          <div className="senti9-install-steps">
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
              <section className="senti9-command">
                <h4 className="font-medium">2. Carga el paquete verificado</h4>
                <p className="text-text-muted mt-2">
                  Verifica los hashes del paquete autorizado antes de usar
                  docker image load. Si incluye una firma, valídala con la clave
                  publicada. El comando siguiente utiliza la imagen ya cargada.
                </p>
              </section>
            )}
            <section className="senti9-token-location space-y-3">
              <div>
                <h4 className="font-medium">3. Prepara tu archivo de token</h4>
                <p className="text-text-muted mt-1">
                  Usa el archivo <code>{filename}</code> que guardaste. La ruta
                  se utiliza sólo aquí para generar el comando.
                </p>
              </div>
              <label className="block space-y-2">
                <span className="font-medium">Ruta del archivo de token</span>
                <input
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="senti9-input font-mono"
                  placeholder={
                    profile.platform === "windows"
                      ? `C:\\Sentinel\\Senti9\\${filename}`
                      : `/home/usuario/.config/senti9/${filename}`
                  }
                />
              </label>
              <p className="text-text-muted text-sm">
                {profile.platform === "windows"
                  ? "Copia la ruta completa desde las propiedades del archivo. Mantén acceso únicamente para el operador autorizado."
                  : "Introduce una ruta absoluta. El comando limita su lectura al usuario del contenedor (UID 10001)."}{" "}
                Evita comas y saltos de línea.
              </p>
              {path && !preparation && (
                <p role="alert" className="text-accent-yellow">
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
            <div className="senti9-success-hint">
              <CheckCircle2 size={19} />
              <p>
                {verificationHint || (
                  <>
                    Al terminar, vuelve a Sentinel y pulsa{" "}
                    <strong>Comprobar conexión</strong>. Que Docker inicie el
                    contenedor todavía no confirma una medición.
                  </>
                )}
              </p>
            </div>
          </div>
        </>
      )}
      <details className="senti9-disclosure">
        <summary>Diagnóstico, actualización y opciones avanzadas</summary>
        <div className="space-y-5 pt-4">
          <p className="text-text-muted">
            Si el contenedor ya existe, evita repetir <code>docker run</code>.
            Para actualizar, drena, espera a que no haya pendientes y detén el
            anterior. Conserva el archivo de token y el volumen{" "}
            <code className="break-all">{profile.volume_name}</code>.
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
          <p className="text-text-muted">
            CA corporativa: monta el certificado PEM de sólo lectura y configura
            SENTININE_CONTROL_CA_FILE; para destinos privados,
            SENTININE_TARGET_CA_FILE. Conserva la validación TLS.
          </p>
          <p className="text-text-muted">
            Para servicios del host utiliza <code>host.docker.internal</code>;{" "}
            <code>localhost</code> dentro del contenedor designa al contenedor.{" "}
            <a
              className="text-accent-green underline"
              href="https://docs.docker.com/desktop/features/networking/networking-how-tos/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Redes de Docker
            </a>
            .
          </p>
          <dl className="space-y-2 text-text-muted">
            <div>
              <dt>Servidor de control</dt>
              <dd className="break-all text-text-main">
                {profile.server_url || "Pendiente"}
              </dd>
            </div>
            <div>
              <dt>Imagen configurada</dt>
              <dd className="break-all font-mono text-xs">{profile.image}</dd>
            </div>
          </dl>
          <button
            className="senti9-text-action"
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
                setDownloadError(
                  "No se pudo preparar la descarga del perfil. Reintenta.",
                );
              } finally {
                if (url) URL.revokeObjectURL(url);
              }
            }}
          >
            <Download size={16} />
            Descargar perfil para instalador avanzado
          </button>
          {downloadError && (
            <p role="alert" className="text-accent-yellow">
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
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-3"
      onClick={onClose}
    >
      <ModalSurface
        label="Guía de instalación de Senti9"
        onClose={onClose}
        className="senti9-modal bg-bg-card border border-border-base rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92dvh] flex flex-col text-sm"
      >
        <header className="senti9-modal-header">
          <div className="senti9-title-icon">
            <BookOpen size={23} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="senti9-eyebrow">GUÍA DE INSTALACIÓN</p>
            <h2 className="text-2xl font-bold">Conecta tu red con Sentinel</h2>
          </div>
          <button
            className="ui-button ui-button-icon"
            aria-label="Cerrar guía de instalación"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>
        <div className="overflow-y-auto min-h-0 p-5 sm:p-6 space-y-5">
          <PlatformPicker value={platform} onChange={setPlatform} />
          <InstallationPrerequisites platform={platform} />
          <ol className="senti9-journey">
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
              <li key={title}>
                <span className="senti9-step-number">{i + 1}</span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-text-muted mt-1">{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="senti9-inline-help">
            ¿Ya registraste el agente? Abre <strong>Instalar</strong> en su
            fila. Usa tu archivo de token existente; las instrucciones no
            generan otro.
          </p>
        </div>
        <footer className="senti9-modal-footer">
          <p className="text-text-muted">
            El equipo debe permanecer encendido.
          </p>
          {onRegister ? (
            <button
              className="ui-button ui-button-primary"
              onClick={onRegister}
            >
              Registrar Senti9 <ChevronRight size={17} />
            </button>
          ) : (
            <p>
              Un administrador de tu organización puede registrar e instalar
              agentes.
            </p>
          )}
        </footer>
      </ModalSurface>
    </div>,
    document.body,
  );
}
